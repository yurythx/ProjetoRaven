"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { X } from "lucide-react"

interface ArticleContentProps {
  /** HTML já sanitizado no servidor */
  html: string
  className?: string
  style?: React.CSSProperties
}

export function ArticleContent({ html, className, style }: ArticleContentProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [lightboxAlt, setLightboxAlt] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  // Delegação de clique: qualquer <img> dentro do container abre o lightbox
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName !== "IMG") return
      const img = target as HTMLImageElement
      setLightboxSrc(img.src)
      setLightboxAlt(img.alt ?? "")
    }

    container.addEventListener("click", handleClick)
    return () => container.removeEventListener("click", handleClick)
  }, [html])

  const close = useCallback(() => setLightboxSrc(null), [])

  // Fecha com Escape
  useEffect(() => {
    if (!lightboxSrc) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lightboxSrc, close])

  // Bloqueia scroll do body enquanto lightbox está aberto
  useEffect(() => {
    document.body.style.overflow = lightboxSrc ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [lightboxSrc])

  return (
    <>
      <div
        ref={containerRef}
        className={className}
        style={style}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {lightboxSrc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Imagem ampliada"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={close}
        >
          {/* Botão fechar */}
          <button
            aria-label="Fechar imagem"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            onClick={close}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Imagem ampliada */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt={lightboxAlt}
            className="max-h-[90vh] max-w-[90vw] select-none rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
