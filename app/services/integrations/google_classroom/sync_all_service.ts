import Task from '#models/task'
import { gcLogError, gcLogInfo } from '#services/integrations/google_classroom/logger'
import { listConnectedClassroomTeachers } from '#services/integrations/google_classroom/oauth_service'
import {
  enqueueClassroomSyncTask,
  type EnqueueClassroomSyncResult,
} from '#services/integrations/google_classroom/sync_job_service'

export interface EnqueueAllClassroomSyncsResult {
  tasks: number
  runs: EnqueueClassroomSyncResult[]
}

export interface EnqueueAllClassroomSyncsForConnectedTeachersResult {
  teachers: number
  teacherFailures: number
  tasks: number
  runs: EnqueueClassroomSyncResult[]
}

export async function enqueueAllClassroomSyncsForTeacher(input: {
  teacherId: number
  institutionId: number
  requestId?: string
}): Promise<EnqueueAllClassroomSyncsResult> {
  const tasks = await Task.query()
    .where('created_by_teacher_id', input.teacherId)
    .andWhere('institution_id', input.institutionId)
    .andWhere('external_source', 'google_classroom')
    .andWhere('status', 'active')
    .whereNotNull('external_id')
    .orderBy('id', 'asc')

  gcLogInfo(
    'Classroom sync-all enqueue started',
    {
      requestId: input.requestId,
      teacherId: input.teacherId,
      institutionId: input.institutionId,
    },
    {
      tasks: tasks.length,
    }
  )

  const runs: EnqueueClassroomSyncResult[] = []
  for (const task of tasks) {
    try {
      const run = await enqueueClassroomSyncTask({
        taskId: task.id,
        teacherId: input.teacherId,
        institutionId: input.institutionId,
        requestId: input.requestId,
      })
      runs.push(run)
    } catch (error) {
      gcLogError(
        'Classroom sync-all enqueue failed for task',
        {
          requestId: input.requestId,
          taskId: task.id,
          teacherId: input.teacherId,
          institutionId: input.institutionId,
        },
        error
      )
    }
  }

  gcLogInfo(
    'Classroom sync-all enqueue finished',
    {
      requestId: input.requestId,
      teacherId: input.teacherId,
      institutionId: input.institutionId,
    },
    {
      tasks: tasks.length,
      runs: runs.length,
    }
  )

  return { tasks: tasks.length, runs }
}

export async function enqueueAllClassroomSyncsForConnectedTeachers(input?: {
  requestId?: string
}): Promise<EnqueueAllClassroomSyncsForConnectedTeachersResult> {
  const teachers = await listConnectedClassroomTeachers()
  const runs: EnqueueClassroomSyncResult[] = []
  let tasks = 0
  let teacherFailures = 0

  gcLogInfo(
    'Classroom nightly sync-all started',
    {
      requestId: input?.requestId,
    },
    {
      teachers: teachers.length,
    }
  )

  for (const teacher of teachers) {
    try {
      const result = await enqueueAllClassroomSyncsForTeacher({
        teacherId: teacher.teacherId,
        institutionId: teacher.institutionId,
        requestId: input?.requestId,
      })
      tasks += result.tasks
      runs.push(...result.runs)
    } catch (error) {
      teacherFailures += 1
      gcLogError(
        'Classroom nightly sync-all failed for teacher',
        {
          requestId: input?.requestId,
          teacherId: teacher.teacherId,
          institutionId: teacher.institutionId,
        },
        error
      )
    }
  }

  gcLogInfo(
    'Classroom nightly sync-all finished',
    {
      requestId: input?.requestId,
    },
    {
      teachers: teachers.length,
      teacherFailures,
      tasks,
      runs: runs.length,
    }
  )

  return {
    teachers: teachers.length,
    teacherFailures,
    tasks,
    runs,
  }
}
