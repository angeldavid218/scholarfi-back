import logger from '@adonisjs/core/services/logger'

const INTEGRATION = 'google_classroom'

export type GoogleClassroomLogContext = {
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
    ...(ctx.taskId != null ? { taskId: ctx.taskId } : {}),
    ...(ctx.teacherId != null ? { teacherId: ctx.teacherId } : {}),
    ...(ctx.institutionId != null ? { institutionId: ctx.institutionId } : {}),
    ...(ctx.courseId ? { courseId: ctx.courseId } : {}),
    ...(ctx.courseWorkId ? { courseWorkId: ctx.courseWorkId } : {}),
  }
}

export function gcLogInfo(message: string, ctx: GoogleClassroomLogContext, data?: Record<string, unknown>) {
  logger.info({ ...bindings(ctx), ...data }, message)
}

export function gcLogDebug(message: string, ctx: GoogleClassroomLogContext, data?: Record<string, unknown>) {
  logger.debug({ ...bindings(ctx), ...data }, message)
}

export function gcLogWarn(message: string, ctx: GoogleClassroomLogContext, data?: Record<string, unknown>) {
  logger.warn({ ...bindings(ctx), ...data }, message)
}

export function gcLogError(
  message: string,
  ctx: GoogleClassroomLogContext,
  error: unknown,
  data?: Record<string, unknown>
) {
  logger.error(
    {
      ...bindings(ctx),
      ...data,
      err: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    },
    message
  )
}

/** True when Classroom returns a numeric user id instead of an email. */
export function isLikelyClassroomNumericUserId(userId: string): boolean {
  return /^\d+$/.test(userId.trim())
}
