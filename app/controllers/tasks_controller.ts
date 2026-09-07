import Institution from '#models/institution'
import Task from '#models/task'
import { assertPreferredTaskRewardFunding } from '#services/credits/task_reward_funding'
import {
  InsufficientInstitutionCreditsError,
  InsufficientTeacherCreditsError,
} from '#services/credits/types'
import { closeTaskValidator, createTaskValidator } from '#validators/task'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { parsePositiveInt } from '../utils/parse_positive.ts'

export default class TasksController {
  async store({ auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(createTaskValidator)
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
    if (!institution) {
      return response.notFound({
        error: {
          code: 'INSTITUTION_NOT_FOUND',
          message: 'Institution not found',
          requestId: request.id(),
        },
      })
    }

    if (institution.status !== 'active') {
      return response.forbidden({
        error: {
          code: 'INSTITUTION_INACTIVE',
          message: 'Institution must be active to create tasks',
          requestId: request.id(),
        },
      })
    }

    try {
      await assertPreferredTaskRewardFunding({
        teacherId: user.id,
        institutionId: user.institutionId,
        rewardAmount: payload.rewardAmount,
      })
    } catch (error) {
      if (error instanceof InsufficientTeacherCreditsError) {
        return response.unprocessableEntity({
          error: {
            code: error.code,
            message: 'La recompensa supera tu presupuesto docente disponible',
            details: {
              remainingCredits: error.remaining,
              requestedCredits: error.requested,
            },
            requestId: request.id(),
          },
        })
      }
      if (error instanceof InsufficientInstitutionCreditsError) {
        return response.unprocessableEntity({
          error: {
            code: error.code,
            message: 'La recompensa supera el presupuesto disponible de la institución',
            details: {
              remainingCredits: error.remaining,
              requestedCredits: error.requested,
            },
            requestId: request.id(),
          },
        })
      }
      throw error
    }

    const task = await Task.create({
      institutionId: user.institutionId,
      createdByTeacherId: user.id,
      title: payload.title,
      description: payload.description,
      rewardAmount: payload.rewardAmount,
      dueAt: payload.dueAt ? DateTime.fromISO(payload.dueAt) : null,
      status: 'active',
      groupId: payload.groupId ?? null,
      externalSource: 'manual',
      externalId: null,
      syncMetadata: null,
    })

    return {
      data: {
        id: task.id,
        institutionId: task.institutionId,
        createdByTeacherId: task.createdByTeacherId,
        title: task.title,
        description: task.description,
        rewardAmount: task.rewardAmount,
        dueAt: task.dueAt,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    }
  }

  async teacherSummary({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const institutionId = user.institutionId ?? -1
    const teacherId = user.id

    const totalRow = await db
      .from('tasks')
      .where('institution_id', institutionId)
      .andWhere('created_by_teacher_id', teacherId)
      .count('* as total')
      .first()

    const closedRow = await db
      .from('tasks')
      .where('institution_id', institutionId)
      .andWhere('created_by_teacher_id', teacherId)
      .andWhere('status', 'closed')
      .count('* as total')
      .first()

    const total = totalRow?.total as string | number | undefined
    const closed = closedRow?.total as string | number | undefined

    return {
      data: {
        total: Number(total ?? 0),
        closed: Number(closed ?? 0),
      },
    }
  }

  async index({ auth, request }: HttpContext) {
    const user = auth.getUserOrFail()
    const page = parsePositiveInt(request.input('page'), 1)
    const perPage = Math.min(parsePositiveInt(request.input('perPage'), 10), 100)

    const tasks = await Task.query()
      .where('institution_id', user.institutionId ?? -1)
      .andWhere('created_by_teacher_id', user.id)
      .orderBy('created_at', 'desc')
      .paginate(page, perPage)

    return {
      data: {
        items: tasks.all().map((task) => ({
          id: task.id,
          institutionId: task.institutionId,
          createdByTeacherId: task.createdByTeacherId,
          title: task.title,
          description: task.description,
          rewardAmount: task.rewardAmount,
          dueAt: task.dueAt,
          status: task.status,
          externalSource: task.externalSource,
          externalId: task.externalId,
          syncMetadata: task.syncMetadata,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
        })),
        meta: tasks.getMeta(),
      },
    }
  }

  async available({ auth }: HttpContext) {
    const user = auth.getUserOrFail()

    const tasks = await Task.query()
      .where('institution_id', user.institutionId ?? -1)
      .andWhere('status', 'active')
      .orderBy('created_at', 'desc')

    return {
      data: tasks.map((task) => ({
        id: task.id,
        institutionId: task.institutionId,
        createdByTeacherId: task.createdByTeacherId,
        title: task.title,
        description: task.description,
        rewardAmount: task.rewardAmount,
        dueAt: task.dueAt,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      })),
    }
  }

  async close({ auth, request, response, params }: HttpContext) {
    await request.validateUsing(closeTaskValidator)
    const user = auth.getUserOrFail()
    const taskId = Number(params.id)

    const task = await Task.query()
      .where('id', taskId)
      .andWhere('institution_id', user.institutionId ?? -1)
      .andWhere('created_by_teacher_id', user.id)
      .first()

    if (!task) {
      return response.forbidden({
        error: {
          code: 'TENANT_SCOPE_VIOLATION',
          message: 'Cross-tenant access is not allowed',
          requestId: request.id(),
        },
      })
    }

    task.status = 'closed'
    await task.save()

    return {
      data: {
        id: task.id,
        institutionId: task.institutionId,
        createdByTeacherId: task.createdByTeacherId,
        title: task.title,
        description: task.description,
        rewardAmount: task.rewardAmount,
        dueAt: task.dueAt,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    }
  }
}
