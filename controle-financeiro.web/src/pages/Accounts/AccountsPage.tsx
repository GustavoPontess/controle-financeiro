/**
 * AccountsPage — #88 refactor. Zero MUI, zero tokens.ts. CSS Modules + var(--pontes-*).
 *
 * - Saldo via conta.saldoAtual (sem getTransactions).
 * - PontesBankBadge mostra logo real do banco com fallback de iniciais.
 * - Carteira: card dark especial (não editável, criada automaticamente).
 * - NewContaDialog ainda é legacy (refatorar em PR separado).
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { Plus, Wallet, Landmark } from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesBadge,
  PontesStatCard, PontesEmptyState, PontesLoadingDots, PontesDialog,
  PontesBankBadge,
} from "@/components/pontes"
import NewContaDialog from "../../components/Contas/NewContaDialog/NewContaDialog"
import { getContas, deleteConta } from "../../services/contaService"
import { getBancos } from "../../services/bancoService"
import type { Conta } from "../../types/Conta"
import type { Banco } from "../../types/Banco"
import styles from "./AccountsPage.module.css"
import { Pencil, Trash2 } from "lucide-react"
import { formatMoney as fmt } from "@/utils/money"

// ── helpers ──────────────────────────────────────────────────────────────────

const TIPO_TONE: Record<number, "soft" | "success" | "accent" | "neutral" | "warning"> = {
  1: "soft",      // Corrente
  2: "success",   // Poupança
  4: "accent",    // Investimento
  5: "warning",   // Outro
}

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

// ── Component ─────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const { notify } = useOutletContext<OutletContextType>()

  const [contas, setContas] = useState<Conta[]>([])
  const [bancos, setBancos] = useState<Banco[]>([])
  const [loading, setLoading] = useState(true)

  const [openDialog, setOpenDialog] = useState(false)
  const [editingConta, setEditingConta] = useState<Conta | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Conta | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const [cs, bs] = await Promise.all([getContas(), getBancos()])
      setContas(cs)
      setBancos(bs)
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

  const carteira = contas.find(c => c.isCarteira)
  const contasBancarias = contas.filter(c => !c.isCarteira)

  const totalSaldo = useMemo(() => contas.reduce((s, c) => s + c.saldoAtual, 0), [contas])
  const totalCarteira = carteira?.saldoAtual ?? 0

  if (loading) {
    return (
      <div className={styles.center}>
        <PontesLoadingDots />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Bancos</h1>
        </div>
        <PontesButton
          variant="primary"
          size="sm"
          iconStart={<Plus size={15} />}
          onClick={() => { setEditingConta(null); setOpenDialog(true) }}
        >
          Nova Conta
        </PontesButton>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <PontesStatCard label="Saldo Total" value={fmt(totalSaldo)} />
        <PontesStatCard label="Contas Bancárias" value={String(contasBancarias.length)} />
        <PontesStatCard label="Carteira Física" value={fmt(totalCarteira)} />
      </div>

      {/* Carteira automática */}
      {carteira && (
        <div className={styles.carteiraCard}>
          <div className={styles.carteiraHead}>
            <Wallet size={18} strokeWidth={2} />
            <p className={styles.carteiraTitle}>Carteira automática</p>
          </div>
          <p className={styles.carteiraDesc}>
            Criada automaticamente no cadastro — representa dinheiro em espécie.
          </p>
          <div className={styles.carteiraBody}>
            <div>
              <p className={styles.carteiraNome}>{carteira.nome}</p>
              <span className={styles.carteiraChip}>Não aparece como opção de cadastro</span>
            </div>
            <span className={styles.carteiraSaldo}>{fmt(carteira.saldoAtual)}</span>
          </div>
        </div>
      )}

      {/* Contas bancárias */}
      {contasBancarias.length === 0 ? (
        <PontesEmptyState
          icon={<Landmark size={28} />}
          title="Nenhuma conta bancária cadastrada"
          description="Crie uma conta corrente, poupança ou investimento para organizar suas finanças."
        />
      ) : (
        <div className={styles.grid}>
          {contasBancarias.map(conta => {
            const banco = bancos.find(b => b.id === conta.bancoId)
            const tone = TIPO_TONE[conta.tipo] ?? "neutral"
            const neg = conta.saldoAtual < 0

            return (
              <div key={conta.id} className={styles.card}>
                {/* Head: logo + nome + tipo badge */}
                <div className={styles.cardHead}>
                  <div className={styles.cardHeadLeft}>
                    <PontesBankBadge
                      name={banco?.nomeFantasia ?? conta.nome}
                      logoUrl={banco?.logoUrl}
                      cor={banco?.cor}
                      size={42}
                    />
                    <div>
                      <p className={styles.cardName}>{conta.nome}</p>
                      <p className={styles.cardBanco}>{banco?.nomeFantasia ?? "Sem banco vinculado"}</p>
                    </div>
                  </div>
                  <PontesBadge tone={tone} size="sm">{conta.tipoDescricao}</PontesBadge>
                </div>

                {/* Saldo + número da conta */}
                <div className={styles.cardSaldo}>
                  <div>
                    <div className={styles.saldoLabel}>Saldo atual</div>
                    <div className={styles.saldoValue} data-neg={neg ? "true" : undefined}>
                      {fmt(conta.saldoAtual)}
                    </div>
                  </div>
                  {(conta.agencia || conta.numeroConta) && (
                    <div className={styles.cardNumeroConta}>
                      <div className={styles.numeroLabel}>{conta.agencia ? "Agência / Conta" : "Número"}</div>
                      <div className={styles.numeroValue}>
                        {conta.agencia ? `${conta.agencia} / ${conta.numeroConta ?? "—"}` : conta.numeroConta}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className={styles.cardFoot}>
                  <PontesIconButton
                    size={32}
                    variant="ghost"
                    title="Editar"
                    onClick={() => { setEditingConta(conta); setOpenDialog(true) }}
                  >
                    <Pencil size={14} />
                  </PontesIconButton>
                  <PontesIconButton
                    size={32}
                    variant="ghost"
                    title="Excluir"
                    onClick={() => setDeleteTarget(conta)}
                  >
                    <Trash2 size={14} />
                  </PontesIconButton>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog: criar / editar conta */}
      <NewContaDialog
        open={openDialog}
        editingConta={editingConta}
        bancos={bancos}
        onClose={() => { setOpenDialog(false); setEditingConta(null) }}
        onSaved={loadData}
        notify={notify}
      />

      {/* Dialog: confirmar exclusão */}
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
