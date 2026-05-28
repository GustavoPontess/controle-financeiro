/**
 * BancosPage — #88 refactor. Zero MUI, zero tokens.ts. CSS Modules + var(--pontes-*).
 *
 * Layout: header → 3 stat cards → grid de bancos → contas sem banco.
 * Saldo vem de `conta.saldoAtual` — sem chamar getTransactions().
 * Logo via PontesBankBadge (img real + fallback de iniciais).
 * NewContaDialog ainda é legacy (refatorar em PR separado).
 */

import { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { Plus, Pencil, Trash2 } from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesBadge,
  PontesStatCard, PontesEmptyState, PontesLoadingDots, PontesDialog,
  PontesBankBadge,
} from "@/components/pontes"
import NewContaDialog from "../../components/Contas/NewContaDialog/NewContaDialog"
import { getBancos } from "../../services/bancoService"
import { getContas, deleteConta } from "../../services/contaService"
import type { Banco } from "../../types/Banco"
import type { Conta } from "../../types/Conta"
import styles from "./BancosPage.module.css"

// ── helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)

// Tone por tipo de conta (badge de tipo)
const TIPO_TONE: Record<number, "primary" | "success" | "accent" | "neutral"> = {
  1: "primary",   // Corrente
  2: "success",   // Poupança
  4: "accent",    // Investimento
  5: "neutral",   // Outro
}

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

// ── Component ─────────────────────────────────────────────────────────────────

