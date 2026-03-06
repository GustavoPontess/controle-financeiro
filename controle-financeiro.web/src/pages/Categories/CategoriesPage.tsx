import { useEffect, useState } from "react"
import { Box, Typography, Button, Paper } from "@mui/material"
import { useOutletContext } from "react-router-dom"

import type { Category } from "../../types/Category"

import { getCategories } from "../../services/categoryService"

import AddRoundedIcon from "@mui/icons-material/AddRounded"

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

  const { notify, refreshTransactionRequirements } =
    useOutletContext<OutletContextType>()

  const [categories, setCategories] = useState<Category[]>([])
  const [openDialog, setOpenDialog] = useState(false)

  const loadCategories = async () => {
    const data = await getCategories()
    setCategories(data)
  }

  useEffect(() => {

    const fetchCategories = async () => {
      const data = await getCategories()
      setCategories(data)
    }

    fetchCategories()

  }, [])

  return (

    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >

        <Box>

          <Typography variant="h5" fontWeight={600}>
            Categorias
          </Typography>

          <Typography color="text.secondary">
            Organize as categorias utilizadas nas transações
          </Typography>

        </Box>

        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => setOpenDialog(true)}
          sx={{
            backgroundColor: "#111827",
            borderRadius: "10px",
            "&:hover": { backgroundColor: "#1f2937" }
          }}
        >
          Adicionar Categoria
        </Button>

      </Box>

      <Paper
        elevation={0}
        sx={{
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          p: 3
        }}
      >

        <Typography fontWeight={600} mb={2}>
          Resumo Geral
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 3
          }}
        >

          <Box>
            <Typography color="text.secondary" fontSize={13}>
              Total de Categorias
            </Typography>

            <Typography fontWeight={600} fontSize={20}>
              {categories.length}
            </Typography>
          </Box>

          <Box>
            <Typography color="text.secondary" fontSize={13}>
              Categorias de Receita
            </Typography>

            <Typography fontWeight={600} fontSize={20}>
              {categories.filter(c => c.finalidade === 1).length}
            </Typography>
          </Box>

          <Box>
            <Typography color="text.secondary" fontSize={13}>
              Categorias de Despesa
            </Typography>

            <Typography fontWeight={600} fontSize={20}>
              {categories.filter(c => c.finalidade === 0).length}
            </Typography>
          </Box>

        </Box>

      </Paper>

      {categories.length === 0 ? (

        <EmptyState
          title="Nenhuma categoria cadastrada"
          description="Crie categorias para organizar suas receitas e despesas."
          actionLabel="Adicionar Categoria"
          onAction={() => setOpenDialog(true)}
        />

      ) : (

        <CategoriesTable
          categories={categories}
        />

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