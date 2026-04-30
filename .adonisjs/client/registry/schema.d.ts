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
}
