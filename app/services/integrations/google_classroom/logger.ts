import logger from '@adonisjs/core/services/logger'

const INTEGRATION = 'google_classroom'

export interface GoogleClassroomLogContext {
  requestId?: string | null
  syncRunId?: string
  taskId?: number
  teacherId?: number
  institutionId?: number
  courseId?: string
  courseWorkId?: string
}

function bindings(ctx: GoogleClassroomLogContext): Record<string, unknown> {
  return {
    integration: INTEGRATION,
    ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
    ...(ctx.syncRunId ? { syncRunId: ctx.syncRunId } : {}),
    ...(ctx.taskId !== null && ctx.taskId !== undefined ? { taskId: ctx.taskId } : {}),
    ...(ctx.teacherId !== null && ctx.teacherId !== undefined ? { teacherId: ctx.teacherId } : {}),
    ...(ctx.institutionId !== null && ctx.institutionId !== undefined
      ? { institutionId: ctx.institutionId }
      : {}),
    ...(ctx.courseId ? { courseId: ctx.courseId } : {}),
    ...(ctx.courseWorkId ? { courseWorkId: ctx.courseWorkId } : {}),
  }
}

export function gcLogInfo(message: string, ctx: GoogleClassroomLogContext, data?: object) {
  logger.info({ ...bindings(ctx), ...(data as Record<string, unknown> | undefined) }, message)
}

export function gcLogDebug(message: string, ctx: GoogleClassroomLogContext, data?: object) {
  logger.debug({ ...bindings(ctx), ...(data as Record<string, unknown> | undefined) }, message)
}

export function gcLogWarn(message: string, ctx: GoogleClassroomLogContext, data?: object) {
  logger.warn({ ...bindings(ctx), ...(data as Record<string, unknown> | undefined) }, message)
}

export function gcLogError(
  message: string,
  ctx: GoogleClassroomLogContext,
  error: unknown,
  data?: object
) {
  logger.error(
    {
      ...bindings(ctx),
      ...(data as Record<string, unknown> | undefined),
      err: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    },
    message
  )
}
