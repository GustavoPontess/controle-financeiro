import React, { useCallback, useEffect, useState } from "react"
import { formatMoney } from "@/utils/money"
import { useOutletContext } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import {
  Plus, Trash2, Handshake, TrendingUp, TrendingDown, Link2, Copy, Check, X,
  Receipt, History, RotateCcw, ChevronDown, AlertCircle, Archive, ArchiveRestore, Layers, Ban,
} from "lucide-react"
import {
  PontesButton, PontesCard, PontesBadge, PontesIconButton, PontesStatCard, PontesAlert,
  PontesModal, PontesDialog, PontesField, PontesInput, PontesDateInput, PontesSelect,
  PontesTextarea, PontesEmptyState, PontesProgress, PontesCheckbox,
  PontesTablePagination, PONTES_TABLE_PAGE_SIZE_DEFAULT,
} from "@/components/pontes"
import {
  listEmprestimosPage, getEmprestimoStats, createEmprestimo, quitarEmprestimo, deleteEmprestimo,
  arquivarEmprestimo, desarquivarEmprestimo,
  vincularEmprestimo, listConvitesPendentesEmprestimo,
  aceitarVinculoEmprestimoPorId, recusarVinculoEmprestimoPorId,
  solicitarPagamentoEmprestimo, listSolicitacoesPagamento,
  aprovarPagamentoEmprestimo, rejeitarPagamentoEmprestimo, reenviarPagamentoEmprestimo,
  listParcelasEmprestimo,
  listCandidatosConsolidacao, proporConsolidacao, listConsolidacoes,
  aceitarConsolidacao, recusarConsolidacao, cancelarConsolidacao,
} from "../../services/emprestimoService"
import type { EmprestimoStats } from "../../services/emprestimoService"
import {
  StatusVinculoEmprestimo, StatusAprovacaoPagamentoEmprestimo, FormaPagamentoEmprestimo, StatusParcelaEmprestimo,
  StatusConsolidacaoEmprestimo,
  type Emprestimo, type CriarEmprestimo, type EmprestimoConvitePendente, type EmprestimoPagamentoSolicitacao,
  type EmprestimoParcela, type EmprestimoConsolidacaoCandidato, type EmprestimoConsolidacaoProposta,
} from "../../types/Emprestimo"
import { getContas } from "../../services/contaService"
import { getCategories } from "../../services/categoryService"
import { listTransactionsPage } from "../../services/transactionService"
import type { Conta } from "../../types/Conta"
import type { Category } from "../../types/Category"
import type { Transaction } from "../../types/Transaction"
import styles from "./EmprestimosPage.module.css"

const errorMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback


// Formata em UTC — datas do backend (vencimento, comprovante) são "dia calendário", não instante
// exato; formatar em fuso local desloca 1 dia pra trás em qualquer fuso negativo (Brasil inteiro).
const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"

// Timestamp real (instante exato — CriadoEm/AprovadoEm de solicitação), não dia calendário —
// fuso local aqui é o certo (oposto do formatDate acima), mesmo padrão do NotificationBell.
const formatDateTime = (d?: string) =>
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"

const today = () => new Date().toISOString().slice(0, 10)

const parseMoney = (masked: string): number | undefined => {
  const digits = masked.replace(/\D/g, "")
  return digits ? Number(digits) / 100 : undefined
}
const fmtMoney = (n?: number): string =>
  n != null ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""

const TIPOS = [
  { value: "1", label: "Emprestei (vou receber)" },
  { value: "2", label: "Peguei emprestado (vou pagar)" },
]

const FORMAS_PAGAMENTO = [
  { value: "avista", label: "À vista" },
  { value: "parcelado", label: "Parcelado" },
]

/** Escolha explícita — nunca padrão silencioso, evita duplicar lançamento (Gustavo 2026-08-05). */
type EscolhaMovimentacao = "" | "nao" | "existente" | "novo"
type EscolhaComprovante = "" | "existente" | "novo"
type EscolhaFormaPagamento = "avista" | "parcelado"

type FormState = {
  descricao: string
  pessoa: string
  valorTotal?: number
  tipo: string
  dataInicio: string
  dataVencimento: string
  observacao: string
  movimentacao: EscolhaMovimentacao
  contaId: string
  categoriaId: string
  transacaoExistenteId: string
  formaPagamento: EscolhaFormaPagamento
  quantidadeParcelas?: number
  primeiroVencimento: string
  taxaJuroMensal?: number
  percentualMultaAtraso?: number
}
const emptyForm: FormState = {
  descricao: "", pessoa: "", valorTotal: undefined, tipo: "1",
  dataInicio: today(), dataVencimento: "", observacao: "",
  movimentacao: "", contaId: "", categoriaId: "", transacaoExistenteId: "",
  formaPagamento: "avista", quantidadeParcelas: undefined, primeiroVencimento: "",
  taxaJuroMensal: undefined, percentualMultaAtraso: undefined,
}
type Errors = Partial<Record<
  "descricao" | "pessoa" | "valorTotal" | "contaId" | "categoriaId" | "movimentacao" | "transacaoExistenteId"
  | "quantidadeParcelas" | "primeiroVencimento", string>>

/** Rádio de escolha explícita — usado nos 3 pontos com risco de duplicar lançamento. */
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

