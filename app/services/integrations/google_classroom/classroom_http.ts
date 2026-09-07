import { getTeacherRefreshToken } from '#services/integrations/google_classroom/oauth_service'
import type { HttpContext } from '@adonisjs/core/http'

interface ClassroomHttpContext {
  request: HttpContext['request']
  response: HttpContext['response']
}

export interface ClassroomJsonError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export function unknownErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function errorBody(request: HttpContext['request'], error: ClassroomJsonError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      requestId: request.id(),
      ...(error.details ? { details: error.details } : {}),
    },
  }
}

export function respondClassroomForbidden(ctx: ClassroomHttpContext, error: ClassroomJsonError) {
  return ctx.response.forbidden(errorBody(ctx.request, error))
}

export function respondClassroomUnprocessable(
  ctx: ClassroomHttpContext,
  error: ClassroomJsonError
) {
  return ctx.response.unprocessableEntity(errorBody(ctx.request, error))
}

export function respondClassroomUnavailable(ctx: ClassroomHttpContext, error: ClassroomJsonError) {
  return ctx.response.serviceUnavailable(errorBody(ctx.request, error))
}

export function requireInstitutionId(
  user: { institutionId: number | null },
  ctx: ClassroomHttpContext
): number | null {
  if (!user.institutionId) {
    respondClassroomForbidden(ctx, {
      code: 'INSTITUTION_SCOPE_REQUIRED',
      message: 'Teacher must belong to an institution',
    })
    return null
  }
  return user.institutionId
}

export async function requireClassroomRefreshToken(
  teacherId: number,
  ctx: ClassroomHttpContext,
  message: string
): Promise<string | null> {
  const refreshToken = await getTeacherRefreshToken(teacherId)
  if (!refreshToken) {
    respondClassroomUnprocessable(ctx, {
      code: 'GOOGLE_CLASSROOM_NOT_CONNECTED',
      message,
    })
    return null
  }
  return refreshToken
}
