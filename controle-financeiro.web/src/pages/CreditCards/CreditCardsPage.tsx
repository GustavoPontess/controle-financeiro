import React, { useCallback, useEffect, useRef, useState } from "react"
import { formatMoney } from "@/utils/money"
import { useOutletContext } from "react-router-dom"
import {
  Plus, Pencil, Trash2, CreditCard, ReceiptText, ChevronLeft, ChevronRight, Banknote, Check, Wifi,
} from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesBadge, PontesCard, PontesModal, PontesDialog,
  PontesField, PontesInput, PontesDateInput, PontesSelect, PontesEmptyState, PontesSkeletonList,
} from "@/components/pontes"
// Logos reais das bandeiras — vendorizados localmente (Apache-2.0, ver src/assets/bandeiras/LICENSE.txt),
// sem dependência de runtime pra 6 arquivos estáticos.
import visaLogo from "@/assets/bandeiras/visa.svg"
import mastercardLogo from "@/assets/bandeiras/mastercard.svg"
import eloLogo from "@/assets/bandeiras/elo.svg"
import hipercardLogo from "@/assets/bandeiras/hipercard.svg"
import amexLogo from "@/assets/bandeiras/amex.svg"
import { getCartoes, createCartao, updateCartao, deleteCartao } from "../../services/cartaoCreditoService"
import { getContas } from "../../services/contaService"
import { getBancos } from "../../services/bancoService"
import { getFaturasByCartao, getFaturaDetalhe, pagarFatura } from "../../services/faturaService"
import { dataComHora, dataLocalISO } from "../../utils/dateTime"
import { notificacaoDeErro } from "../../utils/apiError"
import { getRecorrentes } from "../../services/recorrenteService"
import type { Recorrente } from "../../types/Recorrente"
import type { CartaoCredito, CriarCartaoCredito } from "../../types/CartaoCredito"
import type { Conta } from "../../types/Conta"
import type { Banco } from "../../types/Banco"
import type { Fatura, FaturaDetalhe, FaturaPagamento, PagarFaturaPayload } from "../../types/Fatura"
import { montarCiclos, indiceMes, indiceMesDeHoje, type FaturaView } from "./ciclosFatura"
import styles from "./CreditCardsPage.module.css"

// Máscara de moeda pro input de limite: dígitos → número (centavos) e volta.
const parseMoney = (masked: string): number | undefined => {
  const digits = masked.replace(/\D/g, "")
  return digits ? Number(digits) / 100 : undefined
}
const fmtMoneyInput = (n?: number): string =>
  n != null ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
// Datas de ciclo vêm como UTC (meia-noite) — formata em UTC pra não cair pro dia anterior.
const formatDate = (s: string) => new Date(s).toLocaleDateString("pt-BR", { timeZone: "UTC" })
// Mês de referência da fatura (ex.: "Junho 2026") — usa o fechamento.
const mesLabel = (s: string) => {
  const m = new Date(s).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
  return m.charAt(0).toUpperCase() + m.slice(1)
}

// Só 6 bandeiras — poucas o bastante pra virar chips visuais (3 por linha) em vez
// de select. 1 toque, sem digitar número nenhum (nem completo, nem mascarado).
const BANDEIRA_OPTIONS = [
  { value: 1, label: "Visa" }, { value: 2, label: "Mastercard" }, { value: 3, label: "Elo" },
  { value: 4, label: "Hipercard" }, { value: 5, label: "American Express" }, { value: 6, label: "Outros" },
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

// Escurece um hex (mistura com preto) — pra gerar gradient bonito a partir
// da cor da marca do banco (Nubank #820AD1 → #4a0577 + #820AD1).
function darken(hex: string, amount = 0.45): string {
  const h = hex.replace("#", "")
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16)
  const k = 1 - amount
  const rr = Math.round(r * k), gg = Math.round(g * k), bb = Math.round(b * k)
  return `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`
}
function cardGradient(bancoCor: string | undefined, bandeira: number): string {
  if (bancoCor && /^#?[0-9a-f]{3,8}$/i.test(bancoCor)) {
    const hex = bancoCor.startsWith("#") ? bancoCor : `#${bancoCor}`
    return `linear-gradient(135deg, ${darken(hex, 0.45)}, ${hex})`
  }
  return grad(bandeira)
}

