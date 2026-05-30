/**
 * GroupedSelect — dropdown agrupado: grupo-cabeçalho (selecionável) + itens
 * indentados (selecionáveis). Genérico (ex: categoria → subcategoria).
 *
 * Não usa <select> nativo. O painel é in-flow (empurra o conteúdo, não absoluto)
 * com max-height + scroll — assim nunca vaza pra fora de um modal/popup.
 * Estilo via GroupedSelect.module.css + var(--pontes-*). `p`/`font` override opcional.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { ChevronDown, Check, Search } from "lucide-react"
import { scopedThemeVars, type Palette } from "../theme"
import styles from "./GroupedSelect.module.css"

// Normaliza p/ busca: minúsculas e sem acento (categoria "Alimentação" acha "alimenta").
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g")
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(DIACRITICS, "")

export type PontesGroupedItem<T extends string = string> = {
  value: T
  label: string
}

export type PontesGroupedOption<T extends string = string> = {
  value: T
  label: string
  items?: PontesGroupedItem<T>[]
}

export type PontesGroupedSelectProps<T extends string = string> = {
  p?: Palette
  font?: string
  groups: PontesGroupedOption<T>[]
  /** Valor do grupo selecionado ("" = nenhum). */
  groupValue: T | ""
  /** Valor do item selecionado ("" = só grupo, sem item). */
  itemValue: T | ""
  /** itemValue "" quando o usuário escolhe só o cabeçalho do grupo. */
  onChange: (groupValue: T, itemValue: T | "") => void
  placeholder?: string
  /** Texto quando não há grupos. */
  emptyLabel?: string
  invalid?: boolean
  /** Mostra campo de busca no topo do painel (default true). */
  searchable?: boolean
}

export function PontesGroupedSelect<T extends string = string>({
  p, font, groups, groupValue, itemValue, onChange,
  placeholder = "Selecione", emptyLabel = "Nenhuma opção", invalid, searchable = true,
}: PontesGroupedSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  // Foca a busca ao abrir; limpa o termo ao fechar.
  useEffect(() => {
    if (open) { searchRef.current?.focus() }
    else { setQuery("") }
  }, [open])

  // Filtra grupos+itens pelo termo. Grupo cujo NOME bate mostra todos os itens;
  // senão, mostra só os itens que batem (e some se nenhum bater).
  const visibleGroups = useMemo(() => {
    const q = norm(query.trim())
    if (!q) return groups
    return groups
      .map((g) => {
        if (norm(g.label).includes(q)) return g
        const items = (g.items ?? []).filter((it) => norm(it.label).includes(q))
        return items.length ? { ...g, items } : null
      })
      .filter((g): g is PontesGroupedOption<T> => g !== null)
  }, [groups, query])

  const selGroup = groups.find((g) => g.value === groupValue)
  const selItem = selGroup?.items?.find((i) => i.value === itemValue)
  const label = selItem ? `${selGroup?.label ?? ""} · ${selItem.label}` : selGroup?.label ?? ""

  const pick = (g: T, i: T | "") => { onChange(g, i); setOpen(false) }

  return (
    <div className={styles.wrap} ref={ref} style={scopedThemeVars(p, font) as CSSProperties}>
      <button
        type="button"
        className={styles.trigger}
        data-empty={!groupValue ? "true" : undefined}
        data-invalid={invalid ? "true" : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.triggerText}>{label || placeholder}</span>
        <span className={styles.chev} data-open={open ? "true" : undefined}><ChevronDown size={16} /></span>
      </button>

      {open && (
        <div className={styles.panel}>
          {searchable && groups.length > 0 && (
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input
                ref={searchRef}
                className={styles.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar categoria…"
              />
            </div>
          )}
          {groups.length === 0 ? (
            <div className={styles.empty}>{emptyLabel}</div>
          ) : visibleGroups.length === 0 ? (
            <div className={styles.empty}>Nada encontrado</div>
          ) : (
            visibleGroups.map((g) => (
              <div key={g.value}>
                <button
                  type="button"
                  className={styles.groupRow}
                  data-active={groupValue === g.value && !itemValue ? "true" : undefined}
                  onClick={() => pick(g.value, "")}
                >
                  <span className={styles.label}>{g.label}</span>
                  {groupValue === g.value && !itemValue && (
                    <span className={styles.check}><Check size={14} strokeWidth={2.5} /></span>
                  )}
                </button>
                {(g.items ?? []).map((it) => (
                  <button
                    key={it.value}
                    type="button"
                    className={styles.itemRow}
                    data-active={itemValue === it.value ? "true" : undefined}
                    onClick={() => pick(g.value, it.value)}
                  >
                    <span className={styles.label}>{it.label}</span>
                    {itemValue === it.value && (
                      <span className={styles.check}><Check size={14} strokeWidth={2.5} /></span>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
