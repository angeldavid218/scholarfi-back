/**
 * ScholarFi academic achievement categories for cNFT credentials.
 * MVP mint path (ranking #1) maps to excelencia_academica.
 */
export const DIPLOMA_ACHIEVEMENT_TYPES = {
  excelencia_academica: {
    key: 'excelencia_academica',
    label: 'Excelencia Académica',
    headline: 'RECONOCIMIENTO AL MÉRITO ACADÉMICO',
    meritLine:
      'por su destacado desempeño académico, demostrando constancia, dedicación y compromiso con su formación',
    closingLine: 'En reconocimiento a su esfuerzo y excelencia académica.',
    subtitle:
      'En reconocimiento a su destacado desempeño, constancia y compromiso académico.',
  },
  progreso_academico: {
    key: 'progreso_academico',
    label: 'Progreso Académico',
    headline: 'RECONOCIMIENTO AL MÉRITO ACADÉMICO',
    meritLine: 'por la mejora significativa de su desempeño académico durante el período',
    closingLine: 'En reconocimiento a su esfuerzo por superarse.',
    subtitle: 'En reconocimiento a su progreso académico sostenido.',
  },
  constancia_academica: {
    key: 'constancia_academica',
    label: 'Constancia Académica',
    headline: 'RECONOCIMIENTO AL MÉRITO ACADÉMICO',
    meritLine: 'por su rendimiento consistente y compromiso con su formación',
    closingLine: 'En reconocimiento a su constancia académica.',
    subtitle: 'En reconocimiento a su dedicación continua.',
  },
  merito_academico: {
    key: 'merito_academico',
    label: 'Mérito Académico',
    headline: 'RECONOCIMIENTO AL MÉRITO ACADÉMICO',
    meritLine: 'por el cumplimiento destacado de objetivos académicos',
    closingLine: 'En reconocimiento a su mérito académico.',
    subtitle: 'En reconocimiento al cumplimiento de sus metas académicas.',
  },
  participacion_destacada: {
    key: 'participacion_destacada',
    label: 'Participación Destacada',
    headline: 'RECONOCIMIENTO AL MÉRITO ACADÉMICO',
    meritLine: 'por su compromiso destacado con actividades y proyectos formativos',
    closingLine: 'En reconocimiento a su participación activa.',
    subtitle: 'En reconocimiento a su compromiso con la comunidad escolar.',
  },
  logro_extraordinario: {
    key: 'logro_extraordinario',
    label: 'Logro Extraordinario',
    headline: 'RECONOCIMIENTO AL MÉRITO ACADÉMICO',
    meritLine: 'por un logro extraordinario en proyecto, competencia o actividad específica',
    closingLine: 'En reconocimiento a un logro excepcional.',
    subtitle: 'En reconocimiento a un logro extraordinario verificable.',
  },
} as const

export type DiplomaAchievementTypeKey = keyof typeof DIPLOMA_ACHIEVEMENT_TYPES

/** Ranking #1 outstanding student → Excelencia Académica (MVP). */
export const OUTSTANDING_STUDENT_ACHIEVEMENT_TYPE: DiplomaAchievementTypeKey = 'excelencia_academica'

export function resolveAchievementType(kind: string): DiplomaAchievementTypeKey {
  if (kind in DIPLOMA_ACHIEVEMENT_TYPES) {
    return kind as DiplomaAchievementTypeKey
  }
  return OUTSTANDING_STUDENT_ACHIEVEMENT_TYPE
}

export function achievementTypeForKind(kind: string): DiplomaAchievementTypeKey {
  if (kind === 'outstanding_student') return OUTSTANDING_STUDENT_ACHIEVEMENT_TYPE
  return resolveAchievementType(kind)
}
