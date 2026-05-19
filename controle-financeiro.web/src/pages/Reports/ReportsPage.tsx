import { useEffect, useState } from "react"
import { Box, Paper, Typography, IconButton, LinearProgress, Select, MenuItem as MuiMenuItem, Tooltip as MuiTooltip } from "@mui/material"
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
  ReferenceLine,
} from "recharts"

import { getRelatorio } from "../../services/relatorioService"
import type { RelatorioData } from "../../types/Relatorio"
import { tokens } from "../../theme/tokens"

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const formatMoneyShort = (value: number) => {
  if (Math.abs(value) >= 1000) return `R$${(value / 1000).toFixed(1)}k`
  return `R$${value.toFixed(0)}`
}

const PIE_COLORS = [
  "#0d9488", "#6366f1", "#f59e0b", "#e5484d", "#10b981",
  "#8b5cf6", "#00a2c7", "#ec4899", "#84cc16", "#f97316",
]

export default function ReportsPage() {
  const [data, setData] = useState<RelatorioData | null>(null)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [activeSlice, setActiveSlice] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const result = await getRelatorio(ano)
        setData(result)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [ano])

  const anosDisponiveis = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  const evolucaoComDados = data?.evolucaoMensal.filter(m => m.receitas > 0 || m.despesas > 0) ?? []

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography fontSize={22} fontWeight={700} color="text.primary">
            Relatórios
          </Typography>
          <Typography fontSize={13} color="text.secondary">
            Análise financeira detalhada
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton
            onClick={() => setAno(a => a - 1)}
            sx={{ width: 32, height: 32, border: 1.5, borderColor: "divider", borderRadius: "8px", color: "text.primary" }}
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <Select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            size="small"
            sx={{ minWidth: 100, borderRadius: "8px", fontSize: 14, fontWeight: 700 }}
          >
            {anosDisponiveis.map(a => (
              <MuiMenuItem key={a} value={a}>{a}</MuiMenuItem>
            ))}
          </Select>
          <IconButton
            onClick={() => setAno(a => a + 1)}
            sx={{ width: 32, height: 32, border: 1.5, borderColor: "divider", borderRadius: "8px", color: "text.primary" }}
          >
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ borderRadius: 1 }} />}

      {data && (
        <>
          {/* Evolução mensal — área */}
          <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: tokens.radius.lg, p: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
              <Box>
                <Typography fontSize={15} fontWeight={600} color="text.primary">
                  Evolução do Saldo Mensal
                </Typography>
                <Typography fontSize={12} color="text.secondary">
                  Receitas, despesas e saldo acumulado
                </Typography>
              </Box>
            </Box>
            {evolucaoComDados.length === 0 ? (
              <Typography fontSize={13} color="text.secondary" textAlign="center" py={4}>
                Nenhuma transação em {ano}
              </Typography>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={evolucaoComDados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradReceitas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={tokens.color.status.success.main} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={tokens.color.status.success.main} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={tokens.color.status.error.main} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={tokens.color.status.error.main} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={tokens.color.brand.primary} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={tokens.color.brand.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={tokens.color.border.subtle} vertical={false} />
                  <XAxis
                    dataKey="mesLabel"
                    tick={{ fontSize: 12, fill: tokens.color.text.secondary }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatMoneyShort}
                    tick={{ fontSize: 12, fill: tokens.color.text.secondary }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip
                    // @ts-expect-error recharts formatter types are loose
                    formatter={(val: number, name: string) => [formatMoney(val), name]}
                    contentStyle={{
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.color.border.default}`,
                      fontSize: 13,
                      boxShadow: tokens.shadow.md,
                      color: tokens.color.text.primary,
                    }}
                    labelStyle={{ fontWeight: 600, marginBottom: 4, color: tokens.color.text.primary }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 13, paddingTop: 12, color: tokens.color.text.secondary }}
                  />
                  <Area
                    type="monotone"
                    dataKey="receitas"
                    name="Receitas"
                    stroke={tokens.color.status.success.main}
                    strokeWidth={2}
                    fill="url(#gradReceitas)"
                    dot={{ r: 4, fill: tokens.color.status.success.main, strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="despesas"
                    name="Despesas"
                    stroke={tokens.color.status.error.main}
                    strokeWidth={2}
                    fill="url(#gradDespesas)"
                    dot={{ r: 4, fill: tokens.color.status.error.main, strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="saldo"
                    name="Saldo"
                    stroke={tokens.color.brand.primary}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    fill="url(#gradSaldo)"
                    dot={{ r: 4, fill: tokens.color.brand.primary, strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Paper>

          {/* Receitas vs Despesas — barra */}
          <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: tokens.radius.lg, p: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
              <Box>
                <Typography fontSize={15} fontWeight={600} color="text.primary">
                  Receitas vs Despesas por Mês
                </Typography>
                <Typography fontSize={12} color="text.secondary">
                  Comparativo mensal
                </Typography>
              </Box>
            </Box>
            {evolucaoComDados.length === 0 ? (
              <Typography fontSize={13} color="text.secondary" textAlign="center" py={4}>
                Nenhuma transação em {ano}
              </Typography>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={evolucaoComDados} barSize={20} barGap={6} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={tokens.color.border.subtle} vertical={false} />
                  <XAxis
                    dataKey="mesLabel"
                    tick={{ fontSize: 12, fill: tokens.color.text.secondary }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatMoneyShort}
                    tick={{ fontSize: 12, fill: tokens.color.text.secondary }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip
                    // @ts-expect-error recharts formatter types are loose
                    formatter={(val: number, name: string) => [formatMoney(val), name]}
                    contentStyle={{
                      borderRadius: tokens.radius.md,
                      border: `1px solid ${tokens.color.border.default}`,
                      fontSize: 13,
                      boxShadow: tokens.shadow.md,
                      color: tokens.color.text.primary,
                    }}
                    labelStyle={{ fontWeight: 600, marginBottom: 4, color: tokens.color.text.primary }}
                    cursor={{ fill: tokens.color.background.secondary }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 13, paddingTop: 12, color: tokens.color.text.secondary }}
                  />
                  <ReferenceLine y={0} stroke={tokens.color.border.default} />
                  <Bar dataKey="receitas" name="Receitas" fill={tokens.color.status.success.main} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill={tokens.color.status.error.main} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>

          {/* Gastos por categoria */}
          <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: tokens.radius.lg, p: 3 }}>
            <Typography fontSize={15} fontWeight={600} color="text.primary" mb={3}>
              Distribuição de Despesas
            </Typography>
            {data.gastosPorCategoria.length === 0 ? (
              <Typography fontSize={13} color="text.secondary" textAlign="center" py={4}>
                Nenhuma despesa em {ano}
              </Typography>
            ) : (
              <Box sx={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 4, alignItems: "center" }}>
                {/* Donut com total no centro */}
                <Box sx={{ position: "relative" }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.gastosPorCategoria}
                        dataKey="valor"
                        nameKey="descricao"
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={90}
                        paddingAngle={2}
                        onMouseEnter={(_, index) => setActiveSlice(index)}
                        onMouseLeave={() => setActiveSlice(null)}
                      >
                        {data.gastosPorCategoria.map((_, index) => (
                          <Cell
                            key={index}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                            opacity={activeSlice === null || activeSlice === index ? 1 : 0.35}
                            stroke="none"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        // @ts-expect-error recharts formatter types are loose
                        formatter={(val: number, name: string) => [formatMoney(val), name]}
                        contentStyle={{
                          borderRadius: tokens.radius.md,
                          border: `1px solid ${tokens.color.border.default}`,
                          fontSize: 13,
                          boxShadow: tokens.shadow.md,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Total no centro do donut */}
                  <Box
                    sx={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      textAlign: "center",
                      pointerEvents: "none",
                    }}
                  >
                    {activeSlice !== null ? (
                      <>
                        <Typography
                          fontSize={tokens.typography.fontSize.sm}
                          fontWeight={tokens.typography.fontWeight.bold}
                          color={PIE_COLORS[activeSlice % PIE_COLORS.length]}
                          lineHeight={1.2}
                          noWrap
                          sx={{ maxWidth: 100 }}
                        >
                          {data.gastosPorCategoria[activeSlice].percentual}%
                        </Typography>
                        <Typography fontSize={tokens.typography.fontSize.xs} color={tokens.color.text.secondary} noWrap sx={{ maxWidth: 100 }}>
                          {data.gastosPorCategoria[activeSlice].descricao}
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Typography
                          fontSize={tokens.typography.fontSize.xs}
                          color={tokens.color.text.secondary}
                          sx={{ textTransform: "uppercase", letterSpacing: "0.04em" }}
                        >
                          Total
                        </Typography>
                        <Typography
                          fontSize={tokens.typography.fontSize.sm}
                          fontWeight={tokens.typography.fontWeight.bold}
                          color={tokens.color.text.primary}
                          lineHeight={1.3}
                        >
                          {formatMoney(data.gastosPorCategoria.reduce((s, c) => s + c.valor, 0))}
                        </Typography>
                      </>
                    )}
                  </Box>
                </Box>

                {/* Lista detalhada */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, overflowY: "auto", maxHeight: 240 }}>
                  {data.gastosPorCategoria.map((cat, index) => {
                    const color = PIE_COLORS[index % PIE_COLORS.length]
                    const isActive = activeSlice === index
                    return (
                      <MuiTooltip key={cat.descricao} title={formatMoney(cat.valor)} placement="left" arrow>
                        <Box
                          onMouseEnter={() => setActiveSlice(index)}
                          onMouseLeave={() => setActiveSlice(null)}
                          sx={{
                            cursor: "default",
                            p: 1,
                            borderRadius: tokens.radius.md,
                            bgcolor: isActive ? `${color}12` : "transparent",
                            transition: tokens.transition.fast,
                          }}
                        >
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
                              <Typography
                                fontSize={tokens.typography.fontSize.sm}
                                fontWeight={isActive ? tokens.typography.fontWeight.bold : tokens.typography.fontWeight.medium}
                                color={tokens.color.text.primary}
                                noWrap
                              >
                                {cat.descricao}
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexShrink: 0 }}>
                              <Typography fontSize={tokens.typography.fontSize.xs} color={tokens.color.text.secondary}>
                                {cat.percentual}%
                              </Typography>
                              <Typography
                                fontSize={tokens.typography.fontSize.sm}
                                fontWeight={tokens.typography.fontWeight.bold}
                                color={tokens.color.text.primary}
                              >
                                {formatMoney(cat.valor)}
                              </Typography>
                            </Box>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={cat.percentual}
                            sx={{
                              height: 4,
                              borderRadius: tokens.radius.pill,
                              bgcolor: tokens.color.background.tertiary,
                              "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: tokens.radius.pill },
                            }}
                          />
                        </Box>
                      </MuiTooltip>
                    )
                  })}
                </Box>
              </Box>
            )}
          </Paper>
        </>
      )}
    </Box>
  )
}
