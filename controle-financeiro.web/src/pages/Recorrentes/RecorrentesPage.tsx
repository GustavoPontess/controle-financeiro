import { useCallback, useEffect, useState } from "react"
import {
  Box, Paper, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem as MuiMenuItem, FormControl, InputLabel,
  IconButton, Chip, Switch,
} from "@mui/material"
import AddIcon from "@mui/icons-material/Add"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import RepeatIcon from "@mui/icons-material/Repeat"
import TrendingUpIcon from "@mui/icons-material/TrendingUp"
import TrendingDownIcon from "@mui/icons-material/TrendingDown"
import { useOutletContext } from "react-router-dom"
import CustomButton from "../../components/CustomButton"
import {
  getRecorrentes, createRecorrente, toggleRecorrente, deleteRecorrente,
} from "../../services/recorrenteService"
import { getContas } from "../../services/contaService"
import { getCategories } from "../../services/categoryService"
import type { Recorrente, CriarRecorrente } from "../../types/Recorrente"
import type { Conta } from "../../types/Conta"
import type { Category } from "../../types/Category"
import { tokens } from "../../theme/tokens"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—"

const today = () => new Date().toISOString().slice(0, 10)

const freqBadgeColor: Record<number, { bg: string; color: string }> = {
  1: { bg: tokens.color.status.warning.light, color: tokens.color.status.warning.dark },
  2: { bg: "#ede9fe", color: "#7c3aed" },
  3: { bg: tokens.color.status.info.light, color: tokens.color.status.info.dark },
}

const emptyForm: CriarRecorrente = {
  descricao: "",
  valor: 0,
  tipo: 1,
  categoriaId: undefined,
  contaId: "",
  frequencia: 2,
  dia: 1,
  dataInicio: today(),
  dataFim: undefined,
}

