import { useEffect, useState } from "react"
import { Box, Typography, Chip, IconButton, Paper } from "@mui/material"
import { useOutletContext } from "react-router-dom"
import AddRoundedIcon from "@mui/icons-material/AddRounded"
import EditIcon from "@mui/icons-material/Edit"
import DeleteIcon from "@mui/icons-material/Delete"
import CustomButton from "../../components/CustomButton"
import NewContaDialog from "../../components/Contas/NewContaDialog/NewContaDialog"
import EmptyState from "../../components/EmptyState/EmptyState"
import { getContas, deleteConta } from "../../services/contaService"
import type { Conta } from "../../types/Conta"

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const tipoContaColor: Record<number, { bg: string; color: string }> = {
  1: { bg: "#dbeafe", color: "#1d4ed8" },
  2: { bg: "#dcfce7", color: "#15803d" },
  3: { bg: "#ede9fe", color: "#7c3aed" },
  4: { bg: "#ccfbf1", color: "#0f766e" },
  5: { bg: "#ffedd5", color: "#c2410c" },
}

type Notification = {
  open: boolean
  message: string
  severity: "success" | "error"
}

type OutletContextType = {
  notify: React.Dispatch<React.SetStateAction<Notification>>
}

export default function AccountsPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [contas, setContas] = useState<Conta[]>([])

  const [openContaDialog, setOpenContaDialog] = useState(false)
  const [editingConta, setEditingConta] = useState<Conta | null>(null)

  const loadData = async () => {
    const cs = await getContas()
    setContas(cs)
  }

  useEffect(() => {
    (async () => {
      await loadData()
    })()
  }, [])

  const handleDeleteConta = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta conta?")) return
    try {
      await deleteConta(id)
      notify({ open: true, message: "Conta removida com sucesso", severity: "success" })
      await loadData()
    } catch {
      notify({ open: true, message: "Erro ao remover conta", severity: "error" })
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography fontSize={14} fontWeight={600} color="#111827">Contas</Typography>
        <CustomButton size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />} onClick={() => { setEditingConta(null); setOpenContaDialog(true) }}>
          Nova Conta
        </CustomButton>
      </Box>

      {contas.length === 0 ? (
        <EmptyState
          title="Nenhuma conta cadastrada"
          description="Adicione uma conta para começar a organizar suas finanças."
          actionLabel="Nova Conta"
          onAction={() => { setEditingConta(null); setOpenContaDialog(true) }}
        />
      ) : (
        <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
          {contas.map((conta, i) => {
            const colors = tipoContaColor[conta.tipo] ?? { bg: "#f3f4f6", color: "#374151" }
            return (
              <Box
                key={conta.id}
                sx={{
                  px: 3, py: 1.5,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  borderBottom: i < contas.length - 1 ? "1px solid #f9fafb" : "none",
                  "&:hover": { backgroundColor: "#fafafa" },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Chip label={conta.tipoDescricao} size="small" sx={{ fontSize: 11, height: 22, borderRadius: "6px", backgroundColor: colors.bg, color: colors.color, fontWeight: 500 }} />
                  <Typography fontSize={13} fontWeight={500} color="#111827">{conta.nome}</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Typography fontSize={13} color="#6b7280">{formatMoney(conta.saldoInicial)}</Typography>
                  {!conta.isCarteira && (
                    <>
                      <IconButton size="small" onClick={() => { setEditingConta(conta); setOpenContaDialog(true) }} sx={{ color: "#6b7280" }}>
                        <EditIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteConta(conta.id)} sx={{ color: "#ef4444" }}>
                        <DeleteIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </>
                  )}
                </Box>
              </Box>
            )
          })}
        </Paper>
      )}

      <NewContaDialog
        open={openContaDialog}
        editingConta={editingConta}
        bancos={[]}
        onClose={() => { setOpenContaDialog(false); setEditingConta(null) }}
        onSaved={loadData}
        notify={notify}
      />
    </Box>
  )
}
