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
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie,
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
          {/* Evolução mensal — linha */}
          <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: "12px", p: 3 }}>
            <Typography fontSize={15} fontWeight={600} color="text.primary" mb={3}>
              Evolução do Saldo Mensal
            </Typography>
            {evolucaoComDados.length === 0 ? (
              <Typography fontSize={13} color="text.secondary" textAlign="center" py={4}>
                Nenhuma transação em {ano}
              </Typography>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.evolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 12, fill: "#6b7280" }} />
                  <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 12, fill: "#6b7280" }} />
                  <Tooltip
                    // @ts-expect-error recharts formatter types are loose
                    formatter={(val: number) => formatMoney(val)}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Line type="monotone" dataKey="receitas" name="Receitas" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="despesas" name="Despesas" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#2563eb" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Paper>

          {/* Receitas vs Despesas — barra */}
          <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: "12px", p: 3 }}>
            <Typography fontSize={15} fontWeight={600} color="text.primary" mb={3}>
              Receitas vs Despesas por Mês
            </Typography>
            {evolucaoComDados.length === 0 ? (
              <Typography fontSize={13} color="text.secondary" textAlign="center" py={4}>
                Nenhuma transação em {ano}
              </Typography>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.evolucaoMensal} barSize={14} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="mesLabel" tick={{ fontSize: 12, fill: "#6b7280" }} />
                  <YAxis tickFormatter={formatMoneyShort} tick={{ fontSize: 12, fill: "#6b7280" }} />
                  <Tooltip
                    // @ts-expect-error recharts formatter types are loose
                    formatter={(val: number) => formatMoney(val)}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Bar dataKey="receitas" name="Receitas" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="#dc2626" radius={[4, 4, 0, 0]} />
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
