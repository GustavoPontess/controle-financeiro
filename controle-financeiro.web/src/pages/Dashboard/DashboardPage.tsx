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
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined"
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined"

import { useOutletContext } from "react-router-dom"
import { getDashboard } from "../../services/dashboardService"
import type { DashboardData } from "../../types/Dashboard"
import TransactionTable, { type TransactionRow } from "../../components/transactions/TransactionTable/TransactionTable"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { useAuth } from "../../hooks/useAuth"
import { tokens } from "../../theme/tokens"

/** Estilo visual de cada tipo de conta (TipoConta): avatar gradiente + ícone. */
function accountStyle(tipo: number): { grad: string; icon: React.ReactNode } {
  const ic = { fontSize: 20 }
  switch (tipo) {
    case 1: // Conta Corrente
      return { grad: "linear-gradient(135deg, #3b82f6, #2563eb)", icon: <AccountBalanceOutlinedIcon sx={ic} /> }
    case 2: // Poupança
      return { grad: "linear-gradient(135deg, #10b981, #059669)", icon: <SavingsOutlinedIcon sx={ic} /> }
    case 3: // Cartão de Crédito
      return { grad: "linear-gradient(135deg, #8b5cf6, #7c3aed)", icon: <CreditCardOutlinedIcon sx={ic} /> }
    case 4: // Dinheiro / Carteira
      return { grad: "linear-gradient(135deg, #f59e0b, #d97706)", icon: <AccountBalanceWalletOutlinedIcon sx={ic} /> }
    default:
      return { grad: "linear-gradient(135deg, #64748b, #475569)", icon: <AccountBalanceOutlinedIcon sx={ic} /> }
  }
}

/** Tons semânticos dos cards de resumo — todos derivados dos design tokens (#60). */
type CardTone = "brand" | "success" | "error"
const toneColor: Record<CardTone, { main: string; grad: string }> = {
  brand: { main: tokens.color.brand.primary, grad: "linear-gradient(135deg, #0d9488, #0f766e)" },
  success: { main: tokens.color.status.success.main, grad: "linear-gradient(135deg, #10b981, #059669)" },
  error: { main: tokens.color.status.error.main, grad: "linear-gradient(135deg, #f43f5e, #e11d48)" },
}

/** Paleta para fatias do gráfico de categorias. */
const CHART_COLORS = ["#0d9488", "#f59e0b", "#6366f1", "#ec4899", "#14b8a6", "#94a3b8"]

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

