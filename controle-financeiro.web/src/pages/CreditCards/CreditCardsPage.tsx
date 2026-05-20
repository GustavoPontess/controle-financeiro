import React, { useEffect, useState } from "react"
import {
  Box, Typography, Paper, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem as MuiMenuItem,
  FormControl, InputLabel, LinearProgress, Table, TableHead, TableBody,
  TableRow, TableCell, Divider, Collapse,
} from "@mui/material"
import { useOutletContext } from "react-router-dom"
import AddRoundedIcon from "@mui/icons-material/AddRounded"
import EditIcon from "@mui/icons-material/Edit"
import DeleteIcon from "@mui/icons-material/Delete"
import CreditCardIcon from "@mui/icons-material/CreditCard"
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined"
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined"
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined"
import CloseIcon from "@mui/icons-material/Close"
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight"
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown"
import CustomButton from "../../components/CustomButton"
import EmptyState from "../../components/EmptyState/EmptyState"
import { getCartoes, createCartao, updateCartao, deleteCartao } from "../../services/cartaoCreditoService"
import { getContas } from "../../services/contaService"
import { getBancos } from "../../services/bancoService"
import { getFaturasByCartao, getFaturaDetalhe, pagarFatura } from "../../services/faturaService"
import type { CartaoCredito, CriarCartaoCredito } from "../../types/CartaoCredito"
import type { Conta } from "../../types/Conta"
import type { Banco } from "../../types/Banco"
import type { Fatura, FaturaDetalhe, PagarFaturaPayload } from "../../types/Fatura"
import { tokens } from "../../theme/tokens"

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString("pt-BR")

const BANDEIRAS = [
  { value: 1, label: "Visa" },
  { value: 2, label: "Mastercard" },
  { value: 3, label: "Elo" },
  { value: 4, label: "Hipercard" },
  { value: 5, label: "American Express" },
  { value: 6, label: "Outros" },
]

const MEIOS_PAGAMENTO = [
  { value: 4, label: "Pix" },
  { value: 2, label: "Débito" },
  { value: 1, label: "Dinheiro" },
  { value: 5, label: "TED / DOC" },
  { value: 6, label: "Boleto" },
]

type Modo = "credito_debito" | "credito" | "debito" | "prepago"

const MODOS: { value: Modo; label: string }[] = [
  { value: "credito_debito", label: "Crédito e Débito" },
  { value: "credito",        label: "Somente Crédito" },
  { value: "debito",         label: "Somente Débito" },
  { value: "prepago",        label: "Pré-Pago" },
]

const modoParaBooleans = (modo: Modo): Pick<CriarCartaoCredito, "temCredito" | "temDebito" | "ehPrePago"> => ({
  temCredito: modo === "credito" || modo === "credito_debito",
  temDebito:  modo === "debito"  || modo === "credito_debito",
  ehPrePago:  modo === "prepago",
})

const booleansParaModo = (c: CartaoCredito): Modo => {
  if (c.ehPrePago) return "prepago"
  if (c.temCredito && c.temDebito) return "credito_debito"
  if (c.temCredito) return "credito"
  return "debito"
}

const BANDEIRA_GRAD: Record<number, string> = {
  1: "linear-gradient(135deg, #1e40af, #3b82f6)",       // Visa — azul
  2: "linear-gradient(135deg, #7c2d12, #dc2626)",        // Mastercard — vermelho escuro
  3: "linear-gradient(135deg, #0f766e, #14b8a6)",        // Elo — teal
  4: "linear-gradient(135deg, #9f1239, #e11d48)",        // Hipercard — carmim
  5: "linear-gradient(135deg, #14532d, #16a34a)",        // Amex — verde
  6: "linear-gradient(135deg, #374151, #6b7280)",        // Outros — cinza
}

const STATUS_STYLE: Record<number, { bg: string; color: string; label: string }> = {
  1: { bg: tokens.color.status.info.light,    color: tokens.color.status.info.dark,    label: "Aberta"  },
  2: { bg: tokens.color.status.warning.light, color: tokens.color.status.warning.dark, label: "Fechada" },
  3: { bg: tokens.color.status.success.light, color: tokens.color.status.success.dark, label: "Paga"    },
}

type FormState = Omit<CriarCartaoCredito, "temCredito" | "temDebito" | "ehPrePago"> & { modo: Modo }

