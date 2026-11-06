import type { DateTime } from 'luxon'
import env from '#start/env'
import {
  achievementTypeForKind,
  type DiplomaAchievementTypeKey,
  DIPLOMA_ACHIEVEMENT_TYPES,
} from '#services/cnft/diploma_achievement_types'

export type DiplomaArtworkInput = {
  id: number
  kind: string
  displayName: string
  institutionName: string
  academicPeriod: string
  issuedAt: DateTime
  achievementType?: DiplomaAchievementTypeKey
  /**
   * When set (pilot schools), renders a Yu-Gi-Oh–style trading card with this art
   * in the center window. Otherwise uses the formal diploma template.
   */
  baseImageUrl?: string | null
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function logoUrl(): string | null {
  const frontend = (env.get('FRONTEND_URL') as string | undefined)?.trim()?.replace(/\/$/, '')
  if (!frontend) return null
  return `${frontend}/scholarfi-logo-1.png`
}

function formatIssueDate(dt: DateTime): string {
  return dt.toFormat('dd/MM/yyyy')
}

function periodYearLabel(period: string): string {
  const match = period.match(/(\d{4})\s*[-–]\s*(\d{4})/)
  if (match) return match[2]
  const single = period.match(/(\d{4})/)
  if (single) return single[1]
  return String(new Date().getFullYear())
}

export function buildRecognitionId(diplomaId: number): string {
  return `SF-ACH-${String(diplomaId).padStart(6, '0')}`
}

function starLevelForAchievement(key: DiplomaAchievementTypeKey): number {
  switch (key) {
    case 'excelencia_academica':
      return 7
    case 'logro_extraordinario':
      return 6
    case 'progreso_academico':
      return 5
    case 'participacion_destacada':
      return 4
    case 'constancia_academica':
      return 4
    default:
      return 5
  }
}

function buildLevelStars(count: number, startX: number, y: number): string {
  const size = 28
  const gap = 34
  const total = Math.min(Math.max(count, 1), 8)
  const stars: string[] = []
  for (let i = 0; i < total; i++) {
    const cx = startX + i * gap
    stars.push(
      `<g transform="translate(${cx},${y})">` +
        `<circle r="${size / 2}" fill="#c41e3a" stroke="#8b0000" stroke-width="1.5"/>` +
        `<polygon points="0,-9 2.5,-2.8 9.2,-2.8 3.8,1.4 5.7,8.2 0,4.2 -5.7,8.2 -3.8,1.4 -9.2,-2.8 -2.5,-2.8" fill="#ffd700"/>` +
        `</g>`
    )
  }
  return stars.join('')
}

/**
 * Pilot trading-card artwork (Yu-Gi-Oh inspired). Portrait 700×980.
 */
export function buildPilotCardSvg(input: DiplomaArtworkInput & { baseImageUrl: string }): string {
  const achievementKey = input.achievementType ?? achievementTypeForKind(input.kind)
  const achievement = DIPLOMA_ACHIEVEMENT_TYPES[achievementKey]
  const title = escapeXml(truncate(input.displayName.toUpperCase(), 28))
  const achievementLabel = escapeXml(truncate(achievement.label.toUpperCase(), 32))
  const institution = escapeXml(truncate(input.institutionName, 40))
  const year = escapeXml(periodYearLabel(input.academicPeriod))
  const issueDate = escapeXml(formatIssueDate(input.issuedAt))
  const recognitionId = escapeXml(buildRecognitionId(input.id))
  const artUrl = escapeXml(input.baseImageUrl.trim())
  const level = starLevelForAchievement(achievementKey)
  const starsStartX = 350 - ((level - 1) * 34) / 2
  const typeLine = escapeXml(`[ESTUDIANTE / ${achievement.label.toUpperCase()}]`)
  const effectRaw = truncate(
    `${achievement.meritLine} en ${input.institutionName}. Período ${input.academicPeriod}.`,
    150
  )
  const effectLine1 = escapeXml(effectRaw.slice(0, 72).trim())
  const effectLine2 = escapeXml(effectRaw.slice(72).trim())
  const serial = String(input.id).padStart(8, '0')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="980" viewBox="0 0 700 980" role="img" aria-label="Credencial ScholarFi estilo carta">
  <defs>
    <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c4a574"/>
      <stop offset="45%" stop-color="#e8d5a8"/>
      <stop offset="100%" stop-color="#a67c4a"/>
    </linearGradient>
    <linearGradient id="nameplate" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f5edd8"/>
      <stop offset="100%" stop-color="#d4c4a0"/>
    </linearGradient>
    <linearGradient id="textbox" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f3e6c8"/>
      <stop offset="100%" stop-color="#e2d0a8"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="40%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.12"/>
    </linearGradient>
    <clipPath id="artClip">
      <rect x="78" y="168" width="544" height="420" rx="4"/>
    </clipPath>
  </defs>

  <!-- Outer glassy border -->
  <rect x="8" y="8" width="684" height="964" rx="18" fill="#1a1a1a" opacity="0.15"/>
  <rect x="16" y="16" width="668" height="948" rx="14" fill="url(#frame)" stroke="#5c4030" stroke-width="3"/>
  <rect x="28" y="28" width="644" height="924" rx="10" fill="url(#frame)" stroke="#8b6914" stroke-width="2"/>

  <!-- Name plate -->
  <rect x="48" y="48" width="520" height="56" rx="6" fill="url(#nameplate)" stroke="#5c4030" stroke-width="2"/>
  <text x="58" y="86" fill="#3d2b1f" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-weight="bold" letter-spacing="1">${title}</text>

  <!-- Attribute orb -->
  <circle cx="620" cy="76" r="30" fill="#1e3a8a" stroke="#f6e6a8" stroke-width="3"/>
  <text x="620" y="72" text-anchor="middle" fill="#f6e6a8" font-family="system-ui, sans-serif" font-size="11" font-weight="700">SF</text>
  <text x="620" y="88" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-size="10" font-weight="700">${year}</text>

  <!-- Level stars -->
  ${buildLevelStars(level, starsStartX, 132)}

  <!-- Artwork window -->
  <rect x="72" y="162" width="556" height="432" rx="6" fill="#2a2118" stroke="#5c4030" stroke-width="4"/>
  <rect x="78" y="168" width="544" height="420" rx="4" fill="#ffffff"/>
  <image href="${artUrl}" x="78" y="168" width="544" height="420" preserveAspectRatio="xMidYMid meet" clip-path="url(#artClip)"/>

  <!-- Achievement banner under art -->
  <rect x="72" y="602" width="556" height="36" rx="4" fill="#3d2b1f"/>
  <text x="350" y="626" text-anchor="middle" fill="#f6e6a8" font-family="Georgia, 'Times New Roman', serif" font-size="16" font-weight="bold" letter-spacing="2">${achievementLabel}</text>

  <!-- Effect / lore box -->
  <rect x="72" y="648" width="556" height="230" rx="6" fill="url(#textbox)" stroke="#5c4030" stroke-width="2"/>
  <text x="88" y="678" fill="#3d2b1f" font-family="Georgia, 'Times New Roman', serif" font-size="15" font-weight="bold">${typeLine}</text>
  <text x="88" y="708" fill="#3d2b1f" font-family="Georgia, 'Times New Roman', serif" font-size="14">${effectLine1}</text>
  ${effectLine2 ? `<text x="88" y="730" fill="#3d2b1f" font-family="Georgia, 'Times New Roman', serif" font-size="14">${effectLine2}</text>` : ''}
  <text x="88" y="810" fill="#5c4030" font-family="Georgia, 'Times New Roman', serif" font-size="13">${institution}</text>
  <text x="88" y="832" fill="#5c4030" font-family="Georgia, 'Times New Roman', serif" font-size="13">Emitido ${issueDate} · ${recognitionId}</text>
  <line x1="88" y1="848" x2="612" y2="848" stroke="#5c4030" stroke-width="1.5"/>
  <text x="600" y="872" text-anchor="end" fill="#3d2b1f" font-family="Georgia, 'Times New Roman', serif" font-size="18" font-weight="bold">MERIT/${level * 300}  LOGRO/${year}</text>

  <!-- Footer -->
  <text x="48" y="930" fill="#3d2b1f" font-family="system-ui, sans-serif" font-size="12">${serial}</text>
  <text x="520" y="930" fill="#5c4030" font-family="system-ui, sans-serif" font-size="11">© ScholarFi · Solana</text>
  <rect x="640" y="910" width="28" height="28" fill="#c4a574" stroke="#5c4030" stroke-width="1.5"/>
  <rect x="646" y="916" width="16" height="16" fill="url(#sheen)" stroke="#8b6914" stroke-width="1"/>

  <!-- Glass sheen overlay -->
  <rect x="28" y="28" width="644" height="924" rx="10" fill="url(#sheen)" pointer-events="none"/>
</svg>`
}

function buildFormalDiplomaSvg(input: DiplomaArtworkInput): string {
  const achievementKey = input.achievementType ?? achievementTypeForKind(input.kind)
  const achievement = DIPLOMA_ACHIEVEMENT_TYPES[achievementKey]
  const name = escapeXml(truncate(input.displayName, 48))
  const institution = escapeXml(truncate(input.institutionName, 56))
  const period = escapeXml(input.academicPeriod)
  const year = escapeXml(periodYearLabel(input.academicPeriod))
  const issueDate = escapeXml(formatIssueDate(input.issuedAt))
  const recognitionId = escapeXml(buildRecognitionId(input.id))
  const logo = logoUrl()
  const brandBlock = logo
    ? `<image href="${escapeXml(logo)}" x="500" y="56" width="200" height="52" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="600" y="92" text-anchor="middle" fill="#c9a227" font-family="Georgia, 'Times New Roman', serif" font-size="26" letter-spacing="6">SCHOLARFI</text>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img" aria-label="Reconocimiento académico ScholarFi">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0c2e31"/>
      <stop offset="55%" stop-color="#123a52"/>
      <stop offset="100%" stop-color="#0f2840"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#d4af37"/>
      <stop offset="50%" stop-color="#f6e6a8"/>
      <stop offset="100%" stop-color="#b8860b"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="800" fill="url(#bg)"/>
  <rect x="40" y="40" width="1120" height="720" fill="none" stroke="url(#gold)" stroke-width="6" rx="16"/>
  <rect x="64" y="64" width="1072" height="672" fill="none" stroke="#d4af37" stroke-width="1.5" rx="10" opacity="0.55"/>
  ${brandBlock}
  <text x="600" y="148" text-anchor="middle" fill="#e8dcc0" font-family="Georgia, 'Times New Roman', serif" font-size="18" letter-spacing="4">${escapeXml(achievement.headline)}</text>
  <text x="600" y="210" text-anchor="middle" fill="#ffffff" font-family="Georgia, 'Times New Roman', serif" font-size="42" font-weight="bold" letter-spacing="2">${escapeXml(achievement.label.toUpperCase())}</text>
  <text x="600" y="252" text-anchor="middle" fill="#d4af37" font-family="Georgia, 'Times New Roman', serif" font-size="28" letter-spacing="3">${year}</text>
  <text x="600" y="310" text-anchor="middle" fill="#cbd5e1" font-family="Georgia, 'Times New Roman', serif" font-size="18">Se otorga el presente reconocimiento a</text>
  <text x="600" y="378" text-anchor="middle" fill="#ffffff" font-family="Georgia, 'Times New Roman', serif" font-size="46" font-weight="bold">${name}</text>
  <text x="600" y="430" text-anchor="middle" fill="#cbd5e1" font-family="Georgia, 'Times New Roman', serif" font-size="17">${escapeXml(achievement.meritLine)}</text>
  <text x="600" y="458" text-anchor="middle" fill="#cbd5e1" font-family="Georgia, 'Times New Roman', serif" font-size="17">durante el período académico ${period}.</text>
  <text x="600" y="500" text-anchor="middle" fill="#94a3b8" font-family="Georgia, 'Times New Roman', serif" font-size="16" font-style="italic">${escapeXml(achievement.closingLine)}</text>
  <line x1="320" y1="540" x2="880" y2="540" stroke="#d4af37" stroke-width="1" opacity="0.45"/>
  <text x="600" y="582" text-anchor="middle" fill="#ffffff" font-family="Georgia, 'Times New Roman', serif" font-size="24" font-weight="600">${institution}</text>
  <text x="600" y="618" text-anchor="middle" fill="#94a3b8" font-family="Georgia, 'Times New Roman', serif" font-size="15">ScholarFi Academic Achievement</text>
  <text x="600" y="648" text-anchor="middle" fill="#94a3b8" font-family="Georgia, 'Times New Roman', serif" font-size="15">${issueDate}</text>
  <text x="600" y="718" text-anchor="middle" fill="#64748b" font-family="system-ui, sans-serif" font-size="13" letter-spacing="0.5">Verified by ScholarFi · Powered by Solana · ${recognitionId}</text>
</svg>`
}

/** Personalized diploma / pilot card SVG (NFT image + public preview). */
export function buildDiplomaSvg(input: DiplomaArtworkInput): string {
  const schoolBrand = input.baseImageUrl?.trim() || null
  if (schoolBrand) {
    return buildPilotCardSvg({ ...input, baseImageUrl: schoolBrand })
  }
  return buildFormalDiplomaSvg(input)
}
