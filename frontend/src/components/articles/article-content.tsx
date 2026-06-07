"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { X } from "lucide-react"
import { slugify, stripHtml } from "@/lib/utils"

interface ArticleContentProps {
  /** HTML já sanitizado no servidor */
  html: string
  className?: string
}

export function ArticleContent({ html, className }: ArticleContentProps) {
  const [processedHtml, setProcessedHtml] = useState(html)
  const [toc, setToc] = useState<Array<{ id: string; text: string; level: 2 | 3 }>>([])
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [lightboxAlt, setLightboxAlt] = useState("")
  const [lightboxLoading, setLightboxLoading] = useState(false)
  const [lightboxError, setLightboxError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // Timestamp de abertura — evita "ghost click" em mobile que fecha imediatamente
  const openedAtRef = useRef(0)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const doc = new DOMParser().parseFromString(html, "text/html")

      const toYouTubeId = (href: string): string | null => {
        try {
          const u = new URL(href)
          const host = u.hostname.replace(/^www\./, "").toLowerCase()

          if (host === "youtu.be") {
            const id = u.pathname.split("/").filter(Boolean)[0] ?? ""
            return id ? id : null
          }

          if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "music.youtube.com") return null

          if (u.pathname === "/watch") {
            const id = u.searchParams.get("v") ?? ""
            return id ? id : null
          }

          const m = u.pathname.match(/^\/(shorts|embed)\/([^/?#]+)/i)
          if (m?.[2]) return m[2]

          return null
        } catch {
          return null
        }
      }

      const toVimeoId = (href: string): string | null => {
        try {
          const u = new URL(href)
          const host = u.hostname.replace(/^www\./, "").toLowerCase()
          if (host === "player.vimeo.com") {
            const m = u.pathname.match(/^\/video\/(\d+)/)
            return m?.[1] ?? null
          }
          if (host !== "vimeo.com") return null
          const id = u.pathname.split("/").filter(Boolean)[0] ?? ""
          return /^\d+$/.test(id) ? id : null
        } catch {
          return null
        }
      }

      const toLoomId = (href: string): string | null => {
        try {
          const u = new URL(href)
          const host = u.hostname.replace(/^www\./, "").toLowerCase()
          if (host !== "loom.com" && host !== "www.loom.com") return null
          const m = u.pathname.match(/^\/share\/([^/?#]+)/i)
          return m?.[1] ?? null
        } catch {
          return null
        }
      }

      const toDirectVideoUrl = (href: string): string | null => {
        try {
          const u = new URL(href)
          const ext = (u.pathname.split(".").pop() ?? "").toLowerCase()
          if (ext === "mp4" || ext === "webm" || ext === "ogg") return href
          return null
        } catch {
          return null
        }
      }

      const isOnlyLinkParagraph = (p: HTMLParagraphElement, a: HTMLAnchorElement, href: string): boolean => {
        const text = (p.textContent ?? "").trim()
        const linkText = (a.textContent ?? "").trim()
        if (!linkText) return false
        const isOnly =
          text === linkText ||
          text === href ||
          (linkText === href && text === href)
        return isOnly
      }

      const createIframe = (src: string, title: string) => {
        const wrap = doc.createElement("div")
        wrap.className = "rv-video-embed"
        const iframe = doc.createElement("iframe")
        iframe.setAttribute("src", src)
        iframe.setAttribute("title", title)
        iframe.setAttribute("loading", "lazy")
        iframe.setAttribute(
          "allow",
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        )
        iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin")
        iframe.setAttribute("allowfullscreen", "true")
        wrap.appendChild(iframe)
        return wrap
      }

      const createLinkCard = (href: string) => {
        let hostname = ""
        try {
          hostname = new URL(href).hostname.replace(/^www\./, "")
        } catch {}

        const wrap = doc.createElement("div")
        wrap.className = "rv-link-card"

        const a = doc.createElement("a")
        a.setAttribute("href", href)
        a.setAttribute("target", "_blank")
        a.setAttribute("rel", "noopener noreferrer")
        a.className = "rv-link-card__title"
        a.textContent = href

        const meta = doc.createElement("div")
        meta.className = "rv-link-card__meta"
        meta.textContent = hostname ? hostname : "Link"

        wrap.appendChild(a)
        wrap.appendChild(meta)
        return wrap
      }

      const replaceStandaloneLinks = () => {
        const paragraphs = Array.from(doc.querySelectorAll("p"))
        for (const p of paragraphs) {
          const anchors = Array.from(p.querySelectorAll("a[href]")) as HTMLAnchorElement[]
          if (anchors.length !== 1) continue
          const a = anchors[0]
          const href = (a.getAttribute("href") ?? "").trim()
          if (!href) continue
          if (!isOnlyLinkParagraph(p, a, href)) continue

          const yt = toYouTubeId(href)
          if (yt) {
            p.replaceWith(createIframe(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}`, "YouTube video player"))
            continue
          }

          const vimeo = toVimeoId(href)
          if (vimeo) {
            p.replaceWith(createIframe(`https://player.vimeo.com/video/${encodeURIComponent(vimeo)}`, "Vimeo video player"))
            continue
          }

          const loom = toLoomId(href)
          if (loom) {
            p.replaceWith(createIframe(`https://www.loom.com/embed/${encodeURIComponent(loom)}`, "Loom video"))
            continue
          }

          const directVideo = toDirectVideoUrl(href)
          if (directVideo) {
            const wrap = doc.createElement("div")
            wrap.className = "rv-video-embed"
            const video = doc.createElement("video")
            video.setAttribute("controls", "true")
            video.setAttribute("preload", "metadata")
            video.setAttribute("playsinline", "true")
            video.setAttribute("src", directVideo)
            wrap.appendChild(video)
            p.replaceWith(wrap)
            continue
          }

          p.replaceWith(createLinkCard(href))
        }
      }

      replaceStandaloneLinks()

      const headings = Array.from(doc.querySelectorAll("h2, h3"))
      const used = new Set<string>()
      const nextToc: Array<{ id: string; text: string; level: 2 | 3 }> = []

      for (const h of headings) {
        const level = h.tagName === "H2" ? 2 : 3
        const text = stripHtml(h.textContent ?? "").trim()
        if (!text) continue

        let id = (h.getAttribute("id") ?? "").trim()
        if (!id) id = slugify(text)
        if (!id) continue
        let candidate = id
        let i = 2
        while (used.has(candidate)) {
          candidate = `${id}-${i}`
          i += 1
        }
        used.add(candidate)
        h.setAttribute("id", candidate)
        nextToc.push({ id: candidate, text, level })
      }

      setProcessedHtml(doc.body.innerHTML)
      setToc(nextToc)
    } catch {
      setProcessedHtml(html)
      setToc([])
    }
  }, [html])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName !== "IMG") return
      e.preventDefault()
      e.stopPropagation()
      const img = target as HTMLImageElement
      openedAtRef.current = Date.now()
      setLightboxLoading(true)
      setLightboxError(null)
      setLightboxSrc(img.currentSrc || img.src)
      setLightboxAlt(img.alt ?? "")
    }

    container.addEventListener("click", handleClick)
    return () => container.removeEventListener("click", handleClick)
  }, [processedHtml])

  const close = useCallback(() => {
    // Ignora eventos de fechamento nos primeiros 250ms — previne ghost click mobile
    if (Date.now() - openedAtRef.current < 250) return
    setLightboxSrc(null)
  }, [])

  // Fecha com Escape
  useEffect(() => {
    if (!lightboxSrc) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxSrc(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lightboxSrc])

  // Bloqueia scroll do body enquanto lightbox está aberto
  useEffect(() => {
    if (lightboxSrc) {
      document.body.classList.add("rv-scroll-lock", "rv-touch-lock")
    } else {
      document.body.classList.remove("rv-scroll-lock", "rv-touch-lock")
    }
    return () => document.body.classList.remove("rv-scroll-lock", "rv-touch-lock")
  }, [lightboxSrc])

  return (
    <>
      {toc.length > 0 && (
        <nav className="mb-6 rounded-2xl border border-[var(--rv-border)] bg-[var(--rv-surface-2)] px-5 py-4">
          <div className="rv-label text-[9px] text-[var(--rv-text-dim)] mb-3">Sumário</div>
          <ul className="space-y-2">
            {toc.map((item) => (
              <li key={item.id} className={item.level === 3 ? "pl-3" : ""}>
                <a
                  href={`#${item.id}`}
                  className="text-sm text-[var(--rv-text-muted)] hover:text-[var(--rv-accent)] transition-colors"
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div
        ref={containerRef}
        className={className}
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />

      {lightboxSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Imagem ampliada"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 p-4 touch-none"
          onClick={close}
        >
          {/* Botão fechar — acessível e visível em mobile */}
          <button
            aria-label="Fechar imagem"
            className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30 active:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            onClick={(e) => { e.stopPropagation(); setLightboxSrc(null) }}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Imagem ampliada — usa dvh/dvw para correta altura em mobile */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt={lightboxAlt}
            className="max-h-[90dvh] max-w-[92dvw] select-none rounded-xl object-contain shadow-2xl"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            onLoad={() => setLightboxLoading(false)}
            onError={() => { setLightboxLoading(false); setLightboxError("Não foi possível carregar a imagem."); }}
            decoding="async"
          />

          {lightboxLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-10 w-10 rounded-full border-2 border-white/50 border-t-transparent animate-spin" aria-hidden="true" />
            </div>
          )}

          {lightboxError && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl bg-white/10 px-4 py-2 text-xs text-white">
              {lightboxError}
            </div>
          )}
        </div>
      )}
    </>
  )
}
