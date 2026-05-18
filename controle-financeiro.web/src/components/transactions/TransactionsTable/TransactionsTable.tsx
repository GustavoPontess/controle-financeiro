import {
  Box,
  Paper,
  Chip
} from "@mui/material"

import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"

import type { Category } from "../../../types/Category"
import type { Transaction } from "../../../types/Transaction"

type Props = {
  transactions: Transaction[]
  categories: Category[]
}

export default function TransactionsTable({
  transactions,
  categories
}: Props) {

  return (

    <Paper
      elevation={0}
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: "12px",
        overflow: "hidden"
      }}
    >

      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: 1,
          borderColor: "divider",
          fontWeight: 600,
          fontSize: 15
        }}
      >
        Lista de Transações
      </Box>

      <TableContainer>

        <Table size="small" stickyHeader>

          <TableHead>

            <TableRow sx={{ bgcolor: "action.hover" }}>

              <TableCell sx={{ fontSize: 13, color: "text.secondary" }}>
                Descrição
              </TableCell>

              <TableCell align="right" sx={{ fontSize: 13, color: "text.secondary" }}>
                Valor
              </TableCell>

              <TableCell sx={{ fontSize: 13, color: "text.secondary" }}>
                Tipo
              </TableCell>

              <TableCell sx={{ fontSize: 13, color: "text.secondary" }}>
                Categoria
              </TableCell>

            </TableRow>

          </TableHead>

          <TableBody>

            {transactions.map(t => {

              const categoria = categories.find(c => c.id === t.categoriaId)

              return (

                <TableRow
                  key={t.id}
                  hover
                  sx={{
                    "&:hover": { bgcolor: "action.hover" },
                    "&:last-child td": { borderBottom: 0 }
                  }}
                >

                  <TableCell sx={{ fontWeight: 500 }}>
                    {t.descricao}
                  </TableCell>

                  <TableCell
                    align="right"
                    sx={{
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 600
                    }}
                  >
                    {t.valor.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL"
                    })}
                  </TableCell>

                  <TableCell>

                    <Chip
                      label={t.tipo === 1 ? "Despesa" : "Receita"}
                      size="small"
                      color={t.tipo === 1 ? "error" : "success"}
                      variant="outlined"
                    />

                  </TableCell>

                  <TableCell>
                    {categoria?.descricao}
                  </TableCell>

                </TableRow>

              )

            })}

          </TableBody>

        </Table>

      </TableContainer>

    </Paper>

  )

}