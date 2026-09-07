import googleClassroomConfig, { assertGoogleClassroomConfig } from '#config/google_classroom'
import ClassroomSyncRun from '#models/classroom_sync_run'
import {
  gcLogError,
  gcLogInfo,
} from '#services/integrations/google_classroom/logger'
import {
  listGoogleClassroomCourseWork,
  listGoogleClassroomCourses,
} from '#services/integrations/google_classroom/client'
import { syncClassroomStudentsForTeacher } from '#services/integrations/google_classroom/student_roster_sync_service'
import {
  buildGoogleAuthUrl,
  deleteTeacherIntegration,
  ensureMockTeacherIntegration,
  exchangeGoogleAuthCode,
  getTeacherIntegration,
  upsertTeacherIntegration,
  fetchGoogleUserInfo,
} from '#services/integrations/google_classroom/oauth_service'
import { verifyOAuthState } from '#services/integrations/google_classroom/oauth_state'
import { enqueueAllClassroomSyncsForTeacher } from '#services/integrations/google_classroom/sync_all_service'
import {
  enqueueClassroomSyncTask,
  serializeClassroomSyncRun,
} from '#services/integrations/google_classroom/sync_job_service'
import {
  ClassroomCourseWorkNotFoundError,
  ClassroomNotConnectedError,
  ClassroomTaskAlreadyImportedError,
  importTaskFromClassroom,
  InstitutionInactiveError,
} from '#services/integrations/google_classroom/import_task_service'
import {
  requireClassroomRefreshToken,
  requireInstitutionId,
  respondClassroomForbidden,
  respondClassroomUnavailable,
  respondClassroomUnprocessable,
  unknownErrorMessage,
} from '#services/integrations/google_classroom/classroom_http'
import {
  InsufficientInstitutionCreditsError,
  InsufficientTeacherCreditsError,
} from '#services/credits/types'
import {
  createTaskFromClassroomValidator,
  listClassroomCourseWorkValidator,
} from '#validators/google_classroom'
import type { HttpContext } from '@adonisjs/core/http'

