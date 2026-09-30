/**
 * MOCKUP — /demo-conferencia. Desenho da tela de Conferência de caixa (saldo declarado × calculado,
 * multi-marco datável) com os marcos num CALENDÁRIO. Dados FALSOS (useState), zero backend — é só pro
 * Gustavo reagir ao design. Vira real depois. Spec: docs/features/conferencia-caixa/spec.md.
 */

import { useState } from "react"
import { Check, Plus, TriangleAlert, ChevronLeft, ChevronRight, Flag } from "lucide-react"
import { PontesButton, PontesField, PontesMoneyInput, PontesSelect } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import styles from "./DemoConferencia.module.css"

// ── Mock ────────────────────────────────────────────────────────────────────
const CONTAS = [
  { value: "nubank", label: "Nubank", saldoCalculado: 3480 },
  { value: "carteira", label: "Carteira", saldoCalculado: 150 },
]
type Marco = { dia: number; saldo: number; tipo: "bateu" | "ajuste" | "inicial"; ajuste?: number; hora: string }
// Marcos de Setembro/2026 (mock), por dia do mês.
const MARCOS: Marco[] = [
  { dia: 1, saldo: 5000, tipo: "inicial", hora: "00:00" },
  { dia: 15, saldo: 2900, tipo: "ajuste", ajuste: 12, hora: "09:00" },
  { dia: 28, saldo: 3480, tipo: "bateu", hora: "14:30" },
]
const HOJE = 30 // mock "hoje" = 30/09
const ULTIMO_MARCO_DIA = 28
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]

const parseMoney = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0

