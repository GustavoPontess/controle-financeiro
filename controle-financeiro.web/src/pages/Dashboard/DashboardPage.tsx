import { useEffect, useState } from "react"
import {
  Box,
  Paper,
  Typography,
  IconButton,
  LinearProgress,
} from "@mui/material"
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import TrendingUpIcon from "@mui/icons-material/TrendingUp"
import TrendingDownIcon from "@mui/icons-material/TrendingDown"
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined"
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined"
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined"

import { useOutletContext } from "react-router-dom"
import { getDashboard } from "../../services/dashboardService"
import type { DashboardData } from "../../types/Dashboard"
import TransactionTable, { type TransactionRow } from "../../components/transactions/TransactionTable/TransactionTable"

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

function SummaryCard({
  title,
  value,
  color,
  icon,
  subtitle,
}: {
  title: string
  value: string
  color: string
  icon: React.ReactNode
  subtitle?: string
}) {
  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: "12px", p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
        <Typography fontSize={13} fontWeight={600} color="text.secondary">
          {title}
        </Typography>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "8px",
            bgcolor: `${color}15`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color,
          }}
        >
          {icon}
        </Box>
      </Box>
      <Typography fontSize={24} fontWeight={700} color="text.primary">
        {value}
      </Typography>
      {subtitle && (
        <Typography fontSize={12} color="text.secondary" mt={0.5}>
          {subtitle}
        </Typography>
      )}
    </Paper>
  )
}

export default function DashboardPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [data, setData] = useState<DashboardData | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const result = await getDashboard(currentDate.getFullYear(), currentDate.getMonth() + 1)
      setData(result)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    window.addEventListener("transactionCreated", load)
    return () => window.removeEventListener("transactionCreated", load)
  }, [currentDate])

  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))

  const monthLabel = currentDate
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^\w/, (c) => c.toUpperCase())
    .replace(" de ", " De ")

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography fontSize={22} fontWeight={700} color="text.primary">
            Visão Geral
          </Typography>
          <Typography fontSize={13} color="text.secondary">
            Resumo financeiro do período
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <IconButton
            onClick={prevMonth}
            sx={{ width: 32, height: 32, border: 1.5, borderColor: "divider", borderRadius: "8px", color: "text.primary" }}
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Typography fontWeight={700} fontSize={15} sx={{ minWidth: 180, textAlign: "center" }}>
            {monthLabel}
          </Typography>
          <IconButton
            onClick={nextMonth}
            sx={{ width: 32, height: 32, border: 1.5, borderColor: "divider", borderRadius: "8px", color: "text.primary" }}
          >
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ borderRadius: 1 }} />}

      {data && (
        <>
          {/* Summary cards */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
            <SummaryCard
              title="Saldo Total"
              value={formatMoney(data.saldoTotal)}
              color="#2563eb"
              icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 18 }} />}
              subtitle="Todas as contas"
            />
            <SummaryCard
              title="Receitas do Mês"
              value={formatMoney(data.receitasMes)}
              color="#16a34a"
              icon={<TrendingUpIcon sx={{ fontSize: 18 }} />}
            />
            <SummaryCard
              title="Despesas do Mês"
              value={formatMoney(data.despesasMes)}
              color="#dc2626"
              icon={<TrendingDownIcon sx={{ fontSize: 18 }} />}
            />
            <SummaryCard
              title="Saldo do Mês"
              value={formatMoney(data.saldoMes)}
              color={data.saldoMes >= 0 ? "#16a34a" : "#dc2626"}
              icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 18 }} />}
              subtitle={data.saldoMes >= 0 ? "Positivo" : "Negativo"}
            />
          </Box>

          {/* Middle section */}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            {/* Top categorias */}
            <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: "12px", p: 3 }}>
              <Typography fontSize={15} fontWeight={600} color="text.primary" mb={2.5}>
                Top Categorias (Despesas)
              </Typography>
              {data.topCategorias.length === 0 ? (
                <Typography fontSize={13} color="text.secondary" textAlign="center" py={3}>
                  Nenhuma despesa no período
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {data.topCategorias.map((cat) => (
                    <Box key={cat.descricao}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography fontSize={13} fontWeight={500} color="text.primary">
                          {cat.descricao}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                          <Typography fontSize={13} color="text.secondary">
                            {cat.percentual}%
                          </Typography>
                          <Typography fontSize={13} fontWeight={600} color="text.primary">
                            {formatMoney(cat.valor)}
                          </Typography>
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={cat.percentual}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: "action.hover",
                          "& .MuiLinearProgress-bar": { bgcolor: "#dc2626", borderRadius: 3 },
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>

            {/* Saldo por conta */}
            <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: "12px", p: 3 }}>
              <Typography fontSize={15} fontWeight={600} color="text.primary" mb={2.5}>
                Saldo por Conta
              </Typography>
              {data.saldoContas.length === 0 ? (
                <Typography fontSize={13} color="text.secondary" textAlign="center" py={3}>
                  Nenhuma conta cadastrada
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {data.saldoContas.map((conta) => (
                    <Box
                      key={conta.id}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        p: 1.5,
                        borderRadius: "8px",
                        bgcolor: "action.hover",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: "8px",
                            bgcolor: "action.selected",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <AccountBalanceOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                        </Box>
                        <Box>
                          <Typography fontSize={13} fontWeight={600} color="text.primary">
                            {conta.nome}
                          </Typography>
                          <Typography fontSize={11} color="text.secondary">
                            {conta.tipoDescricao}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography
                        fontSize={14}
                        fontWeight={700}
                        color={conta.saldo >= 0 ? "text.primary" : "#dc2626"}
                      >
                        {formatMoney(conta.saldo)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Box>

          {/* Transações recentes */}
          <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: "12px", overflow: "hidden" }}>
            <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: "divider" }}>
              <Typography fontSize={15} fontWeight={600} color="text.primary">
                Transações Recentes
              </Typography>
            </Box>
            <TransactionTable
              rows={data.transacoesRecentes.map((t): TransactionRow => ({
                id: t.id,
                descricao: t.descricao,
                valor: t.valor,
                tipo: t.tipo,
                data: t.data,
                categoriaId: t.categoriaId,
                categoriaDescricao: t.categoria,
                contaId: t.contaId,
                cartaoCreditoId: t.cartaoCreditoId,
                contaNome: t.conta,
                meioPagamento: t.meioPagamento,
                meioPagamentoDescricao: t.meioPagamentoDescricao,
              }))}
              onRefresh={load}
              notify={notify}
              emptyMessage="Nenhuma transação encontrada"
            />
          </Paper>
        </>
      )}
    </Box>
  )
}
