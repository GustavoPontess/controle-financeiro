import { useState } from "react"
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Typography, Chip, IconButton, TextField, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material"
import EditIcon from "@mui/icons-material/Edit"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import GroupAddOutlinedIcon from "@mui/icons-material/GroupAddOutlined"
import PersonOutlineIcon from "@mui/icons-material/PersonOutline"
import CallSplitIcon from "@mui/icons-material/CallSplit"
import EditTransactionDialog, { type EditableTransaction } from "../EditTransactionDialog/EditTransactionDialog"
import { deleteTransaction } from "../../../services/transactionService"
import {
  getFamilias, compartilharTransacao, getDependentes, atribuirDependente,
  getRateioTransacao, definirRateioTransacao, removerRateioTransacao,
} from "../../../services/familiaService"
import type { Familia, Dependente, ModoRateio, RateioTransacao } from "../../../types/Familia"
import CustomButton from "../../CustomButton"

const MODOS_RATEIO: { value: ModoRateio; label: string }[] = [
  { value: 1, label: "Igualitário" },
  { value: 2, label: "Proporcional à renda" },
  { value: 3, label: "Personalizado" },
]

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
  fontSize: 12, fontWeight: 600, color: "#6b7280",
  bgcolor: "#f9fafb", borderBottom: "1px solid #e5e7eb", py: 1.5,
}

const cellSx = { fontSize: 13, color: "#374151", py: 1.5, borderBottom: "1px solid #f1f5f9" }

