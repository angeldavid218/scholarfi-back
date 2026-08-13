import googleClassroomConfig, { assertGoogleClassroomConfig } from '#config/google_classroom'
import {
  gcLogError,
  gcLogInfo,
} from '#services/integrations/google_classroom/logger'
import Institution from '#models/institution'
import Task from '#models/task'
import {
  assertTeacherCanFundTaskReward,
  getTeacherCreditPoolSummary,
} from '#services/credits/teacher_credit_pool_service'
import {
  InsufficientInstitutionCreditsError,
  InsufficientTeacherCreditsError,
} from '#services/credits/types'
import { assertInstitutionCanFundTaskReward } from '#services/credits/institution_credit_pool_service'
import {
  getGoogleClassroomCourseWork,
  listGoogleClassroomCourseWork,
  listGoogleClassroomCourses,
} from '#services/integrations/google_classroom/client'
import { upsertGoogleClassroomGroup } from '#services/integrations/google_classroom/group_link_service'
import { syncClassroomStudentsForTeacher } from '#services/integrations/google_classroom/student_roster_sync_service'
import {
  buildGoogleAuthUrl,
  deleteTeacherIntegration,
  exchangeGoogleAuthCode,
  getTeacherIntegration,
  getTeacherRefreshToken,
  upsertTeacherIntegration,
  fetchGoogleUserInfo,
} from '#services/integrations/google_classroom/oauth_service'
import { verifyOAuthState } from '#services/integrations/google_classroom/oauth_state'
import ClassroomSyncRun from '#models/classroom_sync_run'
import {
  enqueueClassroomSyncTask,
  serializeClassroomSyncRun,
} from '#services/integrations/google_classroom/sync_job_service'
import { ensureClassroomTaskGroupSubmissions } from '#services/integrations/google_classroom/roster_submission_service'
import type { GoogleClassroomSyncMetadata } from '#services/integrations/google_classroom/types'
import {
  createTaskFromClassroomValidator,
  listClassroomCourseWorkValidator,
} from '#validators/google_classroom'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

