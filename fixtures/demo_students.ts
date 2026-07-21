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

export const DEMO_STUDENT_PASSWORD = 'DemoPass123!'

export const DEMO_STUDENTS: DemoStudentFixture[] = [
  {
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

export const CLASSROOM_MOCK_STUDENT_GRADES = DEMO_STUDENTS.map((student) => ({
  email: student.email,
  assignedGrade: student.classroomAssignedGrade,
}))

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
