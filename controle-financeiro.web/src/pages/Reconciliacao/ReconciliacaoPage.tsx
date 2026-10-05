/**
 * Reconciliação — /reconciliacao. Ancora a confiança no saldo: "nesta conta, nesta data, o saldo
 * real era X". Layout (2026-10-05): hero (saldo + sinal de confiança honesto + conferir hoje) → coluna
 * esquerda = "Conta a conferir" + calendário de marcos (com "Hoje") + última conferência; coluna direita
 * = painel de conferir (linhas Calculado/Banco com o campo do banco na linha, diferença em destaque,
 * ações do marco numa lista embaixo) → movimentos desde o marco anterior (PontesTabela, "Mostrar mais").
 * Dados REAIS (reconciliacaoService + transactionService). Spec: docs/features/reconciliacao.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useOutletContext, useNavigate } from "react-router-dom"
import {
  Check, TriangleAlert, ChevronLeft, ChevronRight, Flag, Scale, Plus, Pencil, Trash2,
  Landmark, ArrowUpRight, ArrowDownRight,
} from "lucide-react"
import { PontesButton, PontesField, PontesInput, PontesSelect, PontesDateInput, PontesDialog, PontesTabela } from "@/components/pontes"
import { formatMoney, parseMoney, maskMoney, moneyParaCampo } from "@/utils/money"
import { combinarDataHora, horaLocalHHMM, dataLocalISO } from "@/utils/dateTime"
import { getContas, atualizarSaldoInicial } from "@/services/contaService"
import { listMarcos, getSaldoCalculado, criarMarco, removerMarco, fecharDiferenca } from "@/services/reconciliacaoService"
import { listTransactionsPage } from "@/services/transactionService"
import type { Conta } from "@/types/Conta"
import type { Transaction } from "@/types/Transaction"
import type { ReconciliacaoMarco } from "@/types/Reconciliacao"
import { TIPO_MARCO } from "@/types/Reconciliacao"
import styles from "./ReconciliacaoPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
/** Tamanho do lote da lista de movimentos ("Mostrar mais" busca o próximo lote no servidor). */
const LOTE_MOVIMENTOS = 20
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

const pad = (n: number) => String(n).padStart(2, "0")
// Marco/transação guardam wall-clock como UTC → o dia do marco é o trecho ISO (YYYY-MM-DD).
const isoDoMarco = (m: ReconciliacaoMarco) => m.dataHora.slice(0, 10)
const fmtDiaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const fmtDataBR = (iso: string) => iso.split("-").reverse().join("/")
// dd/mm + HH:MM da transação. Campos separados (data "YYYY-MM-DD" + hora "HH:MM:SS"|null), sem fuso.
// Lançamento sem hora (null) mostra só o dia.
const fmtDiaHora = (data: string, hora?: string | null) =>
  hora ? `${fmtDiaMes(data)} ${hora.slice(0, 5)}` : fmtDiaMes(data)
