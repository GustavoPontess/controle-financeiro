import { useState, useRef, useCallback } from "react"
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Typography, Chip, IconButton, TextField, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Menu, ListItemIcon, ListItemText,
} from "@mui/material"
import EditIcon from "@mui/icons-material/Edit"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import GroupAddOutlinedIcon from "@mui/icons-material/GroupAddOutlined"
import PersonOutlineIcon from "@mui/icons-material/PersonOutline"
import CallSplitIcon from "@mui/icons-material/CallSplit"
import TrendingUpIcon from "@mui/icons-material/TrendingUp"
import TrendingDownIcon from "@mui/icons-material/TrendingDown"
import MoreVertIcon from "@mui/icons-material/MoreVert"
import EditTransactionDialog, { type EditableTransaction } from "../EditTransactionDialog/EditTransactionDialog"
import { tokens } from "../../../theme/tokens"
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
  subcategoriaId?: string
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
  fontSize: tokens.typography.fontSize["2xs"],
  fontWeight: tokens.typography.fontWeight.medium,
  color: tokens.color.text.secondary,
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
  bgcolor: tokens.color.background.secondary,
  borderBottom: `1px solid ${tokens.color.border.default}`,
  py: 1.5,
}

const cellSx = {
  fontSize: tokens.typography.fontSize.sm,
  color: tokens.color.text.primary,
  py: 1.75,
  borderBottom: `1px solid ${tokens.color.border.subtle}`,
}

type RowActionsProps = {
  isReceita: boolean
  compact: boolean
  onShare: () => void
  onAssign: () => void
  onRatear: () => void
  onEdit: () => void
  onDelete: () => void
}

/**
 * Ações de uma linha. Com a tabela larga mostra os ícones em linha; quando o
 * container fica estreito (`compact`) colapsa num botão "⋮" que abre um menu
 * (ícone + descrição). O menu fecha quando o ponteiro sai dele.
 */
