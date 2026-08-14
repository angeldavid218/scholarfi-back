import { enqueueAllClassroomSyncsForConnectedTeachers } from '#services/integrations/google_classroom/sync_all_service'
import {
  gcLogError,
  gcLogInfo,
} from '#services/integrations/google_classroom/logger'
import { Job } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'

export type SyncAllClassroomTasksJobPayload = {
  requestId?: string
}

export default class SyncAllClassroomTasksJob extends Job<SyncAllClassroomTasksJobPayload> {
  static options: JobOptions = {
    queue: 'classroom',
    maxRetries: 1,
    timeout: '5m',
    removeOnComplete: { age: '1d', count: 100 },
    removeOnFail: { age: '7d', count: 100 },
  }

  async execute() {
    const requestId = this.payload.requestId ?? 'nightly-classroom-sync'

    gcLogInfo('Classroom nightly sync job started', {
      requestId,
    }, {
      jobId: this.context.jobId,
      attempt: this.context.attempt,
    })

    const result = await enqueueAllClassroomSyncsForConnectedTeachers({ requestId })

    gcLogInfo('Classroom nightly sync job finished', {
      requestId,
    }, {
      teachers: result.teachers,
      teacherFailures: result.teacherFailures,
      tasks: result.tasks,
      runs: result.runs.length,
    })
  }

  async failed(error: Error) {
    gcLogError(
      'Classroom nightly sync job permanently failed',
      {
        requestId: this.payload.requestId ?? 'nightly-classroom-sync',
      },
      error
    )
  }
}
