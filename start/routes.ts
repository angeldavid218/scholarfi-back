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
          .post('/:id/bootstrap-school-admin', [
            () => import('#controllers/institutions_controller'),
            'bootstrapSchoolAdmin',
          ])
          .as('bootstrapSchoolAdmin')
          .use(middleware.role({ roles: ['super_admin'] }))
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
      })
      .prefix('institutions')
      .use(middleware.auth())

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
      })
      .prefix('tasks')
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
      })
      .prefix('rewards')
      .use(middleware.auth())
      .use(middleware.tenantScope())

    router
      .group(() => {
        router
          .get('/profile', [controllers.Profile, 'show'])
          .use(middleware.role({ roles: ['super_admin', 'school_admin', 'teacher', 'student'] }))
      })
      .prefix('account')
      .as('profile')
      .use(middleware.auth())
      .use(middleware.tenantScope())
  })
  .prefix('/api/v1')