export default class GoogleClassroomController {
  async connect({ auth, response, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const institutionId = requireInstitutionId(user, { request, response })
    if (institutionId == null) return

    if (googleClassroomConfig.mockMode) {
      try {
        await ensureMockTeacherIntegration(user.id, institutionId)
      } catch (error) {
        return respondClassroomUnavailable(
          { request, response },
          {
            code: 'GOOGLE_CLASSROOM_NOT_CONFIGURED',
            message: unknownErrorMessage(error, 'Mock Classroom is not configured'),
          }
        )
      }

      return {
        data: {
          authUrl: null,
          connected: true,
          mockMode: true,
        },
      }
    }

    try {
      assertGoogleClassroomConfig()
    } catch (error) {
      return respondClassroomUnavailable(
        { request, response },
        {
          code: 'GOOGLE_CLASSROOM_NOT_CONFIGURED',
          message: unknownErrorMessage(error, 'Google Classroom is not configured'),
        }
      )
    }

    const authUrl = buildGoogleAuthUrl({
      teacherId: user.id,
      institutionId,
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
      const message = unknownErrorMessage(error, 'oauth_callback_failed')
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
        mockMode: googleClassroomConfig.mockMode,
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
    const refreshToken = await requireClassroomRefreshToken(
      user.id,
      { request, response },
      'Connect Google Classroom before listing courses'
    )
    if (!refreshToken) return

    const courses = await listGoogleClassroomCourses(refreshToken)
    return { data: courses }
  }

  async listCourseWork({ auth, request, response, params }: HttpContext) {
    await request.validateUsing(listClassroomCourseWorkValidator)
    const user = auth.getUserOrFail()
    const refreshToken = await requireClassroomRefreshToken(
      user.id,
      { request, response },
      'Connect Google Classroom before listing coursework'
    )
    if (!refreshToken) return

    const courseWork = await listGoogleClassroomCourseWork(refreshToken, params.courseId)
    return { data: courseWork }
  }

  async syncStudents({ auth, response, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const institutionId = requireInstitutionId(user, { request, response })
    if (institutionId == null) return

    const refreshToken = await requireClassroomRefreshToken(
      user.id,
      { request, response },
      'Connect Google Classroom before syncing students'
    )
    if (!refreshToken) return

    try {
      const summary = await syncClassroomStudentsForTeacher({
        teacherId: user.id,
        institutionId,
        refreshToken,
      })
      return { data: summary }
    } catch (error) {
      gcLogError(
        'Classroom student roster sync failed',
        {
          requestId: request.id(),
          teacherId: user.id,
          institutionId,
        },
        error
      )
      return response.badRequest({
        error: {
          code: 'CLASSROOM_STUDENT_SYNC_FAILED',
          message: unknownErrorMessage(error, 'Failed to sync Classroom students'),
          requestId: request.id(),
        },
      })
    }
  }

  async createTaskFromClassroom({ auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(createTaskFromClassroomValidator)
    const user = auth.getUserOrFail()
    const institutionId = requireInstitutionId(user, { request, response })
    if (institutionId == null) return

    try {
      const task = await importTaskFromClassroom({
        teacherId: user.id,
        institutionId,
        courseId: payload.courseId,
        courseWorkId: payload.courseWorkId,
        courseName: payload.courseName,
        section: payload.section,
        title: payload.title,
        description: payload.description,
        rewardAmount: payload.rewardAmount,
        minGrade: payload.minGrade,
        maxPoints: payload.maxPoints,
        dueAt: payload.dueAt,
      })
      return { data: task }
    } catch (error) {
      if (error instanceof InstitutionInactiveError) {
        return respondClassroomForbidden(
          { request, response },
          { code: error.code, message: error.message }
        )
      }
      if (error instanceof ClassroomNotConnectedError) {
        return respondClassroomUnprocessable(
          { request, response },
          { code: error.code, message: error.message }
        )
      }
      if (error instanceof ClassroomTaskAlreadyImportedError) {
        return response.conflict({
          error: {
            code: error.code,
            message: error.message,
            requestId: request.id(),
            details: { taskId: error.taskId },
          },
        })
      }
      if (error instanceof InsufficientTeacherCreditsError) {
        return respondClassroomUnprocessable(
          { request, response },
          {
            code: error.code,
            message: 'La recompensa supera tu presupuesto docente disponible',
          }
        )
      }
      if (error instanceof InsufficientInstitutionCreditsError) {
        return respondClassroomUnprocessable(
          { request, response },
          {
            code: error.code,
            message: 'La recompensa supera el presupuesto disponible de la institución',
          }
        )
      }
      if (error instanceof ClassroomCourseWorkNotFoundError) {
        return response.notFound({
          error: {
            code: error.code,
            message: error.message,
            requestId: request.id(),
          },
        })
      }
      throw error
    }
  }

  async syncTask({ auth, request, response, params }: HttpContext) {
    const user = auth.getUserOrFail()
    const institutionId = requireInstitutionId(user, { request, response })
    if (institutionId == null) return

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
        institutionId,
      })

      const enqueued = await enqueueClassroomSyncTask({
        taskId,
        teacherId: user.id,
        institutionId,
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
      gcLogError(
        'Classroom sync HTTP enqueue failed',
        {
          requestId: request.id(),
          taskId,
          teacherId: user.id,
          institutionId,
        },
        error
      )
      return respondClassroomUnprocessable(
        { request, response },
        {
          code: 'CLASSROOM_SYNC_FAILED',
          message: unknownErrorMessage(error, 'sync_failed'),
        }
      )
    }
  }

  async showSyncRun({ auth, request, response, params }: HttpContext) {
    const user = auth.getUserOrFail()
    const institutionId = requireInstitutionId(user, { request, response })
    if (institutionId == null) return

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
      .andWhere('institution_id', institutionId)
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

  async syncAll({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const institutionId = requireInstitutionId(user, { request, response })
    if (institutionId == null) return

    try {
      gcLogInfo('Classroom sync-all HTTP enqueue received', {
        requestId: request.id(),
        teacherId: user.id,
        institutionId,
      })

      const enqueued = await enqueueAllClassroomSyncsForTeacher({
        teacherId: user.id,
        institutionId,
        requestId: request.id(),
      })

      return response.accepted({
        data: {
          tasks: enqueued.tasks,
          runs: enqueued.runs,
        },
      })
    } catch (error) {
      gcLogError(
        'Classroom sync-all HTTP enqueue failed',
        {
          requestId: request.id(),
          teacherId: user.id,
          institutionId,
        },
        error
      )
      return respondClassroomUnprocessable(
        { request, response },
        {
          code: 'CLASSROOM_SYNC_FAILED',
          message: unknownErrorMessage(error, 'sync_failed'),
        }
      )
    }
  }
}
