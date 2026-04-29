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

    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>

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

          Nova Categoria

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

        <CategoryForm
          onSubmit={handleCreate}
        />

      </DialogContent>

    </Dialog>

  )

}