export default class GoogleClassroomController {
  async connect({ auth, response, request }: HttpContext) {
    try {
      assertGoogleClassroomConfig()
    } catch (error) {
      return response.serviceUnavailable({
        error: {
          code: 'GOOGLE_CLASSROOM_NOT_CONFIGURED',
          message: error instanceof Error ? error.message : 'Google Classroom is not configured',
          requestId: request.id(),
        },
      })
    }

    const user = auth.getUserOrFail()
    if (!user.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Teacher must belong to an institution',
          requestId: request.id(),
        },
      })
    }

    const authUrl = buildGoogleAuthUrl({
      teacherId: user.id,
      institutionId: user.institutionId,
    })

    return { data: { authUrl } }
  }

  async callback({ request, response }: HttpContext) {
    const code = request.input('code') as string | undefined
    const state = request.input('state') as string | undefined
    const oauthError = request.input('error') as string | undefined
    const redirectBase = `${googleClassroomConfig.frontendUrl}/teacher/integraciones`

    if (oauthError) {
      return response.redirect(`${redirectBase}?error=${encodeURIComponent(oauthError)}`)
    }

    if (!code || !state) {
      return response.redirect(`${redirectBase}?error=missing_code_or_state`)
    }

    try {
      assertGoogleClassroomConfig()
      const payload = verifyOAuthState(state)
      const tokens = await exchangeGoogleAuthCode(code)
      if (!tokens.refresh_token) {
        throw new Error('Google did not return a refresh token; revoke app access and reconnect')
      }

      const userInfo = await fetchGoogleUserInfo(tokens.access_token)
      await upsertTeacherIntegration({
        teacherId: payload.teacherId,
        institutionId: payload.institutionId,
        externalUserId: userInfo.id,
        externalEmail: userInfo.email,
        refreshToken: tokens.refresh_token,
        scopes: googleClassroomConfig.scopes,
      })

      return response.redirect(`${redirectBase}?connected=1`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'oauth_callback_failed'
      return response.redirect(`${redirectBase}?error=${encodeURIComponent(message)}`)
    }
  }

  async status({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const integration = await getTeacherIntegration(user.id)

    return {
      data: {
        connected: Boolean(integration),
        provider: 'google_classroom',
        externalEmail: integration?.external_email ?? null,
        connectedAt: integration?.connected_at ?? null,
        lastSyncAt: integration?.last_sync_at ?? null,
      },
    }
  }

  async disconnect({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    await deleteTeacherIntegration(user.id)
    return { data: { disconnected: true } }
  }

  async listCourses({ auth, response, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const refreshToken = await getTeacherRefreshToken(user.id)
    if (!refreshToken) {
      return response.unprocessableEntity({
        error: {
          code: 'GOOGLE_CLASSROOM_NOT_CONNECTED',
          message: 'Connect Google Classroom before listing courses',
          requestId: request.id(),
        },
      })
    }

    const courses = await listGoogleClassroomCourses(refreshToken)
    return { data: courses }
  }

  async listCourseWork({ auth, request, response, params }: HttpContext) {
    await request.validateUsing(listClassroomCourseWorkValidator)
    const user = auth.getUserOrFail()
    const refreshToken = await getTeacherRefreshToken(user.id)
    if (!refreshToken) {
      return response.unprocessableEntity({
        error: {
          code: 'GOOGLE_CLASSROOM_NOT_CONNECTED',
          message: 'Connect Google Classroom before listing coursework',
          requestId: request.id(),
        },
      })
    }

    const courseWork = await listGoogleClassroomCourseWork(refreshToken, params.courseId)
    return { data: courseWork }
  }

  async syncStudents({ auth, response, request }: HttpContext) {
    const user = auth.getUserOrFail()

    if (!user.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Teacher must belong to an institution',
          requestId: request.id(),
        },
      })
    }

    const refreshToken = await getTeacherRefreshToken(user.id)
    if (!refreshToken) {
      return response.unprocessableEntity({
        error: {
          code: 'GOOGLE_CLASSROOM_NOT_CONNECTED',
          message: 'Connect Google Classroom before syncing students',
          requestId: request.id(),
        },
      })
    }

    try {
      const summary = await syncClassroomStudentsForTeacher({
        teacherId: user.id,
        institutionId: user.institutionId,
        refreshToken,
      })
      return { data: summary }
    } catch (error) {
      gcLogError(
        'Classroom student roster sync failed',
        {
          requestId: request.id(),
          teacherId: user.id,
          institutionId: user.institutionId,
        },
        error
      )
      return response.badRequest({
        error: {
          code: 'CLASSROOM_STUDENT_SYNC_FAILED',
          message: error instanceof Error ? error.message : 'Failed to sync Classroom students',
          requestId: request.id(),
        },
      })
    }
  }

  async createTaskFromClassroom({ auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(createTaskFromClassroomValidator)
    const user = auth.getUserOrFail()

    if (!user.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Teacher must belong to an institution',
          requestId: request.id(),
        },
      })
    }

    const institution = await Institution.find(user.institutionId)
    if (!institution || institution.status !== 'active') {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_INACTIVE',
          message: 'Institution must be active to create tasks',
          requestId: request.id(),
        },
      })
    }

    const refreshToken = await getTeacherRefreshToken(user.id)
    if (!refreshToken) {
      return response.unprocessableEntity({
        error: {
          code: 'GOOGLE_CLASSROOM_NOT_CONNECTED',
          message: 'Connect Google Classroom before importing tasks',
          requestId: request.id(),
        },
      })
    }

    const existing = await Task.query()
      .where('institution_id', user.institutionId)
      .andWhere('external_source', 'google_classroom')
      .andWhere('external_id', payload.courseWorkId)
      .first()

    if (existing) {
      return response.conflict({
        error: {
          code: 'CLASSROOM_TASK_ALREADY_IMPORTED',
          message: 'This Google Classroom assignment is already linked in ScholarFi',
          requestId: request.id(),
          details: { taskId: existing.id },
        },
      })
    }

    try {
      const teacherPool = await getTeacherCreditPoolSummary(user.id)
      if (teacherPool && teacherPool.allocatedCredits > 0) {
        await assertTeacherCanFundTaskReward(user.id, payload.rewardAmount)
      } else {
        await assertInstitutionCanFundTaskReward(user.institutionId, payload.rewardAmount)
      }
    } catch (error) {
      if (error instanceof InsufficientTeacherCreditsError) {
        return response.unprocessableEntity({
          error: {
            code: error.code,
            message: 'La recompensa supera tu presupuesto docente disponible',
            requestId: request.id(),
          },
        })
      }
      if (error instanceof InsufficientInstitutionCreditsError) {
        return response.unprocessableEntity({
          error: {
            code: error.code,
            message: 'La recompensa supera el presupuesto disponible de la institución',
            requestId: request.id(),
          },
        })
      }
      throw error
    }

    const coursework =
      payload.maxPoints != null
        ? {
            maxPoints: payload.maxPoints,
            title: payload.title,
            description: payload.description ?? '',
          }
        : await getGoogleClassroomCourseWork(refreshToken, payload.courseId, payload.courseWorkId)

    if (!coursework) {
      return response.notFound({
        error: {
          code: 'CLASSROOM_COURSEWORK_NOT_FOUND',
          message: 'Google Classroom assignment not found',
          requestId: request.id(),
        },
      })
    }

    const groupId = await upsertGoogleClassroomGroup({
      institutionId: user.institutionId,
      teacherId: user.id,
      courseId: payload.courseId,
      courseName: payload.courseName,
      section: payload.section ?? null,
    })

    const syncMetadata: GoogleClassroomSyncMetadata = {
      courseId: payload.courseId,
      courseWorkId: payload.courseWorkId,
      minGrade: payload.minGrade,
      maxPoints: coursework.maxPoints ?? payload.maxPoints ?? null,
      rewardMode: 'fifo_until_budget',
      lastSyncAt: null,
      lastSyncSummary: null,
    }

    const task = await Task.create({
      institutionId: user.institutionId,
      createdByTeacherId: user.id,
      title: payload.title || coursework.title,
      description: payload.description || coursework.description || payload.title,
      rewardAmount: payload.rewardAmount,
      dueAt: payload.dueAt ? DateTime.fromISO(payload.dueAt) : null,
      status: 'active',
      groupId,
      externalSource: 'google_classroom',
      externalId: payload.courseWorkId,
      syncMetadata,
    })

    await ensureClassroomTaskGroupSubmissions({
      institutionId: user.institutionId,
      taskId: task.id,
      groupId,
    })

    return {
      data: {
        id: task.id,
        title: task.title,
        description: task.description,
        rewardAmount: task.rewardAmount,
        dueAt: task.dueAt,
        status: task.status,
        groupId: task.groupId,
        externalSource: task.externalSource,
        externalId: task.externalId,
        syncMetadata: task.syncMetadata,
      },
    }
  }

  async syncTask({ auth, request, response, params }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!user.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Teacher must belong to an institution',
          requestId: request.id(),
        },
      })
    }

    const taskId = Number(params.id)
    if (!Number.isFinite(taskId)) {
      return response.badRequest({
        error: {
          code: 'INVALID_TASK_ID',
          message: 'Invalid task id',
          requestId: request.id(),
        },
      })
    }

    try {
      gcLogInfo('Classroom sync HTTP enqueue received', {
        requestId: request.id(),
        taskId,
        teacherId: user.id,
        institutionId: user.institutionId,
      })

      const enqueued = await enqueueClassroomSyncTask({
        taskId,
        teacherId: user.id,
        institutionId: user.institutionId,
        requestId: request.id(),
      })

      return response.accepted({
        data: {
          runId: enqueued.runId,
          taskId: enqueued.taskId,
          status: enqueued.status,
          deduped: enqueued.deduped,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'sync_failed'
      gcLogError(
        'Classroom sync HTTP enqueue failed',
        {
          requestId: request.id(),
          taskId,
          teacherId: user.id,
          institutionId: user.institutionId,
        },
        error
      )
      return response.unprocessableEntity({
        error: {
          code: 'CLASSROOM_SYNC_FAILED',
          message,
          requestId: request.id(),
        },
      })
    }
  }

  async showSyncRun({ auth, request, response, params }: HttpContext) {
    const user = auth.getUserOrFail()
    if (!user.institutionId) {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_SCOPE_REQUIRED',
          message: 'Teacher must belong to an institution',
          requestId: request.id(),
        },
      })
    }

    const runId = Number(params.runId)
    if (!Number.isFinite(runId)) {
      return response.badRequest({
        error: {
          code: 'INVALID_RUN_ID',
          message: 'Invalid sync run id',
          requestId: request.id(),
        },
      })
    }

    const run = await ClassroomSyncRun.query()
      .where('id', runId)
      .andWhere('teacher_id', user.id)
      .andWhere('institution_id', user.institutionId)
      .first()

    if (!run) {
      return response.notFound({
        error: {
          code: 'SYNC_RUN_NOT_FOUND',
          message: 'Classroom sync run not found',
          requestId: request.id(),
        },
      })
    }

    return { data: serializeClassroomSyncRun(run) }
  }
}
