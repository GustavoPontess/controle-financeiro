import { useEffect, useState } from "react"
import {
  Box, Paper, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem as MuiMenuItem, FormControl, InputLabel,
  IconButton, Chip, LinearProgress,
} from "@mui/material"
import AddIcon from "@mui/icons-material/Add"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined"
import TrendingUpIcon from "@mui/icons-material/TrendingUp"
import TrendingDownIcon from "@mui/icons-material/TrendingDown"
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined"
import CustomButton from "../../components/CustomButton"
import {
  getEmprestimos, createEmprestimo, registrarPagamento, quitarEmprestimo, deleteEmprestimo,
} from "../../services/emprestimoService"
import type { Emprestimo, CriarEmprestimo } from "../../types/Emprestimo"
import { tokens } from "../../theme/tokens"

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—"

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm: CriarEmprestimo = {
  descricao: "",
  pessoa: "",
  valorTotal: 0,
  tipo: 1,
  dataInicio: today(),
  dataVencimento: undefined,
  observacao: undefined,
}

export default function EmprestimosPage() {
  const [emprestimos, setEmprestimos] = useState<Emprestimo[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pagamentoDialogOpen, setPagamentoDialogOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [valorPagamento, setValorPagamento] = useState("")
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<CriarEmprestimo>(emptyForm)
  const [erro, setErro] = useState("")

  const loadData = async () => {
    const data = await getEmprestimos()
    setEmprestimos(data)
  }

  useEffect(() => { loadData() }, [])

  const openDialog = () => {
    setForm(emptyForm)
    setErro("")
    setDialogOpen(true)
  }

  const handleSalvar = async () => {
    setErro("")
    if (!form.descricao || !form.pessoa || !form.valorTotal) {
      setErro("Preencha todos os campos obrigatórios.")
      return
    }
    setLoading(true)
    try {
      await createEmprestimo({
        ...form,
        valorTotal: Number(form.valorTotal),
        dataInicio: new Date(form.dataInicio).toISOString(),
        dataVencimento: form.dataVencimento ? new Date(form.dataVencimento).toISOString() : undefined,
      })
      setDialogOpen(false)
      await loadData()
    } catch {
      setErro("Erro ao criar empréstimo.")
    } finally {
      setLoading(false)
    }
  }

  const handlePagamento = async () => {
    if (!selectedId || !valorPagamento) return
    setLoading(true)
    try {
      await registrarPagamento(selectedId, Number(valorPagamento))
      setPagamentoDialogOpen(false)
      setValorPagamento("")
      setSelectedId(null)
      await loadData()
    } finally {
      setLoading(false)
    }
  }

  const handleQuitar = async (id: string) => {
    if (!confirm("Marcar empréstimo como quitado?")) return
    await quitarEmprestimo(id)
    await loadData()
  }

  const handleDeletar = async (id: string) => {
    if (!confirm("Remover este empréstimo? Esta ação não pode ser desfeita.")) return
    await deleteEmprestimo(id)
    await loadData()
  }

  const ativos = emprestimos.filter(e => !e.quitado)
  const totalAReceber = ativos
    .filter(e => e.tipo === 1)
    .reduce((s, e) => s + e.valorRestante, 0)
  const totalAPagar = ativos
    .filter(e => e.tipo === 2)
    .reduce((s, e) => s + e.valorRestante, 0)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography fontSize={22} fontWeight={700} color={tokens.color.text.primary}>Empréstimos</Typography>
          <Typography fontSize={13} color={tokens.color.text.secondary}>Controle de dinheiro emprestado e recebido</Typography>
        </Box>
        <CustomButton variant="primary" size="small" startIcon={<AddIcon />} onClick={openDialog}>
          Novo Empréstimo
        </CustomButton>
      </Box>

      {/* Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2.5, border: 1, borderColor: tokens.color.border.default, borderRadius: tokens.radius.lg }}>
          <Typography fontSize={12} color={tokens.color.text.secondary} mb={0.5}>A receber</Typography>
          <Typography fontSize={22} fontWeight={800} color={tokens.color.status.success.dark}>{formatMoney(totalAReceber)}</Typography>
          <Typography fontSize={11} color={tokens.color.text.secondary}>dinheiro que emprestei</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, border: 1, borderColor: tokens.color.border.default, borderRadius: tokens.radius.lg }}>
          <Typography fontSize={12} color={tokens.color.text.secondary} mb={0.5}>A pagar</Typography>
          <Typography fontSize={22} fontWeight={800} color={tokens.color.status.error.main}>{formatMoney(totalAPagar)}</Typography>
          <Typography fontSize={11} color={tokens.color.text.secondary}>dinheiro que peguei emprestado</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, border: 1, borderColor: tokens.color.border.default, borderRadius: tokens.radius.lg }}>
          <Typography fontSize={12} color={tokens.color.text.secondary} mb={0.5}>Ativos</Typography>
          <Typography fontSize={26} fontWeight={800} color={tokens.color.text.primary}>{ativos.length}</Typography>
        </Paper>
      </Box>

      {/* Lista */}
      <Paper elevation={0} sx={{ border: 1, borderColor: tokens.color.border.default, borderRadius: tokens.radius.lg, overflow: "hidden" }}>
        <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: tokens.color.border.default }}>
          <Typography fontSize={15} fontWeight={tokens.typography.fontWeight.bold} color={tokens.color.text.primary}>Seus Empréstimos</Typography>
        </Box>

        {emprestimos.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <HandshakeOutlinedIcon sx={{ fontSize: 40, color: tokens.color.text.disabled, mb: 1 }} />
            <Typography fontSize={14} color={tokens.color.text.secondary}>Nenhum empréstimo cadastrado</Typography>
            <Typography fontSize={13} color={tokens.color.text.secondary}>Registre dinheiro emprestado ou que você tomou emprestado</Typography>
          </Box>
        ) : (
          emprestimos.map((e, i) => {
            const isEmprestei = e.tipo === 1
            return (
              <Box
                key={e.id}
                sx={{
                  px: 3, py: 2,
                  borderBottom: i < emprestimos.length - 1 ? 1 : 0, borderColor: tokens.color.border.default,
                  opacity: e.quitado ? 0.55 : 1,
                  "&:hover": { bgcolor: tokens.color.background.hover }, transition: "background 0.15s",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
                  {/* Left */}
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, minWidth: 0, flex: 1 }}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: tokens.radius.md, flexShrink: 0, mt: 0.3,
                      bgcolor: isEmprestei ? tokens.color.status.success.light : tokens.color.status.error.light,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isEmprestei
                        ? <TrendingUpIcon sx={{ fontSize: 18, color: tokens.color.status.success.main }} />
                        : <TrendingDownIcon sx={{ fontSize: 18, color: tokens.color.status.error.main }} />
                      }
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography fontWeight={600} fontSize={14}>{e.descricao}</Typography>
                        {e.quitado && (
                          <Chip label="Quitado" size="small" sx={{ fontSize: 11, height: 18, bgcolor: tokens.color.status.success.light, color: tokens.color.status.success.dark }} />
                        )}
                        {e.vencido && (
                          <Chip label="Vencido" size="small" sx={{ fontSize: 11, height: 18, bgcolor: tokens.color.status.error.light, color: tokens.color.status.error.main }} />
                        )}
                      </Box>
                      <Typography fontSize={12} color={tokens.color.text.secondary} mt={0.2}>
                        {isEmprestei ? "Para:" : "De:"} <strong>{e.pessoa}</strong>
                        {e.dataVencimento && ` · vence ${formatDate(e.dataVencimento)}`}
                      </Typography>
                      {/* Progress bar */}
                      {!e.quitado && (
                        <Box sx={{ mt: 1, maxWidth: 280 }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.3 }}>
                            <Typography fontSize={11} color={tokens.color.text.secondary}>
                              {formatMoney(e.valorPago)} pago de {formatMoney(e.valorTotal)}
                            </Typography>
                            <Typography fontSize={11} color={tokens.color.text.secondary} fontWeight={tokens.typography.fontWeight.bold}>
                              {e.percentualPago}%
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={e.percentualPago}
                            sx={{
                              height: 5, borderRadius: 3,
                              bgcolor: tokens.color.background.hover,
                              "& .MuiLinearProgress-bar": { bgcolor: isEmprestei ? tokens.color.status.success.main : tokens.color.status.error.main, borderRadius: 3 },
                            }}
                          />
                        </Box>
                      )}
                    </Box>
                  </Box>

                  {/* Right */}
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, flexShrink: 0 }}>
                    <Typography fontWeight={700} fontSize={15} color={isEmprestei ? tokens.color.status.success.main : tokens.color.status.error.main}>
                      {formatMoney(e.valorRestante)}
                    </Typography>
                    <Typography fontSize={11} color={tokens.color.text.secondary}>restante</Typography>
                    {!e.quitado && (
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        <IconButton
                          size="small"
                          title="Registrar pagamento"
                          onClick={() => { setSelectedId(e.id); setValorPagamento(""); setPagamentoDialogOpen(true) }}
                          sx={{ color: tokens.color.text.secondary, "&:hover": { color: tokens.color.brand.primary } }}
                        >
                          <PaidOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          title="Marcar como quitado"
                          onClick={() => handleQuitar(e.id)}
                          sx={{ color: tokens.color.text.secondary, "&:hover": { color: tokens.color.status.success.main } }}
                        >
                          <HandshakeOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeletar(e.id)}
                          sx={{ color: tokens.color.text.secondary, "&:hover": { color: tokens.color.status.error.main } }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                    {e.quitado && (
                      <IconButton
                        size="small"
                        onClick={() => handleDeletar(e.id)}
                        sx={{ color: tokens.color.text.secondary, "&:hover": { color: tokens.color.status.error.main } }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              </Box>
            )
          })
        )}
      </Paper>

      {/* Dialog: Novo Empréstimo */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Novo Empréstimo</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>

          <FormControl size="small" fullWidth>
            <InputLabel>Tipo *</InputLabel>
            <Select
              value={form.tipo}
              label="Tipo *"
              onChange={(e) => setForm(f => ({ ...f, tipo: Number(e.target.value) }))}
            >
              <MuiMenuItem value={1}>Emprestei (vou receber)</MuiMenuItem>
              <MuiMenuItem value={2}>Peguei emprestado (vou pagar)</MuiMenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Descrição *"
            size="small"
            fullWidth
            value={form.descricao}
            onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
            placeholder="Ex: Empréstimo para viagem"
          />

          <TextField
            label={form.tipo === 1 ? "Para quem emprestei *" : "De quem peguei *"}
            size="small"
            fullWidth
            value={form.pessoa}
            onChange={(e) => setForm(f => ({ ...f, pessoa: e.target.value }))}
            placeholder="Nome da pessoa"
          />

          <TextField
            label="Valor *"
            size="small"
            type="number"
            fullWidth
            value={form.valorTotal || ""}
            onChange={(e) => setForm(f => ({ ...f, valorTotal: Number(e.target.value) }))}
            inputProps={{ min: 0.01, step: "0.01" }}
          />

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <TextField
              label="Data *"
              type="date"
              size="small"
              fullWidth
              value={form.dataInicio}
              onChange={(e) => setForm(f => ({ ...f, dataInicio: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Vencimento"
              type="date"
              size="small"
              fullWidth
              value={form.dataVencimento ?? ""}
              onChange={(e) => setForm(f => ({ ...f, dataVencimento: e.target.value || undefined }))}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <TextField
            label="Observação"
            size="small"
            fullWidth
            multiline
            rows={2}
            value={form.observacao ?? ""}
            onChange={(e) => setForm(f => ({ ...f, observacao: e.target.value || undefined }))}
          />

          {erro && <Typography fontSize={13} color={tokens.color.status.error.main}>{erro}</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <CustomButton variant="secondary" size="small" onClick={() => setDialogOpen(false)}>Cancelar</CustomButton>
          <CustomButton variant="primary" size="small" onClick={handleSalvar} disabled={loading}>
            {loading ? "Salvando..." : "Criar Empréstimo"}
          </CustomButton>
        </DialogActions>
      </Dialog>

      {/* Dialog: Registrar Pagamento */}
      <Dialog open={pagamentoDialogOpen} onClose={() => setPagamentoDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Registrar Pagamento</DialogTitle>
        <DialogContent sx={{ pt: "12px !important" }}>
          <TextField
            label="Valor pago *"
            type="number"
            size="small"
            fullWidth
            value={valorPagamento}
            onChange={(e) => setValorPagamento(e.target.value)}
            inputProps={{ min: 0.01, step: "0.01" }}
            autoFocus
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <CustomButton variant="secondary" size="small" onClick={() => setPagamentoDialogOpen(false)}>Cancelar</CustomButton>
          <CustomButton variant="primary" size="small" onClick={handlePagamento} disabled={loading || !valorPagamento}>
            {loading ? "Salvando..." : "Confirmar"}
          </CustomButton>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
