import BudgetAllocation from '#models/budget_allocation'
import Institution from '#models/institution'
import {
  createBudgetAllocationsValidator,
  updateBudgetAllocationValidator,
} from '#validators/budget_allocation'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { resolveOwnedProgram, sendScopeError } from '../utils/ngo_scope.ts'
import { parsePositiveInt } from '../utils/parse_positive.ts'

type AllocationRow = {
  id: number
  fundingProgramId: number
  institutionId: number
  institutionName: string
  institutionCode: string
  allocatedBudget: number
  utilizedBudget: number
  status: string
  createdAt: Date
  updatedAt: Date | null
}

function serializeAllocation(row: AllocationRow) {
  return {
    id: row.id,
    fundingProgramId: row.fundingProgramId,
    institutionId: row.institutionId,
    institutionName: row.institutionName,
    institutionCode: row.institutionCode,
    allocatedBudget: row.allocatedBudget,
    utilizedBudget: row.utilizedBudget,
    remainingBudget: row.allocatedBudget - row.utilizedBudget,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function splitBudgetEvenly(total: number, count: number): number[] {
  const base = Math.floor(total / count)
  const remainder = total % count
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0))
}

async function fetchAllocationRows(programId: number): Promise<AllocationRow[]> {
  const rows = await db
    .from('budget_allocations')
    .innerJoin('institutions', 'institutions.id', 'budget_allocations.institution_id')
    .where('budget_allocations.funding_program_id', programId)
    .select(
      'budget_allocations.id as id',
      'budget_allocations.funding_program_id as fundingProgramId',
      'budget_allocations.institution_id as institutionId',
      'institutions.name as institutionName',
      'institutions.code as institutionCode',
      'budget_allocations.allocated_budget as allocatedBudget',
      'budget_allocations.utilized_budget as utilizedBudget',
      'budget_allocations.status as status',
      'budget_allocations.created_at as createdAt',
      'budget_allocations.updated_at as updatedAt'
    )
    .orderBy('budget_allocations.id', 'desc')

  return rows as AllocationRow[]
}

async function sumExistingAllocated(programId: number): Promise<number> {
  const row = await db
    .from('budget_allocations')
    .where('funding_program_id', programId)
    .sum('allocated_budget as total')
    .first()
  return Number(row?.total ?? 0)
}

async function validateInstitutions(institutionIds: number[]) {
  const uniqueIds = [...new Set(institutionIds)]
  const institutions = await Institution.query().whereIn('id', uniqueIds)

  if (institutions.length !== uniqueIds.length) {
    return { ok: false as const, code: 'INSTITUTION_NOT_FOUND', message: 'One or more schools not found' }
  }

  const inactive = institutions.find((institution) => institution.status !== 'active')
  if (inactive) {
    return {
      ok: false as const,
      code: 'INSTITUTION_INACTIVE',
      message: 'All schools must be active to receive budget allocations',
    }
  }

  return { ok: true as const, institutions }
}

