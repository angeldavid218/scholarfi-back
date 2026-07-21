import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.destroy': { paramsTuple?: []; params?: {} }
    'auth.registerStudent': { paramsTuple?: []; params?: {} }
    'index': { paramsTuple?: []; params?: {} }
    'store': { paramsTuple?: []; params?: {} }
    'updateStatus': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'updateCryptoWallets': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'showInstitutionCreditPool': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'allocateInstitutionCredits': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'showMyInstitutionCreditPool': { paramsTuple?: []; params?: {} }
    'listTeacherCreditPools': { paramsTuple?: []; params?: {} }
    'allocateEqualTeacherCredits': { paramsTuple?: []; params?: {} }
    'allocateTeacherCredits': { paramsTuple: [ParamValue]; params: {'teacherId': ParamValue} }
    'bootstrapSchoolAdmin': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'listInstitutionUsers': { paramsTuple?: []; params?: {} }
    'provisionUser': { paramsTuple?: []; params?: {} }
    'assignUserRole': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'upsertTeacherStudentAssociation': { paramsTuple?: []; params?: {} }
    'listInstitutionSubjects': { paramsTuple?: []; params?: {} }
    'createInstitutionSubject': { paramsTuple?: []; params?: {} }
    'listInstitutionGroups': { paramsTuple?: []; params?: {} }
    'createInstitutionGroup': { paramsTuple?: []; params?: {} }
    'syncInstitutionGroupTeachers': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'syncInstitutionGroupStudents': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'listMyGroups': { paramsTuple?: []; params?: {} }
    'importGroupsCsv': { paramsTuple?: []; params?: {} }
    'listGroupImportRuns': { paramsTuple?: []; params?: {} }
    'showGroupImportRun': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'showMyTeacherCreditPool': { paramsTuple?: []; params?: {} }
    'listStudentAvailableTasks': { paramsTuple?: []; params?: {} }
    'teacherTasksSummary': { paramsTuple?: []; params?: {} }
    'listTeacherTasks': { paramsTuple?: []; params?: {} }
    'createTask': { paramsTuple?: []; params?: {} }
    'closeTask': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'createTaskFromClassroom': { paramsTuple?: []; params?: {} }
    'syncClassroomTask': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'googleClassroomCallback': { paramsTuple?: []; params?: {} }
    'connectGoogleClassroom': { paramsTuple?: []; params?: {} }
    'googleClassroomStatus': { paramsTuple?: []; params?: {} }
    'disconnectGoogleClassroom': { paramsTuple?: []; params?: {} }
    'listGoogleClassroomCourses': { paramsTuple?: []; params?: {} }
    'listGoogleClassroomCourseWork': { paramsTuple: [ParamValue]; params: {'courseId': ParamValue} }
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
    'listCatalogRewards': { paramsTuple?: []; params?: {} }
    'createCatalogReward': { paramsTuple?: []; params?: {} }
    'studentBalance': { paramsTuple: [ParamValue]; params: {'studentId': ParamValue} }
    'studentTransactions': { paramsTuple: [ParamValue]; params: {'studentId': ParamValue} }
    'createRedemption': { paramsTuple?: []; params?: {} }
    'listRedemptions': { paramsTuple?: []; params?: {} }
    'approveRedemption': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rejectRedemption': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tokenHealth': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'index': { paramsTuple?: []; params?: {} }
    'showInstitutionCreditPool': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'showMyInstitutionCreditPool': { paramsTuple?: []; params?: {} }
    'listTeacherCreditPools': { paramsTuple?: []; params?: {} }
    'listInstitutionUsers': { paramsTuple?: []; params?: {} }
    'listInstitutionSubjects': { paramsTuple?: []; params?: {} }
    'listInstitutionGroups': { paramsTuple?: []; params?: {} }
    'listMyGroups': { paramsTuple?: []; params?: {} }
    'listGroupImportRuns': { paramsTuple?: []; params?: {} }
    'showGroupImportRun': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'showMyTeacherCreditPool': { paramsTuple?: []; params?: {} }
    'listStudentAvailableTasks': { paramsTuple?: []; params?: {} }
    'teacherTasksSummary': { paramsTuple?: []; params?: {} }
    'listTeacherTasks': { paramsTuple?: []; params?: {} }
    'googleClassroomCallback': { paramsTuple?: []; params?: {} }
    'googleClassroomStatus': { paramsTuple?: []; params?: {} }
    'listGoogleClassroomCourses': { paramsTuple?: []; params?: {} }
    'listGoogleClassroomCourseWork': { paramsTuple: [ParamValue]; params: {'courseId': ParamValue} }
    'listStudentSubmissions': { paramsTuple?: []; params?: {} }
    'teacherQueue': { paramsTuple?: []; params?: {} }
    'adminQueue': { paramsTuple?: []; params?: {} }
    'showSubmission': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'showStudentBalance': { paramsTuple?: []; params?: {} }
    'rewardHistorySummary': { paramsTuple?: []; params?: {} }
    'listInstitutionRewardHistory': { paramsTuple?: []; params?: {} }
    'listCatalogRewards': { paramsTuple?: []; params?: {} }
    'studentBalance': { paramsTuple: [ParamValue]; params: {'studentId': ParamValue} }
    'studentTransactions': { paramsTuple: [ParamValue]; params: {'studentId': ParamValue} }
    'listRedemptions': { paramsTuple?: []; params?: {} }
    'tokenHealth': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'index': { paramsTuple?: []; params?: {} }
    'showInstitutionCreditPool': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'showMyInstitutionCreditPool': { paramsTuple?: []; params?: {} }
    'listTeacherCreditPools': { paramsTuple?: []; params?: {} }
    'listInstitutionUsers': { paramsTuple?: []; params?: {} }
    'listInstitutionSubjects': { paramsTuple?: []; params?: {} }
    'listInstitutionGroups': { paramsTuple?: []; params?: {} }
    'listMyGroups': { paramsTuple?: []; params?: {} }
    'listGroupImportRuns': { paramsTuple?: []; params?: {} }
    'showGroupImportRun': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'showMyTeacherCreditPool': { paramsTuple?: []; params?: {} }
    'listStudentAvailableTasks': { paramsTuple?: []; params?: {} }
    'teacherTasksSummary': { paramsTuple?: []; params?: {} }
    'listTeacherTasks': { paramsTuple?: []; params?: {} }
    'googleClassroomCallback': { paramsTuple?: []; params?: {} }
    'googleClassroomStatus': { paramsTuple?: []; params?: {} }
    'listGoogleClassroomCourses': { paramsTuple?: []; params?: {} }
    'listGoogleClassroomCourseWork': { paramsTuple: [ParamValue]; params: {'courseId': ParamValue} }
    'listStudentSubmissions': { paramsTuple?: []; params?: {} }
    'teacherQueue': { paramsTuple?: []; params?: {} }
    'adminQueue': { paramsTuple?: []; params?: {} }
    'showSubmission': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'showStudentBalance': { paramsTuple?: []; params?: {} }
    'rewardHistorySummary': { paramsTuple?: []; params?: {} }
    'listInstitutionRewardHistory': { paramsTuple?: []; params?: {} }
    'listCatalogRewards': { paramsTuple?: []; params?: {} }
    'studentBalance': { paramsTuple: [ParamValue]; params: {'studentId': ParamValue} }
    'studentTransactions': { paramsTuple: [ParamValue]; params: {'studentId': ParamValue} }
    'listRedemptions': { paramsTuple?: []; params?: {} }
    'tokenHealth': { paramsTuple?: []; params?: {} }
    'profile.profile.show': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'auth.new_account.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.store': { paramsTuple?: []; params?: {} }
    'auth.access_token.destroy': { paramsTuple?: []; params?: {} }
    'auth.registerStudent': { paramsTuple?: []; params?: {} }
    'store': { paramsTuple?: []; params?: {} }
    'allocateInstitutionCredits': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'allocateEqualTeacherCredits': { paramsTuple?: []; params?: {} }
    'allocateTeacherCredits': { paramsTuple: [ParamValue]; params: {'teacherId': ParamValue} }
    'bootstrapSchoolAdmin': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'provisionUser': { paramsTuple?: []; params?: {} }
    'upsertTeacherStudentAssociation': { paramsTuple?: []; params?: {} }
    'createInstitutionSubject': { paramsTuple?: []; params?: {} }
    'createInstitutionGroup': { paramsTuple?: []; params?: {} }
    'syncInstitutionGroupTeachers': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'syncInstitutionGroupStudents': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'importGroupsCsv': { paramsTuple?: []; params?: {} }
    'createTask': { paramsTuple?: []; params?: {} }
    'createTaskFromClassroom': { paramsTuple?: []; params?: {} }
    'syncClassroomTask': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'connectGoogleClassroom': { paramsTuple?: []; params?: {} }
    'createSubmission': { paramsTuple?: []; params?: {} }
    'postRewardForSubmission': { paramsTuple: [ParamValue]; params: {'submissionId': ParamValue} }
    'createCatalogReward': { paramsTuple?: []; params?: {} }
    'createRedemption': { paramsTuple?: []; params?: {} }
  }
  PATCH: {
    'updateStatus': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'updateCryptoWallets': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'assignUserRole': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'closeTask': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'teacherActionSubmission': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'teacherRejectSubmission': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'adminDecisionSubmission': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'approveRedemption': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rejectRedemption': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'disconnectGoogleClassroom': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}