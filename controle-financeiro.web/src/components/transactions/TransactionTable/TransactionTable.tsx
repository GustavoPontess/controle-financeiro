import { useState } from "react"
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Typography, Chip, IconButton,
} from "@mui/material"
import EditIcon from "@mui/icons-material/Edit"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import EditTransactionDialog, { type EditableTransaction } from "../EditTransactionDialog/EditTransactionDialog"
import { deleteTransaction } from "../../../services/transactionService"

export interface TransactionRow {
  id: string
  descricao: string
  valor: number
  tipo: number
  data: string
  categoriaId?: string
  categoriaDescricao?: string
  contaId?: string
  cartaoCreditoId?: string
  contaNome?: string
  meioPagamento?: number
  meioPagamentoDescricao?: string
}

type Notification = { open: boolean; message: string; severity: "success" | "error" }

type Props = {
  rows: TransactionRow[]
  onRefresh: () => void
  notify: React.Dispatch<React.SetStateAction<Notification>>
  emptyMessage?: string
}

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const RECEITA = 2

const headerSx = {
  fontSize: 12, fontWeight: 600, color: "text.secondary",
  bgcolor: "action.hover", borderBottom: 1, borderColor: "divider", py: 1.5,
}

const cellSx = { fontSize: 13, color: "text.primary", py: 1.5, borderBottom: 1, borderColor: "divider" }

export default function TransactionTable({ rows, onRefresh, notify, emptyMessage }: Props) {
  const [editing, setEditing] = useState<EditableTransaction | null>(null)

  const handleDelete = async (id: string, descricao: string) => {
    if (!confirm(`Excluir "${descricao}"?`)) return
    try {
      await deleteTransaction(id)
      notify({ open: true, message: "Transação excluída", severity: "success" })
      onRefresh()
    } catch {
      notify({ open: true, message: "Erro ao excluir transação", severity: "error" })
    }
  }

  const openEdit = (row: TransactionRow) => {
    setEditing({
      id: row.id,
      descricao: row.descricao,
      valor: row.valor,
      tipo: row.tipo,
      categoriaId: row.categoriaId,
      contaId: row.contaId,
      cartaoCreditoId: row.cartaoCreditoId,
      meioPagamento: row.meioPagamento,
      data: row.data,
    })
  }

  if (rows.length === 0) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <Typography fontSize={13} color="text.secondary">
          {emptyMessage ?? "Nenhuma transação encontrada"}
        </Typography>
      </Box>
    )
  }

  return (
    <>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headerSx}>Data</TableCell>
              <TableCell sx={headerSx}>Descrição</TableCell>
              <TableCell sx={headerSx}>Categoria</TableCell>
              <TableCell sx={headerSx}>Conta</TableCell>
              <TableCell sx={headerSx}>Tipo</TableCell>
              <TableCell sx={headerSx}>Pagamento</TableCell>
              <TableCell sx={{ ...headerSx, textAlign: "right" }}>Valor</TableCell>
              <TableCell sx={{ ...headerSx, textAlign: "center", width: 80 }}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const isReceita = row.tipo === RECEITA
              return (
                <TableRow key={row.id} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                  <TableCell sx={cellSx}>
                    {new Date(row.data).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, fontWeight: 500, color: "text.primary", maxWidth: 220 }}>
                    <Typography fontSize={13} fontWeight={500} noWrap title={row.descricao}>
                      {row.descricao}
                    </Typography>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Typography fontSize={12} color="text.secondary">
                      {row.categoriaDescricao ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Typography fontSize={12} color="text.secondary">
                      {row.contaNome ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Chip
                      label={isReceita ? "Receita" : "Despesa"}
                      size="small"
                      sx={{
                        fontSize: 11, height: 20, borderRadius: "4px",
                        bgcolor: isReceita ? "#dcfce7" : "#fee2e2",
                        color: isReceita ? "#16a34a" : "#dc2626",
                      }}
                    />
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Typography fontSize={12} color="text.secondary">
                      {row.meioPagamentoDescricao ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ ...cellSx, textAlign: "right", fontWeight: 600 }}>
                    <Typography fontSize={13} fontWeight={600} color={isReceita ? "#16a34a" : "#dc2626"}>
                      {isReceita ? "+" : "−"}{formatMoney(row.valor)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ ...cellSx, textAlign: "center" }}>
                    <IconButton size="small" onClick={() => openEdit(row)}
                      sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}>
                      <EditIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(row.id, row.descricao)}
                      sx={{ color: "text.secondary", "&:hover": { color: "#dc2626" } }}>
                      <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <EditTransactionDialog
        transaction={editing}
        onClose={() => setEditing(null)}
        onSaved={onRefresh}
        notify={notify}
      />
    </>
  )
}