export default function RecorrentesPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [recorrentes, setRecorrentes] = useState<Recorrente[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<CriarRecorrente>(emptyForm)
  const [erro, setErro] = useState("")

  const loadData = useCallback(async () => {
    try {
      const [r, c, cat] = await Promise.all([getRecorrentes(), getContas(), getCategories()])
      setRecorrentes(r)
      setContas(c)
      setCategorias(cat)
    } catch (error) {
      console.error("Erro ao carregar recorrentes:", error)
      notify({ open: true, message: "Erro ao carregar recorrentes", severity: "error" })
    }
  }, [notify])

  useEffect(() => { void loadData() }, [loadData])

  const openDialog = () => {
    setForm(emptyForm)
    setErro("")
    setDialogOpen(true)
  }

  const handleSalvar = async () => {
    setErro("")
    if (!form.descricao || !form.valor || !form.contaId) {
      setErro("Preencha todos os campos obrigatórios.")
      return
    }
    setLoading(true)
    try {
      await createRecorrente({
        ...form,
        valor: Number(form.valor),
        dataInicio: new Date(form.dataInicio).toISOString(),
        dataFim: form.dataFim ? new Date(form.dataFim).toISOString() : undefined,
        categoriaId: form.categoriaId || undefined,
      })
      setDialogOpen(false)
      await loadData()
      window.dispatchEvent(new Event("transactionCreated"))
    } catch {
      setErro("Erro ao criar assinatura.")
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (id: string) => {
    await toggleRecorrente(id)
    await loadData()
  }

  const handleDeletar = async (id: string) => {
    if (!confirm("Remover esta assinatura? As transações já geradas serão mantidas.")) return
    await deleteRecorrente(id)
    await loadData()
  }

  const totalMensal = recorrentes
    .filter(r => r.ativo && r.frequencia === 2)
    .reduce((sum, r) => sum + (r.tipo === 1 ? -r.valor : r.valor), 0)

  const ativos = recorrentes.filter(r => r.ativo).length

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography fontSize={22} fontWeight={700} color={tokens.color.text.primary}>Assinaturas</Typography>
          <Typography fontSize={13} color={tokens.color.text.secondary}>Assinaturas e pagamentos automáticos</Typography>
        </Box>
        <CustomButton variant="primary" size="small" startIcon={<AddIcon />} onClick={openDialog}>
          Nova Assinatura
        </CustomButton>
      </Box>

      {/* Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2.5, border: 1, borderColor: tokens.color.border.default, borderRadius: tokens.radius.lg }}>
          <Typography fontSize={12} color={tokens.color.text.secondary} mb={0.5}>Ativos</Typography>
          <Typography fontSize={26} fontWeight={800} color={tokens.color.text.primary}>{ativos}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2.5, border: 1, borderColor: tokens.color.border.default, borderRadius: tokens.radius.lg }}>
          <Typography fontSize={12} color={tokens.color.text.secondary} mb={0.5}>Impacto mensal</Typography>
          <Typography fontSize={22} fontWeight={800} color={totalMensal >= 0 ? tokens.color.status.success.dark : tokens.color.status.error.main}>
            {formatMoney(Math.abs(totalMensal))}
          </Typography>
          <Typography fontSize={11} color={tokens.color.text.secondary}>{totalMensal >= 0 ? "saldo positivo" : "saldo negativo"}</Typography>
        </Paper>
      </Box>

      {/* Lista */}
      <Paper elevation={0} sx={{ border: 1, borderColor: tokens.color.border.default, borderRadius: tokens.radius.lg, overflow: "hidden" }}>
        <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: tokens.color.border.default }}>
          <Typography fontSize={15} fontWeight={tokens.typography.fontWeight.bold} color={tokens.color.text.primary}>Suas Assinaturas</Typography>
        </Box>

        {recorrentes.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <RepeatIcon sx={{ fontSize: 40, color: tokens.color.text.disabled, mb: 1 }} />
            <Typography fontSize={14} color={tokens.color.text.secondary}>Nenhuma assinatura cadastrada</Typography>
            <Typography fontSize={13} color={tokens.color.text.secondary}>Cadastre assinaturas como Netflix, academia, etc.</Typography>
          </Box>
        ) : (
          recorrentes.map((r, i) => {
            const freq = freqBadgeColor[r.frequencia] ?? { bg: "#f3f4f6", color: "#6b7280" }
            const isDespesa = r.tipo === 1
            return (
              <Box
                key={r.id}
                sx={{
                  px: 3, py: 2,
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2,
                  borderBottom: i < recorrentes.length - 1 ? 1 : 0, borderColor: tokens.color.border.default,
                  opacity: r.ativo ? 1 : 0.5,
                  "&:hover": { bgcolor: tokens.color.background.hover }, transition: "background 0.15s",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: 0 }}>
                  <Box sx={{
                    width: 36, height: 36, borderRadius: tokens.radius.md, flexShrink: 0,
                    bgcolor: isDespesa ? tokens.color.status.error.light : tokens.color.status.success.light,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {isDespesa
                      ? <TrendingDownIcon sx={{ fontSize: 18, color: tokens.color.status.error.main }} />
                      : <TrendingUpIcon sx={{ fontSize: 18, color: tokens.color.status.success.main }} />
                    }
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={600} fontSize={14} noWrap>{r.descricao}</Typography>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.3, flexWrap: "wrap" }}>
                      <Chip
                        label={r.frequenciaDescricao}
                        size="small"
                        sx={{ fontSize: 11, height: 18, bgcolor: freq.bg, color: freq.color }}
                      />
                      {r.categoriaNome && (
                        <Chip label={r.categoriaNome} size="small" sx={{ fontSize: 11, height: 18, bgcolor: tokens.color.background.hover, color: tokens.color.text.primary }} />
                      )}
                      <Typography fontSize={12} color={tokens.color.text.secondary}>{r.contaNome}</Typography>
                      <Typography fontSize={12} color={tokens.color.text.secondary}>próxima: {formatDate(r.dataProximaGeracao)}</Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
                  <Typography
                    fontWeight={700} fontSize={15}
                    color={isDespesa ? tokens.color.status.error.main : tokens.color.status.success.main}
                  >
                    {isDespesa ? "-" : "+"}{formatMoney(r.valor)}
                  </Typography>
                  <Switch
                    size="small"
                    checked={r.ativo}
                    onChange={() => handleToggle(r.id)}
                    color="success"
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleDeletar(r.id)}
                    sx={{ color: tokens.color.text.secondary, "&:hover": { color: tokens.color.status.error.main } }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            )
          })
        )}
      </Paper>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, fontSize: 16 }}>Nova Assinatura</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>

          <TextField
            label="Descrição *"
            size="small"
            fullWidth
            value={form.descricao}
            onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
          />

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Tipo *</InputLabel>
              <Select
                value={form.tipo}
                label="Tipo *"
                onChange={(e) => setForm(f => ({ ...f, tipo: Number(e.target.value) }))}
              >
                <MuiMenuItem value={1}>Despesa</MuiMenuItem>
                <MuiMenuItem value={2}>Receita</MuiMenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Valor *"
              size="small"
              type="number"
              fullWidth
              value={form.valor || ""}
              onChange={(e) => setForm(f => ({ ...f, valor: Number(e.target.value) }))}
              inputProps={{ min: 0.01, step: "0.01" }}
            />
          </Box>

          <FormControl size="small" fullWidth>
            <InputLabel>Conta *</InputLabel>
            <Select
              value={form.contaId}
              label="Conta *"
              onChange={(e) => setForm(f => ({ ...f, contaId: e.target.value }))}
            >
              {contas.map(c => (
                <MuiMenuItem key={c.id} value={c.id}>{c.nome}</MuiMenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>Categoria</InputLabel>
            <Select
              value={form.categoriaId ?? ""}
              label="Categoria"
              onChange={(e) => setForm(f => ({ ...f, categoriaId: e.target.value || undefined }))}
            >
              <MuiMenuItem value="">Sem categoria</MuiMenuItem>
              {categorias.map(c => (
                <MuiMenuItem key={c.id} value={c.id}>{c.descricao}</MuiMenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Frequência *</InputLabel>
              <Select
                value={form.frequencia}
                label="Frequência *"
                onChange={(e) => setForm(f => ({ ...f, frequencia: Number(e.target.value) }))}
              >
                <MuiMenuItem value={1}>Semanal</MuiMenuItem>
                <MuiMenuItem value={2}>Mensal</MuiMenuItem>
                <MuiMenuItem value={3}>Anual</MuiMenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Dia do mês"
              size="small"
              type="number"
              fullWidth
              value={form.dia}
              onChange={(e) => setForm(f => ({ ...f, dia: Number(e.target.value) }))}
              inputProps={{ min: 1, max: 31 }}
              helperText="1 a 31"
            />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <TextField
              label="Início *"
              type="date"
              size="small"
              fullWidth
              value={form.dataInicio}
              onChange={(e) => setForm(f => ({ ...f, dataInicio: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Fim (opcional)"
              type="date"
              size="small"
              fullWidth
              value={form.dataFim ?? ""}
              onChange={(e) => setForm(f => ({ ...f, dataFim: e.target.value || undefined }))}
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          {erro && <Typography fontSize={13} color={tokens.color.status.error.main}>{erro}</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <CustomButton variant="secondary" size="small" onClick={() => setDialogOpen(false)}>Cancelar</CustomButton>
          <CustomButton variant="primary" size="small" onClick={handleSalvar} disabled={loading}>
            {loading ? "Salvando..." : "Criar Assinatura"}
          </CustomButton>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
