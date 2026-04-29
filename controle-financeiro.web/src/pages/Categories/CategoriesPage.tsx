import { useEffect, useState } from "react"
import { Box, Typography } from "@mui/material"
import { useOutletContext } from "react-router-dom"
import type { Category } from "../../types/Category"
import { getCategories } from "../../services/categoryService"
import AddRoundedIcon from "@mui/icons-material/AddRounded"
import CustomButton from "../../components/CustomButton"
import CategoriesTable from "../../components/Categories/CategoriesTable/CategoriesTable"
import NewCategoryDialog from "../../components/Categories/NewCategoryDialog/NewCategoryDialog"
import EmptyState from "../../components/EmptyState/EmptyState"

type Notification = {
  open: boolean
  message: string
  severity: "success" | "error"
}

type OutletContextType = {
  notify: React.Dispatch<React.SetStateAction<Notification>>
  refreshTransactionRequirements: () => Promise<void>
}

export default function CategoriesPage() {
  const { notify, refreshTransactionRequirements } = useOutletContext<OutletContextType>()
  const [categories, setCategories] = useState<Category[]>([])
  const [openDialog, setOpenDialog] = useState(false)

  const loadCategories = async () => {
    const data = await getCategories()
    setCategories(data)
  }

  useEffect(() => {
    (async () => {
      await loadCategories()
    })()
  }, [])

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography fontSize={14} fontWeight={600} color="#111827">
          Categorias
        </Typography>
        <CustomButton
          size="small"
          startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />}
          onClick={() => setOpenDialog(true)}
        >
          Adicionar Categoria
        </CustomButton>
      </Box>

      {categories.length === 0 ? (
        <EmptyState
          title="Nenhuma categoria cadastrada"
          description="Crie categorias para organizar suas receitas e despesas."
          actionLabel="Adicionar Categoria"
          onAction={() => setOpenDialog(true)}
        />
      ) : (
        <CategoriesTable categories={categories} />
      )}

      <NewCategoryDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onCreated={async () => {
          await loadCategories()
          await refreshTransactionRequirements()
        }}
        notify={notify}
      />
    </Box>
  )
}
