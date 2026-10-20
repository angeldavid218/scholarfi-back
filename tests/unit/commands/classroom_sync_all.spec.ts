import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

async function createInstitution(): Promise<number> {
  const inserted = await db
    .table('institutions')
    .insert({
      name: `Test Inst ${Date.now()}`,
      code: `TST-${Date.now()}`,
      status: 'active',
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return inserted[0].id
}

async function createUser(institutionId: number, email: string): Promise<number> {
  const inserted = await db
    .table('users')
    .insert({
      email,
      password: 'hashed',
      full_name: 'Test Teacher',
      institution_id: institutionId,
      is_active: true,
      created_at: new Date(),
      updated_at: null,
    })
    .returning('id')
  return inserted[0].id
}

async function createTeacherIntegration(teacherId: number, institutionId: number) {
  await db.table('teacher_integrations').insert({
    teacher_id: teacherId,
    institution_id: institutionId,
    provider: 'google_classroom',
    external_user_id: `ext-${teacherId}`,
    external_email: `teacher${teacherId}@example.com`,
    scopes: 'classroom.courses.readonly',
    encrypted_refresh_token: 'encrypted',
    connected_at: new Date(),
    created_at: new Date(),
    updated_at: null,
  })
}

test.group('classroom:sync-all command', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('exits cleanly when lock is held', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const { tryAcquireGlobalLock } = await import('#services/cron/global_lock_service')
    const lock = await tryAcquireGlobalLock('classroom:sync-all')

    try {
      const result = await ace.exec('classroom:sync-all', [])
      assert.equal(result.exitCode, 0)
    } finally {
      await lock.release()
    }
  })

  test('processes connected teachers', async ({ assert }) => {
    if (env.get('DB_CONNECTION') !== 'pg') {
      return
    }

    const institutionId = await createInstitution()
    const teacherId = await createUser(institutionId, `teacher-sync-${Date.now()}@test.com`)
    await createTeacherIntegration(teacherId, institutionId)

    const result = await ace.exec('classroom:sync-all', [])
    assert.equal(result.exitCode, 0)
  }).timeout(10000)
})
