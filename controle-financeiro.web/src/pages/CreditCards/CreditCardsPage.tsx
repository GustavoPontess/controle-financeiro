import React, { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import {
  Plus, Pencil, Trash2, CreditCard, ReceiptText, Wallet, ChevronRight, ChevronDown, Banknote,
} from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesBadge, PontesCard, PontesModal, PontesDialog,
  PontesField, PontesInput, PontesSelect, PontesProgress, PontesEmptyState,
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
// Datas de ciclo vêm como UTC (meia-noite) — formata em UTC pra não cair pro dia anterior.
const formatDate = (s: string) => new Date(s).toLocaleDateString("pt-BR", { timeZone: "UTC" })

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

type FormState = Omit<CriarCartaoCredito, "temCredito" | "temDebito" | "ehPrePago"> & { modo: Modo }
const emptyForm: FormState = {
  nome: "", ultimosDigitos: undefined, bandeira: 6, modo: "credito_debito",
  limite: undefined, diaFechamento: undefined, diaVencimento: undefined, contaId: undefined, bancoId: undefined,
}

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

export default function CreditCardsPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [bancos, setBancos] = useState<Banco[]>([])

  // Modal cartão
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formErrors, setFormErrors] = useState<{ nome?: string; conta?: string }>({})
  const [loading, setLoading] = useState(false)

  // Faturas
  const [faturasCartaoId, setFaturasCartaoId] = useState<string | null>(null)
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [loadingFaturas, setLoadingFaturas] = useState(false)
  const [expandedFaturaId, setExpandedFaturaId] = useState<string | null>(null)
  const [faturaDetalhes, setFaturaDetalhes] = useState<Record<string, FaturaDetalhe>>({})

  // Pagamento
  const [pagarFaturaId, setPagarFaturaId] = useState<string | null>(null)
  const [pagarCartaoId, setPagarCartaoId] = useState<string | null>(null)
  const [pagarForm, setPagarForm] = useState({
    contaId: "", valor: "", dataPagamento: new Date().toISOString().split("T")[0], meioPagamento: "4",
  })
  const [pagarErrors, setPagarErrors] = useState<{ conta?: string; valor?: string }>({})
  const [pagarLoading, setPagarLoading] = useState(false)

  // Exclusão
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

  // Recarrega quando uma transação é criada pelo popup global (gastos/limite/fatura).
  useEffect(() => {
    const onCreated = () => {
      void loadData()
      if (faturasCartaoId) getFaturasByCartao(faturasCartaoId).then(setFaturas).catch(() => { /* ignore */ })
    }
    window.addEventListener("transactionCreated", onCreated)
    return () => window.removeEventListener("transactionCreated", onCreated)
  }, [loadData, faturasCartaoId])

  const openFaturas = async (cartaoId: string) => {
    if (faturasCartaoId === cartaoId) { setFaturasCartaoId(null); return }
    setFaturasCartaoId(cartaoId)
    setLoadingFaturas(true)
    try { setFaturas(await getFaturasByCartao(cartaoId)) }
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
      if (faturasCartaoId) setFaturas(await getFaturasByCartao(faturasCartaoId))
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
    const e: { nome?: string; conta?: string } = {}
    if (!form.nome.trim()) e.nome = "Informe o nome do cartão"
    if (form.modo !== "prepago" && !form.contaId) e.conta = "Selecione a conta vinculada"
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
  const isPrePago = form.modo === "prepago"
  const temCredito = form.modo === "credito" || form.modo === "credito_debito"
  const cartaoAtivo = cartoes.find((c) => c.id === faturasCartaoId)

  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Cartões</h1>
          <div className={styles.subtitle}>Gerencie seus cartões e acompanhe faturas</div>
        </div>
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={openCreate}>
          Novo Cartão
        </PontesButton>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        {[
          { label: "Total de Cartões", value: String(cartoes.length), sub: cartoes.length === 1 ? "cartão cadastrado" : "cartões cadastrados", icon: <CreditCard size={18} /> },
          { label: "Limite Total", value: formatMoney(totalLimite), sub: "cartões com crédito", icon: <Wallet size={18} /> },
          { label: "Gastos no Ciclo", value: formatMoney(totalGastos), sub: "ciclo atual", icon: <ReceiptText size={18} /> },
        ].map((s) => (
          <PontesCard key={s.label} padding={20} radius={14}>
            <div className={styles.statHead}>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={styles.statIcon}>{s.icon}</span>
            </div>
            <div className={styles.statValue}>{s.value}</div>
            <div className={styles.statSub}>{s.sub}</div>
          </PontesCard>
        ))}
      </div>

      {/* Cards grid */}
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
            const sel = faturasCartaoId === c.id
            return (
              <div key={c.id} className={styles.card} data-selected={sel ? "true" : undefined}>
                {/* Visual do cartão */}
                <div className={styles.cardVisual} style={{ background: grad(c.bandeira) }}>
                  <div className={styles.cardCircle1} />
                  <div className={styles.cardCircle2} />
                  <div className={styles.cardVisualHead}>
                    <span className={styles.cardName}>{c.nome}</span>
                    <span className={styles.cardChip} />
                  </div>
                  <div className={styles.cardVisualFoot}>
                    <span className={styles.cardDigits}>
                      {c.ultimosDigitos ? `•••• •••• •••• ${c.ultimosDigitos}` : "•••• •••• •••• ••••"}
                    </span>
                    <span className={styles.cardBandeira}>{c.bandeiraDescricao}</span>
                  </div>
                </div>

                {/* Info + ações */}
                <div className={styles.cardBody}>
                  <div className={styles.actionsRow}>
                    <div className={styles.chips}>
                      {c.temCredito && <PontesBadge tone="soft" size="sm">Crédito</PontesBadge>}
                      {c.temDebito && <PontesBadge tone="success" size="sm">Débito</PontesBadge>}
                      {c.ehPrePago && <PontesBadge tone="neutral" size="sm">Pré-Pago</PontesBadge>}
                    </div>
                    <div className={styles.icons}>
                      {c.temCredito && (
                        <PontesIconButton size={32} variant="ghost" aria-label="Ver faturas" onClick={() => openFaturas(c.id)}>
                          <ReceiptText size={15} />
                        </PontesIconButton>
                      )}
                      <PontesIconButton size={32} variant="ghost" aria-label="Editar" onClick={() => openEdit(c)}>
                        <Pencil size={15} />
                      </PontesIconButton>
                      <PontesIconButton size={32} variant="ghost" aria-label="Remover" onClick={() => setDelId(c.id)}>
                        <Trash2 size={15} />
                      </PontesIconButton>
                    </div>
                  </div>

                  {c.contaNome && (
                    <div className={styles.contaRow}>
                      <span className={styles.muted}>Conta vinculada</span>
                      <span className={styles.strong}>{c.contaNome}</span>
                    </div>
                  )}

                  {(c.diaFechamento || c.diaVencimento) && (
                    <div className={styles.chips}>
                      {c.diaFechamento && <PontesBadge tone="neutral" size="sm">{`Fecha dia ${c.diaFechamento}`}</PontesBadge>}
                      {c.diaVencimento && <PontesBadge tone="warning" size="sm">{`Vence dia ${c.diaVencimento}`}</PontesBadge>}
                    </div>
                  )}

                  {c.temCredito && c.limite && (
                    <div>
                      <div className={styles.limitHead}>
                        <span className={styles.muted}>Utilizado</span>
                        <span className={styles.limitVal} data-over={pct > 80 ? "true" : undefined}>
                          {formatMoney(c.gastosNoCicloAtual)} <span className={styles.muted}>/ {formatMoney(c.limite)}</span>
                        </span>
                      </div>
                      <PontesProgress value={pct} showValue={false} height={6} color={pct > 80 ? "var(--pontes-danger)" : "var(--pontes-primary)"} />
                      <div className={styles.limitFoot}>
                        <span className={styles.muted}>Disponível</span>
                        <span className={styles.dispVal}>{formatMoney(c.limiteDisponivel ?? 0)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Painel de Faturas */}
      {faturasCartaoId && cartaoAtivo && (
        <PontesCard padding={0} radius={14}>
          <div className={styles.faturaHead}>
            <span className={styles.faturaHeadIcon} style={{ background: grad(cartaoAtivo.bandeira) }}>
              <ReceiptText size={17} />
            </span>
            <div>
              <div className={styles.faturaTitle}>Faturas — {cartaoAtivo.nome}</div>
              <div className={styles.faturaSub}>Histórico de faturas</div>
            </div>
          </div>

          {loadingFaturas ? (
            <div className={styles.faturaEmpty}>Carregando…</div>
          ) : faturas.length === 0 ? (
            <div className={styles.faturaEmpty}>
              Nenhuma fatura encontrada. Registre uma transação de crédito para criar a primeira fatura.
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thIcon} />
                    <th className={styles.th}>Período</th>
                    <th className={styles.th}>Vencimento</th>
                    <th className={styles.th}>Status</th>
                    <th className={styles.thRight}>Total</th>
                    <th className={styles.thRight}>Pago</th>
                    <th className={styles.thRight}>Restante</th>
                    <th className={styles.thCenter}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {faturas.map((f) => {
                    const statusKey = f.estadoPagamento === 2 ? 3 : f.estadoCiclo === 1 ? 2 : 1
                    const st = STATUS[statusKey]
                    const isExpanded = expandedFaturaId === f.id
                    const detalhe = faturaDetalhes[f.id]
                    const paidIds = (() => {
                      const ids = new Set<string>()
                      if (!detalhe?.transacoes?.length) return ids
                      const sorted = [...detalhe.transacoes].sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime())
                      let cum = 0
                      for (const t of sorted) { cum += t.valor; if (f.valorPago >= cum) ids.add(t.id) }
                      return ids
                    })()
                    return (
                      <React.Fragment key={f.id}>
                        <tr className={styles.faturaRow} data-expanded={isExpanded ? "true" : undefined} onClick={() => toggleFatura(f.id, faturasCartaoId)}>
                          <td className={styles.tdIcon}>
                            <span className={styles.chev}>{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                          </td>
                          <td className={styles.td}>{formatDate(f.dataInicio)} – {formatDate(f.dataFechamento)}</td>
                          <td className={styles.td}>
                            <span data-vencida={f.vencida ? "true" : undefined} className={styles.venc}>{formatDate(f.dataVencimento)}</span>
                            {f.vencida && <span className={styles.vencidaTag}>Vencida</span>}
                          </td>
                          <td className={styles.td}><PontesBadge tone={st.tone} size="sm">{st.label}</PontesBadge></td>
                          <td className={styles.tdRight} data-strong="true">{formatMoney(f.valorTotal)}</td>
                          <td className={styles.tdRight} data-pos="true">{formatMoney(f.valorPago)}</td>
                          <td className={styles.tdRight} data-rest={f.valorRestante > 0 ? "open" : "done"}>{formatMoney(f.valorRestante)}</td>
                          <td className={styles.tdCenter} onClick={(e) => e.stopPropagation()}>
                            {f.valorRestante > 0 && (
                              <PontesIconButton size={32} variant="ghost" aria-label="Pagar fatura"
                                onClick={() => openPagar(f.id, faturasCartaoId, f.valorRestante, cartaoAtivo.contaId)}>
                                <Banknote size={16} />
                              </PontesIconButton>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className={styles.detailCell}>
                              {!detalhe ? (
                                <div className={styles.detailLoading}>Carregando…</div>
                              ) : detalhe.transacoes.length === 0 ? (
                                <div className={styles.detailEmpty}>Nenhuma transação nesta fatura.</div>
                              ) : (
                                <table className={styles.detailTable}>
                                  <thead>
                                    <tr>
                                      <th className={styles.th}>Data</th>
                                      <th className={styles.th}>Horário</th>
                                      <th className={styles.th}>Descrição</th>
                                      <th className={styles.th}>Categoria</th>
                                      <th className={styles.thRight}>Valor</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detalhe.transacoes.map((t) => (
                                      <tr key={t.id}>
                                        <td className={styles.td}>{new Date(t.data).toLocaleDateString("pt-BR")}</td>
                                        <td className={styles.tdMono}>{new Date(t.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                                        <td className={styles.td}>{t.descricao}</td>
                                        <td className={styles.tdMuted}>{t.categoriaDescricao ?? "—"}</td>
                                        <td className={styles.tdRight} data-paid={paidIds.has(t.id) ? "true" : "false"}>{formatMoney(t.valor)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
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
            <PontesField label="Últimos 4 dígitos">
              <PontesInput value={form.ultimosDigitos ?? ""} onChange={(e) => setF("ultimosDigitos", e.target.value || undefined)} maxLength={4} placeholder="0000" />
            </PontesField>
          </div>

          {!isPrePago && (
            <PontesField label={temCredito ? "Conta que paga a fatura" : "Conta vinculada"} required error={formErrors.conta}>
              <PontesSelect
                value={form.contaId ?? ""}
                onChange={(v) => { const conta = contas.find((c) => c.id === v); setForm((f) => ({ ...f, contaId: v || undefined, bancoId: conta?.bancoId })); setFormErrors((p) => ({ ...p, conta: undefined })) }}
                placeholder="Selecione a conta"
                invalid={!!formErrors.conta}
                options={contas.map((c) => ({ value: c.id, label: c.nome }))}
              />
            </PontesField>
          )}
          {isPrePago && (
            <PontesField label="Banco emissor">
              <PontesSelect value={form.bancoId ?? ""} onChange={(v) => setF("bancoId", v || undefined)} placeholder="Sem vínculo" options={bancos.map((b) => ({ value: b.id, label: b.nome }))} />
            </PontesField>
          )}

          {temCredito && (
            <PontesField label="Limite de crédito">
              <PontesInput type="number" value={form.limite != null ? String(form.limite) : ""} onChange={(e) => setF("limite", e.target.value ? Number(e.target.value) : undefined)} min={0} step="0.01" />
            </PontesField>
          )}
          {temCredito && (
            <div className={styles.grid2}>
              <PontesField label="Dia fechamento">
                <PontesInput type="number" value={form.diaFechamento != null ? String(form.diaFechamento) : ""} onChange={(e) => setF("diaFechamento", e.target.value ? Number(e.target.value) : undefined)} min={1} max={31} />
              </PontesField>
              <PontesField label="Dia vencimento">
                <PontesInput type="number" value={form.diaVencimento != null ? String(form.diaVencimento) : ""} onChange={(e) => setF("diaVencimento", e.target.value ? Number(e.target.value) : undefined)} min={1} max={31} />
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

      {/* Confirmação de exclusão */}
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
