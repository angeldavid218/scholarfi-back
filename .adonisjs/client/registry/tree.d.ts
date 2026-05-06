/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  auth: {
    newAccount: {
      store: typeof routes['auth.new_account.store']
    }
    accessToken: {
      store: typeof routes['auth.access_token.store']
      destroy: typeof routes['auth.access_token.destroy']
    }
  }
  index: typeof routes['index']
  store: typeof routes['store']
  updateStatus: typeof routes['updateStatus']
  bootstrapSchoolAdmin: typeof routes['bootstrapSchoolAdmin']
  provisionUser: typeof routes['provisionUser']
  assignUserRole: typeof routes['assignUserRole']
  upsertTeacherStudentAssociation: typeof routes['upsertTeacherStudentAssociation']
  listStudentAvailableTasks: typeof routes['listStudentAvailableTasks']
  teacherTasksSummary: typeof routes['teacherTasksSummary']
  listTeacherTasks: typeof routes['listTeacherTasks']
  createTask: typeof routes['createTask']
  closeTask: typeof routes['closeTask']
  listStudentSubmissions: typeof routes['listStudentSubmissions']
  teacherQueue: typeof routes['teacherQueue']
  adminQueue: typeof routes['adminQueue']
  showSubmission: typeof routes['showSubmission']
  createSubmission: typeof routes['createSubmission']
  teacherActionSubmission: typeof routes['teacherActionSubmission']
  teacherRejectSubmission: typeof routes['teacherRejectSubmission']
  adminDecisionSubmission: typeof routes['adminDecisionSubmission']
  postRewardForSubmission: typeof routes['postRewardForSubmission']
  showStudentBalance: typeof routes['showStudentBalance']
  rewardHistorySummary: typeof routes['rewardHistorySummary']
  listInstitutionRewardHistory: typeof routes['listInstitutionRewardHistory']
  profile: {
    profile: {
      show: typeof routes['profile.profile.show']
    }
  }
}
