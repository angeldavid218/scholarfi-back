import vine from '@vinejs/vine'

export const listClassroomCourseWorkValidator = vine.compile(
  vine.object({
    pageSize: vine
      .number()
      .optional()
      .transform((value) => {
        if (value === undefined) return value
        return Math.max(1, Math.min(50, value))
      }),
    pageToken: vine.string().trim().maxLength(512).optional(),
  })
)

export const createTaskFromClassroomValidator = vine.compile(
  vine.object({
    courseId: vine.string().trim().minLength(1).maxLength(255),
    courseWorkId: vine.string().trim().minLength(1).maxLength(255),
    courseName: vine.string().trim().minLength(2).maxLength(180),
    section: vine.string().trim().maxLength(60).optional(),
    title: vine.string().trim().minLength(2).maxLength(180),
    description: vine.string().trim().minLength(2).optional(),
    rewardAmount: vine.number().positive(),
    minGrade: vine.number().min(0),
    maxPoints: vine.number().positive().optional(),
    dueAt: vine.string().optional(),
  })
)
