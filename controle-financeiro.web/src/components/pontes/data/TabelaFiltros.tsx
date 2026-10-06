/**
 * Botão "Filtros" (com contador) que abre um POPOVER ancorado logo abaixo do botão (não uma gaveta
 * lateral) com os filtros avançados da PontesTabela: select, faixa de valor e período. Aplica de uma
 * vez; o ativo vira tag. Portalizado (foge do overflow do cartão) e fecha ao clicar fora / Esc.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { SlidersHorizontal } from "lucide-react"
import { PontesButton } from "../buttons/Button"
import { PontesField } from "../form/Field"
import { PontesSelect } from "../form/Select"
import { PontesInput } from "../form/Input"
import { PontesDateInput } from "../form/DateInput"
import {
  type PontesFiltroAvancado, filtroAvancadoAtivo, numeroParaMascara, mascaraParaNumero, mascararDinheiro,
} from "./tabelaFiltrosCore"
import styles from "./Tabela.module.css"

type Rascunho = Record<string, { value?: string; minMasked?: string; maxMasked?: string; de?: string; ate?: string }>

function rascunhoInicial(filtros: PontesFiltroAvancado[]): Rascunho {
  const r: Rascunho = {}
  for (const f of filtros) {
    if (f.tipo === "select") r[f.id] = { value: f.value }
    else if (f.tipo === "faixaValor") r[f.id] = { minMasked: numeroParaMascara(f.min), maxMasked: numeroParaMascara(f.max) }
    else r[f.id] = { de: f.de ?? "", ate: f.ate ?? "" }
  }
  return r
}

export function PontesTabelaPainelFiltros({ filtros }: { filtros: PontesFiltroAvancado[] }) {
  const [aberto, setAberto] = useState(false)
  const [rasc, setRasc] = useState<Rascunho>({})
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const ativos = filtros.filter(filtroAvancadoAtivo).length

  const abrir = () => { if (!aberto) setRasc(rascunhoInicial(filtros)); setAberto((v) => !v) }
  const setR = (id: string, patch: Partial<Rascunho[string]>) => setRasc((r) => ({ ...r, [id]: { ...r[id], ...patch } }))

  const aplicar = () => {
    for (const f of filtros) {
      const d = rasc[f.id] ?? {}
      if (f.tipo === "select") f.onChange(d.value ?? (f.neutro ?? ""))
      else if (f.tipo === "faixaValor") f.onChange(mascaraParaNumero(d.minMasked ?? ""), mascaraParaNumero(d.maxMasked ?? ""))
      else f.onChange(d.de || undefined, d.ate || undefined)
    }
    setAberto(false)
  }
  const limpar = () => {
    for (const f of filtros) {
      if (f.tipo === "select") f.onChange(f.neutro ?? "")
      else f.onChange(undefined, undefined)
    }
    setAberto(false)
  }

  // Posiciona o popover abaixo do botão, alinhado à direita dele; reposiciona em scroll/resize.
  useLayoutEffect(() => {
    if (!aberto) return
    const place = () => {
      const r = wrapRef.current?.getBoundingClientRect()
      if (!r) return
      setCoords({ top: r.bottom + 8, left: r.right })
    }
    place()
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => { window.removeEventListener("scroll", place, true); window.removeEventListener("resize", place) }
  }, [aberto])

  // Fecha ao clicar fora — MAS ignora cliques nos popovers internos (select/datepicker), que são
  // portalizados pra fora do painel (senão escolher uma opção fecharia o filtro).
  useEffect(() => {
    if (!aberto) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Element | null
      if (!t) return
      if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return
      if (t.closest?.('[role="dialog"], [role="listbox"], [class*="menu"]')) return
      setAberto(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [aberto])

  // Esc fecha.
  useEffect(() => {
    if (!aberto) return
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setAberto(false) } }
    document.addEventListener("keydown", onKey, true)
    return () => document.removeEventListener("keydown", onKey, true)
  }, [aberto])

  return (
    <span ref={wrapRef} className={styles.filtrosWrap} data-ativo={ativos > 0 ? "true" : undefined}>
      <PontesButton variant="outline" size="sm" onClick={abrir} iconStart={<SlidersHorizontal size={15} strokeWidth={2.2} />}>
        Filtros{ativos > 0 ? ` (${ativos})` : ""}
      </PontesButton>
      {ativos > 0 && <span className={styles.filtrosDot} aria-hidden="true" />}
      {aberto && coords && createPortal(
        <div
          ref={panelRef}
          className={styles.filtrosPanel}
          role="dialog"
          aria-label="Filtros"
          style={{ position: "fixed", top: coords.top, left: coords.left, transform: "translateX(-100%)" }}
        >
          <div className={styles.filtrosCorpo}>
            {filtros.map((f) => {
              const d = rasc[f.id] ?? {}
              if (f.tipo === "select") {
                return (
                  <PontesField key={f.id} label={f.label}>
                    <PontesSelect value={d.value ?? (f.neutro ?? "")} onChange={(v) => setR(f.id, { value: v })} options={f.opcoes} />
                  </PontesField>
                )
              }
              if (f.tipo === "faixaValor") {
                return (
                  <PontesField key={f.id} label={f.label}>
                    <div className={styles.filtrosFaixa}>
                      <PontesInput iconStart="R$" inputMode="numeric" placeholder="0,00"
                        value={d.minMasked ?? ""} onChange={(e) => setR(f.id, { minMasked: mascararDinheiro(e.target.value) })} />
                      <span className={styles.filtrosAte}>até</span>
                      <PontesInput iconStart="R$" inputMode="numeric" placeholder="0,00"
                        value={d.maxMasked ?? ""} onChange={(e) => setR(f.id, { maxMasked: mascararDinheiro(e.target.value) })} />
                    </div>
                  </PontesField>
                )
              }
              return (
                <PontesField key={f.id} label={f.label}>
                  <div className={styles.filtrosFaixa}>
                    <PontesDateInput value={d.de ?? ""} onChange={(v) => setR(f.id, { de: v })} />
                    <span className={styles.filtrosAte}>até</span>
                    <PontesDateInput value={d.ate ?? ""} onChange={(v) => setR(f.id, { ate: v })} />
                  </div>
                </PontesField>
              )
            })}
          </div>
          <div className={styles.filtrosFooter}>
            <PontesButton variant="ghost" size="sm" onClick={limpar}>Limpar tudo</PontesButton>
            <PontesButton variant="primary" size="sm" onClick={aplicar}>Aplicar</PontesButton>
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
