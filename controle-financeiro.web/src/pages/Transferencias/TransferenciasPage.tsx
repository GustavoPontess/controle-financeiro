import { useEffect, useState } from "react"
import {
  Box, Paper, Typography, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Select, MenuItem as MuiMenuItem,
  FormControl, InputLabel, IconButton, Chip,
} from "@mui/material"
import { tokens } from "../../theme/tokens"
import AddIcon from "@mui/icons-material/Add"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import SwapHorizIcon from "@mui/icons-material/SwapHoriz"
import CustomButton from "../../components/CustomButton"
import { getTransferencias, createTransferencia, deleteTransferencia } from "../../services/transferenciaService"
import { getContas } from "../../services/contaService"
import type { Transferencia } from "../../types/Transferencia"
import type { Conta } from "../../types/Conta"

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const today = () => new Date().toISOString().slice(0, 10)

export default function TransferenciasPage() {
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    contaOrigemId: "",
    contaDestinoId: "",
    valor: "",
    data: today(),
    descricao: "",
  })
  const [erro, setErro] = useState("")

  const loadData = async () => {
    try {
      const [t, c] = await Promise.all([getTransferencias(), getContas()])
      setTransferencias(t)
      setContas(c)
    } catch (error) {
      console.error("Erro ao carregar transferências:", error)
      setErro("Erro ao carregar transferências")
    }
  }

  useEffect(() => { loadData() }, [])

  const handleSalvar = async () => {
    setErro("")
    if (!form.contaOrigemId || !form.contaDestinoId || !form.valor) {
      setErro("Preencha todos os campos obrigatórios.")
      return
    }
    const valor = parseFloat(form.valor.replace(",", "."))
    if (isNaN(valor) || valor <= 0) {
      setErro("Valor inválido.")
      return
    }
    setLoading(true)
    try {
      await createTransferencia({
        contaOrigemId: form.contaOrigemId,
        contaDestinoId: form.contaDestinoId,
        valor,
        data: new Date(form.data).toISOString(),
        descricao: form.descricao,
      })
      setDialogOpen(false)
      setForm({ contaOrigemId: "", contaDestinoId: "", valor: "", data: today(), descricao: "" })
      await loadData()
      window.dispatchEvent(new Event("transactionCreated"))
    } catch {
      setErro("Erro ao criar transferência.")
    } finally {
      setLoading(false)
    }
  }

  const handleDeletar = async (id: string) => {
    if (!confirm("Remover esta transferência? As duas transações vinculadas também serão removidas.")) return
    await deleteTransferencia(id)
    await loadData()
    window.dispatchEvent(new Event("transactionCreated"))
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography fontSize={22} fontWeight={tokens.typography.fontWeight.bold} color="text.primary">Transferências</Typography>
          <Typography fontSize={tokens.typography.fontSize.sm} color="text.secondary">Mova dinheiro entre suas contas</Typography>
        </Box>
        <CustomButton variant="primary" size="small" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Nova Transferência
        </CustomButton>
      </Box>

      {/* Lista */}
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: tokens.radius.lg, overflow: "hidden" }}>
        <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: "divider" }}>
          <Typography fontSize={15} fontWeight={tokens.typography.fontWeight.bold} color="text.primary">Histórico de Transferências</Typography>
        </Box>

        {transferencias.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <SwapHorizIcon sx={{ fontSize: 40, color: "action.selected", mb: 1 }} />
            <Typography fontSize={tokens.typography.fontSize.sm} color="text.secondary">Nenhuma transferência realizada</Typography>
            <Typography fontSize={tokens.typography.fontSize.sm} color="text.secondary">Clique em "Nova Transferência" para começar</Typography>
          </Box>
        ) : (
          transferencias.map((t, i) => (
            <Box
              key={t.id}
              sx={{
                px: 3, py: 2,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: i < transferencias.length - 1 ? 1 : 0, borderColor: "divider",
                "&:hover": { bgcolor: tokens.color.background.hover }, transition: "background 0.15s",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: tokens.radius.md, bgcolor: tokens.color.status.info.light, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <SwapHorizIcon sx={{ fontSize: 18, color: tokens.color.status.info.main }} />
                </Box>
                <Box>
                  <Typography fontWeight={tokens.typography.fontWeight.bold} fontSize={tokens.typography.fontSize.sm}>{t.descricao}</Typography>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.3 }}>
                    <Chip label={t.contaOrigemNome} size="small" sx={{ fontSize: 11, height: 18, bgcolor: tokens.color.status.error.light, color: tokens.color.status.error.main }} />
                    <SwapHorizIcon sx={{ fontSize: 12, color: "text.secondary" }} />
                    <Chip label={t.contaDestinoNome} size="small" sx={{ fontSize: 11, height: 18, bgcolor: tokens.color.status.success.light, color: tokens.color.status.success.main }} />
                    <Typography fontSize={tokens.typography.fontSize.xs} color="text.secondary">
                      {new Date(t.data).toLocaleDateString("pt-BR")}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Typography fontWeight={tokens.typography.fontWeight.bold} fontSize={15} color={tokens.color.status.info.main}>
                  {formatMoney(t.valor)}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => handleDeletar(t.id)}
                  sx={{ color: "text.secondary", "&:hover": { color: tokens.color.status.error.main } }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          ))
        )}
      </Paper>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Nova Transferência</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Conta de Origem *</InputLabel>
            <Select
              value={form.contaOrigemId}
              label="Conta de Origem *"
              onChange={(e) => setForm(f => ({ ...f, contaOrigemId: e.target.value }))}
            >
              {contas.filter(c => c.id !== form.contaDestinoId).map(c => (
                <MuiMenuItem key={c.id} value={c.id}>{c.nome}</MuiMenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>Conta de Destino *</InputLabel>
            <Select
              value={form.contaDestinoId}
              label="Conta de Destino *"
              onChange={(e) => setForm(f => ({ ...f, contaDestinoId: e.target.value }))}
            >
              {contas.filter(c => c.id !== form.contaOrigemId).map(c => (
                <MuiMenuItem key={c.id} value={c.id}>{c.nome}</MuiMenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Valor *"
            size="small"
            fullWidth
            value={form.valor}
            onChange={(e) => setForm(f => ({ ...f, valor: e.target.value }))}
            inputProps={{ inputMode: "decimal" }}
          />

          <TextField
            label="Data"
            type="date"
            size="small"
            fullWidth
            value={form.data}
            onChange={(e) => setForm(f => ({ ...f, data: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Descrição (opcional)"
            size="small"
            fullWidth
            value={form.descricao}
            onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
          />

          {erro && <Typography fontSize={tokens.typography.fontSize.sm} color={tokens.color.status.error.main}>{erro}</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <CustomButton variant="secondary" size="small" onClick={() => setDialogOpen(false)}>Cancelar</CustomButton>
          <CustomButton variant="primary" size="small" onClick={handleSalvar} disabled={loading}>
            {loading ? "Salvando..." : "Transferir"}
          </CustomButton>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
