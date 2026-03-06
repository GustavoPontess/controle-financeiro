import {
  Box,
  Paper
} from "@mui/material"

import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"

import type { Category } from "../../../types/Category"

type Props = {
  categories: Category[]
}

export default function CategoriesTable({ categories }: Props) {

  const getFinalidade = (f: number) => {
    if (f === 1) return "Despesa"
    if (f === 2) return "Receita"
    return "Ambas"
  }

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
          fontWeight: 600
        }}
      >
        Lista de Categorias
      </Box>

      <TableContainer>

        <Table size="small">

          <TableHead>

            <TableRow sx={{ backgroundColor: "#fafafa" }}>

              <TableCell sx={{ fontSize: 13, color: "#6b7280" }}>
                Descrição
              </TableCell>

              <TableCell sx={{ fontSize: 13, color: "#6b7280" }}>
                Finalidade
              </TableCell>

            </TableRow>

          </TableHead>

          <TableBody>

            {categories.map(c => (

              <TableRow
                key={c.id}
                hover
                sx={{
                  "&:hover": { backgroundColor: "#f9fafb" },
                  "&:last-child td": { borderBottom: 0 }
                }}
              >

                <TableCell sx={{ fontWeight: 500 }}>
                  {c.descricao}
                </TableCell>

                <TableCell>
                  {getFinalidade(c.finalidade)}
                </TableCell>

              </TableRow>

            ))}

          </TableBody>

        </Table>

      </TableContainer>

    </Paper>

  )
}