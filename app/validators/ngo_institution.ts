import vine from '@vinejs/vine'

export const createNgoInstitutionValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(255),
    code: vine.string().trim().minLength(2).maxLength(50),
    status: vine.boolean().optional(),
  })
)

export const updateNgoStatusValidator = vine.compile(
  vine.object({
    status: vine.boolean(),
  })
)

export const assignNgoUserValidator = vine.compile(
  vine.object({
    userId: vine.number().positive(),
  })
)

export const bootstrapNgoAdminValidator = vine.compile(
  vine.object({
    fullName: vine.string().trim().minLength(2).maxLength(180),
    email: vine.string().trim().email().maxLength(254),
    password: vine.string().minLength(8).maxLength(32),
  })
)
