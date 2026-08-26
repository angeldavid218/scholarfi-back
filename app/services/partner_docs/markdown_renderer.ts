function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderInline(text: string): string {
  let output = escapeHtml(text)
  output = output.replace(/`([^`]+)`/g, '<code>$1</code>')
  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    const url =
      href.startsWith('http://') || href.startsWith('https://') || href.startsWith('/')
        ? href
        : `/partner/docs/${href}`
    return `<a href="${url}">${label}</a>`
  })
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  return output
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (line.startsWith('```')) {
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
      index += 1
      continue
    }

    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)?.[0].length ?? 1
      const content = line.replace(/^#{1,6}\s/, '')
      html.push(`<h${level}>${renderInline(content)}</h${level}>`)
      index += 1
      continue
    }

    if (/^[-*]\s/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^[-*]\s/.test(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^[-*]\s/, ''))}</li>`)
        index += 1
      }
      html.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s/.test(lines[index])) {
        items.push(`<li>${renderInline(lines[index].replace(/^\d+\.\s/, ''))}</li>`)
        index += 1
      }
      html.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    if (line.trim() === '') {
      index += 1
      continue
    }

    if (line.startsWith('|')) {
      const tableLines: string[] = []
      while (index < lines.length && lines[index].startsWith('|')) {
        tableLines.push(lines[index])
        index += 1
      }
      const rows = tableLines.filter((row) => !/^\|[-:\s|]+\|$/.test(row))
      if (rows.length > 0) {
        const [header, ...body] = rows
        const headerCells = header
          .split('|')
          .slice(1, -1)
          .map((cell) => `<th>${renderInline(cell.trim())}</th>`)
          .join('')
        const bodyRows = body
          .map((row) => {
            const cells = row
              .split('|')
              .slice(1, -1)
              .map((cell) => `<td>${renderInline(cell.trim())}</td>`)
              .join('')
            return `<tr>${cells}</tr>`
          })
          .join('')
        html.push(`<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`)
      }
      continue
    }

    html.push(`<p>${renderInline(line)}</p>`)
    index += 1
  }

  return html.join('\n')
}
