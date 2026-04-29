import vine from '@vinejs/vine'

export const createInstitutionValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(180),
  code: vine.string().trim().minLength(2).maxLength(50),
})

export const updateInstitutionStatusValidator = vine.create({
  status: vine.enum(['active', 'inactive'] as const),
})

export const bootstrapSchoolAdminValidator = vine.create({
  fullName: vine.string().trim().minLength(2).maxLength(180),
  email: vine.string().trim().email().maxLength(254),
  password: vine.string().minLength(8).maxLength(32),
})

export const provisionInstitutionUserValidator = vine.create({
  fullName: vine.string().trim().minLength(2).maxLength(180),
  email: vine.string().trim().email().maxLength(254),
  password: vine.string().minLength(8).maxLength(32),
  role: vine.enum(['teacher', 'student'] as const),
})

export const assignInstitutionUserRoleValidator = vine.create({
  role: vine.enum(['teacher', 'student', 'school_admin'] as const),
})

export const upsertTeacherStudentAssociationValidator = vine.create({
  teacherId: vine.number().positive(),
  studentId: vine.number().positive(),
})
