import { useEffect, useState } from "react"
import { Box, Paper, Typography, IconButton, LinearProgress, Select, MenuItem as MuiMenuItem } from "@mui/material"
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

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

const formatMoneyShort = (value: number) => {
  if (Math.abs(value) >= 1000) return `R$${(value / 1000).toFixed(1)}k`
  return `R$${value.toFixed(0)}`
}

const PIE_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed",
  "#0891b2", "#be185d", "#65a30d", "#9333ea", "#ea580c",
]

export default function ReportsPage() {
  const [data, setData] = useState<RelatorioData | null>(null)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)

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
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            {/* Pizza */}
            <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: "12px", p: 3 }}>
              <Typography fontSize={15} fontWeight={600} color="text.primary" mb={3}>
                Distribuição de Despesas
              </Typography>
              {data.gastosPorCategoria.length === 0 ? (
                <Typography fontSize={13} color="text.secondary" textAlign="center" py={4}>
                  Nenhuma despesa em {ano}
                </Typography>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={data.gastosPorCategoria}
                      dataKey="valor"
                      nameKey="descricao"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      // @ts-expect-error recharts PieChart label types vary by version
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {data.gastosPorCategoria.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      // @ts-expect-error recharts formatter types are loose
                      formatter={(val: number) => formatMoney(val)}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Paper>

            {/* Lista detalhada */}
            <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: "12px", p: 3 }}>
              <Typography fontSize={15} fontWeight={600} color="text.primary" mb={2.5}>
                Detalhamento por Categoria
              </Typography>
              {data.gastosPorCategoria.length === 0 ? (
                <Typography fontSize={13} color="text.secondary" textAlign="center" py={4}>
                  Nenhuma despesa em {ano}
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, overflowY: "auto", maxHeight: 220 }}>
                  {data.gastosPorCategoria.map((cat, index) => (
                    <Box key={cat.descricao}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: PIE_COLORS[index % PIE_COLORS.length], flexShrink: 0 }} />
                          <Typography fontSize={13} fontWeight={500} color="text.primary">
                            {cat.descricao}
                          </Typography>
                        </Box>
                        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                          <Typography fontSize={12} color="text.secondary">{cat.percentual}%</Typography>
                          <Typography fontSize={13} fontWeight={600} color="text.primary">{formatMoney(cat.valor)}</Typography>
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={cat.percentual}
                        sx={{
                          height: 5,
                          borderRadius: 3,
                          bgcolor: "action.hover",
                          "& .MuiLinearProgress-bar": { bgcolor: PIE_COLORS[index % PIE_COLORS.length], borderRadius: 3 },
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Box>
        </>
      )}
    </Box>
  )
}
