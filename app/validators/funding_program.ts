import vine from '@vinejs/vine'

export const createFundingProgramValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(180),
  description: vine.string().trim().minLength(2),
  totalBudget: vine.number().positive(),
  allocationType: vine.enum(['equal', 'manual'] as const),
  startDate: vine.string(),
  endDate: vine.string(),
  status: vine.enum(['draft', 'active'] as const).optional(),
})

export const updateFundingProgramValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(180).optional(),
  description: vine.string().trim().minLength(2).optional(),
  totalBudget: vine.number().positive().optional(),
  allocationType: vine.enum(['equal', 'manual'] as const).optional(),
  startDate: vine.string().optional(),
  endDate: vine.string().optional(),
  status: vine.enum(['draft', 'active', 'completed'] as const).optional(),
})