function SummaryCard({
  title,
  value,
  tone,
  icon,
  subtitle,
}: {
  title: string
  value: string
  tone: CardTone
  icon: React.ReactNode
  subtitle?: string
}) {
  const c = toneColor[tone]
  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${tokens.color.border.default}`,
        borderRadius: tokens.radius.lg,
        boxShadow: tokens.shadow.sm,
        p: 2.5,
        display: "flex",
        alignItems: "center",
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: tokens.radius.lg,
          background: c.grad,
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          fontSize={tokens.typography.fontSize["2xs"]}
          fontWeight={tokens.typography.fontWeight.medium}
          color={tokens.color.text.secondary}
          sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}
        >
          {title}
        </Typography>
        <Typography
          fontSize={tokens.typography.fontSize.xl}
          fontWeight={tokens.typography.fontWeight.bold}
          color={c.main}
          sx={{ letterSpacing: -0.3, lineHeight: 1.2 }}
        >
          {value}
        </Typography>
        {subtitle && (
          <Typography fontSize={tokens.typography.fontSize["2xs"]} color={tokens.color.text.secondary}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Paper>
  )
}

/** Card hero — saldo total em destaque, fundo sólido de marca (estilo cartão). */
function HeroBalance({ value }: { value: string }) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: "none",
        borderRadius: tokens.radius.xl,
        boxShadow: tokens.shadow.lg,
        background: `linear-gradient(135deg, ${tokens.color.brand.primary} 0%, ${tokens.color.brand.hover} 100%)`,
        color: "#ffffff",
        p: 4,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Círculo decorativo translúcido */}
      <Box
        sx={{
          position: "absolute",
          right: -40,
          top: -40,
          width: 180,
          height: 180,
          borderRadius: "50%",
          bgcolor: "rgba(255,255,255,0.08)",
        }}
      />
      <Box sx={{ position: "relative" }}>
        <Typography
          fontSize={tokens.typography.fontSize.xs}
          fontWeight={tokens.typography.fontWeight.medium}
          sx={{ textTransform: "uppercase", letterSpacing: 0.8, opacity: 0.85 }}
        >
          Saldo Total
        </Typography>
        <Typography
          fontSize={tokens.typography.fontSize["3xl"]}
          fontWeight={tokens.typography.fontWeight.bold}
          mt={0.5}
          sx={{ letterSpacing: -0.5 }}
        >
          {value}
        </Typography>
        <Typography fontSize={tokens.typography.fontSize.xs} mt={0.5} sx={{ opacity: 0.8 }}>
          Soma de todas as contas
        </Typography>
      </Box>
      <Box
        sx={{
          position: "relative",
          width: 56,
          height: 56,
          borderRadius: tokens.radius.lg,
          bgcolor: "rgba(255,255,255,0.18)",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 28 }} />
      </Box>
    </Paper>
  )
}

export default function DashboardPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const { currentUser } = useAuth()
  const firstName = currentUser?.nome?.trim().split(" ")[0] ?? ""
  const todayLabel = new Date()
    .toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase())
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
      {/* Header — saudação personalizada */}
      <Box>
        <Typography
          fontSize={tokens.typography.fontSize["2xl"]}
          fontWeight={tokens.typography.fontWeight.bold}
          color={tokens.color.text.primary}
          sx={{ letterSpacing: -0.5 }}
        >
          {firstName ? `Olá, ${firstName}` : "Visão Geral"}
        </Typography>
        <Typography fontSize={tokens.typography.fontSize.sm} color={tokens.color.text.secondary}>
          {todayLabel} · aqui está o resumo das suas finanças
        </Typography>
      </Box>

      {loading && <LinearProgress sx={{ borderRadius: 1 }} />}

      {data && (
        <>
          {/* ───── AGORA — posição atual, não depende de mês ───── */}

          {/* Hero — saldo total em destaque */}
          <HeroBalance value={formatMoney(data.saldoTotal)} />

          {/* Saldo por conta */}
          <Paper elevation={0} sx={{ p: 3 }}>
            <Typography
              fontSize={tokens.typography.fontSize.base}
              fontWeight={tokens.typography.fontWeight.bold}
              color={tokens.color.text.primary}
              mb={2}
            >
              Saldo por Conta
            </Typography>
            {data.saldoContas.length === 0 ? (
              <Typography fontSize={tokens.typography.fontSize.sm} color={tokens.color.text.secondary} textAlign="center" py={3}>
                Nenhuma conta cadastrada
              </Typography>
            ) : (
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 1.5 }}>
                {data.saldoContas.map((conta) => {
                  const st = accountStyle(conta.tipo)
                  return (
                    <Box
                      key={conta.id}
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.5,
                        p: 2,
                        borderRadius: tokens.radius.lg,
                        border: `1px solid ${tokens.color.border.default}`,
                        transition: "box-shadow .15s ease, transform .15s ease",
                        "&:hover": { boxShadow: tokens.shadow.md, transform: "translateY(-2px)" },
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: tokens.radius.md,
                            background: st.grad,
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {st.icon}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography fontSize={tokens.typography.fontSize.sm} fontWeight={tokens.typography.fontWeight.bold} color={tokens.color.text.primary} noWrap>
                            {conta.nome}
                          </Typography>
                          <Typography fontSize={tokens.typography.fontSize.xs} color={tokens.color.text.secondary} noWrap>
                            {conta.tipoDescricao}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography
                        fontSize={tokens.typography.fontSize.lg}
                        fontWeight={tokens.typography.fontWeight.bold}
                        color={conta.saldo >= 0 ? tokens.color.text.primary : tokens.color.status.error.main}
                      >
                        {formatMoney(conta.saldo)}
                      </Typography>
                    </Box>
                  )
                })}
              </Box>
            )}
          </Paper>

          {/* ───── MÊS — tudo abaixo do seletor depende do mês escolhido ───── */}

          {/* Cabeçalho da seção mensal — seletor grudado nos dados que controla */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: `1px solid ${tokens.color.border.default}`,
              pb: 1.5,
              mt: 1,
            }}
          >
            <Typography
              fontSize={tokens.typography.fontSize.lg}
              fontWeight={tokens.typography.fontWeight.bold}
              color={tokens.color.text.primary}
            >
              Movimentação do mês
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <IconButton
                onClick={prevMonth}
                sx={{ width: 32, height: 32, border: `1.5px solid ${tokens.color.border.default}`, borderRadius: tokens.radius.md, color: tokens.color.text.primary }}
              >
                <ChevronLeftIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <Typography
                fontWeight={tokens.typography.fontWeight.bold}
                fontSize={tokens.typography.fontSize.lg}
                color={tokens.color.brand.primary}
                sx={{ minWidth: 190, textAlign: "center" }}
              >
                {monthLabel}
              </Typography>
              <IconButton
                onClick={nextMonth}
                sx={{ width: 32, height: 32, border: `1.5px solid ${tokens.color.border.default}`, borderRadius: tokens.radius.md, color: tokens.color.text.primary }}
              >
                <ChevronRightIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>

          {/* KPIs do mês */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
            <SummaryCard
              title="Receitas do Mês"
              value={formatMoney(data.receitasMes)}
              tone="success"
              icon={<TrendingUpIcon sx={{ fontSize: 18 }} />}
            />
            <SummaryCard
              title="Despesas do Mês"
              value={formatMoney(data.despesasMes)}
              tone="error"
              icon={<TrendingDownIcon sx={{ fontSize: 18 }} />}
            />
            <SummaryCard
              title="Saldo do Mês"
              value={formatMoney(data.saldoMes)}
              tone={data.saldoMes >= 0 ? "success" : "error"}
              icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 18 }} />}
              subtitle={data.saldoMes >= 0 ? "Positivo" : "Negativo"}
            />
          </Box>

          {/* Top categorias do mês — donut + legenda */}
          <Paper elevation={0} sx={{ p: 3 }}>
            <Typography
              fontSize={tokens.typography.fontSize.base}
              fontWeight={tokens.typography.fontWeight.bold}
              color={tokens.color.text.primary}
              mb={2.5}
            >
              Top Categorias (Despesas)
            </Typography>
            {data.topCategorias.length === 0 ? (
              <Typography fontSize={tokens.typography.fontSize.sm} color={tokens.color.text.secondary} textAlign="center" py={3}>
                Nenhuma despesa no período
              </Typography>
            ) : (
              <Box sx={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                {/* Donut */}
                <Box sx={{ width: 200, height: 200, position: "relative", flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.topCategorias}
                        dataKey="valor"
                        nameKey="descricao"
                        innerRadius={62}
                        outerRadius={92}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {data.topCategorias.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Total no centro */}
                  <Box
                    sx={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      pointerEvents: "none",
                    }}
                  >
                    <Typography fontSize={tokens.typography.fontSize["2xs"]} color={tokens.color.text.secondary} sx={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
                      Total
                    </Typography>
                    <Typography fontSize={tokens.typography.fontSize.base} fontWeight={tokens.typography.fontWeight.bold} color={tokens.color.text.primary}>
                      {formatMoney(data.topCategorias.reduce((s, c) => s + c.valor, 0))}
                    </Typography>
                  </Box>
                </Box>

                {/* Legenda */}
                <Box sx={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {data.topCategorias.map((cat, i) => (
                    <Box key={cat.descricao} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          bgcolor: CHART_COLORS[i % CHART_COLORS.length],
                          flexShrink: 0,
                        }}
                      />
                      <Typography fontSize={tokens.typography.fontSize.sm} fontWeight={tokens.typography.fontWeight.medium} color={tokens.color.text.primary} sx={{ flex: 1 }}>
                        {cat.descricao}
                      </Typography>
                      <Typography fontSize={tokens.typography.fontSize.xs} color={tokens.color.text.secondary}>
                        {cat.percentual}%
                      </Typography>
                      <Typography fontSize={tokens.typography.fontSize.sm} fontWeight={tokens.typography.fontWeight.bold} color={tokens.color.text.primary} sx={{ minWidth: 96, textAlign: "right" }}>
                        {formatMoney(cat.valor)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Paper>

          {/* ───── Transações recentes ───── */}
          <Paper elevation={0} sx={{ overflow: "hidden" }}>
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
