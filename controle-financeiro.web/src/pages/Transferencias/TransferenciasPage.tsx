import React, { useCallback, useEffect, useState } from "react"
import { formatMoney } from "@/utils/money"
import { useOutletContext } from "react-router-dom"
import { Plus, Trash2, ArrowLeftRight } from "lucide-react"
import {
  PontesButton, PontesCard, PontesBadge, PontesIconButton,
  PontesModal, PontesDialog, PontesField, PontesInput, PontesDateInput, PontesSelect, PontesEmptyState,
  PontesTablePagination, PONTES_TABLE_PAGE_SIZE_DEFAULT,
} from "@/components/pontes"
import { listTransferenciasPage, createTransferencia, deleteTransferencia } from "../../services/transferenciaService"
import { getContas } from "../../services/contaService"
import type { Transferencia } from "../../types/Transferencia"
import type { Conta } from "../../types/Conta"
import styles from "./TransferenciasPage.module.css"


const today = () => new Date().toISOString().slice(0, 10)

// Máscara monetária — dígitos → centavos formatados pt-BR.
const parseMoney = (masked: string): number | undefined => {
  const digits = masked.replace(/\D/g, "")
  return digits ? Number(digits) / 100 : undefined
}
const fmtMoney = (n?: number): string =>
  n != null ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""

type FormState = {
  contaOrigemId: string
  contaDestinoId: string
  valor?: number
  data: string
  descricao: string
}
type Errors = Partial<Record<"contaOrigemId" | "contaDestinoId" | "valor", string>>

type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

const emptyForm: FormState = {
  contaOrigemId: "", contaDestinoId: "", valor: undefined, data: today(), descricao: "",
}

