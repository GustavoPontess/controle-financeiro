import { useEffect, useState } from "react"
import {
  Box, Typography, Paper, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem as MuiMenuItem,
  FormControl, InputLabel, LinearProgress, Table, TableHead, TableBody,
  TableRow, TableCell,
} from "@mui/material"
import { useOutletContext } from "react-router-dom"
import AddRoundedIcon from "@mui/icons-material/AddRounded"
import EditIcon from "@mui/icons-material/Edit"
import DeleteIcon from "@mui/icons-material/Delete"
import CreditCardIcon from "@mui/icons-material/CreditCard"
import ReceiptIcon from "@mui/icons-material/Receipt"
import PaymentIcon from "@mui/icons-material/Payment"
import CustomButton from "../../components/CustomButton"
import EmptyState from "../../components/EmptyState/EmptyState"
import { getCartoes, createCartao, updateCartao, deleteCartao } from "../../services/cartaoCreditoService"
import { getContas } from "../../services/contaService"
import { getBancos } from "../../services/bancoService"
import { getFaturasByCartao, pagarFatura } from "../../services/faturaService"
import type { CartaoCredito, CriarCartaoCredito } from "../../types/CartaoCredito"
import type { Conta } from "../../types/Conta"
import type { Banco } from "../../types/Banco"
import type { Fatura, PagarFaturaPayload } from "../../types/Fatura"

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

const BANDEIRA_COLOR: Record<number, { bg: string; color: string }> = {
  1: { bg: "#dbeafe", color: "#1d4ed8" },
  2: { bg: "#fef3c7", color: "#b45309" },
  3: { bg: "#dcfce7", color: "#15803d" },
  4: { bg: "#ffe4e6", color: "#be123c" },
  5: { bg: "#ede9fe", color: "#7c3aed" },
  6: { bg: "#f3f4f6", color: "#374151" },
}

const STATUS_COLOR: Record<number, { bg: string; color: string; label: string }> = {
  1: { bg: "#dbeafe", color: "#1d4ed8", label: "Aberta" },
  2: { bg: "#fef3c7", color: "#b45309", label: "Fechada" },
  3: { bg: "#dcfce7", color: "#15803d", label: "Paga" },
}

type FormState = Omit<CriarCartaoCredito, "temCredito" | "temDebito" | "ehPrePago"> & { modo: Modo }

