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
  listInstitutionUsers: typeof routes['listInstitutionUsers']
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
  ngoInstitutions: {
    index: typeof routes['ngo_institutions.index']
    store: typeof routes['ngo_institutions.store']
    updateStatus: typeof routes['ngo_institutions.update_status']
    bootstrapNgoAdmin: typeof routes['ngo_institutions.bootstrap_ngo_admin']
    assignUser: typeof routes['ngo_institutions.assign_user']
  }
  dashboard: {
    summary: typeof routes['dashboard.summary']
  }
  fundingPrograms: {
    availableInstitutions: typeof routes['funding_programs.available_institutions']
    index: typeof routes['funding_programs.index']
    store: typeof routes['funding_programs.store']
    show: typeof routes['funding_programs.show']
    update: typeof routes['funding_programs.update']
  }
  budgetAllocations: {
    index: typeof routes['budget_allocations.index']
    store: typeof routes['budget_allocations.store']
    show: typeof routes['budget_allocations.show']
    update: typeof routes['budget_allocations.update']
  }
}
