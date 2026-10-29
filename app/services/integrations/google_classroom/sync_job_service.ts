import ClassroomSyncRun from '#models/classroom_sync_run'
import Task from '#models/task'
import { gcLogInfo } from '#services/integrations/google_classroom/logger'
import { unknownErrorMessage } from '#services/integrations/google_classroom/classroom_http'
import { syncGoogleClassroomTask } from '#services/integrations/google_classroom/sync_service'
import {
  markClassroomSyncRunCompleted,
  markClassroomSyncRunFailed,
  markClassroomSyncRunRunning,
} from '#services/integrations/google_classroom/sync_run_status'

const STALE_RUNNING_MS = 6 * 60 * 1000

export interface EnqueueClassroomSyncResult {
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

  if (existing && existing.status === 'running' && !isStaleRunningRun(existing)) {
    gcLogInfo(
      'Classroom sync already running',
      {
        requestId: input.requestId,
        taskId: input.taskId,
        teacherId: input.teacherId,
        institutionId: input.institutionId,
      },
      {
        runId: existing.id,
        status: existing.status,
      }
    )
    return {
      runId: existing.id,
      taskId: input.taskId,
      status: existing.status,
      deduped: true,
    }
  }

  const run =
    existing ??
    (await ClassroomSyncRun.create({
      queueJobId: null,
      taskId: input.taskId,
      teacherId: input.teacherId,
      institutionId: input.institutionId,
      status: 'queued',
      resultJson: null,
      errorMessage: null,
      requestId: input.requestId ?? null,
    }))

  gcLogInfo(
    'Classroom sync started',
    {
      requestId: input.requestId,
      taskId: input.taskId,
      teacherId: input.teacherId,
      institutionId: input.institutionId,
    },
    {
      runId: run.id,
      resumed: Boolean(existing),
    }
  )

  await executeClassroomSyncRun(run, input)
  await run.refresh()

  return {
    runId: run.id,
    taskId: input.taskId,
    status: run.status,
    deduped: Boolean(existing),
  }
}

function isStaleRunningRun(run: ClassroomSyncRun): boolean {
  const stamp = run.updatedAt ?? run.createdAt
  if (!stamp) return true
  const ms =
    typeof stamp.toMillis === 'function' ? stamp.toMillis() : new Date(String(stamp)).getTime()
  if (!Number.isFinite(ms)) return true
  return Date.now() - ms > STALE_RUNNING_MS
}

async function executeClassroomSyncRun(
  run: ClassroomSyncRun,
  input: {
    taskId: number
    teacherId: number
    institutionId: number
    requestId?: string
  }
) {
  await markClassroomSyncRunRunning(run.id)

  try {
    const result = await syncGoogleClassroomTask({
      taskId: input.taskId,
      teacherId: input.teacherId,
      institutionId: input.institutionId,
      requestId: input.requestId,
    })
    await markClassroomSyncRunCompleted(run.id, result)
  } catch (error) {
    await markClassroomSyncRunFailed(run.id, unknownErrorMessage(error, 'sync_failed'))
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
