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
  // Timestamp de abertura — evita "ghost click" em mobile que fecha imediatamente
  const openedAtRef = useRef(0)

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
      setLightboxSrc(img.src)
      setLightboxAlt(img.alt ?? "")
    }

    container.addEventListener("click", handleClick)
    return () => container.removeEventListener("click", handleClick)
  }, [html])

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
      document.body.style.overflow = "hidden"
      document.body.style.touchAction = "none"
    } else {
      document.body.style.overflow = ""
      document.body.style.touchAction = ""
    }
    return () => {
      document.body.style.overflow = ""
      document.body.style.touchAction = ""
    }
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
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-4"
          style={{ touchAction: "none" }}
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
          />
        </div>
      )}
    </>
  )
}
