import vine from '@vinejs/vine'

export const createBudgetAllocationsValidator = vine.create({
  institutionIds: vine.array(vine.number().positive()).minLength(1).optional(),
  allocations: vine
    .array(
      vine.object({
        institutionId: vine.number().positive(),
        allocatedBudget: vine.number().positive(),
      })
    )
    .minLength(1)
    .optional(),
})

export const updateBudgetAllocationValidator = vine.create({
  allocatedBudget: vine.number().positive().optional(),
  status: vine.enum(['active', 'suspended', 'closed'] as const).optional(),
})
