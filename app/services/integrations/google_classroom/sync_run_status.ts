import ClassroomSyncRun from '#models/classroom_sync_run'
import {
  gcLogInfo,
} from '#services/integrations/google_classroom/logger'
import type { GoogleClassroomSyncResult } from '#services/integrations/google_classroom/types'

export async function markClassroomSyncRunRunning(runId: number): Promise<void> {
  const run = await ClassroomSyncRun.find(runId)
  if (!run) return
  if (run.status === 'completed' || run.status === 'failed') return
  run.status = 'running'
  await run.save()
}

export async function markClassroomSyncRunCompleted(
  runId: number,
  result: GoogleClassroomSyncResult
): Promise<void> {
  const run = await ClassroomSyncRun.findOrFail(runId)
  run.status = 'completed'
  run.resultJson = result
  run.errorMessage = null
  await run.save()

  gcLogInfo(
    'Classroom sync run completed',
    {
      requestId: run.requestId ?? undefined,
      taskId: run.taskId,
      teacherId: run.teacherId,
      institutionId: run.institutionId,
    },
    {
      runId,
      rewarded: result.rewarded,
      budgetRemaining: result.budgetRemaining,
    }
  )
}

export async function persistClassroomSyncRunErrorMessage(
  runId: number,
  message: string
): Promise<void> {
  const run = await ClassroomSyncRun.find(runId)
  if (!run) return
  run.errorMessage = message
  await run.save()
}

export async function markClassroomSyncRunFailed(runId: number, message: string): Promise<void> {
  const run = await ClassroomSyncRun.find(runId)
  if (!run) return
  run.status = 'failed'
  run.errorMessage = message
  await run.save()
}
