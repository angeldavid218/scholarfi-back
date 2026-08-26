import partnerDocsConfig from '#config/partner_docs'
import { renderMarkdown } from '#services/partner_docs/markdown_renderer'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

export type PartnerDocPage = {
  slug: string
  title: string
  filename: string
}

const PAGE_TITLES: Record<string, string> = {
  index: 'Overview',
  authentication: 'Authentication',
  'onboarding-flow': 'Onboarding flow',
  institutions: 'Institutions',
  users: 'Users',
  wallets: 'Wallets',
  'groups-and-roster': 'Groups and roster',
  'extended-capabilities': 'Extended capabilities',
  'errors-and-limits': 'Errors and limits',
}

function slugFromFilename(filename: string): string {
  return filename.replace(/\.md$/, '')
}

function titleFromSlug(slug: string, markdown: string): string {
  if (PAGE_TITLES[slug]) return PAGE_TITLES[slug]
  const heading = markdown.match(/^#\s+(.+)$/m)
  return heading?.[1] ?? slug
}

function isSafeSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug)
}

export async function listPartnerDocPages(): Promise<PartnerDocPage[]> {
  const entries = await readdir(partnerDocsConfig.contentRoot)
  const pages = entries
    .filter((entry) => entry.endsWith('.md'))
    .map((filename) => {
      const slug = slugFromFilename(filename)
      return {
        slug,
        title: PAGE_TITLES[slug] ?? slug,
        filename,
      }
    })
    .sort((a, b) => {
      if (a.slug === 'index') return -1
      if (b.slug === 'index') return 1
      return a.title.localeCompare(b.title)
    })

  return pages
}

export async function loadPartnerDocPage(slug: string): Promise<{
  slug: string
  title: string
  html: string
} | null> {
  if (!isSafeSlug(slug)) return null

  const filename = `${slug}.md`
  const filePath = join(partnerDocsConfig.contentRoot, filename)

  try {
    const markdown = await readFile(filePath, 'utf8')
    return {
      slug,
      title: titleFromSlug(slug, markdown),
      html: renderMarkdown(markdown),
    }
  } catch {
    return null
  }
}

export function renderPartnerDocsLayout(input: {
  title: string
  bodyHtml: string
  pages: PartnerDocPage[]
  activeSlug?: string
  showLogout?: boolean
  errorMessage?: string
}): string {
  const nav = input.pages
    .map((page) => {
      const href = page.slug === 'index' ? '/partner/docs' : `/partner/docs/${page.slug}`
      const active = page.slug === input.activeSlug ? ' class="active"' : ''
      return `<li><a href="${href}"${active}>${escapeHtml(page.title)}</a></li>`
    })
    .join('')

  const logout = input.showLogout
    ? `<form method="post" action="/partner/docs/logout" class="logout"><button type="submit">Log out</button></form>`
    : ''

  const error = input.errorMessage
    ? `<p class="error">${escapeHtml(input.errorMessage)}</p>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.title)} · ScholarFi Partner Docs</title>
  <style>
    :root { color-scheme: light; --bg: #f6f8fb; --panel: #fff; --text: #1f2937; --muted: #6b7280; --accent: #0f766e; --border: #dbe3ee; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: var(--bg); color: var(--text); }
    .shell { display: grid; grid-template-columns: 260px 1fr; min-height: 100vh; }
    aside { background: var(--panel); border-right: 1px solid var(--border); padding: 1.5rem; }
    aside h1 { font-size: 1.1rem; margin: 0 0 1rem; letter-spacing: 0.02em; }
    aside ul { list-style: none; padding: 0; margin: 0; }
    aside li + li { margin-top: 0.35rem; }
    aside a { color: var(--text); text-decoration: none; }
    aside a.active, aside a:hover { color: var(--accent); }
    main { padding: 2rem 2.5rem; max-width: 920px; }
    .logout { margin-top: 1.5rem; }
    .logout button { background: transparent; border: 1px solid var(--border); padding: 0.45rem 0.75rem; cursor: pointer; }
    .login-card { max-width: 420px; margin: 4rem auto; background: var(--panel); border: 1px solid var(--border); padding: 2rem; }
    .login-card label { display: block; margin-bottom: 0.35rem; font-size: 0.95rem; }
    .login-card input { width: 100%; padding: 0.65rem 0.75rem; margin-bottom: 1rem; border: 1px solid var(--border); }
    .login-card button { background: var(--accent); color: #fff; border: 0; padding: 0.7rem 1rem; cursor: pointer; width: 100%; }
    .error { color: #b91c1c; }
    pre { background: #0f172a; color: #e2e8f0; padding: 1rem; overflow: auto; border-radius: 6px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }
    p code, li code, td code { background: #eef2f7; padding: 0.1rem 0.35rem; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid var(--border); padding: 0.55rem 0.65rem; text-align: left; vertical-align: top; }
    th { background: #eef4ff; }
    @media (max-width: 860px) {
      .shell { grid-template-columns: 1fr; }
      aside { border-right: 0; border-bottom: 1px solid var(--border); }
    }
  </style>
</head>
<body>
  ${input.showLogout || input.activeSlug ? `<div class="shell"><aside><h1>Cloud Campus · ScholarFi</h1><ul>${nav}</ul>${logout}</aside><main>${error}${input.bodyHtml}</main></div>` : `<main>${error}${input.bodyHtml}</main>`}
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function renderLoginPage(errorMessage?: string): string {
  const error = errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : ''
  return renderPartnerDocsLayout({
    title: 'Login',
    bodyHtml: `<div class="login-card"><h2>Partner documentation</h2><p>Sign in to view the Cloud Campus integration guide.</p>${error}<form method="post" action="/partner/docs/login"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required><button type="submit">Sign in</button></form></div>`,
    pages: [],
  })
}
