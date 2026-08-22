import SyncClassroomTaskJob from '#jobs/sync_classroom_task_job'
import googleClassroomConfig from '#config/google_classroom'
import ClassroomSyncRun from '#models/classroom_sync_run'
import Task from '#models/task'
import {
  gcLogInfo,
} from '#services/integrations/google_classroom/logger'
import { syncGoogleClassroomTask } from '#services/integrations/google_classroom/sync_service'
import env from '#start/env'

export type EnqueueClassroomSyncResult = {
  runId: number
  taskId: number
  status: string
  deduped: boolean
}

export async function enqueueClassroomSyncTask(input: {
  taskId: number
  teacherId: number
  institutionId: number
  requestId?: string
}): Promise<EnqueueClassroomSyncResult> {
  const task = await Task.query()
    .where('id', input.taskId)
    .andWhere('institution_id', input.institutionId)
    .andWhere('created_by_teacher_id', input.teacherId)
    .first()

  if (!task) {
    throw new Error('Task not found for teacher')
  }
  if (task.externalSource !== 'google_classroom' || !task.externalId) {
    throw new Error('Task is not linked to Google Classroom')
  }

  const existing = await ClassroomSyncRun.query()
    .where('task_id', input.taskId)
    .andWhere('teacher_id', input.teacherId)
    .whereIn('status', ['queued', 'running'])
    .orderBy('id', 'desc')
    .first()

  if (existing) {
    gcLogInfo('Classroom sync enqueue deduped', {
      requestId: input.requestId,
      taskId: input.taskId,
      teacherId: input.teacherId,
      institutionId: input.institutionId,
    }, {
      runId: existing.id,
      status: existing.status,
    })
    return {
      runId: existing.id,
      taskId: input.taskId,
      status: existing.status,
      deduped: true,
    }
  }

  const run = await ClassroomSyncRun.create({
    queueJobId: null,
    taskId: input.taskId,
    teacherId: input.teacherId,
    institutionId: input.institutionId,
    status: 'queued',
    resultJson: null,
    errorMessage: null,
    requestId: input.requestId ?? null,
  })

  const queueDriver = env.get('QUEUE_DRIVER') ?? (env.get('NODE_ENV') === 'test' ? 'sync' : 'database')

  gcLogInfo('Classroom sync enqueued', {
    requestId: input.requestId,
    taskId: input.taskId,
    teacherId: input.teacherId,
    institutionId: input.institutionId,
  }, {
    runId: run.id,
    driver: queueDriver,
    mockMode: googleClassroomConfig.mockMode,
  })

  // Mock fixtures live in this API process. Running inline avoids a stale
  // `queue:work` worker that still has old demo student emails (no_grade for everyone).
  if (googleClassroomConfig.mockMode) {
    await runMockClassroomSync(run, input)
    await run.refresh()
    return {
      runId: run.id,
      taskId: input.taskId,
      status: run.status,
      deduped: false,
    }
  }

  try {
    const dispatchResult = await SyncClassroomTaskJob.dispatch({
      runId: run.id,
      taskId: input.taskId,
      teacherId: input.teacherId,
      institutionId: input.institutionId,
      requestId: input.requestId,
    }).dedup({ id: `task:${input.taskId}`, ttl: '2m' })

    if (dispatchResult.deduped === 'skipped' || dispatchResult.deduped === 'extended') {
      // Another dispatch won; drop this unused domain run and return the active one.
      await run.delete()
      const active = await ClassroomSyncRun.query()
        .where('task_id', input.taskId)
        .andWhere('teacher_id', input.teacherId)
        .whereIn('status', ['queued', 'running', 'completed', 'failed'])
        .orderBy('id', 'desc')
        .firstOrFail()
      return {
        runId: active.id,
        taskId: input.taskId,
        status: active.status,
        deduped: true,
      }
    }

    run.queueJobId = dispatchResult.jobId
    await run.save()
  } catch (error) {
    // Sync adapter (and exhausted retries) may reject after job.failed() updates the run.
    await run.refresh()
    if (run.status === 'queued' || run.status === 'running') {
      const message = error instanceof Error ? error.message : 'sync_failed'
      run.status = 'failed'
      run.errorMessage = message
      await run.save()
    }
  }

  await run.refresh()

  return {
    runId: run.id,
    taskId: input.taskId,
    status: run.status,
    deduped: false,
  }
}

async function runMockClassroomSync(
  run: ClassroomSyncRun,
  input: {
    taskId: number
    teacherId: number
    institutionId: number
    requestId?: string
  }
) {
  run.status = 'running'
  await run.save()

  try {
    const result = await syncGoogleClassroomTask({
      taskId: input.taskId,
      teacherId: input.teacherId,
      institutionId: input.institutionId,
      requestId: input.requestId,
    })
    run.status = 'completed'
    run.resultJson = result
    run.errorMessage = null
    await run.save()
    gcLogInfo(
      'Classroom mock sync completed inline',
      {
        requestId: input.requestId,
        taskId: input.taskId,
        teacherId: input.teacherId,
        institutionId: input.institutionId,
      },
      { runId: run.id, rewarded: result.rewarded, budgetRemaining: result.budgetRemaining }
    )
  } catch (error) {
    run.status = 'failed'
    run.errorMessage = error instanceof Error ? error.message : 'sync_failed'
    await run.save()
  }
}

export function serializeClassroomSyncRun(run: ClassroomSyncRun) {
  return {
    runId: run.id,
    taskId: run.taskId,
    status: run.status,
    result: run.status === 'completed' ? run.resultJson : null,
    errorMessage: run.status === 'failed' ? run.errorMessage : null,
    createdAt: run.createdAt?.toISO?.() ?? run.createdAt,
    updatedAt: run.updatedAt?.toISO?.() ?? run.updatedAt,
  }
}