function RowActions({ isReceita, compact, onShare, onAssign, onRatear, onEdit, onDelete }: RowActionsProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const close = () => setAnchor(null)

  const actions = [
    ...(!isReceita
      ? [
          { icon: <GroupAddOutlinedIcon sx={{ fontSize: 18 }} />, label: "Compartilhar com família", run: onShare },
          { icon: <PersonOutlineIcon sx={{ fontSize: 18 }} />, label: "Atribuir a dependente", run: onAssign },
          { icon: <CallSplitIcon sx={{ fontSize: 18 }} />, label: "Definir rateio", run: onRatear },
        ]
      : []),
    { icon: <EditIcon sx={{ fontSize: 18 }} />, label: "Editar", run: onEdit },
    { icon: <DeleteOutlineIcon sx={{ fontSize: 18 }} />, label: "Excluir", run: onDelete, danger: true },
  ]

  if (!compact) {
    return (
      <Box sx={{ display: "flex", flexWrap: "nowrap", justifyContent: "flex-end", gap: 0.25 }}>
        {actions.map((a, i) => (
          <IconButton
            key={i}
            size="small"
            title={a.label}
            onClick={a.run}
            sx={{
              p: 0.5,
              color: tokens.color.text.secondary,
              "&:hover": { color: a.danger ? tokens.color.status.error.main : tokens.color.brand.primary },
            }}
          >
            {a.icon}
          </IconButton>
        ))}
      </Box>
    )
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
      <IconButton
        size="small"
        title="Ações"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ p: 0.5, color: tokens.color.text.secondary }}
      >
        <MoreVertIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        MenuListProps={{ dense: true, onMouseLeave: close }}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {actions.map((a, i) => (
          <MenuItem
            key={i}
            onClick={() => {
              a.run()
              close()
            }}
            sx={{ color: a.danger ? tokens.color.status.error.main : tokens.color.text.primary }}
          >
            <ListItemIcon sx={{ color: "inherit", minWidth: 32 }}>{a.icon}</ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: tokens.typography.fontSize.sm }}>
              {a.label}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}

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

  // Colapsa as ações num menu "⋮" quando a tabela fica estreita demais
  // para os ícones em linha. Mede o container real (não o viewport).
  const [compact, setCompact] = useState(false)
  const [slim, setSlim] = useState(false)
  const roRef = useRef<ResizeObserver | null>(null)
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect()
    roRef.current = null
    if (!el) return
    const ro = new ResizeObserver(() => {
      setCompact(el.clientWidth < 1000)
      setSlim(el.clientWidth < 640)
    })
    ro.observe(el)
    roRef.current = ro
  }, [])

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
      subcategoriaId: row.subcategoriaId,
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
      <TableContainer ref={containerRef}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headerSx}>Data</TableCell>
              <TableCell sx={headerSx}>Descrição</TableCell>
              <TableCell sx={{ ...headerSx, display: slim ? "none" : undefined }}>Categoria</TableCell>
              <TableCell sx={{ ...headerSx, display: slim ? "none" : undefined }}>Conta</TableCell>
              <TableCell sx={{ ...headerSx, display: slim ? "none" : undefined }}>Tipo</TableCell>
              <TableCell sx={{ ...headerSx, display: slim ? "none" : undefined }}>Pagamento</TableCell>
              <TableCell sx={{ ...headerSx, textAlign: "right" }}>Valor</TableCell>
              <TableCell sx={{ ...headerSx, textAlign: "right", whiteSpace: "nowrap", width: 1 }}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const isReceita = row.tipo === RECEITA
              return (
                <TableRow key={row.id} sx={{ "&:hover": { bgcolor: tokens.color.background.hover } }}>
                  <TableCell sx={{ ...cellSx, color: tokens.color.text.secondary, whiteSpace: "nowrap" }}>
                    {new Date(row.data).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, maxWidth: 260 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 34,
                          height: 34,
                          borderRadius: tokens.radius.md,
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: isReceita ? tokens.color.status.success.light : tokens.color.status.error.light,
                          color: isReceita ? tokens.color.status.success.main : tokens.color.status.error.main,
                        }}
                      >
                        {isReceita ? <TrendingUpIcon sx={{ fontSize: 18 }} /> : <TrendingDownIcon sx={{ fontSize: 18 }} />}
                      </Box>
                      <Typography
                        fontSize={tokens.typography.fontSize.sm}
                        fontWeight={tokens.typography.fontWeight.medium}
                        color={tokens.color.text.primary}
                        noWrap
                        title={row.descricao}
                      >
                        {row.descricao}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ ...cellSx, display: slim ? "none" : undefined }}>
                    {row.categoriaDescricao ? (
                      <Chip
                        label={row.categoriaDescricao}
                        size="small"
                        sx={{
                          fontSize: tokens.typography.fontSize["2xs"],
                          height: 22,
                          borderRadius: tokens.radius.sm,
                          bgcolor: tokens.color.background.tertiary,
                          color: tokens.color.text.secondary,
                          fontWeight: tokens.typography.fontWeight.medium,
                        }}
                      />
                    ) : (
                      <Typography fontSize={tokens.typography.fontSize.xs} color={tokens.color.text.disabled}>—</Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ ...cellSx, display: slim ? "none" : undefined }}>
                    <Typography fontSize={tokens.typography.fontSize.xs} color={tokens.color.text.secondary}>
                      {row.contaNome ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ ...cellSx, display: slim ? "none" : undefined }}>
                    <Chip
                      label={isReceita ? "Receita" : "Despesa"}
                      size="small"
                      sx={{
                        fontSize: tokens.typography.fontSize["2xs"],
                        height: 22,
                        borderRadius: tokens.radius.sm,
                        fontWeight: tokens.typography.fontWeight.medium,
                        bgcolor: isReceita ? tokens.color.status.success.light : tokens.color.status.error.light,
                        color: isReceita ? tokens.color.status.success.dark : tokens.color.status.error.dark,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ ...cellSx, display: slim ? "none" : undefined }}>
                    <Typography fontSize={tokens.typography.fontSize.xs} color={tokens.color.text.secondary}>
                      {row.meioPagamentoDescricao ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ ...cellSx, textAlign: "right", whiteSpace: "nowrap" }}>
                    <Typography
                      fontSize={tokens.typography.fontSize.sm}
                      fontWeight={tokens.typography.fontWeight.bold}
                      color={isReceita ? tokens.color.status.success.main : tokens.color.status.error.main}
                    >
                      {isReceita ? "+" : "−"}{formatMoney(row.valor)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ ...cellSx, whiteSpace: "nowrap" }}>
                    <RowActions
                      isReceita={isReceita}
                      compact={compact}
                      onShare={() => openShare(row)}
                      onAssign={() => openAssign(row)}
                      onRatear={() => openRatear(row)}
                      onEdit={() => openEdit(row)}
                      onDelete={() => handleDelete(row.id, row.descricao)}
                    />
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