export default function TransferenciasPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(PONTES_TABLE_PAGE_SIZE_DEFAULT)
  const [contas, setContas] = useState<Conta[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [delId, setDelId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [result, c] = await Promise.all([listTransferenciasPage(page, pageSize), getContas()])
      setTransferencias(result.items)
      setTotal(result.total)
      setContas(c)
    } catch {
      notify({ open: true, message: "Erro ao carregar transferências", severity: "error" })
    }
  }, [notify, page, pageSize])

  useEffect(() => { void loadData() }, [loadData])

  const clearErr = (k: keyof Errors) => setErrors((p) => ({ ...p, [k]: undefined }))
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const openCreate = () => { setForm(emptyForm); setErrors({}); setDialogOpen(true) }

  const handleSalvar = async () => {
    const e: Errors = {}
    if (!form.contaOrigemId) e.contaOrigemId = "Selecione a conta de origem"
    if (!form.contaDestinoId) e.contaDestinoId = "Selecione a conta de destino"
    else if (form.contaDestinoId === form.contaOrigemId) e.contaDestinoId = "Destino deve ser diferente da origem"
    if (form.valor == null) e.valor = "Informe o valor"
    else if (form.valor <= 0) e.valor = "Valor deve ser maior que zero"
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    try {
      await createTransferencia({
        contaOrigemId: form.contaOrigemId,
        contaDestinoId: form.contaDestinoId,
        valor: form.valor!,
        data: new Date(form.data).toISOString(),
        descricao: form.descricao,
      })
      notify({ open: true, message: "Transferência criada", severity: "success" })
      setDialogOpen(false)
      await loadData()
      window.dispatchEvent(new Event("transactionCreated"))
    } catch {
      notify({ open: true, message: "Erro ao criar transferência", severity: "error" })
    } finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!delId) return
    try {
      await deleteTransferencia(delId)
      notify({ open: true, message: "Transferência removida", severity: "success" })
      await loadData()
      window.dispatchEvent(new Event("transactionCreated"))
    } catch {
      notify({ open: true, message: "Erro ao remover transferência", severity: "error" })
    } finally { setDelId(null) }
  }

  const optsOrigem = contas
    .filter((c) => c.id !== form.contaDestinoId)
    .map((c) => ({ value: c.id, label: c.nome }))
  const optsDestino = contas
    .filter((c) => c.id !== form.contaOrigemId)
    .map((c) => ({ value: c.id, label: c.nome }))

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Transferências</h1>
          <div className={styles.subtitle}>Mova dinheiro entre suas contas</div>
        </div>
        <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={openCreate}>
          Nova Transferência
        </PontesButton>
      </div>

      <PontesCard padding={0} radius={16}>
        <div className={styles.listHead}>
          <span className={styles.listHeadTitle}>Histórico</span>
          <span className={styles.listHeadMeta}>{total} {total === 1 ? "transferência" : "transferências"}</span>
        </div>

        {total === 0 ? (
          <div className={styles.emptyWrap}>
            <PontesEmptyState
              icon={<ArrowLeftRight size={28} />}
              title="Nenhuma transferência ainda"
              description="Clique em 'Nova Transferência' pra mover dinheiro entre suas contas."
            />
          </div>
        ) : (
          <>
            <ul className={styles.list}>
              {transferencias.map((t) => (
                <li key={t.id} className={styles.item}>
                  <div className={styles.itemLeft}>
                    <div className={styles.itemIcon}><ArrowLeftRight size={16} /></div>
                    <div className={styles.itemMeta}>
                      <span className={styles.itemDesc}>{t.descricao || "Transferência"}</span>
                      <div className={styles.itemRoute}>
                        <PontesBadge tone="danger" size="sm">{t.contaOrigemNome}</PontesBadge>
                        <ArrowLeftRight size={12} className={styles.routeArrow} />
                        <PontesBadge tone="success" size="sm">{t.contaDestinoNome}</PontesBadge>
                        <span className={styles.itemDate}>{new Date(t.data).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={styles.itemValue}>{formatMoney(t.valor)}</span>
                    <PontesIconButton size={32} variant="ghost" aria-label="Remover" onClick={() => setDelId(t.id)}>
                      <Trash2 size={14} />
                    </PontesIconButton>
                  </div>
                </li>
              ))}
            </ul>
            <PontesTablePagination
              total={total} page={page} pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
              itemLabel="transferências" itemLabelSingular="transferência"
            />
          </>
        )}
      </PontesCard>

      <PontesModal
        open={dialogOpen}
        title="Nova transferência"
        onClose={() => setDialogOpen(false)}
        footer={<>
          <PontesButton variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</PontesButton>
          <PontesButton onClick={handleSalvar} loading={loading} disabled={loading}>Transferir</PontesButton>
        </>}
      >
        <form noValidate onSubmit={(e) => { e.preventDefault(); void handleSalvar() }} className={styles.formCol}>
          <PontesField label="Conta de origem" required error={errors.contaOrigemId}>
            <PontesSelect
              value={form.contaOrigemId}
              onChange={(v) => { setF("contaOrigemId", v); clearErr("contaOrigemId") }}
              invalid={!!errors.contaOrigemId}
              placeholder="Selecione"
              options={optsOrigem}
            />
          </PontesField>

          <PontesField label="Conta de destino" required error={errors.contaDestinoId}>
            <PontesSelect
              value={form.contaDestinoId}
              onChange={(v) => { setF("contaDestinoId", v); clearErr("contaDestinoId") }}
              invalid={!!errors.contaDestinoId}
              placeholder="Selecione"
              options={optsDestino}
            />
          </PontesField>

          <PontesField label="Valor" required error={errors.valor}>
            <PontesInput
              iconStart="R$"
              value={fmtMoney(form.valor)}
              onChange={(e) => { setF("valor", parseMoney(e.target.value)); clearErr("valor") }}
              invalid={!!errors.valor}
              inputMode="decimal"
              placeholder="0,00"
            />
          </PontesField>

          <div className={styles.grid2}>
            <PontesField label="Data" required>
              <PontesDateInput value={form.data} onChange={(v) => setF("data", v)} />
            </PontesField>
            <PontesField label="Descrição" helper="Opcional">
              <PontesInput
                value={form.descricao}
                onChange={(e) => setF("descricao", e.target.value)}
                placeholder="Ex: Reserva pra emergência"
              />
            </PontesField>
          </div>
        </form>
      </PontesModal>

      <PontesDialog
        open={delId !== null}
        title="Remover transferência?"
        description="As duas transações vinculadas (saída + entrada) também serão removidas."
        confirmLabel="Remover"
        onConfirm={handleDelete}
        onCancel={() => setDelId(null)}
      />
    </div>
  )
}
