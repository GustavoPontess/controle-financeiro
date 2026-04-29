import { Box, Paper, IconButton, Chip } from "@mui/material"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import EditIcon from "@mui/icons-material/Edit"
import DeleteIcon from "@mui/icons-material/Delete"
import type { Conta } from "../../../types/Conta"

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const tipoColor: Record<number, { bg: string; color: string }> = {
  1: { bg: "#dbeafe", color: "#1d4ed8" },
  2: { bg: "#dcfce7", color: "#15803d" },
  3: { bg: "#ede9fe", color: "#7c3aed" },
  4: { bg: "#ccfbf1", color: "#0f766e" },
  5: { bg: "#ffedd5", color: "#c2410c" },
}

type Props = {
  contas: Conta[]
  onEdit: (conta: Conta) => void
  onDelete: (id: string) => void
}

export default function ContasTable({ contas, onEdit, onDelete }: Props) {
  return (
    <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: "12px", overflow: "hidden" }}>
      <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid #f1f5f9", fontWeight: 600, fontSize: 13 }}>
        Lista de Contas
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#fafafa" }}>
              <TableCell sx={{ fontSize: 12, color: "#9ca3af", py: 1 }}>Nome</TableCell>
              <TableCell sx={{ fontSize: 12, color: "#9ca3af", py: 1 }}>Tipo</TableCell>
              <TableCell sx={{ fontSize: 12, color: "#9ca3af", py: 1 }}>Saldo Inicial</TableCell>
              <TableCell align="right" sx={{ fontSize: 12, color: "#9ca3af", py: 1 }}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contas.map(c => {
              const colors = tipoColor[c.tipo] ?? { bg: "#f3f4f6", color: "#374151" }
              return (
                <TableRow
                  key={c.id}
                  hover
                  sx={{ "&:hover": { backgroundColor: "#f9fafb" }, "&:last-child td": { borderBottom: 0 } }}
                >
                  <TableCell sx={{ fontSize: 13, fontWeight: 500, py: 1.5 }}>{c.nome}</TableCell>
                  <TableCell sx={{ py: 1.5 }}>
                    <Chip
                      label={c.tipoDescricao}
                      size="small"
                      sx={{
                        fontSize: 11,
                        height: 22,
                        borderRadius: "6px",
                        backgroundColor: colors.bg,
                        color: colors.color,
                        fontWeight: 500,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, py: 1.5 }}>{formatMoney(c.saldoInicial)}</TableCell>
                  <TableCell align="right" sx={{ py: 0.5 }}>
                    <IconButton size="small" onClick={() => onEdit(c)} sx={{ color: "#6b7280" }}>
                      <EditIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => onDelete(c.id)} sx={{ color: "#ef4444" }}>
                      <DeleteIcon sx={{ fontSize: 15 }} />
                    </IconButton>
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
