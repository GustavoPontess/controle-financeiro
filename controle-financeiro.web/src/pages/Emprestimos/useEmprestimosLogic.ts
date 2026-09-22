// Lógica completa da tela de Empréstimos, extraída pra hook — reaproveitada pelas 3 páginas de
// bancada (EmprestimosLabA/B/C) pra comparar composições de TELA INTEIRA com ações reais, sem
// duplicar ~700 linhas de estado/handlers 3x. Não usado pela EmprestimosPage.tsx real (mantida
// intacta, zero risco pros testes existentes).
import { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useAuth } from "../../hooks/useAuth"
import {
  listEmprestimosPage, getEmprestimo, getEmprestimoStats, createEmprestimo, quitarEmprestimo, deleteEmprestimo,
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
  StatusConsolidacaoEmprestimo, FormaPagamentoEmprestimo,
  type Emprestimo, type CriarEmprestimo, type EmprestimoConvitePendente, type EmprestimoPagamentoSolicitacao,
  type EmprestimoParcela, type EmprestimoConsolidacaoCandidato, type EmprestimoConsolidacaoProposta,
} from "../../types/Emprestimo"
import { getContas } from "../../services/contaService"
import { getCategories } from "../../services/categoryService"
import { getBancos } from "../../services/bancoService"
import { listTransactionsPage } from "../../services/transactionService"
import type { Conta } from "../../types/Conta"
import type { Category } from "../../types/Category"
import type { Banco } from "../../types/Banco"
import type { Transaction } from "../../types/Transaction"

export const errorMessage = (err: unknown, fallback: string): string =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

export const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—"

export const formatDateTime = (d?: string) =>
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"

const today = () => new Date().toISOString().slice(0, 10)

export const parseMoney = (masked: string): number | undefined => {
  const digits = masked.replace(/\D/g, "")
  return digits ? Number(digits) / 100 : undefined
}
export const fmtMoney = (n?: number): string =>
  n != null ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""

export const TIPOS = [
  { value: "1", label: "Emprestei (vou receber)" },
  { value: "2", label: "Peguei emprestado (vou pagar)" },
]

export const FORMAS_PAGAMENTO = [
  { value: "avista", label: "À vista" },
  { value: "parcelado", label: "Parcelado" },
]

export type EscolhaMovimentacao = "" | "nao" | "existente" | "novo"
export type EscolhaComprovante = "" | "existente" | "novo"
export type EscolhaFormaPagamento = "avista" | "parcelado"

export type FormState = {
  descricao: string
  pessoa: string
  valorTotal?: number
  tipo: string
  /** Com quem é o empréstimo: pessoa física (P2P) ou um banco. Decide qual campo aparece. */
  modalidade: "pessoa" | "banco"
  bancoId: string
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
  descricao: "", pessoa: "", valorTotal: undefined, tipo: "1", modalidade: "pessoa", bancoId: "",
  dataInicio: today(), dataVencimento: "", observacao: "",
  movimentacao: "", contaId: "", categoriaId: "", transacaoExistenteId: "",
  formaPagamento: "avista", quantidadeParcelas: undefined, primeiroVencimento: "",
  taxaJuroMensal: undefined, percentualMultaAtraso: undefined,
}
export type Errors = Partial<Record<
  "descricao" | "pessoa" | "bancoId" | "valorTotal" | "contaId" | "categoriaId" | "movimentacao" | "transacaoExistenteId"
  | "quantidadeParcelas" | "primeiroVencimento", string>>

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

