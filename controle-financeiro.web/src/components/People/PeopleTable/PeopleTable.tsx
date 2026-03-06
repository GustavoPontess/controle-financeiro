import {
  Box,
  Paper,
  IconButton
} from "@mui/material"

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
        Lista de Pessoas
      </Box>

      <TableContainer>

        <Table size="small">

          <TableHead>

            <TableRow sx={{ backgroundColor: "#fafafa" }}>

              <TableCell sx={{ fontSize: 13, color: "#6b7280" }}>
                Nome
              </TableCell>

              <TableCell sx={{ fontSize: 13, color: "#6b7280" }}>
                Idade
              </TableCell>

              <TableCell align="right" sx={{ fontSize: 13, color: "#6b7280" }}>
                Ações
              </TableCell>

            </TableRow>

          </TableHead>

          <TableBody>

            {people.map(p => (

              <TableRow
                key={p.id}
                hover
                sx={{
                  "&:hover": { backgroundColor: "#f9fafb" },
                  "&:last-child td": { borderBottom: 0 }
                }}
              >

                <TableCell sx={{ fontWeight: 500 }}>
                  {p.nome}
                </TableCell>

                <TableCell>
                  {p.idade}
                </TableCell>

                <TableCell align="right">

                  <IconButton onClick={() => onEdit(p)}>
                    <EditIcon fontSize="small" />
                  </IconButton>

                  <IconButton
                    color="error"
                    onClick={() => onDelete(p.id)}
                  >
                    <DeleteIcon fontSize="small" />
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