// Próxima ocorrência (dia do mês) a partir de hoje. Se o dia já passou no mês
// atual, pula pro próximo mês. Retorna dias inteiros até essa data.
function diasAteProxDia(dia: number | undefined, now: number): number | null {
  if (!dia) return null
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const y = today.getFullYear(), m = today.getMonth()
  const ultimoDoMes = new Date(y, m + 1, 0).getDate()
  let alvo = new Date(y, m, Math.min(dia, ultimoDoMes))
  if (alvo < today) {
    const proxUltimo = new Date(y, m + 2, 0).getDate()
    alvo = new Date(y, m + 1, Math.min(dia, proxUltimo))
  }
  return Math.round((alvo.getTime() - today.getTime()) / 86_400_000)
}

// Logo oficial real da bandeira — mesmo princípio já usado pro logo do banco
// (PontesBankBadge): marca de verdade, não abstração nossa. "Outros" não tem
// logo (não é uma bandeira real) — usa o ícone genérico de cartão.
const BANDEIRA_LOGO: Record<number, string> = {
  1: visaLogo, 2: mastercardLogo, 3: eloLogo, 4: hipercardLogo, 5: amexLogo,
}
function BandeiraMark({ bandeira, width = 46, genericColor = "#fff" }: { bandeira: number; width?: number; genericColor?: string }) {
  const logo = BANDEIRA_LOGO[bandeira]
  if (!logo) return <CreditCard size={Math.round(width * 0.5)} color={genericColor} strokeWidth={2} />
  return <img src={logo} alt="" width={width} style={{ display: "block", borderRadius: 4 }} />
}

const STATUS: Record<number, { label: string; tone: "soft" | "warning" | "success" | "neutral" }> = {
  1: { label: "Aberta", tone: "soft" },
  2: { label: "Fechada", tone: "warning" },
  3: { label: "Paga", tone: "success" },
  4: { label: "Futura", tone: "neutral" },
}
// "Paga" só quando a fatura FECHOU e não há saldo restante. Enquanto aberta,
// permanece "Aberta" mesmo com pagamento parcial/antecipado — novas compras
// ainda podem entrar no ciclo. Fechada com saldo restante → "Fechada" (a pagar).
// "Futura": ciclo ainda nem começou (dataInicio > hoje). Bancos reais (Nubank,
// Itaú, Bradesco) NÃO permitem pagar fatura futura inteira — só antecipar
// parcelas individuais (não implementado). Bloqueio do botão Pagar.
const statusKey = (f: Fatura, now: number) => {
  if (f.estadoCiclo === 1) return f.valorRestante <= 0 ? 3 : 2
  return new Date(f.dataInicio).getTime() > now ? 4 : 1
}

// Clampa input de dia em [1..31] enquanto digita — `<input max=31>` deixa
// digitar 99; melhor capar no onChange pra não confundir o usuário.
const clampDia = (raw: string): number | undefined => {
  if (!raw) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n)) return undefined
  return Math.max(1, Math.min(31, Math.trunc(n)))
}

type FormState = Omit<CriarCartaoCredito, "temCredito" | "temDebito" | "ehPrePago"> & { modo: Modo }
const emptyForm: FormState = {
  nome: "", ultimosDigitos: undefined, bandeira: 6, modo: "credito_debito",
  limite: undefined, diaFechamento: undefined, diaVencimento: undefined, contaId: undefined, bancoId: undefined,
}

type CartaoErrors = { nome?: string; bancoId?: string; ultimosDigitos?: string; limite?: string; diaFechamento?: string; diaVencimento?: string }


