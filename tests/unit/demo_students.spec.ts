import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildDemoClassroomRosterCsv } from '#fixtures/demo_students'
import { test } from '@japa/runner'

test.group('Demo student fixtures', () => {
  test('demo_classroom_roster.csv matches fixture builder', ({ assert }) => {
    const csvPath = join(process.cwd(), 'fixtures/demo_classroom_roster.csv')
    const onDisk = readFileSync(csvPath, 'utf8').trim()
    const generated = buildDemoClassroomRosterCsv().trim()

    assert.equal(onDisk, generated)
  })
})
