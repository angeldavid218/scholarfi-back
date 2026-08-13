/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractResponse } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'auth.new_account.store': {
    methods: ["POST"]
    pattern: '/api/v1/auth/signup'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').signupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').signupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/new_account_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.access_token.store': {
    methods: ["POST"]
    pattern: '/api/v1/auth/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/access_token_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/access_token_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.access_token.destroy': {
    methods: ["POST"]
    pattern: '/api/v1/auth/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/access_token_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/access_token_controller').default['destroy']>>>
    }
  }
  'auth.registerStudent': {
    methods: ["POST"]
    pattern: '/api/v1/auth/register-student'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').registerStudentValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').registerStudentValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/student_registration_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/student_registration_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/institutions'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['index']>>>
    }
  }
  'store': {
    methods: ["POST"]
    pattern: '/api/v1/institutions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/institution').createInstitutionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/institution').createInstitutionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'updateStatus': {
    methods: ["PATCH"]
    pattern: '/api/v1/institutions/:id/status'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/institution').updateInstitutionStatusValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/institution').updateInstitutionStatusValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['updateStatus']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['updateStatus']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'updateCryptoWallets': {
    methods: ["PATCH"]
    pattern: '/api/v1/institutions/:id/crypto-wallets'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/institution').updateInstitutionCryptoWalletsValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/institution').updateInstitutionCryptoWalletsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['updateCryptoWallets']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['updateCryptoWallets']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'showInstitutionCreditPool': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/institutions/:id/credit-pool'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/institution_credits_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/institution_credits_controller').default['show']>>>
    }
  }
  'allocateInstitutionCredits': {
    methods: ["POST"]
    pattern: '/api/v1/institutions/:id/credit-pool/allocate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/institution_credit').allocateInstitutionCreditsValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/institution_credit').allocateInstitutionCreditsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/institution_credits_controller').default['allocate']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/institution_credits_controller').default['allocate']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'showMyInstitutionCreditPool': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/institutions/credit-pool'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/institution_credits_controller').default['showMine']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/institution_credits_controller').default['showMine']>>>
    }
  }
  'listTeacherCreditPools': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/institutions/teacher-credit-pools'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/teacher_credits_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/teacher_credits_controller').default['index']>>>
    }
  }
  'allocateEqualTeacherCredits': {
    methods: ["POST"]
    pattern: '/api/v1/institutions/teacher-credit-pools/allocate-equal'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/teacher_credit').allocateEqualTeacherCreditsValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/teacher_credit').allocateEqualTeacherCreditsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/teacher_credits_controller').default['allocateEqual']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/teacher_credits_controller').default['allocateEqual']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'allocateTeacherCredits': {
    methods: ["POST"]
    pattern: '/api/v1/institutions/teacher-credit-pools/:teacherId/allocate'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/teacher_credit').allocateTeacherCreditsValidator)>>
      paramsTuple: [ParamValue]
      params: { teacherId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/teacher_credit').allocateTeacherCreditsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/teacher_credits_controller').default['allocateToTeacher']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/teacher_credits_controller').default['allocateToTeacher']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'bootstrapSchoolAdmin': {
    methods: ["POST"]
    pattern: '/api/v1/institutions/:id/bootstrap-school-admin'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/institution').bootstrapSchoolAdminValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/institution').bootstrapSchoolAdminValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['bootstrapSchoolAdmin']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['bootstrapSchoolAdmin']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'listInstitutionUsers': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/institutions/users'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['listInstitutionUsers']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['listInstitutionUsers']>>>
    }
  }
  'provisionUser': {
    methods: ["POST"]
    pattern: '/api/v1/institutions/users'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/institution').provisionInstitutionUserValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/institution').provisionInstitutionUserValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['provisionUser']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['provisionUser']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'assignUserRole': {
    methods: ["PATCH"]
    pattern: '/api/v1/institutions/users/:userId/role'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/institution').assignInstitutionUserRoleValidator)>>
      paramsTuple: [ParamValue]
      params: { userId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/institution').assignInstitutionUserRoleValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['assignUserRole']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['assignUserRole']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'upsertTeacherStudentAssociation': {
    methods: ["POST"]
    pattern: '/api/v1/institutions/teacher-students'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/institution').upsertTeacherStudentAssociationValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/institution').upsertTeacherStudentAssociationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['upsertTeacherStudentAssociation']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['upsertTeacherStudentAssociation']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'listInstitutionSubjects': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/institutions/subjects'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/subjects_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/subjects_controller').default['index']>>>
    }
  }
  'createInstitutionSubject': {
    methods: ["POST"]
    pattern: '/api/v1/institutions/subjects'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/school_group').createSubjectValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/school_group').createSubjectValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/subjects_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/subjects_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'listInstitutionGroups': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/institutions/groups'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['indexForInstitution']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['indexForInstitution']>>>
    }
  }
  'createInstitutionGroup': {
    methods: ["POST"]
    pattern: '/api/v1/institutions/groups'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/school_group').createGroupValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/school_group').createGroupValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['storeForInstitution']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['storeForInstitution']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'syncInstitutionGroupTeachers': {
    methods: ["POST"]
    pattern: '/api/v1/institutions/groups/:id/teachers'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['syncTeachers']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['syncTeachers']>>>
    }
  }
  'syncInstitutionGroupStudents': {
    methods: ["POST"]
    pattern: '/api/v1/institutions/groups/:id/students'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['syncStudents']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['syncStudents']>>>
    }
  }
  'listMyGroups': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/groups/mine'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['mine']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['mine']>>>
    }
  }
  'importGroupsCsv': {
    methods: ["POST"]
    pattern: '/api/v1/groups/import-csv'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/school_group').groupImportColumnMappingValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/school_group').groupImportColumnMappingValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['importCsv']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['importCsv']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'listGroupImportRuns': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/groups/import-runs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['listImportRuns']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['listImportRuns']>>>
    }
  }
  'showGroupImportRun': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/groups/import-runs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['showImportRun']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/groups_controller').default['showImportRun']>>>
    }
  }
  'showMyTeacherCreditPool': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/teachers/credit-pool'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/teacher_credits_controller').default['showMine']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/teacher_credits_controller').default['showMine']>>>
    }
  }
  'listStudentAvailableTasks': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/tasks/available'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tasks_controller').default['available']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tasks_controller').default['available']>>>
    }
  }
  'teacherTasksSummary': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/tasks/summary'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tasks_controller').default['teacherSummary']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tasks_controller').default['teacherSummary']>>>
    }
  }
  'listTeacherTasks': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/tasks'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tasks_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tasks_controller').default['index']>>>
    }
  }
  'createTask': {
    methods: ["POST"]
    pattern: '/api/v1/tasks'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/task').createTaskValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/task').createTaskValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tasks_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tasks_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'closeTask': {
    methods: ["PATCH"]
    pattern: '/api/v1/tasks/:id/close'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/task').closeTaskValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/task').closeTaskValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/tasks_controller').default['close']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/tasks_controller').default['close']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'createTaskFromClassroom': {
    methods: ["POST"]
    pattern: '/api/v1/tasks/from-classroom'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/google_classroom').createTaskFromClassroomValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/google_classroom').createTaskFromClassroomValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['createTaskFromClassroom']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['createTaskFromClassroom']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'syncClassroomTask': {
    methods: ["POST"]
    pattern: '/api/v1/tasks/:id/sync-classroom'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['syncTask']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['syncTask']>>>
    }
  }
  'showClassroomSyncRun': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/classroom-sync-runs/:runId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { runId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['showSyncRun']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['showSyncRun']>>>
    }
  }
  'googleClassroomCallback': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/integrations/google-classroom/callback'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['callback']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['callback']>>>
    }
  }
  'connectGoogleClassroom': {
    methods: ["POST"]
    pattern: '/api/v1/integrations/google-classroom/connect'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['connect']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['connect']>>>
    }
  }
  'googleClassroomStatus': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/integrations/google-classroom/status'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['status']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['status']>>>
    }
  }
  'disconnectGoogleClassroom': {
    methods: ["DELETE"]
    pattern: '/api/v1/integrations/google-classroom/disconnect'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['disconnect']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['disconnect']>>>
    }
  }
  'listGoogleClassroomCourses': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/integrations/google-classroom/courses'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['listCourses']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['listCourses']>>>
    }
  }
  'listGoogleClassroomCourseWork': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/integrations/google-classroom/courses/:courseId/coursework'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { courseId: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/google_classroom').listClassroomCourseWorkValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['listCourseWork']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['listCourseWork']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'syncGoogleClassroomStudents': {
    methods: ["POST"]
    pattern: '/api/v1/integrations/google-classroom/sync-students'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['syncStudents']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/google_classroom_controller').default['syncStudents']>>>
    }
  }
  'listStudentSubmissions': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/submissions'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['index']>>>
    }
  }
  'teacherQueue': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/submissions/teacher-queue'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['teacherQueue']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['teacherQueue']>>>
    }
  }
  'adminQueue': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/submissions/admin-queue'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['adminQueue']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['adminQueue']>>>
    }
  }
  'showSubmission': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/submissions/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['show']>>>
    }
  }
  'createSubmission': {
    methods: ["POST"]
    pattern: '/api/v1/submissions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/task').createSubmissionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/task').createSubmissionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'teacherActionSubmission': {
    methods: ["PATCH"]
    pattern: '/api/v1/submissions/:id/teacher-action'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/task').validateSubmissionActionValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/task').validateSubmissionActionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['teacherAction']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['teacherAction']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'teacherRejectSubmission': {
    methods: ["PATCH"]
    pattern: '/api/v1/submissions/:id/teacher-reject'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/task').teacherRejectSubmissionValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/task').teacherRejectSubmissionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['teacherReject']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['teacherReject']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'adminDecisionSubmission': {
    methods: ["PATCH"]
    pattern: '/api/v1/submissions/:id/admin-decision'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/task').adminSubmissionDecisionValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/task').adminSubmissionDecisionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['adminDecision']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/submissions_controller').default['adminDecision']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'postRewardForSubmission': {
    methods: ["POST"]
    pattern: '/api/v1/rewards/post/:submissionId'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { submissionId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rewards_controller').default['postForSubmission']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rewards_controller').default['postForSubmission']>>>
    }
  }
  'showStudentBalance': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/rewards/balance'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rewards_controller').default['showStudentBalance']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rewards_controller').default['showStudentBalance']>>>
    }
  }
  'rewardHistorySummary': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/rewards/history/summary'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rewards_controller').default['historySummary']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rewards_controller').default['historySummary']>>>
    }
  }
  'listInstitutionRewardHistory': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/rewards/history'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/rewards_controller').default['listInstitutionHistory']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/rewards_controller').default['listInstitutionHistory']>>>
    }
  }
  'listCatalogRewards': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/rewards/catalog'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/catalog_rewards_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/catalog_rewards_controller').default['index']>>>
    }
  }
  'createCatalogReward': {
    methods: ["POST"]
    pattern: '/api/v1/rewards/catalog'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog_reward').createCatalogRewardValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog_reward').createCatalogRewardValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/catalog_rewards_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/catalog_rewards_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'updateCatalogReward': {
    methods: ["PATCH"]
    pattern: '/api/v1/rewards/catalog/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/catalog_reward').updateCatalogRewardValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/catalog_reward').updateCatalogRewardValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/catalog_rewards_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/catalog_rewards_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'listStudentLeaderboard': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/leaderboard/students'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/leaderboard_controller').default['students']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/leaderboard_controller').default['students']>>>
    }
  }
  'listMyAchievements': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/achievements/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/achievements_controller').default['me']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/achievements_controller').default['me']>>>
    }
  }
  'studentBalance': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/students/:studentId/balance'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { studentId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/students_controller').default['showBalance']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/students_controller').default['showBalance']>>>
    }
  }
  'studentTransactions': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/students/:studentId/transactions'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { studentId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/students_controller').default['listTransactions']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/students_controller').default['listTransactions']>>>
    }
  }
  'createRedemption': {
    methods: ["POST"]
    pattern: '/api/v1/redemptions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/redemption').createRedemptionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/redemption').createRedemptionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/redemptions_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/redemptions_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'listRedemptions': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/redemptions'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/redemptions_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/redemptions_controller').default['index']>>>
    }
  }
  'approveRedemption': {
    methods: ["PATCH"]
    pattern: '/api/v1/redemptions/:id/approve'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/redemptions_controller').default['approve']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/redemptions_controller').default['approve']>>>
    }
  }
  'rejectRedemption': {
    methods: ["PATCH"]
    pattern: '/api/v1/redemptions/:id/reject'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/redemption').rejectRedemptionValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/redemption').rejectRedemptionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/redemptions_controller').default['reject']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/redemptions_controller').default['reject']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'tokenHealth': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/token/health'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/token_health_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/token_health_controller').default['show']>>>
    }
  }
  'profile.profile.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/account/profile'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
    }
  }
  'profile.changePassword': {
    methods: ["PATCH"]
    pattern: '/api/v1/account/password'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').changePasswordValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').changePasswordValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['updatePassword']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['updatePassword']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ngo_institutions.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/ngo-institutions'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ngo_institutions_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ngo_institutions_controller').default['index']>>>
    }
  }
  'ngo_institutions.store': {
    methods: ["POST"]
    pattern: '/api/v1/ngo-institutions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/ngo_institution').createNgoInstitutionValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/ngo_institution').createNgoInstitutionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ngo_institutions_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ngo_institutions_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ngo_institutions.update_status': {
    methods: ["PATCH"]
    pattern: '/api/v1/ngo-institutions/:id/status'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/ngo_institution').updateNgoStatusValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/ngo_institution').updateNgoStatusValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ngo_institutions_controller').default['updateStatus']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ngo_institutions_controller').default['updateStatus']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ngo_institutions.bootstrap_ngo_admin': {
    methods: ["POST"]
    pattern: '/api/v1/ngo-institutions/:id/bootstrap-ngo-admin'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/ngo_institution').bootstrapNgoAdminValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/ngo_institution').bootstrapNgoAdminValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ngo_institutions_controller').default['bootstrapNgoAdmin']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ngo_institutions_controller').default['bootstrapNgoAdmin']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'ngo_institutions.assign_user': {
    methods: ["PATCH"]
    pattern: '/api/v1/ngo-institutions/:id/assign-user'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/ngo_institution').assignNgoUserValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/ngo_institution').assignNgoUserValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/ngo_institutions_controller').default['assignUser']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/ngo_institutions_controller').default['assignUser']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'dashboard.summary': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/dashboard/summary'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['summary']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/dashboard_controller').default['summary']>>>
    }
  }
}
