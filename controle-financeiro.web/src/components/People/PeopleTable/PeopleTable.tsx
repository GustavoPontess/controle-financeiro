import { Box, Paper, IconButton } from "@mui/material"
import EditIcon from "@mui/icons-material/Edit"
import DeleteIcon from "@mui/icons-material/Delete"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import type { Person } from "../../../types/Person"

type Props = {
  people: Person[]
  onEdit: (person: Person) => void
  onDelete: (id: string) => void
}

export default function PeopleTable({ people, onEdit, onDelete }: Props) {
  return (
    <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
      <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid #f1f5f9", fontWeight: 600, fontSize: 13 }}>
        Lista de Pessoas
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#fafafa" }}>
              <TableCell sx={{ fontSize: 12, color: "#9ca3af", py: 1 }}>Nome</TableCell>
              <TableCell sx={{ fontSize: 12, color: "#9ca3af", py: 1 }}>Nascimento</TableCell>
              <TableCell sx={{ fontSize: 12, color: "#9ca3af", py: 1 }}>Idade</TableCell>
              <TableCell align="right" sx={{ fontSize: 12, color: "#9ca3af", py: 1 }}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {people.map(p => (
              <TableRow
                key={p.id}
                hover
                sx={{ "&:hover": { backgroundColor: "#f9fafb" }, "&:last-child td": { borderBottom: 0 } }}
              >
                <TableCell sx={{ fontSize: 13, fontWeight: 500, py: 1 }}>{p.nome}</TableCell>
                <TableCell sx={{ fontSize: 13, py: 1 }}>
                  {new Date(p.dataNascimento).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell sx={{ fontSize: 13, py: 1 }}>{p.idade} anos</TableCell>
                <TableCell align="right" sx={{ py: 0.5 }}>
                  <IconButton size="small" onClick={() => onEdit(p)} sx={{ color: "#6b7280" }}>
                    <EditIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => onDelete(p.id)} sx={{ color: "#ef4444" }}>
                    <DeleteIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}
