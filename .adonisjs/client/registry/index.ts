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
  'auth.registerStudent': {
    methods: ["POST"],
    pattern: '/api/v1/auth/register-student',
    tokens: [{"old":"/api/v1/auth/register-student","type":0,"val":"api","end":""},{"old":"/api/v1/auth/register-student","type":0,"val":"v1","end":""},{"old":"/api/v1/auth/register-student","type":0,"val":"auth","end":""},{"old":"/api/v1/auth/register-student","type":0,"val":"register-student","end":""}],
    types: placeholder as Registry['auth.registerStudent']['types'],
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
  'updateCryptoWallets': {
    methods: ["PATCH"],
    pattern: '/api/v1/institutions/:id/crypto-wallets',
    tokens: [{"old":"/api/v1/institutions/:id/crypto-wallets","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/:id/crypto-wallets","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/:id/crypto-wallets","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/:id/crypto-wallets","type":1,"val":"id","end":""},{"old":"/api/v1/institutions/:id/crypto-wallets","type":0,"val":"crypto-wallets","end":""}],
    types: placeholder as Registry['updateCryptoWallets']['types'],
  },
  'showInstitutionCreditPool': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/institutions/:id/credit-pool',
    tokens: [{"old":"/api/v1/institutions/:id/credit-pool","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/:id/credit-pool","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/:id/credit-pool","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/:id/credit-pool","type":1,"val":"id","end":""},{"old":"/api/v1/institutions/:id/credit-pool","type":0,"val":"credit-pool","end":""}],
    types: placeholder as Registry['showInstitutionCreditPool']['types'],
  },
  'allocateInstitutionCredits': {
    methods: ["POST"],
    pattern: '/api/v1/institutions/:id/credit-pool/allocate',
    tokens: [{"old":"/api/v1/institutions/:id/credit-pool/allocate","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/:id/credit-pool/allocate","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/:id/credit-pool/allocate","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/:id/credit-pool/allocate","type":1,"val":"id","end":""},{"old":"/api/v1/institutions/:id/credit-pool/allocate","type":0,"val":"credit-pool","end":""},{"old":"/api/v1/institutions/:id/credit-pool/allocate","type":0,"val":"allocate","end":""}],
    types: placeholder as Registry['allocateInstitutionCredits']['types'],
  },
  'showMyInstitutionCreditPool': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/institutions/credit-pool',
    tokens: [{"old":"/api/v1/institutions/credit-pool","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/credit-pool","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/credit-pool","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/credit-pool","type":0,"val":"credit-pool","end":""}],
    types: placeholder as Registry['showMyInstitutionCreditPool']['types'],
  },
  'listTeacherCreditPools': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/institutions/teacher-credit-pools',
    tokens: [{"old":"/api/v1/institutions/teacher-credit-pools","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/teacher-credit-pools","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/teacher-credit-pools","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/teacher-credit-pools","type":0,"val":"teacher-credit-pools","end":""}],
    types: placeholder as Registry['listTeacherCreditPools']['types'],
  },
  'allocateEqualTeacherCredits': {
    methods: ["POST"],
    pattern: '/api/v1/institutions/teacher-credit-pools/allocate-equal',
    tokens: [{"old":"/api/v1/institutions/teacher-credit-pools/allocate-equal","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/teacher-credit-pools/allocate-equal","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/teacher-credit-pools/allocate-equal","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/teacher-credit-pools/allocate-equal","type":0,"val":"teacher-credit-pools","end":""},{"old":"/api/v1/institutions/teacher-credit-pools/allocate-equal","type":0,"val":"allocate-equal","end":""}],
    types: placeholder as Registry['allocateEqualTeacherCredits']['types'],
  },
  'allocateTeacherCredits': {
    methods: ["POST"],
    pattern: '/api/v1/institutions/teacher-credit-pools/:teacherId/allocate',
    tokens: [{"old":"/api/v1/institutions/teacher-credit-pools/:teacherId/allocate","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/teacher-credit-pools/:teacherId/allocate","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/teacher-credit-pools/:teacherId/allocate","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/teacher-credit-pools/:teacherId/allocate","type":0,"val":"teacher-credit-pools","end":""},{"old":"/api/v1/institutions/teacher-credit-pools/:teacherId/allocate","type":1,"val":"teacherId","end":""},{"old":"/api/v1/institutions/teacher-credit-pools/:teacherId/allocate","type":0,"val":"allocate","end":""}],
    types: placeholder as Registry['allocateTeacherCredits']['types'],
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
  'listInstitutionSubjects': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/institutions/subjects',
    tokens: [{"old":"/api/v1/institutions/subjects","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/subjects","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/subjects","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/subjects","type":0,"val":"subjects","end":""}],
    types: placeholder as Registry['listInstitutionSubjects']['types'],
  },
  'createInstitutionSubject': {
    methods: ["POST"],
    pattern: '/api/v1/institutions/subjects',
    tokens: [{"old":"/api/v1/institutions/subjects","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/subjects","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/subjects","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/subjects","type":0,"val":"subjects","end":""}],
    types: placeholder as Registry['createInstitutionSubject']['types'],
  },
  'listInstitutionGroups': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/institutions/groups',
    tokens: [{"old":"/api/v1/institutions/groups","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/groups","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/groups","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/groups","type":0,"val":"groups","end":""}],
    types: placeholder as Registry['listInstitutionGroups']['types'],
  },
  'createInstitutionGroup': {
    methods: ["POST"],
    pattern: '/api/v1/institutions/groups',
    tokens: [{"old":"/api/v1/institutions/groups","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/groups","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/groups","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/groups","type":0,"val":"groups","end":""}],
    types: placeholder as Registry['createInstitutionGroup']['types'],
  },
  'syncInstitutionGroupTeachers': {
    methods: ["POST"],
    pattern: '/api/v1/institutions/groups/:id/teachers',
    tokens: [{"old":"/api/v1/institutions/groups/:id/teachers","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/groups/:id/teachers","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/groups/:id/teachers","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/groups/:id/teachers","type":0,"val":"groups","end":""},{"old":"/api/v1/institutions/groups/:id/teachers","type":1,"val":"id","end":""},{"old":"/api/v1/institutions/groups/:id/teachers","type":0,"val":"teachers","end":""}],
    types: placeholder as Registry['syncInstitutionGroupTeachers']['types'],
  },
  'syncInstitutionGroupStudents': {
    methods: ["POST"],
    pattern: '/api/v1/institutions/groups/:id/students',
    tokens: [{"old":"/api/v1/institutions/groups/:id/students","type":0,"val":"api","end":""},{"old":"/api/v1/institutions/groups/:id/students","type":0,"val":"v1","end":""},{"old":"/api/v1/institutions/groups/:id/students","type":0,"val":"institutions","end":""},{"old":"/api/v1/institutions/groups/:id/students","type":0,"val":"groups","end":""},{"old":"/api/v1/institutions/groups/:id/students","type":1,"val":"id","end":""},{"old":"/api/v1/institutions/groups/:id/students","type":0,"val":"students","end":""}],
    types: placeholder as Registry['syncInstitutionGroupStudents']['types'],
  },
  'listMyGroups': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/groups/mine',
    tokens: [{"old":"/api/v1/groups/mine","type":0,"val":"api","end":""},{"old":"/api/v1/groups/mine","type":0,"val":"v1","end":""},{"old":"/api/v1/groups/mine","type":0,"val":"groups","end":""},{"old":"/api/v1/groups/mine","type":0,"val":"mine","end":""}],
    types: placeholder as Registry['listMyGroups']['types'],
  },
  'importGroupsCsv': {
    methods: ["POST"],
    pattern: '/api/v1/groups/import-csv',
    tokens: [{"old":"/api/v1/groups/import-csv","type":0,"val":"api","end":""},{"old":"/api/v1/groups/import-csv","type":0,"val":"v1","end":""},{"old":"/api/v1/groups/import-csv","type":0,"val":"groups","end":""},{"old":"/api/v1/groups/import-csv","type":0,"val":"import-csv","end":""}],
    types: placeholder as Registry['importGroupsCsv']['types'],
  },
  'listGroupImportRuns': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/groups/import-runs',
    tokens: [{"old":"/api/v1/groups/import-runs","type":0,"val":"api","end":""},{"old":"/api/v1/groups/import-runs","type":0,"val":"v1","end":""},{"old":"/api/v1/groups/import-runs","type":0,"val":"groups","end":""},{"old":"/api/v1/groups/import-runs","type":0,"val":"import-runs","end":""}],
    types: placeholder as Registry['listGroupImportRuns']['types'],
  },
  'showGroupImportRun': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/groups/import-runs/:id',
    tokens: [{"old":"/api/v1/groups/import-runs/:id","type":0,"val":"api","end":""},{"old":"/api/v1/groups/import-runs/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/groups/import-runs/:id","type":0,"val":"groups","end":""},{"old":"/api/v1/groups/import-runs/:id","type":0,"val":"import-runs","end":""},{"old":"/api/v1/groups/import-runs/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['showGroupImportRun']['types'],
  },
  'showMyTeacherCreditPool': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/teachers/credit-pool',
    tokens: [{"old":"/api/v1/teachers/credit-pool","type":0,"val":"api","end":""},{"old":"/api/v1/teachers/credit-pool","type":0,"val":"v1","end":""},{"old":"/api/v1/teachers/credit-pool","type":0,"val":"teachers","end":""},{"old":"/api/v1/teachers/credit-pool","type":0,"val":"credit-pool","end":""}],
    types: placeholder as Registry['showMyTeacherCreditPool']['types'],
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
  'createTaskFromClassroom': {
    methods: ["POST"],
    pattern: '/api/v1/tasks/from-classroom',
    tokens: [{"old":"/api/v1/tasks/from-classroom","type":0,"val":"api","end":""},{"old":"/api/v1/tasks/from-classroom","type":0,"val":"v1","end":""},{"old":"/api/v1/tasks/from-classroom","type":0,"val":"tasks","end":""},{"old":"/api/v1/tasks/from-classroom","type":0,"val":"from-classroom","end":""}],
    types: placeholder as Registry['createTaskFromClassroom']['types'],
  },
  'syncClassroomTask': {
    methods: ["POST"],
    pattern: '/api/v1/tasks/:id/sync-classroom',
    tokens: [{"old":"/api/v1/tasks/:id/sync-classroom","type":0,"val":"api","end":""},{"old":"/api/v1/tasks/:id/sync-classroom","type":0,"val":"v1","end":""},{"old":"/api/v1/tasks/:id/sync-classroom","type":0,"val":"tasks","end":""},{"old":"/api/v1/tasks/:id/sync-classroom","type":1,"val":"id","end":""},{"old":"/api/v1/tasks/:id/sync-classroom","type":0,"val":"sync-classroom","end":""}],
    types: placeholder as Registry['syncClassroomTask']['types'],
  },
  'googleClassroomCallback': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/integrations/google-classroom/callback',
    tokens: [{"old":"/api/v1/integrations/google-classroom/callback","type":0,"val":"api","end":""},{"old":"/api/v1/integrations/google-classroom/callback","type":0,"val":"v1","end":""},{"old":"/api/v1/integrations/google-classroom/callback","type":0,"val":"integrations","end":""},{"old":"/api/v1/integrations/google-classroom/callback","type":0,"val":"google-classroom","end":""},{"old":"/api/v1/integrations/google-classroom/callback","type":0,"val":"callback","end":""}],
    types: placeholder as Registry['googleClassroomCallback']['types'],
  },
  'connectGoogleClassroom': {
    methods: ["POST"],
    pattern: '/api/v1/integrations/google-classroom/connect',
    tokens: [{"old":"/api/v1/integrations/google-classroom/connect","type":0,"val":"api","end":""},{"old":"/api/v1/integrations/google-classroom/connect","type":0,"val":"v1","end":""},{"old":"/api/v1/integrations/google-classroom/connect","type":0,"val":"integrations","end":""},{"old":"/api/v1/integrations/google-classroom/connect","type":0,"val":"google-classroom","end":""},{"old":"/api/v1/integrations/google-classroom/connect","type":0,"val":"connect","end":""}],
    types: placeholder as Registry['connectGoogleClassroom']['types'],
  },
  'googleClassroomStatus': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/integrations/google-classroom/status',
    tokens: [{"old":"/api/v1/integrations/google-classroom/status","type":0,"val":"api","end":""},{"old":"/api/v1/integrations/google-classroom/status","type":0,"val":"v1","end":""},{"old":"/api/v1/integrations/google-classroom/status","type":0,"val":"integrations","end":""},{"old":"/api/v1/integrations/google-classroom/status","type":0,"val":"google-classroom","end":""},{"old":"/api/v1/integrations/google-classroom/status","type":0,"val":"status","end":""}],
    types: placeholder as Registry['googleClassroomStatus']['types'],
  },
  'disconnectGoogleClassroom': {
    methods: ["DELETE"],
    pattern: '/api/v1/integrations/google-classroom/disconnect',
    tokens: [{"old":"/api/v1/integrations/google-classroom/disconnect","type":0,"val":"api","end":""},{"old":"/api/v1/integrations/google-classroom/disconnect","type":0,"val":"v1","end":""},{"old":"/api/v1/integrations/google-classroom/disconnect","type":0,"val":"integrations","end":""},{"old":"/api/v1/integrations/google-classroom/disconnect","type":0,"val":"google-classroom","end":""},{"old":"/api/v1/integrations/google-classroom/disconnect","type":0,"val":"disconnect","end":""}],
    types: placeholder as Registry['disconnectGoogleClassroom']['types'],
  },
  'listGoogleClassroomCourses': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/integrations/google-classroom/courses',
    tokens: [{"old":"/api/v1/integrations/google-classroom/courses","type":0,"val":"api","end":""},{"old":"/api/v1/integrations/google-classroom/courses","type":0,"val":"v1","end":""},{"old":"/api/v1/integrations/google-classroom/courses","type":0,"val":"integrations","end":""},{"old":"/api/v1/integrations/google-classroom/courses","type":0,"val":"google-classroom","end":""},{"old":"/api/v1/integrations/google-classroom/courses","type":0,"val":"courses","end":""}],
    types: placeholder as Registry['listGoogleClassroomCourses']['types'],
  },
  'listGoogleClassroomCourseWork': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/integrations/google-classroom/courses/:courseId/coursework',
    tokens: [{"old":"/api/v1/integrations/google-classroom/courses/:courseId/coursework","type":0,"val":"api","end":""},{"old":"/api/v1/integrations/google-classroom/courses/:courseId/coursework","type":0,"val":"v1","end":""},{"old":"/api/v1/integrations/google-classroom/courses/:courseId/coursework","type":0,"val":"integrations","end":""},{"old":"/api/v1/integrations/google-classroom/courses/:courseId/coursework","type":0,"val":"google-classroom","end":""},{"old":"/api/v1/integrations/google-classroom/courses/:courseId/coursework","type":0,"val":"courses","end":""},{"old":"/api/v1/integrations/google-classroom/courses/:courseId/coursework","type":1,"val":"courseId","end":""},{"old":"/api/v1/integrations/google-classroom/courses/:courseId/coursework","type":0,"val":"coursework","end":""}],
    types: placeholder as Registry['listGoogleClassroomCourseWork']['types'],
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
  'updateCatalogReward': {
    methods: ["PATCH"],
    pattern: '/api/v1/rewards/catalog/:id',
    tokens: [{"old":"/api/v1/rewards/catalog/:id","type":0,"val":"api","end":""},{"old":"/api/v1/rewards/catalog/:id","type":0,"val":"v1","end":""},{"old":"/api/v1/rewards/catalog/:id","type":0,"val":"rewards","end":""},{"old":"/api/v1/rewards/catalog/:id","type":0,"val":"catalog","end":""},{"old":"/api/v1/rewards/catalog/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['updateCatalogReward']['types'],
  },
  'listStudentLeaderboard': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/leaderboard/students',
    tokens: [{"old":"/api/v1/leaderboard/students","type":0,"val":"api","end":""},{"old":"/api/v1/leaderboard/students","type":0,"val":"v1","end":""},{"old":"/api/v1/leaderboard/students","type":0,"val":"leaderboard","end":""},{"old":"/api/v1/leaderboard/students","type":0,"val":"students","end":""}],
    types: placeholder as Registry['listStudentLeaderboard']['types'],
  },
  'listMyAchievements': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/achievements/me',
    tokens: [{"old":"/api/v1/achievements/me","type":0,"val":"api","end":""},{"old":"/api/v1/achievements/me","type":0,"val":"v1","end":""},{"old":"/api/v1/achievements/me","type":0,"val":"achievements","end":""},{"old":"/api/v1/achievements/me","type":0,"val":"me","end":""}],
    types: placeholder as Registry['listMyAchievements']['types'],
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
  'ngo_institutions.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/ngo-institutions',
    tokens: [{"old":"/api/v1/ngo-institutions","type":0,"val":"api","end":""},{"old":"/api/v1/ngo-institutions","type":0,"val":"v1","end":""},{"old":"/api/v1/ngo-institutions","type":0,"val":"ngo-institutions","end":""}],
    types: placeholder as Registry['ngo_institutions.index']['types'],
  },
  'ngo_institutions.store': {
    methods: ["POST"],
    pattern: '/api/v1/ngo-institutions',
    tokens: [{"old":"/api/v1/ngo-institutions","type":0,"val":"api","end":""},{"old":"/api/v1/ngo-institutions","type":0,"val":"v1","end":""},{"old":"/api/v1/ngo-institutions","type":0,"val":"ngo-institutions","end":""}],
    types: placeholder as Registry['ngo_institutions.store']['types'],
  },
  'ngo_institutions.update_status': {
    methods: ["PATCH"],
    pattern: '/api/v1/ngo-institutions/:id/status',
    tokens: [{"old":"/api/v1/ngo-institutions/:id/status","type":0,"val":"api","end":""},{"old":"/api/v1/ngo-institutions/:id/status","type":0,"val":"v1","end":""},{"old":"/api/v1/ngo-institutions/:id/status","type":0,"val":"ngo-institutions","end":""},{"old":"/api/v1/ngo-institutions/:id/status","type":1,"val":"id","end":""},{"old":"/api/v1/ngo-institutions/:id/status","type":0,"val":"status","end":""}],
    types: placeholder as Registry['ngo_institutions.update_status']['types'],
  },
  'ngo_institutions.bootstrap_ngo_admin': {
    methods: ["POST"],
    pattern: '/api/v1/ngo-institutions/:id/bootstrap-ngo-admin',
    tokens: [{"old":"/api/v1/ngo-institutions/:id/bootstrap-ngo-admin","type":0,"val":"api","end":""},{"old":"/api/v1/ngo-institutions/:id/bootstrap-ngo-admin","type":0,"val":"v1","end":""},{"old":"/api/v1/ngo-institutions/:id/bootstrap-ngo-admin","type":0,"val":"ngo-institutions","end":""},{"old":"/api/v1/ngo-institutions/:id/bootstrap-ngo-admin","type":1,"val":"id","end":""},{"old":"/api/v1/ngo-institutions/:id/bootstrap-ngo-admin","type":0,"val":"bootstrap-ngo-admin","end":""}],
    types: placeholder as Registry['ngo_institutions.bootstrap_ngo_admin']['types'],
  },
  'ngo_institutions.assign_user': {
    methods: ["PATCH"],
    pattern: '/api/v1/ngo-institutions/:id/assign-user',
    tokens: [{"old":"/api/v1/ngo-institutions/:id/assign-user","type":0,"val":"api","end":""},{"old":"/api/v1/ngo-institutions/:id/assign-user","type":0,"val":"v1","end":""},{"old":"/api/v1/ngo-institutions/:id/assign-user","type":0,"val":"ngo-institutions","end":""},{"old":"/api/v1/ngo-institutions/:id/assign-user","type":1,"val":"id","end":""},{"old":"/api/v1/ngo-institutions/:id/assign-user","type":0,"val":"assign-user","end":""}],
    types: placeholder as Registry['ngo_institutions.assign_user']['types'],
  },
  'dashboard.summary': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/dashboard/summary',
    tokens: [{"old":"/api/v1/dashboard/summary","type":0,"val":"api","end":""},{"old":"/api/v1/dashboard/summary","type":0,"val":"v1","end":""},{"old":"/api/v1/dashboard/summary","type":0,"val":"dashboard","end":""},{"old":"/api/v1/dashboard/summary","type":0,"val":"summary","end":""}],
    types: placeholder as Registry['dashboard.summary']['types'],
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
