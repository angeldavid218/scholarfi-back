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
  'fundingBalance': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/institutions/funding-balance'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['fundingBalance']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/institutions_controller').default['fundingBalance']>>>
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
  'funding_programs.available_institutions': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/funding-programs/institutions/available'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/funding_programs_controller').default['availableInstitutions']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/funding_programs_controller').default['availableInstitutions']>>>
    }
  }
  'funding_programs.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/funding-programs'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/funding_programs_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/funding_programs_controller').default['index']>>>
    }
  }
  'funding_programs.store': {
    methods: ["POST"]
    pattern: '/api/v1/funding-programs'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/funding_program').createFundingProgramValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/funding_program').createFundingProgramValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/funding_programs_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/funding_programs_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'budget_allocations.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/funding-programs/:programId/budget-allocations'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { programId: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/budget_allocations_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/budget_allocations_controller').default['index']>>>
    }
  }
  'budget_allocations.store': {
    methods: ["POST"]
    pattern: '/api/v1/funding-programs/:programId/budget-allocations'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/budget_allocation').createBudgetAllocationsValidator)>>
      paramsTuple: [ParamValue]
      params: { programId: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/budget_allocation').createBudgetAllocationsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/budget_allocations_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/budget_allocations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'budget_allocations.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/funding-programs/:programId/budget-allocations/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue, ParamValue]
      params: { programId: ParamValue; id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/budget_allocations_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/budget_allocations_controller').default['show']>>>
    }
  }
  'budget_allocations.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/funding-programs/:programId/budget-allocations/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/budget_allocation').updateBudgetAllocationValidator)>>
      paramsTuple: [ParamValue, ParamValue]
      params: { programId: ParamValue; id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/budget_allocation').updateBudgetAllocationValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/budget_allocations_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/budget_allocations_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'funding_programs.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/funding-programs/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/funding_programs_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/funding_programs_controller').default['show']>>>
    }
  }
  'funding_programs.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/funding-programs/:id'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/funding_program').updateFundingProgramValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/funding_program').updateFundingProgramValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/funding_programs_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/funding_programs_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
}
