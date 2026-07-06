import vine from '@vinejs/vine'

export const allocateInstitutionCreditsValidator = vine.create({
  amount: vine.number().positive().max(10_000_000),
  notes: vine.string().trim().maxLength(500).optional(),
})
