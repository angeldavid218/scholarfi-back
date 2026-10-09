export interface GoogleClassroomCourse {
  id: string
  name: string
  section: string | null
  courseState: string | null
}

export interface GoogleClassroomCourseWork {
  id: string
  title: string
  description: string | null
  maxPoints: number | null
  state: string | null
  dueDate: string | null
  dueTime: string | null
}

export interface GoogleClassroomStudentSubmission {
  id: string
  userId: string
  state: string | null
  assignedGrade: number | null
  draftGrade: number | null
  late: boolean
}

export interface GoogleClassroomSyncSummary {
  rewarded: number
  skippedNoSubmission: number
  skippedLowGrade: number
  skippedNoGrade: number
  skippedAlreadyRewarded: number
  skippedBudgetExhausted: number
  budgetRemaining: number
}

export interface GoogleClassroomSyncMetadata {
  courseId: string
  courseWorkId: string
  minGrade: number
  maxPoints: number | null
  rewardMode: 'fifo_until_budget'
  lastSyncAt?: string | null
  lastSyncSummary?: GoogleClassroomSyncSummary | null
}

export interface GoogleClassroomSyncResult {
  taskId: number
  rewarded: number
  skippedNoSubmission: number
  skippedLowGrade: number
  skippedNoGrade: number
  skippedAlreadyRewarded: number
  skippedBudgetExhausted: number
  budgetRemaining: number
  rewardedSubmissionIds: number[]
}

export interface TeacherIntegrationRow {
  id: number
  teacher_id: number
  institution_id: number
  provider: string
  external_user_id: string
  external_email: string
  encrypted_refresh_token: string
  scopes: string
  connected_at: Date
  last_sync_at: Date | null
}

export interface ClassroomRosterMember {
  googleUserId: string
  email: string
  fullName: string | null
}

export interface ClassroomGradeMaps {
  gradeByEmail: Map<string, number | null>
  gradeByGoogleUserId: Map<string, number | null>
  emailByUserId: Map<string, string>
}
