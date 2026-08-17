import vine from '@vinejs/vine'

export const createCatalogRewardValidator = vine.create({
  title: vine.string().trim().minLength(1).maxLength(200),
  description: vine.string().trim().maxLength(2000).optional(),
  creditCost: vine.number().positive(),
})

export const updateCatalogRewardValidator = vine.create({
  title: vine.string().trim().minLength(1).maxLength(200).optional(),
  description: vine.string().trim().maxLength(2000).nullable().optional(),
  creditCost: vine.number().positive().optional(),
  isActive: vine.boolean().optional(),
})
