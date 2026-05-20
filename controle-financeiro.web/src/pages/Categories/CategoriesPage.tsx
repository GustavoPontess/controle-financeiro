import { useEffect, useState } from "react"
import { Box, Typography, Chip, IconButton, Paper } from "@mui/material"
import { useOutletContext } from "react-router-dom"
import AddRoundedIcon from "@mui/icons-material/AddRounded"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import LockOutlinedIcon from "@mui/icons-material/LockOutlined"
import type { Category } from "../../types/Category"
import { getCategories, deleteCategory } from "../../services/categoryService"
import CustomButton from "../../components/CustomButton"
import NewCategoryDialog from "../../components/Categories/NewCategoryDialog/NewCategoryDialog"
import { tokens } from "../../theme/tokens"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = {
  notify: React.Dispatch<React.SetStateAction<Notification>>
  refreshTransactionRequirements: () => Promise<void>
}

const FINALIDADE_LABEL: Record<number, { label: string; bg: string; color: string }> = {
  1: { label: "Despesa", bg: tokens.color.status.error.light, color: tokens.color.status.error.main },
  2: { label: "Receita", bg: tokens.color.status.success.light, color: tokens.color.status.success.main },
  3: { label: "Ambas",   bg: tokens.color.background.tertiary, color: "text.secondary" },
}

function CategoryRow({ cat, onDelete }: { cat: Category; onDelete?: () => void }) {
  const fin = FINALIDADE_LABEL[cat.finalidade] ?? FINALIDADE_LABEL[3]
  return (
    <Box sx={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider",
      "&:last-child": { borderBottom: 0 },
      "&:hover": { bgcolor: tokens.color.background.hover },
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Typography fontSize={13} fontWeight={tokens.typography.fontWeight.medium} color="text.primary">{cat.descricao}</Typography>
        <Chip label={fin.label} size="small" sx={{ fontSize: 11, height: 18, bgcolor: fin.bg, color: fin.color }} />
      </Box>
      {cat.isPadrao ? (
        <LockOutlinedIcon sx={{ fontSize: 15, color: "text.disabled" }} titleAccess="Categoria padrão" />
      ) : (
        <IconButton size="small" onClick={onDelete} sx={{ color: "text.secondary", "&:hover": { color: tokens.color.status.error.main } }}>
          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Box>
  )
}

export default function CategoriesPage() {
  const { notify, refreshTransactionRequirements } = useOutletContext<OutletContextType>()
  const [categories, setCategories] = useState<Category[]>([])
  const [openDialog, setOpenDialog] = useState(false)

  const load = async () => {
    const data = await getCategories()
    setCategories(data)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Remover "${cat.descricao}"? Transações vinculadas ficarão sem categoria.`)) return
    try {
      await deleteCategory(cat.id)
      notify({ open: true, message: "Categoria removida", severity: "success" })
      await load()
      await refreshTransactionRequirements()
    } catch {
      notify({ open: true, message: "Erro ao remover categoria", severity: "error" })
    }
  }

  const padrao   = categories.filter(c => c.isPadrao)
  const pessoais = categories.filter(c => !c.isPadrao)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography fontSize={22} fontWeight={700} color="text.primary">Categorias</Typography>
          <Typography fontSize={13} color="text.secondary">Organize suas receitas e despesas</Typography>
        </Box>
        <CustomButton size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />} onClick={() => setOpenDialog(true)}>
          Nova Categoria
        </CustomButton>
      </Box>

      {/* Minhas categorias */}
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: tokens.radius.lg, overflow: "hidden" }}>
        <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography fontSize={15} fontWeight={tokens.typography.fontWeight.bold} color="text.primary">Minhas Categorias</Typography>
            <Typography fontSize={12} color="text.secondary">Criadas por você — podem ser removidas</Typography>
          </Box>
          <Chip label={pessoais.length} size="small" sx={{ fontWeight: tokens.typography.fontWeight.bold, bgcolor: tokens.color.background.hover, color: "text.primary" }} />
        </Box>

        {pessoais.length === 0 ? (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <Typography fontSize={13} color="text.secondary">Você ainda não criou nenhuma categoria pessoal</Typography>
            <Typography fontSize={12} color="text.secondary" mt={0.5}>Clique em "Nova Categoria" para adicionar</Typography>
          </Box>
        ) : (
          pessoais.map(cat => <CategoryRow key={cat.id} cat={cat} onDelete={() => handleDelete(cat)} />)
        )}
      </Paper>

      {/* Padrão */}
      <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: tokens.radius.lg, overflow: "hidden" }}>
        <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography fontSize={15} fontWeight={tokens.typography.fontWeight.bold} color="text.primary">Categorias Padrão</Typography>
            <Typography fontSize={12} color="text.secondary">Disponíveis para todos — não podem ser removidas</Typography>
          </Box>
          <Chip label={padrao.length} size="small" sx={{ fontWeight: tokens.typography.fontWeight.bold, bgcolor: tokens.color.background.hover, color: "text.primary" }} />
        </Box>

        {padrao.map(cat => <CategoryRow key={cat.id} cat={cat} />)}
      </Paper>

      <NewCategoryDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onCreated={async () => {
          await load()
          await refreshTransactionRequirements()
        }}
        notify={notify}
      />
    </Box>
  )
}
