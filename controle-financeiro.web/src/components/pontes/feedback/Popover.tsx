/**
 * Popover — menu dropdown por clique. Cor via var(--pontes-*); hover via :hover.
 * `p`/`font` override escopado opcional (#122).
 *
 * O menu é renderizado num PORTAL (document.body, position: fixed) posicionado a
 * partir do retângulo do trigger. Assim ele FLUTUA por cima de tudo e não conta no
 * scroll de nenhum ancestral (tabela/card/main) — evita clipping e scrollbar feia.
 *
 * Teclado: ao abrir, o foco vai pro 1º item (o menu mora no fim do <body>, então sem isso o Tab
 * nunca chegava nele); ↑/↓/Home/End navegam; Esc fecha e devolve o foco ao trigger; Tab fecha e
 * segue a ordem normal da página a partir do trigger; escolher um item também devolve o foco ao
 * trigger (a menos que a ação tenha focado outra coisa).
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties, type KeyboardEvent } from "react"
import { createPortal } from "react-dom"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./Popover.module.css"

export type PontesPopoverItem = {
  key: string
  icon?: ReactNode
  label: string
  danger?: boolean
  onClick?: () => void
  /** Insere divisor antes desse item. */
  divider?: boolean
}

export type PontesPopoverProps = {
  p?: Palette
  font?: string
  trigger: ReactNode
  /** Conteúdo fixo no topo do menu (ex.: nome + e-mail da conta), separado dos itens por um fio. */
  header?: ReactNode
  items: PontesPopoverItem[]
  minWidth?: number
  align?: "left" | "right"
  /** Direção de abertura. "up" abre acima do trigger; "side" abre ao lado direito, com a base
   *  alinhada à base do trigger (menu do avatar no rodapé do menu lateral). */
  direction?: "down" | "up" | "side"
  /** Trigger ocupa 100% da largura do pai. */
  fullWidth?: boolean
  /** Fecha quando o mouse sai do menu (menu de hover, além de clique-fora/Esc). */
  closeOnMouseLeave?: boolean
  /** Avisa quando abre/fecha — ex.: o trigger refletir `aria-expanded`. */
  onOpenChange?: (open: boolean) => void
}

// Devolve o foco pro controle focável do trigger (o botão ⋮, por exemplo).
function focarDentro(el: HTMLElement | null) {
  el?.querySelector<HTMLElement>("button, [href], [tabindex]")?.focus()
}

