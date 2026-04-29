import { useEffect, useState } from "react"
import { Box, Paper, Typography } from "@mui/material"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import { getReportByPeople } from "../../services/reportService"
import type { PeopleReport } from "../../types/Report"

const formatMoney = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

export default function ReportsPage() {
  const [report, setReport] = useState<PeopleReport | null>(null)

  useEffect(() => {
    getReportByPeople().then(setReport)
  }, [])

  if (!report) return <Typography fontSize={13} color="text.secondary">Carregando...</Typography>

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography fontSize={14} fontWeight={600} color="#111827">
        Relatórios
      </Typography>

      <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid #f1f5f9", fontWeight: 600, fontSize: 13 }}>
          Por Pessoa
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "#fafafa" }}>
                <TableCell sx={{ fontSize: 12, color: "#9ca3af", py: 1 }}>Pessoa</TableCell>
                <TableCell align="right" sx={{ fontSize: 12, color: "#9ca3af", py: 1 }}>Receitas</TableCell>
                <TableCell align="right" sx={{ fontSize: 12, color: "#9ca3af", py: 1 }}>Despesas</TableCell>
                <TableCell align="right" sx={{ fontSize: 12, color: "#9ca3af", py: 1 }}>Saldo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.pessoas.map(p => (
                <TableRow
                  key={p.pessoaId}
                  hover
                  sx={{ "&:hover": { backgroundColor: "#f9fafb" }, "&:last-child td": { borderBottom: 0 } }}
                >
                  <TableCell sx={{ fontSize: 13, fontWeight: 500, py: 1 }}>{p.nome}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 13, py: 1 }}>{formatMoney(p.totalReceitas)}</TableCell>
                  <TableCell align="right" sx={{ fontSize: 13, py: 1 }}>{formatMoney(p.totalDespesas)}</TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontSize: 13, py: 1, color: p.saldo >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}
                  >
                    {formatMoney(p.saldo)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableBody>
              <TableRow sx={{ backgroundColor: "#fafafa" }}>
                <TableCell sx={{ fontSize: 13, fontWeight: 700, py: 1 }}>Total Geral</TableCell>
                <TableCell align="right" sx={{ fontSize: 13, fontWeight: 700, py: 1 }}>{formatMoney(report.totalGeralReceitas)}</TableCell>
                <TableCell align="right" sx={{ fontSize: 13, fontWeight: 700, py: 1 }}>{formatMoney(report.totalGeralDespesas)}</TableCell>
                <TableCell align="right" sx={{ fontSize: 13, fontWeight: 700, py: 1 }}>{formatMoney(report.saldoGeral)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
