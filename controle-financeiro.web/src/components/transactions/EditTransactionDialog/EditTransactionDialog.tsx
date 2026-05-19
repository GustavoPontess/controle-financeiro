import { useEffect, useState } from "react"
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Select, MenuItem, FormControl,
  InputLabel, IconButton, Divider, ToggleButtonGroup, ToggleButton,
} from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import EditOutlinedIcon from "@mui/icons-material/EditOutlined"
import TrendingDownIcon from "@mui/icons-material/TrendingDown"
import TrendingUpIcon from "@mui/icons-material/TrendingUp"
import CustomButton from "../../CustomButton"
import { getCategories } from "../../../services/categoryService"
import { updateTransaction } from "../../../services/transactionService"
import type { Category } from "../../../types/Category"
import { tokens } from "../../../theme/tokens"

export interface EditableTransaction {
  id: string
  descricao: string
  valor: number
  tipo: number
  categoriaId?: string
  contaId?: string
  cartaoCreditoId?: string
  meioPagamento?: number
  data: string
}

type Notification = { open: boolean; message: string; severity: "success" | "error" }

type Props = {
  transaction: EditableTransaction | null
  onClose: () => void
  onSaved: () => void
  notify: React.Dispatch<React.SetStateAction<Notification>>
}

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: tokens.radius.md,
    fontSize: tokens.typography.fontSize.sm,
    backgroundColor: tokens.color.background.surface,
    "& fieldset": { borderColor: tokens.color.border.default },
    "&:hover fieldset": { borderColor: tokens.color.border.strong },
    "&.Mui-focused fieldset": { borderColor: tokens.color.brand.primary },
  },
}

const MEIOS_PAGAMENTO = [
  { value: 4, label: "Pix" },
  { value: 2, label: "Débito" },
  { value: 3, label: "Crédito" },
  { value: 1, label: "Dinheiro" },
  { value: 5, label: "TED / DOC" },
  { value: 6, label: "Boleto" },
]

