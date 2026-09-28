/**
 * SANDBOX — botão "Filtros" (com contador) que abre um painel lateral (PontesDrawer) com status,
 * faixa de valor e período. Aplica de uma vez; o que ficou ativo vira tag (ver filtrosAvancadosCore).
 * A tela só DECLARA os filtros; a montagem é sempre igual.
 */

import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import {
  PontesButton, PontesDrawer, PontesField, PontesSelect, PontesDateInput, PontesInput,
} from "@/components/pontes"
import {
  type FiltroAvancado, filtroAtivo, numeroParaMasked, maskedParaNumero,
} from "./filtrosAvancadosCore"
import styles from "./DemoPadrao.module.css"

// Máscara de dinheiro pro input normal (dígitos → "1.234,56"), sem o campo grande de destaque.
const mascararDinheiro = (raw: string) => numeroParaMasked(maskedParaNumero(raw))

type Rascunho = Record<string, { value?: string; minMasked?: string; maxMasked?: string; de?: string; ate?: string }>

function rascunhoInicial(filtros: FiltroAvancado[]): Rascunho {
  const r: Rascunho = {}
  for (const f of filtros) {
    if (f.tipo === "select") r[f.id] = { value: f.value }
    else if (f.tipo === "faixaValor") r[f.id] = { minMasked: numeroParaMasked(f.min), maxMasked: numeroParaMasked(f.max) }
    else r[f.id] = { de: f.de ?? "", ate: f.ate ?? "" }
  }
  return r
}

export function PainelFiltros({ filtros }: { filtros: FiltroAvancado[] }) {
  const [aberto, setAberto] = useState(false)
  const [rasc, setRasc] = useState<Rascunho>({})
  const ativos = filtros.filter(filtroAtivo).length

  const abrir = () => { setRasc(rascunhoInicial(filtros)); setAberto(true) }
  const setR = (id: string, patch: Partial<Rascunho[string]>) => setRasc((r) => ({ ...r, [id]: { ...r[id], ...patch } }))

  const aplicar = () => {
    for (const f of filtros) {
      const d = rasc[f.id] ?? {}
      if (f.tipo === "select") f.onChange(d.value ?? (f.neutro ?? ""))
      else if (f.tipo === "faixaValor") f.onChange(maskedParaNumero(d.minMasked ?? ""), maskedParaNumero(d.maxMasked ?? ""))
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

  return (
    <>
      <PontesButton variant="outline" size="md" onClick={abrir} iconStart={<SlidersHorizontal size={15} strokeWidth={2.2} />}>
        Filtros{ativos > 0 ? ` (${ativos})` : ""}
      </PontesButton>
      <PontesDrawer
        open={aberto}
        side="right"
        width={360}
        title="Filtros"
        onClose={() => setAberto(false)}
        footer={
          <div className={styles.filtrosFooter}>
            <PontesButton variant="ghost" onClick={limpar}>Limpar tudo</PontesButton>
            <PontesButton variant="primary" onClick={aplicar}>Aplicar</PontesButton>
          </div>
        }
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
      </PontesDrawer>
    </>
  )
}
