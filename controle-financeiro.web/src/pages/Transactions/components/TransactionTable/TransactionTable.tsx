import React, { useState, useRef, useCallback } from "react"
import {
  Pencil, Trash2, Users, User, Split, TrendingUp, TrendingDown, MoreVertical,
} from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesBadge, PontesModal, PontesDialog,
  PontesField, PontesInput, PontesSelect, PontesTablePagination,
} from "@/components/pontes"
import EditTransactionDialog, { type EditableTransaction } from "../EditTransactionDialog/EditTransactionDialog"
import { deleteTransaction } from "../../../../services/transactionService"
import {
  getFamilias, compartilharTransacao, getDependentes, atribuirDependente,
  getRateioTransacao, definirRateioTransacao, removerRateioTransacao,
} from "../../../../services/familiaService"
import type { Familia, Dependente, ModoRateio, RateioTransacao } from "../../../../types/Familia"
import styles from "./TransactionTable.module.css"

const MODOS_RATEIO: { value: string; label: string }[] = [
  { value: "1", label: "Igualitário" },
  { value: "2", label: "Proporcional à renda" },
  { value: "3", label: "Personalizado" },
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
  /**
   * Paginação **controlled** pelo container. `rows` é só a página visível;
   * `total` é o total real do backend (pra calcular nº de páginas no rodapé).
   * Sem essa prop, a tabela mostra `rows` sem rodapé de paginação.
   */
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
    onPageSizeChange: (size: number) => void
  }
}

const formatMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

const RECEITA = 2

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
 * container fica estreito (`compact`) colapsa num botão "⋮" que abre um menu.
 */
