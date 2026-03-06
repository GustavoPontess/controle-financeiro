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

import { getPeople } from "../../../services/personService"
import { getCategories } from "../../../services/categoryService"
import { createTransaction } from "../../../services/transactionService"

import type { Person } from "../../../types/Person"
import type { Category } from "../../../types/Category"

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

  const [people, setPeople] = useState<Person[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {

    const loadData = async () => {

      const persons = await getPeople()
      const cats = await getCategories()

      setPeople(persons)
      setCategories(cats)

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
    const pessoaId = formData.get("pessoaId") as string

    if (valor <= 0) {

      notify({
        open: true,
        message: "O valor deve ser maior que zero",
        severity: "error"
      })

      return
    }

    try {

      await createTransaction({
        descricao,
        valor,
        tipo,
        categoriaId,
        pessoaId
      })
      

      notify({
        open: true,
        message: "Transação criada com sucesso",
        severity: "success"
      })

      window.dispatchEvent(new Event("transactionCreated"))

      form.reset()

      onClose()

    } catch {

      notify({
        open: true,
        message: "Erro ao criar transação",
        severity: "error"
      })

    }

  }

  return (

    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>

      <DialogTitle sx={{ p: 0 }}>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 3,
            py: 2,
            borderBottom: "1px solid #f1f5f9",
            fontWeight: 600,
            fontSize: 16
          }}
        >

          Nova Transação

          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              color: "#6b7280",
              "&:hover": {
                backgroundColor: "#f3f4f6"
              }
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>

        </Box>

      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>

        <TransactionForm
          people={people}
          categories={categories}
          onCreate={handleCreate}
          onCancel={onClose}
        />

      </DialogContent>

    </Dialog>

  )

}