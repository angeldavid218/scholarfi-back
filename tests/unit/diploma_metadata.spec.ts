import { DateTime } from 'luxon'
import { test } from '@japa/runner'
import StudentDiplomaMint from '#models/student_diploma_mint'
import { buildDiplomaMetadataJson } from '#services/cnft/cnft_diploma_service'
import { buildDiplomaSvg } from '#services/cnft/diploma_artwork'
import { MAX_CNFT_NAME_BYTES, truncateUtf8Bytes } from '#services/cnft/cnft_funciones'

test.group('Diploma metadata and artwork', () => {
  test('public metadata omits sensitive academic metrics', ({ assert }) => {
    const row = new StudentDiplomaMint()
    row.id = 42
    row.kind = 'outstanding_student'
    row.rank = 1
    row.points = 950
    row.displayName = 'María Rodríguez'
    row.createdAt = DateTime.fromISO('2026-08-18T12:00:00.000Z')

    const json = buildDiplomaMetadataJson(row, 'Colegio Saint Joseph')
    const serialized = JSON.stringify(json)

    assert.include(json.name, 'Excelencia Académica')
    assert.include(json.name, 'María Rodríguez')
    assert.equal(json.properties.achievement_type, 'excelencia_academica')
    assert.equal(json.properties.recognition_id, 'SF-ACH-000042')
    assert.notInclude(serialized, '950')
    assert.notInclude(serialized, 'Créditos')
    assert.notInclude(serialized, 'Puesto')
  })

  test('artwork svg includes student, institution, and ScholarFi footer', ({ assert }) => {
    const svg = buildDiplomaSvg({
      id: 7,
      kind: 'outstanding_student',
      displayName: 'María Rodríguez',
      institutionName: 'Colegio Saint Joseph',
      academicPeriod: '2025-2026',
      issuedAt: DateTime.fromISO('2026-08-18T12:00:00.000Z'),
    })

    assert.include(svg, 'María Rodríguez')
    assert.include(svg, 'Colegio Saint Joseph')
    assert.include(svg, 'EXCELENCIA ACADÉMICA')
    assert.include(svg, 'Verified by ScholarFi')
    assert.include(svg, 'SF-ACH-000007')
  })

  test('on-chain name is truncated to 32 UTF-8 bytes', ({ assert }) => {
    const raw = 'Excelencia Académica — Demo Student One'
    const truncated = truncateUtf8Bytes(raw, MAX_CNFT_NAME_BYTES)
    assert.isAtMost(new TextEncoder().encode(truncated).length, MAX_CNFT_NAME_BYTES)
    assert.isBelow(truncated.length, raw.length)
  })
})
