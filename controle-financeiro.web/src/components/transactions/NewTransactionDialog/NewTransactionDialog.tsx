import { useEffect, useState } from "react"
import { Dialog, DialogTitle, DialogContent, IconButton, Box, Typography, Divider } from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline"
import TransactionForm from "../TransactionForm/TransactionForm"
import { getCategories } from "../../../services/categoryService"
import { createTransaction } from "../../../services/transactionService"
import { getContas } from "../../../services/contaService"
import { getCartoes } from "../../../services/cartaoCreditoService"
import type { Category } from "../../../types/Category"
import type { Conta } from "../../../types/Conta"
import type { CartaoCredito } from "../../../types/CartaoCredito"
import type { TransactionFormData } from "../TransactionForm/TransactionForm"
import { tokens } from "../../../theme/tokens"

type Notification = {
  open: boolean
  message: string
  severity: "success" | "error"
}

type Props = {
  open: boolean
  onClose: () => void
  notify: React.Dispatch<React.SetStateAction<Notification>>
}

export default function NewTransactionDialog({ open, onClose, notify }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])

  useEffect(() => {
    if (!open) return
    Promise.all([getCategories(), getContas(), getCartoes()]).then(([cats, cts, carts]) => {
      setCategories(cats)
      setContas(cts)
      setCartoes(carts)
    })
  }, [open])

  const handleCreate = async (data: TransactionFormData) => {
    try {
      const isCredito = data.meioPagamento === 3
      await createTransaction({
        descricao: data.descricao,
        valor: Number(data.valor),
        tipo: data.tipo,
        categoriaId: data.categoriaId || null,
        contaId: isCredito ? undefined : data.contaId || undefined,
        cartaoCreditoId: isCredito ? data.cartaoCreditoId || undefined : undefined,
        usadoComoCredito: isCredito,
        meioPagamento: data.meioPagamento,
        parcelas: isCredito && data.parcelas > 1 ? data.parcelas : undefined,
        data: data.data,
      })
      notify({ open: true, message: "Transação criada com sucesso", severity: "success" })
      window.dispatchEvent(new Event("transactionCreated"))
      onClose()
    } catch {
      notify({ open: true, message: "Erro ao criar transação", severity: "error" })
    }
  }

  return (
    <Dialog
      open={open}
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
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 3,
            py: 2.5,
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: tokens.radius.md,
              background: `linear-gradient(135deg, ${tokens.color.brand.primary}, ${tokens.color.brand.hover})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <AddCircleOutlineIcon sx={{ fontSize: 18 }} />
          </Box>
          <Typography
            fontWeight={tokens.typography.fontWeight.bold}
            fontSize={tokens.typography.fontSize.base}
            color={tokens.color.text.primary}
          >
            Nova Transação
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
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

      <DialogContent sx={{ px: 3, py: 3 }}>
        <TransactionForm
          categories={categories}
          contas={contas}
          cartoes={cartoes}
          onSubmit={handleCreate}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  )
}
