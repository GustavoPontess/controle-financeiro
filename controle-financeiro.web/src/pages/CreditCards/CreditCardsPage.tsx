import React, { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import {
  Plus, Pencil, Trash2, CreditCard, ReceiptText, ChevronDown, Banknote, Check, Wifi,
} from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesBadge, PontesCard, PontesModal, PontesDialog,
  PontesField, PontesInput, PontesSelect, PontesEmptyState,
} from "@/components/pontes"
import { getCartoes, createCartao, updateCartao, deleteCartao } from "../../services/cartaoCreditoService"
import { getContas } from "../../services/contaService"
import { getBancos } from "../../services/bancoService"
import { getFaturasByCartao, getFaturaDetalhe, pagarFatura } from "../../services/faturaService"
import type { CartaoCredito, CriarCartaoCredito } from "../../types/CartaoCredito"
import type { Conta } from "../../types/Conta"
import type { Banco } from "../../types/Banco"
import type { Fatura, FaturaDetalhe, PagarFaturaPayload } from "../../types/Fatura"
import styles from "./CreditCardsPage.module.css"

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
// Máscara de moeda pro input de limite: dígitos → número (centavos) e volta.
const parseMoney = (masked: string): number | undefined => {
  const digits = masked.replace(/\D/g, "")
  return digits ? Number(digits) / 100 : undefined
}
const fmtMoneyInput = (n?: number): string =>
  n != null ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
// Datas de ciclo vêm como UTC (meia-noite) — formata em UTC pra não cair pro dia anterior.
const formatDate = (s: string) => new Date(s).toLocaleDateString("pt-BR", { timeZone: "UTC" })
const formatDateShort = (s: string) => new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })

const BANDEIRAS = [
  { value: "1", label: "Visa" }, { value: "2", label: "Mastercard" }, { value: "3", label: "Elo" },
  { value: "4", label: "Hipercard" }, { value: "5", label: "American Express" }, { value: "6", label: "Outros" },
]
const MEIOS_PAGAMENTO = [
  { value: "4", label: "Pix" }, { value: "2", label: "Débito" }, { value: "1", label: "Dinheiro" },
  { value: "5", label: "TED / DOC" }, { value: "6", label: "Boleto" },
]

type Modo = "credito_debito" | "credito" | "debito" | "prepago"
const MODOS: { value: Modo; label: string }[] = [
  { value: "credito_debito", label: "Crédito e Débito" }, { value: "credito", label: "Somente Crédito" },
  { value: "debito", label: "Somente Débito" }, { value: "prepago", label: "Pré-Pago" },
]
const modoParaBooleans = (modo: Modo): Pick<CriarCartaoCredito, "temCredito" | "temDebito" | "ehPrePago"> => ({
  temCredito: modo === "credito" || modo === "credito_debito",
  temDebito: modo === "debito" || modo === "credito_debito",
  ehPrePago: modo === "prepago",
})
const booleansParaModo = (c: CartaoCredito): Modo => {
  if (c.ehPrePago) return "prepago"
  if (c.temCredito && c.temDebito) return "credito_debito"
  if (c.temCredito) return "credito"
  return "debito"
}

// Gradiente da bandeira (cor real da marca do cartão — valor de dado, não tema).
const BANDEIRA_GRAD: Record<number, string> = {
  1: "linear-gradient(135deg, #1e40af, #3b82f6)",
  2: "linear-gradient(135deg, #7c2d12, #dc2626)",
  3: "linear-gradient(135deg, #0f766e, #14b8a6)",
  4: "linear-gradient(135deg, #9f1239, #e11d48)",
  5: "linear-gradient(135deg, #14532d, #16a34a)",
  6: "linear-gradient(135deg, #374151, #6b7280)",
}
const grad = (b: number) => BANDEIRA_GRAD[b] ?? BANDEIRA_GRAD[6]

const STATUS: Record<number, { label: string; tone: "soft" | "warning" | "success" }> = {
  1: { label: "Aberta", tone: "soft" },
  2: { label: "Fechada", tone: "warning" },
  3: { label: "Paga", tone: "success" },
}
const statusKey = (f: Fatura) => (f.estadoPagamento === 2 ? 3 : f.estadoCiclo === 1 ? 2 : 1)

