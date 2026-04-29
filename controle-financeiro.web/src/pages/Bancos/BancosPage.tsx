import { useEffect, useState } from "react"
import { Box, Typography, Paper, IconButton, Chip } from "@mui/material"
import { useOutletContext } from "react-router-dom"
import AddRoundedIcon from "@mui/icons-material/AddRounded"
import EditIcon from "@mui/icons-material/Edit"
import DeleteIcon from "@mui/icons-material/Delete"
import CustomButton from "../../components/CustomButton"
import NewContaDialog from "../../components/Contas/NewContaDialog/NewContaDialog"
import EmptyState from "../../components/EmptyState/EmptyState"
import { getBancos } from "../../services/bancoService"
import { getContas, deleteConta } from "../../services/contaService"
import { getTransactions } from "../../services/transactionService"
import type { Banco } from "../../types/Banco"
import type { Conta } from "../../types/Conta"
import type { Transaction } from "../../types/Transaction"

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

const getTransactionCountForMonth = (transactions: Transaction[], contaId: string | undefined) => {
  if (!contaId) return 0
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  return transactions.filter(t => {
    if (t.contaId !== contaId) return false
    const date = new Date(t.data)
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear
  }).length
}

export default function BancosPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [bancos, setBancos] = useState<Banco[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const [openContaDialog, setOpenContaDialog] = useState(false)
  const [editingConta, setEditingConta] = useState<Conta | null>(null)

  const loadData = async () => {
    const [bs, cs, ts] = await Promise.all([getBancos(), getContas(), getTransactions()])
    setBancos(bs)
    const filtered = cs.filter(c => c.tipo !== 3) // Exclude CartaoCredito (type 3)
    setContas(filtered)
    setTransactions(ts)
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

  const contasSemBanco = contas.filter(c => !c.bancoId)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography fontSize={18} fontWeight={700} color="#111827">Bancos e Contas</Typography>
          <CustomButton size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />} onClick={() => { setEditingConta(null); setOpenContaDialog(true) }}>
            Adicionar Conta
          </CustomButton>
        </Box>
        <Typography fontSize={13} color="#6b7280">Selecione seu banco e adicione suas contas para gerenciar saldos</Typography>
      </Box>

      {/* Summary Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          <Typography fontSize={12} color="#6b7280" fontWeight={500} mb={0.5}>Total de Bancos</Typography>
          <Typography fontSize={24} fontWeight={700} color="#111827">{bancos.length}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          <Typography fontSize={12} color="#6b7280" fontWeight={500} mb={0.5}>Saldo Total</Typography>
          <Typography fontSize={24} fontWeight={700} color="#15803d">{formatMoney(contas.reduce((sum, c) => sum + (c.saldoInicial ?? 0), 0))}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          <Typography fontSize={12} color="#6b7280" fontWeight={500} mb={0.5}>Transações Totais</Typography>
          <Typography fontSize={24} fontWeight={700} color="#111827">{transactions.filter(t => contas.find(c => c.id === t.contaId)).length}</Typography>
        </Paper>
      </Box>

      {bancos.length === 0 && contas.length === 0 ? (
        <EmptyState
          title="Nenhuma conta cadastrada"
          description="Adicione sua primeira conta vinculada a um banco para começar a gerenciar suas finanças."
          actionLabel="Adicionar Conta"
          onAction={() => { setEditingConta(null); setOpenContaDialog(true) }}
        />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Bancos com suas contas */}
          {bancos.map(banco => {
            const contasDoBanco = contas.filter(c => c.bancoId === banco.id)
            return (
              <Paper key={banco.id} elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
                {/* Banco header */}
                <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fafafa", borderBottom: contasDoBanco.length > 0 ? "1px solid #f1f5f9" : "none" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        backgroundColor: banco.cor || "#dbeafe",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      {banco.nomeFantasia.charAt(0).toUpperCase()}
                    </Box>
                    <Box>
                      <Typography fontSize={14} fontWeight={600} color="#111827">{banco.nomeFantasia}</Typography>
                      <Typography fontSize={12} color="#9ca3af">{banco.tipoDescricao}</Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  </Box>
                </Box>

                {/* Contas do banco */}
                {contasDoBanco.length === 0 ? (
                  <Box sx={{ px: 3, py: 2, color: "#9ca3af", fontSize: 13 }}>
                    Nenhuma conta vinculada a este banco.
                  </Box>
                ) : (
                  contasDoBanco.map((conta, i) => {
                    const colors = tipoContaColor[conta.tipo] ?? { bg: "#f3f4f6", color: "#374151" }
                    const transactionCount = getTransactionCountForMonth(transactions, conta.id)
                    return (
                      <Box
                        key={conta.id}
                        sx={{
                          px: 3, py: 1.5,
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          borderBottom: i < contasDoBanco.length - 1 ? "1px solid #f9fafb" : "none",
                          "&:hover": { backgroundColor: "#fafafa" },
                        }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <Chip label={conta.tipoDescricao} size="small" sx={{ fontSize: 11, height: 22, borderRadius: "6px", backgroundColor: colors.bg, color: colors.color, fontWeight: 500 }} />
                          <Typography fontSize={13} fontWeight={500} color="#111827">{conta.nome}</Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                          <Typography fontSize={13} color="#6b7280">{formatMoney(conta.saldoInicial ?? 0)}</Typography>
                          <Typography fontSize={12} color="#9ca3af">{transactionCount} transações</Typography>
                          <IconButton size="small" onClick={() => { setEditingConta(conta); setOpenContaDialog(true) }} sx={{ color: "#6b7280" }}>
                            <EditIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteConta(conta.id)} sx={{ color: "#ef4444" }}>
                            <DeleteIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    )
                  })
                )}
              </Paper>
            )
          })}

          {/* Contas sem banco */}
          {contasSemBanco.length > 0 && (
            <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
              <Box sx={{ px: 3, py: 2, backgroundColor: "#fafafa", borderBottom: "1px solid #f1f5f9" }}>
                <Typography fontSize={13} fontWeight={600} color="#6b7280">Sem banco vinculado</Typography>
              </Box>
              {contasSemBanco.map((conta, i) => {
                const colors = tipoContaColor[conta.tipo] ?? { bg: "#f3f4f6", color: "#374151" }
                const transactionCount = getTransactionCountForMonth(transactions, conta.id)
                return (
                  <Box
                    key={conta.id}
                    sx={{
                      px: 3, py: 1.5,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      borderBottom: i < contasSemBanco.length - 1 ? "1px solid #f9fafb" : "none",
                      "&:hover": { backgroundColor: "#fafafa" },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Chip label={conta.tipoDescricao} size="small" sx={{ fontSize: 11, height: 22, borderRadius: "6px", backgroundColor: colors.bg, color: colors.color, fontWeight: 500 }} />
                      <Typography fontSize={13} fontWeight={500} color="#111827">{conta.nome}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Typography fontSize={13} color="#6b7280">{formatMoney(conta.saldoInicial ?? 0)}</Typography>
                      <Typography fontSize={12} color="#9ca3af">{transactionCount} transações</Typography>
                      <IconButton size="small" onClick={() => { setEditingConta(conta); setOpenContaDialog(true) }} sx={{ color: "#6b7280" }}>
                        <EditIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteConta(conta.id)} sx={{ color: "#ef4444" }}>
                        <DeleteIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Box>
                  </Box>
                )
              })}
            </Paper>
          )}
        </Box>
      )}

      <NewContaDialog
        open={openContaDialog}
        editingConta={editingConta}
        bancos={bancos}
        onClose={() => { setOpenContaDialog(false); setEditingConta(null) }}
        onSaved={loadData}
        notify={notify}
      />
    </Box>
  )
}
