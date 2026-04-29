import { useEffect, useState } from "react"
import { Box, Typography, Paper, IconButton, Chip } from "@mui/material"
import { useOutletContext } from "react-router-dom"
import AddRoundedIcon from "@mui/icons-material/AddRounded"
import EditIcon from "@mui/icons-material/Edit"
import DeleteIcon from "@mui/icons-material/Delete"
import CreditCardIcon from "@mui/icons-material/CreditCard"
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

export default function CreditCardsPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [bancos, setBancos] = useState<Banco[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const [openContaDialog, setOpenContaDialog] = useState(false)
  const [editingConta, setEditingConta] = useState<Conta | null>(null)

  const loadData = async () => {
    const [bs, cs, ts] = await Promise.all([getBancos(), getContas(), getTransactions()])
    setBancos(bs)
    const filtered = cs.filter(c => c.tipo === 3) // Only CartaoCredito (type 3)
    setContas(filtered)
    setTransactions(ts)
  }

  useEffect(() => {
    (async () => {
      await loadData()
    })()
  }, [])

  const handleDeleteConta = async (id: string) => {
    if (!confirm("Deseja realmente excluir este cartão?")) return
    try {
      await deleteConta(id)
      notify({ open: true, message: "Cartão removido com sucesso", severity: "success" })
      await loadData()
    } catch {
      notify({ open: true, message: "Erro ao remover cartão", severity: "error" })
    }
  }

  // Calculate summary statistics
  const totalSaldo = contas.reduce((sum, c) => sum + (c.saldoInicial ?? 0), 0)
  const totalTransacoes = transactions.filter(t => {
    const conta = contas.find(c => c.id === t.contaId)
    return conta !== undefined
  }).length
  const totalCartoes = contas.length

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography fontSize={18} fontWeight={700} color="#111827">Cartões de Crédito</Typography>
          <CustomButton size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />} onClick={() => { setEditingConta(null); setOpenContaDialog(true) }}>
            Adicionar Cartão
          </CustomButton>
        </Box>
        <Typography fontSize={13} color="#6b7280">Gerencie seus cartões de crédito e acompanhe os gastos</Typography>
      </Box>

      {/* Summary Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
        <Paper elevation={0} sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          <Typography fontSize={12} color="#6b7280" fontWeight={500} mb={0.5}>Total de Cartões</Typography>
          <Typography fontSize={24} fontWeight={700} color="#111827">{totalCartoes}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          <Typography fontSize={12} color="#6b7280" fontWeight={500} mb={0.5}>Saldo Total</Typography>
          <Typography fontSize={24} fontWeight={700} color="#15803d">{formatMoney(totalSaldo)}</Typography>
        </Paper>
        <Paper elevation={0} sx={{ p: 2, border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          <Typography fontSize={12} color="#6b7280" fontWeight={500} mb={0.5}>Transações Totais</Typography>
          <Typography fontSize={24} fontWeight={700} color="#111827">{totalTransacoes}</Typography>
        </Paper>
      </Box>

      {/* Credit Cards Grid */}
      {contas.length === 0 ? (
        <EmptyState
          title="Nenhum cartão cadastrado"
          description="Adicione seus cartões de crédito para começar a acompanhar seus gastos."
          actionLabel="Adicionar Cartão"
          onAction={() => setOpenContaDialog(true)}
        />
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2 }}>
          {contas.map(conta => {
            const colors = tipoContaColor[conta.tipo] ?? { bg: "#f3f4f6", color: "#374151" }
            const transactionCount = getTransactionCountForMonth(transactions, conta.id)
            const banco = bancos.find(b => b.id === conta.bancoId)

            return (
              <Paper
                key={conta.id}
                elevation={0}
                sx={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "12px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                }}
              >
                {/* Card Header */}
                <Box sx={{ px: 3, py: 2.5, borderBottom: "1px solid #f1f5f9" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        backgroundColor: colors.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: colors.color,
                        fontSize: 18,
                      }}
                    >
                      <CreditCardIcon sx={{ fontSize: 18 }} />
                    </Box>
                    <Box>
                      <Typography fontSize={14} fontWeight={600} color="#111827">{banco?.nome || conta.nome}</Typography>
                      <Typography fontSize={12} color="#6b7280">{conta.tipoDescricao}</Typography>
                    </Box>
                  </Box>
                  <Chip label={conta.tipoDescricao} size="small" sx={{ fontSize: 11, height: 22, borderRadius: "6px", backgroundColor: colors.bg, color: colors.color, fontWeight: 500 }} />
                </Box>

                {/* Card Body */}
                <Box sx={{ px: 3, py: 2.5, flex: 1 }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography fontSize={11} color="#6b7280" fontWeight={500} mb={0.5}>Saldo Atual</Typography>
                    <Typography fontSize={18} fontWeight={700} color="#15803d">{formatMoney(conta.saldoInicial ?? 0)}</Typography>
                  </Box>
                  <Box>
                    <Typography fontSize={11} color="#6b7280" fontWeight={500} mb={0.5}>Transações no Mês</Typography>
                    <Typography fontSize={18} fontWeight={700} color="#111827">{transactionCount}</Typography>
                  </Box>
                </Box>

                {/* Card Footer - Actions */}
                <Box sx={{ px: 3, py: 2, borderTop: "1px solid #f1f5f9", display: "flex", gap: 1, justifyContent: "flex-end" }}>
                  <IconButton size="small" onClick={() => { setEditingConta(conta); setOpenContaDialog(true) }} sx={{ color: "#6b7280" }}>
                    <EditIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDeleteConta(conta.id)} sx={{ color: "#ef4444" }}>
                    <DeleteIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Box>
              </Paper>
            )
          })}
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