function RowActions({ isReceita, compact, onShare, onAssign, onRatear, onEdit, onDelete }: RowActionsProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const actions = [
    ...(!isReceita
      ? [
          { icon: <Users size={16} />, label: "Compartilhar com família", run: onShare },
          { icon: <User size={16} />, label: "Atribuir a dependente", run: onAssign },
          { icon: <Split size={16} />, label: "Definir rateio", run: onRatear },
        ]
      : []),
    { icon: <Pencil size={14} />, label: "Editar", run: onEdit },
    { icon: <Trash2 size={14} />, label: "Excluir", run: onDelete, danger: true },
  ]

  if (!compact) {
    return (
      <div className={styles.rowActions}>
        {actions.map((a, i) => (
          <PontesIconButton key={i} size={32} variant="ghost" aria-label={a.label} onClick={a.run}>
            {a.icon}
          </PontesIconButton>
        ))}
      </div>
    )
  }

  return (
    <div ref={wrapRef} className={styles.compactWrap} onMouseLeave={() => setOpen(false)}>
      <PontesIconButton size={32} variant="ghost" aria-label="Ações" onClick={() => setOpen((v) => !v)}>
        <MoreVertical size={16} />
      </PontesIconButton>
      {open && (
        <div className={styles.menu}>
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              className={styles.menuItem}
              data-danger={a.danger ? "true" : undefined}
              onClick={() => { a.run(); setOpen(false) }}
            >
              <span className={styles.menuItemIcon}>{a.icon}</span>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TransactionTable({ rows, onRefresh, notify, emptyMessage, pagination }: Props) {
  const [editing, setEditing] = useState<EditableTransaction | null>(null)
  const [sharing, setSharing] = useState<TransactionRow | null>(null)
  const [familias, setFamilias] = useState<Familia[]>([])
  const [assigning, setAssigning] = useState<TransactionRow | null>(null)
  const [dependentes, setDependentes] = useState<Dependente[]>([])

  const [ratear, setRatear] = useState<TransactionRow | null>(null)
  const [rateio, setRateio] = useState<RateioTransacao | null>(null)
  const [rateioModo, setRateioModo] = useState<ModoRateio>(1)
  const [percentuais, setPercentuais] = useState<Record<string, string>>({})

  const [delTx, setDelTx] = useState<TransactionRow | null>(null)

  // `rows` chega já paginado/filtrado pelo backend (controlled). Não fatia aqui.
  const pagedRows = rows

  // Colapsa as ações quando a tabela fica estreita demais. Observa container real.
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
      const listas = await Promise.all(fams.map((f) => getDependentes(f.id)))
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
        r.membros.map((m) => [m.usuarioId, m.percentual ? String(m.percentual) : ""])))
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
      itens = (rateio?.membros ?? []).map((m) => ({
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

  const handleDelete = async () => {
    if (!delTx) return
    try {
      await deleteTransaction(delTx.id)
      notify({ open: true, message: "Transação excluída", severity: "success" })
      onRefresh()
    } catch {
      notify({ open: true, message: "Erro ao excluir transação", severity: "error" })
    } finally {
      setDelTx(null)
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

  // Empty state real = backend devolveu total zero. Em modo paginado, rows
  // pode estar vazio mid-flight (carregando próxima página); o total é a
  // fonte da verdade.
  const trulyEmpty = pagination ? pagination.total === 0 : rows.length === 0
  if (trulyEmpty) {
    return (
      <div className={styles.empty}>{emptyMessage ?? "Nenhuma transação encontrada"}</div>
    )
  }

  return (
    <>
      <div ref={containerRef} className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              {!slim && <th>Categoria</th>}
              {!slim && <th>Conta</th>}
              {!slim && <th>Tipo</th>}
              {!slim && <th>Pagamento</th>}
              <th className={styles.alignRight}>Valor</th>
              <th className={styles.alignRight}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => {
              const isReceita = row.tipo === RECEITA
              return (
                <tr key={row.id}>
                  <td className={styles.cellMuted}>
                    {new Date(row.data).toLocaleDateString("pt-BR")}
                  </td>
                  <td>
                    <div className={styles.descCell}>
                      <span className={styles.tipoIcon} data-tone={isReceita ? "success" : "danger"}>
                        {isReceita ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      </span>
                      <span className={styles.descText} title={row.descricao}>{row.descricao}</span>
                    </div>
                  </td>
                  {!slim && (
                    <td>
                      {row.categoriaDescricao
                        ? <PontesBadge tone="neutral" size="sm">{row.categoriaDescricao}</PontesBadge>
                        : <span className={styles.cellMuted}>—</span>}
                    </td>
                  )}
                  {!slim && (
                    <td className={styles.cellMuted}>{row.contaNome ?? "—"}</td>
                  )}
                  {!slim && (
                    <td>
                      <PontesBadge tone={isReceita ? "success" : "danger"} size="sm">
                        {isReceita ? "Receita" : "Despesa"}
                      </PontesBadge>
                    </td>
                  )}
                  {!slim && (
                    <td className={styles.cellMuted}>{row.meioPagamentoDescricao ?? "—"}</td>
                  )}
                  <td className={styles.alignRight + " " + styles.valueCell} data-tone={isReceita ? "success" : "danger"}>
                    {isReceita ? "+" : "−"}{formatMoney(row.valor)}
                  </td>
                  <td className={styles.alignRight}>
                    <RowActions
                      isReceita={isReceita}
                      compact={compact}
                      onShare={() => openShare(row)}
                      onAssign={() => openAssign(row)}
                      onRatear={() => openRatear(row)}
                      onEdit={() => openEdit(row)}
                      onDelete={() => setDelTx(row)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {pagination && (
          <PontesTablePagination
            total={pagination.total}
            page={pagination.page}
            pageSize={pagination.pageSize}
            onPageChange={pagination.onPageChange}
            onPageSizeChange={pagination.onPageSizeChange}
            itemLabel="lançamentos"
            itemLabelSingular="lançamento"
          />
        )}
      </div>

      <EditTransactionDialog
        transaction={editing}
        onClose={() => setEditing(null)}
        onSaved={onRefresh}
        notify={notify}
      />

      {/* Compartilhar com família */}
      <PontesModal
        open={sharing !== null}
        title="Compartilhar com a família"
        onClose={() => setSharing(null)}
        footer={<PontesButton variant="outline" onClick={() => setSharing(null)}>Cancelar</PontesButton>}
      >
        {familias.length === 0 ? (
          <div className={styles.modalMuted}>Você não participa de nenhuma família.</div>
        ) : (
          <>
            <p className={styles.modalIntro}>Em qual família lançar “{sharing?.descricao}”?</p>
            <div className={styles.optionList}>
              {familias.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={styles.optionItem}
                  onClick={() => handleShare(f.id)}
                >
                  {f.nome}
                </button>
              ))}
            </div>
          </>
        )}
      </PontesModal>

      {/* Atribuir a dependente */}
      <PontesModal
        open={assigning !== null}
        title="Atribuir a um dependente"
        onClose={() => setAssigning(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => handleAssign(null)}>Remover atribuição</PontesButton>
          <PontesButton variant="outline" onClick={() => setAssigning(null)}>Cancelar</PontesButton>
        </>}
      >
        {dependentes.length === 0 ? (
          <div className={styles.modalMuted}>Nenhum dependente cadastrado nas suas famílias.</div>
        ) : (
          <>
            <p className={styles.modalIntro}>A quem atribuir “{assigning?.descricao}”?</p>
            <div className={styles.optionList}>
              {dependentes.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={styles.optionItem}
                  onClick={() => handleAssign(d.id)}
                >
                  {d.nome}{d.apelido ? ` (${d.apelido})` : ""}
                </button>
              ))}
            </div>
          </>
        )}
      </PontesModal>

      {/* Rateio */}
      <PontesModal
        open={ratear !== null}
        title={`Rateio de “${ratear?.descricao ?? ""}”`}
        onClose={() => setRatear(null)}
        footer={<>
          <PontesButton variant="outline" onClick={handleRemoverRateio}>Remover override</PontesButton>
          <PontesButton variant="outline" onClick={() => setRatear(null)}>Cancelar</PontesButton>
          <PontesButton onClick={handleSalvarRateio}>Salvar</PontesButton>
        </>}
      >
        <p className={styles.modalIntro}>Define o modo de rateio só para esta despesa, sobrepondo o padrão da família.</p>
        <PontesField label="Modo">
          <PontesSelect
            value={String(rateioModo)}
            onChange={(v) => setRateioModo(Number(v) as ModoRateio)}
            options={MODOS_RATEIO}
          />
        </PontesField>
        {rateioModo === 3 && (rateio?.membros ?? []).map((m) => (
          <PontesField key={m.usuarioId} label={`${m.nome} (%)`}>
            <PontesInput
              type="number"
              value={percentuais[m.usuarioId] ?? ""}
              onChange={(e) => setPercentuais((p) => ({ ...p, [m.usuarioId]: e.target.value }))}
              min={0} max={100} step="0.01"
            />
          </PontesField>
        ))}
      </PontesModal>

      <PontesDialog
        open={delTx !== null}
        title="Excluir transação?"
        description={`Excluir “${delTx?.descricao ?? ""}”? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDelTx(null)}
      />
    </>
  )
}
