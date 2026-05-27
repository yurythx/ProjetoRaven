function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export function parsePlainTextToHtml(text: string): string {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const blocks = normalized.split(/\n{2,}/)
    const html: string[] = []

    for (const block of blocks) {
        const raw = block.trim()
        if (!raw) continue
        const blockLines = raw.split('\n')

        // Setext h1 (underlined with ===)
        if (blockLines.length >= 2 && /^={3,}$/.test(blockLines[1].trim())) {
            html.push(`<h1>${escapeHtml(blockLines[0].trim())}</h1>`)
            continue
        }
        // Setext h2 (underlined with ---) — guard against bullet lists
        if (blockLines.length >= 2 && /^-{3,}$/.test(blockLines[1].trim()) && !/^[-*•]\s/.test(blockLines[0].trim())) {
            html.push(`<h2>${escapeHtml(blockLines[0].trim())}</h2>`)
            continue
        }
        // Code block (4-space or tab indent)
        if (blockLines.every(l => /^(?:    |\t)/.test(l))) {
            const code = blockLines.map(l => escapeHtml(l.replace(/^(?:    |\t)/, ''))).join('\n')
            html.push(`<pre><code>${code}</code></pre>`)
            continue
        }
        // Blockquote (> prefix)
        if (blockLines.every(l => /^>\s?/.test(l.trim()))) {
            const content = blockLines.map(l => escapeHtml(l.trim().replace(/^>\s?/, ''))).join('<br>')
            html.push(`<blockquote><p>${content}</p></blockquote>`)
            continue
        }
        // Pure bullet list
        if (blockLines.every(l => /^[-*•]\s/.test(l.trim()))) {
            const items = blockLines.map(l => `<li>${escapeHtml(l.trim().slice(2))}</li>`).join('')
            html.push(`<ul>${items}</ul>`)
            continue
        }
        // Pure ordered list
        if (blockLines.every(l => /^\d+[.)]\s/.test(l.trim()))) {
            const items = blockLines.map(l => `<li>${escapeHtml(l.trim().replace(/^\d+[.)]\s/, ''))}</li>`).join('')
            html.push(`<ol>${items}</ol>`)
            continue
        }
        // ATX headings (single-line blocks only)
        if (blockLines.length === 1) {
            const h3 = raw.match(/^###\s+(.+)$/)
            const h2 = raw.match(/^##\s+(.+)$/)
            const h1 = raw.match(/^#\s+(.+)$/)
            if (h3) { html.push(`<h3>${escapeHtml(h3[1])}</h3>`); continue }
            if (h2) { html.push(`<h2>${escapeHtml(h2[1])}</h2>`); continue }
            if (h1) { html.push(`<h1>${escapeHtml(h1[1])}</h1>`); continue }
        }
        // Regular paragraph — join soft-wrapped lines into a single block
        html.push(`<p>${escapeHtml(blockLines.map(l => l.trim()).filter(Boolean).join(' '))}</p>`)
    }

    return html.join('') || `<p>${escapeHtml(text.trim())}</p>`
}

export function cleanPastedHtml(html: string): string {
    return html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<o:[^>]*>[\s\S]*?<\/o:[^>]*>/gi, '')
        .replace(/(<[a-z][^>]*?)\s+class="Mso[A-Za-z]*[^"]*"/gi, '$1')
        .replace(/style="([^"]*)"/gi, (_, styles: string) => {
            const filtered = styles
                .split(';')
                .filter(s => s.trim() && !s.trim().toLowerCase().startsWith('mso-'))
                .join(';')
            return filtered.trim() ? `style="${filtered}"` : ''
        })
}