type Notification = { open: boolean; message: string; severity: "success" | "error" | "warning" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

export default function CreditCardsPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [bancos, setBancos] = useState<Banco[]>([])
  const [recorrentes, setRecorrentes] = useState<Recorrente[]>([])

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

  const loadData = useCallback(async () => {
    try {
      const [cs, conts, bs, recs] = await Promise.all([getCartoes(), getContas(), getBancos(), getRecorrentes().catch(() => [])])
      setCartoes(cs)
      setContas(conts.filter((c) => !c.isCarteira))
      setBancos(bs)
      setRecorrentes(recs)
    } catch {
      notify({ open: true, message: "Erro ao carregar cartões", severity: "error" })
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
  const openFaturas = async (cartaoId: string) => {
    if (faturasCartaoId === cartaoId) { setFaturasCartaoId(null); return }
    setFaturasCartaoId(cartaoId)
    setFaturaIdx(0)
    justOpenedRef.current = true
    setLoadingFaturas(true)
    try { await refreshFaturas(cartaoId) }
    finally { setLoadingFaturas(false) }
  }

  // Com um único cartão de crédito, já abre direto no modo foco (uma vez).
  const didAutoOpenRef = useRef(false)
  useEffect(() => {
    if (didAutoOpenRef.current || faturasCartaoId) return
    const credito = cartoes.filter((c) => c.temCredito)
    if (cartoes.length === 1 && credito.length === 1) {
      didAutoOpenRef.current = true
      void openFaturas(credito[0].id)
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
  const temCredito = form.modo === "credito" || form.modo === "credito_debito"
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
    const sel = Math.max(0, Math.min(faturaIdx, ultimoIdx))
    return [sel - 1, sel, sel + 1]
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

  const renderDetalhe = (f: FaturaView) => {
    // Mês sem fatura (nenhum lançamento caiu nele). Sem fatura nenhuma no cartão, orienta o 1º uso.
    if (f.vazia) {
      if (faturas.length === 0) {
        return (
          <div className={styles.faturaEmpty}>
            <PontesEmptyState
              icon={<ReceiptText size={26} />}
              title="Nenhuma fatura ainda"
              description="Registre uma compra no crédito pra criar a primeira fatura."
            />
          </div>
        )
      }
      return <div className={styles.detailMuted}>Sem lançamentos neste mês.</div>
    }
    // Fatura prevista: lançamentos vêm das assinaturas projetadas (sem ir ao backend).
    if (f.prevista) {
      const proj = f.projLancamentos ?? []
      if (proj.length === 0) return <div className={styles.detailMuted}>Sem assinaturas previstas.</div>
      return (
        <div className={styles.txList}>
          {proj.map((l) => (
            <div key={l.id} className={styles.txRow}>
              <div className={styles.txMain}>
                <span className={styles.txDesc}>{l.descricao}</span>
                <span className={styles.txMeta}>{new Date(l.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · assinatura</span>
              </div>
              <span className={styles.txValor}>{formatMoney(l.valor)}</span>
            </div>
          ))}
        </div>
      )
    }
    const detalhe = faturaDetalhes[f.id]
    if (!detalhe) return <div className={styles.detailMuted}>Carregando…</div>
    const pagamentos = detalhe.pagamentos ?? []
    if (detalhe.transacoes.length === 0 && pagamentos.length === 0)
      return <div className={styles.detailMuted}>Nenhuma transação nesta fatura.</div>

    // Linha do tempo única: compras + pagamentos ordenados por data (cronológico).
    type Linha =
      | { kind: "compra"; id: string; ts: number; t: FaturaDetalhe["transacoes"][number] }
      | { kind: "pagamento"; id: string; ts: number; p: FaturaPagamento }
    // Ordena por data + hora (criadoEm carrega o horário do lançamento).
    const linhas: Linha[] = [
      ...detalhe.transacoes.map((t) => ({ kind: "compra" as const, id: t.id, ts: new Date(t.criadoEm).getTime(), t })),
      ...pagamentos.map((p) => ({ kind: "pagamento" as const, id: p.id, ts: new Date(p.criadoEm).getTime(), p })),
    ].sort((a, b) => a.ts - b.ts)

    return (
      <>
      <div className={styles.txList}>
        {linhas.map((l) => l.kind === "compra" ? (
          <div key={l.id} className={styles.txRow}>
            <div className={styles.txMain}>
              <span className={styles.txDesc}>{l.t.descricao}</span>
              <span className={styles.txMeta}>
                {new Date(l.t.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · {new Date(l.t.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                {l.t.categoriaDescricao ? ` · ${l.t.categoriaDescricao}` : ""}
              </span>
            </div>
            {/* Sem "pago" por compra: pagar a fatura só abate o total dela, não quita uma compra
                específica (é assim no banco). O quanto já foi pago fica no resumo da fatura. */}
            <span className={styles.txValor}>{formatMoney(l.t.valor)}</span>
          </div>
        ) : (
          <div key={l.id} className={styles.txRow} data-pagamento="true">
            <div className={styles.txMain}>
              <span className={styles.txDesc}><Check size={13} strokeWidth={2.5} /> Pagamento · {l.p.meioPagamentoDescricao}</span>
              <span className={styles.txMeta}>
                {new Date(l.p.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · {new Date(l.p.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <span className={styles.payValor}>− {formatMoney(l.p.valor)}</span>
          </div>
        ))}
      </div>
      {f.valorPago > 0 && (
        <div className={styles.paidNote}>
          <span className={styles.paidNoteLabel}>Total pago</span>
          <span className={styles.paidNoteValue}>
            {formatMoney(f.valorPago)}
            {f.valorRestante > 0 && <span className={styles.paidNoteRest}> · falta {formatMoney(f.valorRestante)}</span>}
          </span>
        </div>
      )}
      </>
    )
  }

  const renderCartao = (c: CartaoCredito) => {
    const pct = c.limite ? Math.min((c.gastosNoCicloAtual / c.limite) * 100, 100) : 0
    const over = pct > 80
    const sel = faturasCartaoId === c.id
    const clickable = c.temCredito
    return (
      <div
        key={c.id}
        className={styles.cardTile}
        data-selected={sel ? "true" : undefined}
        data-clickable={clickable ? "true" : undefined}
        onClick={clickable ? () => openFaturas(c.id) : undefined}
      >
        {/* Cartão físico — gradiente do banco se tem cor, senão bandeira */}
        <div className={styles.card} style={{ background: cardGradient(c.bancoCor, c.bandeira) }}>
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
            </div>
            <div className={styles.chipRow}>
              <div className={styles.cardChip} />
              <Wifi size={18} className={styles.contactless} />
            </div>
            <div className={styles.faceBottom}>
              <span className={styles.cardNumber}>•••• {c.ultimosDigitos ?? "••••"}</span>
              <div className={styles.bandeiraSlot}>
                <BandeiraMark bandeira={c.bandeira} />
              </div>
            </div>
          </div>
        </div>

        {/* Bloco de info — separado do cartão (fundo neutro) */}
        {c.temCredito && c.limite ? (
          <div className={styles.cardMeta}>
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
              {(() => {
                const dF = diasAteProxDia(c.diaFechamento, now)
                const dV = diasAteProxDia(c.diaVencimento, now)
                // Próximos 5 dias = destaque. Vencimento prioridade sobre fechamento.
                const urgenteV = dV != null && dV <= 5
                const urgenteF = dF != null && dF <= 5
                if (urgenteV) {
                  return <span className={styles.urgentDate} data-tone="danger">vence {dV === 0 ? "hoje" : dV === 1 ? "amanhã" : `em ${dV} dias`}</span>
                }
                if (urgenteF) {
                  return <span className={styles.urgentDate} data-tone="warning">fecha {dF === 0 ? "hoje" : dF === 1 ? "amanhã" : `em ${dF} dias`}</span>
                }
                if (c.diaFechamento || c.diaVencimento) {
                  return <span>{c.diaFechamento ? `fecha dia ${c.diaFechamento}` : ""}{c.diaVencimento ? ` · vence dia ${c.diaVencimento}` : ""}</span>
                }
                return <span>{formatMoney(c.gastosNoCicloAtual)} usado</span>
              })()}
              <span className={styles.verFaturas}><ReceiptText size={12} /> {sel ? "Em foco" : "Faturas"}</span>
            </div>
          </div>
        ) : (c.contaNome || c.temDebito || c.ehPrePago) ? (
          <div className={styles.cardMeta}>
            <div className={styles.cardMetaRow}>
              <span>{c.contaNome ? "Conta que paga" : " "}</span>
              {c.contaNome && <span className={styles.cardFootValue}>{c.contaNome}</span>}
            </div>
          </div>
        ) : null}
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
        />
      ) : faturasCartaoId && cartaoAtivo ? (
        // Modo foco: só o cartão selecionado, com a fatura logo abaixo.
        <>
          <button type="button" className={styles.backCards} onClick={() => setFaturasCartaoId(null)}>
            <ChevronLeft size={16} /> Todos os cartões
          </button>
          <div className={styles.focusCard}>{renderCartao(cartaoAtivo)}</div>
        </>
      ) : (
        <div className={styles.cardsGrid}>
          {cartoes.map(renderCartao)}
        </div>
      )}

      {/* Painel de faturas */}
      {faturasCartaoId && cartaoAtivo && (
        <PontesCard padding={0} radius={16}>
          {loadingFaturas || ciclos.length === 0 ? (
            <div className={styles.faturaSkeleton}><PontesSkeletonList rows={4} /></div>
          ) : (() => {
            const idx = Math.max(0, Math.min(faturaIdx, ultimoIdx))
            const f = ciclos[idx]
            const ehPrevista = !!f.prevista
            const ehVazia = !!f.vazia
            const st = STATUS[statusKey(f, now)]
            const open = f.valorRestante > 0
            const ehAtual = idx === atualIdx
            // Ciclo ainda não começou (dataInicio > hoje) — fatura "Futura".
            // Bancos reais não permitem pagar fatura futura inteira; bloqueia botão.
            const ehFutura = !ehPrevista && !ehVazia && new Date(f.dataInicio).getTime() > now
            return (
              <div className={styles.faturaBody}>
                {/* Navegação por mês: ‹ anterior | (Hoje?) | mês | (Hoje?) | próximo › */}
                <div className={styles.monthNav}>
                  <button type="button" className={styles.monthArrow} aria-label="Mês anterior"
                    disabled={idx >= ultimoIdx} onClick={() => irParaFatura(idx + 1)}>
                    <ChevronLeft size={18} />
                  </button>
                  {idx < atualIdx && (
                    <PontesButton size="md" variant="outline" iconStart={<ChevronLeft size={16} strokeWidth={2.5} />}
                      onClick={() => irParaFatura(atualIdx)}>Hoje</PontesButton>
                  )}
                  <div className={styles.monthLabel}>
                    <span className={styles.monthName}>{mesLabel(f.dataFechamento)}{ehAtual ? " · atual" : ehPrevista ? " · prevista" : ""}</span>
                    <span className={styles.monthRange}>{formatDate(f.dataInicio)} – {formatDate(f.dataFechamento)}</span>
                  </div>
                  {idx > atualIdx && (
                    <PontesButton size="md" variant="outline" iconEnd={<ChevronRight size={16} strokeWidth={2.5} />}
                      onClick={() => irParaFatura(atualIdx)}>Hoje</PontesButton>
                  )}
                  <button type="button" className={styles.monthArrow} aria-label="Próximo mês"
                    disabled={idx <= 0} onClick={() => irParaFatura(idx - 1)}>
                    <ChevronRight size={18} />
                  </button>
                </div>

                {/* Fatura do mês selecionado */}
                <div className={styles.atual} data-open={open ? "true" : undefined}>
                  <div className={styles.atualTop}>
                    <div>
                      <div className={styles.atualValor}>{formatMoney(open ? f.valorRestante : f.valorTotal)}</div>
                      <div className={styles.atualMeta}>
                        {!ehVazia && (ehPrevista
                          ? <PontesBadge tone="neutral" size="sm">Prevista</PontesBadge>
                          : <PontesBadge tone={st.tone} size="sm">{st.label}</PontesBadge>)}
                        {!ehPrevista && !ehVazia && f.vencida && <PontesBadge tone="danger" size="sm">Vencida</PontesBadge>}
                        {!ehVazia && (
                          <span className={styles.muted}>
                            {f.vencida ? "Venceu " : "Vence "}{formatDate(f.dataVencimento)}
                          </span>
                        )}
                        {f.valorPago > 0 && open && <span className={styles.muted}>Pago {formatMoney(f.valorPago)} de {formatMoney(f.valorTotal)}</span>}
                      </div>
                    </div>
                    {open && !ehPrevista && !ehFutura && (
                      <PontesButton size="sm" iconStart={<Banknote size={16} strokeWidth={2.5} />}
                        onClick={() => openPagar(f.id, faturasCartaoId, f.valorRestante, cartaoAtivo.contaId)}>
                        Pagar
                      </PontesButton>
                    )}
                  </div>
                  {!ehPrevista && f.valorPago > 0 && open && (
                    <div className={styles.paidBar} title={`Pago ${formatMoney(f.valorPago)} de ${formatMoney(f.valorTotal)}`}>
                      <div className={styles.paidFill} style={{ width: `${Math.min(100, (f.valorPago / f.valorTotal) * 100)}%` }} />
                    </div>
                  )}
                  {renderDetalhe(f)}
                </div>
              </div>
            )
          })()}
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
          <PontesField label="Bandeira">
            <div className={styles.bandeiraGrid}>
              {BANDEIRA_OPTIONS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  className={styles.bandeiraChip}
                  data-selected={form.bandeira === b.value ? "true" : undefined}
                  onClick={() => setF("bandeira", b.value)}
                  aria-label={b.label}
                  title={b.label}
                >
                  <BandeiraMark bandeira={b.value} width={40} genericColor="var(--pontes-text-muted)" />
                </button>
              ))}
            </div>
          </PontesField>
          <PontesField label="Últimos 4 dígitos" error={formErrors.ultimosDigitos}>
            <PontesInput
              value={form.ultimosDigitos ?? ""}
              onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setF("ultimosDigitos", d || undefined); clearErr("ultimosDigitos") }}
              invalid={!!formErrors.ultimosDigitos}
              inputMode="numeric" maxLength={4} placeholder="0000"
            />
          </PontesField>
          <PontesField label="Banco emissor" required error={formErrors.bancoId}>
            <PontesSelect value={form.bancoId ?? ""} onChange={(v) => { setF("bancoId", v || undefined); clearErr("bancoId") }} invalid={!!formErrors.bancoId} placeholder="Quem emitiu o cartão" options={bancos.map((b) => ({ value: b.id, label: b.nome }))} />
          </PontesField>
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
                <PontesInput
                  type="number"
                  value={form.diaFechamento != null ? String(form.diaFechamento) : ""}
                  onChange={(e) => { setF("diaFechamento", clampDia(e.target.value)); clearErr("diaFechamento") }}
                  invalid={!!formErrors.diaFechamento}
                  min={1} max={31} step={1} inputMode="numeric" placeholder="1 a 31"
                />
              </PontesField>
              <PontesField label="Dia vencimento" required error={formErrors.diaVencimento}>
                <PontesInput
                  type="number"
                  value={form.diaVencimento != null ? String(form.diaVencimento) : ""}
                  onChange={(e) => { setF("diaVencimento", clampDia(e.target.value)); clearErr("diaVencimento") }}
                  invalid={!!formErrors.diaVencimento}
                  min={1} max={31} step={1} inputMode="numeric" placeholder="1 a 31"
                />
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
            <PontesInput
              iconStart="R$"
              value={fmtMoneyInput(pagarForm.valor ? Number(pagarForm.valor) : undefined)}
              onChange={(e) => {
                const v = parseMoney(e.target.value)
                setPagarForm((f) => ({ ...f, valor: v != null ? String(v) : "" }))
                setPagarErrors((p) => ({ ...p, valor: undefined }))
              }}
              invalid={!!pagarErrors.valor}
              inputMode="decimal"
              placeholder="0,00"
            />
          </PontesField>
          <div className={styles.grid2}>
            <PontesField label="Data do pagamento" required>
              <PontesDateInput value={pagarForm.dataPagamento} onChange={(v) => setPagarForm((f) => ({ ...f, dataPagamento: v }))} />
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
        description="O cartão sai da lista e as compras vinculadas somem do extrato, mas os pagamentos de fatura ficam preservados no histórico da conta."
        confirmLabel="Remover"
        onConfirm={handleDelete}
        onCancel={() => setDelId(null)}
      />
    </div>
  )
}
