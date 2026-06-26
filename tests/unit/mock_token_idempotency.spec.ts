import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import MockTokenService from '#services/tokens/mock_token_service'

test.group('MockTokenService idempotency', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('mintTokens is idempotent per achievement id', async ({ assert }) => {
    const instInsert = await db
      .table('institutions')
      .insert({
        name: 'Unit Inst',
        code: `U-${Date.now()}`,
        status: 'active',
        created_by: null,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const instRow = instInsert[0] as any
    const institutionId = typeof instRow === 'number' ? instRow : instRow.id

    const teacherInsert = await db
      .table('users')
      .insert({
        email: `teacher-unit-${Date.now()}@example.com`,
        full_name: 'Unit Teacher',
        password: 'x',
        institution_id: institutionId,
        is_active: true,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const tRow = teacherInsert[0] as any
    const teacherId = typeof tRow === 'number' ? tRow : tRow.id

    const studentInsert = await db
      .table('users')
      .insert({
        email: `student-unit-${Date.now()}@example.com`,
        full_name: 'Unit Student',
        password: 'x',
        institution_id: institutionId,
        is_active: true,
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const sRow = studentInsert[0] as any
    const studentId = typeof sRow === 'number' ? sRow : sRow.id

    const taskInsert = await db
      .table('tasks')
      .insert({
        institution_id: institutionId,
        created_by_teacher_id: teacherId,
        title: 'Unit task',
        description: 'x',
        reward_amount: 10,
        due_at: null,
        status: 'active',
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const taskRow = taskInsert[0] as any
    const taskId = typeof taskRow === 'number' ? taskRow : taskRow.id

    const subInsert = await db
      .table('submissions')
      .insert({
        institution_id: institutionId,
        task_id: taskId,
        student_id: studentId,
        evidence_text: 'e',
        evidence_url: null,
        status: 'approved',
        submitted_at: new Date(),
        created_at: new Date(),
        updated_at: null,
      })
      .returning('id')
    const subRow = subInsert[0] as any
    const achievementId = typeof subRow === 'number' ? subRow : subRow.id

    const svc = new MockTokenService()
    await svc.createWallet(String(studentId))
    const first = await svc.mintTokens({
      userId: studentId,
      institutionId,
      amount: 10,
      achievementId,
    })
    assert.isFalse(first.idempotent ?? false)
    const second = await svc.mintTokens({
      userId: studentId,
      institutionId,
      amount: 10,
      achievementId,
    })
    assert.isTrue(second.idempotent ?? false)
    assert.equal(second.transactionId, first.transactionId)
    const bal = await db.from('token_balances').where('user_id', studentId).first()
    assert.equal(Number(bal.balance), 10)
  })
})
