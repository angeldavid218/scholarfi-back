import FundingProgram from '#models/funding_program'
import Institution from '#models/institution'
import {
  createFundingProgramValidator,
  updateFundingProgramValidator,
} from '#validators/funding_program'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { resolveNgoScope, sendScopeError } from '../utils/ngo_scope.ts'
import { parsePositiveInt } from '../utils/parse_positive.ts'

function serializeProgram(program: FundingProgram) {
  return {
    id: program.id,
    ngoInstitutionId: program.ngoInstitutionId,
    name: program.name,
    description: program.description,
    totalBudget: program.totalBudget,
    allocationType: program.allocationType,
    startDate: program.startDate.toISODate(),
    endDate: program.endDate.toISODate(),
    status: program.status,
    createdAt: program.createdAt,
    updatedAt: program.updatedAt,
  }
}

function parseDateOnly(value: string): DateTime {
  return DateTime.fromISO(value, { zone: 'utc' })
}

function isValidDateRange(startDate: DateTime, endDate: DateTime): boolean {
  return endDate >= startDate
}

export default class FundingProgramsController {
  async availableInstitutions({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const scope = await resolveNgoScope(user)
    if (!scope.ok) {
      return sendScopeError(response, scope, request.id())
    }

    const institutions = await Institution.query()
      .where('status', 'active')
      .orderBy('name', 'asc')

    return {
      data: institutions.map((institution) => ({
        id: institution.id,
        name: institution.name,
        code: institution.code,
        status: institution.status,
      })),
    }
  }

  async store({ auth, request, response }: HttpContext) {
    const payload = await request.validateUsing(createFundingProgramValidator)
    const user = auth.getUserOrFail()

    const scope = await resolveNgoScope(user)
    if (!scope.ok) {
      return sendScopeError(response, scope, request.id())
    }

    const startDate = parseDateOnly(payload.startDate)
    const endDate = parseDateOnly(payload.endDate)
    if (!startDate.isValid || !endDate.isValid || !isValidDateRange(startDate, endDate)) {
      return response.unprocessableEntity({
        error: {
          code: 'INVALID_DATE_RANGE',
          message: 'endDate must be on or after startDate',
          requestId: request.id(),
        },
      })
    }

    const program = await FundingProgram.create({
      ngoInstitutionId: scope.ngo.id,
      name: payload.name,
      description: payload.description,
      totalBudget: payload.totalBudget,
      allocationType: payload.allocationType,
      startDate,
      endDate,
      status: payload.status ?? 'draft',
    })

    return { data: serializeProgram(program) }
  }

  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const scope = await resolveNgoScope(user)
    if (!scope.ok) {
      return sendScopeError(response, scope, request.id())
    }

    const programs = await FundingProgram.query()
      .where('ngoInstitutionId', scope.ngo.id)
      .orderBy('id', 'desc')

    return { data: programs.map(serializeProgram) }
  }

  async show({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const programId = parsePositiveInt(params.id, -1)

    const scope = await resolveNgoScope(user)
    if (!scope.ok) {
      return sendScopeError(response, scope, request.id())
    }

    const program = await FundingProgram.find(programId)
    if (!program || program.ngoInstitutionId !== scope.ngo.id) {
      return response.notFound({
        error: {
          code: 'FUNDING_PROGRAM_NOT_FOUND',
          message: 'Funding program not found',
          requestId: request.id(),
        },
      })
    }

    return { data: serializeProgram(program) }
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const programId = parsePositiveInt(params.id, -1)
    const payload = await request.validateUsing(updateFundingProgramValidator)

    const scope = await resolveNgoScope(user)
    if (!scope.ok) {
      return sendScopeError(response, scope, request.id())
    }

    const program = await FundingProgram.find(programId)
    if (!program || program.ngoInstitutionId !== scope.ngo.id) {
      return response.notFound({
        error: {
          code: 'FUNDING_PROGRAM_NOT_FOUND',
          message: 'Funding program not found',
          requestId: request.id(),
        },
      })
    }

    if (program.status === 'completed') {
      return response.conflict({
        error: {
          code: 'FUNDING_PROGRAM_COMPLETED',
          message: 'Completed funding programs cannot be edited',
          requestId: request.id(),
        },
      })
    }

    const startDate = payload.startDate ? parseDateOnly(payload.startDate) : program.startDate
    const endDate = payload.endDate ? parseDateOnly(payload.endDate) : program.endDate

    if (
      (payload.startDate && !startDate.isValid) ||
      (payload.endDate && !endDate.isValid) ||
      !isValidDateRange(startDate, endDate)
    ) {
      return response.unprocessableEntity({
        error: {
          code: 'INVALID_DATE_RANGE',
          message: 'endDate must be on or after startDate',
          requestId: request.id(),
        },
      })
    }

    program.merge({
      name: payload.name ?? program.name,
      description: payload.description ?? program.description,
      totalBudget: payload.totalBudget ?? program.totalBudget,
      allocationType: payload.allocationType ?? program.allocationType,
      startDate,
      endDate,
      status: payload.status ?? program.status,
    })
    await program.save()

    return { data: serializeProgram(program) }
  }
}
