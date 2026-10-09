import ClassroomSyncRun from '#models/classroom_sync_run'
import { gcLogError, gcLogInfo } from '#services/integrations/google_classroom/logger'
import { unknownErrorMessage } from '#services/integrations/google_classroom/classroom_http'
import { syncGoogleClassroomTask } from '#services/integrations/google_classroom/sync_service'
import {
  markClassroomSyncRunCompleted,
  markClassroomSyncRunFailed,
  markClassroomSyncRunRunning,
  persistClassroomSyncRunErrorMessage,
} from '#services/integrations/google_classroom/sync_run_status'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'

export interface SyncClassroomTaskJobPayload {
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

    await markClassroomSyncRunRunning(runId)

    gcLogInfo(
      'Classroom sync job started',
      {
        requestId,
        taskId,
        teacherId,
        institutionId,
      },
      {
        runId,
        jobId: this.context.jobId,
        attempt: this.context.attempt,
      }
    )

    try {
      const result = await syncGoogleClassroomTask({
        taskId,
        teacherId,
        institutionId,
        requestId,
      })
      await markClassroomSyncRunCompleted(runId, result)
    } catch (error) {
      // Persist the underlying sync error so failed() does not replace it with
      // the generic "max retries" message from the queue runtime.
      await persistClassroomSyncRunErrorMessage(runId, unknownErrorMessage(error, 'sync_failed'))
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
    await markClassroomSyncRunFailed(runId, message)
  }
}
