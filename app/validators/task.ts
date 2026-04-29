import vine from '@vinejs/vine'

export const createTaskValidator = vine.create({
  title: vine.string().trim().minLength(2).maxLength(180),
  description: vine.string().trim().minLength(2),
  rewardAmount: vine.number().positive(),
  dueAt: vine.string().optional(),
})

export const closeTaskValidator = vine.create({})

export const createSubmissionValidator = vine.create({
  taskId: vine.number().positive(),
  evidenceText: vine.string().trim().minLength(2),
  evidenceUrl: vine.string().trim().url().optional(),
})

export const validateSubmissionActionValidator = vine.create({
  action: vine.enum(['validate', 'reject'] as const),
  reason: vine.string().trim().minLength(2).optional(),
})

export const teacherRejectSubmissionValidator = vine.create({
  reason: vine.string().trim().minLength(2),
})

export const adminSubmissionDecisionValidator = vine.create({
  decision: vine.enum(['approve', 'reject'] as const),
  reason: vine.string().trim().minLength(2).optional(),
})
