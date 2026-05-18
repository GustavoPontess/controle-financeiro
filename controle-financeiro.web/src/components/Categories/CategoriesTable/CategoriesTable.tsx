import { Box, Paper } from "@mui/material"
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

const getFinalidade = (f: number) => {
  if (f === 1) return "Despesa"
  if (f === 2) return "Receita"
  return "Ambas"
}

export default function CategoriesTable({ categories }: Props) {
  return (
    <Paper elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: "12px", overflow: "hidden" }}>
      <Box sx={{ px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", fontWeight: 600, fontSize: 13 }}>
        Lista de Categorias
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell sx={{ fontSize: 12, color: "text.secondary", py: 1 }}>Descrição</TableCell>
              <TableCell sx={{ fontSize: 12, color: "text.secondary", py: 1 }}>Finalidade</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map(c => (
              <TableRow
                key={c.id}
                hover
                sx={{ "&:hover": { bgcolor: "action.hover" }, "&:last-child td": { borderBottom: 0 } }}
              >
                <TableCell sx={{ fontSize: 13, fontWeight: 500, py: 1 }}>{c.descricao}</TableCell>
                <TableCell sx={{ fontSize: 13, py: 1 }}>{getFinalidade(c.finalidade)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}