type FormState = Omit<CriarCartaoCredito, "temCredito" | "temDebito" | "ehPrePago"> & { modo: Modo }
const emptyForm: FormState = {
  nome: "", ultimosDigitos: undefined, bandeira: 6, modo: "credito_debito",
  limite: undefined, diaFechamento: undefined, diaVencimento: undefined, contaId: undefined, bancoId: undefined,
}

type CartaoErrors = { nome?: string; bancoId?: string; ultimosDigitos?: string; limite?: string; diaFechamento?: string; diaVencimento?: string }

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

export default function CreditCardsPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [bancos, setBancos] = useState<Banco[]>([])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formErrors, setFormErrors] = useState<CartaoErrors>({})
  const [loading, setLoading] = useState(false)
  const clearErr = (k: keyof CartaoErrors) => setFormErrors((p) => ({ ...p, [k]: undefined }))

  const [faturasCartaoId, setFaturasCartaoId] = useState<string | null>(null)
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [loadingFaturas, setLoadingFaturas] = useState(false)
  const [expandedFaturaId, setExpandedFaturaId] = useState<string | null>(null)
  const [faturaDetalhes, setFaturaDetalhes] = useState<Record<string, FaturaDetalhe>>({})

  const [pagarFaturaId, setPagarFaturaId] = useState<string | null>(null)
  const [pagarCartaoId, setPagarCartaoId] = useState<string | null>(null)
  const [pagarForm, setPagarForm] = useState({
    contaId: "", valor: "", dataPagamento: new Date().toISOString().split("T")[0], meioPagamento: "4",
  })
  const [pagarErrors, setPagarErrors] = useState<{ conta?: string; valor?: string }>({})
  const [pagarLoading, setPagarLoading] = useState(false)

  const [delId, setDelId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [cs, conts, bs] = await Promise.all([getCartoes(), getContas(), getBancos()])
      setCartoes(cs)
      setContas(conts.filter((c) => !c.isCarteira))
      setBancos(bs)
    } catch {
      notify({ open: true, message: "Erro ao carregar cartões", severity: "error" })
    }
  }, [notify])

  useEffect(() => { void loadData() }, [loadData])

  const refreshFaturas = useCallback(async (cartaoId: string) => {
    setFaturas(await getFaturasByCartao(cartaoId))
  }, [])

  // Recarrega quando uma transação é criada pelo popup global.
  useEffect(() => {
    const onCreated = () => {
      void loadData()
      if (faturasCartaoId) refreshFaturas(faturasCartaoId).catch(() => { /* ignore */ })
    }
    window.addEventListener("transactionCreated", onCreated)
    return () => window.removeEventListener("transactionCreated", onCreated)
  }, [loadData, faturasCartaoId, refreshFaturas])

  const openFaturas = async (cartaoId: string) => {
    if (faturasCartaoId === cartaoId) { setFaturasCartaoId(null); return }
    setFaturasCartaoId(cartaoId)
    setExpandedFaturaId(null)
    setLoadingFaturas(true)
    try { await refreshFaturas(cartaoId) }
    finally { setLoadingFaturas(false) }
  }

  const toggleFatura = async (faturaId: string, cartaoId: string) => {
    if (expandedFaturaId === faturaId) { setExpandedFaturaId(null); return }
    setExpandedFaturaId(faturaId)
    if (!faturaDetalhes[faturaId]) {
      try {
        const detalhe = await getFaturaDetalhe(cartaoId, faturaId)
        setFaturaDetalhes((prev) => ({ ...prev, [faturaId]: detalhe }))
      } catch {
        notify({ open: true, message: "Erro ao carregar transações da fatura", severity: "error" })
      }
    }
  }

  const openPagar = (faturaId: string, cartaoId: string, valorRestante: number, contaId?: string) => {
    setPagarFaturaId(faturaId)
    setPagarCartaoId(cartaoId)
    setPagarErrors({})
    setPagarForm({
      contaId: contaId ?? "", valor: String(valorRestante.toFixed(2)),
      dataPagamento: new Date().toISOString().split("T")[0], meioPagamento: "4",
    })
  }

  const handlePagar = async () => {
    if (!pagarFaturaId || !pagarCartaoId) return
    const e: { conta?: string; valor?: string } = {}
    if (!pagarForm.contaId) e.conta = "Selecione a conta"
    if (!pagarForm.valor || Number(pagarForm.valor) <= 0) e.valor = "Informe um valor válido"
    setPagarErrors(e)
    if (Object.keys(e).length) return
    setPagarLoading(true)
    try {
      const payload: PagarFaturaPayload = {
        contaId: pagarForm.contaId, valor: Number(pagarForm.valor),
        dataPagamento: pagarForm.dataPagamento, meioPagamento: Number(pagarForm.meioPagamento),
      }
      await pagarFatura(pagarCartaoId, pagarFaturaId, payload)
      notify({ open: true, message: "Pagamento registrado com sucesso", severity: "success" })
      setPagarFaturaId(null)
      await loadData()
      if (faturasCartaoId) await refreshFaturas(faturasCartaoId)
    } catch {
      notify({ open: true, message: "Erro ao registrar pagamento", severity: "error" })
    } finally { setPagarLoading(false) }
  }

  const openCreate = () => { setForm(emptyForm); setFormErrors({}); setEditingId(null); setDialogOpen(true) }
  const openEdit = (c: CartaoCredito) => {
    setForm({
      nome: c.nome, ultimosDigitos: c.ultimosDigitos, bandeira: c.bandeira, modo: booleansParaModo(c),
      limite: c.limite, diaFechamento: c.diaFechamento, diaVencimento: c.diaVencimento,
      contaId: c.contaId, bancoId: c.bancoId,
    })
    setFormErrors({}); setEditingId(c.id); setDialogOpen(true)
  }

  const handleSalvar = async () => {
    const e: CartaoErrors = {}
    if (!form.nome.trim()) e.nome = "Informe o nome do cartão"
    if (!form.bancoId) e.bancoId = "Selecione o banco emissor"
    if (form.ultimosDigitos && form.ultimosDigitos.length !== 4) e.ultimosDigitos = "Use os 4 últimos dígitos"
    if (temCredito) {
      if (form.limite == null) e.limite = "Informe o limite"
      else if (form.limite <= 0) e.limite = "Limite deve ser maior que zero"
      if (form.diaFechamento == null) e.diaFechamento = "Informe o dia"
      else if (!Number.isInteger(form.diaFechamento) || form.diaFechamento < 1 || form.diaFechamento > 31)
        e.diaFechamento = "Dia entre 1 e 31"
      if (form.diaVencimento == null) e.diaVencimento = "Informe o dia"
      else if (!Number.isInteger(form.diaVencimento) || form.diaVencimento < 1 || form.diaVencimento > 31)
        e.diaVencimento = "Dia entre 1 e 31"
    }
    setFormErrors(e)
    if (Object.keys(e).length) return
    setLoading(true)
    try {
      const payload: CriarCartaoCredito = {
        nome: form.nome, ultimosDigitos: form.ultimosDigitos, bandeira: form.bandeira,
        ...modoParaBooleans(form.modo), limite: form.limite, diaFechamento: form.diaFechamento,
        diaVencimento: form.diaVencimento, contaId: form.contaId, bancoId: form.bancoId,
      }
      if (editingId) {
        await updateCartao(editingId, payload)
        notify({ open: true, message: "Cartão atualizado com sucesso", severity: "success" })
      } else {
        await createCartao(payload)
        notify({ open: true, message: "Cartão cadastrado com sucesso", severity: "success" })
      }
      setDialogOpen(false); await loadData()
    } catch {
      notify({ open: true, message: "Erro ao salvar cartão", severity: "error" })
    } finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!delId) return
    try {
      await deleteCartao(delId)
      notify({ open: true, message: "Cartão removido", severity: "success" })
      if (faturasCartaoId === delId) setFaturasCartaoId(null)
      await loadData()
    } catch (err) {
      const msg = (err as { response?: { data?: { mensagem?: string } } }).response?.data?.mensagem ?? "Erro ao remover cartão"
      notify({ open: true, message: msg, severity: "error" })
    } finally { setDelId(null) }
  }

  const totalLimite = cartoes.filter((c) => c.temCredito && c.limite).reduce((s, c) => s + (c.limite ?? 0), 0)
  const totalGastos = cartoes.filter((c) => c.temCredito).reduce((s, c) => s + c.gastosNoCicloAtual, 0)
  const totalDisp = Math.max(0, totalLimite - totalGastos)
  const isPrePago = form.modo === "prepago"
  const temCredito = form.modo === "credito" || form.modo === "credito_debito"
  const cartaoAtivo = cartoes.find((c) => c.id === faturasCartaoId)
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Fatura atual = mais recente; resto = histórico.
  const faturasSorted = [...faturas].sort((a, b) => new Date(b.dataFechamento).getTime() - new Date(a.dataFechamento).getTime())
  const faturaAtual = faturasSorted[0]
  const faturasHistorico = faturasSorted.slice(1)

  const paidIdsOf = (f: Fatura, detalhe?: FaturaDetalhe) => {
    const ids = new Set<string>()
    if (!detalhe?.transacoes?.length) return ids
    const sorted = [...detalhe.transacoes].sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime())
    let cum = 0
    for (const t of sorted) { cum += t.valor; if (f.valorPago >= cum) ids.add(t.id) }
    return ids
  }

  const renderDetalhe = (f: Fatura) => {
    const detalhe = faturaDetalhes[f.id]
    const paid = paidIdsOf(f, detalhe)
    if (!detalhe) return <div className={styles.detailMuted}>Carregando…</div>
    if (detalhe.transacoes.length === 0) return <div className={styles.detailMuted}>Nenhuma transação nesta fatura.</div>
    return (
      <div className={styles.txList}>
        {detalhe.transacoes.map((t) => (
          <div key={t.id} className={styles.txRow}>
            <div className={styles.txMain}>
              <span className={styles.txDesc}>{t.descricao}</span>
              <span className={styles.txMeta}>
                {new Date(t.data).toLocaleDateString("pt-BR")} · {new Date(t.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                {t.categoriaDescricao ? ` · ${t.categoriaDescricao}` : ""}
              </span>
            </div>
            <span className={styles.txValor} data-paid={paid.has(t.id) ? "true" : "false"}>
              {paid.has(t.id) && <Check size={13} strokeWidth={2.5} />} {formatMoney(t.valor)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Cartões</h1>
          <div className={styles.subtitle}>Seus cartões e faturas, num lugar só</div>
        </div>
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={openCreate}>
          Novo Cartão
        </PontesButton>
      </div>

      {/* Resumo slim */}
      {cartoes.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.sumItem}>
            <span className={styles.sumLabel}>Cartões</span>
            <span className={styles.sumValue}>{cartoes.length}</span>
          </div>
          <div className={styles.sumDiv} />
          <div className={styles.sumItem}>
            <span className={styles.sumLabel}>Limite total</span>
            <span className={styles.sumValue}>{formatMoney(totalLimite)}</span>
          </div>
          <div className={styles.sumDiv} />
          <div className={styles.sumItem}>
            <span className={styles.sumLabel}>Disponível</span>
            <span className={styles.sumValue} data-pos="true">{formatMoney(totalDisp)}</span>
          </div>
          <div className={styles.sumDiv} />
          <div className={styles.sumItem}>
            <span className={styles.sumLabel}>Usado no ciclo</span>
            <span className={styles.sumValue}>{formatMoney(totalGastos)}</span>
          </div>
        </div>
      )}

      {/* Grid de cartões */}
      {cartoes.length === 0 ? (
        <PontesEmptyState
          icon={<CreditCard size={28} />}
          title="Nenhum cartão cadastrado"
          description="Adicione seus cartões de crédito, débito ou pré-pagos."
          actions={<PontesButton iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={openCreate}>Novo Cartão</PontesButton>}
        />
      ) : (
        <div className={styles.cardsGrid}>
          {cartoes.map((c) => {
            const pct = c.limite ? Math.min((c.gastosNoCicloAtual / c.limite) * 100, 100) : 0
            const over = pct > 80
            const sel = faturasCartaoId === c.id
            const clickable = c.temCredito
            return (
              <div
                key={c.id}
                className={styles.card}
                style={{ background: grad(c.bandeira) }}
                data-selected={sel ? "true" : undefined}
                data-clickable={clickable ? "true" : undefined}
                onClick={clickable ? () => openFaturas(c.id) : undefined}
              >
                <div className={styles.cardSheen1} />
                <div className={styles.cardSheen2} />

                <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                  <PontesIconButton size={32} variant="ghost" aria-label="Editar" onClick={() => openEdit(c)}><Pencil size={14} /></PontesIconButton>
                  <PontesIconButton size={32} variant="ghost" aria-label="Remover" onClick={() => setDelId(c.id)}><Trash2 size={14} /></PontesIconButton>
                </div>

                <div className={styles.cardFace}>
                  <div className={styles.faceTop}>
                    <div className={styles.cardNameWrap}>
                      <span className={styles.cardName}>{c.nome}</span>
                      {c.bancoNome && <span className={styles.cardEmissor}>{c.bancoNome}</span>}
                    </div>
                    <Wifi size={18} className={styles.contactless} />
                  </div>
                  <div className={styles.cardChip} />
                  <div className={styles.faceBottom}>
                    <div className={styles.faceBottomCol}>
                      <span className={styles.cardNumber}>•••• {c.ultimosDigitos ?? "••••"}</span>
                      <span className={styles.cardBandeira}>{c.bandeiraDescricao}</span>
                    </div>
                  </div>
                </div>

                {c.temCredito && c.limite ? (
                  <div className={styles.cardPanel}>
                    <div className={styles.panelTop}>
                      <div className={styles.cardDispWrap}>
                        <span className={styles.cardInfoLabel}>Disponível</span>
                        <span className={styles.cardDisp}>{formatMoney(c.limiteDisponivel ?? 0)}</span>
                      </div>
                      <div className={styles.cardInfoRight}>
                        <span className={styles.cardPct} data-over={over ? "true" : undefined}>{Math.round(pct)}%</span>
                        <span className={styles.cardOfLimit}>de {formatMoney(c.limite)}</span>
                      </div>
                    </div>
                    <div className={styles.bar}><div className={styles.barFill} data-over={over ? "true" : undefined} style={{ width: `${pct}%` }} /></div>
                    <div className={styles.cardMetaRow}>
                      <span>{(c.diaFechamento || c.diaVencimento)
                        ? `${c.diaFechamento ? `fecha dia ${c.diaFechamento}` : ""}${c.diaVencimento ? ` · vence dia ${c.diaVencimento}` : ""}`
                        : `${formatMoney(c.gastosNoCicloAtual)} usado`}</span>
                      <span className={styles.verFaturas}><ReceiptText size={12} /> {sel ? "Ocultar" : "Faturas"}</span>
                    </div>
                  </div>
                ) : (c.contaNome || c.temDebito || c.ehPrePago) ? (
                  <div className={styles.cardPanel}>
                    <div className={styles.cardMetaRow}>
                      <span>{c.contaNome ? "Conta que paga" : " "}</span>
                      {c.contaNome && <span className={styles.cardFootValue}>{c.contaNome}</span>}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {/* Painel de faturas */}
      {faturasCartaoId && cartaoAtivo && (
        <PontesCard padding={0} radius={16}>
          <div className={styles.faturaHead}>
            <span className={styles.faturaHeadIcon} style={{ background: grad(cartaoAtivo.bandeira) }}>
              <ReceiptText size={17} />
            </span>
            <div className={styles.faturaHeadText}>
              <div className={styles.faturaTitle}>Faturas — {cartaoAtivo.nome}</div>
              <div className={styles.faturaSub}>Fatura atual e histórico</div>
            </div>
          </div>

          {loadingFaturas ? (
            <div className={styles.faturaEmpty}>Carregando…</div>
          ) : faturas.length === 0 ? (
            <div className={styles.faturaEmpty}>Nenhuma fatura ainda. Registre uma compra no crédito pra criar a primeira.</div>
          ) : (
            <div className={styles.faturaBody}>
              {/* Fatura atual em destaque */}
              {faturaAtual && (() => {
                const st = STATUS[statusKey(faturaAtual)]
                const open = faturaAtual.valorRestante > 0
                const exp = expandedFaturaId === faturaAtual.id
                return (
                  <div className={styles.atual} data-open={open ? "true" : undefined}>
                    <div className={styles.atualTop}>
                      <div>
                        <div className={styles.atualLabel}>FATURA ATUAL · {formatDate(faturaAtual.dataInicio)} – {formatDate(faturaAtual.dataFechamento)}</div>
                        <div className={styles.atualValor}>{formatMoney(open ? faturaAtual.valorRestante : faturaAtual.valorTotal)}</div>
                        <div className={styles.atualMeta}>
                          <PontesBadge tone={st.tone} size="sm">{st.label}</PontesBadge>
                          <span className={styles.muted} data-venc={faturaAtual.vencida ? "true" : undefined}>
                            {faturaAtual.vencida ? "Vencida em " : "Vence "}{formatDate(faturaAtual.dataVencimento)}
                          </span>
                          {faturaAtual.valorPago > 0 && open && <span className={styles.muted}>Pago {formatMoney(faturaAtual.valorPago)} de {formatMoney(faturaAtual.valorTotal)}</span>}
                        </div>
                      </div>
                      {open && (
                        <PontesButton size="sm" iconStart={<Banknote size={16} strokeWidth={2.5} />}
                          onClick={() => openPagar(faturaAtual.id, faturasCartaoId, faturaAtual.valorRestante, cartaoAtivo.contaId)}>
                          Pagar
                        </PontesButton>
                      )}
                    </div>
                    {faturaAtual.valorPago > 0 && open && (
                      <div className={styles.paidBar} title={`Pago ${formatMoney(faturaAtual.valorPago)} de ${formatMoney(faturaAtual.valorTotal)}`}>
                        <div className={styles.paidFill} style={{ width: `${Math.min(100, (faturaAtual.valorPago / faturaAtual.valorTotal) * 100)}%` }} />
                      </div>
                    )}
                    <button type="button" className={styles.expandBtn} onClick={() => toggleFatura(faturaAtual.id, faturasCartaoId)}>
                      <ChevronDown size={14} className={exp ? styles.chevOpen : undefined} /> {exp ? "Ocultar lançamentos" : "Ver lançamentos"}
                    </button>
                    {exp && renderDetalhe(faturaAtual)}
                  </div>
                )
              })()}

              {/* Histórico */}
              {faturasHistorico.length > 0 && (
                <div className={styles.histWrap}>
                  <div className={styles.histTitle}>Histórico</div>
                  {faturasHistorico.map((f) => {
                    const st = STATUS[statusKey(f)]
                    const exp = expandedFaturaId === f.id
                    return (
                      <div key={f.id} className={styles.histItem}>
                        <button type="button" className={styles.histRow} onClick={() => toggleFatura(f.id, faturasCartaoId)}>
                          <ChevronDown size={15} className={exp ? styles.chevOpen : styles.chevClosed} />
                          <span className={styles.histPeriodo}>{formatDateShort(f.dataInicio)} – {formatDateShort(f.dataFechamento)}</span>
                          <PontesBadge tone={st.tone} size="sm">{st.label}</PontesBadge>
                          <span className={styles.histTotal}>{formatMoney(f.valorTotal)}</span>
                          <span className={styles.histRest} data-rest={f.valorRestante > 0 ? "open" : "done"}>
                            {f.valorRestante > 0 ? `Falta ${formatMoney(f.valorRestante)}` : "Paga"}
                          </span>
                          {f.valorRestante > 0 && (
                            <span className={styles.histPagar} onClick={(e) => { e.stopPropagation(); openPagar(f.id, faturasCartaoId, f.valorRestante, cartaoAtivo.contaId) }}>
                              <Banknote size={15} />
                            </span>
                          )}
                        </button>
                        {exp && renderDetalhe(f)}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </PontesCard>
      )}

      {/* Modal Criar/Editar Cartão */}
      <PontesModal
        open={dialogOpen}
        title={editingId ? "Editar cartão" : "Novo cartão"}
        onClose={() => setDialogOpen(false)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</PontesButton>
          <PontesButton onClick={handleSalvar} loading={loading} disabled={loading}>{editingId ? "Atualizar" : "Cadastrar"}</PontesButton>
        </>}
      >
        <div className={styles.modalCol}>
          <PontesField label="Modalidade" required>
            <PontesSelect
              value={form.modo}
              onChange={(v) => setForm((f) => ({ ...f, modo: v as Modo, contaId: undefined, limite: undefined, diaFechamento: undefined, diaVencimento: undefined }))}
              options={MODOS.map((m) => ({ value: m.value, label: m.label }))}
            />
          </PontesField>
          <PontesField label="Nome do cartão" required error={formErrors.nome}>
            <PontesInput value={form.nome} onChange={(e) => { setF("nome", e.target.value); setFormErrors((p) => ({ ...p, nome: undefined })) }} invalid={!!formErrors.nome} placeholder="Ex: Nubank Roxinho" />
          </PontesField>
          <div className={styles.grid2}>
            <PontesField label="Bandeira">
              <PontesSelect value={String(form.bandeira)} onChange={(v) => setF("bandeira", Number(v))} options={BANDEIRAS} />
            </PontesField>
            <PontesField label="Últimos 4 dígitos" error={formErrors.ultimosDigitos}>
              <PontesInput
                value={form.ultimosDigitos ?? ""}
                onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setF("ultimosDigitos", d || undefined); clearErr("ultimosDigitos") }}
                invalid={!!formErrors.ultimosDigitos}
                inputMode="numeric" maxLength={4} placeholder="0000"
              />
            </PontesField>
          </div>
          <PontesField label="Banco emissor" required error={formErrors.bancoId}>
            <PontesSelect value={form.bancoId ?? ""} onChange={(v) => { setF("bancoId", v || undefined); clearErr("bancoId") }} invalid={!!formErrors.bancoId} placeholder="Quem emitiu o cartão" options={bancos.map((b) => ({ value: b.id, label: b.nome }))} />
          </PontesField>
          {!isPrePago && (
            <PontesField label="Conta que paga a fatura">
              <PontesSelect
                value={form.contaId ?? ""}
                onChange={(v) => setF("contaId", v || undefined)}
                placeholder="Opcional — escolhe ao pagar"
                options={contas.map((c) => ({ value: c.id, label: c.nome }))}
              />
            </PontesField>
          )}
          {temCredito && (
            <PontesField label="Limite de crédito" required error={formErrors.limite}>
              <PontesInput
                iconStart="R$"
                value={fmtMoneyInput(form.limite)}
                onChange={(e) => { setF("limite", parseMoney(e.target.value)); clearErr("limite") }}
                invalid={!!formErrors.limite}
                inputMode="decimal" placeholder="0,00"
              />
            </PontesField>
          )}
          {temCredito && (
            <div className={styles.grid2}>
              <PontesField label="Dia fechamento" required error={formErrors.diaFechamento}>
                <PontesInput type="number" value={form.diaFechamento != null ? String(form.diaFechamento) : ""} onChange={(e) => { setF("diaFechamento", e.target.value ? Number(e.target.value) : undefined); clearErr("diaFechamento") }} invalid={!!formErrors.diaFechamento} min={1} max={31} step={1} inputMode="numeric" />
              </PontesField>
              <PontesField label="Dia vencimento" required error={formErrors.diaVencimento}>
                <PontesInput type="number" value={form.diaVencimento != null ? String(form.diaVencimento) : ""} onChange={(e) => { setF("diaVencimento", e.target.value ? Number(e.target.value) : undefined); clearErr("diaVencimento") }} invalid={!!formErrors.diaVencimento} min={1} max={31} step={1} inputMode="numeric" />
              </PontesField>
            </div>
          )}
        </div>
      </PontesModal>

      {/* Modal Pagar Fatura */}
      <PontesModal
        open={!!pagarFaturaId}
        title="Pagar fatura"
        onClose={() => setPagarFaturaId(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setPagarFaturaId(null)}>Cancelar</PontesButton>
          <PontesButton onClick={handlePagar} loading={pagarLoading} disabled={pagarLoading}>Confirmar pagamento</PontesButton>
        </>}
      >
        <div className={styles.modalCol}>
          <PontesField label="Conta de débito" required error={pagarErrors.conta}>
            <PontesSelect
              value={pagarForm.contaId}
              onChange={(v) => { setPagarForm((f) => ({ ...f, contaId: v })); setPagarErrors((p) => ({ ...p, conta: undefined })) }}
              placeholder="Selecione a conta"
              invalid={!!pagarErrors.conta}
              options={contas.map((c) => ({ value: c.id, label: c.nome }))}
            />
          </PontesField>
          <PontesField label="Valor" required error={pagarErrors.valor}>
            <PontesInput type="number" value={pagarForm.valor} onChange={(e) => { setPagarForm((f) => ({ ...f, valor: e.target.value })); setPagarErrors((p) => ({ ...p, valor: undefined })) }} invalid={!!pagarErrors.valor} min={0.01} step="0.01" />
          </PontesField>
          <div className={styles.grid2}>
            <PontesField label="Data do pagamento" required>
              <PontesInput type="date" value={pagarForm.dataPagamento} onChange={(e) => setPagarForm((f) => ({ ...f, dataPagamento: e.target.value }))} />
            </PontesField>
            <PontesField label="Meio de pagamento">
              <PontesSelect value={pagarForm.meioPagamento} onChange={(v) => setPagarForm((f) => ({ ...f, meioPagamento: v }))} options={MEIOS_PAGAMENTO} />
            </PontesField>
          </div>
        </div>
      </PontesModal>

      <PontesDialog
        open={delId !== null}
        title="Remover cartão?"
        description="Todas as transações e faturas vinculadas também serão excluídas."
        confirmLabel="Remover"
        onConfirm={handleDelete}
        onCancel={() => setDelId(null)}
      />
    </div>
  )
}
