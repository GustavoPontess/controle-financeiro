import { Dialog, DialogTitle, DialogContent, IconButton, Box } from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"

import CategoryForm from "../CategoryForm/CategoryForm"

import { createCategory } from "../../../services/categoryService"

import type { Category } from "../../../types/Category"

type Notification = {
  open: boolean
  message: string
  severity: "success" | "error"
}

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
  notify: React.Dispatch<React.SetStateAction<Notification>>
}

export default function NewCategoryDialog({
  open,
  onClose,
  onCreated,
  notify
}: Props) {

  const handleCreate = async (category: Omit<Category, "id">) => {

    try {

      await createCategory(category)

      notify({
        open: true,
        message: "Categoria criada com sucesso",
        severity: "success"
      })

      await onCreated()

      onClose()

    } catch (error) {

      console.error(error)

      notify({
        open: true,
        message: "Erro ao criar categoria",
        severity: "error"
      })

    }

  }

  return (

    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>

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

          Nova Categoria

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

        <CategoryForm
          onSubmit={handleCreate}
        />

      </DialogContent>

    </Dialog>

  )

}