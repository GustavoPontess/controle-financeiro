import { useEffect, useState } from "react"

import { Box, Paper } from "@mui/material"

import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"

import { getReportByPeople } from "../../services/reportService"

import type { PeopleReport } from "../../types/Report"

export default function ReportsPage() {

  const [report, setReport] = useState<PeopleReport | null>(null)

  useEffect(() => {

    const loadReport = async () => {
      const data = await getReportByPeople()
      setReport(data)
    }

    loadReport()

  }, [])

  if (!report) return <p>Carregando...</p>

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value)

  return (

    <Paper
      elevation={0}
      sx={{
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        overflow: "hidden"
      }}
    >

      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: "1px solid #f1f5f9",
          fontWeight: 600,
          fontSize: 15
        }}
      >
        Relatório por Pessoa
      </Box>

      <TableContainer>

        <Table size="small">

          <TableHead>

            <TableRow sx={{ backgroundColor: "#fafafa" }}>

              <TableCell sx={{ fontSize: 13, color: "#6b7280" }}>
                Pessoa
              </TableCell>

              <TableCell align="right" sx={{ fontSize: 13, color: "#6b7280" }}>
                Receitas
              </TableCell>

              <TableCell align="right" sx={{ fontSize: 13, color: "#6b7280" }}>
                Despesas
              </TableCell>

              <TableCell align="right" sx={{ fontSize: 13, color: "#6b7280" }}>
                Saldo
              </TableCell>

            </TableRow>

          </TableHead>

          <TableBody>

            {report.pessoas.map(p => (

              <TableRow
                key={p.pessoaId}
                hover
                sx={{
                  "&:hover": { backgroundColor: "#f9fafb" },
                  "&:last-child td": { borderBottom: 0 }
                }}
              >

                <TableCell sx={{ fontWeight: 500 }}>
                  {p.nome}
                </TableCell>

                <TableCell align="right">
                  {formatMoney(p.totalReceitas)}
                </TableCell>

                <TableCell align="right">
                  {formatMoney(p.totalDespesas)}
                </TableCell>

                <TableCell
                  align="right"
                  sx={{
                    color: p.saldo >= 0 ? "#16a34a" : "#dc2626",
                    fontWeight: 600
                  }}
                >
                  {formatMoney(p.saldo)}
                </TableCell>

              </TableRow>

            ))}

          </TableBody>

          <TableBody>

            <TableRow sx={{ backgroundColor: "#fafafa" }}>

              <TableCell sx={{ fontWeight: 700 }}>
                Total Geral
              </TableCell>

              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {formatMoney(report.totalGeralReceitas)}
              </TableCell>

              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {formatMoney(report.totalGeralDespesas)}
              </TableCell>

              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {formatMoney(report.saldoGeral)}
              </TableCell>

            </TableRow>

          </TableBody>

        </Table>

      </TableContainer>

    </Paper>

  )

}