export default function DemoConferenciaPage() {
  const [contaId, setContaId] = useState(CONTAS[0].value)
  const conta = CONTAS.find((c) => c.value === contaId)!
  const [diaSel, setDiaSel] = useState<number>(HOJE)
  const [saldoReal, setSaldoReal] = useState("")
  const [resultado, setResultado] = useState<{ declarado: number; calculado: number; diferenca: number } | null>(null)

  // Calendário de Setembro/2026 (mock fixo). 01/09/2026 cai numa terça (getDay=2).
  const OFFSET = 2
  const DIAS_NO_MES = 30
  const celulas: (number | null)[] = [
    ...Array(OFFSET).fill(null),
    ...Array.from({ length: DIAS_NO_MES }, (_, i) => i + 1),
  ]
  const marcoDoDia = (d: number) => MARCOS.find((m) => m.dia === d)

  const conferir = () => {
    const declarado = parseMoney(saldoReal)
    setResultado({ declarado, calculado: conta.saldoCalculado, diferenca: declarado - conta.saldoCalculado })
  }
  const selecionarDia = (d: number) => { setDiaSel(d); setSaldoReal(""); setResultado(null) }
  const bate = resultado?.diferenca === 0

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.titulo}>Conferência de caixa</h1>
          <p className={styles.sub}>Confira se o saldo do app bate com o do banco. Cada conferência vira um marco — você só reconcilia do último marco pra frente.</p>
        </div>
        <div className={styles.contaSel}>
          <PontesField label="Conta">
            <PontesSelect value={contaId} onChange={(v) => { setContaId(v); setResultado(null) }} options={CONTAS.map((c) => ({ value: c.value, label: c.label }))} />
          </PontesField>
        </div>
      </div>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroBlob} />
        <div className={styles.heroMain}>
          <div className={styles.heroLabel}>Saldo em conta</div>
          <div className={styles.heroValor}>{formatMoney(conta.saldoCalculado)}</div>
        </div>
        <div className={styles.heroConfere}>
          <span className={styles.heroConfereIcone} aria-hidden><Check size={16} strokeWidth={3} /></span>
          <div>
            <div className={styles.heroConfereLabel}>Confere até</div>
            <div className={styles.heroConfereData}>28/09/2026 14:30</div>
          </div>
        </div>
      </div>

      {/* Duas colunas: calendário dos marcos (esquerda) + conferir o dia selecionado (direita) */}
      <div className={styles.cols}>
        <div className={styles.painel}>
          <div className={styles.calTopo}>
            <div className={styles.painelTitulo}><Flag size={16} strokeWidth={2.2} /> Marcos no calendário</div>
            <div className={styles.calNav}>
              <button type="button" className={styles.calNavBtn} aria-label="Mês anterior"><ChevronLeft size={16} strokeWidth={2.5} /></button>
              <span className={styles.calMes}>Setembro 2026</span>
              <button type="button" className={styles.calNavBtn} aria-label="Próximo mês"><ChevronRight size={16} strokeWidth={2.5} /></button>
            </div>
          </div>

          <div className={styles.calGrid}>
            {SEMANA.map((d) => <div key={d} className={styles.calWeekday}>{d}</div>)}
            {celulas.map((d, i) => {
              if (d === null) return <div key={`e${i}`} className={styles.calVazio} />
              const marco = marcoDoDia(d)
              const foraControle = d < 1 // (mock: nada fora neste mês)
              const posMarco = d > ULTIMO_MARCO_DIA && d <= HOJE // a conferir
              return (
                <button
                  key={d}
                  type="button"
                  className={styles.calDia}
                  data-marco={marco ? marco.tipo : undefined}
                  data-hoje={d === HOJE ? "true" : undefined}
                  data-sel={d === diaSel ? "true" : undefined}
                  data-pendente={posMarco ? "true" : undefined}
                  data-fora={foraControle ? "true" : undefined}
                  onClick={() => selecionarDia(d)}
                >
                  <span className={styles.calDiaNum}>{d}{marco && <Check size={11} strokeWidth={3.5} className={styles.calDiaCheck} />}</span>
                  {marco && <span className={styles.calDiaSaldo}>{formatMoney(marco.saldo)}</span>}
                </button>
              )
            })}
          </div>

          <div className={styles.calLegenda}>
            <span><span className={styles.legDot} data-t="bateu" /> conferido</span>
            <span><span className={styles.legDot} data-t="ajuste" /> ajuste</span>
            <span><span className={styles.legDot} data-t="pendente" /> a conferir</span>
          </div>
        </div>

        {/* Conferir o dia selecionado */}
        <div className={styles.painel}>
          <div className={styles.painelTitulo}>Conferir <strong className={styles.diaSelLabel}>{String(diaSel).padStart(2, "0")}/09/2026</strong></div>
          <p className={styles.painelSub}>Quanto você REALMENTE tinha nesta conta neste dia? Se bater, vira um marco.</p>

          <PontesField label="Saldo real da conta">
            <PontesMoneyInput value={saldoReal} onChange={setSaldoReal} suggestions={[]} />
          </PontesField>
          <PontesButton variant="primary" onClick={conferir} disabled={!saldoReal} fullWidth>Conferir este dia</PontesButton>

          {resultado && (
            <div className={styles.resultado} data-bate={bate ? "true" : "false"}>
              <div className={styles.resultLinha}><span>Calculado (app)</span><strong>{formatMoney(resultado.calculado)}</strong></div>
              <div className={styles.resultLinha}><span>Declarado (você)</span><strong>{formatMoney(resultado.declarado)}</strong></div>
              <div className={styles.resultLinha} data-destaque="true">
                <span>Diferença</span>
                <strong className={bate ? styles.difOk : styles.difNok}>{resultado.diferenca > 0 ? "+" : ""}{formatMoney(resultado.diferenca)}</strong>
              </div>
              {bate ? (
                <PontesButton variant="primary" size="sm" fullWidth iconStart={<Flag size={15} strokeWidth={2.5} />}>Gravar marco</PontesButton>
              ) : (
                <>
                  <div className={styles.resultAviso}><TriangleAlert size={15} strokeWidth={2.5} /> Faltou (ou sobrou) lançamento — do último marco (28/09) até aqui.</div>
                  <PontesButton variant="outline" size="sm" fullWidth>Lançar o que falta</PontesButton>
                  <PontesButton variant="primary" size="sm" fullWidth>Ajustar (cria lançamento de ajuste)</PontesButton>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.rodape}>
        <PontesButton variant="ghost" size="sm" iconStart={<Plus size={15} strokeWidth={2.5} />}>Conferir uma data mais antiga (novo marco pra trás)</PontesButton>
      </div>
    </div>
  )
}