// Cor do marco no calendário/histórico. "diferenca" = saldo do banco salvo que ainda não bate e não
// foi ajustado (a pessoa ainda vai lançar o que falta ou ajustar).
type TomMarco = "inicial" | "ajuste" | "diferenca" | "bateu"
const tomDoMarco = (m: ReconciliacaoMarco): TomMarco =>
  m.tipo === TIPO_MARCO.Baseline ? "inicial"
    : m.temAjuste ? "ajuste"
      : Math.abs(m.diferenca) >= 0.005 ? "diferenca"
        : "bateu"
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

  // Marco gravado (não o derivado do saldo inicial): o saldo do app até a data DELE é recalculado ao
  // vivo — a pessoa pode ter salvo o saldo do banco, ido "lançar o que falta" e voltado. A diferença
  // mostrada (e o que o "Ajustar" vai lançar) é a de AGORA, não a do momento em que salvou.
  const marcoRealId = marcoDoDiaSel && !marcoDoDiaSel.derivado ? marcoDoDiaSel.id : undefined
  const marcoRealDataHora = marcoRealId ? marcoDoDiaSel?.dataHora : undefined
  const [calcMarco, setCalcMarco] = useState<number | null>(null)
  const [fecharKey, setFecharKey] = useState("")
  const [fechando, setFechando] = useState(false)
  useEffect(() => {
    setCalcMarco(null)
    if (!contaId || !marcoRealId || !marcoRealDataHora) return
    setFecharKey(crypto.randomUUID())
    let vivo = true
    getSaldoCalculado(contaId, marcoRealDataHora)
      .then((v) => { if (vivo) setCalcMarco(v) })
      .catch(() => { if (vivo) setCalcMarco(null) })
    return () => { vivo = false }
  }, [contaId, marcoRealId, marcoRealDataHora, versao])

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
  // Em lotes, NO SERVIDOR: o 1º lote ao abrir o dia e o resto sob demanda ("Mostrar mais") — nunca
  // tudo de uma vez (antes buscava até 100 e cortava calado). `movPedido` invalida o "mostrar mais"
  // de uma consulta antiga quando a conta/dia muda no meio.
  const [movTotal, setMovTotal] = useState(0)
  const [movPagina, setMovPagina] = useState(1)
  const [carregandoMaisMov, setCarregandoMaisMov] = useState(false)
  const movPedido = useRef(0)
  useEffect(() => {
    const pedido = ++movPedido.current
    setCarregandoMaisMov(false)
    if (!contaId || !diaSel) { setMovimentos([]); setMovTotal(0); return }
    listTransactionsPage(1, LOTE_MOVIMENTOS, { contaId, from: fromMov, to: proxDia(diaSel), apenasCaixa: true })
      .then((r) => { if (pedido === movPedido.current) { setMovimentos(r.items); setMovTotal(r.total); setMovPagina(1) } })
      .catch(() => { if (pedido === movPedido.current) { setMovimentos([]); setMovTotal(0) } })
  }, [contaId, diaSel, fromMov, versao])

  const carregarMaisMovimentos = async () => {
    if (!contaId || !diaSel) return
    const pedido = movPedido.current
    setCarregandoMaisMov(true)
    try {
      const r = await listTransactionsPage(movPagina + 1, LOTE_MOVIMENTOS, { contaId, from: fromMov, to: proxDia(diaSel), apenasCaixa: true })
      if (pedido !== movPedido.current) return
      // Sem duplicar se algo entrou/saiu entre um lote e outro (a página "anda").
      setMovimentos((atuais) => [...atuais, ...r.items.filter((t) => !atuais.some((a) => a.id === t.id))])
      setMovTotal(r.total)
      setMovPagina((p) => p + 1)
    } catch {
      if (pedido === movPedido.current) notify({ open: true, message: "Não deu pra carregar mais movimentos", severity: "error" })
    } finally {
      if (pedido === movPedido.current) setCarregandoMaisMov(false)
    }
  }

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
  // Campo vazio não é zero: sem o saldo do banco digitado não há o que comparar nem gravar.
  // (Antes o vazio valia 0 e "Ajustar" lançava o saldo inteiro como ajuste.) "0,00" digitado vale.
  const preenchido = saldoReal.trim() !== ""
  // Campo do banco na linha "Banco": aberto enquanto vazio ou com foco; preenchido e fora do foco vira
  // o valor + lápis (o lápis reabre).
  const [editandoBanco, setEditandoBanco] = useState(false)
  const campoBancoAberto = editandoBanco || !preenchido
  const diferenca = calculado != null && preenchido ? declarado - calculado : 0
  const bate = calculado != null && preenchido && Math.abs(diferenca) < 0.005

  // 1º passo: SALVAR o saldo do banco (marco de verificação, sem ajuste). Só depois de salvo, se houver
  // diferença, a tela oferece "Lançar o que falta" / "Ajustar" — nunca durante a digitação.
  const gravar = async () => {
    if (!diaSel || calculado == null || !preenchido) return
    setSalvando(true)
    try {
      const dataHora = combinarDataHora(diaSel, diaSel === hojeISO ? horaLocalHHMM() : "23:59")
      await criarMarco({ contaId, dataHora, saldoDeclarado: declarado, tipo: TIPO_MARCO.Verificacao }, idemKey)
      notify({ open: true, message: bate ? "Conferido — saldo bate ✓" : "Saldo do banco salvo", severity: "success" })
      setSaldoReal("")
      recarregar()
    } catch {
      notify({ open: true, message: "Erro ao salvar o saldo do banco", severity: "error" })
    } finally { setSalvando(false) }
  }

  // 2º passo (marco já salvo): fecha a diferença — lança o ajuste da diferença de agora, ou, se a
  // pessoa já lançou o que faltava, só confirma que passou a bater.
  const fechar = async (m: ReconciliacaoMarco) => {
    setFechando(true)
    try {
      const r = await fecharDiferenca(m.id, fecharKey)
      notify({ open: true, message: r.temAjuste ? "Ajuste lançado — saldo bate ✓" : "Conferido — saldo bate ✓", severity: "success" })
      recarregar()
    } catch {
      notify({ open: true, message: "Erro ao ajustar o marco", severity: "error" })
    } finally { setFechando(false) }
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
    setInicialValor(moneyParaCampo(m.saldoDeclarado))
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
        {/* ESQUERDA: conta a conferir + calendário + última conferência. */}
        <div className={`${styles.painel} ${styles.painelCal}`}>
          <div className={styles.painelSel}>
            <PontesField label="Conta a conferir" helper="Tudo nesta tela é desta conta.">
              <PontesSelect
                value={contaId}
                onChange={(v) => { setContaId(v); setDiaSel(null); setSaldoReal(""); setCalculado(null); setEditandoInicial(false) }}
                options={contas.map((c) => ({ value: c.id, label: c.nome }))}
              />
            </PontesField>
          </div>
          <div className={styles.calTopo}>
            <div className={styles.painelTitulo}>{MESES[mes]} {ano}</div>
            <div className={styles.calNav}>
              <button type="button" className={styles.calNavBtn} aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft size={15} strokeWidth={2.5} /></button>
              {/* "Hoje" entre as setas: volta pro mês atual e confere o dia de hoje. */}
              <button type="button" className={`${styles.calNavBtn} ${styles.calHoje}`} onClick={conferirHoje}>Hoje</button>
              <button type="button" className={styles.calNavBtn} aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight size={15} strokeWidth={2.5} /></button>
            </div>
          </div>

          <div className={styles.calGrid}>
            {SEMANA.map((d) => <div key={d} className={styles.calWeekday}>{d}</div>)}
            {celulas.map((dia, i) => {
              if (dia === null) return <div key={`e${i}`} className={styles.calVazio} />
              const iso = isoDoDia(dia)
              const marco = marcoPorDia.get(dia)
              const tom = marco ? tomDoMarco(marco) : undefined
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
            <span><span className={styles.legDot} data-t="diferenca" /> com diferença</span>
            <span><span className={styles.legDot} data-t="pendente" /> a conferir</span>
          </div>

          <div className={styles.histTitulo}>Última conferência</div>
          {ultimoMarco == null ? (
            <p className={styles.painelSub}>Nenhuma conferência ainda. Confira o saldo de hoje pra começar.</p>
          ) : (
            <button type="button" className={styles.histLinha} data-sel={isoDoMarco(ultimoMarco) === diaSel ? "true" : undefined} onClick={() => abrirDia(isoDoMarco(ultimoMarco))}>
              <span className={styles.histEsq}>
                {{
                  inicial: <Landmark size={13} strokeWidth={2.5} className={styles.histIconInicial} />,
                  ajuste: <TriangleAlert size={13} strokeWidth={2.5} className={styles.histIconAjuste} />,
                  diferenca: <TriangleAlert size={13} strokeWidth={2.5} className={styles.histIconDif} />,
                  bateu: <Check size={13} strokeWidth={3} className={styles.histIconOk} />,
                }[tomDoMarco(ultimoMarco)]}
                {fmtDiaMes(isoDoMarco(ultimoMarco))}{ultimoMarco.tipo === TIPO_MARCO.Baseline && <span className={styles.histTagPartida}>partida</span>}
              </span>
              <span className={styles.histValor}>{formatMoney(ultimoMarco.saldoDeclarado)}</span>
            </button>
          )}
        </div>

        {/* DIREITA: painel de conferir (só a altura do conteúdo — não estica até o calendário). */}
        <div className={`${styles.painel} ${styles.painelConf} ${styles.painelCurto}`}>
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
                      <PontesInput iconStart="R$" inputMode="decimal" placeholder="0,00" value={inicialValor} onChange={(e) => setInicialValor(maskMoney(e.target.value, inicialValor))} autoFocus />
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
            const real = m && !m.derivado ? m : undefined
            // Marco salvo: diferença de AGORA (recalculada até a data do marco). Com ajuste, o calculado
            // mostrado é o de antes do ajuste e a linha "Ajuste lançado" explica a ponte até o declarado.
            const calcAgora = real ? (calcMarco ?? real.saldoCalculado) : undefined
            const calc = m ? (real && !real.temAjuste ? calcAgora! : m.saldoCalculado) : calculado
            const decl = m ? m.saldoDeclarado : declarado
            const dif = real
              ? (real.temAjuste ? (calcMarco != null ? real.saldoDeclarado - calcMarco : 0) : real.saldoDeclarado - calcAgora!)
              : m ? m.diferenca : diferenca
            const bateu = m ? Math.abs(dif) < 0.005 : bate
            // Salvo e ainda com diferença (sem ajuste) → aí sim: "Lançar o que falta" / "Ajustar".
            const pendente = real != null && !real.temAjuste && Math.abs(dif) >= 0.005
            // Salvo com diferença, mas a pessoa já lançou o que faltava → só confirmar.
            const passouABater = real != null && !real.temAjuste && !pendente && Math.abs(real.diferenca) >= 0.005
            const temResultado = m != null || calculado != null
            // Sem o saldo do banco digitado: mostra só o calculado; declarado/diferença ficam em "—".
            const comparavel = m != null || preenchido
            return (
              <>
                {/* Título (as ações do marco ficam na lista do rodapé). */}
                <div className={styles.painelTitulo}>
                  {m
                    ? <>Marco de <strong className={styles.diaSelLabel}>{fmtDataBR(diaSel)}</strong></>
                    : <><Flag size={15} strokeWidth={2.2} /> Conferir <strong className={styles.diaSelLabel}>{diaSel === hojeISO ? `hoje, ${fmtDiaMes(diaSel)}` : fmtDataBR(diaSel)}</strong></>}
                </div>

                {/* Linhas tipo recibo: Calculado (app) / Banco (/ Ajuste lançado). O saldo do banco mora na
                    linha "Banco": antes de salvar o campo JÁ VEM ABERTO ali; preenchido e fora do foco vira o
                    valor + lápis (clicou → reabre). Marco salvo: só o valor (alterar = link no título). */}
                {temResultado && (
                  <div className={styles.linhas}>
                    <div className={styles.linha}><span>Calculado (app)</span><strong>{formatMoney(calc ?? 0)}</strong></div>
                    <div className={styles.linha}>
                      <span>Banco</span>
                      {m
                        ? <strong>{formatMoney(decl)}</strong>
                        : campoBancoAberto
                          ? (
                            <span className={styles.bancoCampo}>
                              <PontesInput
                                iconStart="R$"
                                inputMode="decimal"
                                placeholder="0,00"
                                aria-label="Saldo que aparece no seu banco"
                                className={styles.campoBanco}
                                value={saldoReal}
                                onChange={(e) => setSaldoReal(maskMoney(e.target.value, saldoReal))}
                                onFocus={() => setEditandoBanco(true)}
                                onBlur={() => setEditandoBanco(false)}
                                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                                autoFocus
                              />
                            </span>
                          )
                          : (
                            <button type="button" className={styles.bancoValor} aria-label="Editar saldo do banco" onClick={() => setEditandoBanco(true)}>
                              <strong>{formatMoney(declarado)}</strong>
                              <Pencil size={14} strokeWidth={2.5} />
                            </button>
                          )}
                    </div>
                    {m?.temAjuste && (
                      <div className={styles.linha}>
                        <span>Ajuste lançado</span>
                        <strong className={m.diferenca > 0 ? styles.ajusteEntrada : styles.ajusteSaida}>{formatMoney(Math.abs(m.diferenca))}</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* RESULTADO EM DESTAQUE: a diferença no centro (preta + traço + ícone ⚠/✓), no tamanho do conteúdo. */}
                {temResultado && (
                  <div className={styles.destaque} data-bate={bateu ? "true" : "false"}>
                    <span className={styles.destaqueRot}>Diferença</span>
                    {comparavel
                      ? (
                        <span className={styles.destaqueValor} data-tom={bateu ? "ok" : "nok"}>
                          {/* Ícone do topo das letras até o traço embaixo (medido: 34px + desce 3px no CSS). */}
                          {bateu ? <Check size={34} strokeWidth={3} aria-hidden /> : <TriangleAlert size={34} strokeWidth={2.5} aria-hidden />}
                          {/* Bate (|dif| < meio centavo) = R$ 0,00 sem sinal — antes saía "✓ -R$ 0,00" no arredondamento. */}
                          <span className={styles.destaqueNum}>{bateu ? formatMoney(0) : `${dif > 0 ? "+" : ""}${formatMoney(dif)}`}</span>
                        </span>
                      )
                      : <span className={styles.destaqueVazio}>—</span>}
                  </div>
                )}

                {/* Só aparece enquanto calcula — vazio, deixava um buraco entre o destaque e as opções. */}
                {!m && calculado == null && (
                  <div className={styles.statusSlot}><span className={styles.painelSub}>Calculando o saldo do dia…</span></div>
                )}

                {/* Rodapé: no máximo UMA ação principal. */}
                <div className={styles.painelFooter}>
                  {!m && calculado != null && (
                    <PontesButton variant="primary" size="sm" fullWidth loading={salvando} disabled={!preenchido}
                      iconStart={<Check size={14} strokeWidth={3} />} onClick={() => gravar()}>
                      Salvar saldo do banco
                    </PontesButton>
                  )}
                  {passouABater && (
                    <PontesButton variant="primary" size="sm" fullWidth loading={fechando} iconStart={<Check size={14} strokeWidth={3} />} onClick={() => fechar(real!)}>Confere — atualizar marco</PontesButton>
                  )}
                  {/* Marco salvo: TODAS as ações numa lista só, embaixo (pedido do Gustavo, 2026-10-05) — com diferença,
                      Ajustar / Lançar o que falta; sempre Alterar valor; Remover (vermelho) no marco real. */}
                  {m && (
                    <div className={styles.resolverOpcoes}>
                      {pendente && (
                        <>
                          <button type="button" className={styles.resolverItem} disabled={fechando} onClick={() => void fechar(real!)}>
                            <Scale size={14} strokeWidth={2.5} /> {fechando ? "Ajustando…" : "Ajustar (cria lançamento)"}
                          </button>
                          <button type="button" className={styles.resolverItem} disabled={fechando} onClick={() => navigate("/transactions")}>
                            <Plus size={14} strokeWidth={2.5} /> Lançar o que falta
                          </button>
                        </>
                      )}
                      <button type="button" className={styles.resolverItem} disabled={fechando} onClick={() => (m.derivado ? abrirEdicaoInicial(m) : alterarMarco(m))}>
                        <Pencil size={14} strokeWidth={2.5} /> Alterar valor
                      </button>
                      {real && (
                        <button type="button" className={styles.resolverItem} data-perigo="true" disabled={fechando} onClick={() => setRemovendo(real)}>
                          <Trash2 size={14} strokeWidth={2.5} /> Remover
                        </button>
                      )}
                    </div>
                  )}
                  {/* Sem selo "Conferido" quando bate — o ✓ verde na diferença já diz (pedido do Gustavo). */}
                </div>
              </>
            )
          })()}
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
            { key: "data", header: "Data/Hora", render: (t) => fmtDiaHora(t.data, t.hora) },
            { key: "descricao", header: "Lançamento", render: (t) => t.descricao },
            { key: "valor", header: "Valor", numerica: true, render: (t) => (
              <span className={t.tipo === 2 ? styles.movValorPos : styles.movValorNeg}>{formatMoney(t.valor)}</span>
            ) },
          ]}
          itens={movimentos}
          chave={(t) => t.id}
          carregarMais={{ restantes: Math.max(0, movTotal - movimentos.length), carregando: carregandoMaisMov, onCarregarMais: carregarMaisMovimentos }}
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
