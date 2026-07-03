import vine from '@vinejs/vine'

const optionalMappedColumn = vine.string().trim().minLength(1).optional()

export const groupImportColumnMappingValidator = vine.create({
  student_email: optionalMappedColumn,
  student_name: optionalMappedColumn,
  subject: optionalMappedColumn,
  section: optionalMappedColumn,
  class_name: optionalMappedColumn,
})

export const createSubjectValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(120),
  code: vine.string().trim().minLength(1).maxLength(50).optional(),
})

export const createGroupValidator = vine.create({
  subjectId: vine.number().withoutDecimals().positive(),
  name: vine.string().trim().minLength(2).maxLength(180).optional(),
  section: vine.string().trim().minLength(1).maxLength(60).optional(),
  code: vine.string().trim().minLength(1).maxLength(50).optional(),
})

export const syncGroupMembersValidator = vine.create({
  userIds: vine.array(vine.number().positive()).minLength(1),
})
