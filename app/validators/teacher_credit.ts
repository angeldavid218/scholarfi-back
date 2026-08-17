import vine from '@vinejs/vine'

export const allocateTeacherCreditsValidator = vine.create({
  amount: vine.number().positive().max(10_000_000),
  notes: vine.string().trim().maxLength(500).optional(),
})

export const allocateEqualTeacherCreditsValidator = vine.create({
  totalAmount: vine.number().positive().max(10_000_000),
  notes: vine.string().trim().maxLength(500).optional(),
})
