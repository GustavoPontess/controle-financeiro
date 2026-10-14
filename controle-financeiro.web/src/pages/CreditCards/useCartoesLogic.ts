// Lógica da tela de Cartões (cartões, faturas, navegação por mês, pagar, estornar, cadastrar/editar/remover),
// separada do visual pra a tela real e as bancadas de layout (/credit-cards/lab-*) usarem a MESMA lógica —
// mesmo serviço, mesmas regras, mesmo modal. Os modais saem em `CartoesModais`.
import React, { useCallback, useEffect, useRef, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { formatMoney } from "@/utils/money"
import { getCartoes, createCartao, updateCartao, deleteCartao } from "../../services/cartaoCreditoService"
import { getContas } from "../../services/contaService"
import { getBancos } from "../../services/bancoService"
import { getFaturasByCartao, getFaturaDetalhe, pagarFatura } from "../../services/faturaService"
import { getRecorrentes } from "../../services/recorrenteService"
import { dataComHora, dataLocalISO } from "../../utils/dateTime"
import { notificacaoDeErro } from "../../utils/apiError"
import type { Recorrente } from "../../types/Recorrente"
import type { CartaoCredito, CriarCartaoCredito } from "../../types/CartaoCredito"
import type { Conta } from "../../types/Conta"
import type { Banco } from "../../types/Banco"
import type { Fatura, FaturaDetalhe, PagarFaturaPayload } from "../../types/Fatura"
import { montarCiclos, indiceMes, indiceMesDeHoje, type FaturaView } from "./ciclosFatura"

export type Modo = "credito_debito" | "credito" | "debito" | "prepago"
export const MODOS: { value: Modo; label: string }[] = [
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

export type FormState = Omit<CriarCartaoCredito, "temCredito" | "temDebito" | "ehPrePago"> & { modo: Modo }
const emptyForm: FormState = {
  nome: "", ultimosDigitos: undefined, bandeira: 6, modo: "credito_debito",
  limite: undefined, diaFechamento: undefined, diaVencimento: undefined, contaId: undefined, bancoId: undefined,
}

export type CartaoErrors = { nome?: string; bancoId?: string; ultimosDigitos?: string; limite?: string; diaFechamento?: string; diaVencimento?: string }

type Notification = { open: boolean; message: string; severity: "success" | "error" | "warning" }
export type Notify = React.Dispatch<React.SetStateAction<Notification>>
type OutletContextType = { notify: Notify }

export type PagamentoEmEstorno = { id: string; valor: number; cartaoId: string; faturaId: string }

/**
 * `autoSelecionar`: "unico" (tela real) abre direto o cartão quando só existe um cartão de crédito;
 * "primeiro" sempre abre o primeiro cartão de crédito; "nenhum" não abre nenhum (visão geral).
 * `cartaoId`: abre ESTE cartão (página do cartão, o id vem do endereço) — ganha do `autoSelecionar`.
 */
export function useCartoesLogic({ autoSelecionar = "unico", cartaoId }: {
  autoSelecionar?: "unico" | "primeiro" | "nenhum"; cartaoId?: string
} = {}) {
  const { notify } = useOutletContext<OutletContextType>()
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [bancos, setBancos] = useState<Banco[]>([])
  const [recorrentes, setRecorrentes] = useState<Recorrente[]>([])
  // A 1ª carga terminou (lista vazia de verdade ≠ ainda carregando).
  const [carregado, setCarregado] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formErrors, setFormErrors] = useState<CartaoErrors>({})
  const [loading, setLoading] = useState(false)
  const clearErr = (k: keyof CartaoErrors) => setFormErrors((p) => ({ ...p, [k]: undefined }))

  const [faturasCartaoId, setFaturasCartaoId] = useState<string | null>(null)
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [loadingFaturas, setLoadingFaturas] = useState(false)
  const [faturaDetalhes, setFaturaDetalhes] = useState<Record<string, FaturaDetalhe>>({})
  const [faturaIdx, setFaturaIdx] = useState(0) // 0 = fatura mais recente (atual)

  const [pagarFaturaId, setPagarFaturaId] = useState<string | null>(null)
  const [pagarCartaoId, setPagarCartaoId] = useState<string | null>(null)
  const [pagarForm, setPagarForm] = useState({
    contaId: "", valor: "", dataPagamento: dataLocalISO(), meioPagamento: "4",
  })
  const [pagarErrors, setPagarErrors] = useState<{ conta?: string; valor?: string }>({})
  // O que falta pagar na fatura quando o modal abriu: teto do valor. Pagar acima disso criaria um
  // "crédito" que o app não trata (a API também recusa; aqui o erro aparece no campo, antes de enviar).
  const [pagarRestante, setPagarRestante] = useState(0)
  const [pagarLoading, setPagarLoading] = useState(false)
  // Idempotency-Key da tentativa de pagamento: nasce ao abrir o modal e é reusada nos retries
  // (erro de rede, 409) — a API nunca paga 2x a mesma chave. Reabrir o modal gera outra.
  const [pagarIdemKey, setPagarIdemKey] = useState("")

  const [delId, setDelId] = useState<string | null>(null)
  // Pagamento em confirmação de estorno + a fatura dele (pra recarregar depois).
  const [estornando, setEstornando] = useState<PagamentoEmEstorno | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [cs, conts, bs, recs] = await Promise.all([getCartoes(), getContas(), getBancos(), getRecorrentes().catch(() => [])])
      setCartoes(cs)
      setContas(conts.filter((c) => !c.isCarteira))
      setBancos(bs)
      setRecorrentes(recs)
    } catch {
      notify({ open: true, message: "Erro ao carregar cartões", severity: "error" })
    } finally {
      setCarregado(true)
    }
  }, [notify])

  useEffect(() => { void loadData() }, [loadData])

  const refreshFaturas = useCallback(async (cartaoId: string) => {
    setFaturas(await getFaturasByCartao(cartaoId))
  }, [])

  // Recarrega o detalhe (lançamentos + pagamentos) de uma fatura no cache.
  const refreshDetalhe = useCallback(async (cartaoId: string, faturaId: string) => {
    try {
      const d = await getFaturaDetalhe(cartaoId, faturaId)
      setFaturaDetalhes((prev) => ({ ...prev, [faturaId]: d }))
    } catch { /* ignore */ }
  }, [])

  // Recarrega quando uma transação é criada pelo popup global.
  useEffect(() => {
    const onCreated = () => {
      void loadData()
      if (faturasCartaoId) {
        refreshFaturas(faturasCartaoId).catch(() => { /* ignore */ })
        setFaturaDetalhes({}) // invalida cache → auto-load refaz o detalhe do mês atual
      }
    }
    window.addEventListener("transactionCreated", onCreated)
    return () => window.removeEventListener("transactionCreated", onCreated)
  }, [loadData, faturasCartaoId, refreshFaturas])

  // Ao abrir o cartão, o effect ajusta faturaIdx pra fatura atual (período contém hoje).
  const justOpenedRef = useRef(false)
  const abrirCartao = async (cartaoId: string) => {
    setFaturasCartaoId(cartaoId)
    setFaturaIdx(0)
    justOpenedRef.current = true
    setLoadingFaturas(true)
    try { await refreshFaturas(cartaoId) }
    finally { setLoadingFaturas(false) }
  }
  const fecharCartao = () => setFaturasCartaoId(null)
  // Clicar no cartão já aberto fecha (tela real: grade ↔ modo foco).
  const alternarCartao = async (cartaoId: string) => {
    if (faturasCartaoId === cartaoId) { fecharCartao(); return }
    await abrirCartao(cartaoId)
  }

  // Abre um cartão sozinho uma vez: na tela real só com um único cartão de crédito; nas bancadas, o 1º.
  const didAutoOpenRef = useRef(false)
  useEffect(() => {
    if (didAutoOpenRef.current || faturasCartaoId) return
    const credito = cartoes.filter((c) => c.temCredito)
    const abrir = cartaoId ? credito.find((c) => c.id === cartaoId)
      : autoSelecionar === "primeiro" ? credito[0]
      : autoSelecionar === "unico" && cartoes.length === 1 && credito.length === 1 ? credito[0]
      : undefined
    if (abrir) {
      didAutoOpenRef.current = true
      void abrirCartao(abrir.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartoes])

  const openPagar = (faturaId: string, cartaoId: string, valorRestante: number, contaId?: string) => {
    setPagarFaturaId(faturaId)
    setPagarCartaoId(cartaoId)
    setPagarErrors({})
    setPagarRestante(valorRestante)
    setPagarIdemKey(crypto.randomUUID())
    setPagarForm({
      contaId: contaId ?? "", valor: String(valorRestante.toFixed(2)),
      dataPagamento: dataLocalISO(), meioPagamento: "4",
    })
  }

  // Recarrega o que o pagamento mexe: limite do cartão, lista de faturas e o detalhe (timeline de
  // pagamentos). Fica FORA do try do pagamento: se a recarga falhar depois de um pagamento que deu
  // certo, isso não pode virar "Erro ao registrar pagamento" — o usuário tentaria pagar de novo.
  const recarregarFaturaDoPagamento = async (cartaoId: string, faturaId: string) => {
    await loadData() // tem catch próprio (toast de carregamento, não de pagamento)
    try {
      if (faturasCartaoId) await refreshFaturas(faturasCartaoId)
    } catch { /* lista fica como estava; o pagamento já está registrado */ }
    await refreshDetalhe(cartaoId, faturaId) // tem catch próprio
  }

  const handlePagar = async () => {
    if (!pagarFaturaId || !pagarCartaoId) return
    const cartaoId = pagarCartaoId, faturaId = pagarFaturaId
    const e: { conta?: string; valor?: string } = {}
    if (!pagarForm.contaId) e.conta = "Selecione a conta"
    if (!pagarForm.valor || Number(pagarForm.valor) <= 0) e.valor = "Informe um valor válido"
    else if (Number(pagarForm.valor) > pagarRestante + 0.005)
      e.valor = `O valor não pode passar do que falta pagar (${formatMoney(pagarRestante)})`
    setPagarErrors(e)
    if (Object.keys(e).length) return
    setPagarLoading(true)
    try {
      const payload: PagarFaturaPayload = {
        contaId: pagarForm.contaId, valor: Number(pagarForm.valor),
        // Pagamento é ação real: grava a hora (hoje → agora) pra aparecer na lista.
        dataPagamento: dataComHora(pagarForm.dataPagamento), meioPagamento: Number(pagarForm.meioPagamento),
      }
      await pagarFatura(cartaoId, faturaId, payload, pagarIdemKey)
    } catch (err) {
      // 4xx com mensagem do servidor vira AVISO com essa mensagem (ex.: "Valor inválido. Restante
      // a pagar: …"); rede/5xx segue como erro genérico e o modal fica aberto pro retry (mesma chave).
      notify({ open: true, ...notificacaoDeErro(err, "Erro ao registrar pagamento") })
      // 409 = o que está na tela ficou velho: chave já usada com outros dados, fatura alterada por
      // outra operação ou já quitada. Fecha o modal e recarrega a fatura — pagar de novo exige
      // reabrir o modal, que parte do restante atualizado e com chave nova.
      if ((err as { response?: { status?: number } })?.response?.status === 409) {
        setPagarFaturaId(null)
        await recarregarFaturaDoPagamento(cartaoId, faturaId)
      }
      return
    } finally { setPagarLoading(false) }
    notify({ open: true, message: "Pagamento registrado com sucesso", severity: "success" })
    setPagarFaturaId(null)
    await recarregarFaturaDoPagamento(cartaoId, faturaId)
  }

  const temCredito = form.modo === "credito" || form.modo === "credito_debito"

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
  const totalUsado = cartoes.filter((c) => c.temCredito).reduce((s, c) => s + (c.limiteUsado ?? 0), 0)
  // Disponível somado por cartão: o estouro de um cartão (disponível negativo) não come o dos outros.
  const totalDisp = cartoes.filter((c) => c.temCredito && c.limite).reduce((s, c) => s + Math.max(0, c.limiteDisponivel ?? 0), 0)
  const cartaoAtivo = cartoes.find((c) => c.id === faturasCartaoId)
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Faturas reais ordenadas da mais recente para a mais antiga.
  const faturasSorted = [...faturas].sort((a, b) => new Date(b.dataFechamento).getTime() - new Date(a.dataFechamento).getTime())

  // "Agora" capturado uma vez no mount — puro (sem Date.now no render).
  const [now] = useState(() => Date.now())

  // Faturas previstas das assinaturas (recorrentes mensais no cartão) — até 12 meses
  // a partir de hoje (sem ultrapassar, sem duplicar com faturas reais já criadas).
  const addMonthsISO = (iso: string, n: number) => { const d = new Date(iso); d.setMonth(d.getMonth() + n); return d.toISOString() }
  const assinaturasCartao = recorrentes.filter((r) => r.ativo && r.cartaoCreditoId === faturasCartaoId && r.frequencia === 2)
  const baseFatura = faturasSorted[0]
  const previstas: FaturaView[] = []
  if (cartaoAtivo && baseFatura && assinaturasCartao.length > 0) {
    const total = assinaturasCartao.reduce((s, r) => s + r.valor, 0)
    // Horizonte = fim do ano corrente (Dezembro). Projeta os meses faltantes até lá.
    const horizonte = new Date(new Date(now).getFullYear(), 11, 1) // Dez/01 (mês 11)
    const baseDate = new Date(baseFatura.dataFechamento)
    const monthsToProject = Math.max(0, (horizonte.getFullYear() - baseDate.getFullYear()) * 12 + (horizonte.getMonth() - baseDate.getMonth()))
    for (let n = 1; n <= monthsToProject; n++) {
      const dataFechamento = addMonthsISO(baseFatura.dataFechamento, n)
      const fech = new Date(dataFechamento)
      previstas.push({
        ...baseFatura,
        id: `prev-${baseFatura.id}-${n}`,
        dataInicio: addMonthsISO(baseFatura.dataInicio, n),
        dataFechamento,
        dataVencimento: addMonthsISO(baseFatura.dataVencimento, n),
        valorTotal: total, valorPago: 0, valorRestante: total,
        estadoCiclo: 0, estadoPagamento: 0, vencida: false,
        prevista: true,
        projLancamentos: assinaturasCartao.map((r) => ({
          id: `prevl-${r.id}-${n}`,
          descricao: r.descricao,
          valor: r.valor,
          data: new Date(Date.UTC(fech.getFullYear(), fech.getMonth(), Math.min(r.dia, 28))).toISOString(),
        })),
      })
    }
  }

  // Sequência contínua de meses pro navegador — reais + previstas + meses vazios, mais recente
  // primeiro (índice 0), SEMPRE incluindo o mês de hoje. Ver ciclosFatura.ts.
  const ciclos = cartaoAtivo
    ? montarCiclos({
        reais: faturas, previstas, hoje: new Date(now),
        cartaoId: cartaoAtivo.id, cartaoNome: cartaoAtivo.nome,
        diaFechamento: cartaoAtivo.diaFechamento, diaVencimento: cartaoAtivo.diaVencimento,
      })
    : []
  // Mês ATUAL = o ciclo que contém hoje (sempre existe em `ciclos`, com ou sem fatura real).
  const mesHoje = cartaoAtivo ? indiceMesDeHoje(new Date(now), cartaoAtivo.diaFechamento) : -1
  const atualIdx = Math.max(0, ciclos.findIndex((f) => indiceMes(f.dataFechamento) === mesHoje))
  const ultimoIdx = Math.max(0, ciclos.length - 1)
  const idxSelecionado = Math.max(0, Math.min(faturaIdx, ultimoIdx))

  // Quando acabou de abrir o cartão, posiciona no mês atual — só depois das faturas carregarem
  // (antes, com a lista ainda vazia/velha, o índice apontaria pro mês errado).
  useEffect(() => {
    if (!justOpenedRef.current || loadingFaturas || !cartaoAtivo) return
    justOpenedRef.current = false
    setFaturaIdx(atualIdx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faturas, loadingFaturas])

  // Limite atual da navegação, lido pelo irParaFatura (o teclado dispara vários passos seguidos).
  const ultimoIdxRef = useRef(0)
  useEffect(() => { ultimoIdxRef.current = ultimoIdx }, [ultimoIdx])

  // Navegação iniciada pelo usuário cancela o auto-foco pendente — senão o effect
  // de "abrir → fatura atual" pode disparar atrasado e sobrescrever a escolha.
  // Clampa no intervalo válido: sem isso, apertar → além do fim acumulava passos invisíveis.
  const irParaFatura = useCallback((updater: number | ((i: number) => number)) => {
    justOpenedRef.current = false
    setFaturaIdx((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      return Math.max(0, Math.min(next, ultimoIdxRef.current))
    })
  }, [])

  // Atalhos teclado ← → pra navegar entre meses quando o painel está aberto.
  // Ignora quando foco está num campo de texto/select (não atrapalha digitação).
  useEffect(() => {
    if (!faturasCartaoId) return
    const onKey = (ev: KeyboardEvent) => {
      const tgt = ev.target as HTMLElement | null
      if (tgt && /input|textarea|select/i.test(tgt.tagName)) return
      if (tgt && tgt.isContentEditable) return
      if (ev.key === "ArrowLeft") { ev.preventDefault(); irParaFatura((i) => i + 1) }
      else if (ev.key === "ArrowRight") { ev.preventDefault(); irParaFatura((i) => i - 1) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [faturasCartaoId, irParaFatura])

  // IDs das faturas REAIS a carregar = mês selecionado + vizinhos (janela de 3) ainda não
  // cacheados. Prevista/vazia não existem no backend. Calculado fora do effect → deps estáveis.
  const idsParaCarregar = (() => {
    if (!faturasCartaoId || ciclos.length === 0) return [] as string[]
    return [idxSelecionado - 1, idxSelecionado, idxSelecionado + 1]
      .filter((i) => i >= 0 && i < ciclos.length)
      .map((i) => ciclos[i])
      .filter((f) => !f.prevista && !f.vazia)
      .map((f) => f.id)
      .filter((id) => !faturaDetalhes[id])
  })()
  const idsKey = idsParaCarregar.join(",")
  useEffect(() => {
    if (!faturasCartaoId || !idsKey) return
    idsKey.split(",").forEach((id) => {
      getFaturaDetalhe(faturasCartaoId, id)
        .then((d) => setFaturaDetalhes((prev) => (prev[id] ? prev : { ...prev, [id]: d })))
        .catch(() => { /* ignore */ })
    })
  }, [faturasCartaoId, idsKey])

  return {
    notify, now, carregado, cartoes, contas, bancos, recorrentes,
    totalLimite, totalUsado, totalDisp,
    // seleção de cartão
    faturasCartaoId, cartaoAtivo, abrirCartao, fecharCartao, alternarCartao,
    // faturas do cartão aberto
    faturas, loadingFaturas, faturaDetalhes, ciclos, atualIdx, ultimoIdx, idxSelecionado, irParaFatura,
    // ações (abrem os modais de CartoesModais)
    openCreate, openEdit, pedirRemocao: setDelId, openPagar, pedirEstorno: setEstornando,
    // estado dos modais — consumido só por CartoesModais
    modais: {
      dialogOpen, setDialogOpen, editingId, form, setForm, setF, formErrors, setFormErrors, clearErr,
      loading, temCredito, handleSalvar,
      pagarFaturaId, setPagarFaturaId, pagarForm, setPagarForm, pagarErrors, setPagarErrors, pagarLoading, handlePagar,
      delId, setDelId, handleDelete,
      estornando, setEstornando, recarregarFaturaDoPagamento,
    },
  }
}

export type CartoesLogic = ReturnType<typeof useCartoesLogic>
