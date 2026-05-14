/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'auth.new_account.store': {
    methods: ["POST"],
    pattern: '/api/v1/auth/signup',
    tokens: [{"old":"/api/v1/auth/signup","type":0,"val":"api","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['auth.new_account.store']['types'],
  },
  'auth.access_token.store': {
    methods: ["POST"],
    pattern: '/api/v1/auth/login',
    tokens: [{"old":"/api/v1/auth/login","type":0,"val":"api","end":""},{"old":"/api/v1/auth/login","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/login","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['auth.access_token.store']['types'],
  },
  'auth.access_token.destroy': {
    methods: ["POST"],
    pattern: '/api/v1/auth/logout',
    tokens: [{"old":"/api/v1/auth/logout","type":0,"val":"api","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['auth.access_token.destroy']['types'],
  },
  'index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/institutions',
    tokens: [{"old":"/api/v1/institutions","type":0,"val":"api","end":""},{"old":"/api/v1/institutions","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions","type":0,"val":"institutions","end":""}],
    types: placeholder as Registry['index']['types'],
  },
  'store': {
    methods: ["POST"],
    pattern: '/api/v1/institutions',
    tokens: [{"old":"/api/v1/institutions","type":0,"val":"api","end":""},{"old":"/api/v1/institutions","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions","type":0,"val":"institutions","end":""}],
    types: placeholder as Registry['store']['types'],
  },
  'updateStatus': {
    methods: ["PATCH"],
    pattern: '/api/v1/institutions/:id/status',
    tokens: [{"old":"/api/v1/institutions/:id/status","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/:id/status","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/:id/status","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/:id/status","type":1,"val":"id","end":""},{"old":"/api/v1/institutions/:id/status","type":0,"val":"status","end":""}],
    types: placeholder as Registry['updateStatus']['types'],
  },
  'bootstrapSchoolAdmin': {
    methods: ["POST"],
    pattern: '/api/v1/institutions/:id/bootstrap-school-admin',
    tokens: [{"old":"/api/v1/institutions/:id/bootstrap-school-admin","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/:id/bootstrap-school-admin","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/:id/bootstrap-school-admin","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/:id/bootstrap-school-admin","type":1,"val":"id","end":""},{"old":"/api/v1/institutions/:id/bootstrap-school-admin","type":0,"val":"bootstrap-school-admin","end":""}],
    types: placeholder as Registry['bootstrapSchoolAdmin']['types'],
  },
  'listInstitutionUsers': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/institutions/users',
    tokens: [{"old":"/api/v1/institutions/users","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/users","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/users","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/users","type":0,"val":"users","end":""}],
    types: placeholder as Registry['listInstitutionUsers']['types'],
  },
  'provisionUser': {
    methods: ["POST"],
    pattern: '/api/v1/institutions/users',
    tokens: [{"old":"/api/v1/institutions/users","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/users","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/users","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/users","type":0,"val":"users","end":""}],
    types: placeholder as Registry['provisionUser']['types'],
  },
  'assignUserRole': {
    methods: ["PATCH"],
    pattern: '/api/v1/institutions/users/:userId/role',
    tokens: [{"old":"/api/v1/institutions/users/:userId/role","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/users/:userId/role","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/users/:userId/role","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/users/:userId/role","type":0,"val":"users","end":""},{"old":"/api/v1/institutions/users/:userId/role","type":1,"val":"userId","end":""},{"old":"/api/v1/institutions/users/:userId/role","type":0,"val":"role","end":""}],
    types: placeholder as Registry['assignUserRole']['types'],
  },
  'upsertTeacherStudentAssociation': {
    methods: ["POST"],
    pattern: '/api/v1/institutions/teacher-students',
    tokens: [{"old":"/api/v1/institutions/teacher-students","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/teacher-students","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/teacher-students","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/teacher-students","type":0,"val":"teacher-students","end":""}],
    types: placeholder as Registry['upsertTeacherStudentAssociation']['types'],
  },
  'listStudentAvailableTasks': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/tasks/available',
    tokens: [{"old":"/api/v1/tasks/available","type":0,"val":"api","end":""},{"old":"/api/v1/tasks/available","type":0,"val":"v1","end":""},{"old":"/api/v1/tasks/available","type":0,"val":"tasks","end":""},{"old":"/api/v1/tasks/available","type":0,"val":"available","end":""}],
    types: placeholder as Registry['listStudentAvailableTasks']['types'],
  },
  'teacherTasksSummary': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/tasks/summary',
    tokens: [{"old":"/api/v1/tasks/summary","type":0,"val":"api","end":""},{"old":"/api/v1/tasks/summary","type":0,"val":"v1","end":""},{"old":"/api/v1/tasks/summary","type":0,"val":"tasks","end":""},{"old":"/api/v1/tasks/summary","type":0,"val":"summary","end":""}],
    types: placeholder as Registry['teacherTasksSummary']['types'],
  },
  'listTeacherTasks': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/tasks',
    tokens: [{"old":"/api/v1/tasks","type":0,"val":"api","end":""},{"old":"/api/v1/tasks","type":0,"val":"v1","end":""},{"old":"/api/v1/tasks","type":0,"val":"tasks","end":""}],
    types: placeholder as Registry['listTeacherTasks']['types'],
  },
  'createTask': {
    methods: ["POST"],
    pattern: '/api/v1/tasks',
    tokens: [{"old":"/api/v1/tasks","type":0,"val":"api","end":""},{"old":"/api/v1/tasks","type":0,"val":"v1","end":""},{"old":"/api/v1/tasks","type":0,"val":"tasks","end":""}],
    types: placeholder as Registry['createTask']['types'],
  },
  'closeTask': {
    methods: ["PATCH"],
    pattern: '/api/v1/tasks/:id/close',
    tokens: [{"old":"/api/v1/tasks/:id/close","type":0,"val":"api","end":""},{"old":"/api/v1/tasks/:id/close","type":0,"val":"v1","end":""},{"old":"/api/v1/tasks/:id/close","type":0,"val":"tasks","end":""},{"old":"/api/v1/tasks/:id/close","type":1,"val":"id","end":""},{"old":"/api/v1/tasks/:id/close","type":0,"val":"close","end":""}],
    types: placeholder as Registry['closeTask']['types'],
  },
  'listStudentSubmissions': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/submissions',
    tokens: [{"old":"/api/v1/submissions","type":0,"val":"api","end":""},{"old":"/api/v1/submissions","type":0,"val":"v1","end":""},{"old":"/api/v1/submissions","type":0,"val":"submissions","end":""}],
    types: placeholder as Registry['listStudentSubmissions']['types'],
  },
  'teacherQueue': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/submissions/teacher-queue',
    tokens: [{"old":"/api/v1/submissions/teacher-queue","type":0,"val":"api","end":""},{"old":"/api/v1/submissions/teacher-queue","type":0,"val":"v1","end":""},{"old":"/api/v1/submissions/teacher-queue","type":0,"val":"submissions","end":""},{"old":"/api/v1/submissions/teacher-queue","type":0,"val":"teacher-queue","end":""}],
    types: placeholder as Registry['teacherQueue']['types'],
  },
  'adminQueue': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/submissions/admin-queue',
    tokens: [{"old":"/api/v1/submissions/admin-queue","type":0,"val":"api","end":""},{"old":"/api/v1/submissions/admin-queue","type":0,"val":"v1","end":""},{"old":"/api/v1/submissions/admin-queue","type":0,"val":"submissions","end":""},{"old":"/api/v1/submissions/admin-queue","type":0,"val":"admin-queue","end":""}],
    types: placeholder as Registry['adminQueue']['types'],
  },
  'showSubmission': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/submissions/:id',
    tokens: [{"old":"/api/v1/submissions/:id","type":0,"val":"api","end":""},{"old":"/api/v1/submissions/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/submissions/:id","type":0,"val":"submissions","end":""},{"old":"/api/v1/submissions/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['showSubmission']['types'],
  },
  'createSubmission': {
    methods: ["POST"],
    pattern: '/api/v1/submissions',
    tokens: [{"old":"/api/v1/submissions","type":0,"val":"api","end":""},{"old":"/api/v1/submissions","type":0,"val":"v1","end":""},{"old":"/api/v1/submissions","type":0,"val":"submissions","end":""}],
    types: placeholder as Registry['createSubmission']['types'],
  },
  'teacherActionSubmission': {
    methods: ["PATCH"],
    pattern: '/api/v1/submissions/:id/teacher-action',
    tokens: [{"old":"/api/v1/submissions/:id/teacher-action","type":0,"val":"api","end":""},{"old":"/api/v1/submissions/:id/teacher-action","type":0,"val":"v1","end":""},{"old":"/api/v1/submissions/:id/teacher-action","type":0,"val":"submissions","end":""},{"old":"/api/v1/submissions/:id/teacher-action","type":1,"val":"id","end":""},{"old":"/api/v1/submissions/:id/teacher-action","type":0,"val":"teacher-action","end":""}],
    types: placeholder as Registry['teacherActionSubmission']['types'],
  },
  'teacherRejectSubmission': {
    methods: ["PATCH"],
    pattern: '/api/v1/submissions/:id/teacher-reject',
    tokens: [{"old":"/api/v1/submissions/:id/teacher-reject","type":0,"val":"api","end":""},{"old":"/api/v1/submissions/:id/teacher-reject","type":0,"val":"v1","end":""},{"old":"/api/v1/submissions/:id/teacher-reject","type":0,"val":"submissions","end":""},{"old":"/api/v1/submissions/:id/teacher-reject","type":1,"val":"id","end":""},{"old":"/api/v1/submissions/:id/teacher-reject","type":0,"val":"teacher-reject","end":""}],
    types: placeholder as Registry['teacherRejectSubmission']['types'],
  },
  'adminDecisionSubmission': {
    methods: ["PATCH"],
    pattern: '/api/v1/submissions/:id/admin-decision',
    tokens: [{"old":"/api/v1/submissions/:id/admin-decision","type":0,"val":"api","end":""},{"old":"/api/v1/submissions/:id/admin-decision","type":0,"val":"v1","end":""},{"old":"/api/v1/submissions/:id/admin-decision","type":0,"val":"submissions","end":""},{"old":"/api/v1/submissions/:id/admin-decision","type":1,"val":"id","end":""},{"old":"/api/v1/submissions/:id/admin-decision","type":0,"val":"admin-decision","end":""}],
    types: placeholder as Registry['adminDecisionSubmission']['types'],
  },
  'postRewardForSubmission': {
    methods: ["POST"],
    pattern: '/api/v1/rewards/post/:submissionId',
    tokens: [{"old":"/api/v1/rewards/post/:submissionId","type":0,"val":"api","end":""},{"old":"/api/v1/rewards/post/:submissionId","type":0,"val":"v1","end":""},{"old":"/api/v1/rewards/post/:submissionId","type":0,"val":"rewards","end":""},{"old":"/api/v1/rewards/post/:submissionId","type":0,"val":"post","end":""},{"old":"/api/v1/rewards/post/:submissionId","type":1,"val":"submissionId","end":""}],
    types: placeholder as Registry['postRewardForSubmission']['types'],
  },
  'showStudentBalance': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/rewards/balance',
    tokens: [{"old":"/api/v1/rewards/balance","type":0,"val":"api","end":""},{"old":"/api/v1/rewards/balance","type":0,"val":"v1","end":""},{"old":"/api/v1/rewards/balance","type":0,"val":"rewards","end":""},{"old":"/api/v1/rewards/balance","type":0,"val":"balance","end":""}],
    types: placeholder as Registry['showStudentBalance']['types'],
  },
  'rewardHistorySummary': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/rewards/history/summary',
    tokens: [{"old":"/api/v1/rewards/history/summary","type":0,"val":"api","end":""},{"old":"/api/v1/rewards/history/summary","type":0,"val":"v1","end":""},{"old":"/api/v1/rewards/history/summary","type":0,"val":"rewards","end":""},{"old":"/api/v1/rewards/history/summary","type":0,"val":"history","end":""},{"old":"/api/v1/rewards/history/summary","type":0,"val":"summary","end":""}],
    types: placeholder as Registry['rewardHistorySummary']['types'],
  },
  'listInstitutionRewardHistory': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/rewards/history',
    tokens: [{"old":"/api/v1/rewards/history","type":0,"val":"api","end":""},{"old":"/api/v1/rewards/history","type":0,"val":"v1","end":""},{"old":"/api/v1/rewards/history","type":0,"val":"rewards","end":""},{"old":"/api/v1/rewards/history","type":0,"val":"history","end":""}],
    types: placeholder as Registry['listInstitutionRewardHistory']['types'],
  },
  'listCatalogRewards': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/rewards/catalog',
    tokens: [{"old":"/api/v1/rewards/catalog","type":0,"val":"api","end":""},{"old":"/api/v1/rewards/catalog","type":0,"val":"v1","end":""},{"old":"/api/v1/rewards/catalog","type":0,"val":"rewards","end":""},{"old":"/api/v1/rewards/catalog","type":0,"val":"catalog","end":""}],
    types: placeholder as Registry['listCatalogRewards']['types'],
  },
  'createCatalogReward': {
    methods: ["POST"],
    pattern: '/api/v1/rewards/catalog',
    tokens: [{"old":"/api/v1/rewards/catalog","type":0,"val":"api","end":""},{"old":"/api/v1/rewards/catalog","type":0,"val":"v1","end":""},{"old":"/api/v1/rewards/catalog","type":0,"val":"rewards","end":""},{"old":"/api/v1/rewards/catalog","type":0,"val":"catalog","end":""}],
    types: placeholder as Registry['createCatalogReward']['types'],
  },
  'studentBalance': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/students/:studentId/balance',
    tokens: [{"old":"/api/v1/students/:studentId/balance","type":0,"val":"api","end":""},{"old":"/api/v1/students/:studentId/balance","type":0,"val":"v1","end":""},{"old":"/api/v1/students/:studentId/balance","type":0,"val":"students","end":""},{"old":"/api/v1/students/:studentId/balance","type":1,"val":"studentId","end":""},{"old":"/api/v1/students/:studentId/balance","type":0,"val":"balance","end":""}],
    types: placeholder as Registry['studentBalance']['types'],
  },
  'studentTransactions': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/students/:studentId/transactions',
    tokens: [{"old":"/api/v1/students/:studentId/transactions","type":0,"val":"api","end":""},{"old":"/api/v1/students/:studentId/transactions","type":0,"val":"v1","end":""},{"old":"/api/v1/students/:studentId/transactions","type":0,"val":"students","end":""},{"old":"/api/v1/students/:studentId/transactions","type":1,"val":"studentId","end":""},{"old":"/api/v1/students/:studentId/transactions","type":0,"val":"transactions","end":""}],
    types: placeholder as Registry['studentTransactions']['types'],
  },
  'createRedemption': {
    methods: ["POST"],
    pattern: '/api/v1/redemptions',
    tokens: [{"old":"/api/v1/redemptions","type":0,"val":"api","end":""},{"old":"/api/v1/redemptions","type":0,"val":"v1","end":""},{"old":"/api/v1/redemptions","type":0,"val":"redemptions","end":""}],
    types: placeholder as Registry['createRedemption']['types'],
  },
  'listRedemptions': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/redemptions',
    tokens: [{"old":"/api/v1/redemptions","type":0,"val":"api","end":""},{"old":"/api/v1/redemptions","type":0,"val":"v1","end":""},{"old":"/api/v1/redemptions","type":0,"val":"redemptions","end":""}],
    types: placeholder as Registry['listRedemptions']['types'],
  },
  'approveRedemption': {
    methods: ["PATCH"],
    pattern: '/api/v1/redemptions/:id/approve',
    tokens: [{"old":"/api/v1/redemptions/:id/approve","type":0,"val":"api","end":""},{"old":"/api/v1/redemptions/:id/approve","type":0,"val":"v1","end":""},{"old":"/api/v1/redemptions/:id/approve","type":0,"val":"redemptions","end":""},{"old":"/api/v1/redemptions/:id/approve","type":1,"val":"id","end":""},{"old":"/api/v1/redemptions/:id/approve","type":0,"val":"approve","end":""}],
    types: placeholder as Registry['approveRedemption']['types'],
  },
  'rejectRedemption': {
    methods: ["PATCH"],
    pattern: '/api/v1/redemptions/:id/reject',
    tokens: [{"old":"/api/v1/redemptions/:id/reject","type":0,"val":"api","end":""},{"old":"/api/v1/redemptions/:id/reject","type":0,"val":"v1","end":""},{"old":"/api/v1/redemptions/:id/reject","type":0,"val":"redemptions","end":""},{"old":"/api/v1/redemptions/:id/reject","type":1,"val":"id","end":""},{"old":"/api/v1/redemptions/:id/reject","type":0,"val":"reject","end":""}],
    types: placeholder as Registry['rejectRedemption']['types'],
  },
  'tokenHealth': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/token/health',
    tokens: [{"old":"/api/v1/token/health","type":0,"val":"api","end":""},{"old":"/api/v1/token/health","type":0,"val":"v1","end":""},{"old":"/api/v1/token/health","type":0,"val":"token","end":""},{"old":"/api/v1/token/health","type":0,"val":"health","end":""}],
    types: placeholder as Registry['tokenHealth']['types'],
  },
  'profile.profile.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/account/profile',
    tokens: [{"old":"/api/v1/account/profile","type":0,"val":"api","end":""},{"old":"/api/v1/account/profile","type":0,"val":"v1","end":""},{"old":"/api/v1/account/profile","type":0,"val":"account","end":""},{"old":"/api/v1/account/profile","type":0,"val":"profile","end":""}],
    types: placeholder as Registry['profile.profile.show']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
