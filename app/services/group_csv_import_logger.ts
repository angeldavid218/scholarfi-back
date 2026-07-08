import logger from '@adonisjs/core/services/logger'

const INTEGRATION = 'group_csv_import'

export type GroupCsvImportLogContext = {
  requestId?: string | null
  institutionId?: number
  teacherId?: number
  runId?: number | null
  filename?: string
  dryRun?: boolean
}

function bindings(ctx: GroupCsvImportLogContext): Record<string, unknown> {
  return {
    integration: INTEGRATION,
    ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
    ...(ctx.institutionId != null ? { institutionId: ctx.institutionId } : {}),
    ...(ctx.teacherId != null ? { teacherId: ctx.teacherId } : {}),
    ...(ctx.runId != null ? { runId: ctx.runId } : {}),
    ...(ctx.filename ? { filename: ctx.filename } : {}),
    ...(ctx.dryRun != null ? { dryRun: ctx.dryRun } : {}),
  }
}

export function csvImportLogInfo(
  message: string,
  ctx: GroupCsvImportLogContext,
  data?: Record<string, unknown>
) {
  logger.info({ ...bindings(ctx), ...data }, message)
}

export function csvImportLogDebug(
  message: string,
  ctx: GroupCsvImportLogContext,
  data?: Record<string, unknown>
) {
  logger.debug({ ...bindings(ctx), ...data }, message)
}

export function csvImportLogWarn(
  message: string,
  ctx: GroupCsvImportLogContext,
  data?: Record<string, unknown>
) {
  logger.warn({ ...bindings(ctx), ...data }, message)
}

export function csvImportLogError(
  message: string,
  ctx: GroupCsvImportLogContext,
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
