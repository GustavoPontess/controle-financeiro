import { useEffect, useState } from "react"

import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box
} from "@mui/material"

import CloseIcon from "@mui/icons-material/Close"

import TransactionForm from "../TransactionForm/TransactionForm"

import { getCategories } from "../../../services/categoryService"
import { createTransaction } from "../../../services/transactionService"
import { getContas } from "../../../services/contaService"
import { getCartoes } from "../../../services/cartaoCreditoService"

import type { Category } from "../../../types/Category"
import type { Conta } from "../../../types/Conta"
import type { CartaoCredito } from "../../../types/CartaoCredito"
import type { TransactionFormData } from "../TransactionForm/TransactionForm"

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
    const loadData = async () => {
      const [cats, cts, carts] = await Promise.all([getCategories(), getContas(), getCartoes()])
      setCategories(cats)
      setContas(cts)
      setCartoes(carts)
    }
    if (open) loadData()
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

    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>

      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 3,
            py: 2,
            fontWeight: 600,
            fontSize: 16
          }}
        >
          Nova Transação
          <IconButton
            onClick={onClose}
            sx={{
              width: 24,
              height: 24,
              color: "text.secondary",
              "&:hover": { bgcolor: "action.hover", color: "text.primary" }
            }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
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
