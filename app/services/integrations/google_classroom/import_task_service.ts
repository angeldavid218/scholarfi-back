import Institution from '#models/institution'
import Task from '#models/task'
import { assertPreferredTaskRewardFunding } from '#services/credits/task_reward_funding'
import { getGoogleClassroomCourseWork } from '#services/integrations/google_classroom/client'
import { upsertGoogleClassroomGroup } from '#services/integrations/google_classroom/group_link_service'
import { getTeacherRefreshToken } from '#services/integrations/google_classroom/oauth_service'
import { ensureClassroomTaskGroupSubmissions } from '#services/integrations/google_classroom/roster_submission_service'
import type { GoogleClassroomSyncMetadata } from '#services/integrations/google_classroom/types'
import { DateTime } from 'luxon'

export class ClassroomNotConnectedError extends Error {
  readonly code = 'GOOGLE_CLASSROOM_NOT_CONNECTED' as const

  constructor(message = 'Connect Google Classroom before importing tasks') {
    super(message)
    this.name = 'ClassroomNotConnectedError'
  }
}

export class ClassroomTaskAlreadyImportedError extends Error {
  readonly code = 'CLASSROOM_TASK_ALREADY_IMPORTED' as const

  constructor(readonly taskId: number) {
    super('This Google Classroom assignment is already linked in ScholarFi')
    this.name = 'ClassroomTaskAlreadyImportedError'
  }
}

export class ClassroomCourseWorkNotFoundError extends Error {
  readonly code = 'CLASSROOM_COURSEWORK_NOT_FOUND' as const

  constructor() {
    super('Google Classroom assignment not found')
    this.name = 'ClassroomCourseWorkNotFoundError'
  }
}

export class InstitutionInactiveError extends Error {
  readonly code = 'INSTITUTION_INACTIVE' as const

  constructor() {
    super('Institution must be active to create tasks')
    this.name = 'InstitutionInactiveError'
  }
}

export interface ImportClassroomTaskInput {
  teacherId: number
  institutionId: number
  courseId: string
  courseWorkId: string
  courseName: string
  section?: string | null
  title: string
  description?: string
  rewardAmount: number
  minGrade: number
  maxPoints?: number
  dueAt?: string
}

export interface ImportedClassroomTask {
  id: number
  title: string
  description: string
  rewardAmount: number
  dueAt: DateTime | null
  status: string
  groupId: number | null
  externalSource: string | null
  externalId: string | null
  syncMetadata: GoogleClassroomSyncMetadata | null
}

export async function importTaskFromClassroom(
  input: ImportClassroomTaskInput
): Promise<ImportedClassroomTask> {
  const institution = await Institution.find(input.institutionId)
  if (!institution || institution.status !== 'active') {
    throw new InstitutionInactiveError()
  }

  const refreshToken = await getTeacherRefreshToken(input.teacherId)
  if (!refreshToken) {
    throw new ClassroomNotConnectedError()
  }

  const existing = await Task.query()
    .where('institution_id', input.institutionId)
    .andWhere('external_source', 'google_classroom')
    .andWhere('external_id', input.courseWorkId)
    .first()

  if (existing) {
    throw new ClassroomTaskAlreadyImportedError(existing.id)
  }

  await assertPreferredTaskRewardFunding({
    teacherId: input.teacherId,
    institutionId: input.institutionId,
    rewardAmount: input.rewardAmount,
  })

  const coursework =
    input.maxPoints != null
      ? {
          maxPoints: input.maxPoints,
          title: input.title,
          description: input.description ?? '',
        }
      : await getGoogleClassroomCourseWork(refreshToken, input.courseId, input.courseWorkId)

  if (!coursework) {
    throw new ClassroomCourseWorkNotFoundError()
  }

  const groupId = await upsertGoogleClassroomGroup({
    institutionId: input.institutionId,
    teacherId: input.teacherId,
    courseId: input.courseId,
    courseName: input.courseName,
    section: input.section ?? null,
  })

  const syncMetadata: GoogleClassroomSyncMetadata = {
    courseId: input.courseId,
    courseWorkId: input.courseWorkId,
    minGrade: input.minGrade,
    maxPoints: coursework.maxPoints ?? input.maxPoints ?? null,
    rewardMode: 'fifo_until_budget',
    lastSyncAt: null,
    lastSyncSummary: null,
  }

  const task = await Task.create({
    institutionId: input.institutionId,
    createdByTeacherId: input.teacherId,
    title: input.title || coursework.title,
    description: input.description || coursework.description || input.title,
    rewardAmount: input.rewardAmount,
    dueAt: input.dueAt ? DateTime.fromISO(input.dueAt) : null,
    status: 'active',
    groupId,
    externalSource: 'google_classroom',
    externalId: input.courseWorkId,
    syncMetadata,
  })

  await ensureClassroomTaskGroupSubmissions({
    institutionId: input.institutionId,
    taskId: task.id,
    groupId,
  })

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    rewardAmount: task.rewardAmount,
    dueAt: task.dueAt,
    status: task.status,
    groupId: task.groupId,
    externalSource: task.externalSource,
    externalId: task.externalId,
    syncMetadata: task.syncMetadata as GoogleClassroomSyncMetadata | null,
  }
}
