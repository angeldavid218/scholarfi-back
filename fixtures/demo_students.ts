/**
 * Canonical demo students for seed data, Classroom mock grades, and CSV roster import.
 * Keep `demo_classroom_roster.csv` in sync when changing classroom pilot enrollments.
 */

export type DemoStudentGroupEnrollment = {
  subject: string
  section: string
  /** Display name for the class; required for Classroom-aligned groups */
  className?: string
  /** Included in demo_classroom_roster.csv */
  classroomPilot?: boolean
}

export type DemoStudentFixture = {
  email: string
  fullName: string
  registrationNumber: string
  /** Mock Classroom assignedGrade when GOOGLE_CLASSROOM_MOCK=true */
  classroomAssignedGrade: number | null
  /** Groups created and populated during demo:seed */
  seedGroups: DemoStudentGroupEnrollment[]
}

/** Roster-only mock student (not created by demo:seed) for Sync students create-path testing. */
export type ClassroomMockRosterOnlyStudent = {
  googleUserId: string
  email: string
  fullName: string
  /** Mock course ids this student appears on */
  courseIds: string[]
}

export const DEMO_STUDENT_PASSWORD = 'DemoPass123!'

export const DEMO_STUDENTS: DemoStudentFixture[] = [
  {
    // Grade ≥ minGrade: import + sync all 5 Matematicas coursework → first_5_activities milestone.
    email: 'demo.student1@scholarfi.test',
    fullName: 'Demo Student One',
    registrationNumber: 'MAT-001',
    classroomAssignedGrade: 8,
    seedGroups: [
      { subject: 'Matemáticas', section: '3°A' },
      { subject: 'Historia', section: '3°A' },
      {
        subject: 'Matematicas 3A',
        section: '3A',
        className: 'Matematicas 3A',
        classroomPilot: true,
      },
      {
        subject: 'Ciencias 3A',
        section: '3A',
        className: 'Ciencias 3A',
        classroomPilot: true,
      },
    ],
  },
  {
    email: 'demo.student2@scholarfi.test',
    fullName: 'Demo Student Two',
    registrationNumber: 'MAT-002',
    classroomAssignedGrade: 5,
    seedGroups: [
      { subject: 'Matemáticas', section: '3°A' },
      { subject: 'Historia', section: '3°A' },
      {
        subject: 'Matematicas 3A',
        section: '3A',
        className: 'Matematicas 3A',
        classroomPilot: true,
      },
      {
        subject: 'Ciencias 3A',
        section: '3A',
        className: 'Ciencias 3A',
        classroomPilot: true,
      },
    ],
  },
  {
    email: 'student-alpha@school.edu',
    fullName: 'Student Alpha',
    registrationNumber: 'MAT-ALPHA',
    classroomAssignedGrade: 8,
    seedGroups: [
      {
        subject: 'Matematicas 3A',
        section: '3A',
        className: 'Matematicas 3A',
        classroomPilot: true,
      },
      {
        subject: 'Ciencias 3A',
        section: '3A',
        className: 'Ciencias 3A',
        classroomPilot: true,
      },
    ],
  },
  {
    email: 'student-beta@school.edu',
    fullName: 'Student Beta',
    registrationNumber: 'MAT-BETA',
    classroomAssignedGrade: 5,
    seedGroups: [
      {
        subject: 'Matematicas 3A',
        section: '3A',
        className: 'Matematicas 3A',
        classroomPilot: true,
      },
      {
        subject: 'Ciencias 3A',
        section: '3A',
        className: 'Ciencias 3A',
        classroomPilot: true,
      },
    ],
  },
  {
    email: 'student-gamma@school.edu',
    fullName: 'Student Gamma',
    registrationNumber: 'MAT-GAMMA',
    classroomAssignedGrade: null,
    seedGroups: [
      {
        subject: 'Matematicas 3A',
        section: '3A',
        className: 'Matematicas 3A',
        classroomPilot: true,
      },
      {
        subject: 'Ciencias 3A',
        section: '3A',
        className: 'Ciencias 3A',
        classroomPilot: true,
      },
    ],
  },
]

/**
 * Extra Classroom roster members used only when GOOGLE_CLASSROOM_MOCK=true.
 * Not seeded by demo:seed so Sync students can exercise account creation.
 */
export const CLASSROOM_MOCK_ROSTER_ONLY_STUDENTS: ClassroomMockRosterOnlyStudent[] = [
  {
    googleUserId: 'gc-roster-delta',
    email: 'student-delta@school.edu',
    fullName: 'Student Delta',
    courseIds: ['gc-course-1', 'gc-course-2'],
  },
  {
    googleUserId: 'gc-roster-epsilon',
    email: 'student-epsilon@school.edu',
    fullName: 'Student Epsilon',
    courseIds: ['gc-course-1'],
  },
]

export const CLASSROOM_MOCK_STUDENT_GRADES = DEMO_STUDENTS.map((student) => ({
  email: student.email,
  assignedGrade: student.classroomAssignedGrade,
}))

export type ClassroomMockRosterMember = {
  googleUserId: string
  email: string
  fullName: string
}

const COURSE_ID_BY_CLASS_NAME: Record<string, string> = {
  'Matematicas 3A': 'gc-course-1',
  'Ciencias 3A': 'gc-course-2',
}

/** Stable mock Google user ids for demo students (used by roster sync fixtures). */
export function classroomMockGoogleUserIdForEmail(email: string): string {
  return `gc-user-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

/**
 * Mock Classroom roster for a course id when GOOGLE_CLASSROOM_MOCK=true.
 * Includes pilot DEMO_STUDENTS plus roster-only fixtures.
 */
export function listClassroomMockRosterForCourse(courseId: string): ClassroomMockRosterMember[] {
  const members: ClassroomMockRosterMember[] = []
  const seen = new Set<string>()

  for (const student of DEMO_STUDENTS) {
    const onCourse = student.seedGroups.some((group) => {
      if (!group.classroomPilot) return false
      const className = group.className ?? group.subject
      return COURSE_ID_BY_CLASS_NAME[className] === courseId
    })
    if (!onCourse) continue
    const email = student.email.trim().toLowerCase()
    if (seen.has(email)) continue
    seen.add(email)
    members.push({
      googleUserId: classroomMockGoogleUserIdForEmail(email),
      email,
      fullName: student.fullName,
    })
  }

  for (const student of CLASSROOM_MOCK_ROSTER_ONLY_STUDENTS) {
    if (!student.courseIds.includes(courseId)) continue
    const email = student.email.trim().toLowerCase()
    if (seen.has(email)) continue
    seen.add(email)
    members.push({
      googleUserId: student.googleUserId,
      email,
      fullName: student.fullName,
    })
  }

  return members
}

/** Rows for /teacher/clases CSV import aligned with mock Classroom courses. */
export function buildDemoClassroomRosterCsv(): string {
  const header = 'student_email,student_name,registration_number,subject,section,class_name'
  const rows: string[] = []

  for (const student of DEMO_STUDENTS) {
    for (const group of student.seedGroups) {
      if (!group.classroomPilot) continue
      const className = group.className ?? group.subject
      rows.push(
        `${student.email},${student.fullName},${student.registrationNumber},${group.subject},${group.section},${className}`
      )
    }
  }

  return [header, ...rows].join('\n')
}
