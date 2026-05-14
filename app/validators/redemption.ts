import vine from '@vinejs/vine'

export const createRedemptionValidator = vine.create({
  rewardId: vine.number().positive(),
})

export const rejectRedemptionValidator = vine.create({
  reason: vine.string().trim().maxLength(500).optional(),
})