export function PontesPopover({
  p, font, trigger, header, items, minWidth = 200, align = "left", direction = "down", fullWidth = false, closeOnMouseLeave = false, onOpenChange,
}: PontesPopoverProps) {
  const [open, setOpen] = useState(false)
  const [porTeclado, setPorTeclado] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; width?: number } | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  // Foca o 1º item UMA vez por abertura (coords muda em scroll/resize e não pode roubar o foco).
  const focouAoAbrir = useRef(false)

  // Ref pro callback: avisar a tela não pode depender de ela memorizar a função.
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => { onOpenChangeRef.current = onOpenChange })
  // Avisa em qualquer caminho de abrir/fechar (clique, clique fora, Esc, Tab, item) — um lugar só.
  // Compara com o último valor avisado: não dispara na montagem (nem na remontagem do StrictMode).
  const ultimoAvisado = useRef(open)
  useEffect(() => {
    if (ultimoAvisado.current === open) return
    ultimoAvisado.current = open
    onOpenChangeRef.current?.(open)
  }, [open])

  // Posiciona o menu a partir do retângulo do trigger; reposiciona em scroll/resize.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const t = triggerRef.current
      if (!t) return
      const r = t.getBoundingClientRect()
      const lado = direction === "side"
      setCoords({
        top: lado ? r.bottom : direction === "up" ? r.top - 8 : r.bottom + 8,
        left: lado ? r.right + 10 : fullWidth || align === "left" ? r.left : r.right,
        width: fullWidth && !lado ? r.width : undefined,
      })
    }
    place()
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [open, direction, align, fullWidth])

  // Fecha ao clicar fora (considera o menu portalizado, que fica fora do wrap).
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (!wrapRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  // Esc fecha de qualquer lugar. Na fase de CAPTURA do document: se algum ancestral (ex.: a linha
  // clicável que embrulha o ⋮) parar a propagação do keydown, o Esc continua funcionando.
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.stopPropagation() // fecha só o menu — não o modal/drawer que estiver por baixo
      setOpen(false)
      focarDentro(triggerRef.current)
    }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [open])

  // Ao abrir: foco no 1º item (preventScroll: o menu é fixed, não pode rolar a página). O anel de foco
  // só acende quando abriu pelo teclado ou depois da 1ª tecla (data-teclado) — abrir com o mouse não
  // deixa o 1º item "marcado".
  useEffect(() => {
    if (!open) { focouAoAbrir.current = false; return }
    if (!coords || focouAoAbrir.current) return
    focouAoAbrir.current = true
    menuRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus({ preventScroll: true })
  }, [open, coords])

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    setPorTeclado(true)
    const botoes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? [])
    if (botoes.length === 0) return
    const atual = botoes.indexOf(document.activeElement as HTMLElement)
    const ir = (i: number) => { e.preventDefault(); botoes[(i + botoes.length) % botoes.length].focus() }
    if (e.key === "ArrowDown") ir(atual + 1)
    else if (e.key === "ArrowUp") ir(atual - 1)
    else if (e.key === "Home") ir(0)
    else if (e.key === "End") ir(botoes.length - 1)
    else if (e.key === "Tab") {
      // Menu mora no fim do <body>: devolve o foco ao trigger e deixa o Tab seguir dali.
      setOpen(false)
      focarDentro(triggerRef.current)
    }
  }

  // Item escolhido: roda a ação, fecha e devolve o foco ao trigger (padrão WAI-ARIA de menu button).
  // Sem isso o item focado desmontava e o foco caía no <body> — quem usa teclado voltava pro topo
  // da página. Só devolve se a ação NÃO levou o foco pra outro lugar (ex.: um campo que ela focou).
  const ativarItem = (it: PontesPopoverItem) => {
    it.onClick?.()
    setOpen(false)
    const ativo = document.activeElement
    if (!ativo || ativo === document.body || menuRef.current?.contains(ativo)) focarDentro(triggerRef.current)
  }

  const transform = [
    !fullWidth && align === "right" && direction !== "side" ? "translateX(-100%)" : "",
    direction === "up" || direction === "side" ? "translateY(-100%)" : "",
  ].join(" ").trim() || undefined

  return (
    <span ref={wrapRef} className={styles.wrap} data-fullwidth={fullWidth ? "true" : undefined} style={scopedThemeVars(p, font) as CSSProperties}>
      {/* e.detail === 0 → clique veio do teclado (Enter/Espaço); com o mouse é ≥ 1. */}
      <span ref={triggerRef} onClick={(e) => { setPorTeclado(e.detail === 0); setOpen(!open) }} className={styles.trigger}>{trigger}</span>
      {open && coords && createPortal(
        <div
          ref={menuRef}
          role="menu"
          data-teclado={porTeclado ? "true" : undefined}
          className={styles.menu}
          onKeyDown={onMenuKeyDown}
          onMouseLeave={closeOnMouseLeave ? () => setOpen(false) : undefined}
          style={{
            ...(scopedThemeVars(p, font) as CSSProperties),
            position: "fixed", top: coords.top, left: coords.left, right: "auto", bottom: "auto",
            transform, width: coords.width, minWidth: fullWidth && direction !== "side" ? undefined : minWidth,
          }}
        >
          {header && <div className={styles.header} role="none">{header}</div>}
          {items.map((it) => (
            <div key={it.key} role="none">
              {it.divider && <div className={styles.divider} role="separator" />}
              <button
                type="button"
                role="menuitem"
                onClick={() => ativarItem(it)}
                className={styles.item}
                data-danger={it.danger ? "true" : undefined}
              >
                {it.icon && <span aria-hidden>{it.icon}</span>}
                <span>{it.label}</span>
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </span>
  )
}
