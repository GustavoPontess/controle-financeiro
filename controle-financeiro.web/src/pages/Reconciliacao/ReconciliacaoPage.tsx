/**
 * Reconciliação — /reconciliacao. Ancora a confiança no saldo: "nesta conta, nesta data, o saldo
 * real era X". Layout: seletor de conta → hero (saldo + sinal de confiança honesto + conferir hoje)
 * → coluna esquerda = painel conferir (protagonista, com os movimentos desde o último marco) +
 * coluna direita = calendário de marcos + histórico. Dados REAIS (reconciliacaoService +
 * transactionService). Spec: docs/features/reconciliacao.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useOutletContext, useNavigate } from "react-router-dom"
import {
  Check, TriangleAlert, ChevronLeft, ChevronRight, Flag, Trash2,
  Landmark, ArrowUpRight, ArrowDownRight,
} from "lucide-react"
import { PontesButton, PontesField, PontesInput, PontesSelect, PontesDateInput, PontesDialog, PontesTabela } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import { combinarDataHora, horaLocalHHMM, dataLocalISO } from "@/utils/dateTime"
import { getContas, atualizarSaldoInicial } from "@/services/contaService"
import { listMarcos, getSaldoCalculado, criarMarco, removerMarco } from "@/services/reconciliacaoService"
import { listTransactionsPage } from "@/services/transactionService"
import type { Conta } from "@/types/Conta"
import type { Transaction } from "@/types/Transaction"
import type { ReconciliacaoMarco } from "@/types/Reconciliacao"
import { TIPO_MARCO } from "@/types/Reconciliacao"
import styles from "./ReconciliacaoPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

const parseMoney = (s: string) => Number(s.replace(/\./g, "").replace(",", ".")) || 0
// Máscara compacta pt-BR: dígitos → centavos (ex. "394420" → "3.944,20").
const maskMoney = (raw: string) => {
  const d = raw.replace(/\D/g, "")
  return d ? (Number(d) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
}
const pad = (n: number) => String(n).padStart(2, "0")
// Marco/transação guardam wall-clock como UTC → o dia do marco é o trecho ISO (YYYY-MM-DD).
const isoDoMarco = (m: ReconciliacaoMarco) => m.dataHora.slice(0, 10)
const fmtDiaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const fmtDataBR = (iso: string) => iso.split("-").reverse().join("/")
// dd/mm + HH:MM da transação. Lê em UTC (o wall-clock é guardado como UTC — mesma convenção da
// tabela de Transações e do isoParaHoraHHMM). Lançamento só-data (00:00) mostra só o dia.
const fmtDiaHora = (iso: string) => {
  const dm = fmtDiaMes(iso.slice(0, 10))
  const d = new Date(iso)
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) return dm
  return `${dm} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
// Próximo dia (YYYY-MM-DD + 1) — `to` da listagem é semi-aberto (`Data < to`).
const proxDia = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(y, m - 1, d + 1)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
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
  // Edição do saldo inicial (ponto de partida) direto aqui, sem ir no cadastro da conta.
  const [editandoInicial, setEditandoInicial] = useState(false)
  const [inicialValor, setInicialValor] = useState("")
  const [inicialData, setInicialData] = useState("")
  const [salvandoInicial, setSalvandoInicial] = useState(false)
  const [movimentos, setMovimentos] = useState<Transaction[]>([])
  const [versao, setVersao] = useState(0)
  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  const conta = contas.find((c) => c.id === contaId)
  const saldoAtual = conta?.saldoAtual ?? 0
  const hojeISO = dataLocalISO()

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
  // Sinal de confiança HONESTO: verde só quando o saldo de hoje ainda bate com o último marco
  // (nada se moveu desde então). Se houve movimento, o saldo atual não está conferido → "a conferir".
  const delta = ultimoMarco ? saldoAtual - ultimoMarco.saldoDeclarado : 0
  const conferido = ultimoMarco != null && Math.abs(delta) < 0.005

  // Marco por dia do mês exibido (o mais recente do dia) — pra pintar o calendário.
  const marcoPorDia = useMemo(() => {
    const map = new Map<number, ReconciliacaoMarco>()
    for (const m of marcos) {
      const iso = isoDoMarco(m)
      const [y, mes] = iso.split("-").map(Number)
      if (y === mesRef.getFullYear() && mes - 1 === mesRef.getMonth()) {
        const dia = Number(iso.slice(8, 10))
        if (!map.has(dia)) map.set(dia, m) // marcos desc → 1º é o mais recente
      }
    }
    return map
  }, [marcos, mesRef])

  const ano = mesRef.getFullYear()
  const mes = mesRef.getMonth()
  const offset = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const celulas: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: diasNoMes }, (_, i) => i + 1)]
  const isoDoDia = (dia: number) => `${ano}-${pad(mes + 1)}-${pad(dia)}`

  const marcoDoDiaSel = diaSel ? marcos.find((m) => isoDoMarco(m) === diaSel) : undefined

  // Abrir um dia: calcula sempre o saldo do app até lá (o render decide marco × conferir).
  const abrirDia = useCallback(async (iso: string) => {
    // Leva o calendário pro mês do dia aberto (ex.: clicar na "última conferência" de outro mês).
    const [y, m] = iso.split("-").map(Number)
    setMesRef(new Date(y, m - 1, 1))
    setDiaSel(iso); setSaldoReal(""); setIdemKey(crypto.randomUUID()); setCalculado(null); setEditandoInicial(false)
    try {
      const dataHora = combinarDataHora(iso, iso === hojeISO ? horaLocalHHMM() : "23:59")
      setCalculado(await getSaldoCalculado(contaId, dataHora))
    } catch {
      notify({ open: true, message: "Erro ao calcular o saldo até esse dia", severity: "error" })
    }
  }, [contaId, hojeISO, notify])

  // Ao abrir / trocar de conta: já começa conferindo HOJE (painel nunca nasce vazio).
  // Depende SÓ de contaId (não de versao): senão qualquer recarregar() — gravar/remover/alterar —
  // jogava a seleção de volta pra hoje, atropelando o dia que o usuário acabou de escolher.
  useEffect(() => {
    if (!contaId) return
    const iso = dataLocalISO()
    setDiaSel(iso); setSaldoReal(""); setIdemKey(crypto.randomUUID()); setCalculado(null)
    let vivo = true
    getSaldoCalculado(contaId, combinarDataHora(iso, horaLocalHHMM()))
      .then((v) => { if (vivo) setCalculado(v) })
      .catch(() => { if (vivo) notify({ open: true, message: "Erro ao calcular o saldo de hoje", severity: "error" }) })
    return () => { vivo = false }
  }, [contaId, notify])

  // Movimentos do dia selecionado: o que mexeu no saldo DESDE o marco anterior a esse dia
  // (não o último marco global — pra um dia passado, o relevante é o marco que veio antes dele).
  const marcoAnterior = diaSel ? marcos.find((m) => isoDoMarco(m) < diaSel) : undefined
  const fromMov = marcoAnterior ? isoDoMarco(marcoAnterior) : undefined
  useEffect(() => {
    if (!contaId || !diaSel) { setMovimentos([]); return }
    let vivo = true
    listTransactionsPage(1, 100, { contaId, from: fromMov, to: proxDia(diaSel), apenasCaixa: true })
      .then((r) => { if (vivo) setMovimentos(r.items) })
      .catch(() => { if (vivo) setMovimentos([]) })
    return () => { vivo = false }
  }, [contaId, diaSel, fromMov, versao])

  const mudarMes = (delta: number) => {
    setMesRef(new Date(ano, mes + delta, 1))
    setDiaSel(null); setSaldoReal(""); setCalculado(null)
  }

  const conferirHoje = () => {
    const hoje = new Date()
    setMesRef(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
    void abrirDia(dataLocalISO(hoje))
  }

  const declarado = parseMoney(saldoReal)
  const diferenca = calculado != null ? declarado - calculado : 0
  const bate = calculado != null && Math.abs(diferenca) < 0.005

  const gravar = async (resolucao?: "ajustar") => {
    if (!diaSel || calculado == null) return
    setSalvando(true)
    try {
      const dataHora = combinarDataHora(diaSel, diaSel === hojeISO ? horaLocalHHMM() : "23:59")
      await criarMarco({ contaId, dataHora, saldoDeclarado: declarado, tipo: proximoTipo, resolucao }, idemKey)
      notify({ open: true, message: bate ? "Conferido — saldo bate ✓" : "Marco gravado + ajuste lançado", severity: "success" })
      setSaldoReal("")
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

  // Alterar um marco já gravado = remover e reabrir o conferir daquele dia pra digitar de novo.
  const alterarMarco = async (m: ReconciliacaoMarco) => {
    const iso = isoDoMarco(m)
    try {
      await removerMarco(m.id)
      recarregar()
      void abrirDia(iso)
    } catch {
      notify({ open: true, message: "Erro ao alterar o marco", severity: "error" })
    }
  }

  // Editar o saldo inicial (marco de partida) aqui mesmo: valor + data da abertura da conta.
  const abrirEdicaoInicial = (m: ReconciliacaoMarco) => {
    setInicialValor(m.saldoDeclarado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    setInicialData(isoDoMarco(m))
    setEditandoInicial(true)
  }

  const salvarInicial = async () => {
    const valor = parseMoney(inicialValor)
    if (valor <= 0) { notify({ open: true, message: "Informe um valor maior que zero.", severity: "error" }); return }
    setSalvandoInicial(true)
    try {
      await atualizarSaldoInicial(contaId, { valor, data: inicialData || undefined })
      notify({ open: true, message: "Saldo inicial atualizado", severity: "success" })
      setEditandoInicial(false)
      recarregar()
    } catch {
      notify({ open: true, message: "Erro ao salvar o saldo inicial", severity: "error" })
    } finally { setSalvandoInicial(false) }
  }

  return (
    <div className={styles.wrap}>
      {/* Hero grande (destaque). O resto da tela é denso; o hero é a exceção. */}
      <div className={styles.hero}>
        <div className={styles.heroBlob} />
        <div className={styles.heroMain}>
          <div className={styles.heroLabel}>Saldo em conta</div>
          <div className={styles.heroValor}>{formatMoney(saldoAtual)}</div>
          {ultimoMarco && Math.abs(delta) >= 0.005 && (
            <div className={styles.heroDelta}>
              {delta > 0 ? <ArrowUpRight size={14} strokeWidth={2.5} /> : <ArrowDownRight size={14} strokeWidth={2.5} />}
              {delta > 0 ? "+" : "−"}{formatMoney(Math.abs(delta))} desde a última conferência
            </div>
          )}
        </div>
        <div className={styles.heroRight}>
          <span className={styles.heroChip} data-ok={conferido ? "true" : "false"}>
            {conferido ? <Check size={14} strokeWidth={3} /> : <TriangleAlert size={14} strokeWidth={2.5} />}
            {conferido ? `Conferido ${fmtDiaMes(isoDoMarco(ultimoMarco))}` : "A conferir"}
          </span>
          <button type="button" className={styles.heroBtn} onClick={conferirHoje}>
            <Flag size={14} strokeWidth={2.5} /> Conferir hoje
          </button>
        </div>
      </div>

      <div className={styles.cols}>
        {/* ESQUERDA: painel conferir (protagonista). O seletor de conta mora no topo deste painel. */}
        <div className={`${styles.painel} ${styles.painelConf}`}>
          <div className={styles.painelSel}>
            <PontesField label="Conta a conferir" helper="Tudo nesta tela é desta conta.">
              <PontesSelect
                value={contaId}
                onChange={(v) => { setContaId(v); setDiaSel(null); setSaldoReal(""); setCalculado(null); setEditandoInicial(false) }}
                options={contas.map((c) => ({ value: c.id, label: c.nome }))}
              />
            </PontesField>
          </div>

          {!diaSel && <p className={styles.painelSub}>Escolha um dia no calendário pra conferir o saldo daquele dia.</p>}

          {diaSel && (() => {
            // Modo edição do saldo inicial (ponto de partida) — edita valor + data aqui mesmo.
            if (editandoInicial) {
              return (
                <>
                  <div className={styles.painelTitulo}><Flag size={15} strokeWidth={2.2} /> Saldo inicial <strong className={styles.diaSelLabel}>da conta</strong></div>
                  <p className={styles.painelSub}>O ponto de partida da conta — vale a partir desta data.</p>
                  <div className={styles.painelInput} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <PontesField label="Valor">
                      <PontesInput iconStart="R$" inputMode="decimal" placeholder="0,00" value={inicialValor} onChange={(e) => setInicialValor(maskMoney(e.target.value))} autoFocus />
                    </PontesField>
                    <PontesField label="Desde">
                      <PontesDateInput value={inicialData} onChange={setInicialData} max={hojeISO} />
                    </PontesField>
                  </div>
                  <div className={styles.painelFooter}>
                    <PontesButton variant="primary" size="sm" fullWidth loading={salvandoInicial} iconStart={<Check size={14} strokeWidth={3} />} onClick={salvarInicial}>Salvar saldo inicial</PontesButton>
                    <PontesButton variant="outline" size="sm" fullWidth onClick={() => setEditandoInicial(false)}>Cancelar</PontesButton>
                  </div>
                </>
              )
            }
            const m = marcoDoDiaSel
            const calc = m ? m.saldoCalculado : calculado
            const decl = m ? m.saldoDeclarado : declarado
            const dif = m ? m.diferenca : diferenca
            const bateu = m ? m.diferenca === 0 : bate
            const temResultado = m != null || calculado != null
            return (
              <>
                {/* Título — mesma posição em todo modo. */}
                <div className={styles.painelTitulo}>
                  {m
                    ? <>Marco de <strong className={styles.diaSelLabel}>{fmtDataBR(diaSel)}</strong></>
                    : <><Flag size={15} strokeWidth={2.2} /> Conferir <strong className={styles.diaSelLabel}>{diaSel === hojeISO ? `hoje, ${fmtDiaMes(diaSel)}` : fmtDataBR(diaSel)}</strong></>}
                </div>

                {/* Saldo do banco — o que a pessoa digita (ou, num marco, o que foi conferido). */}
                <div className={styles.painelInput}>
                  <PontesField label={m ? "Saldo conferido" : "Saldo que aparece no seu banco"} helper={m ? undefined : "Abre o app do seu banco e põe o valor aqui."}>
                    <PontesInput
                      iconStart="R$"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={m ? decl.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : saldoReal}
                      onChange={(e) => setSaldoReal(maskMoney(e.target.value))}
                      disabled={!!m}
                      autoFocus={!m}
                    />
                  </PontesField>
                </div>

                {/* App × você × diferença — mesmas 3 linhas em todo modo. */}
                {temResultado && (
                  <div className={styles.resultado} data-bate={bateu ? "true" : "false"}>
                    <div className={styles.resultLinha}><span>Calculado (app)</span><strong>{formatMoney(calc ?? 0)}</strong></div>
                    <div className={styles.resultLinha}><span>Declarado (você)</span><strong>{formatMoney(decl)}</strong></div>
                    <div className={styles.resultLinha} data-destaque="true">
                      <span>Diferença</span>
                      <strong className={bateu ? styles.difOk : styles.difNok}>{dif > 0 ? "+" : ""}{formatMoney(dif)}</strong>
                    </div>
                  </div>
                )}

                {/* Slot de aviso com altura fixa → as caixas não dançam. */}
                <div className={styles.statusSlot}>
                  {m?.derivado && <div className={styles.notaDerivado}>Ponto de partida da conta.</div>}
                  {m?.temAjuste && <div className={styles.tag}>lançamento de ajuste criado</div>}
                  {!m && calculado == null && <span className={styles.painelSub}>Calculando o saldo do dia…</span>}
                  {!m && calculado != null && !bate && (
                    <div className={styles.resultAviso}>
                      <TriangleAlert size={14} strokeWidth={2.5} />
                      {dif > 0
                        ? `Sobrou ${formatMoney(dif)} — tem mais no banco do que o app contabilizou.`
                        : `Faltou ${formatMoney(Math.abs(dif))} — tem menos no banco do que o app contabilizou.`}
                    </div>
                  )}
                </div>

                {/* Ações ancoradas no rodapé. */}
                <div className={styles.painelFooter}>
                  {m?.derivado && (
                    <PontesButton variant="outline" size="sm" fullWidth onClick={() => abrirEdicaoInicial(m)}>Alterar valor</PontesButton>
                  )}
                  {m && !m.derivado && (
                    <>
                      <PontesButton variant="outline" size="sm" fullWidth onClick={() => alterarMarco(m)}>Alterar valor</PontesButton>
                      <PontesButton variant="danger-outline" size="sm" fullWidth iconStart={<Trash2 size={14} strokeWidth={2.5} />} onClick={() => setRemovendo(m)}>Remover</PontesButton>
                    </>
                  )}
                  {!m && calculado != null && (bate
                    ? <PontesButton variant="primary" size="sm" fullWidth loading={salvando} iconStart={<Check size={14} strokeWidth={3} />} onClick={() => gravar()}>Confere — gravar marco</PontesButton>
                    : <>
                        <PontesButton variant="outline" size="sm" fullWidth onClick={() => navigate("/transactions")}>Lançar o que falta</PontesButton>
                        <PontesButton variant="primary" size="sm" fullWidth loading={salvando} onClick={() => gravar("ajustar")}>Ajustar (cria lançamento)</PontesButton>
                      </>)}
                </div>
              </>
            )
          })()}
        </div>

        {/* DIREITA: calendário + histórico */}
        <div className={`${styles.painel} ${styles.painelCal}`}>
          <div className={styles.calTopo}>
            <div className={styles.painelTitulo}>{MESES[mes]} {ano}</div>
            <div className={styles.calNav}>
              <button type="button" className={styles.calNavBtn} aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft size={15} strokeWidth={2.5} /></button>
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
              const pendente = !marco && ultimoMarco != null && iso > isoDoMarco(ultimoMarco) && iso <= hojeISO
              return (
                <button
                  key={dia}
                  type="button"
                  className={styles.calDia}
                  data-marco={tom}
                  data-hoje={iso === hojeISO ? "true" : undefined}
                  data-sel={iso === diaSel ? "true" : undefined}
                  data-pendente={pendente ? "true" : undefined}
                  onClick={() => abrirDia(iso)}
                >
                  <span className={styles.calDiaNum}>{dia}{marco && <Check size={9} strokeWidth={3.5} />}</span>
                </button>
              )
            })}
          </div>

          <div className={styles.calLegenda}>
            <span><span className={styles.legDot} data-t="bateu" /> conferido</span>
            <span><span className={styles.legDot} data-t="ajuste" /> ajuste</span>
            <span><span className={styles.legDot} data-t="pendente" /> a conferir</span>
          </div>

          <div className={styles.histTitulo}>Última conferência</div>
          {ultimoMarco == null ? (
            <p className={styles.painelSub}>Nenhuma conferência ainda. Confira o saldo de hoje pra começar.</p>
          ) : (
            <button type="button" className={styles.histLinha} data-sel={isoDoMarco(ultimoMarco) === diaSel ? "true" : undefined} onClick={() => abrirDia(isoDoMarco(ultimoMarco))}>
              <span className={styles.histEsq}>
                {ultimoMarco.tipo === TIPO_MARCO.Baseline
                  ? <Landmark size={13} strokeWidth={2.5} className={styles.histIconInicial} />
                  : ultimoMarco.temAjuste
                    ? <TriangleAlert size={13} strokeWidth={2.5} className={styles.histIconAjuste} />
                    : <Check size={13} strokeWidth={3} className={styles.histIconOk} />}
                {fmtDiaMes(isoDoMarco(ultimoMarco))}{ultimoMarco.tipo === TIPO_MARCO.Baseline && <span className={styles.histTagPartida}>partida</span>}
              </span>
              <span className={styles.histValor}>{formatMoney(ultimoMarco.saldoDeclarado)}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabela full-width (PontesTabela, o padrão de lista do DS): o que mexeu no saldo desde o marco
          anterior até o dia escolhido. Sempre visível (quando há conta) — some não, o vazio é do próprio
          componente. */}
      {contaId && (
        <PontesTabela<Transaction>
          id="reconciliacao-movimentos"
          titulo={diaSel ? `Movimentos desde ${marcoAnterior ? fmtDiaMes(isoDoMarco(marcoAnterior)) : "o começo"} até ${fmtDiaMes(diaSel)}` : "Movimentos"}
          colunas={[
            { key: "data", header: "Data", render: (t) => fmtDiaHora(t.data) },
            { key: "descricao", header: "Lançamento", render: (t) => t.descricao },
            { key: "valor", header: "Valor", numerica: true, render: (t) => (
              <span className={t.tipo === 2 ? styles.movValorPos : styles.movValorNeg}>{formatMoney(t.valor)}</span>
            ) },
          ]}
          itens={movimentos}
          chave={(t) => t.id}
          vazio={{ icone: <Flag size={28} strokeWidth={1.8} />, titulo: "Nenhum movimento neste período", descricao: diaSel ? undefined : "Escolha um dia no calendário pra ver os movimentos até ele." }}
        />
      )}

      <PontesDialog
        open={removendo !== null}
        title="Remover marco?"
        description={removendo ? `${fmtDataBR(isoDoMarco(removendo))} · ${removendo.temAjuste ? "o lançamento de ajuste também será cancelado" : "sem ajuste vinculado"}` : undefined}
        tone="danger"
        confirmLabel="Remover"
        onConfirm={handleRemover}
        onCancel={() => setRemovendo(null)}
      />
    </div>
  )
}
