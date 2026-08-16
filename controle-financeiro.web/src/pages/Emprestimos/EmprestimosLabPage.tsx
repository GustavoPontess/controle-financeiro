// Página de teste — NÃO é feature, é bancada pra comparar composições diferentes da lista de
// Empréstimos lado a lado, com dado real e AÇÕES REAIS (mesmos serviços da tela principal),
// antes de decidir o que vira a tela de verdade. Rota /emprestimos-lab, sem link no menu.
import React, { useCallback, useEffect, useState } from "react"
import { formatMoney } from "@/utils/money"
import { useOutletContext } from "react-router-dom"
import { AlertCircle, Receipt, Handshake, History, ChevronDown, Trash2 } from "lucide-react"
import {
  PontesCard, PontesBadge, PontesIconButton, PontesModal, PontesDialog, PontesButton,
  PontesField, PontesInput, PontesSelect,
} from "@/components/pontes"
import {
  listEmprestimosPage, getEmprestimoStats, quitarEmprestimo, deleteEmprestimo,
  solicitarPagamentoEmprestimo, listSolicitacoesPagamento, listParcelasEmprestimo,
} from "../../services/emprestimoService"
import type { EmprestimoStats } from "../../services/emprestimoService"
import {
  StatusVinculoEmprestimo, FormaPagamentoEmprestimo,
  type Emprestimo, type EmprestimoPagamentoSolicitacao, type EmprestimoParcela,
} from "../../types/Emprestimo"
import { getContas } from "../../services/contaService"
import { getCategories } from "../../services/categoryService"
import { listTransactionsPage } from "../../services/transactionService"
import type { Conta } from "../../types/Conta"
import type { Category } from "../../types/Category"
import type { Transaction } from "../../types/Transaction"
import styles from "./EmprestimosLabPage.module.css"

const errorMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"

const parseMoney = (masked: string): number | undefined => {
  const digits = masked.replace(/\D/g, "")
  return digits ? Number(digits) / 100 : undefined
}
const fmtMoney = (n?: number): string =>
  n != null ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""

type EscolhaComprovante = "" | "existente" | "novo"

function GateOption({ name, value, current, onChange, children }: {
  name: string; value: string; current: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <label className={styles.gateOption} data-selected={current === value ? "" : undefined}>
      <input type="radio" name={name} checked={current === value} onChange={() => onChange(value)} />
      {children}
    </label>
  )
}

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

/** Mesmo cluster de status da tela real — reaproveitado nas 3 variantes. */
function StatusBadges({ e }: { e: Emprestimo }) {
  return (
    <>
      {e.vencido && <PontesBadge tone="danger" size="sm">Vencido</PontesBadge>}
      {e.statusVinculo === StatusVinculoEmprestimo.Vinculado && (
        <PontesBadge tone="success" size="sm">Vinculado</PontesBadge>
      )}
      {e.statusVinculo === StatusVinculoEmprestimo.PendenteAceite && (
        <PontesBadge tone="warning" size="sm">Convite pendente</PontesBadge>
      )}
      {e.souCredor && e.valorPendente > 0 && (
        <PontesBadge tone="warning" size="sm"><AlertCircle size={12} /> Aguardando aprovação</PontesBadge>
      )}
    </>
  )
}

type Handlers = {
  onExpand: (id: string) => void
  onRegistrar: (id: string) => void
  onQuitar: (id: string) => void
  onHistorico: (id: string) => void
  onRemover: (id: string) => void
}

/** Mesmos ícones de ação da tela real, ligados nos MESMOS serviços — clicar aqui mexe no dado
 * de verdade (mesma trava de sempre: quitar/registrar/remover pedem confirmação antes). */
function ActionIcons({ e, size = 32, h }: { e: Emprestimo; size?: 24 | 32; h: Handlers }) {
  const isParcelado = e.formaPagamento === FormaPagamentoEmprestimo.Parcelado
  return (
    <div className={styles.actions}>
      {isParcelado && (
        <PontesIconButton size={size} variant="ghost" aria-label="Ver parcelas" onClick={() => h.onExpand(e.id)}>
          <ChevronDown size={14} />
        </PontesIconButton>
      )}
      <PontesIconButton size={size} variant="ghost" aria-label="Registrar pagamento" onClick={() => h.onRegistrar(e.id)}>
        <Receipt size={14} />
      </PontesIconButton>
      {e.souCredor && (
        <PontesIconButton size={size} variant="ghost" aria-label="Marcar como quitado" onClick={() => h.onQuitar(e.id)}>
          <Handshake size={14} />
        </PontesIconButton>
      )}
      <PontesIconButton size={size} variant="ghost" aria-label="Ver histórico" onClick={() => h.onHistorico(e.id)}>
        <History size={14} />
      </PontesIconButton>
      <PontesIconButton size={size} variant="ghost" aria-label="Remover" onClick={() => h.onRemover(e.id)}>
        <Trash2 size={14} />
      </PontesIconButton>
    </div>
  )
}

