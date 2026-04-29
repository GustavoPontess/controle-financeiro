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

import type { Category } from "../../../types/Category"
import type { Conta } from "../../../types/Conta"

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

  useEffect(() => {

    const loadData = async () => {
      const [cats, cts] = await Promise.all([getCategories(), getContas()])
      setCategories(cats)
      setContas(cts)
    }

    if (open) loadData()

  }, [open])

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {

    e.preventDefault()

    const form = e.currentTarget
    const formData = new FormData(form)

    const descricao = formData.get("descricao") as string
    const valor = Number(formData.get("valor"))
    const tipo = Number(formData.get("tipo"))
    const categoriaId = formData.get("categoriaId") as string
    const contaId = formData.get("contaId") as string
    const data = formData.get("data") as string

    if (valor <= 0) {
      notify({ open: true, message: "O valor deve ser maior que zero", severity: "error" })
      return
    }

    try {

      await createTransaction({ descricao, valor, tipo, categoriaId, contaId, data })

      notify({ open: true, message: "Transação criada com sucesso", severity: "success" })

      window.dispatchEvent(new Event("transactionCreated"))

      form.reset()
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
              color: "#9ca3af",
              "&:hover": { backgroundColor: "#f3f4f6", color: "#374151" }
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
          onCreate={handleCreate}
          onCancel={onClose}
        />
      </DialogContent>

    </Dialog>

  )

}
