import Institution from '#models/institution'
import Task from '#models/task'
import { closeTaskValidator, createTaskValidator } from '#validators/task'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

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

    const task = await Task.create({
      institutionId: user.institutionId,
      createdByTeacherId: user.id,
      title: payload.title,
      description: payload.description,
      rewardAmount: payload.rewardAmount,
      dueAt: payload.dueAt ? DateTime.fromISO(payload.dueAt) : null,
      status: 'active',
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

  async index({ auth }: HttpContext) {
    const user = auth.getUserOrFail()

    const tasks = await Task.query()
      .where('institution_id', user.institutionId ?? -1)
      .andWhere('created_by_teacher_id', user.id)
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