export default function TransactionTable({ rows, onRefresh, notify, emptyMessage }: Props) {
  const [editing, setEditing] = useState<EditableTransaction | null>(null)
  const [sharing, setSharing] = useState<TransactionRow | null>(null)
  const [familias, setFamilias] = useState<Familia[]>([])
  const [assigning, setAssigning] = useState<TransactionRow | null>(null)
  const [dependentes, setDependentes] = useState<Dependente[]>([])

  const [ratear, setRatear] = useState<TransactionRow | null>(null)
  const [rateio, setRateio] = useState<RateioTransacao | null>(null)
  const [rateioModo, setRateioModo] = useState<ModoRateio>(1)
  const [percentuais, setPercentuais] = useState<Record<string, string>>({})

  const openShare = async (row: TransactionRow) => {
    setSharing(row)
    try {
      setFamilias(await getFamilias())
    } catch {
      notify({ open: true, message: "Erro ao carregar famílias", severity: "error" })
    }
  }

  const handleShare = async (familiaId: string) => {
    if (!sharing) return
    try {
      await compartilharTransacao(sharing.id, familiaId)
      notify({ open: true, message: "Despesa compartilhada com a família", severity: "success" })
      setSharing(null)
    } catch {
      notify({ open: true, message: "Erro ao compartilhar despesa", severity: "error" })
    }
  }

  const openAssign = async (row: TransactionRow) => {
    setAssigning(row)
    try {
      const fams = await getFamilias()
      const listas = await Promise.all(fams.map(f => getDependentes(f.id)))
      setDependentes(listas.flat())
    } catch {
      notify({ open: true, message: "Erro ao carregar dependentes", severity: "error" })
    }
  }

  const handleAssign = async (dependenteId: string | null) => {
    if (!assigning) return
    try {
      await atribuirDependente(assigning.id, dependenteId)
      notify({
        open: true,
        message: dependenteId ? "Despesa atribuída ao dependente" : "Atribuição removida",
        severity: "success",
      })
      setAssigning(null)
    } catch {
      notify({ open: true, message: "Erro ao atribuir despesa", severity: "error" })
    }
  }

  const openRatear = async (row: TransactionRow) => {
    setRatear(row)
    setRateio(null)
    try {
      const r = await getRateioTransacao(row.id)
      setRateio(r)
      setRateioModo(r.modo ?? 1)
      setPercentuais(Object.fromEntries(
        r.membros.map(m => [m.usuarioId, m.percentual ? String(m.percentual) : ""])))
    } catch {
      notify({
        open: true,
        message: "Defina a despesa como compartilhada antes de ratear",
        severity: "error",
      })
      setRatear(null)
    }
  }

  const handleSalvarRateio = async () => {
    if (!ratear) return
    let itens = null
    if (rateioModo === 3) {
      itens = (rateio?.membros ?? []).map(m => ({
        usuarioId: m.usuarioId,
        percentual: Number(percentuais[m.usuarioId] ?? 0),
      }))
      const soma = itens.reduce((s, i) => s + i.percentual, 0)
      if (Math.abs(soma - 100) > 0.01) {
        notify({ open: true, message: "Os percentuais devem somar 100%", severity: "error" })
        return
      }
    }
    try {
      await definirRateioTransacao(ratear.id, rateioModo, itens)
      notify({ open: true, message: "Rateio definido", severity: "success" })
      setRatear(null)
    } catch {
      notify({ open: true, message: "Erro ao definir rateio", severity: "error" })
    }
  }

  const handleRemoverRateio = async () => {
    if (!ratear) return
    try {
      await removerRateioTransacao(ratear.id)
      notify({ open: true, message: "Override de rateio removido", severity: "success" })
      setRatear(null)
    } catch {
      notify({ open: true, message: "Erro ao remover rateio", severity: "error" })
    }
  }

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
        <Typography fontSize={13} color="#9ca3af">
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
                <TableRow key={row.id} sx={{ "&:hover": { bgcolor: "#fafafa" } }}>
                  <TableCell sx={cellSx}>
                    {new Date(row.data).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, fontWeight: 500, color: "#111827", maxWidth: 220 }}>
                    <Typography fontSize={13} fontWeight={500} noWrap title={row.descricao}>
                      {row.descricao}
                    </Typography>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Typography fontSize={12} color="#6b7280">
                      {row.categoriaDescricao ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Typography fontSize={12} color="#6b7280">
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
                    <Typography fontSize={12} color="#6b7280">
                      {row.meioPagamentoDescricao ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ ...cellSx, textAlign: "right", fontWeight: 600 }}>
                    <Typography fontSize={13} fontWeight={600} color={isReceita ? "#16a34a" : "#dc2626"}>
                      {isReceita ? "+" : "−"}{formatMoney(row.valor)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ ...cellSx, textAlign: "center" }}>
                    {!isReceita && (
                      <IconButton size="small" onClick={() => openShare(row)}
                        title="Compartilhar com família"
                        sx={{ color: "#9ca3af", "&:hover": { color: "#2563eb" } }}>
                        <GroupAddOutlinedIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    )}
                    {!isReceita && (
                      <IconButton size="small" onClick={() => openAssign(row)}
                        title="Atribuir a dependente"
                        sx={{ color: "#9ca3af", "&:hover": { color: "#2563eb" } }}>
                        <PersonOutlineIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    )}
                    {!isReceita && (
                      <IconButton size="small" onClick={() => openRatear(row)}
                        title="Definir rateio"
                        sx={{ color: "#9ca3af", "&:hover": { color: "#2563eb" } }}>
                        <CallSplitIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={() => openEdit(row)}
                      sx={{ color: "#9ca3af", "&:hover": { color: "#374151" } }}>
                      <EditIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(row.id, row.descricao)}
                      sx={{ color: "#9ca3af", "&:hover": { color: "#dc2626" } }}>
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

      <Dialog open={sharing !== null} onClose={() => setSharing(null)} fullWidth maxWidth="xs">
        <DialogTitle>Compartilhar com a família</DialogTitle>
        <DialogContent>
          {familias.length === 0 ? (
            <Typography fontSize={13} color="#9ca3af">
              Você não participa de nenhuma família.
            </Typography>
          ) : (
            <>
              <Typography fontSize={13} color="#6b7280" mb={1.5}>
                Em qual família lançar "{sharing?.descricao}"?
              </Typography>
              {familias.map(f => (
                <Box
                  key={f.id}
                  onClick={() => handleShare(f.id)}
                  sx={{
                    py: 1.25, px: 1.5, mb: 0.5, borderRadius: "8px", cursor: "pointer",
                    border: "1px solid #e5e7eb",
                    "&:hover": { bgcolor: "#f9fafb", borderColor: "#9ca3af" },
                  }}
                >
                  <Typography fontSize={14} fontWeight={500}>{f.nome}</Typography>
                </Box>
              ))}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <CustomButton variant="secondary" size="small" onClick={() => setSharing(null)}>
            Cancelar
          </CustomButton>
        </DialogActions>
      </Dialog>

      <Dialog open={assigning !== null} onClose={() => setAssigning(null)} fullWidth maxWidth="xs">
        <DialogTitle>Atribuir a um dependente</DialogTitle>
        <DialogContent>
          {dependentes.length === 0 ? (
            <Typography fontSize={13} color="#9ca3af">
              Nenhum dependente cadastrado nas suas famílias.
            </Typography>
          ) : (
            <>
              <Typography fontSize={13} color="#6b7280" mb={1.5}>
                A quem atribuir "{assigning?.descricao}"?
              </Typography>
              {dependentes.map(d => (
                <Box
                  key={d.id}
                  onClick={() => handleAssign(d.id)}
                  sx={{
                    py: 1.25, px: 1.5, mb: 0.5, borderRadius: "8px", cursor: "pointer",
                    border: "1px solid #e5e7eb",
                    "&:hover": { bgcolor: "#f9fafb", borderColor: "#9ca3af" },
                  }}
                >
                  <Typography fontSize={14} fontWeight={500}>
                    {d.nome}{d.apelido ? ` (${d.apelido})` : ""}
                  </Typography>
                </Box>
              ))}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <CustomButton variant="secondary" size="small" onClick={() => handleAssign(null)}>
            Remover atribuição
          </CustomButton>
          <CustomButton variant="secondary" size="small" onClick={() => setAssigning(null)}>
            Cancelar
          </CustomButton>
        </DialogActions>
      </Dialog>

      <Dialog open={ratear !== null} onClose={() => setRatear(null)} fullWidth maxWidth="xs">
        <DialogTitle>Rateio de "{ratear?.descricao}"</DialogTitle>
        <DialogContent>
          <Typography fontSize={13} color="#6b7280" mb={1}>
            Define o modo de rateio só para esta despesa, sobrepondo o padrão da família.
          </Typography>
          <TextField
            select fullWidth size="small" margin="dense" label="Modo"
            value={rateioModo}
            onChange={e => setRateioModo(Number(e.target.value) as ModoRateio)}
          >
            {MODOS_RATEIO.map(m => (
              <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
            ))}
          </TextField>
          {rateioModo === 3 && (rateio?.membros ?? []).map(m => (
            <TextField
              key={m.usuarioId}
              fullWidth size="small" margin="dense" type="number"
              label={`${m.nome} (%)`}
              value={percentuais[m.usuarioId] ?? ""}
              onChange={e => setPercentuais(p => ({ ...p, [m.usuarioId]: e.target.value }))}
            />
          ))}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between" }}>
          <CustomButton variant="secondary" size="small" onClick={handleRemoverRateio}>
            Remover override
          </CustomButton>
          <Box sx={{ display: "flex", gap: 1 }}>
            <CustomButton variant="secondary" size="small" onClick={() => setRatear(null)}>
              Cancelar
            </CustomButton>
            <CustomButton size="small" onClick={handleSalvarRateio}>Salvar</CustomButton>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  )
}
