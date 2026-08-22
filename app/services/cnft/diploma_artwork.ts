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
  return dtYearFallback()
}

function dtYearFallback(): string {
  return String(new Date().getFullYear())
}

export function buildRecognitionId(diplomaId: number): string {
  return `SF-ACH-${String(diplomaId).padStart(6, '0')}`
}

/** Personalized formal diploma SVG (NFT image + public preview). */
export function buildDiplomaSvg(input: DiplomaArtworkInput): string {
  const achievementKey = input.achievementType ?? achievementTypeForKind(input.kind)
  const achievement = DIPLOMA_ACHIEVEMENT_TYPES[achievementKey]
  const name = escapeXml(truncate(input.displayName, 48))
  const institution = escapeXml(truncate(input.institutionName, 56))
  const period = escapeXml(input.academicPeriod)
  const year = escapeXml(periodYearLabel(input.academicPeriod))
  const issueDate = escapeXml(formatIssueDate(input.issuedAt))
  const recognitionId = escapeXml(buildRecognitionId(input.id))
  const logo = logoUrl()
  const logoTag = logo
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
  ${logoTag}
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
