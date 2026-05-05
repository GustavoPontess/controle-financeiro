import { Paper, Box, Typography, IconButton } from "@mui/material"
import EditIcon from "@mui/icons-material/Edit"
import DeleteIcon from "@mui/icons-material/Delete"
import SyncIcon from "@mui/icons-material/Sync"

import type { Conta } from "../../types/Conta"
import type { Banco } from "../../types/Banco"

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

type Props = {
  conta: Conta
  banco?: Banco | null
  balance: number
  transactionCount: number
  onEdit?: () => void
  onDelete?: () => void
  onSync?: () => void
}

export default function AccountCard({ conta, banco, balance, transactionCount, onEdit, onDelete, onSync }: Props) {
  const isCard = conta.tipo === 3

  return (
    <Paper elevation={0} sx={{ border: "1px solid #e5e7eb", borderRadius: "12px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Box sx={{ px: 3, py: 2.5, borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: banco?.cor || "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>
            {banco?.nomeFantasia?.charAt(0)?.toUpperCase() ?? conta.nome.charAt(0).toUpperCase()}
          </Box>
          <Box>
            <Typography fontSize={14} fontWeight={600} color="#111827">{banco?.nomeFantasia || conta.nome}</Typography>
            <Typography fontSize={12} color="#6b7280">{conta.tipoDescricao}</Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography fontSize={16} fontWeight={700} color="#15803d">{formatMoney(balance)}</Typography>
        </Box>
      </Box>

      <Box sx={{ px: 3, py: 2.5, flex: 1 }}>
        {isCard ? (
          <Box>
            <Typography fontSize={12} color="#6b7280">Número</Typography>
            <Typography fontSize={14} fontWeight={600} color="#111827">{conta.numeroConta ? conta.numeroConta : "—"}</Typography>
          </Box>
        ) : (
          <Box>
            <Typography fontSize={12} color="#6b7280">Transações no mês</Typography>
            <Typography fontSize={14} fontWeight={700} color="#111827">{transactionCount}</Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ px: 3, py: 2, borderTop: "1px solid #f1f5f9", display: "flex", gap: 1, justifyContent: "flex-end" }}>
        <IconButton size="small" onClick={onSync} sx={{ color: "#6b7280" }} title="Sincronizar">
          <SyncIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton size="small" onClick={onEdit} sx={{ color: "#6b7280" }} title="Editar">
          <EditIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton size="small" onClick={onDelete} sx={{ color: "#ef4444" }} title="Remover">
          <DeleteIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Paper>
  )
}