export default function EditTransactionDialog({ transaction, onClose, onSaved, notify }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    tipo: 1,
    meioPagamento: 4,
    categoriaId: "",
    valor: 0,
    data: "",
    descricao: "",
  })

  useEffect(() => {
    if (!transaction) return
    setForm({
      tipo: transaction.tipo,
      meioPagamento: transaction.meioPagamento ?? 4,
      categoriaId: transaction.categoriaId ?? "",
      valor: transaction.valor,
      data: transaction.data.split("T")[0],
      descricao: transaction.descricao,
    })
    getCategories().then(setCategories)
  }, [transaction])

  const filteredCategories = categories.filter((c) => {
    if (form.tipo === 1) return c.finalidade === 1 || c.finalidade === 3
    if (form.tipo === 2) return c.finalidade === 2 || c.finalidade === 3
    return true
  })

  const isDespesa = form.tipo === 1

  const handleSave = async () => {
    if (!transaction) return
    if (form.valor <= 0) {
      notify({ open: true, message: "O valor deve ser maior que zero", severity: "error" })
      return
    }
    setLoading(true)
    try {
      await updateTransaction(transaction.id, {
        descricao: form.descricao,
        valor: form.valor,
        tipo: form.tipo,
        categoriaId: form.categoriaId || null,
        contaId: transaction.contaId,
        cartaoCreditoId: transaction.cartaoCreditoId,
        meioPagamento: form.meioPagamento,
        data: form.data,
      })
      notify({ open: true, message: "Transação atualizada", severity: "success" })
      onSaved()
      onClose()
    } catch {
      notify({ open: true, message: "Erro ao atualizar transação", severity: "error" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={!!transaction}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: tokens.radius.xl,
          border: `1px solid ${tokens.color.border.subtle}`,
          boxShadow: tokens.shadow.lg,
        },
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 3, py: 2.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: tokens.radius.md,
              background: `linear-gradient(135deg, #6366f1, #4f46e5)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <EditOutlinedIcon sx={{ fontSize: 18 }} />
          </Box>
          <Typography
            fontWeight={tokens.typography.fontWeight.bold}
            fontSize={tokens.typography.fontSize.base}
            color={tokens.color.text.primary}
          >
            Editar Transação
          </Typography>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              ml: "auto",
              color: tokens.color.text.secondary,
              "&:hover": { bgcolor: tokens.color.background.secondary, color: tokens.color.text.primary },
            }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: tokens.color.border.subtle }} />
      </DialogTitle>

      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2.5, px: 3, py: 3 }}>

        {/* Tipo — toggle visual */}
        <ToggleButtonGroup
          value={form.tipo}
          exclusive
          fullWidth
          size="small"
          onChange={(_, val) => {
            if (val !== null) setForm((f) => ({ ...f, tipo: val, categoriaId: "" }))
          }}
          sx={{
            "& .MuiToggleButtonGroup-grouped": {
              border: `1px solid ${tokens.color.border.default} !important`,
              borderRadius: `${tokens.radius.md} !important`,
              mx: 0.25,
              fontWeight: tokens.typography.fontWeight.medium,
              fontSize: tokens.typography.fontSize.sm,
              textTransform: "none",
              transition: tokens.transition.fast,
              color: tokens.color.text.secondary,
            },
            "& .MuiToggleButton-root.Mui-selected": {
              backgroundColor: isDespesa
                ? tokens.color.status.error.light
                : tokens.color.status.success.light,
              color: isDespesa
                ? tokens.color.status.error.dark
                : tokens.color.status.success.dark,
              borderColor: isDespesa
                ? `${tokens.color.status.error.main} !important`
                : `${tokens.color.status.success.main} !important`,
              "&:hover": {
                backgroundColor: isDespesa
                  ? tokens.color.status.error.light
                  : tokens.color.status.success.light,
              },
            },
          }}
        >
          <ToggleButton value={1} sx={{ gap: 0.75, py: 1 }}>
            <TrendingDownIcon sx={{ fontSize: 16 }} />
            Despesa
          </ToggleButton>
          <ToggleButton value={2} sx={{ gap: 0.75, py: 1 }}>
            <TrendingUpIcon sx={{ fontSize: 16 }} />
            Receita
          </ToggleButton>
        </ToggleButtonGroup>

        <FormControl size="small" fullWidth>
          <InputLabel>Meio de Pagamento</InputLabel>
          <Select
            value={form.meioPagamento}
            label="Meio de Pagamento"
            sx={{ borderRadius: tokens.radius.md, fontSize: tokens.typography.fontSize.sm }}
            onChange={(e) => setForm((f) => ({ ...f, meioPagamento: Number(e.target.value) }))}
          >
            {MEIOS_PAGAMENTO.map((m) => (
              <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel>Categoria</InputLabel>
          <Select
            value={form.categoriaId}
            label="Categoria"
            sx={{ borderRadius: tokens.radius.md, fontSize: tokens.typography.fontSize.sm }}
            onChange={(e) => setForm((f) => ({ ...f, categoriaId: e.target.value }))}
          >
            <MenuItem value="">Sem categoria</MenuItem>
            {filteredCategories.map((c) => (
              <MenuItem key={c.id} value={c.id}>{c.descricao}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Valor"
          size="small"
          fullWidth
          type="number"
          value={form.valor}
          onChange={(e) => setForm((f) => ({ ...f, valor: Number(e.target.value) }))}
          inputProps={{ step: "0.01", min: "0.01" }}
          sx={fieldSx}
        />

        <TextField
          label="Data"
          size="small"
          fullWidth
          type="date"
          value={form.data}
          onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
          InputLabelProps={{ shrink: true }}
          sx={fieldSx}
        />

        <TextField
          label="Descrição"
          size="small"
          fullWidth
          multiline
          minRows={2}
          value={form.descricao}
          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          inputProps={{ maxLength: 400 }}
          sx={fieldSx}
        />
      </DialogContent>

      <Divider sx={{ borderColor: tokens.color.border.subtle }} />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <CustomButton variant="secondary" size="small" onClick={onClose}>Cancelar</CustomButton>
        <CustomButton variant="primary" size="small" onClick={handleSave} disabled={loading}>
          {loading ? "Salvando..." : "Salvar"}
        </CustomButton>
      </DialogActions>
    </Dialog>
  )
}
