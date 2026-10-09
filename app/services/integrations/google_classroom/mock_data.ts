import {
  CLASSROOM_MOCK_STUDENT_GRADES,
  listClassroomMockRosterForCourse,
} from '#fixtures/demo_students'
import type {
  GoogleClassroomCourse,
  GoogleClassroomCourseWork,
  GoogleClassroomStudentSubmission,
} from '#services/integrations/google_classroom/types'

export { CLASSROOM_MOCK_STUDENT_GRADES } from '#fixtures/demo_students'

export const MOCK_COURSES: GoogleClassroomCourse[] = [
  { id: 'gc-course-1', name: 'Matematicas 3A', section: '3A', courseState: 'ACTIVE' },
]

/** Two published items so import-all + sync-all can unlock the first-5 milestone without a heavy roster. */
export const MOCK_COURSEWORK: Record<string, GoogleClassroomCourseWork[]> = {
  'gc-course-1': [
    {
      id: 'gc-work-1',
      title: 'Ecuaciones lineales',
      description: 'Resolver ejercicios del capitulo 4',
      maxPoints: 10,
      state: 'PUBLISHED',
      dueDate: '2026-07-15',
      dueTime: null,
    },
    {
      id: 'gc-work-2',
      title: 'Repaso unidad 2',
      description: 'Actividad de repaso',
      maxPoints: 10,
      state: 'PUBLISHED',
      dueDate: null,
      dueTime: null,
    },
  ],
}

const MOCK_SUBMISSIONS: Record<string, GoogleClassroomStudentSubmission[]> = Object.fromEntries(
  ['gc-work-1', 'gc-work-2'].map((courseWorkId) => [
    courseWorkId,
    CLASSROOM_MOCK_STUDENT_GRADES.map((row, index) => ({
      id: `gc-sub-${courseWorkId}-${index}`,
      userId: row.email,
      state: 'TURNED_IN' as const,
      assignedGrade: row.assignedGrade,
      draftGrade: null,
      late: false,
    })),
  ])
)

export function mockCourseWorkForCourse(courseId: string): GoogleClassroomCourseWork[] {
  return MOCK_COURSEWORK[courseId] ?? []
}

export function mockSubmissionsForCourseWork(
  courseWorkId: string
): GoogleClassroomStudentSubmission[] {
  const specific = MOCK_SUBMISSIONS[courseWorkId]
  if (specific && specific.length > 0) {
    return specific
  }

  return CLASSROOM_MOCK_STUDENT_GRADES.map((row, index) => ({
    id: `gc-sub-fallback-${courseWorkId}-${index}`,
    userId: row.email,
    state: 'TURNED_IN',
    assignedGrade: row.assignedGrade,
    draftGrade: null,
    late: false,
  }))
}

export function mockSubmissionsUsedFallback(courseWorkId: string): boolean {
  return !MOCK_SUBMISSIONS[courseWorkId]?.length
}

export { listClassroomMockRosterForCourse }
