import { parseCsvContent } from '#services/csv_parser_service'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'

test.group('CSV parser', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('parses headers with Spanish aliases', ({ assert }) => {
    const csv = [
      'email,nombre,materia,grupo',
      'student@school.edu,Ana,Matemáticas,3°A',
    ].join('\n')

    const parsed = parseCsvContent(csv)
    assert.deepEqual(parsed.headers, ['student_email', 'student_name', 'subject', 'section'])
    assert.equal(parsed.rows[0].student_email, 'student@school.edu')
    assert.equal(parsed.rows[0].subject, 'Matemáticas')
    assert.equal(parsed.rows[0].section, '3°A')
  })
})