export default class BudgetAllocationsController {
  async index({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const programId = parsePositiveInt(params.programId, -1)

    const owned = await resolveOwnedProgram(user, programId)
    if (!owned.ok) {
      return sendScopeError(response, owned, request.id())
    }

    const rows = await fetchAllocationRows(programId)
    const totalAllocated = rows.reduce((sum, row) => sum + row.allocatedBudget, 0)
    const totalUtilized = rows.reduce((sum, row) => sum + row.utilizedBudget, 0)

    return {
      data: rows.map(serializeAllocation),
      summary: {
        totalBudget: owned.program.totalBudget,
        totalAllocated,
        totalUtilized,
        remainingToAllocate: owned.program.totalBudget - totalAllocated,
      },
    }
  }

  async store({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const programId = parsePositiveInt(params.programId, -1)
    const payload = await request.validateUsing(createBudgetAllocationsValidator)

    const owned = await resolveOwnedProgram(user, programId)
    if (!owned.ok) {
      return sendScopeError(response, owned, request.id())
    }

    if (owned.program.status === 'completed') {
      return response.conflict({
        error: {
          code: 'FUNDING_PROGRAM_COMPLETED',
          message: 'Completed funding programs cannot receive new allocations',
          requestId: request.id(),
        },
      })
    }

    const existingAllocated = await sumExistingAllocated(programId)
    const remainingBudget = owned.program.totalBudget - existingAllocated

    if (remainingBudget <= 0) {
      return response.unprocessableEntity({
        error: {
          code: 'BUDGET_EXCEEDS_PROGRAM_TOTAL',
          message: 'Program budget is fully allocated',
          requestId: request.id(),
        },
      })
    }

    let plannedAllocations: { institutionId: number; allocatedBudget: number }[] = []

    if (owned.program.allocationType === 'equal') {
      if (!payload.institutionIds || payload.institutionIds.length === 0) {
        return response.unprocessableEntity({
          error: {
            code: 'INVALID_ALLOCATION_PAYLOAD',
            message: 'institutionIds is required for equal allocation programs',
            requestId: request.id(),
          },
        })
      }

      const institutionIds = [...new Set(payload.institutionIds)]
      const institutionCheck = await validateInstitutions(institutionIds)
      if (!institutionCheck.ok) {
        return response.unprocessableEntity({
          error: {
            code: institutionCheck.code,
            message: institutionCheck.message,
            requestId: request.id(),
          },
        })
      }

      const amounts = splitBudgetEvenly(remainingBudget, institutionIds.length)
      plannedAllocations = institutionIds.map((institutionId, index) => ({
        institutionId,
        allocatedBudget: amounts[index],
      }))
    } else {
      if (!payload.allocations || payload.allocations.length === 0) {
        return response.unprocessableEntity({
          error: {
            code: 'INVALID_ALLOCATION_PAYLOAD',
            message: 'allocations is required for manual allocation programs',
            requestId: request.id(),
          },
        })
      }

      const institutionIds = payload.allocations.map((item) => item.institutionId)
      if (institutionIds.length !== new Set(institutionIds).size) {
        return response.unprocessableEntity({
          error: {
            code: 'DUPLICATE_INSTITUTION',
            message: 'Each school can only be allocated once per program',
            requestId: request.id(),
          },
        })
      }

      const institutionCheck = await validateInstitutions(institutionIds)
      if (!institutionCheck.ok) {
        return response.unprocessableEntity({
          error: {
            code: institutionCheck.code,
            message: institutionCheck.message,
            requestId: request.id(),
          },
        })
      }

      plannedAllocations = payload.allocations.map((item) => ({
        institutionId: item.institutionId,
        allocatedBudget: item.allocatedBudget,
      }))
    }

    const newAllocatedTotal = plannedAllocations.reduce(
      (sum, item) => sum + item.allocatedBudget,
      0
    )

    if (existingAllocated + newAllocatedTotal > owned.program.totalBudget) {
      return response.unprocessableEntity({
        error: {
          code: 'BUDGET_EXCEEDS_PROGRAM_TOTAL',
          message: 'Total allocated budget cannot exceed program total budget',
          requestId: request.id(),
        },
      })
    }

    const existingRows = await db
      .from('budget_allocations')
      .where('funding_program_id', programId)
      .whereIn(
        'institution_id',
        plannedAllocations.map((item) => item.institutionId)
      )
      .select('institution_id')

    if (existingRows.length > 0) {
      return response.conflict({
        error: {
          code: 'ALLOCATION_ALREADY_EXISTS',
          message: 'One or more schools already have an allocation for this program',
          requestId: request.id(),
        },
      })
    }

    const created = await db.transaction(async (trx) => {
      const inserted = []
      for (const item of plannedAllocations) {
        const row = await BudgetAllocation.create(
          {
            fundingProgramId: programId,
            institutionId: item.institutionId,
            allocatedBudget: item.allocatedBudget,
            utilizedBudget: 0,
            status: 'active',
          },
          { client: trx }
        )
        inserted.push(row)
      }
      return inserted
    })

    const rows = await fetchAllocationRows(programId)
    const createdIds = new Set(created.map((row) => row.id))
    const serialized = rows
      .filter((row) => createdIds.has(row.id))
      .map(serializeAllocation)

    return { data: serialized }
  }

  async show({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const programId = parsePositiveInt(params.programId, -1)
    const allocationId = parsePositiveInt(params.id, -1)

    const owned = await resolveOwnedProgram(user, programId)
    if (!owned.ok) {
      return sendScopeError(response, owned, request.id())
    }

    const rows = await fetchAllocationRows(programId)
    const row = rows.find((item) => item.id === allocationId)
    if (!row) {
      return response.notFound({
        error: {
          code: 'BUDGET_ALLOCATION_NOT_FOUND',
          message: 'Budget allocation not found',
          requestId: request.id(),
        },
      })
    }

    return { data: serializeAllocation(row) }
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const programId = parsePositiveInt(params.programId, -1)
    const allocationId = parsePositiveInt(params.id, -1)
    const payload = await request.validateUsing(updateBudgetAllocationValidator)

    const owned = await resolveOwnedProgram(user, programId)
    if (!owned.ok) {
      return sendScopeError(response, owned, request.id())
    }

    const allocation = await BudgetAllocation.query()
      .where('id', allocationId)
      .where('fundingProgramId', programId)
      .first()

    if (!allocation) {
      return response.notFound({
        error: {
          code: 'BUDGET_ALLOCATION_NOT_FOUND',
          message: 'Budget allocation not found',
          requestId: request.id(),
        },
      })
    }

    if (allocation.status === 'closed') {
      return response.conflict({
        error: {
          code: 'BUDGET_ALLOCATION_CLOSED',
          message: 'Closed budget allocations cannot be edited',
          requestId: request.id(),
        },
      })
    }

    if (payload.allocatedBudget !== undefined && payload.allocatedBudget < allocation.utilizedBudget) {
      return response.unprocessableEntity({
        error: {
          code: 'ALLOCATED_BELOW_UTILIZED',
          message: 'allocatedBudget cannot be less than utilizedBudget',
          requestId: request.id(),
        },
      })
    }

    if (payload.allocatedBudget !== undefined) {
      const existingAllocated = await sumExistingAllocated(programId)
      const adjustedTotal =
        existingAllocated - allocation.allocatedBudget + payload.allocatedBudget

      if (adjustedTotal > owned.program.totalBudget) {
        return response.unprocessableEntity({
          error: {
            code: 'BUDGET_EXCEEDS_PROGRAM_TOTAL',
            message: 'Total allocated budget cannot exceed program total budget',
            requestId: request.id(),
          },
        })
      }
    }

    allocation.merge({
      allocatedBudget: payload.allocatedBudget ?? allocation.allocatedBudget,
      status: payload.status ?? allocation.status,
    })
    await allocation.save()

    const rows = await fetchAllocationRows(programId)
    const row = rows.find((item) => item.id === allocationId)
    if (!row) {
      return response.notFound({
        error: {
          code: 'BUDGET_ALLOCATION_NOT_FOUND',
          message: 'Budget allocation not found',
          requestId: request.id(),
        },
      })
    }

    return { data: serializeAllocation(row) }
  }
}