const emptyForm: FormState = {
  nome: "", ultimosDigitos: undefined, bandeira: 6, modo: "credito_debito",
  limite: undefined, diaFechamento: undefined, diaVencimento: undefined,
  contaId: undefined, bancoId: undefined,
}

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: tokens.radius.md,
    fontSize: tokens.typography.fontSize.sm,
    "& fieldset": { borderColor: tokens.color.border.default },
    "&:hover fieldset": { borderColor: tokens.color.border.strong },
    "&.Mui-focused fieldset": { borderColor: tokens.color.brand.primary },
  },
}

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
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState("")

  const [faturasCartaoId, setFaturasCartaoId] = useState<string | null>(null)
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [loadingFaturas, setLoadingFaturas] = useState(false)
  const [expandedFaturaId, setExpandedFaturaId] = useState<string | null>(null)
  const [faturaDetalhes, setFaturaDetalhes] = useState<Record<string, FaturaDetalhe>>({})

  const [pagarFaturaId, setPagarFaturaId] = useState<string | null>(null)
  const [pagarCartaoId, setPagarCartaoId] = useState<string | null>(null)
  const [pagarForm, setPagarForm] = useState({
    contaId: "", valor: "",
    dataPagamento: new Date().toISOString().split("T")[0],
    meioPagamento: 4,
  })
  const [pagarLoading, setPagarLoading] = useState(false)

  const loadData = async () => {
    try {
      const [cs, conts, bs] = await Promise.all([getCartoes(), getContas(), getBancos()])
      setCartoes(cs)
      setContas(conts.filter(c => !c.isCarteira))
      setBancos(bs)
    } catch {
      notify({ open: true, message: "Erro ao carregar cartões", severity: "error" })
    }
  }

  useEffect(() => { loadData() }, [])

  const openFaturas = async (cartaoId: string) => {
    if (faturasCartaoId === cartaoId) { setFaturasCartaoId(null); return }
    setFaturasCartaoId(cartaoId)
    setLoadingFaturas(true)
    try {
      setFaturas(await getFaturasByCartao(cartaoId))
    } finally { setLoadingFaturas(false) }
  }

  const toggleFatura = async (faturaId: string, cartaoId: string) => {
    if (expandedFaturaId === faturaId) { setExpandedFaturaId(null); return }
    setExpandedFaturaId(faturaId)
    if (!faturaDetalhes[faturaId]) {
      try {
        const detalhe = await getFaturaDetalhe(cartaoId, faturaId)
        setFaturaDetalhes(prev => ({ ...prev, [faturaId]: detalhe }))
      } catch {
        notify({ open: true, message: "Erro ao carregar transações da fatura", severity: "error" })
      }
    }
  }

  const openPagar = (faturaId: string, cartaoId: string, valorRestante: number, contaId?: string) => {
    setPagarFaturaId(faturaId)
    setPagarCartaoId(cartaoId)
    setPagarForm({
      contaId: contaId ?? "", valor: String(valorRestante.toFixed(2)),
      dataPagamento: new Date().toISOString().split("T")[0], meioPagamento: 4,
    })
  }

  const handlePagar = async () => {
    if (!pagarFaturaId || !pagarCartaoId) return
    if (!pagarForm.contaId || !pagarForm.valor) {
      notify({ open: true, message: "Informe a conta e o valor", severity: "error" }); return
    }
    setPagarLoading(true)
    try {
      const payload: PagarFaturaPayload = {
        contaId: pagarForm.contaId, valor: Number(pagarForm.valor),
        dataPagamento: pagarForm.dataPagamento, meioPagamento: pagarForm.meioPagamento,
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

  const openCreate = () => { setForm(emptyForm); setErro(""); setEditingId(null); setDialogOpen(true) }
  const openEdit = (c: CartaoCredito) => {
    setForm({
      nome: c.nome, ultimosDigitos: c.ultimosDigitos, bandeira: c.bandeira,
      modo: booleansParaModo(c), limite: c.limite, diaFechamento: c.diaFechamento,
      diaVencimento: c.diaVencimento, contaId: c.contaId, bancoId: c.bancoId,
    })
    setErro(""); setEditingId(c.id); setDialogOpen(true)
  }

  const handleSalvar = async () => {
    setErro("")
    if (!form.nome) { setErro("Informe o nome do cartão."); return }
    if (form.modo !== "prepago" && !form.contaId) { setErro("Selecione a conta vinculada."); return }
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
    } catch { setErro("Erro ao salvar cartão.") }
    finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este cartão? Todas as transações e faturas vinculadas também serão excluídas.")) return
    try {
      await deleteCartao(id)
      notify({ open: true, message: "Cartão removido", severity: "success" })
      if (faturasCartaoId === id) setFaturasCartaoId(null)
      await loadData()
    } catch (e) {
      const msg = (e as { response?: { data?: { mensagem?: string } } }).response?.data?.mensagem ?? "Erro ao remover cartão"
      notify({ open: true, message: msg, severity: "error" })
    }
  }

  const totalLimite = cartoes.filter(c => c.temCredito && c.limite).reduce((s, c) => s + (c.limite ?? 0), 0)
  const totalGastos = cartoes.filter(c => c.temCredito).reduce((s, c) => s + c.gastosNoCicloAtual, 0)
  const isPrePago = form.modo === "prepago"
  const temCredito = form.modo === "credito" || form.modo === "credito_debito"
  const cartaoAtivo = cartoes.find(c => c.id === faturasCartaoId)

  const headerSx = {
    fontSize: tokens.typography.fontSize["2xs"],
    fontWeight: tokens.typography.fontWeight.medium,
    color: "text.secondary",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    bgcolor: tokens.color.background.secondary,
    borderBottom: "1px solid",
    borderColor: "divider",
    py: 1.5,
  }
  const cellSx = {
    fontSize: tokens.typography.fontSize.sm,
    color: "text.primary",
    py: 1.75,
    borderBottom: "1px solid",
    borderColor: "divider",
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography fontSize={22} fontWeight={700} color="text.primary">Cartões</Typography>
          <Typography fontSize={13} color="text.secondary">Gerencie seus cartões e acompanhe faturas</Typography>
        </Box>
        <CustomButton size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />} onClick={openCreate}>
          Novo Cartão
        </CustomButton>
      </Box>

      {/* Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        {[
          {
            label: "Total de Cartões",
            value: String(cartoes.length),
            sub: cartoes.length === 1 ? "cartão cadastrado" : "cartões cadastrados",
            grad: `linear-gradient(135deg, ${tokens.color.brand.primary}, ${tokens.color.brand.hover})`,
            icon: <CreditCardOutlinedIcon sx={{ fontSize: 18 }} />,
          },
          {
            label: "Limite Total",
            value: formatMoney(totalLimite),
            sub: "cartões com crédito",
            grad: "linear-gradient(135deg, #6366f1, #4f46e5)",
            icon: <CreditCardIcon sx={{ fontSize: 18 }} />,
          },
          {
            label: "Gastos no Ciclo",
            value: formatMoney(totalGastos),
            sub: "ciclo atual",
            grad: `linear-gradient(135deg, ${tokens.color.status.error.main}, ${tokens.color.status.error.dark})`,
            icon: <ReceiptLongOutlinedIcon sx={{ fontSize: 18 }} />,
          },
        ].map(s => (
          <Paper key={s.label} elevation={0} sx={{ p: 2.5, border: "1px solid", borderColor: "divider", borderRadius: tokens.radius.lg }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
              <Typography fontSize={12} fontWeight={tokens.typography.fontWeight.medium} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {s.label}
              </Typography>
              <Box sx={{ width: 32, height: 32, borderRadius: tokens.radius.md, background: s.grad, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
                {s.icon}
              </Box>
            </Box>
            <Typography fontSize={22} fontWeight={800} color="text.primary" lineHeight={1.2}>
              {s.value}
            </Typography>
            <Typography fontSize={11} color="text.secondary" mt={0.5}>{s.sub}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Cards grid */}
      {cartoes.length === 0 ? (
        <EmptyState
          title="Nenhum cartão cadastrado"
          description="Adicione seus cartões de crédito, débito ou pré-pagos."
          actionLabel="Novo Cartão"
          onAction={openCreate}
        />
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 2 }}>
          {cartoes.map(c => {
            const grad = BANDEIRA_GRAD[c.bandeira] ?? BANDEIRA_GRAD[6]
            const pct = c.limite ? Math.min((c.gastosNoCicloAtual / c.limite) * 100, 100) : 0
            const isSelected = faturasCartaoId === c.id

            return (
              <Paper key={c.id} elevation={0} sx={{
                border: "1.5px solid",
                borderColor: isSelected ? tokens.color.brand.primary : "divider",
                borderRadius: tokens.radius.xl,
                overflow: "hidden",
                transition: tokens.transition.fast,
                boxShadow: isSelected ? `0 0 0 3px ${tokens.color.brand.subtle}` : tokens.shadow.card,
              }}>
                {/* Visual do cartão físico */}
                <Box sx={{
                  background: grad,
                  px: 3,
                  pt: 2.5,
                  pb: 2,
                  position: "relative",
                  overflow: "hidden",
                  minHeight: 110,
                }}>
                  {/* Círculos decorativos de fundo */}
                  <Box sx={{
                    position: "absolute", right: -24, top: -24,
                    width: 120, height: 120, borderRadius: "50%",
                    background: "rgba(255,255,255,0.08)",
                  }} />
                  <Box sx={{
                    position: "absolute", right: 20, bottom: -32,
                    width: 90, height: 90, borderRadius: "50%",
                    background: "rgba(255,255,255,0.06)",
                  }} />

                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                    <Typography fontSize={tokens.typography.fontSize.base} fontWeight={tokens.typography.fontWeight.bold} color="#fff" sx={{ textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
                      {c.nome}
                    </Typography>
                    {/* Chip do cartão */}
                    <Box sx={{
                      width: 28, height: 22, borderRadius: tokens.radius.xs,
                      background: "linear-gradient(135deg, #fde68a, #f59e0b)",
                      flexShrink: 0,
                      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)",
                    }} />
                  </Box>

                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <Typography fontSize={tokens.typography.fontSize.sm} color="rgba(255,255,255,0.85)" letterSpacing="0.15em" fontFamily={tokens.typography.fontFamily.mono}>
                      {c.ultimosDigitos ? `•••• •••• •••• ${c.ultimosDigitos}` : "•••• •••• •••• ••••"}
                    </Typography>
                    <Typography fontSize={tokens.typography.fontSize.xs} color="rgba(255,255,255,0.7)" fontWeight={tokens.typography.fontWeight.medium}>
                      {c.bandeiraDescricao}
                    </Typography>
                  </Box>
                </Box>

                {/* Info + ações */}
                <Box sx={{ px: 3, py: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {/* Tipo chips */}
                  <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                      {c.temCredito && (
                        <Chip label="Crédito" size="small" sx={{ fontSize: 11, height: 20, borderRadius: tokens.radius.sm, bgcolor: tokens.color.status.info.light, color: tokens.color.status.info.dark, fontWeight: tokens.typography.fontWeight.medium }} />
                      )}
                      {c.temDebito && (
                        <Chip label="Débito" size="small" sx={{ fontSize: 11, height: 20, borderRadius: tokens.radius.sm, bgcolor: tokens.color.status.success.light, color: tokens.color.status.success.dark, fontWeight: tokens.typography.fontWeight.medium }} />
                      )}
                      {c.ehPrePago && (
                        <Chip label="Pré-Pago" size="small" sx={{ fontSize: 11, height: 20, borderRadius: tokens.radius.sm, bgcolor: tokens.color.background.tertiary, color: "text.secondary", fontWeight: tokens.typography.fontWeight.medium }} />
                      )}
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.25 }}>
                      {c.temCredito && (
                        <IconButton size="small" onClick={() => openFaturas(c.id)} title="Ver faturas"
                          sx={{ p: 0.75, color: isSelected ? tokens.color.brand.primary : "text.secondary", bgcolor: isSelected ? tokens.color.brand.subtle : "transparent", borderRadius: tokens.radius.sm, "&:hover": { color: tokens.color.brand.primary, bgcolor: tokens.color.brand.subtle } }}>
                          <ReceiptLongOutlinedIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      )}
                      <IconButton size="small" onClick={() => openEdit(c)}
                        sx={{ p: 0.75, color: "text.secondary", borderRadius: tokens.radius.sm, "&:hover": { color: "text.primary", bgcolor: tokens.color.background.secondary } }}>
                        <EditIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(c.id)}
                        sx={{ p: 0.75, color: "text.secondary", borderRadius: tokens.radius.sm, "&:hover": { color: tokens.color.status.error.main, bgcolor: tokens.color.status.error.light } }}>
                        <DeleteIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  {c.contaNome && (
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography fontSize={12} color="text.secondary">Conta vinculada</Typography>
                      <Typography fontSize={12} fontWeight={tokens.typography.fontWeight.medium} color="text.primary">{c.contaNome}</Typography>
                    </Box>
                  )}

                  {(c.diaFechamento || c.diaVencimento) && (
                    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                      {c.diaFechamento && (
                        <Chip label={`Fecha dia ${c.diaFechamento}`} size="small" sx={{ fontSize: 11, height: 20, borderRadius: tokens.radius.sm, bgcolor: tokens.color.background.tertiary, color: "text.secondary" }} />
                      )}
                      {c.diaVencimento && (
                        <Chip label={`Vence dia ${c.diaVencimento}`} size="small" sx={{ fontSize: 11, height: 20, borderRadius: tokens.radius.sm, bgcolor: tokens.color.status.warning.light, color: tokens.color.status.warning.dark }} />
                      )}
                    </Box>
                  )}

                  {c.temCredito && c.limite && (
                    <Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
                        <Typography fontSize={12} color="text.secondary">Utilizado</Typography>
                        <Typography fontSize={12} fontWeight={tokens.typography.fontWeight.bold} color={pct > 80 ? tokens.color.status.error.main : "text.primary"}>
                          {formatMoney(c.gastosNoCicloAtual)}
                          <Typography component="span" fontSize={11} fontWeight={400} color="text.secondary"> / {formatMoney(c.limite)}</Typography>
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={pct} sx={{
                        height: 6, borderRadius: tokens.radius.pill,
                        bgcolor: tokens.color.status.success.light,
                        "& .MuiLinearProgress-bar": { bgcolor: tokens.color.status.error.main, borderRadius: tokens.radius.pill },
                      }} />
                      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                        <Typography fontSize={11} color="text.secondary">Disponível</Typography>
                        <Typography fontSize={11} fontWeight={tokens.typography.fontWeight.medium} color={tokens.color.status.success.dark}>
                          {formatMoney(c.limiteDisponivel ?? 0)}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Paper>
            )
          })}
        </Box>
      )}

      {/* Painel de Faturas */}
      {faturasCartaoId && cartaoAtivo && (
        <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: tokens.radius.lg, overflow: "hidden" }}>
          <Box sx={{ px: 3, py: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: tokens.radius.md, background: BANDEIRA_GRAD[cartaoAtivo.bandeira] ?? BANDEIRA_GRAD[6], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
              <ReceiptLongOutlinedIcon sx={{ fontSize: 17 }} />
            </Box>
            <Box>
              <Typography fontSize={15} fontWeight={tokens.typography.fontWeight.bold} color="text.primary">
                Faturas — {cartaoAtivo.nome}
              </Typography>
              <Typography fontSize={12} color="text.secondary">Histórico de faturas</Typography>
            </Box>
          </Box>
          <Divider />

          {loadingFaturas ? (
            <LinearProgress />
          ) : faturas.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <Typography fontSize={13} color="text.secondary">
                Nenhuma fatura encontrada. Registre uma transação de crédito para criar a primeira fatura.
              </Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...headerSx, width: 32 }} />
                  <TableCell sx={headerSx}>Período</TableCell>
                  <TableCell sx={headerSx}>Vencimento</TableCell>
                  <TableCell sx={headerSx}>Status</TableCell>
                  <TableCell sx={{ ...headerSx, textAlign: "right" }}>Total</TableCell>
                  <TableCell sx={{ ...headerSx, textAlign: "right" }}>Pago</TableCell>
                  <TableCell sx={{ ...headerSx, textAlign: "right" }}>Restante</TableCell>
                  <TableCell sx={{ ...headerSx, textAlign: "center", width: 80 }}>Ação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {faturas.map(f => {
                  const isPaga = f.estadoPagamento === 2
                  const isFechada = f.estadoCiclo === 1
                  const statusKey = isPaga ? 3 : isFechada ? 2 : 1
                  const sc = STATUS_STYLE[statusKey]
                  const isExpanded = expandedFaturaId === f.id
                  const detalhe = faturaDetalhes[f.id]
                  const paidTransacaoIds = (() => {
                    const ids = new Set<string>()
                    if (!detalhe?.transacoes?.length) return ids
                    const sorted = [...detalhe.transacoes].sort(
                      (a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()
                    )
                    let cumulative = 0
                    for (const t of sorted) {
                      cumulative += t.valor
                      if (f.valorPago >= cumulative) ids.add(t.id)
                    }
                    return ids
                  })()
                  return (
                    <React.Fragment key={f.id}>
                      <TableRow
                        onClick={() => toggleFatura(f.id, faturasCartaoId!)}
                        sx={{ cursor: "pointer", "&:hover": { bgcolor: tokens.color.background.hover }, bgcolor: isExpanded ? tokens.color.background.secondary : undefined }}
                      >
                        <TableCell sx={{ ...cellSx, pr: 0 }}>
                          <IconButton size="small" sx={{ p: 0.25, color: "text.secondary" }}>
                            {isExpanded
                              ? <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                              : <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />}
                          </IconButton>
                        </TableCell>
                        <TableCell sx={cellSx}>
                          <Typography fontSize={12} color="text.primary">
                            {formatDate(f.dataInicio)} – {formatDate(f.dataFechamento)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={cellSx}>
                          <Typography fontSize={12} color={f.vencida ? tokens.color.status.error.main : "text.primary"} fontWeight={f.vencida ? 600 : 400}>
                            {formatDate(f.dataVencimento)}
                          </Typography>
                          {f.vencida && (
                            <Typography fontSize={10} color={tokens.color.status.error.main} fontWeight={600}>Vencida</Typography>
                          )}
                        </TableCell>
                        <TableCell sx={cellSx}>
                          <Chip label={sc.label} size="small" sx={{ fontSize: 11, height: 20, borderRadius: tokens.radius.sm, bgcolor: sc.bg, color: sc.color, fontWeight: tokens.typography.fontWeight.medium }} />
                        </TableCell>
                        <TableCell sx={{ ...cellSx, textAlign: "right", fontWeight: 600 }}>
                          {formatMoney(f.valorTotal)}
                        </TableCell>
                        <TableCell sx={{ ...cellSx, textAlign: "right", color: tokens.color.status.success.main, fontWeight: tokens.typography.fontWeight.medium }}>
                          {formatMoney(f.valorPago)}
                        </TableCell>
                        <TableCell sx={{ ...cellSx, textAlign: "right", fontWeight: 700, color: f.valorRestante > 0 ? tokens.color.status.error.main : tokens.color.status.success.main }}>
                          {formatMoney(f.valorRestante)}
                        </TableCell>
                        <TableCell sx={{ ...cellSx, textAlign: "center" }} onClick={e => e.stopPropagation()}>
                          {f.valorRestante > 0 && (
                            <IconButton size="small"
                              onClick={() => openPagar(f.id, faturasCartaoId!, f.valorRestante, cartaoAtivo.contaId)}
                              title="Pagar fatura"
                              sx={{ p: 0.75, color: tokens.color.brand.primary, borderRadius: tokens.radius.sm, "&:hover": { bgcolor: tokens.color.brand.subtle } }}>
                              <PaymentOutlinedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Sub-linhas de transações */}
                      {isExpanded && (
                        <TableRow key={`${f.id}-detail`}>
                          <TableCell colSpan={8} sx={{ p: 0, borderBottom: 0 }}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box sx={{ bgcolor: tokens.color.background.secondary, borderBottom: "1px solid", borderColor: "divider" }}>
                                {!detalhe ? (
                                  <Box sx={{ py: 2, px: 4 }}><LinearProgress /></Box>
                                ) : detalhe.transacoes.length === 0 ? (
                                  <Typography fontSize={12} color="text.secondary" sx={{ py: 1.5, px: 4 }}>
                                    Nenhuma transação nesta fatura.
                                  </Typography>
                                ) : (
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell sx={{ ...headerSx, pl: 5, width: "30%" }}>Data</TableCell>
                                        <TableCell sx={headerSx}>Horário</TableCell>
                                        <TableCell sx={headerSx}>Descrição</TableCell>
                                        <TableCell sx={headerSx}>Categoria</TableCell>
                                        <TableCell sx={{ ...headerSx, textAlign: "right" }}>Valor</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {detalhe.transacoes.map(t => (
                                        <TableRow key={t.id} sx={{ "&:hover": { bgcolor: tokens.color.background.hover } }}>
                                          <TableCell sx={{ ...cellSx, pl: 5 }}>
                                            <Typography fontSize={12} color="text.primary">
                                              {new Date(t.data).toLocaleDateString("pt-BR")}
                                            </Typography>
                                          </TableCell>
                                          <TableCell sx={cellSx}>
                                            <Typography fontSize={12} color="text.secondary" fontFamily="monospace">
                                              {new Date(t.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                            </Typography>
                                          </TableCell>
                                          <TableCell sx={cellSx}>
                                            <Typography fontSize={12} color="text.primary">{t.descricao}</Typography>
                                          </TableCell>
                                          <TableCell sx={cellSx}>
                                            <Typography fontSize={12} color="text.secondary">{t.categoriaDescricao ?? "—"}</Typography>
                                          </TableCell>
                                          <TableCell sx={{ ...cellSx, textAlign: "right", fontWeight: 600, color: paidTransacaoIds.has(t.id) ? tokens.color.status.success.main : tokens.color.status.error.main }}>
                                            {formatMoney(t.valor)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Paper>
      )}

      {/* Dialog Criar/Editar Cartão */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: tokens.radius.xl, border: "1px solid", borderColor: "divider", boxShadow: tokens.shadow.lg } }}>
        <DialogTitle sx={{ p: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 3, py: 2.5 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: tokens.radius.md, background: BANDEIRA_GRAD[form.bandeira] ?? BANDEIRA_GRAD[6], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
              <CreditCardIcon sx={{ fontSize: 17 }} />
            </Box>
            <Typography fontWeight={tokens.typography.fontWeight.bold} fontSize={tokens.typography.fontSize.base} color="text.primary">
              {editingId ? "Editar Cartão" : "Novo Cartão"}
            </Typography>
            <IconButton size="small" onClick={() => setDialogOpen(false)} sx={{ ml: "auto", color: "text.secondary", "&:hover": { bgcolor: tokens.color.background.secondary } }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
          <Divider />
        </DialogTitle>

        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, px: 3, py: 3 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Modalidade *</InputLabel>
            <Select value={form.modo} label="Modalidade *"
              sx={{ borderRadius: tokens.radius.md, fontSize: tokens.typography.fontSize.sm }}
              onChange={(e) => setForm(f => ({ ...f, modo: e.target.value as Modo, contaId: undefined, limite: undefined, diaFechamento: undefined, diaVencimento: undefined }))}>
              {MODOS.map(m => <MuiMenuItem key={m.value} value={m.value}>{m.label}</MuiMenuItem>)}
            </Select>
          </FormControl>

          <TextField label="Nome do cartão *" size="small" fullWidth value={form.nome}
            onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
            placeholder="Ex: Nubank Roxinho" sx={fieldSx} />

          <FormControl size="small" fullWidth>
            <InputLabel>Bandeira</InputLabel>
            <Select value={form.bandeira} label="Bandeira"
              sx={{ borderRadius: tokens.radius.md, fontSize: tokens.typography.fontSize.sm }}
              onChange={(e) => setForm(f => ({ ...f, bandeira: Number(e.target.value) }))}>
              {BANDEIRAS.map(b => <MuiMenuItem key={b.value} value={b.value}>{b.label}</MuiMenuItem>)}
            </Select>
          </FormControl>

          <TextField label="Últimos 4 dígitos" size="small" fullWidth
            value={form.ultimosDigitos ?? ""}
            onChange={(e) => setForm(f => ({ ...f, ultimosDigitos: e.target.value || undefined }))}
            inputProps={{ maxLength: 4 }} placeholder="0000" sx={fieldSx} />

          {!isPrePago && (
            <FormControl size="small" fullWidth>
              <InputLabel>{temCredito ? "Conta que paga a fatura *" : "Conta vinculada *"}</InputLabel>
              <Select value={form.contaId ?? ""}
                label={temCredito ? "Conta que paga a fatura *" : "Conta vinculada *"}
                sx={{ borderRadius: tokens.radius.md, fontSize: tokens.typography.fontSize.sm }}
                onChange={(e) => {
                  const conta = contas.find(c => c.id === e.target.value)
                  setForm(f => ({ ...f, contaId: e.target.value || undefined, bancoId: conta?.bancoId }))
                }}>
                <MuiMenuItem value="">Selecione a conta</MuiMenuItem>
                {contas.map(c => <MuiMenuItem key={c.id} value={c.id}>{c.nome}</MuiMenuItem>)}
              </Select>
            </FormControl>
          )}

          {isPrePago && (
            <FormControl size="small" fullWidth>
              <InputLabel>Banco emissor</InputLabel>
              <Select value={form.bancoId ?? ""} label="Banco emissor"
                sx={{ borderRadius: tokens.radius.md, fontSize: tokens.typography.fontSize.sm }}
                onChange={(e) => setForm(f => ({ ...f, bancoId: e.target.value || undefined }))}>
                <MuiMenuItem value="">Sem vínculo</MuiMenuItem>
                {bancos.map(b => <MuiMenuItem key={b.id} value={b.id}>{b.nome}</MuiMenuItem>)}
              </Select>
            </FormControl>
          )}

          {temCredito && (
            <TextField label="Limite de crédito" size="small" fullWidth type="number"
              value={form.limite ?? ""}
              onChange={(e) => setForm(f => ({ ...f, limite: e.target.value ? Number(e.target.value) : undefined }))}
              inputProps={{ min: 0, step: "0.01" }} sx={fieldSx} />
          )}

          {temCredito && (
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <TextField label="Dia fechamento" size="small" fullWidth type="number"
                value={form.diaFechamento ?? ""}
                onChange={(e) => setForm(f => ({ ...f, diaFechamento: e.target.value ? Number(e.target.value) : undefined }))}
                inputProps={{ min: 1, max: 31 }} helperText="1 a 31" sx={fieldSx} />
              <TextField label="Dia vencimento" size="small" fullWidth type="number"
                value={form.diaVencimento ?? ""}
                onChange={(e) => setForm(f => ({ ...f, diaVencimento: e.target.value ? Number(e.target.value) : undefined }))}
                inputProps={{ min: 1, max: 31 }} helperText="1 a 31" sx={fieldSx} />
            </Box>
          )}

          {erro && (
            <Typography fontSize={13} color={tokens.color.status.error.main}>{erro}</Typography>
          )}
        </DialogContent>

        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <CustomButton variant="secondary" size="small" onClick={() => setDialogOpen(false)}>Cancelar</CustomButton>
          <CustomButton variant="primary" size="small" onClick={handleSalvar} disabled={loading}>
            {loading ? "Salvando..." : editingId ? "Atualizar" : "Cadastrar"}
          </CustomButton>
        </DialogActions>
      </Dialog>

      {/* Dialog Pagar Fatura */}
      <Dialog open={!!pagarFaturaId} onClose={() => setPagarFaturaId(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: tokens.radius.xl, border: "1px solid", borderColor: "divider", boxShadow: tokens.shadow.lg } }}>
        <DialogTitle sx={{ p: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 3, py: 2.5 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: tokens.radius.md, background: `linear-gradient(135deg, ${tokens.color.status.success.main}, ${tokens.color.status.success.dark})`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexShrink: 0 }}>
              <PaymentOutlinedIcon sx={{ fontSize: 17 }} />
            </Box>
            <Typography fontWeight={tokens.typography.fontWeight.bold} fontSize={tokens.typography.fontSize.base} color="text.primary">
              Pagar Fatura
            </Typography>
            <IconButton size="small" onClick={() => setPagarFaturaId(null)} sx={{ ml: "auto", color: "text.secondary", "&:hover": { bgcolor: tokens.color.background.secondary } }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
          <Divider />
        </DialogTitle>

        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, px: 3, py: 3 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Conta de débito *</InputLabel>
            <Select value={pagarForm.contaId} label="Conta de débito *"
              sx={{ borderRadius: tokens.radius.md, fontSize: tokens.typography.fontSize.sm }}
              onChange={(e) => setPagarForm(f => ({ ...f, contaId: e.target.value }))}>
              <MuiMenuItem value="">Selecione a conta</MuiMenuItem>
              {contas.map(c => <MuiMenuItem key={c.id} value={c.id}>{c.nome}</MuiMenuItem>)}
            </Select>
          </FormControl>

          <TextField label="Valor *" size="small" fullWidth type="number"
            value={pagarForm.valor}
            onChange={(e) => setPagarForm(f => ({ ...f, valor: e.target.value }))}
            inputProps={{ min: 0.01, step: "0.01" }}
            helperText="Pode pagar parcialmente" sx={fieldSx} />

          <TextField label="Data do pagamento *" size="small" fullWidth type="date"
            value={pagarForm.dataPagamento}
            onChange={(e) => setPagarForm(f => ({ ...f, dataPagamento: e.target.value }))}
            InputLabelProps={{ shrink: true }} sx={fieldSx} />

          <FormControl size="small" fullWidth>
            <InputLabel>Meio de pagamento</InputLabel>
            <Select value={pagarForm.meioPagamento} label="Meio de pagamento"
              sx={{ borderRadius: tokens.radius.md, fontSize: tokens.typography.fontSize.sm }}
              onChange={(e) => setPagarForm(f => ({ ...f, meioPagamento: Number(e.target.value) }))}>
              {MEIOS_PAGAMENTO.map(m => <MuiMenuItem key={m.value} value={m.value}>{m.label}</MuiMenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>

        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <CustomButton variant="secondary" size="small" onClick={() => setPagarFaturaId(null)}>Cancelar</CustomButton>
          <CustomButton variant="primary" size="small" onClick={handlePagar} disabled={pagarLoading}>
            {pagarLoading ? "Registrando..." : "Confirmar Pagamento"}
          </CustomButton>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
