/**
 * Popover ancorado no trigger de um campo (PontesDateInput, PontesMonthInput).
 *
 * Um lugar só pro comportamento comum dos campos com popover: vive num portal com `position: fixed`
 * (foge do overflow do modal), é clampado contra o boundary do modal/viewport (senão vaza pela
 * borda direita em campos perto dela — mesmo padrão do PontesSelect), abre pra cima quando falta
 * espaço embaixo, reposiciona em scroll/resize e fecha ao clicar fora ou no Esc (sem fechar junto o
 * modal em que o campo está).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react"

export type AnchoredPopoverPos = { left: number; top?: number; bottom?: number }

/**
 * `largura`/`altura` aproximadas do conteúdo do popover — só pra clampar a posição contra a borda;
 * não precisam ser exatas, só não subestimar.
 */
export function useAnchoredPopover(largura: number, altura: number) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<AnchoredPopoverPos | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!open) return
    const computePos = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const gap = 4
      const BUFFER = 12
      const boundary = el.closest<HTMLElement>("[data-pontes-overlay-boundary]")
      const b = boundary?.getBoundingClientRect()
      const topLimit = b?.top ?? 0
      const bottomLimit = b?.bottom ?? window.innerHeight
      const leftLimit = b?.left ?? 0
      const rightLimit = b?.right ?? window.innerWidth
      const spaceBelow = bottomLimit - r.bottom - BUFFER
      const spaceAbove = r.top - topLimit - BUFFER
      const up = spaceBelow < altura && spaceAbove > spaceBelow

      let left = r.left
      if (left + largura > rightLimit - BUFFER) left = rightLimit - BUFFER - largura
      if (left < leftLimit + BUFFER) left = leftLimit + BUFFER

      setPos(up
        ? { left, bottom: window.innerHeight - r.top + gap }
        : { left, top: r.bottom + gap })
    }
    computePos()
    window.addEventListener("resize", computePos)
    window.addEventListener("scroll", computePos, true)
    return () => {
      window.removeEventListener("resize", computePos)
      window.removeEventListener("scroll", computePos, true)
    }
  }, [open, largura, altura])

  // Fecha ao clicar fora (trigger E popover — o popover vive num portal, fora da árvore do wrap).
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (!wrapRef.current?.contains(t) && !popoverRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  // Esc com o popover aberto fecha SÓ o popover. O PontesModal também fecha no Esc (listener no
  // document); ouvindo no mesmo lugar, o mesmo Esc fechava o popover E o modal inteiro, com tudo o que
  // já tinha sido digitado no form. Por isso escuta na fase de CAPTURA do document (roda antes de
  // qualquer outro listener) e para a propagação: o popover é a camada de cima, ele consome o Esc.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      e.stopPropagation()
      // Foco dentro do popover (que vai sumir) volta pro campo — senão cai no <body>.
      const focoNoPopover = !!popoverRef.current?.contains(document.activeElement)
      setOpen(false)
      if (focoNoPopover) triggerRef.current?.focus()
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [open])

  return { open, setOpen, pos, wrapRef, triggerRef, popoverRef }
}