const emptyForm: FormState = {
  nome: "",
  ultimosDigitos: undefined,
  bandeira: 6,
  modo: "credito_debito",
  limite: undefined,
  diaFechamento: undefined,
  diaVencimento: undefined,
  contaId: undefined,
  bancoId: undefined,
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

  // Faturas
  const [faturasCartaoId, setFaturasCartaoId] = useState<string | null>(null)
  const [faturas, setFaturas] = useState<Fatura[]>([])
  const [loadingFaturas, setLoadingFaturas] = useState(false)

  // Pagamento
  const [pagarFaturaId, setPagarFaturaId] = useState<string | null>(null)
  const [pagarCartaoId, setPagarCartaoId] = useState<string | null>(null)
  const [pagarForm, setPagarForm] = useState({
    contaId: "",
    valor: "",
    dataPagamento: new Date().toISOString().split("T")[0],
    meioPagamento: 4,
  })
  const [pagarLoading, setPagarLoading] = useState(false)

  const loadData = async () => {
    const [cs, conts, bs] = await Promise.all([getCartoes(), getContas(), getBancos()])
    setCartoes(cs)
    setContas(conts.filter(c => !c.isCarteira))
    setBancos(bs)
  }

  useEffect(() => { loadData() }, [])

  const openFaturas = async (cartaoId: string) => {
    if (faturasCartaoId === cartaoId) { setFaturasCartaoId(null); return }
    setFaturasCartaoId(cartaoId)
    setLoadingFaturas(true)
    try {
      const f = await getFaturasByCartao(cartaoId)
      setFaturas(f)
    } finally {
      setLoadingFaturas(false)
    }
  }

  const openPagar = (faturaId: string, cartaoId: string, valorRestante: number, contaId?: string) => {
    setPagarFaturaId(faturaId)
    setPagarCartaoId(cartaoId)
    setPagarForm({
      contaId: contaId ?? "",
      valor: String(valorRestante.toFixed(2)),
      dataPagamento: new Date().toISOString().split("T")[0],
      meioPagamento: 4,
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
        contaId: pagarForm.contaId,
        valor: Number(pagarForm.valor),
        dataPagamento: pagarForm.dataPagamento,
        meioPagamento: pagarForm.meioPagamento,
      }
      await pagarFatura(pagarCartaoId, pagarFaturaId, payload)
      notify({ open: true, message: "Pagamento registrado com sucesso", severity: "success" })
      setPagarFaturaId(null)
      // Recarregar faturas do cartão ativo
      if (faturasCartaoId) {
        const f = await getFaturasByCartao(faturasCartaoId)
        setFaturas(f)
      }
    } catch {
      notify({ open: true, message: "Erro ao registrar pagamento", severity: "error" })
    } finally {
      setPagarLoading(false)
    }
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
    if (!confirm("Remover este cartão?")) return
    try {
      await deleteCartao(id)
      notify({ open: true, message: "Cartão removido", severity: "success" })
      if (faturasCartaoId === id) setFaturasCartaoId(null)
      await loadData()
    } catch { notify({ open: true, message: "Erro ao remover cartão", severity: "error" }) }
  }

  const totalLimite = cartoes.filter(c => c.temCredito && c.limite).reduce((s, c) => s + (c.limite ?? 0), 0)
  const totalGastos = cartoes.filter(c => c.temCredito).reduce((s, c) => s + c.gastosNoCicloAtual, 0)
  const isPrePago = form.modo === "prepago"
  const temCredito = form.modo === "credito" || form.modo === "credito_debito"
  const cartaoAtivo = cartoes.find(c => c.id === faturasCartaoId)

  const headerSx = { fontSize: 12, fontWeight: 600, color: "#6b7280", bgcolor: "#f9fafb", py: 1.25 }
  const cellSx = { fontSize: 13, color: "#374151", py: 1.25 }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography fontSize={22} fontWeight={700} color="#111827">Cartões</Typography>
          <Typography fontSize={13} color="#6b7280">Gerencie seus cartões e acompanhe faturas</Typography>
        </Box>
        <CustomButton size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />} onClick={openCreate}>
          Novo Cartão
        </CustomButton>
      </Box>

      {/* Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2.5, border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          <Typography fontSize={12} color="#6b7280" mb={0.5}>Total de Cartões</Typography>
          <Typography fontSize={26} fontWeight={800} color="#111827">{cartoes.length}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          <Typography fontSize={12} color="#6b7280" mb={0.5}>Limite Total</Typography>
          <Typography fontSize={22} fontWeight={800} color="#111827">{formatMoney(totalLimite)}</Typography>
          <Typography fontSize={11} color="#9ca3af">cartões com crédito</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          <Typography fontSize={12} color="#6b7280" mb={0.5}>Gastos no Ciclo</Typography>
          <Typography fontSize={22} fontWeight={800} color="#dc2626">{formatMoney(totalGastos)}</Typography>
          <Typography fontSize={11} color="#9ca3af">ciclo atual</Typography>
        </Paper>
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
            const colors = BANDEIRA_COLOR[c.bandeira] ?? BANDEIRA_COLOR[6]
            const pct = c.limite ? Math.min((c.gastosNoCicloAtual / c.limite) * 100, 100) : 0
            const isSelected = faturasCartaoId === c.id

            return (
              <Paper key={c.id} elevation={0} sx={{
                border: `1.5px solid ${isSelected ? "#2563eb" : "#e5e7eb"}`,
                borderRadius: "12px", overflow: "hidden",
                transition: "border-color 0.15s",
              }}>
                <Box sx={{ px: 3, py: 2.5, borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box sx={{ width: 38, height: 38, borderRadius: "10px", bgcolor: colors.bg, color: colors.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CreditCardIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography fontSize={14} fontWeight={700} color="#111827">{c.nome}</Typography>
                      <Typography fontSize={12} color="#6b7280">
                        {c.bandeiraDescricao}{c.ultimosDigitos ? ` · ****${c.ultimosDigitos}` : ""}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex" }}>
                    {c.temCredito && (
                      <IconButton size="small" onClick={() => openFaturas(c.id)}
                        sx={{ color: isSelected ? "#2563eb" : "#9ca3af", "&:hover": { color: "#2563eb" } }}
                        title="Ver faturas">
                        <ReceiptIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={() => openEdit(c)} sx={{ color: "#9ca3af", "&:hover": { color: "#374151" } }}>
                      <EditIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(c.id)} sx={{ color: "#9ca3af", "&:hover": { color: "#dc2626" } }}>
                      <DeleteIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Box>
                </Box>

                <Box sx={{ px: 3, py: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                    {c.temCredito && <Chip label="Crédito" size="small" sx={{ fontSize: 11, height: 20, bgcolor: "#dbeafe", color: "#1d4ed8" }} />}
                    {c.temDebito  && <Chip label="Débito"  size="small" sx={{ fontSize: 11, height: 20, bgcolor: "#dcfce7", color: "#15803d" }} />}
                    {c.ehPrePago  && <Chip label="Pré-Pago" size="small" sx={{ fontSize: 11, height: 20, bgcolor: "#f3f4f6", color: "#374151" }} />}
                  </Box>
                  {c.contaNome && (
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography fontSize={12} color="#6b7280">Conta vinculada</Typography>
                      <Typography fontSize={12} fontWeight={600} color="#374151">{c.contaNome}</Typography>
                    </Box>
                  )}
                  {(c.diaFechamento || c.diaVencimento) && (
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      {c.diaFechamento && <Chip label={`Fecha dia ${c.diaFechamento}`} size="small" sx={{ fontSize: 11, height: 20, bgcolor: "#f3f4f6", color: "#374151" }} />}
                      {c.diaVencimento && <Chip label={`Vence dia ${c.diaVencimento}`} size="small" sx={{ fontSize: 11, height: 20, bgcolor: "#fef3c7", color: "#b45309" }} />}
                    </Box>
                  )}
                  {c.temCredito && c.limite && (
                    <Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography fontSize={12} color="#6b7280">Gastos no ciclo</Typography>
                        <Typography fontSize={12} fontWeight={600} color={pct > 80 ? "#dc2626" : "#374151"}>
                          {formatMoney(c.gastosNoCicloAtual)} / {formatMoney(c.limite)}
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={pct} sx={{
                        height: 5, borderRadius: 3, bgcolor: "#f3f4f6",
                        "& .MuiLinearProgress-bar": { bgcolor: pct > 80 ? "#dc2626" : pct > 60 ? "#f59e0b" : "#16a34a", borderRadius: 3 },
                      }} />
                      <Typography fontSize={11} color="#9ca3af" mt={0.5}>Disponível: {formatMoney(c.limiteDisponivel ?? 0)}</Typography>
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
        <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
          <Box sx={{ px: 3, py: 2, borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box>
              <Typography fontSize={15} fontWeight={600} color="#111827">
                Faturas — {cartaoAtivo.nome}
              </Typography>
              <Typography fontSize={12} color="#6b7280">
                Histórico de faturas do cartão
              </Typography>
            </Box>
          </Box>

          {loadingFaturas ? (
            <LinearProgress />
          ) : faturas.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <Typography fontSize={13} color="#9ca3af">
                Nenhuma fatura encontrada. Registre uma transação de crédito para criar a primeira fatura.
              </Typography>
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
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
                  const sc = STATUS_COLOR[f.status] ?? STATUS_COLOR[1]
                  const vencidaStyle = f.vencida ? { color: "#dc2626" } : {}
                  return (
                    <TableRow key={f.id} sx={{ "&:hover": { bgcolor: "#fafafa" } }}>
                      <TableCell sx={cellSx}>
                        <Typography fontSize={12} color="#374151">
                          {formatDate(f.dataInicio)} – {formatDate(f.dataFechamento)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ ...cellSx, ...vencidaStyle }}>
                        {formatDate(f.dataVencimento)}
                        {f.vencida && (
                          <Typography fontSize={10} color="#dc2626">Vencida</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={cellSx}>
                        <Chip label={sc.label} size="small" sx={{ fontSize: 11, height: 20, bgcolor: sc.bg, color: sc.color }} />
                      </TableCell>
                      <TableCell sx={{ ...cellSx, textAlign: "right", fontWeight: 600 }}>
                        {formatMoney(f.valorTotal)}
                      </TableCell>
                      <TableCell sx={{ ...cellSx, textAlign: "right", color: "#16a34a" }}>
                        {formatMoney(f.valorPago)}
                      </TableCell>
                      <TableCell sx={{ ...cellSx, textAlign: "right", color: f.valorRestante > 0 ? "#dc2626" : "#16a34a", fontWeight: 600 }}>
                        {formatMoney(f.valorRestante)}
                      </TableCell>
                      <TableCell sx={{ ...cellSx, textAlign: "center" }}>
                        {f.status !== 3 && f.valorRestante > 0 && (
                          <IconButton size="small"
                            onClick={() => openPagar(f.id, faturasCartaoId, f.valorRestante, cartaoAtivo.contaId)}
                            sx={{ color: "#2563eb", "&:hover": { bgcolor: "#dbeafe" } }}
                            title="Pagar fatura">
                            <PaymentIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Paper>
      )}

      {/* Dialog Criar/Editar Cartão */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>
          {editingId ? "Editar Cartão" : "Novo Cartão"}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Modalidade *</InputLabel>
            <Select value={form.modo} label="Modalidade *"
              onChange={(e) => setForm(f => ({
                ...f, modo: e.target.value as Modo,
                contaId: undefined, limite: undefined, diaFechamento: undefined, diaVencimento: undefined,
              }))}>
              {MODOS.map(m => <MuiMenuItem key={m.value} value={m.value}>{m.label}</MuiMenuItem>)}
            </Select>
          </FormControl>

          <TextField label="Nome do cartão *" size="small" fullWidth
            value={form.nome}
            onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))}
            placeholder="Ex: Nubank Roxinho" />

          <FormControl size="small" fullWidth>
            <InputLabel>Bandeira</InputLabel>
            <Select value={form.bandeira} label="Bandeira"
              onChange={(e) => setForm(f => ({ ...f, bandeira: Number(e.target.value) }))}>
              {BANDEIRAS.map(b => <MuiMenuItem key={b.value} value={b.value}>{b.label}</MuiMenuItem>)}
            </Select>
          </FormControl>

          <TextField label="Últimos 4 dígitos" size="small" fullWidth
            value={form.ultimosDigitos ?? ""}
            onChange={(e) => setForm(f => ({ ...f, ultimosDigitos: e.target.value || undefined }))}
            inputProps={{ maxLength: 4 }} placeholder="0000" />

          {!isPrePago && (
            <FormControl size="small" fullWidth>
              <InputLabel>{temCredito ? "Conta que paga a fatura *" : "Conta vinculada *"}</InputLabel>
              <Select value={form.contaId ?? ""}
                label={temCredito ? "Conta que paga a fatura *" : "Conta vinculada *"}
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
              inputProps={{ min: 0, step: "0.01" }} />
          )}

          {temCredito && (
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <TextField label="Dia fechamento" size="small" fullWidth type="number"
                value={form.diaFechamento ?? ""}
                onChange={(e) => setForm(f => ({ ...f, diaFechamento: e.target.value ? Number(e.target.value) : undefined }))}
                inputProps={{ min: 1, max: 31 }} helperText="1 a 31" />
              <TextField label="Dia vencimento" size="small" fullWidth type="number"
                value={form.diaVencimento ?? ""}
                onChange={(e) => setForm(f => ({ ...f, diaVencimento: e.target.value ? Number(e.target.value) : undefined }))}
                inputProps={{ min: 1, max: 31 }} helperText="1 a 31" />
            </Box>
          )}

          {erro && <Typography fontSize={13} color="#dc2626">{erro}</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <CustomButton variant="secondary" size="small" onClick={() => setDialogOpen(false)}>Cancelar</CustomButton>
          <CustomButton variant="primary" size="small" onClick={handleSalvar} disabled={loading}>
            {loading ? "Salvando..." : editingId ? "Atualizar" : "Cadastrar"}
          </CustomButton>
        </DialogActions>
      </Dialog>

      {/* Dialog Pagar Fatura */}
      <Dialog open={!!pagarFaturaId} onClose={() => setPagarFaturaId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Pagar Fatura</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Conta de débito *</InputLabel>
            <Select value={pagarForm.contaId} label="Conta de débito *"
              onChange={(e) => setPagarForm(f => ({ ...f, contaId: e.target.value }))}>
              <MuiMenuItem value="">Selecione a conta</MuiMenuItem>
              {contas.map(c => <MuiMenuItem key={c.id} value={c.id}>{c.nome}</MuiMenuItem>)}
            </Select>
          </FormControl>

          <TextField label="Valor *" size="small" fullWidth type="number"
            value={pagarForm.valor}
            onChange={(e) => setPagarForm(f => ({ ...f, valor: e.target.value }))}
            inputProps={{ min: 0.01, step: "0.01" }}
            helperText="Pode pagar parcialmente" />

          <TextField label="Data do pagamento *" size="small" fullWidth type="date"
            value={pagarForm.dataPagamento}
            onChange={(e) => setPagarForm(f => ({ ...f, dataPagamento: e.target.value }))}
            InputLabelProps={{ shrink: true }} />

          <FormControl size="small" fullWidth>
            <InputLabel>Meio de pagamento</InputLabel>
            <Select value={pagarForm.meioPagamento} label="Meio de pagamento"
              onChange={(e) => setPagarForm(f => ({ ...f, meioPagamento: Number(e.target.value) }))}>
              {MEIOS_PAGAMENTO.map(m => <MuiMenuItem key={m.value} value={m.value}>{m.label}</MuiMenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <CustomButton variant="secondary" size="small" onClick={() => setPagarFaturaId(null)}>Cancelar</CustomButton>
          <CustomButton variant="primary" size="small" onClick={handlePagar} disabled={pagarLoading}>
            {pagarLoading ? "Registrando..." : "Confirmar Pagamento"}
          </CustomButton>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