export default function EmprestimosPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const { currentUser } = useAuth()
  // Página visível (server-side) + KPIs exatos via /stats endpoint dedicado (#179).
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([])
  const [stats, setStats] = useState<EmprestimoStats>({
    totalAReceber: 0, totalAPagar: 0, ativos: 0, qtdTotal: 0, totalAReceberVencido: 0,
  })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(PONTES_TABLE_PAGE_SIZE_DEFAULT)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [quitarId, setQuitarId] = useState<string | null>(null)
  const [delId, setDelId] = useState<string | null>(null)
  const [arquivandoId, setArquivandoId] = useState<string | null>(null)
  const [mostrarArquivados, setMostrarArquivados] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [idemKey, setIdemKey] = useState<string>("")
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [despesasRecentes, setDespesasRecentes] = useState<Transaction[]>([])
  const [despesasLoading, setDespesasLoading] = useState(false)
  const [receitasRecentes, setReceitasRecentes] = useState<Transaction[]>([])
  const [receitasLoading, setReceitasLoading] = useState(false)

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

  // Vínculo bilateral (docs/features/emprestimo-compartilhado/spec.md)
  const [pendentes, setPendentes] = useState<EmprestimoConvitePendente[]>([])
  const [respondendoId, setRespondendoId] = useState<string | null>(null)
  const [vincularFor, setVincularFor] = useState<string | null>(null)
  const [vincularEmail, setVincularEmail] = useState("")
  const [vincularErr, setVincularErr] = useState<string | undefined>(undefined)
  const [vincularLink, setVincularLink] = useState<string | null>(null)
  const [vincularLoading, setVincularLoading] = useState(false)

  // Pagamento com comprovante + aprovação (docs/features/emprestimo-compartilhado/pagamento-aprovacao.md)
  const [avaliandoId, setAvaliandoId] = useState<string | null>(null)
  const [solicitarFor, setSolicitarFor] = useState<string | null>(null)
  const [solicitarForm, setSolicitarForm] = useState<{ valor?: number; contaId: string; categoriaId: string }>({ valor: undefined, contaId: "", categoriaId: "" })
  const [solicitarErrors, setSolicitarErrors] = useState<{ valor?: string; contaId?: string; categoriaId?: string; escolha?: string; transacaoExistenteId?: string }>({})
  const [solicitarIdemKey, setSolicitarIdemKey] = useState("")
  // Escolha explícita: vincular despesa já lançada, ou criar agora — nunca padrão silencioso (Gustavo 2026-08-05)
  const [solicitarEscolha, setSolicitarEscolha] = useState<EscolhaComprovante>("")
  const [solicitarTransacaoExistenteId, setSolicitarTransacaoExistenteId] = useState("")
  // Empréstimo Parcelado — qual parcela esse pagamento quita (docs/.../parcelamento-e-agrupamento.md)
  const [aprovarFor, setAprovarFor] = useState<string | null>(null)
  const [aprovarForm, setAprovarForm] = useState<{ contaId: string; categoriaId: string }>({ contaId: "", categoriaId: "" })
  const [aprovarErrors, setAprovarErrors] = useState<{ escolha?: string; contaId?: string; categoriaId?: string; transacaoExistenteId?: string }>({})
  // Aprovar sempre registra a entrada — vincular ou criar, nunca "não registrar" (Gustavo 2026-08-05)
  const [aprovarEscolha, setAprovarEscolha] = useState<EscolhaComprovante>("")
  const [aprovarTransacaoExistenteId, setAprovarTransacaoExistenteId] = useState("")
  const [rejeitarFor, setRejeitarFor] = useState<string | null>(null)
  const [rejeitarMotivo, setRejeitarMotivo] = useState("")
  const [historicoFor, setHistoricoFor] = useState<string | null>(null)
  const [historico, setHistorico] = useState<EmprestimoPagamentoSolicitacao[]>([])
  const [historicoLoading, setHistoricoLoading] = useState(false)
  // Histórico de uma parcela específica, inline embaixo dela mesma — não modal (achado do
  // Gustavo, 2026-08-12: "não quero que esse historico de parcela abra assim nem a pau, quero
  // que abra em baixo").
  const [historicoInlineParcelaId, setHistoricoInlineParcelaId] = useState<string | null>(null)
  const [historicoInlineLista, setHistoricoInlineLista] = useState<EmprestimoPagamentoSolicitacao[]>([])
  const [historicoInlineLoading, setHistoricoInlineLoading] = useState(false)

  // Unificar/consolidar (docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md § "Unificar/consolidar")
  const [candidatosConsolidacao, setCandidatosConsolidacao] = useState<EmprestimoConsolidacaoCandidato[]>([])
  const [consolidacoes, setConsolidacoes] = useState<EmprestimoConsolidacaoProposta[]>([])
  const [respondendoConsolidacaoId, setRespondendoConsolidacaoId] = useState<string | null>(null)
  const [consolidarGrupo, setConsolidarGrupo] = useState<EmprestimoConsolidacaoCandidato | null>(null)
  const [consolidarSelecionados, setConsolidarSelecionados] = useState<Set<string>>(new Set())
  const [consolidarForm, setConsolidarForm] = useState<{
    descricao: string; formaPagamento: EscolhaFormaPagamento
    quantidadeParcelas?: number; primeiroVencimento: string; dataVencimento: string
    taxaJuroMensal?: number; percentualMultaAtraso?: number
  }>({ descricao: "", formaPagamento: "avista", primeiroVencimento: "", dataVencimento: "" })
  const [consolidarErrors, setConsolidarErrors] = useState<{
    descricao?: string; selecao?: string; quantidadeParcelas?: string; primeiroVencimento?: string
  }>({})
  const [consolidarLoading, setConsolidarLoading] = useState(false)
  const [recusarConsolidacaoFor, setRecusarConsolidacaoFor] = useState<string | null>(null)
  const [recusarConsolidacaoMotivo, setRecusarConsolidacaoMotivo] = useState("")

  // Forma de pagamento — parcelas expansíveis por empréstimo (docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [parcelasPorEmprestimo, setParcelasPorEmprestimo] = useState<Record<string, EmprestimoParcela[]>>({})
  const [parcelasLoadingId, setParcelasLoadingId] = useState<string | null>(null)

  const toggleExpand = async (id: string) => {
    setHistoricoInlineParcelaId(null)
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

  const loadData = useCallback(async () => {
    try {
      const [pageResult, statsResult, pendentesResult, contasResult, categoriasResult, candidatosResult, consolidacoesResult] = await Promise.all([
        listEmprestimosPage(page, pageSize, mostrarArquivados),
        getEmprestimoStats(),
        listConvitesPendentesEmprestimo(),
        getContas(),
        getCategories(),
        listCandidatosConsolidacao(),
        listConsolidacoes(),
      ])
      setEmprestimos(pageResult.items)
      setTotal(pageResult.total)
      setStats(statsResult)
      setPendentes(pendentesResult)
      setContas(contasResult)
      setCategorias(categoriasResult)
      setCandidatosConsolidacao(candidatosResult)
      setConsolidacoes(consolidacoesResult)
    } catch {
      notify({ open: true, message: "Erro ao carregar empréstimos", severity: "error" })
    }
  }, [notify, page, pageSize, mostrarArquivados])

  useEffect(() => { void loadData() }, [loadData])

  const clearErr = (k: keyof Errors) => setErrors((p) => ({ ...p, [k]: undefined }))
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const openCreate = () => {
    setForm(emptyForm); setErrors({}); setDialogOpen(true)
    setIdemKey(crypto.randomUUID()) // key estável por tentativa; reusa no retry
  }

  const handleAceitarConvite = async (id: string) => {
    setRespondendoId(id)
    try {
      await aceitarVinculoEmprestimoPorId(id)
      notify({ open: true, message: "Vínculo aceito", severity: "success" })
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao aceitar convite"), severity: "error" })
    } finally {
      setRespondendoId(null)
    }
  }

  const handleRecusarConvite = async (id: string) => {
    setRespondendoId(id)
    try {
      await recusarVinculoEmprestimoPorId(id)
      notify({ open: true, message: "Convite recusado", severity: "success" })
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao recusar convite"), severity: "error" })
    } finally {
      setRespondendoId(null)
    }
  }

  const handleMovimentacaoChange = (v: string) => {
    setF("movimentacao", v as EscolhaMovimentacao)
    clearErr("movimentacao")
    if (v === "existente") void (form.tipo === "1" ? carregarDespesasRecentes() : carregarReceitasRecentes())
  }

  const handleSalvar = async () => {
    const e: Errors = {}
    if (!form.descricao.trim()) e.descricao = "Informe a descrição"
    if (!form.pessoa.trim()) e.pessoa = form.tipo === "1" ? "Informe pra quem emprestou" : "Informe de quem pegou"
    if (form.valorTotal == null) e.valorTotal = "Informe o valor"
    else if (form.valorTotal <= 0) e.valorTotal = "Valor deve ser maior que zero"
    if (!form.movimentacao) e.movimentacao = "Escolha uma opção"
    if (form.movimentacao === "novo" && !form.contaId) e.contaId = "Escolha a conta"
    if (form.movimentacao === "novo" && !form.categoriaId) e.categoriaId = "Escolha a categoria"
    if (form.movimentacao === "existente" && !form.transacaoExistenteId) e.transacaoExistenteId = "Escolha o lançamento"
    if (form.formaPagamento === "parcelado") {
      if (!form.quantidadeParcelas || form.quantidadeParcelas < 2 || form.quantidadeParcelas > 36)
        e.quantidadeParcelas = "Entre 2 e 36 parcelas"
      if (!form.primeiroVencimento) e.primeiroVencimento = "Informe o vencimento da 1ª parcela"
    }
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    try {
      const parcelado = form.formaPagamento === "parcelado"
      const payload: CriarEmprestimo = {
        descricao: form.descricao.trim(),
        pessoa: form.pessoa.trim(),
        valorTotal: form.valorTotal!,
        tipo: Number(form.tipo),
        dataInicio: new Date(form.dataInicio).toISOString(),
        dataVencimento: form.dataVencimento ? new Date(form.dataVencimento).toISOString() : undefined,
        observacao: form.observacao.trim() || undefined,
        idempotencyKey: idemKey,
        contaId: form.movimentacao === "novo" ? form.contaId : undefined,
        categoriaId: form.movimentacao === "novo" ? form.categoriaId : undefined,
        transacaoExistenteId: form.movimentacao === "existente" ? form.transacaoExistenteId : undefined,
        formaPagamento: parcelado ? FormaPagamentoEmprestimo.Parcelado : FormaPagamentoEmprestimo.AVista,
        quantidadeParcelas: parcelado ? form.quantidadeParcelas : undefined,
        primeiroVencimento: parcelado ? new Date(form.primeiroVencimento).toISOString() : undefined,
        taxaJuroMensal: form.taxaJuroMensal,
        percentualMultaAtraso: form.percentualMultaAtraso,
      }
      await createEmprestimo(payload)
      notify({ open: true, message: "Empréstimo criado", severity: "success" })
      setDialogOpen(false)
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao criar empréstimo"), severity: "error" })
    } finally { setLoading(false) }
  }

  const openVincular = (id: string) => {
    setVincularFor(id); setVincularEmail(""); setVincularErr(undefined); setVincularLink(null)
  }

  const handleVincular = async () => {
    if (!vincularFor) return
    if (!vincularEmail.trim() || !vincularEmail.includes("@")) {
      setVincularErr("Informe um e-mail válido")
      return
    }
    setVincularLoading(true)
    try {
      const resultado = await vincularEmprestimo(vincularFor, vincularEmail.trim())
      setVincularLink(`${window.location.origin}${resultado.linkConvite}`)
    } catch (err) {
      setVincularErr(errorMessage(err, "Erro ao propor vínculo"))
    } finally {
      setVincularLoading(false)
    }
  }

  const handleCopiarLink = async () => {
    if (!vincularLink) return
    await navigator.clipboard.writeText(vincularLink)
    notify({ open: true, message: "Link copiado", severity: "success" })
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

  // Arquivar decisão pessoal de organização (não apaga nada, não afeta a contraparte) — resolve a
  // clareira entre "quitado bloqueia apagar de propósito" e "empréstimo antigo poluindo a lista".
  const handleArquivar = async (id: string) => {
    setArquivandoId(id)
    try {
      await arquivarEmprestimo(id)
      notify({ open: true, message: "Empréstimo arquivado", severity: "success" })
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao arquivar empréstimo"), severity: "error" })
    } finally { setArquivandoId(null) }
  }

  const handleDesarquivar = async (id: string) => {
    setArquivandoId(id)
    try {
      await desarquivarEmprestimo(id)
      notify({ open: true, message: "Empréstimo desarquivado", severity: "success" })
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao desarquivar empréstimo"), severity: "error" })
    } finally { setArquivandoId(null) }
  }

  // ── Unificar/consolidar ──────────────────────────────────────────────────

  const openConsolidar = (grupo: EmprestimoConsolidacaoCandidato) => {
    setConsolidarGrupo(grupo)
    setConsolidarSelecionados(new Set(grupo.itens.map((i) => i.emprestimoOriginalId)))
    setConsolidarForm({
      descricao: `Consolidação com ${grupo.contraparteNome}`,
      formaPagamento: "avista", primeiroVencimento: "", dataVencimento: "",
      quantidadeParcelas: undefined, taxaJuroMensal: undefined, percentualMultaAtraso: undefined,
    })
    setConsolidarErrors({})
  }

  const toggleConsolidarSelecionado = (id: string) => {
    setConsolidarSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    setConsolidarErrors((p) => ({ ...p, selecao: undefined }))
  }

  const handleProporConsolidacao = async () => {
    if (!consolidarGrupo) return
    const e: typeof consolidarErrors = {}
    if (consolidarSelecionados.size < 2) e.selecao = "Selecione pelo menos 2 empréstimos"
    if (!consolidarForm.descricao.trim()) e.descricao = "Informe a descrição"
    if (consolidarForm.formaPagamento === "parcelado") {
      if (!consolidarForm.quantidadeParcelas || consolidarForm.quantidadeParcelas < 2 || consolidarForm.quantidadeParcelas > 36)
        e.quantidadeParcelas = "Entre 2 e 36 parcelas"
      if (!consolidarForm.primeiroVencimento) e.primeiroVencimento = "Informe o vencimento da 1ª parcela"
    }
    setConsolidarErrors(e)
    if (Object.keys(e).length) return

    setConsolidarLoading(true)
    try {
      const parcelado = consolidarForm.formaPagamento === "parcelado"
      await proporConsolidacao({
        emprestimoIds: [...consolidarSelecionados],
        descricao: consolidarForm.descricao.trim(),
        formaPagamento: parcelado ? FormaPagamentoEmprestimo.Parcelado : FormaPagamentoEmprestimo.AVista,
        quantidadeParcelas: parcelado ? consolidarForm.quantidadeParcelas : undefined,
        primeiroVencimento: parcelado ? new Date(consolidarForm.primeiroVencimento).toISOString() : undefined,
        dataVencimento: !parcelado && consolidarForm.dataVencimento ? new Date(consolidarForm.dataVencimento).toISOString() : undefined,
        taxaJuroMensal: consolidarForm.taxaJuroMensal,
        percentualMultaAtraso: consolidarForm.percentualMultaAtraso,
      })
      notify({ open: true, message: "Consolidação proposta — aguardando a outra pessoa aceitar", severity: "success" })
      setConsolidarGrupo(null)
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao propor consolidação"), severity: "error" })
    } finally { setConsolidarLoading(false) }
  }

  const handleAceitarConsolidacao = async (id: string) => {
    setRespondendoConsolidacaoId(id)
    try {
      await aceitarConsolidacao(id)
      notify({ open: true, message: "Consolidação aceita — os empréstimos viraram um só", severity: "success" })
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao aceitar consolidação"), severity: "error" })
    } finally { setRespondendoConsolidacaoId(null) }
  }

  const openRecusarConsolidacao = (id: string) => {
    setRecusarConsolidacaoFor(id)
    setRecusarConsolidacaoMotivo("")
  }

  const handleRecusarConsolidacao = async () => {
    if (!recusarConsolidacaoFor) return
    setRespondendoConsolidacaoId(recusarConsolidacaoFor)
    try {
      await recusarConsolidacao(recusarConsolidacaoFor, recusarConsolidacaoMotivo.trim() || undefined)
      notify({ open: true, message: "Consolidação recusada", severity: "success" })
      setRecusarConsolidacaoFor(null)
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao recusar consolidação"), severity: "error" })
    } finally { setRespondendoConsolidacaoId(null) }
  }

  const handleCancelarConsolidacao = async (id: string) => {
    setRespondendoConsolidacaoId(id)
    try {
      await cancelarConsolidacao(id)
      notify({ open: true, message: "Consolidação cancelada", severity: "success" })
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao cancelar consolidação"), severity: "error" })
    } finally { setRespondendoConsolidacaoId(null) }
  }

  // ── Pagamento com comprovante + aprovação ───────────────────────────────────

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
    const mensagemSucesso = (qtdParcelas: number) => {
      const base = souCredor ? "Pagamento registrado" : "Pagamento marcado — aguardando aprovação do credor"
      return qtdParcelas > 1 ? `${base} (${qtdParcelas} parcelas)` : base
    }

    if (!solicitarEscolha) {
      setSolicitarErrors({ escolha: "Escolha uma opção" })
      return
    }

    if (solicitarEscolha === "existente") {
      if (!solicitarTransacaoExistenteId) {
        setSolicitarErrors({ transacaoExistenteId: souCredor ? "Escolha a receita que já lançou" : "Escolha a despesa que já lançou" })
        return
      }
      setLoading(true)
      try {
        const resultado = await solicitarPagamentoEmprestimo(solicitarFor, {
          valor: 0,
          data: new Date().toISOString(),
          transacaoExistenteId: solicitarTransacaoExistenteId,
          idempotencyKey: solicitarIdemKey,
        })
        notify({ open: true, message: mensagemSucesso(resultado.length), severity: "success" })
        setSolicitarFor(null)
        await loadData()
        await refreshParcelasEHistoricoInline()
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
        valor: solicitarForm.valor!,
        contaId: solicitarForm.contaId,
        categoriaId: solicitarForm.categoriaId,
        data: new Date().toISOString(),
        idempotencyKey: solicitarIdemKey,
      })
      notify({ open: true, message: mensagemSucesso(resultado.length), severity: "success" })
      setSolicitarFor(null)
      await loadData()
      await refreshParcelasEHistoricoInline()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao registrar pagamento"), severity: "error" })
    } finally { setLoading(false) }
  }

  const openAprovar = (solicitacaoId: string) => {
    setAprovarFor(solicitacaoId)
    setAprovarForm({ contaId: "", categoriaId: "" })
    setAprovarErrors({})
    setAprovarEscolha("")
    setAprovarTransacaoExistenteId("")
  }

  const handleAprovarEscolhaChange = (v: string) => {
    setAprovarEscolha(v as EscolhaComprovante)
    setAprovarErrors((p) => ({ ...p, escolha: undefined }))
    if (v === "existente") void carregarReceitasRecentes()
  }

  const handleAprovar = async () => {
    if (!aprovarFor) return

    if (!aprovarEscolha) {
      setAprovarErrors({ escolha: "Escolha uma opção" })
      return
    }
    if (aprovarEscolha === "existente" && !aprovarTransacaoExistenteId) {
      setAprovarErrors({ transacaoExistenteId: "Escolha a receita que já lançou" })
      return
    }
    if (aprovarEscolha === "novo" && !aprovarForm.contaId) {
      setAprovarErrors({ contaId: "Escolha a conta" })
      return
    }
    if (aprovarEscolha === "novo" && !aprovarForm.categoriaId) {
      setAprovarErrors({ categoriaId: "Escolha a categoria" })
      return
    }

    setAvaliandoId(aprovarFor)
    try {
      await aprovarPagamentoEmprestimo(aprovarFor, {
        contaId: aprovarEscolha === "novo" ? aprovarForm.contaId : undefined,
        categoriaId: aprovarEscolha === "novo" ? aprovarForm.categoriaId : undefined,
        transacaoExistenteId: aprovarEscolha === "existente" ? aprovarTransacaoExistenteId : undefined,
      })
      notify({ open: true, message: "Pagamento aprovado", severity: "success" })
      setAprovarFor(null)
      await loadData()
      if (historicoFor) await carregarHistorico(historicoFor)
      await refreshParcelasEHistoricoInline()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao aprovar pagamento"), severity: "error" })
    } finally { setAvaliandoId(null) }
  }

  // Aprovar/rejeitar/reenviar mexe numa parcela específica, mas o cache de parcelas do empréstimo
  // expandido (parcelasPorEmprestimo) só é buscado uma vez ao abrir — sem isso, a linha continua
  // mostrando "Aguardando aprovação" mesmo depois de aprovado de verdade (achado do Gustavo,
  // 2026-08-12: "registrei entrada mas o status continua como aguardando aprovação").
  const refreshParcelasEHistoricoInline = async () => {
    if (!expandedId) return
    try {
      const lista = await listParcelasEmprestimo(expandedId)
      setParcelasPorEmprestimo((p) => ({ ...p, [expandedId]: lista }))
    } catch { /* refresh silencioso, não crítico */ }
    if (historicoInlineParcelaId) {
      try {
        const historicoLista = await listSolicitacoesPagamento(expandedId)
        setHistoricoInlineLista(historicoLista.filter((h) => h.parcelaId === historicoInlineParcelaId))
      } catch { /* refresh silencioso, não crítico */ }
    }
  }

  const openRejeitar = (solicitacaoId: string) => {
    setRejeitarFor(solicitacaoId)
    setRejeitarMotivo("")
  }

  const handleRejeitar = async () => {
    if (!rejeitarFor) return
    setAvaliandoId(rejeitarFor)
    try {
      await rejeitarPagamentoEmprestimo(rejeitarFor, rejeitarMotivo.trim() || undefined)
      notify({ open: true, message: "Pagamento rejeitado", severity: "success" })
      setRejeitarFor(null)
      await loadData()
      if (historicoFor) await carregarHistorico(historicoFor)
      await refreshParcelasEHistoricoInline()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao rejeitar pagamento"), severity: "error" })
    } finally { setAvaliandoId(null) }
  }

  const handleReenviar = async (solicitacaoId: string) => {
    setAvaliandoId(solicitacaoId)
    try {
      await reenviarPagamentoEmprestimo(solicitacaoId)
      notify({ open: true, message: "Pagamento reenviado pra aprovação", severity: "success" })
      await loadData()
      if (historicoFor) await carregarHistorico(historicoFor)
      await refreshParcelasEHistoricoInline()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao reenviar pagamento"), severity: "error" })
    } finally { setAvaliandoId(null) }
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

  const toggleHistoricoParcela = async (emprestimoId: string, parcelaId: string) => {
    if (historicoInlineParcelaId === parcelaId) { setHistoricoInlineParcelaId(null); return }
    setHistoricoInlineParcelaId(parcelaId)
    setHistoricoInlineLoading(true)
    try {
      const lista = await listSolicitacoesPagamento(emprestimoId)
      setHistoricoInlineLista(lista.filter((h) => h.parcelaId === parcelaId))
    } catch {
      notify({ open: true, message: "Erro ao carregar histórico da parcela", severity: "error" })
    } finally { setHistoricoInlineLoading(false) }
  }

  const { totalAReceber, totalAPagar, ativos: qtdAtivos, totalAReceberVencido } = stats
  const consolidacoesRecebidas = consolidacoes.filter((c) => !c.souCredor && c.status === StatusConsolidacaoEmprestimo.Pendente)
  const consolidacoesEnviadas = consolidacoes.filter((c) => c.souCredor && c.status === StatusConsolidacaoEmprestimo.Pendente)
  const solicitarEmprestimoAtual = emprestimos.find((x) => x.id === solicitarFor)
  const isParceladoSolicitar = solicitarEmprestimoAtual?.formaPagamento === FormaPagamentoEmprestimo.Parcelado
  const souCredorSolicitar = solicitarEmprestimoAtual?.souCredor ?? false
  const historicoEmprestimo = emprestimos.find((x) => x.id === historicoFor)

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Empréstimos</h1>
          <div className={styles.subtitle}>Controle de dinheiro emprestado e recebido</div>
        </div>
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={openCreate}>
          Novo Empréstimo
        </PontesButton>
      </div>

      {pendentes.length > 0 && (
        <PontesAlert tone="warning">
          <div className={styles.listHeadTitle}>
            {pendentes.length === 1 ? "1 convite de empréstimo pendente" : `${pendentes.length} convites de empréstimo pendentes`}
          </div>
          <ul className={styles.pendentesList}>
            {pendentes.map((p) => (
              <li key={p.emprestimoId} className={styles.pendenteItem}>
                <span className={styles.pendenteDesc}>
                  <strong>{p.credorOuDevedorNome}</strong> — {p.descricao} ({p.tipoDescricao}, {formatMoney(p.valorTotal)})
                </span>
                <div className={styles.actions}>
                  <PontesIconButton size={32} variant="ghost" aria-label="Aceitar convite"
                    disabled={respondendoId === p.emprestimoId}
                    onClick={() => handleAceitarConvite(p.emprestimoId)}>
                    <Check size={14} />
                  </PontesIconButton>
                  <PontesIconButton size={32} variant="ghost" aria-label="Recusar convite"
                    disabled={respondendoId === p.emprestimoId}
                    onClick={() => handleRecusarConvite(p.emprestimoId)}>
                    <X size={14} />
                  </PontesIconButton>
                </div>
              </li>
            ))}
          </ul>
        </PontesAlert>
      )}

      {consolidacoesRecebidas.length > 0 && (
        <PontesAlert tone="warning">
          <div className={styles.listHeadTitle}>
            {consolidacoesRecebidas.length === 1 ? "1 proposta de consolidação" : `${consolidacoesRecebidas.length} propostas de consolidação`}
          </div>
          <ul className={styles.pendentesList}>
            {consolidacoesRecebidas.map((c) => (
              <li key={c.id} className={styles.pendenteItem}>
                <span className={styles.pendenteDesc}>
                  <strong>{c.credorNome}</strong> quer juntar {c.itens.length} empréstimos
                  {" "}({c.itens.map((i) => i.descricao).join(", ")}) num plano novo de {formatMoney(c.valorTotalProposto)}.
                </span>
                <div className={styles.actions}>
                  <PontesIconButton size={32} variant="ghost" aria-label="Aceitar consolidação"
                    disabled={respondendoConsolidacaoId === c.id}
                    onClick={() => handleAceitarConsolidacao(c.id)}>
                    <Check size={14} />
                  </PontesIconButton>
                  <PontesIconButton size={32} variant="ghost" aria-label="Recusar consolidação"
                    disabled={respondendoConsolidacaoId === c.id}
                    onClick={() => openRecusarConsolidacao(c.id)}>
                    <X size={14} />
                  </PontesIconButton>
                </div>
              </li>
            ))}
          </ul>
        </PontesAlert>
      )}

      <div className={styles.statsGrid}>
        <PontesStatCard label="A receber" value={formatMoney(totalAReceber)} hint="dinheiro que emprestei" tone="success" />
        <PontesStatCard label="A pagar" value={formatMoney(totalAPagar)} hint="dinheiro que peguei emprestado" tone="danger" />
        <PontesStatCard label="Vencido" value={formatMoney(totalAReceberVencido)} hint="atrasado, ainda não recebido" tone="danger" />
        <PontesStatCard label="Ativos" value={String(qtdAtivos)} hint="empréstimos em andamento" />
      </div>

      {(candidatosConsolidacao.length > 0 || consolidacoesEnviadas.length > 0) && (
        <PontesCard padding={16} radius={16}>
          <div className={styles.listHeadTitle}>Consolidar dívidas</div>
          <ul className={styles.pendentesList}>
            {candidatosConsolidacao.map((g) => (
              <li key={g.contraparteUsuarioId} className={styles.pendenteItem}>
                <span className={styles.pendenteDesc}>
                  <strong>{g.contraparteNome}</strong> — {g.itens.length} empréstimos ativos,
                  {" "}{formatMoney(g.itens.reduce((s, i) => s + i.valorRestanteSnapshot, 0))} no total
                </span>
                <PontesButton size="sm" variant="outline" iconStart={<Layers size={14} />} onClick={() => openConsolidar(g)}>
                  Consolidar
                </PontesButton>
              </li>
            ))}
            {consolidacoesEnviadas.map((c) => (
              <li key={c.id} className={styles.pendenteItem}>
                <span className={styles.pendenteDesc}>
                  Proposta pra <strong>{c.devedorNome}</strong> — {formatMoney(c.valorTotalProposto)}, aguardando resposta
                </span>
                <PontesIconButton size={32} variant="ghost" aria-label="Cancelar proposta de consolidação"
                  disabled={respondendoConsolidacaoId === c.id}
                  onClick={() => handleCancelarConsolidacao(c.id)}>
                  <Ban size={14} />
                </PontesIconButton>
              </li>
            ))}
          </ul>
        </PontesCard>
      )}

      <PontesCard padding={0} radius={16}>
        <div className={styles.listHead}>
          <div className={styles.listHeadLeft}>
            <span className={styles.listHeadTitle}>Seus empréstimos</span>
            <PontesButton
              size="sm"
              variant={mostrarArquivados ? "primary" : "outline"}
              iconStart={<Archive size={14} />}
              onClick={() => { setMostrarArquivados((v) => !v); setPage(1) }}
            >
              Arquivados
            </PontesButton>
          </div>
          <span className={styles.listHeadMeta}>{total} {total === 1 ? "registrado" : "registrados"}</span>
        </div>

        {total === 0 ? (
          <div className={styles.emptyWrap}>
            <PontesEmptyState
              icon={<Handshake size={28} />}
              title="Nenhum empréstimo cadastrado"
              description="Registre dinheiro que você emprestou ou que tomou emprestado."
            />
          </div>
        ) : (
          <ul className={styles.list}>
            {emprestimos.map((e) => {
              const isEmprestei = e.tipo === 1
              const isParcelado = e.formaPagamento === FormaPagamentoEmprestimo.Parcelado
              return (
              <React.Fragment key={e.id}>
                <li className={styles.item} data-quitado={e.quitado ? "true" : undefined}>
                  <div className={styles.itemLeft}>
                    <div className={styles.itemIcon} data-tone={isEmprestei ? "success" : "danger"}>
                      {isEmprestei ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    </div>
                    <div className={styles.itemMeta}>
                      <div className={styles.itemHead}>
                        <span className={styles.itemDesc} title={e.descricao}>{e.descricao}</span>
                        {e.quitado && <PontesBadge tone="success" size="sm">Quitado</PontesBadge>}
                        {e.vencido && !e.quitado && <PontesBadge tone="danger" size="sm">Vencido</PontesBadge>}
                        {e.statusVinculo === StatusVinculoEmprestimo.Vinculado && (
                          <PontesBadge tone="success" size="sm">Vinculado</PontesBadge>
                        )}
                        {e.statusVinculo === StatusVinculoEmprestimo.PendenteAceite && (
                          <PontesBadge tone="warning" size="sm">Convite pendente</PontesBadge>
                        )}
                        {e.souCredor && !e.quitado && e.valorPendente > 0 && (
                          <PontesBadge tone="warning" size="sm">
                            <AlertCircle size={12} /> Aguardando sua aprovação
                          </PontesBadge>
                        )}
                      </div>
                      <span className={styles.itemSub}>
                        <span>
                          {isEmprestei ? "Para: " : "De: "}
                          <strong>{e.contraparteNome ?? e.pessoa}</strong>
                        </span>
                        {e.dataVencimento && <><span className={styles.itemSubDot}>·</span><span>vence {formatDate(e.dataVencimento)}</span></>}
                        <span className={styles.itemSubDot}>·</span>
                        <span>{isParcelado ? `Parcelado ${e.quantidadeParcelas}x` : "À vista"}</span>
                        {e.consolidadoNoEmprestimoId && (
                          <><span className={styles.itemSubDot}>·</span><span>Consolidado num plano novo</span></>
                        )}
                      </span>
                      {!isParcelado && (e.valorComMulta != null || e.valorComJuros != null) && (
                        <span className={styles.itemSub}>
                          {e.valorComMulta != null
                            ? <>Com multa por atraso: <strong>{formatMoney(e.valorComMulta)}</strong></>
                            : <>Com juros: <strong>{formatMoney(e.valorComJuros!)}</strong></>}
                        </span>
                      )}
                      {!e.quitado && (
                        <div className={styles.progressWrap}>
                          <div className={styles.progressMeta}>
                            <span>{formatMoney(e.valorPago)} pago de {formatMoney(e.valorTotal)}</span>
                            <span className={styles.progressPct}>{e.percentualPago}%</span>
                          </div>
                          <PontesProgress
                            showValue={false}
                            height={6}
                            segments={[
                              {
                                value: e.percentualPago,
                                color: "var(--pontes-success)",
                                label: `Confirmado: ${formatMoney(e.valorPago)}`,
                              },
                              {
                                value: e.valorTotal > 0 ? (e.valorPendente / e.valorTotal) * 100 : 0,
                                color: "var(--pontes-warning)",
                                label: e.valorPendente > 0 ? `Aguardando aprovação: ${formatMoney(e.valorPendente)}` : undefined,
                              },
                              {
                                value: e.valorTotal > 0 ? (e.valorRecusado / e.valorTotal) * 100 : 0,
                                color: "var(--pontes-danger)",
                                label: e.valorRecusado > 0 ? `Recusado: ${formatMoney(e.valorRecusado)}` : undefined,
                              },
                            ]}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.itemRight}>
                    <span className={styles.itemValue} data-tone={isEmprestei ? "success" : "danger"}>
                      {formatMoney(e.valorRestante)}
                    </span>
                    <span className={styles.itemValueLabel}>restante</span>
                    <div className={styles.actions}>
                      {isParcelado && (
                        <PontesIconButton size={32} variant="ghost" aria-label={expandedId === e.id ? "Recolher parcelas" : "Ver parcelas"}
                          onClick={() => void toggleExpand(e.id)}>
                          <ChevronDown size={14} className={styles.expandBtn} data-open={expandedId === e.id ? "" : undefined} />
                        </PontesIconButton>
                      )}
                      {!e.quitado && (
                        <PontesIconButton size={32} variant="ghost" aria-label="Registrar pagamento"
                          onClick={() => openSolicitar(e.id)}>
                          <Receipt size={14} />
                        </PontesIconButton>
                      )}
                      {!e.quitado && e.souCredor && (
                        <PontesIconButton size={32} variant="ghost" aria-label="Marcar como quitado"
                          onClick={() => setQuitarId(e.id)}>
                          <Handshake size={14} />
                        </PontesIconButton>
                      )}
                      {e.statusVinculo === StatusVinculoEmprestimo.Vinculado && (
                        <PontesIconButton size={32} variant="ghost" aria-label="Ver histórico de pagamentos"
                          onClick={() => openHistorico(e.id)}>
                          <History size={14} />
                        </PontesIconButton>
                      )}
                      {(e.statusVinculo === StatusVinculoEmprestimo.SemVinculo
                        || e.statusVinculo === StatusVinculoEmprestimo.Recusado) && (
                        <PontesIconButton size={32} variant="ghost" aria-label="Vincular a uma pessoa"
                          onClick={() => openVincular(e.id)}>
                          <Link2 size={14} />
                        </PontesIconButton>
                      )}
                      {e.quitado && !e.arquivado && (
                        <PontesIconButton size={32} variant="ghost" aria-label="Arquivar"
                          onClick={() => void handleArquivar(e.id)} disabled={arquivandoId === e.id}>
                          <Archive size={14} />
                        </PontesIconButton>
                      )}
                      {e.quitado && e.arquivado && (
                        <PontesIconButton size={32} variant="ghost" aria-label="Desarquivar"
                          onClick={() => void handleDesarquivar(e.id)} disabled={arquivandoId === e.id}>
                          <ArchiveRestore size={14} />
                        </PontesIconButton>
                      )}
                      <span className={styles.actionsDivider} aria-hidden />
                      <PontesIconButton size={32} variant="ghost" aria-label="Remover"
                        onClick={() => setDelId(e.id)}>
                        <Trash2 size={14} />
                      </PontesIconButton>
                    </div>
                  </div>
                </li>
                {isParcelado && expandedId === e.id && (
                  <li className={styles.parcelasWrap}>
                    {parcelasLoadingId === e.id ? (
                      <span className={styles.itemSub}>Carregando…</span>
                    ) : (parcelasPorEmprestimo[e.id] ?? []).map((parc) => {
                      const podeAprovar = e.souCredor && !!parc.solicitacaoPendenteId
                      const valorDevidoParc = parc.valorComMulta ?? parc.valorComJuros ?? parc.valor
                      const parcialPaga = parc.status === StatusParcelaEmprestimo.Pendente
                        && parc.valorPago > 0 && parc.valorPago < valorDevidoParc
                      return (
                      <div key={parc.id} className={styles.parcelaItem}>
                        <div
                          className={styles.parcelaRow}
                          data-clickable=""
                          onClick={() => void toggleHistoricoParcela(e.id, parc.id)}
                        >
                          <span className={styles.parcelaNumero}>{parc.numero}/{parc.quantidadeTotal}</span>
                          <span className={styles.parcelaVencimento}>vence {formatDate(parc.dataVencimento)}</span>
                          <span className={styles.parcelaValor}>
                            {parc.valorComMulta != null && (
                              <span className={styles.parcelaValorOriginal}>{formatMoney(parc.valor)}</span>
                            )}
                            {formatMoney(parc.valorComMulta ?? parc.valorComJuros ?? parc.valor)}
                          </span>
                          {podeAprovar && (
                            <div className={styles.parcelaActions} onClick={(ev) => ev.stopPropagation()}>
                              <PontesIconButton size={24} variant="success" aria-label="Aprovar pagamento"
                                onClick={() => openAprovar(parc.solicitacaoPendenteId!)}>
                                <Check size={12} />
                              </PontesIconButton>
                              <PontesIconButton size={24} variant="danger" aria-label="Rejeitar pagamento"
                                onClick={() => openRejeitar(parc.solicitacaoPendenteId!)}>
                                <X size={12} />
                              </PontesIconButton>
                            </div>
                          )}
                          <PontesBadge size="sm" tone={
                            podeAprovar ? "warning"
                              : parc.status === StatusParcelaEmprestimo.Paga ? "success"
                              : parcialPaga ? "accent"
                              : parc.atrasada ? "danger" : "neutral"
                          }>
                            {podeAprovar ? "Aguardando aprovação"
                              : parcialPaga ? `${formatMoney(parc.valorPago)} de ${formatMoney(valorDevidoParc)} pago`
                              : parc.statusDescricao}
                          </PontesBadge>
                        </div>
                        {historicoInlineParcelaId === parc.id && (
                          <div className={styles.parcelaHistorico}>
                            {historicoInlineLoading ? (
                              <span className={styles.itemSub}>Carregando…</span>
                            ) : historicoInlineLista.length === 0 ? (
                              <span className={styles.itemSub}>Nenhum pagamento solicitado ainda pra essa parcela.</span>
                            ) : (
                              historicoInlineLista.map((h) => {
                                const quemResolveu = e.souCredor ? "Você" : (e.contraparteNome ?? e.pessoa)
                                return (
                                <div key={h.id} className={styles.parcelaHistoricoItem}>
                                  {h.registradoPeloCredor ? (
                                    <div className={styles.parcelaHistoricoEvento}>
                                      <div className={styles.parcelaHistoricoHead}>
                                        <strong>{h.solicitadoPorNome}</strong>
                                        <span>registrou o recebimento</span>
                                        <span>{formatMoney(h.valor)}</span>
                                      </div>
                                      <span className={styles.itemSub}>
                                        {formatDateTime(h.criadoEm)}
                                        {h.recebimentoData && <> · Entrada: {formatDate(h.recebimentoData)}{h.recebimentoContaNome ? ` · ${h.recebimentoContaNome}` : ""}</>}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className={styles.parcelaHistoricoEvento}>
                                      <div className={styles.parcelaHistoricoHead}>
                                        <strong>{h.solicitadoPorNome}</strong>
                                        <span>solicitou pagamento</span>
                                        <span>{formatMoney(h.valor)}</span>
                                      </div>
                                      <span className={styles.itemSub}>
                                        {formatDateTime(h.criadoEm)} · Saída: {formatDate(h.comprovanteData)}{h.comprovanteContaNome && ` · ${h.comprovanteContaNome}`}
                                      </span>
                                    </div>
                                  )}
                                  {!h.registradoPeloCredor && h.statusAprovacao !== StatusAprovacaoPagamentoEmprestimo.Pendente && (
                                    <div className={styles.parcelaHistoricoEvento}>
                                      <div className={styles.parcelaHistoricoHead}>
                                        <strong>{quemResolveu}</strong>
                                        <span>{h.statusAprovacao === StatusAprovacaoPagamentoEmprestimo.Aprovada ? "aprovou" : "rejeitou"}</span>
                                      </div>
                                      <span className={styles.itemSub}>
                                        {h.aprovadoEm && formatDateTime(h.aprovadoEm)}
                                        {h.recebimentoData && <> · Entrada: {formatDate(h.recebimentoData)}{h.recebimentoContaNome ? ` · ${h.recebimentoContaNome}` : ""}</>}
                                      </span>
                                      {h.motivoRejeicao && (
                                        <span className={styles.itemSub}>Motivo: {h.motivoRejeicao}</span>
                                      )}
                                    </div>
                                  )}
                                  <PontesBadge
                                    size="sm"
                                    tone={h.statusAprovacao === StatusAprovacaoPagamentoEmprestimo.Aprovada ? "success"
                                      : h.statusAprovacao === StatusAprovacaoPagamentoEmprestimo.Rejeitada ? "danger" : "warning"}
                                  >
                                    {h.statusAprovacaoDescricao}
                                  </PontesBadge>
                                </div>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>
                      )
                    })}
                  </li>
                )}
              </React.Fragment>
              )
            })}
          </ul>
        )}
        {total > 0 && (
          <PontesTablePagination
            total={total} page={page} pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            itemLabel="empréstimos" itemLabelSingular="empréstimo"
          />
        )}
      </PontesCard>

      {/* Modal: Novo empréstimo */}
      <PontesModal
        open={dialogOpen}
        title="Novo empréstimo"
        onClose={() => setDialogOpen(false)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</PontesButton>
          <PontesButton onClick={handleSalvar} loading={loading} disabled={loading}>Criar empréstimo</PontesButton>
        </>}
      >
        <form noValidate onSubmit={(e) => { e.preventDefault(); void handleSalvar() }} className={styles.formCol}>
          <PontesField label="Tipo" required>
            <PontesSelect value={form.tipo} onChange={(v) => setF("tipo", v)} options={TIPOS} />
          </PontesField>

          <PontesField label="Descrição" required error={errors.descricao}>
            <PontesInput
              value={form.descricao}
              onChange={(e) => { setF("descricao", e.target.value); clearErr("descricao") }}
              invalid={!!errors.descricao}
              placeholder="Ex: Empréstimo para viagem"
            />
          </PontesField>

          <PontesField
            label={form.tipo === "1" ? "Para quem emprestei" : "De quem peguei"}
            required
            error={errors.pessoa}
            helper="Guardamos só o nome e o valor — nada além disso dessa pessoa (ver /privacidade)"
          >
            <PontesInput
              value={form.pessoa}
              onChange={(e) => { setF("pessoa", e.target.value); clearErr("pessoa") }}
              invalid={!!errors.pessoa}
              placeholder="Nome da pessoa"
            />
          </PontesField>

          <PontesField label="Valor" required error={errors.valorTotal}>
            <PontesInput
              iconStart="R$"
              value={fmtMoney(form.valorTotal)}
              onChange={(e) => { setF("valorTotal", parseMoney(e.target.value)); clearErr("valorTotal") }}
              invalid={!!errors.valorTotal}
              inputMode="decimal"
              placeholder="0,00"
            />
          </PontesField>

          <div className={styles.grid2}>
            <PontesField label="Data" required>
              <PontesDateInput value={form.dataInicio} onChange={(v) => setF("dataInicio", v)} />
            </PontesField>
            <PontesField label="Vencimento" helper="Opcional">
              <PontesDateInput value={form.dataVencimento} onChange={(v) => setF("dataVencimento", v)} />
            </PontesField>
          </div>

          <PontesField label="Observação" helper="Opcional">
            <PontesTextarea
              value={form.observacao}
              onChange={(e) => setF("observacao", e.target.value)}
              rows={2}
            />
          </PontesField>

          <PontesField label="Forma de pagamento">
            <PontesSelect
              value={form.formaPagamento}
              onChange={(v) => setF("formaPagamento", v as EscolhaFormaPagamento)}
              options={FORMAS_PAGAMENTO}
            />
          </PontesField>

          {form.formaPagamento === "parcelado" && (
            <div className={styles.grid2}>
              <PontesField label="Quantidade de parcelas" required error={errors.quantidadeParcelas}>
                <PontesInput
                  value={form.quantidadeParcelas ?? ""}
                  onChange={(e) => { setF("quantidadeParcelas", e.target.value ? Number(e.target.value) : undefined); clearErr("quantidadeParcelas") }}
                  invalid={!!errors.quantidadeParcelas}
                  inputMode="numeric"
                  placeholder="Ex: 12"
                />
              </PontesField>
              <PontesField label="Vencimento da 1ª parcela" required error={errors.primeiroVencimento}>
                <PontesDateInput
                  value={form.primeiroVencimento}
                  onChange={(v) => { setF("primeiroVencimento", v); clearErr("primeiroVencimento") }}
                />
              </PontesField>
            </div>
          )}

          <div className={styles.grid2}>
            <PontesField label="Juros ao mês" helper={form.formaPagamento === "parcelado" ? "Opcional, sobre o valor da parcela" : "Opcional, sobre o total"}>
              <PontesInput
                value={form.taxaJuroMensal ?? ""}
                onChange={(e) => setF("taxaJuroMensal", e.target.value ? Number(e.target.value) : undefined)}
                inputMode="decimal"
                iconEnd="%"
                placeholder="0"
              />
            </PontesField>
            <PontesField label="Multa por atraso" helper={form.formaPagamento === "parcelado" ? "Opcional, sobre a parcela" : "Opcional, sobre o total"}>
              <PontesInput
                value={form.percentualMultaAtraso ?? ""}
                onChange={(e) => setF("percentualMultaAtraso", e.target.value ? Number(e.target.value) : undefined)}
                inputMode="decimal"
                iconEnd="%"
                placeholder="0"
              />
            </PontesField>
          </div>

          <PontesField label="Esse dinheiro já saiu/entrou de verdade?" required error={errors.movimentacao}>
            <div className={styles.gateGroup}>
              <GateOption name="movimentacao" value="nao" current={form.movimentacao} onChange={handleMovimentacaoChange}>
                Ainda não — é só o combinado, nada pra lançar agora
              </GateOption>
              <GateOption name="movimentacao" value="existente" current={form.movimentacao} onChange={handleMovimentacaoChange}>
                Já lancei isso em outro lugar — quero vincular
              </GateOption>
              <GateOption name="movimentacao" value="novo" current={form.movimentacao} onChange={handleMovimentacaoChange}>
                Já movimentou e ainda não lancei — lançar agora
              </GateOption>
            </div>
          </PontesField>

          {form.movimentacao === "existente" && (
            <PontesField label={form.tipo === "1" ? "Despesa já lançada" : "Receita já lançada"} required
              error={errors.transacaoExistenteId} helper={despesasLoading || receitasLoading ? "Carregando…" : undefined}>
              <PontesSelect
                value={form.transacaoExistenteId}
                onChange={(v) => { setF("transacaoExistenteId", v); clearErr("transacaoExistenteId") }}
                options={(form.tipo === "1" ? despesasRecentes : receitasRecentes).map((t) => ({
                  value: t.id,
                  label: `${formatDate(t.data)} — ${t.descricao} — ${formatMoney(t.valor)}`,
                }))}
                placeholder="Selecione o lançamento"
              />
            </PontesField>
          )}

          {form.movimentacao === "novo" && (
            <div className={styles.grid2}>
              <PontesField label="Conta" required error={errors.contaId}>
                <PontesSelect
                  value={form.contaId}
                  onChange={(v) => { setF("contaId", v); clearErr("contaId") }}
                  options={contas.map((c) => ({ value: c.id, label: c.nome }))}
                  placeholder="Selecione"
                />
              </PontesField>
              <PontesField label="Categoria" required error={errors.categoriaId}>
                <PontesSelect
                  value={form.categoriaId}
                  onChange={(v) => { setF("categoriaId", v); clearErr("categoriaId") }}
                  options={categorias
                    .filter((c) => c.finalidade === 3 || (form.tipo === "1" ? c.finalidade === 1 : c.finalidade === 2))
                    .map((c) => ({ value: c.id, label: c.descricao }))}
                  placeholder="Selecione"
                />
              </PontesField>
            </div>
          )}
        </form>
      </PontesModal>

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
        description="O registro sai da sua lista. Se já tiver pagamento registrado (por qualquer lado), não é possível remover — quite-o em vez disso."
        confirmLabel="Remover"
        onConfirm={handleDelete}
        onCancel={() => setDelId(null)}
      />

      {/* Modal: Vincular a uma pessoa */}
      <PontesModal
        open={vincularFor !== null}
        title="Vincular empréstimo"
        onClose={() => setVincularFor(null)}
        footer={vincularLink ? (
          <PontesButton onClick={() => setVincularFor(null)}>Fechar</PontesButton>
        ) : (
          <>
            <PontesButton variant="outline" onClick={() => setVincularFor(null)}>Cancelar</PontesButton>
            <PontesButton onClick={handleVincular} loading={vincularLoading} disabled={vincularLoading}>
              Gerar convite
            </PontesButton>
          </>
        )}
      >
        <div className={styles.formCol}>
          {!vincularLink ? (
            <PontesField
              label="E-mail da pessoa"
              required
              error={vincularErr}
              helper="Se ela já tiver conta no Pontes, aceita direto. Se não tiver, o link leva pro cadastro."
            >
              <PontesInput
                value={vincularEmail}
                onChange={(e) => { setVincularEmail(e.target.value); setVincularErr(undefined) }}
                invalid={!!vincularErr}
                placeholder="nome@exemplo.com"
                autoFocus
              />
            </PontesField>
          ) : (
            <>
              <p className={styles.itemSub}>
                Copie e envie esse link pra pessoa por WhatsApp, e-mail ou como preferir —
                o Pontes não envia nada automaticamente.
              </p>
              <div className={styles.vincularLinkBox}>
                <Link2 size={14} />
                <span>{vincularLink}</span>
              </div>
              <PontesButton variant="outline" iconStart={<Copy size={14} />} onClick={handleCopiarLink}>
                Copiar link
              </PontesButton>
            </>
          )}
        </div>
      </PontesModal>

      {/* Modal: Registrar pagamento — devedor ou credor, mesmo formulário pros dois papéis
          (unificado 2026-08-08: dois caminhos diferentes pro mesmo conceito quebrava usabilidade
          quando a pessoa é credora numas dívidas e devedora em outras). Devedor: lança saída,
          fica Pendente até o credor aprovar. Credor: lança entrada, já confirma na hora. */}
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
          <p className={styles.itemSub}>
            {souCredorSolicitar
              ? "Isso lança a entrada de verdade na sua conta e já confirma o pagamento — a outra pessoa é avisada."
              : "Isso lança a saída de verdade na sua conta e avisa o credor — só depois que ele confirmar é que o valor pago do empréstimo avança."}
            {isParceladoSolicitar && " Se o valor cobrir mais de uma parcela, todas são quitadas em sequência, da mais antiga pra mais nova. Se não fechar uma parcela inteira, entra como adiantamento nela — nada se perde."}
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
                  value: t.id,
                  label: `${formatDate(t.data)} — ${t.descricao} — ${formatMoney(t.valor)}`,
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

      {/* Modal: Histórico de pagamentos do empréstimo — antes de Aprovar/Rejeitar na árvore, pra
          esses dois (abertos a partir de dentro do histórico) empilharem por cima (mesmo z-index
          fixo no overlay — quem vem depois no DOM pinta em cima). */}
      <PontesModal
        open={historicoFor !== null}
        title="Histórico de pagamentos"
        onClose={() => setHistoricoFor(null)}
        footer={<PontesButton onClick={() => setHistoricoFor(null)}>Fechar</PontesButton>}
      >
        <div className={styles.formCol}>
          {historicoLoading ? (
            <span className={styles.itemSub}>Carregando…</span>
          ) : historico.length === 0 ? (
            <span className={styles.itemSub}>Nenhum pagamento solicitado ainda.</span>
          ) : (
            <ul className={styles.pendentesList}>
              {historico.map((h) => (
                <li key={h.id} className={styles.pendenteItem}>
                  <span className={styles.pendenteDesc}>
                    <strong>{h.solicitadoPorNome}</strong> — {formatMoney(h.valor)}
                    {" "}
                    <PontesBadge
                      size="sm"
                      tone={h.statusAprovacao === StatusAprovacaoPagamentoEmprestimo.Aprovada ? "success"
                        : h.statusAprovacao === StatusAprovacaoPagamentoEmprestimo.Rejeitada ? "danger" : "warning"}
                    >
                      {h.statusAprovacaoDescricao}
                    </PontesBadge>
                    <br />
                    <span className={styles.itemSub}>
                      {!h.registradoPeloCredor && (
                        <>Saída: {formatDate(h.comprovanteData)}{h.comprovanteContaNome && ` · ${h.comprovanteContaNome}`}</>
                      )}
                      {h.recebimentoData && (
                        <>{!h.registradoPeloCredor && " · "}Entrada: {formatDate(h.recebimentoData)}{h.recebimentoContaNome ? ` · ${h.recebimentoContaNome}` : ""}</>
                      )}
                    </span>
                    {h.motivoRejeicao && (
                      <>
                        <br />
                        <span className={styles.itemSub}>Motivo: {h.motivoRejeicao}</span>
                      </>
                    )}
                  </span>
                  {h.statusAprovacao === StatusAprovacaoPagamentoEmprestimo.Pendente && historicoEmprestimo?.souCredor && (
                    <div className={styles.actions}>
                      <PontesIconButton size={32} variant="ghost" aria-label="Aprovar pagamento"
                        disabled={avaliandoId === h.id}
                        onClick={() => openAprovar(h.id)}>
                        <Check size={14} />
                      </PontesIconButton>
                      <PontesIconButton size={32} variant="ghost" aria-label="Rejeitar pagamento"
                        disabled={avaliandoId === h.id}
                        onClick={() => openRejeitar(h.id)}>
                        <X size={14} />
                      </PontesIconButton>
                    </div>
                  )}
                  {h.statusAprovacao === StatusAprovacaoPagamentoEmprestimo.Rejeitada && h.solicitadoPor === currentUser?.id && (
                    <PontesIconButton size={32} variant="ghost" aria-label="Reenviar pagamento"
                      disabled={avaliandoId === h.id}
                      onClick={() => handleReenviar(h.id)}>
                      <RotateCcw size={14} />
                    </PontesIconButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PontesModal>

      {/* Modal: Aprovar pagamento (credor confirma — sempre registra a entrada, vincular ou criar) */}
      <PontesModal
        open={aprovarFor !== null}
        title="Aprovar pagamento"
        onClose={() => setAprovarFor(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setAprovarFor(null)}>Cancelar</PontesButton>
          <PontesButton onClick={handleAprovar} loading={avaliandoId === aprovarFor} disabled={avaliandoId === aprovarFor}>Confirmar recebimento</PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <PontesField label="Como registrar essa entrada?" required error={aprovarErrors.escolha}>
            <div className={styles.gateGroup}>
              <GateOption name="aprovar-escolha" value="existente" current={aprovarEscolha} onChange={handleAprovarEscolhaChange}>
                Já registrei essa entrada em outro lugar — quero vincular
              </GateOption>
              <GateOption name="aprovar-escolha" value="novo" current={aprovarEscolha} onChange={handleAprovarEscolhaChange}>
                Ainda não registrei — registrar agora
              </GateOption>
            </div>
          </PontesField>

          {aprovarEscolha === "existente" && (
            <PontesField label="Receita já lançada" required error={aprovarErrors.transacaoExistenteId}
              helper={receitasLoading ? "Carregando…" : undefined}>
              <PontesSelect
                value={aprovarTransacaoExistenteId}
                onChange={(v) => { setAprovarTransacaoExistenteId(v); setAprovarErrors((p) => ({ ...p, transacaoExistenteId: undefined })) }}
                options={receitasRecentes.map((t) => ({
                  value: t.id,
                  label: `${formatDate(t.data)} — ${t.descricao} — ${formatMoney(t.valor)}`,
                }))}
                placeholder="Selecione a receita"
              />
            </PontesField>
          )}

          {aprovarEscolha === "novo" && (
            <>
              <PontesField label="Conta (pra onde foi)" required error={aprovarErrors.contaId}>
                <PontesSelect
                  value={aprovarForm.contaId}
                  onChange={(v) => { setAprovarForm((f) => ({ ...f, contaId: v })); setAprovarErrors((p) => ({ ...p, contaId: undefined })) }}
                  options={contas.map((c) => ({ value: c.id, label: c.nome }))}
                  placeholder="Selecione"
                />
              </PontesField>
              <PontesField label="Categoria" required error={aprovarErrors.categoriaId}>
                <PontesSelect
                  value={aprovarForm.categoriaId}
                  onChange={(v) => { setAprovarForm((f) => ({ ...f, categoriaId: v })); setAprovarErrors((p) => ({ ...p, categoriaId: undefined })) }}
                  options={categorias.filter((c) => c.finalidade === 2 || c.finalidade === 3).map((c) => ({ value: c.id, label: c.descricao }))}
                  placeholder="Selecione"
                />
              </PontesField>
            </>
          )}
        </div>
      </PontesModal>

      {/* Modal: Rejeitar pagamento (motivo opcional — sempre chega pro devedor via notificação) */}
      <PontesModal
        open={rejeitarFor !== null}
        title="Rejeitar pagamento"
        onClose={() => setRejeitarFor(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setRejeitarFor(null)}>Cancelar</PontesButton>
          <PontesButton variant="danger" onClick={handleRejeitar} loading={avaliandoId === rejeitarFor} disabled={avaliandoId === rejeitarFor}>
            Rejeitar
          </PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <PontesField label="Motivo" helper="Opcional — o devedor vê isso na notificação e no histórico">
            <PontesTextarea
              value={rejeitarMotivo}
              onChange={(e) => setRejeitarMotivo(e.target.value)}
              rows={3}
              placeholder="Ex: valor não bate com o combinado"
              autoFocus
            />
          </PontesField>
        </div>
      </PontesModal>

      {/* Modal: Propor consolidação — credor junta 2+ empréstimos ativos da mesma pessoa vinculada
          num plano novo renegociado. Nada muda até o devedor aceitar (mesmo padrão do vínculo
          bilateral). docs/features/emprestimo-compartilhado/parcelamento-e-agrupamento.md § "Unificar/consolidar". */}
      <PontesModal
        open={consolidarGrupo !== null}
        title="Propor consolidação"
        onClose={() => setConsolidarGrupo(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setConsolidarGrupo(null)}>Cancelar</PontesButton>
          <PontesButton onClick={handleProporConsolidacao} loading={consolidarLoading} disabled={consolidarLoading}>
            Propor
          </PontesButton>
        </>}
      >
        {consolidarGrupo && (
          <form noValidate onSubmit={(e) => { e.preventDefault(); void handleProporConsolidacao() }} className={styles.formCol}>
            <p className={styles.itemSub}>
              Junta os empréstimos escolhidos num plano novo com {consolidarGrupo.contraparteNome} — os originais
              só fecham depois que ela aceitar as novas condições.
            </p>

            <PontesField label="Quais empréstimos entram?" required error={consolidarErrors.selecao}>
              <div className={styles.gateGroup}>
                {consolidarGrupo.itens.map((i) => (
                  <PontesCheckbox
                    key={i.emprestimoOriginalId}
                    checked={consolidarSelecionados.has(i.emprestimoOriginalId)}
                    onChange={() => toggleConsolidarSelecionado(i.emprestimoOriginalId)}
                    label={`${i.descricao} — ${formatMoney(i.valorRestanteSnapshot)}`}
                  />
                ))}
              </div>
            </PontesField>

            <PontesField label="Descrição do plano novo" required error={consolidarErrors.descricao}>
              <PontesInput
                value={consolidarForm.descricao}
                onChange={(e) => { setConsolidarForm((f) => ({ ...f, descricao: e.target.value })); setConsolidarErrors((p) => ({ ...p, descricao: undefined })) }}
                invalid={!!consolidarErrors.descricao}
              />
            </PontesField>

            <PontesField label="Forma de pagamento">
              <PontesSelect
                value={consolidarForm.formaPagamento}
                onChange={(v) => setConsolidarForm((f) => ({ ...f, formaPagamento: v as EscolhaFormaPagamento }))}
                options={FORMAS_PAGAMENTO}
              />
            </PontesField>

            {consolidarForm.formaPagamento === "parcelado" ? (
              <div className={styles.grid2}>
                <PontesField label="Quantidade de parcelas" required error={consolidarErrors.quantidadeParcelas}>
                  <PontesInput
                    value={consolidarForm.quantidadeParcelas ?? ""}
                    onChange={(e) => { setConsolidarForm((f) => ({ ...f, quantidadeParcelas: e.target.value ? Number(e.target.value) : undefined })); setConsolidarErrors((p) => ({ ...p, quantidadeParcelas: undefined })) }}
                    invalid={!!consolidarErrors.quantidadeParcelas}
                    inputMode="numeric"
                    placeholder="Ex: 12"
                  />
                </PontesField>
                <PontesField label="Vencimento da 1ª parcela" required error={consolidarErrors.primeiroVencimento}>
                  <PontesDateInput
                    value={consolidarForm.primeiroVencimento}
                    onChange={(v) => { setConsolidarForm((f) => ({ ...f, primeiroVencimento: v })); setConsolidarErrors((p) => ({ ...p, primeiroVencimento: undefined })) }}
                  />
                </PontesField>
              </div>
            ) : (
              <PontesField label="Vencimento" helper="Opcional">
                <PontesDateInput
                  value={consolidarForm.dataVencimento}
                  onChange={(v) => setConsolidarForm((f) => ({ ...f, dataVencimento: v }))}
                />
              </PontesField>
            )}

            <div className={styles.grid2}>
              <PontesField label="Juros ao mês" helper={consolidarForm.formaPagamento === "parcelado" ? "Opcional, sobre o valor da parcela" : "Opcional, sobre o total"}>
                <PontesInput
                  value={consolidarForm.taxaJuroMensal ?? ""}
                  onChange={(e) => setConsolidarForm((f) => ({ ...f, taxaJuroMensal: e.target.value ? Number(e.target.value) : undefined }))}
                  inputMode="decimal"
                  iconEnd="%"
                  placeholder="0"
                />
              </PontesField>
              <PontesField label="Multa por atraso" helper={consolidarForm.formaPagamento === "parcelado" ? "Opcional, sobre a parcela" : "Opcional, sobre o total"}>
                <PontesInput
                  value={consolidarForm.percentualMultaAtraso ?? ""}
                  onChange={(e) => setConsolidarForm((f) => ({ ...f, percentualMultaAtraso: e.target.value ? Number(e.target.value) : undefined }))}
                  inputMode="decimal"
                  iconEnd="%"
                  placeholder="0"
                />
              </PontesField>
            </div>
          </form>
        )}
      </PontesModal>

      {/* Modal: Recusar consolidação (motivo opcional, mesmo padrão de Rejeitar pagamento) */}
      <PontesModal
        open={recusarConsolidacaoFor !== null}
        title="Recusar consolidação"
        onClose={() => setRecusarConsolidacaoFor(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setRecusarConsolidacaoFor(null)}>Cancelar</PontesButton>
          <PontesButton variant="danger" onClick={handleRecusarConsolidacao}
            loading={respondendoConsolidacaoId === recusarConsolidacaoFor} disabled={respondendoConsolidacaoId === recusarConsolidacaoFor}>
            Recusar
          </PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <PontesField label="Motivo" helper="Opcional — quem propôs vê isso na notificação">
            <PontesTextarea
              value={recusarConsolidacaoMotivo}
              onChange={(e) => setRecusarConsolidacaoMotivo(e.target.value)}
              rows={3}
              placeholder="Ex: prefiro manter separado"
              autoFocus
            />
          </PontesField>
        </div>
      </PontesModal>

    </div>
  )
}