export default function BancosPage() {
  const { notify } = useOutletContext<OutletContextType>()

  const [bancos, setBancos] = useState<Banco[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [loading, setLoading] = useState(true)

  const [openDialog, setOpenDialog] = useState(false)
  const [editingConta, setEditingConta] = useState<Conta | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Conta | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [bs, cs] = await Promise.all([getBancos(), getContas()])
      setBancos(bs)
      setContas(cs.filter(c => c.tipo !== 3)) // Excluir CartaoCredito (tipo 3)
    } catch {
      notify({ open: true, message: "Erro ao carregar contas", severity: "error" })
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => { void loadData() }, [loadData])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteConta(deleteTarget.id)
      notify({ open: true, message: "Conta removida com sucesso", severity: "success" })
      setDeleteTarget(null)
      await loadData()
    } catch {
      notify({ open: true, message: "Erro ao remover conta", severity: "error" })
    } finally {
      setDeleting(false)
    }
  }

  // Agrupamentos
  const contasSemBanco = contas.filter(c => !c.bancoId)
  const bancosComContas = bancos.filter(b => contas.some(c => c.bancoId === b.id))
  const saldoTotal = contas.reduce((s, c) => s + c.saldoAtual, 0)

  if (loading) {
    return (
      <div className={styles.center}>
        <PontesLoadingDots />
      </div>
    )
  }

  const isEmpty = bancosComContas.length === 0 && contas.length === 0

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Bancos e Contas</h1>
          <p className={styles.subtitle}>
            Gerencie suas contas bancárias e acompanhe saldos em tempo real.
          </p>
        </div>
        <PontesButton
          variant="primary"
          size="sm"
          icon={<Plus size={15} />}
          onClick={() => { setEditingConta(null); setOpenDialog(true) }}
        >
          Adicionar Conta
        </PontesButton>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <PontesStatCard label="Bancos" value={String(bancosComContas.length)} />
        <PontesStatCard label="Contas" value={String(contas.length)} />
        <PontesStatCard label="Saldo total" value={fmt(saldoTotal)} />
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <PontesEmptyState
          title="Nenhuma conta cadastrada"
          description="Adicione sua primeira conta para começar a gerenciar seus saldos."
          actions={
            <PontesButton
              variant="primary"
              size="sm"
              icon={<Plus size={15} />}
              onClick={() => { setEditingConta(null); setOpenDialog(true) }}
            >
              Adicionar Conta
            </PontesButton>
          }
        />
      ) : (
        <>
          {/* Bancos com contas */}
          {bancosComContas.length > 0 && (
            <div className={styles.grid}>
              {bancosComContas.map(banco => {
                const contasDoBanco = contas.filter(c => c.bancoId === banco.id)
                const saldo = contasDoBanco.reduce((s, c) => s + c.saldoAtual, 0)
                const firstConta = contasDoBanco[0]

                return (
                  <div key={banco.id} className={styles.card}>
                    {/* Card header */}
                    <div className={styles.cardHead}>
                      <div className={styles.cardHeadLeft}>
                        <PontesBankBadge
                          name={banco.nomeFantasia}
                          logoUrl={banco.logoUrl}
                          cor={banco.cor}
                          size={40}
                        />
                        <div>
                          <p className={styles.bankName}>{banco.nomeFantasia}</p>
                          <p className={styles.bankType}>{banco.tipoDescricao}</p>
                        </div>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className={styles.cardBody}>
                      <span className={styles.saldoLabel}>Saldo</span>
                      <span className={styles.saldoValue} data-neg={saldo < 0 ? "true" : undefined}>
                        {fmt(saldo)}
                      </span>
                      <div className={styles.metaRow}>
                        <div className={styles.metaChip}>
                          <div className={styles.metaChipLabel}>Contas</div>
                          <div className={styles.metaChipValue}>{contasDoBanco.length}</div>
                        </div>
                      </div>
                    </div>

                    {/* Card footer actions */}
                    <div className={styles.cardFoot}>
                      {firstConta && !firstConta.isCarteira && (
                        <>
                          <PontesIconButton
                            size="sm"
                            title="Editar"
                            onClick={() => { setEditingConta(firstConta); setOpenDialog(true) }}
                          >
                            <Pencil size={14} />
                          </PontesIconButton>
                          <PontesIconButton
                            size="sm"
                            tone="danger"
                            title="Excluir"
                            onClick={() => setDeleteTarget(firstConta)}
                          >
                            <Trash2 size={14} />
                          </PontesIconButton>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Contas sem banco */}
          {contasSemBanco.length > 0 && (
            <div className={styles.orphanCard}>
              <div className={styles.orphanHeader}>
                <span className={styles.orphanTitle}>Sem banco vinculado</span>
              </div>
              {contasSemBanco.map(conta => {
                const tone = TIPO_TONE[conta.tipo] ?? "neutral"
                return (
                  <div key={conta.id} className={styles.orphanRow}>
                    <div className={styles.orphanLeft}>
                      <PontesBadge tone={tone} size="sm">{conta.tipoDescricao}</PontesBadge>
                      <span className={styles.orphanName}>{conta.nome}</span>
                    </div>
                    <div className={styles.orphanRight}>
                      <span className={styles.orphanSaldo}>{fmt(conta.saldoAtual)}</span>
                      {!conta.isCarteira && (
                        <>
                          <PontesIconButton
                            size="sm"
                            title="Editar"
                            onClick={() => { setEditingConta(conta); setOpenDialog(true) }}
                          >
                            <Pencil size={14} />
                          </PontesIconButton>
                          <PontesIconButton
                            size="sm"
                            tone="danger"
                            title="Excluir"
                            onClick={() => setDeleteTarget(conta)}
                          >
                            <Trash2 size={14} />
                          </PontesIconButton>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Dialog: Criar / Editar conta */}
      <NewContaDialog
        open={openDialog}
        editingConta={editingConta}
        bancos={bancos}
        onClose={() => { setOpenDialog(false); setEditingConta(null) }}
        onSaved={loadData}
        notify={notify}
      />

      {/* Dialog: Confirmar exclusão */}
      {deleteTarget && (
        <PontesDialog
          open
          title="Excluir conta"
          description={`Remover "${deleteTarget.nome}"? Esta ação não pode ser desfeita.`}
          tone="danger"
          confirmLabel={deleting ? "Excluindo…" : "Confirmar"}
          onConfirm={() => { void handleDelete() }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
