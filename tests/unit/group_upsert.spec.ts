import { buildGroupDisplayName } from '#services/group_upsert_service'
import { test } from '@japa/runner'

test.group('Group display names', () => {
  test('uses class_name when provided', ({ assert }) => {
    assert.equal(buildGroupDisplayName('Matematicas 3A', '3A', 'Matematicas 3A'), 'Matematicas 3A')
  })

  test('does not duplicate section when subject already includes it', ({ assert }) => {
    assert.equal(buildGroupDisplayName('Matematicas 3A', '3A', null), 'Matematicas 3A')
    assert.equal(buildGroupDisplayName('Ciencias 3A', '3A', null), 'Ciencias 3A')
  })

  test('appends section when subject does not include it', ({ assert }) => {
    assert.equal(buildGroupDisplayName('Matemáticas', '3°A', null), 'Matemáticas 3°A')
    assert.equal(buildGroupDisplayName('Historia', '3°A', null), 'Historia 3°A')
  })
})
