import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.destroy': { paramsTuple?: []; params?: {} }
    'index': { paramsTuple?: []; params?: {} }
    'store': { paramsTuple?: []; params?: {} }
    'updateStatus': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'bootstrapSchoolAdmin': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'provisionUser': { paramsTuple?: []; params?: {} }
    'assignUserRole': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'upsertTeacherStudentAssociation': { paramsTuple?: []; params?: {} }
    'listStudentAvailableTasks': { paramsTuple?: []; params?: {} }
    'teacherTasksSummary': { paramsTuple?: []; params?: {} }
    'listTeacherTasks': { paramsTuple?: []; params?: {} }
    'createTask': { paramsTuple?: []; params?: {} }
    'closeTask': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'listStudentSubmissions': { paramsTuple?: []; params?: {} }
    'teacherQueue': { paramsTuple?: []; params?: {} }
    'adminQueue': { paramsTuple?: []; params?: {} }
    'showSubmission': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'createSubmission': { paramsTuple?: []; params?: {} }
    'teacherActionSubmission': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'teacherRejectSubmission': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'adminDecisionSubmission': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'postRewardForSubmission': { paramsTuple: [ParamValue]; params: {'submissionId': ParamValue} }
    'showStudentBalance': { paramsTuple?: []; params?: {} }
    'rewardHistorySummary': { paramsTuple?: []; params?: {} }
    'listInstitutionRewardHistory': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'index': { paramsTuple?: []; params?: {} }
    'listStudentAvailableTasks': { paramsTuple?: []; params?: {} }
    'teacherTasksSummary': { paramsTuple?: []; params?: {} }
    'listTeacherTasks': { paramsTuple?: []; params?: {} }
    'listStudentSubmissions': { paramsTuple?: []; params?: {} }
    'teacherQueue': { paramsTuple?: []; params?: {} }
    'adminQueue': { paramsTuple?: []; params?: {} }
    'showSubmission': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'showStudentBalance': { paramsTuple?: []; params?: {} }
    'rewardHistorySummary': { paramsTuple?: []; params?: {} }
    'listInstitutionRewardHistory': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'index': { paramsTuple?: []; params?: {} }
    'listStudentAvailableTasks': { paramsTuple?: []; params?: {} }
    'teacherTasksSummary': { paramsTuple?: []; params?: {} }
    'listTeacherTasks': { paramsTuple?: []; params?: {} }
    'listStudentSubmissions': { paramsTuple?: []; params?: {} }
    'teacherQueue': { paramsTuple?: []; params?: {} }
    'adminQueue': { paramsTuple?: []; params?: {} }
    'showSubmission': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'showStudentBalance': { paramsTuple?: []; params?: {} }
    'rewardHistorySummary': { paramsTuple?: []; params?: {} }
    'listInstitutionRewardHistory': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.destroy': { paramsTuple?: []; params?: {} }
    'store': { paramsTuple?: []; params?: {} }
    'bootstrapSchoolAdmin': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'provisionUser': { paramsTuple?: []; params?: {} }
    'upsertTeacherStudentAssociation': { paramsTuple?: []; params?: {} }
    'createTask': { paramsTuple?: []; params?: {} }
    'createSubmission': { paramsTuple?: []; params?: {} }
    'postRewardForSubmission': { paramsTuple: [ParamValue]; params: {'submissionId': ParamValue} }
  }
  PATCH: {
    'updateStatus': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'assignUserRole': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'closeTask': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'teacherActionSubmission': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'teacherRejectSubmission': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'adminDecisionSubmission': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}