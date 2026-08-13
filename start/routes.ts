/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('/', () => {
  return { hello: 'world' }
})

router
  .group(() => {
    router
      .group(() => {
        router.post('signup', [controllers.NewAccount, 'store'])
        router.post('login', [controllers.AccessToken, 'store'])
        router.post('logout', [controllers.AccessToken, 'destroy']).use(middleware.auth())
        router
          .post('register-student', [
            () => import('#controllers/student_registration_controller'),
            'store',
          ])
          .as('registerStudent')
      })
      .prefix('auth')
      .as('auth')

    router
      .group(() => {
        router
          .get('/', [() => import('#controllers/institutions_controller'), 'index'])
          .as('index')
          .use(middleware.role({ roles: ['super_admin'] }))
        router
          .post('/', [() => import('#controllers/institutions_controller'), 'store'])
          .as('store')
          .use(middleware.role({ roles: ['super_admin'] }))
        router
          .patch('/:id/status', [
            () => import('#controllers/institutions_controller'),
            'updateStatus',
          ])
          .as('updateStatus')
          .use(middleware.role({ roles: ['super_admin'] }))
        router
          .patch('/:id/crypto-wallets', [
            () => import('#controllers/institutions_controller'),
            'updateCryptoWallets',
          ])
          .as('updateCryptoWallets')
          .use(middleware.role({ roles: ['super_admin'] }))
        router
          .get('/:id/credit-pool', [
            () => import('#controllers/institution_credits_controller'),
            'show',
          ])
          .as('showInstitutionCreditPool')
          .use(middleware.role({ roles: ['super_admin'] }))
        router
          .post('/:id/credit-pool/allocate', [
            () => import('#controllers/institution_credits_controller'),
            'allocate',
          ])
          .as('allocateInstitutionCredits')
          .use(middleware.role({ roles: ['super_admin'] }))
        router
          .get('/credit-pool', [
            () => import('#controllers/institution_credits_controller'),
            'showMine',
          ])
          .as('showMyInstitutionCreditPool')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .get('/teacher-credit-pools', [
            () => import('#controllers/teacher_credits_controller'),
            'index',
          ])
          .as('listTeacherCreditPools')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .post('/teacher-credit-pools/allocate-equal', [
            () => import('#controllers/teacher_credits_controller'),
            'allocateEqual',
          ])
          .as('allocateEqualTeacherCredits')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .post('/teacher-credit-pools/:teacherId/allocate', [
            () => import('#controllers/teacher_credits_controller'),
            'allocateToTeacher',
          ])
          .as('allocateTeacherCredits')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .post('/:id/bootstrap-school-admin', [
            () => import('#controllers/institutions_controller'),
            'bootstrapSchoolAdmin',
          ])
          .as('bootstrapSchoolAdmin')
          .use(middleware.role({ roles: ['super_admin'] }))
        router
          .get('/users', [
            () => import('#controllers/institutions_controller'),
            'listInstitutionUsers',
          ])
          .as('listInstitutionUsers')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .post('/users', [() => import('#controllers/institutions_controller'), 'provisionUser'])
          .as('provisionUser')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .patch('/users/:userId/role', [
            () => import('#controllers/institutions_controller'),
            'assignUserRole',
          ])
          .as('assignUserRole')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .post('/teacher-students', [
            () => import('#controllers/institutions_controller'),
            'upsertTeacherStudentAssociation',
          ])
          .as('upsertTeacherStudentAssociation')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .get('/subjects', [() => import('#controllers/subjects_controller'), 'index'])
          .as('listInstitutionSubjects')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .post('/subjects', [() => import('#controllers/subjects_controller'), 'store'])
          .as('createInstitutionSubject')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .get('/groups', [() => import('#controllers/groups_controller'), 'indexForInstitution'])
          .as('listInstitutionGroups')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .post('/groups', [() => import('#controllers/groups_controller'), 'storeForInstitution'])
          .as('createInstitutionGroup')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .post('/groups/:id/teachers', [
            () => import('#controllers/groups_controller'),
            'syncTeachers',
          ])
          .as('syncInstitutionGroupTeachers')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .post('/groups/:id/students', [
            () => import('#controllers/groups_controller'),
            'syncStudents',
          ])
          .as('syncInstitutionGroupStudents')
          .use(middleware.role({ roles: ['school_admin'] }))
      })
      .prefix('institutions')
      .use(middleware.auth())

    router
      .group(() => {
        router
          .get('/mine', [() => import('#controllers/groups_controller'), 'mine'])
          .as('listMyGroups')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .post('/import-csv', [() => import('#controllers/groups_controller'), 'importCsv'])
          .as('importGroupsCsv')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .get('/import-runs', [() => import('#controllers/groups_controller'), 'listImportRuns'])
          .as('listGroupImportRuns')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .get('/import-runs/:id', [
            () => import('#controllers/groups_controller'),
            'showImportRun',
          ])
          .as('showGroupImportRun')
          .use(middleware.role({ roles: ['teacher'] }))
      })
      .prefix('groups')
      .use(middleware.auth())
      .use(middleware.tenantScope())

    router
      .group(() => {
        router
          .get('/credit-pool', [
            () => import('#controllers/teacher_credits_controller'),
            'showMine',
          ])
          .as('showMyTeacherCreditPool')
          .use(middleware.role({ roles: ['teacher'] }))
      })
      .prefix('teachers')
      .use(middleware.auth())
      .use(middleware.tenantScope())

    router
      .group(() => {
        router
          .get('/available', [() => import('#controllers/tasks_controller'), 'available'])
          .as('listStudentAvailableTasks')
          .use(middleware.role({ roles: ['student'] }))
        router
          .get('/summary', [() => import('#controllers/tasks_controller'), 'teacherSummary'])
          .as('teacherTasksSummary')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .get('/', [() => import('#controllers/tasks_controller'), 'index'])
          .as('listTeacherTasks')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .post('/', [() => import('#controllers/tasks_controller'), 'store'])
          .as('createTask')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .patch('/:id/close', [() => import('#controllers/tasks_controller'), 'close'])
          .as('closeTask')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .post('/from-classroom', [
            () => import('#controllers/google_classroom_controller'),
            'createTaskFromClassroom',
          ])
          .as('createTaskFromClassroom')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .post('/:id/sync-classroom', [
            () => import('#controllers/google_classroom_controller'),
            'syncTask',
          ])
          .as('syncClassroomTask')
          .use(middleware.role({ roles: ['teacher'] }))
      })
      .prefix('tasks')
      .use(middleware.auth())
      .use(middleware.tenantScope())

    router
      .group(() => {
        router
          .get('/:runId', [
            () => import('#controllers/google_classroom_controller'),
            'showSyncRun',
          ])
          .as('showClassroomSyncRun')
          .use(middleware.role({ roles: ['teacher'] }))
      })
      .prefix('classroom-sync-runs')
      .use(middleware.auth())
      .use(middleware.tenantScope())

    router
      .group(() => {
        router
          .get('/google-classroom/callback', [
            () => import('#controllers/google_classroom_controller'),
            'callback',
          ])
          .as('googleClassroomCallback')
      })
      .prefix('integrations')

    router
      .group(() => {
        router
          .post('/google-classroom/connect', [
            () => import('#controllers/google_classroom_controller'),
            'connect',
          ])
          .as('connectGoogleClassroom')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .get('/google-classroom/status', [
            () => import('#controllers/google_classroom_controller'),
            'status',
          ])
          .as('googleClassroomStatus')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .delete('/google-classroom/disconnect', [
            () => import('#controllers/google_classroom_controller'),
            'disconnect',
          ])
          .as('disconnectGoogleClassroom')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .get('/google-classroom/courses', [
            () => import('#controllers/google_classroom_controller'),
            'listCourses',
          ])
          .as('listGoogleClassroomCourses')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .get('/google-classroom/courses/:courseId/coursework', [
            () => import('#controllers/google_classroom_controller'),
            'listCourseWork',
          ])
          .as('listGoogleClassroomCourseWork')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .post('/google-classroom/sync-students', [
            () => import('#controllers/google_classroom_controller'),
            'syncStudents',
          ])
          .as('syncGoogleClassroomStudents')
          .use(middleware.role({ roles: ['teacher'] }))
      })
      .prefix('integrations')
      .use(middleware.auth())
      .use(middleware.tenantScope())

    router
      .group(() => {
        router
          .get('/', [() => import('#controllers/submissions_controller'), 'index'])
          .as('listStudentSubmissions')
          .use(middleware.role({ roles: ['student'] }))
        router
          .get('/teacher-queue', [
            () => import('#controllers/submissions_controller'),
            'teacherQueue',
          ])
          .as('teacherQueue')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .get('/admin-queue', [() => import('#controllers/submissions_controller'), 'adminQueue'])
          .as('adminQueue')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .get('/:id', [() => import('#controllers/submissions_controller'), 'show'])
          .as('showSubmission')
          .use(middleware.role({ roles: ['student'] }))
        router
          .post('/', [() => import('#controllers/submissions_controller'), 'store'])
          .as('createSubmission')
          .use(middleware.role({ roles: ['student'] }))
        router
          .patch('/:id/teacher-action', [
            () => import('#controllers/submissions_controller'),
            'teacherAction',
          ])
          .as('teacherActionSubmission')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .patch('/:id/teacher-reject', [
            () => import('#controllers/submissions_controller'),
            'teacherReject',
          ])
          .as('teacherRejectSubmission')
          .use(middleware.role({ roles: ['teacher'] }))
        router
          .patch('/:id/admin-decision', [
            () => import('#controllers/submissions_controller'),
            'adminDecision',
          ])
          .as('adminDecisionSubmission')
          .use(middleware.role({ roles: ['school_admin'] }))
      })
      .prefix('submissions')
      .use(middleware.auth())
      .use(middleware.tenantScope())

    router
      .group(() => {
        router
          .post('/post/:submissionId', [
            () => import('#controllers/rewards_controller'),
            'postForSubmission',
          ])
          .as('postRewardForSubmission')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .get('/balance', [() => import('#controllers/rewards_controller'), 'showStudentBalance'])
          .as('showStudentBalance')
          .use(middleware.role({ roles: ['student'] }))
        router
          .get('/history/summary', [
            () => import('#controllers/rewards_controller'),
            'historySummary',
          ])
          .as('rewardHistorySummary')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .get('/history', [
            () => import('#controllers/rewards_controller'),
            'listInstitutionHistory',
          ])
          .as('listInstitutionRewardHistory')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .get('/catalog', [() => import('#controllers/catalog_rewards_controller'), 'index'])
          .as('listCatalogRewards')
          .use(middleware.role({ roles: ['student', 'school_admin', 'teacher'] }))
        router
          .post('/catalog', [() => import('#controllers/catalog_rewards_controller'), 'store'])
          .as('createCatalogReward')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .patch('/catalog/:id', [() => import('#controllers/catalog_rewards_controller'), 'update'])
          .as('updateCatalogReward')
          .use(middleware.role({ roles: ['school_admin'] }))
      })
      .prefix('rewards')
      .use(middleware.auth())
      .use(middleware.tenantScope())

    router
      .group(() => {
        router
          .get('/students', [
            () => import('#controllers/leaderboard_controller'),
            'students',
          ])
          .as('listStudentLeaderboard')
          .use(middleware.role({ roles: ['student', 'teacher', 'school_admin'] }))
      })
      .prefix('leaderboard')
      .use(middleware.auth())
      .use(middleware.tenantScope())

    router
      .group(() => {
        router
          .get('/me', [() => import('#controllers/achievements_controller'), 'me'])
          .as('listMyAchievements')
          .use(middleware.role({ roles: ['student'] }))
      })
      .prefix('achievements')
      .use(middleware.auth())
      .use(middleware.tenantScope())

    router
      .group(() => {
        router
          .get('/:studentId/balance', [
            () => import('#controllers/students_controller'),
            'showBalance',
          ])
          .as('studentBalance')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .get('/:studentId/transactions', [
            () => import('#controllers/students_controller'),
            'listTransactions',
          ])
          .as('studentTransactions')
          .use(middleware.role({ roles: ['school_admin'] }))
      })
      .prefix('students')
      .use(middleware.auth())
      .use(middleware.tenantScope())

    router
      .group(() => {
        router
          .post('/', [() => import('#controllers/redemptions_controller'), 'store'])
          .as('createRedemption')
          .use(middleware.role({ roles: ['student'] }))
        router
          .get('/', [() => import('#controllers/redemptions_controller'), 'index'])
          .as('listRedemptions')
          .use(middleware.role({ roles: ['student', 'school_admin'] }))
        router
          .patch('/:id/approve', [() => import('#controllers/redemptions_controller'), 'approve'])
          .as('approveRedemption')
          .use(middleware.role({ roles: ['school_admin'] }))
        router
          .patch('/:id/reject', [() => import('#controllers/redemptions_controller'), 'reject'])
          .as('rejectRedemption')
          .use(middleware.role({ roles: ['school_admin'] }))
      })
      .prefix('redemptions')
      .use(middleware.auth())
      .use(middleware.tenantScope())

    router
      .get('/token/health', [() => import('#controllers/token_health_controller'), 'show'])
      .as('tokenHealth')
      .use(middleware.auth())
      .use(middleware.role({ roles: ['school_admin', 'super_admin'] }))

    router
      .group(() => {
        router
          .get('/profile', [controllers.Profile, 'show'])
          .use(middleware.role({ roles: ['super_admin', 'school_admin', 'teacher', 'student', 'ngo_admin'] }))
        router
          .patch('/password', [() => import('#controllers/profile_controller'), 'updatePassword'])
          .as('changePassword')
          .use(
            middleware.role({
              roles: ['super_admin', 'school_admin', 'teacher', 'student', 'ngo_admin'],
            })
          )
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())
      .use(middleware.tenantScope())

    router
      .group(() => {
        router
          .get('/', [() => import('#controllers/ngo_institutions_controller'), 'index'])
          .use(middleware.role({ roles: ['super_admin'] }))
        router
          .post('/', [() => import('#controllers/ngo_institutions_controller'), 'store'])
          .use(middleware.role({ roles: ['super_admin'] }))
        router
          .patch('/:id/status', [
            () => import('#controllers/ngo_institutions_controller'),
            'updateStatus',
          ])
          .use(middleware.role({ roles: ['super_admin'] }))
        router
          .post('/:id/bootstrap-ngo-admin', [
            () => import('#controllers/ngo_institutions_controller'),
            'bootstrapNgoAdmin',
          ])
          .use(middleware.role({ roles: ['super_admin'] }))
        router
          .patch('/:id/assign-user', [
            () => import('#controllers/ngo_institutions_controller'),
            'assignUser',
          ])
          .use(middleware.role({ roles: ['super_admin'] }))
      })
      .prefix('ngo-institutions')
      .use(middleware.auth())

    router
      .group(() => {
        router
          .get('/summary', [() => import('#controllers/dashboard_controller'), 'summary'])
          .use(middleware.role({ roles: ['ngo_admin'] }))
      })
      .prefix('dashboard')
      .use(middleware.auth())
  })
  .prefix('/api/v1')
