/**
 * Botão "Filtros" (com contador) que abre um painel lateral (PontesDrawer) com os filtros avançados
 * da PontesTabela: select, faixa de valor e período. Aplica de uma vez; o ativo vira tag.
 */

import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { PontesButton } from "../buttons/Button"
import { PontesDrawer } from "../feedback/Drawer"
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
  const ativos = filtros.filter(filtroAvancadoAtivo).length

  const abrir = () => { setRasc(rascunhoInicial(filtros)); setAberto(true) }
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