// `focusId` (opcional): id de um empréstimo aberto por URL (tela de detalhe). Garante que ele esteja
// sempre em `emprestimos` mesmo que caia fora da página carregada (>100 ou arquivado) — os handlers
// dos modais fazem `emprestimos.find(id)`, então sem isso as ações quebrariam no detalhe. A lista real
// não passa nada e segue idêntica.
export function useEmprestimosLogic(focusId?: string) {
  const { notify } = useOutletContext<OutletContextType>()
  const { currentUser } = useAuth()

  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([])
  const [stats, setStats] = useState<EmprestimoStats>({
    totalAReceber: 0, totalAPagar: 0, ativos: 0, qtdTotal: 0, totalAReceberVencido: 0,
  })
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(100)
  // Busca + direção — filtro SERVER-SIDE (o backend pagina já filtrado).
  const [busca, setBuscaState] = useState("")
  const [buscaDebounced, setBuscaDebounced] = useState("")
  const [direcao, setDirecaoState] = useState<"todos" | "receber" | "pagar">("todos")
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300) // debounce: 1 request por pausa, não por tecla
    return () => clearTimeout(t)
  }, [busca])
  const setBusca = (v: string) => { setBuscaState(v); setPage(1) }
  const setDirecao = (v: "todos" | "receber" | "pagar") => { setDirecaoState(v); setPage(1) }
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
  const [bancos, setBancos] = useState<Banco[]>([])
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

  const [pendentes, setPendentes] = useState<EmprestimoConvitePendente[]>([])
  const [respondendoId, setRespondendoId] = useState<string | null>(null)
  const [vincularFor, setVincularFor] = useState<string | null>(null)
  const [vincularEmail, setVincularEmail] = useState("")
  const [vincularErr, setVincularErr] = useState<string | undefined>(undefined)
  const [vincularLink, setVincularLink] = useState<string | null>(null)
  const [vincularLoading, setVincularLoading] = useState(false)

  const [avaliandoId, setAvaliandoId] = useState<string | null>(null)
  const [solicitarFor, setSolicitarFor] = useState<string | null>(null)
  const [solicitarForm, setSolicitarForm] = useState<{ valor?: number; contaId: string; categoriaId: string }>({ valor: undefined, contaId: "", categoriaId: "" })
  const [solicitarErrors, setSolicitarErrors] = useState<{ valor?: string; contaId?: string; categoriaId?: string; escolha?: string; transacaoExistenteId?: string }>({})
  const [solicitarIdemKey, setSolicitarIdemKey] = useState("")
  const [solicitarEscolha, setSolicitarEscolha] = useState<EscolhaComprovante>("")
  const [solicitarTransacaoExistenteId, setSolicitarTransacaoExistenteId] = useState("")
  const [aprovarFor, setAprovarFor] = useState<string | null>(null)
  const [aprovarForm, setAprovarForm] = useState<{ contaId: string; categoriaId: string }>({ contaId: "", categoriaId: "" })
  const [aprovarErrors, setAprovarErrors] = useState<{ escolha?: string; contaId?: string; categoriaId?: string; transacaoExistenteId?: string }>({})
  const [aprovarEscolha, setAprovarEscolha] = useState<EscolhaComprovante>("")
  const [aprovarTransacaoExistenteId, setAprovarTransacaoExistenteId] = useState("")
  const [rejeitarFor, setRejeitarFor] = useState<string | null>(null)
  const [rejeitarMotivo, setRejeitarMotivo] = useState("")
  const [historicoFor, setHistoricoFor] = useState<string | null>(null)
  const [historico, setHistorico] = useState<EmprestimoPagamentoSolicitacao[]>([])
  const [historicoLoading, setHistoricoLoading] = useState(false)
  const [historicoInlineParcelaId, setHistoricoInlineParcelaId] = useState<string | null>(null)
  const [historicoInlineLista, setHistoricoInlineLista] = useState<EmprestimoPagamentoSolicitacao[]>([])
  const [historicoInlineLoading, setHistoricoInlineLoading] = useState(false)

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
      const [pageResult, statsResult, pendentesResult, contasResult, categoriasResult, bancosResult, candidatosResult, consolidacoesResult] = await Promise.all([
        listEmprestimosPage(page, pageSize, mostrarArquivados, buscaDebounced, direcao === "todos" ? undefined : direcao),
        getEmprestimoStats(),
        listConvitesPendentesEmprestimo(),
        getContas(),
        getCategories(),
        getBancos(),
        listCandidatosConsolidacao(),
        listConsolidacoes(),
      ])
      // Tela de detalhe: se o empréstimo focado não veio na página, busca-o e prepende — assim os
      // handlers dos modais (que fazem emprestimos.find) sempre o acham, mesmo após um reload.
      let itens = pageResult.items
      if (focusId && !itens.some((e) => e.id === focusId)) {
        try {
          const focado = await getEmprestimo(focusId)
          if (focado) itens = [focado, ...itens]
        } catch { /* detalhe faz o próprio tratamento de erro/404 */ }
      }
      setEmprestimos(itens)
      setTotal(pageResult.total)
      setStats(statsResult)
      setPendentes(pendentesResult)
      setContas(contasResult)
      setCategorias(categoriasResult)
      setBancos(bancosResult)
      setCandidatosConsolidacao(candidatosResult)
      setConsolidacoes(consolidacoesResult)
    } catch {
      notify({ open: true, message: "Erro ao carregar empréstimos", severity: "error" })
    }
  }, [notify, page, pageSize, mostrarArquivados, buscaDebounced, direcao, focusId])

  useEffect(() => { void loadData() }, [loadData])

  const clearErr = (k: keyof Errors) => setErrors((p) => ({ ...p, [k]: undefined }))
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const openCreate = () => {
    setForm(emptyForm); setErrors({}); setDialogOpen(true)
    setIdemKey(crypto.randomUUID())
  }

  const handleAceitarConvite = async (id: string) => {
    setRespondendoId(id)
    try {
      await aceitarVinculoEmprestimoPorId(id)
      notify({ open: true, message: "Vínculo aceito", severity: "success" })
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao aceitar convite"), severity: "error" })
    } finally { setRespondendoId(null) }
  }

  const handleRecusarConvite = async (id: string) => {
    setRespondendoId(id)
    try {
      await recusarVinculoEmprestimoPorId(id)
      notify({ open: true, message: "Convite recusado", severity: "success" })
      await loadData()
    } catch (err) {
      notify({ open: true, message: errorMessage(err, "Erro ao recusar convite"), severity: "error" })
    } finally { setRespondendoId(null) }
  }

  const handleMovimentacaoChange = (v: string) => {
    setF("movimentacao", v as EscolhaMovimentacao)
    clearErr("movimentacao")
    if (v === "existente") void (form.tipo === "1" ? carregarDespesasRecentes() : carregarReceitasRecentes())
  }

  const handleSalvar = async () => {
    const e: Errors = {}
    const ehBanco = form.modalidade === "banco"
    if (!form.descricao.trim()) e.descricao = "Informe a descrição"
    if (ehBanco) {
      if (!form.bancoId) e.bancoId = "Escolha o banco"
    } else if (!form.pessoa.trim()) {
      e.pessoa = form.tipo === "1" ? "Informe pra quem emprestou" : "Informe de quem pegou"
    }
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
      // Bancário: a "pessoa" é o próprio banco (o backend exige Pessoa) — preenche com o nome do
      // banco pra não pedir isso do usuário. P2P: a pessoa digitada.
      const nomeBanco = bancos.find((b) => b.id === form.bancoId)?.nome ?? ""
      const payload: CriarEmprestimo = {
        descricao: form.descricao.trim(),
        pessoa: ehBanco ? nomeBanco : form.pessoa.trim(),
        valorTotal: form.valorTotal!,
        tipo: Number(form.tipo),
        bancoId: ehBanco ? form.bancoId : undefined,
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

  // Validação por passo do wizard de novo empréstimo (mesmas regras do handleSalvar, fatiadas).
  // Passo 0 = básico (descrição/pessoa/valor); 1 = condições (parcelas); 2 = movimentação.
  const validarPassoNovo = (step: number): boolean => {
    const e: Errors = {}
    if (step === 0) {
      if (!form.descricao.trim()) e.descricao = "Informe a descrição"
      if (form.modalidade === "banco") {
        if (!form.bancoId) e.bancoId = "Escolha o banco"
      } else if (!form.pessoa.trim()) {
        e.pessoa = form.tipo === "1" ? "Informe pra quem emprestou" : "Informe de quem pegou"
      }
      if (form.valorTotal == null) e.valorTotal = "Informe o valor"
      else if (form.valorTotal <= 0) e.valorTotal = "Valor deve ser maior que zero"
    } else if (step === 1) {
      if (form.formaPagamento === "parcelado") {
        if (!form.quantidadeParcelas || form.quantidadeParcelas < 2 || form.quantidadeParcelas > 36)
          e.quantidadeParcelas = "Entre 2 e 36 parcelas"
        if (!form.primeiroVencimento) e.primeiroVencimento = "Informe o vencimento da 1ª parcela"
      }
    }
    setErrors((p) => ({ ...p, ...e }))
    return Object.keys(e).length === 0
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
    } finally { setVincularLoading(false) }
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

  return {
    currentUser, notify,
    emprestimos, stats, total, page, setPage, pageSize, setPageSize,
    busca, setBusca, direcao, setDirecao,
    dialogOpen, setDialogOpen, quitarId, setQuitarId, delId, setDelId,
    arquivandoId, mostrarArquivados, setMostrarArquivados, loading,
    form, setF, errors, clearErr, contas, categorias, bancos,
    despesasRecentes, despesasLoading, receitasRecentes, receitasLoading,
    openCreate, handleSalvar, validarPassoNovo, handleMovimentacaoChange,
    pendentes, respondendoId, handleAceitarConvite, handleRecusarConvite,
    vincularFor, setVincularFor, vincularEmail, setVincularEmail, vincularErr, setVincularErr,
    vincularLink, vincularLoading, openVincular, handleVincular, handleCopiarLink,
    handleQuitar, handleDelete, handleArquivar, handleDesarquivar,
    avaliandoId,
    solicitarFor, setSolicitarFor, solicitarForm, setSolicitarForm, solicitarErrors, setSolicitarErrors,
    solicitarEscolha, solicitarTransacaoExistenteId, setSolicitarTransacaoExistenteId,
    openSolicitar, handleSolicitarEscolhaChange, handleSolicitar,
    aprovarFor, setAprovarFor, aprovarForm, setAprovarForm, aprovarErrors, aprovarEscolha,
    aprovarTransacaoExistenteId, setAprovarTransacaoExistenteId,
    openAprovar, handleAprovarEscolhaChange, handleAprovar,
    rejeitarFor, setRejeitarFor, rejeitarMotivo, setRejeitarMotivo, openRejeitar, handleRejeitar,
    handleReenviar,
    historicoFor, setHistoricoFor, historico, historicoLoading, openHistorico,
    historicoInlineParcelaId, historicoInlineLista, historicoInlineLoading, toggleHistoricoParcela,
    candidatosConsolidacao, consolidacoesRecebidas, consolidacoesEnviadas, respondendoConsolidacaoId,
    consolidarGrupo, setConsolidarGrupo, consolidarSelecionados, toggleConsolidarSelecionado,
    consolidarForm, setConsolidarForm, consolidarErrors, consolidarLoading,
    openConsolidar, handleProporConsolidacao, handleAceitarConsolidacao,
    recusarConsolidacaoFor, setRecusarConsolidacaoFor, recusarConsolidacaoMotivo, setRecusarConsolidacaoMotivo,
    openRecusarConsolidacao, handleRecusarConsolidacao, handleCancelarConsolidacao,
    expandedId, parcelasPorEmprestimo, parcelasLoadingId, toggleExpand,
    totalAReceber, totalAPagar, qtdAtivos, totalAReceberVencido,
    isParceladoSolicitar, souCredorSolicitar, historicoEmprestimo,
  }
}

export type EmprestimosLogic = ReturnType<typeof useEmprestimosLogic>