/** Parcelas expandidas — versão enxuta (sem aprovar/rejeitar por parcela, isso fica só na tela
 * real) só pra mostrar que "Ver parcelas" busca dado de verdade. */
function ParcelasInline({ emprestimoId, loading, parcelas }: {
  emprestimoId: string; loading: boolean; parcelas: EmprestimoParcela[]
}) {
  if (loading) return <div className={styles.parcelasWrap}>Carregando…</div>
  return (
    <div className={styles.parcelasWrap} key={emprestimoId}>
      {parcelas.map((p) => (
        <div key={p.id} className={styles.parcelaRow}>
          <span>{p.numero}/{p.quantidadeTotal}</span>
          <span>vence {formatDate(p.dataVencimento)}</span>
          <span>{formatMoney(p.valorComMulta ?? p.valorComJuros ?? p.valor)}</span>
          <PontesBadge size="sm" tone={p.status === 2 ? "success" : p.atrasada ? "danger" : "neutral"}>
            {p.statusDescricao}
          </PontesBadge>
        </div>
      ))}
    </div>
  )
}

export default function EmprestimosLabPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([])
  const [stats, setStats] = useState<EmprestimoStats | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [despesasRecentes, setDespesasRecentes] = useState<Transaction[]>([])
  const [despesasLoading, setDespesasLoading] = useState(false)
  const [receitasRecentes, setReceitasRecentes] = useState<Transaction[]>([])
  const [receitasLoading, setReceitasLoading] = useState(false)

  const [quitarId, setQuitarId] = useState<string | null>(null)
  const [delId, setDelId] = useState<string | null>(null)
  const [historicoFor, setHistoricoFor] = useState<string | null>(null)
  const [historico, setHistorico] = useState<EmprestimoPagamentoSolicitacao[]>([])
  const [historicoLoading, setHistoricoLoading] = useState(false)

  const [solicitarFor, setSolicitarFor] = useState<string | null>(null)
  const [solicitarForm, setSolicitarForm] = useState<{ valor?: number; contaId: string; categoriaId: string }>({ valor: undefined, contaId: "", categoriaId: "" })
  const [solicitarErrors, setSolicitarErrors] = useState<{ valor?: string; contaId?: string; categoriaId?: string; escolha?: string; transacaoExistenteId?: string }>({})
  const [solicitarIdemKey, setSolicitarIdemKey] = useState("")
  const [solicitarEscolha, setSolicitarEscolha] = useState<EscolhaComprovante>("")
  const [solicitarTransacaoExistenteId, setSolicitarTransacaoExistenteId] = useState("")
  const [loading, setLoading] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [parcelasPorEmprestimo, setParcelasPorEmprestimo] = useState<Record<string, EmprestimoParcela[]>>({})
  const [parcelasLoadingId, setParcelasLoadingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [page, s, contasResult, categoriasResult] = await Promise.all([
        listEmprestimosPage(1, 100, false),
        getEmprestimoStats(),
        getContas(),
        getCategories(),
      ])
      setEmprestimos(page.items.filter((e) => !e.quitado))
      setStats(s)
      setContas(contasResult)
      setCategorias(categoriasResult)
    } catch {
      notify({ open: true, message: "Erro ao carregar empréstimos", severity: "error" })
    }
  }, [notify])

  useEffect(() => { void loadData() }, [loadData])

  const carregarDespesasRecentes = useCallback(async () => {
    if (despesasRecentes.length > 0) return
    setDespesasLoading(true)
    try {
      const res = await listTransactionsPage(1, 50, { tipo: 1, ordenacao: "data_desc" })
      setDespesasRecentes(res.items)
    } catch {
      notify({ open: true, message: "Erro ao carregar suas despesas recentes", severity: "error" })
    } finally { setDespesasLoading(false) }
  }, [despesasRecentes.length, notify])

  const carregarReceitasRecentes = useCallback(async () => {
    if (receitasRecentes.length > 0) return
    setReceitasLoading(true)
    try {
      const res = await listTransactionsPage(1, 50, { tipo: 2, ordenacao: "data_desc" })
      setReceitasRecentes(res.items)
    } catch {
      notify({ open: true, message: "Erro ao carregar suas receitas recentes", severity: "error" })
    } finally { setReceitasLoading(false) }
  }, [receitasRecentes.length, notify])

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (parcelasPorEmprestimo[id]) return
    setParcelasLoadingId(id)
    try {
      const lista = await listParcelasEmprestimo(id)
      setParcelasPorEmprestimo((p) => ({ ...p, [id]: lista }))
    } catch {
      notify({ open: true, message: "Erro ao carregar parcelas", severity: "error" })
    } finally { setParcelasLoadingId(null) }
  }

  const openSolicitar = (emprestimoId: string) => {
    setSolicitarFor(emprestimoId)
    setSolicitarForm({ valor: undefined, contaId: "", categoriaId: "" })
    setSolicitarErrors({})
    setSolicitarIdemKey(crypto.randomUUID())
    setSolicitarEscolha("")
    setSolicitarTransacaoExistenteId("")
  }

  const handleSolicitarEscolhaChange = (v: string) => {
    setSolicitarEscolha(v as EscolhaComprovante)
    setSolicitarErrors((p) => ({ ...p, escolha: undefined }))
    const souCredor = emprestimos.find((x) => x.id === solicitarFor)?.souCredor
    if (v === "existente") void (souCredor ? carregarReceitasRecentes() : carregarDespesasRecentes())
  }

  const handleSolicitar = async () => {
    if (!solicitarFor) return
    const emprestimoAlvo = emprestimos.find((x) => x.id === solicitarFor)
    const souCredor = emprestimoAlvo?.souCredor ?? false
    const mensagemSucesso = (qtd: number) => {
      const base = souCredor ? "Pagamento registrado" : "Pagamento marcado — aguardando aprovação do credor"
      return qtd > 1 ? `${base} (${qtd} parcelas)` : base
    }

    if (!solicitarEscolha) { setSolicitarErrors({ escolha: "Escolha uma opção" }); return }

    if (solicitarEscolha === "existente") {
      if (!solicitarTransacaoExistenteId) {
        setSolicitarErrors({ transacaoExistenteId: souCredor ? "Escolha a receita que já lançou" : "Escolha a despesa que já lançou" })
        return
      }
      setLoading(true)
      try {
        const resultado = await solicitarPagamentoEmprestimo(solicitarFor, {
          valor: 0, data: new Date().toISOString(),
          transacaoExistenteId: solicitarTransacaoExistenteId, idempotencyKey: solicitarIdemKey,
        })
        notify({ open: true, message: mensagemSucesso(resultado.length), severity: "success" })
        setSolicitarFor(null)
        await loadData()
      } catch (err) {
        notify({ open: true, message: errorMessage(err, "Erro ao registrar pagamento"), severity: "error" })
      } finally { setLoading(false) }
      return
    }

    const errs: { valor?: string; contaId?: string; categoriaId?: string } = {}
    if (solicitarForm.valor == null || solicitarForm.valor <= 0) errs.valor = "Informe um valor maior que zero"
    if (!solicitarForm.contaId) errs.contaId = "Escolha a conta"
    if (!solicitarForm.categoriaId) errs.categoriaId = "Escolha a categoria"
    setSolicitarErrors(errs)
    if (Object.keys(errs).length) return

    setLoading(true)
    try {
      const resultado = await solicitarPagamentoEmprestimo(solicitarFor, {
        valor: solicitarForm.valor!, contaId: solicitarForm.contaId, categoriaId: solicitarForm.categoriaId,
        data: new Date().toISOString(), idempotencyKey: solicitarIdemKey,
      })
      notify({ open: true, message: mensagemSucesso(resultado.length), severity: "success" })
      setSolicitarFor(null)
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao registrar pagamento"), severity: "error" })
    } finally { setLoading(false) }
  }

  const handleQuitar = async () => {
    if (!quitarId) return
    try {
      await quitarEmprestimo(quitarId)
      notify({ open: true, message: "Empréstimo quitado", severity: "success" })
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao quitar empréstimo"), severity: "error" })
    } finally { setQuitarId(null) }
  }

  const handleDelete = async () => {
    if (!delId) return
    try {
      await deleteEmprestimo(delId)
      notify({ open: true, message: "Empréstimo removido", severity: "success" })
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao remover empréstimo"), severity: "error" })
    } finally { setDelId(null) }
  }

  const carregarHistorico = async (emprestimoId: string) => {
    setHistoricoLoading(true)
    try {
      setHistorico(await listSolicitacoesPagamento(emprestimoId))
    } catch {
      notify({ open: true, message: "Erro ao carregar histórico de pagamentos", severity: "error" })
    } finally { setHistoricoLoading(false) }
  }

  const openHistorico = (emprestimoId: string) => {
    setHistoricoFor(emprestimoId)
    void carregarHistorico(emprestimoId)
  }

  const h: Handlers = {
    onExpand: (id) => void toggleExpand(id),
    onRegistrar: openSolicitar,
    onQuitar: setQuitarId,
    onHistorico: openHistorico,
    onRemover: setDelId,
  }

  const ativos = emprestimos
  const grupos = ativos.reduce<Record<string, Emprestimo[]>>((acc, e) => {
    const chave = e.contraparteNome ?? e.pessoa
    ;(acc[chave] ??= []).push(e)
    return acc
  }, {})

  const solicitarEmprestimoAtual = emprestimos.find((x) => x.id === solicitarFor)
  const isParceladoSolicitar = solicitarEmprestimoAtual?.formaPagamento === FormaPagamentoEmprestimo.Parcelado
  const souCredorSolicitar = solicitarEmprestimoAtual?.souCredor ?? false

  return (
    <div className={styles.root}>
      <div className={styles.introBox}>
        <strong>Bancada de teste</strong> — 3 formas diferentes de mostrar a lista de empréstimos
        ativos ({ativos.length} agora), com AÇÕES REAIS (mesmo serviço da tela principal — clicar
        aqui mexe no dado de verdade, com as mesmas confirmações de sempre). "Ver histórico" é
        só leitura aqui (aprovar/rejeitar parcela fica só na tela real).
      </div>

      {stats && (
        <div className={styles.statsRow}>
          <span>A receber <strong>{formatMoney(stats.totalAReceber)}</strong></span>
          <span>A pagar <strong>{formatMoney(stats.totalAPagar)}</strong></span>
          <span>Vencido <strong>{formatMoney(stats.totalAReceberVencido)}</strong></span>
        </div>
      )}

      {/* ── Variante A: Extrato ── */}
      <section className={styles.variant}>
        <h2 className={styles.variantTitle}>A · Extrato</h2>
        <p className={styles.variantHint}>1 linha por empréstimo, sem card. Ações no hover.</p>
        <PontesCard padding={0} radius={16}>
          <ul className={styles.extratoList}>
            {ativos.map((e) => {
              const isParcelado = e.formaPagamento === FormaPagamentoEmprestimo.Parcelado
              const tone = e.vencido ? "danger" : e.souCredor ? "success" : "warning"
              return (
                <React.Fragment key={e.id}>
                  <li className={styles.extratoRow} data-tone={tone}>
                    <div className={styles.extratoMain}>
                      <div className={styles.extratoHead}>
                        <span className={styles.extratoDesc}>{e.descricao}</span>
                        <StatusBadges e={e} />
                      </div>
                      <span className={styles.extratoSub}>
                        {e.contraparteNome ?? e.pessoa} · {isParcelado ? `${e.quantidadeParcelas}x` : "à vista"}
                      </span>
                    </div>
                    <ActionIcons e={e} size={24} h={h} />
                    <span className={styles.extratoValor} data-tone={tone}>{formatMoney(e.valorRestante)}</span>
                  </li>
                  {isParcelado && expandedId === e.id && (
                    <ParcelasInline emprestimoId={e.id} loading={parcelasLoadingId === e.id} parcelas={parcelasPorEmprestimo[e.id] ?? []} />
                  )}
                </React.Fragment>
              )
            })}
          </ul>
        </PontesCard>
      </section>

      {/* ── Variante B: Tabela ── */}
      <section className={styles.variant}>
        <h2 className={styles.variantTitle}>B · Tabela</h2>
        <p className={styles.variantHint}>Colunas fixas, ações sempre visíveis numa coluna própria.</p>
        <PontesCard padding={0} radius={16}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Empréstimo</th><th>Pessoa</th><th>Forma</th><th>Status</th>
                <th className={styles.tRight}>Restante</th><th className={styles.tRight}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ativos.map((e) => {
                const isParcelado = e.formaPagamento === FormaPagamentoEmprestimo.Parcelado
                return (
                  <React.Fragment key={e.id}>
                    <tr>
                      <td className={styles.tDesc} title={e.descricao}>{e.descricao}</td>
                      <td>{e.contraparteNome ?? e.pessoa}</td>
                      <td>{isParcelado ? `${e.quantidadeParcelas}x` : "à vista"}</td>
                      <td><div className={styles.tBadges}><StatusBadges e={e} /></div></td>
                      <td className={styles.tRight}>
                        <strong data-tone={e.souCredor ? "success" : "danger"} className={styles.tValor}>
                          {formatMoney(e.valorRestante)}
                        </strong>
                      </td>
                      <td className={styles.tRight}><ActionIcons e={e} size={24} h={h} /></td>
                    </tr>
                    {isParcelado && expandedId === e.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: 0 }}>
                          <ParcelasInline emprestimoId={e.id} loading={parcelasLoadingId === e.id} parcelas={parcelasPorEmprestimo[e.id] ?? []} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </PontesCard>
      </section>

      {/* ── Variante C: Agrupado por pessoa ── */}
      <section className={styles.variant}>
        <h2 className={styles.variantTitle}>C · Agrupado por pessoa</h2>
        <p className={styles.variantHint}>Junta os empréstimos da mesma pessoa com um subtotal no topo.</p>
        <div className={styles.grupoWrap}>
          {Object.entries(grupos).map(([pessoa, itens]) => {
            const total = itens.reduce((s, e) => s + e.valorRestante, 0)
            return (
              <PontesCard key={pessoa} padding={0} radius={16}>
                <div className={styles.grupoHead}>
                  <span className={styles.grupoNome}>{pessoa}</span>
                  <span className={styles.grupoTotal}>{formatMoney(total)}</span>
                </div>
                <ul className={styles.grupoList}>
                  {itens.map((e) => {
                    const isParcelado = e.formaPagamento === FormaPagamentoEmprestimo.Parcelado
                    return (
                      <React.Fragment key={e.id}>
                        <li className={styles.grupoItem}>
                          <div className={styles.grupoItemMain}>
                            <div className={styles.grupoItemHead}>
                              <span title={e.descricao}>{e.descricao}</span>
                              <StatusBadges e={e} />
                            </div>
                            <span className={styles.grupoItemSub}>
                              {isParcelado ? `Parcelado ${e.quantidadeParcelas}x` : "À vista"}
                            </span>
                          </div>
                          <ActionIcons e={e} size={24} h={h} />
                          <span className={styles.grupoItemValor}>{formatMoney(e.valorRestante)}</span>
                        </li>
                        {isParcelado && expandedId === e.id && (
                          <ParcelasInline emprestimoId={e.id} loading={parcelasLoadingId === e.id} parcelas={parcelasPorEmprestimo[e.id] ?? []} />
                        )}
                      </React.Fragment>
                    )
                  })}
                </ul>
              </PontesCard>
            )
          })}
        </div>
      </section>

      {/* ── Modais reais, compartilhados pelas 3 variantes ── */}
      <PontesDialog
        open={quitarId !== null}
        title="Marcar como quitado?"
        description="O empréstimo será fechado e não aceitará mais pagamentos."
        confirmLabel="Quitar"
        onConfirm={handleQuitar}
        onCancel={() => setQuitarId(null)}
      />

      <PontesDialog
        open={delId !== null}
        title="Remover empréstimo?"
        description="O registro sai da sua lista. Se já tiver pagamento registrado, não é possível remover — quite-o em vez disso."
        confirmLabel="Remover"
        onConfirm={handleDelete}
        onCancel={() => setDelId(null)}
      />

      <PontesModal
        open={solicitarFor !== null}
        title="Registrar pagamento"
        onClose={() => setSolicitarFor(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setSolicitarFor(null)}>Cancelar</PontesButton>
          <PontesButton onClick={handleSolicitar} loading={loading} disabled={loading}>
            {souCredorSolicitar ? "Confirmar recebimento" : "Enviar pra aprovação"}
          </PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <p className={styles.hintText}>
            {souCredorSolicitar
              ? "Isso lança a entrada de verdade na sua conta e já confirma o pagamento."
              : "Isso lança a saída de verdade na sua conta e avisa o credor."}
            {isParceladoSolicitar && " Cobre as parcelas em sequência, da mais antiga pra mais nova."}
          </p>
          <PontesField label={souCredorSolicitar ? "Como registrar esse recebimento?" : "Como comprovar esse pagamento?"} required error={solicitarErrors.escolha}>
            <div className={styles.gateGroup}>
              <GateOption name="solicitar-escolha" value="existente" current={solicitarEscolha} onChange={handleSolicitarEscolhaChange}>
                {souCredorSolicitar ? "Já registrei essa entrada em outro lugar — quero vincular" : "Já lancei essa saída em outro lugar — quero vincular"}
              </GateOption>
              <GateOption name="solicitar-escolha" value="novo" current={solicitarEscolha} onChange={handleSolicitarEscolhaChange}>
                {souCredorSolicitar ? "Ainda não registrei — registrar agora" : "Ainda não lancei — lançar agora"}
              </GateOption>
            </div>
          </PontesField>

          {solicitarEscolha === "existente" && (
            <PontesField label={souCredorSolicitar ? "Receita já lançada" : "Despesa já lançada"} required error={solicitarErrors.transacaoExistenteId}
              helper={(souCredorSolicitar ? receitasLoading : despesasLoading) ? "Carregando…" : undefined}>
              <PontesSelect
                value={solicitarTransacaoExistenteId}
                onChange={(v) => { setSolicitarTransacaoExistenteId(v); setSolicitarErrors((p) => ({ ...p, transacaoExistenteId: undefined })) }}
                options={(souCredorSolicitar ? receitasRecentes : despesasRecentes).map((t) => ({
                  value: t.id, label: `${formatDate(t.data)} — ${t.descricao} — ${formatMoney(t.valor)}`,
                }))}
                placeholder={souCredorSolicitar ? "Selecione a receita" : "Selecione a despesa"}
              />
            </PontesField>
          )}

          {solicitarEscolha === "novo" && (
            <>
              <PontesField label="Valor pago" required error={solicitarErrors.valor}>
                <PontesInput
                  iconStart="R$"
                  value={fmtMoney(solicitarForm.valor)}
                  onChange={(e) => { setSolicitarForm((f) => ({ ...f, valor: parseMoney(e.target.value) })); setSolicitarErrors((p) => ({ ...p, valor: undefined })) }}
                  invalid={!!solicitarErrors.valor}
                  inputMode="decimal"
                  placeholder="0,00"
                  autoFocus
                />
              </PontesField>
              <PontesField label={souCredorSolicitar ? "Conta (pra onde foi)" : "Conta (de onde saiu)"} required error={solicitarErrors.contaId}>
                <PontesSelect
                  value={solicitarForm.contaId}
                  onChange={(v) => { setSolicitarForm((f) => ({ ...f, contaId: v })); setSolicitarErrors((p) => ({ ...p, contaId: undefined })) }}
                  options={contas.map((c) => ({ value: c.id, label: c.nome }))}
                  placeholder="Selecione"
                />
              </PontesField>
              <PontesField label="Categoria" required error={solicitarErrors.categoriaId}>
                <PontesSelect
                  value={solicitarForm.categoriaId}
                  onChange={(v) => { setSolicitarForm((f) => ({ ...f, categoriaId: v })); setSolicitarErrors((p) => ({ ...p, categoriaId: undefined })) }}
                  options={categorias
                    .filter((c) => (souCredorSolicitar ? c.finalidade === 2 : c.finalidade === 1) || c.finalidade === 3)
                    .map((c) => ({ value: c.id, label: c.descricao }))}
                  placeholder="Selecione"
                />
              </PontesField>
            </>
          )}
        </div>
      </PontesModal>

      <PontesModal
        open={historicoFor !== null}
        title="Histórico de pagamentos"
        onClose={() => setHistoricoFor(null)}
        footer={<PontesButton onClick={() => setHistoricoFor(null)}>Fechar</PontesButton>}
      >
        <div className={styles.formCol}>
          {historicoLoading ? (
            <span className={styles.hintText}>Carregando…</span>
          ) : historico.length === 0 ? (
            <span className={styles.hintText}>Nenhum pagamento solicitado ainda.</span>
          ) : (
            <ul className={styles.historicoList}>
              {historico.map((hs) => (
                <li key={hs.id} className={styles.historicoItem}>
                  <strong>{hs.solicitadoPorNome}</strong> — {formatMoney(hs.valor)}{" "}
                  <PontesBadge size="sm" tone={hs.statusAprovacao === 2 ? "success" : hs.statusAprovacao === 3 ? "danger" : "warning"}>
                    {hs.statusAprovacaoDescricao}
                  </PontesBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PontesModal>
    </div>
  )
}
