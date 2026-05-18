import { useEffect, useState } from "react"
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, Select, MenuItem, FormControl, InputLabel, IconButton,
} from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import CustomButton from "../../CustomButton"
import { getCategories } from "../../../services/categoryService"
import { updateTransaction } from "../../../services/transactionService"
import type { Category } from "../../../types/Category"

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

const inputSx = {
  "& .MuiOutlinedInput-root": {
    backgroundColor: "background.paper", borderRadius: "8px", fontSize: "14px",
  },
}

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

  const filteredCategories = categories.filter(c => {
    if (form.tipo === 1) return c.finalidade === 1 || c.finalidade === 3
    if (form.tipo === 2) return c.finalidade === 2 || c.finalidade === 3
    return true
  })

  const handleSave = async () => {
    if (!transaction) return
    if (form.valor <= 0) { notify({ open: true, message: "O valor deve ser maior que zero", severity: "error" }); return }
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
    <Dialog open={!!transaction} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 2 }}>
          <Typography fontSize={16} fontWeight={600}>Editar Transação</Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
        <FormControl size="small" fullWidth>
          <InputLabel>Tipo</InputLabel>
          <Select value={form.tipo} label="Tipo"
            onChange={(e) => setForm(f => ({ ...f, tipo: Number(e.target.value), categoriaId: "" }))}>
            <MenuItem value={1}>Despesa</MenuItem>
            <MenuItem value={2}>Receita</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel>Meio de Pagamento</InputLabel>
          <Select value={form.meioPagamento} label="Meio de Pagamento"
            onChange={(e) => setForm(f => ({ ...f, meioPagamento: Number(e.target.value) }))}>
            <MenuItem value={4}>Pix</MenuItem>
            <MenuItem value={2}>Débito</MenuItem>
            <MenuItem value={3}>Crédito</MenuItem>
            <MenuItem value={1}>Dinheiro</MenuItem>
            <MenuItem value={5}>TED / DOC</MenuItem>
            <MenuItem value={6}>Boleto</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel>Categoria</InputLabel>
          <Select value={form.categoriaId} label="Categoria"
            onChange={(e) => setForm(f => ({ ...f, categoriaId: e.target.value }))}>
            <MenuItem value="">Sem categoria</MenuItem>
            {filteredCategories.map(c => <MenuItem key={c.id} value={c.id}>{c.descricao}</MenuItem>)}
          </Select>
        </FormControl>

        <TextField label="Valor" size="small" fullWidth type="number"
          value={form.valor}
          onChange={(e) => setForm(f => ({ ...f, valor: Number(e.target.value) }))}
          inputProps={{ step: "0.01", min: "0.01" }}
          sx={inputSx} />

        <TextField label="Data" size="small" fullWidth type="date"
          value={form.data}
          onChange={(e) => setForm(f => ({ ...f, data: e.target.value }))}
          InputLabelProps={{ shrink: true }}
          sx={inputSx} />

        <TextField label="Descrição" size="small" fullWidth multiline minRows={2}
          value={form.descricao}
          onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
          inputProps={{ maxLength: 400 }}
          sx={inputSx} />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <CustomButton variant="secondary" size="small" onClick={onClose}>Cancelar</CustomButton>
        <CustomButton variant="primary" size="small" onClick={handleSave} disabled={loading}>
          {loading ? "Salvando..." : "Salvar"}
        </CustomButton>
      </DialogActions>
    </Dialog>
  )
}
