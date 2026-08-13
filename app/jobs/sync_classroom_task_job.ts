import ClassroomSyncRun from '#models/classroom_sync_run'
import {
  gcLogError,
  gcLogInfo,
} from '#services/integrations/google_classroom/logger'
import { syncGoogleClassroomTask } from '#services/integrations/google_classroom/sync_service'
import type { GoogleClassroomSyncResult } from '#services/integrations/google_classroom/types'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'

export type SyncClassroomTaskJobPayload = {
  runId: number
  taskId: number
  teacherId: number
  institutionId: number
  requestId?: string
}

export default class SyncClassroomTaskJob extends Job<SyncClassroomTaskJobPayload> {
  static options: JobOptions = {
    queue: 'classroom',
    maxRetries: 2,
    timeout: '5m',
    removeOnComplete: { age: '1d', count: 500 },
    removeOnFail: { age: '7d', count: 500 },
  }

  async execute() {
    const { runId, taskId, teacherId, institutionId, requestId } = this.payload

    await markRunRunning(runId)

    gcLogInfo('Classroom sync job started', {
      requestId,
      taskId,
      teacherId,
      institutionId,
    }, {
      runId,
      jobId: this.context.jobId,
      attempt: this.context.attempt,
    })

    try {
      const result = await syncGoogleClassroomTask({
        taskId,
        teacherId,
        institutionId,
        requestId,
      })
      await markRunCompleted(runId, result)
    } catch (error) {
      // Persist the underlying sync error so failed() does not replace it with
      // the generic "max retries" message from the queue runtime.
      const message = error instanceof Error ? error.message : 'sync_failed'
      await persistRunErrorMessage(runId, message)
      throw error
    }
  }

  async failed(error: Error) {
    const { runId, taskId, teacherId, institutionId, requestId } = this.payload

    gcLogError(
      'Classroom sync job permanently failed',
      {
        requestId,
        taskId,
        teacherId,
        institutionId,
      },
      error
    )

    const run = await ClassroomSyncRun.find(runId)
    const message =
      run?.errorMessage ||
      (error.message && !error.message.includes('maximum number of retry')
        ? error.message
        : 'sync_failed')
    await markRunFailed(runId, message)
  }
}

async function markRunRunning(runId: number): Promise<void> {
  const run = await ClassroomSyncRun.find(runId)
  if (!run) return
  if (run.status === 'completed' || run.status === 'failed') return
  run.status = 'running'
  await run.save()
}

async function markRunCompleted(runId: number, result: GoogleClassroomSyncResult): Promise<void> {
  const run = await ClassroomSyncRun.findOrFail(runId)
  run.status = 'completed'
  run.resultJson = result
  run.errorMessage = null
  await run.save()

  gcLogInfo('Classroom sync run completed', {
    requestId: run.requestId ?? undefined,
    taskId: run.taskId,
    teacherId: run.teacherId,
    institutionId: run.institutionId,
  }, {
    runId,
    rewarded: result.rewarded,
    budgetRemaining: result.budgetRemaining,
  })
}

async function persistRunErrorMessage(runId: number, message: string): Promise<void> {
  const run = await ClassroomSyncRun.find(runId)
  if (!run) return
  run.errorMessage = message
  await run.save()
}

async function markRunFailed(runId: number, message: string): Promise<void> {
  const run = await ClassroomSyncRun.find(runId)
  if (!run) return
  run.status = 'failed'
  run.errorMessage = message
  await run.save()
}
