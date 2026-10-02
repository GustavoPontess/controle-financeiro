/**
 * AccountsPage — #88 refactor. Zero MUI, zero tokens.ts. CSS Modules + var(--pontes-*).
 *
 * - Saldo via conta.saldoAtual (sem getTransactions).
 * - PontesBankBadge mostra logo real do banco com fallback de iniciais.
 * - Carteira: card dark especial (não editável, criada automaticamente).
 * - NewContaDialog ainda é legacy (refatorar em PR separado).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { Plus, Wallet, Landmark } from "lucide-react"
import {
  PontesButton, PontesIconButton, PontesBadge,
  PontesStatCard, PontesEmptyState, PontesLoadingDots, PontesDialog,
  PontesBankBadge, PontesModal, PontesField, PontesInput, PontesDateInput,
} from "@/components/pontes"
import NewContaDialog from "../../components/Contas/NewContaDialog/NewContaDialog"
import { getContas, deleteConta, atualizarSaldoInicial } from "../../services/contaService"
import { getBancos } from "../../services/bancoService"
import { listMarcos } from "../../services/reconciliacaoService"
import type { Conta } from "../../types/Conta"
import type { Banco } from "../../types/Banco"
import styles from "./AccountsPage.module.css"
import { Pencil, Trash2 } from "lucide-react"
import { formatMoney as fmt, parseMoney, maskMoney, moneyParaCampo } from "@/utils/money"
import { dataLocalISO } from "@/utils/dateTime"

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

  // ── Saldo inicial (ponto de partida da conta) ──────────────────────────────
  // Vale pra TODA conta, inclusive a Carteira: ela nasce zerada no cadastro e não passa pelo
  // formulário de conta, então este é o lugar de dizer quanto dinheiro havia nela.
  const [saldoAlvo, setSaldoAlvo] = useState<Conta | null>(null)
  const [saldoValor, setSaldoValor] = useState("")
  const [saldoData, setSaldoData] = useState("")
  const [saldoErro, setSaldoErro] = useState<string | undefined>()
  const [saldoCarregando, setSaldoCarregando] = useState(false)
  const [saldoSalvando, setSaldoSalvando] = useState(false)
  // Descarta a resposta de uma abertura anterior (fechou e abriu outra conta com a busca em voo).
  const saldoPedido = useRef(0)

  const abrirSaldoInicial = async (conta: Conta) => {
    const pedido = ++saldoPedido.current
    setSaldoAlvo(conta)
    setSaldoErro(undefined)
    setSaldoValor("")
    setSaldoData(dataLocalISO())
    setSaldoCarregando(true)
    try {
      // O saldo inicial já gravado chega como o marco de partida (derivado) da reconciliação.
      const partida = (await listMarcos(conta.id)).find((m) => m.derivado)
      if (pedido !== saldoPedido.current) return
      if (partida) {
        setSaldoValor(moneyParaCampo(partida.saldoDeclarado))
        setSaldoData(partida.dataHora.slice(0, 10))
      }
    } catch {
      // Sem a partida o formulário abre vazio — salvar continua funcionando.
    } finally {
      if (pedido === saldoPedido.current) setSaldoCarregando(false)
    }
  }

  const fecharSaldoInicial = () => {
    saldoPedido.current++
    setSaldoAlvo(null)
  }

  const salvarSaldoInicial = async () => {
    if (!saldoAlvo) return
    const valor = parseMoney(saldoValor)
    if (valor <= 0) { setSaldoErro("Informe um valor maior que zero"); return }
    setSaldoSalvando(true)
    try {
      await atualizarSaldoInicial(saldoAlvo.id, { valor, data: saldoData || undefined })
      notify({ open: true, message: "Saldo inicial salvo", severity: "success" })
      fecharSaldoInicial()
      await loadData()
    } catch {
      notify({ open: true, message: "Erro ao salvar o saldo inicial", severity: "error" })
    } finally {
      setSaldoSalvando(false)
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
          <p className={styles.subtitle}>
            Contas correntes, poupança e a carteira automática do sistema.
          </p>
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
            <div className={styles.carteiraDireita}>
              <span className={styles.carteiraSaldo}>{fmt(carteira.saldoAtual)}</span>
              <PontesButton
                variant="soft"
                size="sm"
                iconStart={<Landmark size={14} strokeWidth={2.5} />}
                onClick={() => { void abrirSaldoInicial(carteira) }}
              >
                Saldo inicial
              </PontesButton>
            </div>
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
                    title="Saldo inicial"
                    aria-label={`Saldo inicial de ${conta.nome}`}
                    onClick={() => { void abrirSaldoInicial(conta) }}
                  >
                    <Landmark size={14} />
                  </PontesIconButton>
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

      {/* Modal: saldo inicial da conta (valor + desde quando) */}
      <PontesModal
        open={saldoAlvo !== null}
        title={`Saldo inicial — ${saldoAlvo?.nome ?? ""}`}
        onClose={fecharSaldoInicial}
        footer={<>
          <PontesButton variant="outline" onClick={fecharSaldoInicial}>Cancelar</PontesButton>
          <PontesButton
            loading={saldoSalvando}
            disabled={saldoCarregando}
            onClick={() => { void salvarSaldoInicial() }}
          >
            Salvar
          </PontesButton>
        </>}
      >
        <div className={styles.saldoForm}>
          <PontesField label="Valor" required error={saldoErro}>
            <PontesInput
              iconStart="R$"
              inputMode="decimal"
              placeholder="0,00"
              maxLength={18}
              value={saldoValor}
              disabled={saldoCarregando}
              invalid={!!saldoErro}
              onChange={(e) => { setSaldoErro(undefined); setSaldoValor(maskMoney(e.target.value)) }}
            />
          </PontesField>
          <PontesField label="Desde" required>
            <PontesDateInput value={saldoData} max={dataLocalISO()} onChange={setSaldoData} />
          </PontesField>
        </div>
      </PontesModal>

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
