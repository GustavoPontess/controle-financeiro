/**
 * Reconciliação — /reconciliacao. Ancora a confiança no saldo: "nesta conta, nesta data, o saldo
 * real era X". Calendário de marcos + painel de conferir (declarado × calculado → grava marco /
 * ajusta / lança). Dados REAIS do backend (reconciliacaoService). Spec: docs/features/reconciliacao.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useOutletContext, useNavigate } from "react-router-dom"
import { Check, TriangleAlert, ChevronLeft, ChevronRight, Flag, Trash2 } from "lucide-react"
import { PontesButton, PontesField, PontesMoneyInput, PontesSelect, PontesDialog } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import { combinarDataHora, horaLocalHHMM, dataLocalISO } from "@/utils/dateTime"
import { getContas } from "@/services/contaService"
import { listMarcos, getSaldoCalculado, criarMarco, removerMarco } from "@/services/reconciliacaoService"
import type { Conta } from "@/types/Conta"
import type { ReconciliacaoMarco } from "@/types/Reconciliacao"
import { TIPO_MARCO } from "@/types/Reconciliacao"
import styles from "./ReconciliacaoPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

const parseMoney = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0
const pad = (n: number) => String(n).padStart(2, "0")
// Marco guarda wall-clock como UTC (igual as transações) → ler em UTC pra bater com a tabela.
const fmtDataHora = (iso: string) => {
  const d = new Date(iso)
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export default function ReconciliacaoPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const navigate = useNavigate()

  const [contas, setContas] = useState<Conta[]>([])
  const [contaId, setContaId] = useState<string>("")
  const [marcos, setMarcos] = useState<ReconciliacaoMarco[]>([])
  const [mesRef, setMesRef] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [diaSel, setDiaSel] = useState<string | null>(null) // "YYYY-MM-DD"
  const [saldoReal, setSaldoReal] = useState("")
  const [calculado, setCalculado] = useState<number | null>(null)
  const [idemKey, setIdemKey] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState<ReconciliacaoMarco | null>(null)
  const [versao, setVersao] = useState(0)
  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  const conta = contas.find((c) => c.id === contaId)
  const saldoAtual = conta?.saldoAtual ?? 0

  useEffect(() => {
    let vivo = true
    getContas()
      .then((cs) => { if (vivo) { setContas(cs); setContaId((id) => id || cs[0]?.id || "") } })
      .catch(() => { if (vivo) notify({ open: true, message: "Erro ao carregar contas", severity: "error" }) })
    return () => { vivo = false }
  }, [versao, notify])

  useEffect(() => {
    if (!contaId) return
    let vivo = true
    listMarcos(contaId)
      .then((ms) => { if (vivo) setMarcos(ms) })
      .catch(() => { if (vivo) notify({ open: true, message: "Erro ao carregar marcos", severity: "error" }) })
    return () => { vivo = false }
  }, [contaId, versao, notify])

  const ultimoMarco = marcos[0] // vem ordenado desc do backend
  const proximoTipo = marcos.length === 0 ? TIPO_MARCO.Baseline : TIPO_MARCO.Verificacao

  // Marco por dia do mês exibido (o mais recente do dia).
  const marcoPorDia = useMemo(() => {
    const map = new Map<number, ReconciliacaoMarco>()
    for (const m of marcos) {
      const d = new Date(m.dataHora)
      if (d.getUTCFullYear() === mesRef.getFullYear() && d.getUTCMonth() === mesRef.getMonth())
        if (!map.has(d.getUTCDate())) map.set(d.getUTCDate(), m) // marcos desc → 1º é o mais recente
    }
    return map
  }, [marcos, mesRef])

  const ano = mesRef.getFullYear()
  const mes = mesRef.getMonth()
  const offset = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const celulas: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)]
  const hojeISO = dataLocalISO()

  const isoDoDia = (dia: number) => `${ano}-${pad(mes + 1)}-${pad(dia)}`

  // Trocar de mês limpa o dia selecionado — a seleção é de um dia específico daquele mês
  // (sem isso o painel casava o marco só pelo número do dia, ignorando o mês).
  const mudarMes = (delta: number) => {
    setMesRef(new Date(ano, mes + delta, 1))
    setDiaSel(null); setSaldoReal(""); setCalculado(null)
  }

  const selecionarDia = async (dia: number) => {
    const iso = isoDoDia(dia)
    setDiaSel(iso)
    setSaldoReal("")
    setCalculado(null)
    setIdemKey(crypto.randomUUID())
    // Marco desse dia já existe → não precisa calcular (mostra o marco). Senão, busca o calculado.
    if (marcoPorDia.has(dia)) return
    try {
      const dataHora = combinarDataHora(iso, iso === hojeISO ? horaLocalHHMM() : "23:59")
      setCalculado(await getSaldoCalculado(contaId, dataHora))
    } catch {
      notify({ open: true, message: "Erro ao calcular o saldo até esse dia", severity: "error" })
    }
  }

  const declarado = parseMoney(saldoReal)
  const diferenca = calculado != null ? declarado - calculado : 0
  const bate = calculado != null && Math.abs(diferenca) < 0.005
  const marcoDoDiaSel = diaSel ? marcoPorDia.get(Number(diaSel.slice(-2))) : undefined

  const gravar = async (resolucao?: "ajustar") => {
    if (!diaSel || calculado == null) return
    setSalvando(true)
    try {
      const dataHora = combinarDataHora(diaSel, diaSel === hojeISO ? horaLocalHHMM() : "23:59")
      await criarMarco({ contaId, dataHora, saldoDeclarado: declarado, tipo: proximoTipo, resolucao }, idemKey)
      notify({ open: true, message: bate ? "Marco gravado — saldo confere ✓" : "Marco gravado + ajuste lançado", severity: "success" })
      setDiaSel(null); setSaldoReal(""); setCalculado(null)
      recarregar()
    } catch {
      notify({ open: true, message: "Erro ao gravar o marco", severity: "error" })
    } finally { setSalvando(false) }
  }

  const handleRemover = async () => {
    if (!removendo) return
    try {
      await removerMarco(removendo.id)
      notify({ open: true, message: "Marco removido", severity: "success" })
      setDiaSel(null); recarregar()
    } catch {
      notify({ open: true, message: "Erro ao remover o marco", severity: "error" })
    } finally { setRemovendo(null) }
  }

  return (
    <div className={styles.wrap}>
      {/* Sem título de página — o header já mostra "Reconciliação". Começa no banner. */}
      <div className={styles.hero}>
        <div className={styles.heroBlob} />
        <div className={styles.heroMain}>
          <div className={styles.heroLabel}>Saldo em conta</div>
          <div className={styles.heroValor}>{formatMoney(saldoAtual)}</div>
        </div>
        <div className={styles.heroRight}>
          <div className={styles.heroConta}>
            <PontesSelect
              value={contaId}
              onChange={(v) => { setContaId(v); setDiaSel(null); setSaldoReal(""); setCalculado(null) }}
              options={contas.map((c) => ({ value: c.id, label: c.nome }))}
            />
          </div>
          <div className={styles.heroConfere}>
            <span className={styles.heroConfereIcone} aria-hidden><Check size={14} strokeWidth={3} /></span>
            <div>
              <div className={styles.heroConfereLabel}>Confere até</div>
              <div className={styles.heroConfereData}>{ultimoMarco ? fmtDataHora(ultimoMarco.dataHora) : "nenhuma conferência ainda"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.cols}>
        {/* Calendário dos marcos */}
        <div className={styles.painel}>
          <div className={styles.calTopo}>
            <div className={styles.painelTitulo}><Flag size={15} strokeWidth={2.2} /> Marcos no calendário</div>
            <div className={styles.calNav}>
              <button type="button" className={styles.calNavBtn} aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft size={15} strokeWidth={2.5} /></button>
              <span className={styles.calMes}>{MESES[mes]} {ano}</span>
              <button type="button" className={styles.calNavBtn} aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight size={15} strokeWidth={2.5} /></button>
            </div>
          </div>

          <div className={styles.calGrid}>
            {SEMANA.map((d) => <div key={d} className={styles.calWeekday}>{d}</div>)}
            {celulas.map((dia, i) => {
              if (dia === null) return <div key={`e${i}`} className={styles.calVazio} />
              const iso = isoDoDia(dia)
              const marco = marcoPorDia.get(dia)
              const tom = marco ? (marco.tipo === TIPO_MARCO.Baseline ? "inicial" : marco.temAjuste ? "ajuste" : "bateu") : undefined
              // "a conferir": depois do último marco até hoje.
              const pendente = !marco && ultimoMarco != null && iso > ultimoMarco.dataHora.slice(0, 10) && iso <= hojeISO
              return (
                <button
                  key={dia}
                  type="button"
                  className={styles.calDia}
                  data-marco={tom}
                  data-hoje={iso === hojeISO ? "true" : undefined}
                  data-sel={iso === diaSel ? "true" : undefined}
                  data-pendente={pendente ? "true" : undefined}
                  onClick={() => selecionarDia(dia)}
                >
                  <span className={styles.calDiaNum}>{dia}{marco && <Check size={10} strokeWidth={3.5} className={styles.calDiaCheck} />}</span>
                  {marco && <span className={styles.calDiaSaldo}>{formatMoney(marco.saldoDeclarado)}</span>}
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

        {/* Painel do dia selecionado */}
        <div className={styles.painel}>
          {!diaSel && <p className={styles.painelSub}>Escolha um dia no calendário pra conferir o saldo daquele dia.</p>}

          {diaSel && marcoDoDiaSel && (
            <>
              <div className={styles.painelTitulo}>Marco de <strong className={styles.diaSelLabel}>{diaSel.split("-").reverse().join("/")}</strong></div>
              <div className={styles.resultado} data-bate={marcoDoDiaSel.diferenca === 0 ? "true" : "false"}>
                <div className={styles.resultLinha}><span>Calculado (app)</span><strong>{formatMoney(marcoDoDiaSel.saldoCalculado)}</strong></div>
                <div className={styles.resultLinha}><span>Declarado (você)</span><strong>{formatMoney(marcoDoDiaSel.saldoDeclarado)}</strong></div>
                <div className={styles.resultLinha} data-destaque="true">
                  <span>Diferença</span>
                  <strong className={marcoDoDiaSel.diferenca === 0 ? styles.difOk : styles.difNok}>{marcoDoDiaSel.diferenca > 0 ? "+" : ""}{formatMoney(marcoDoDiaSel.diferenca)}</strong>
                </div>
                {marcoDoDiaSel.temAjuste && <div className={styles.tag}>lançamento de ajuste criado</div>}
                <PontesButton variant="outline" size="sm" fullWidth iconStart={<Trash2 size={14} strokeWidth={2.5} />} onClick={() => setRemovendo(marcoDoDiaSel)}>Remover marco</PontesButton>
              </div>
            </>
          )}

          {diaSel && !marcoDoDiaSel && (
            <>
              <div className={styles.painelTitulo}>Conferir <strong className={styles.diaSelLabel}>{diaSel.split("-").reverse().join("/")}</strong></div>
              <p className={styles.painelSub}>Quanto você REALMENTE tinha nesta conta neste dia?</p>
              <PontesField label="Saldo real da conta">
                <PontesMoneyInput value={saldoReal} onChange={setSaldoReal} suggestions={[]} />
              </PontesField>

              {calculado != null && saldoReal !== "" && (
                <div className={styles.resultado} data-bate={bate ? "true" : "false"}>
                  <div className={styles.resultLinha}><span>Calculado (app)</span><strong>{formatMoney(calculado)}</strong></div>
                  <div className={styles.resultLinha}><span>Declarado (você)</span><strong>{formatMoney(declarado)}</strong></div>
                  <div className={styles.resultLinha} data-destaque="true">
                    <span>Diferença</span>
                    <strong className={bate ? styles.difOk : styles.difNok}>{diferenca > 0 ? "+" : ""}{formatMoney(diferenca)}</strong>
                  </div>
                  {bate ? (
                    <PontesButton variant="primary" size="sm" fullWidth loading={salvando} iconStart={<Flag size={14} strokeWidth={2.5} />} onClick={() => gravar()}>Gravar marco</PontesButton>
                  ) : proximoTipo === TIPO_MARCO.Baseline ? (
                    <>
                      <div className={styles.resultAviso}><TriangleAlert size={14} strokeWidth={2.5} /> 1ª conferência da conta — vira o ponto de partida (baseline), assumindo o valor que você declarou.</div>
                      <PontesButton variant="primary" size="sm" fullWidth loading={salvando} iconStart={<Flag size={14} strokeWidth={2.5} />} onClick={() => gravar()}>Definir saldo inicial</PontesButton>
                    </>
                  ) : (
                    <>
                      <div className={styles.resultAviso}><TriangleAlert size={14} strokeWidth={2.5} /> Faltou (ou sobrou) lançamento{ultimoMarco ? ` — desde ${fmtDataHora(ultimoMarco.dataHora)}` : ""}.</div>
                      <PontesButton variant="outline" size="sm" fullWidth onClick={() => navigate("/transactions")}>Lançar o que falta</PontesButton>
                      <PontesButton variant="primary" size="sm" fullWidth loading={salvando} onClick={() => gravar("ajustar")}>Ajustar (cria lançamento)</PontesButton>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <PontesDialog
        open={removendo !== null}
        title="Remover marco?"
        description={removendo ? `${fmtDataHora(removendo.dataHora)} · ${removendo.temAjuste ? "o lançamento de ajuste também será cancelado" : "sem ajuste vinculado"}` : undefined}
        tone="danger"
        confirmLabel="Remover"
        onConfirm={handleRemover}
        onCancel={() => setRemovendo(null)}
      />
    </div>
  )
}
