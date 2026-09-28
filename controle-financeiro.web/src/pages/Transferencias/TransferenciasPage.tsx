import React, { useEffect, useState } from "react"
import { dataLocalISO } from "@/utils/dateTime"
import { formatMoney } from "@/utils/money"
import { useOutletContext } from "react-router-dom"
import { Plus, Trash2, ArrowLeftRight, SearchX } from "lucide-react"
import {
  PontesButton, PontesCard, PontesBadge,
  PontesModal, PontesDialog, PontesField, PontesInput, PontesDateInput, PontesSelect, PontesEmptyState,
  PontesPageHeader, PontesToolbar, PontesRowActions, PontesSkeletonList,
  PontesTablePagination, PONTES_TABLE_PAGE_SIZE_DEFAULT,
} from "@/components/pontes"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { listTransferenciasPage, createTransferencia, deleteTransferencia } from "../../services/transferenciaService"
import { getContas } from "../../services/contaService"
import type { Transferencia } from "../../types/Transferencia"
import type { Conta } from "../../types/Conta"
import styles from "./TransferenciasPage.module.css"


const today = () => dataLocalISO()

// UTC fixo — data do backend é "dia calendário" (meia-noite UTC), não instante exato; formatar em
// fuso local desloca 1 dia pra trás em fuso negativo (Brasil inteiro).
const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" })

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
  // Esqueleto até a lista chegar — sem isso o "Nenhuma transferência" piscava antes de carregar.
  const [carregandoLista, setCarregandoLista] = useState(true)

  // Busca SERVER-SIDE (a lista é paginada): debounce = 1 request por pausa, não por tecla.
  // Transferência não "acaba", então não há seletor de situação — só a busca.
  const [busca, setBuscaState] = useState("")
  const buscaDebounced = useDebouncedValue(busca.trim())
  const setBusca = (v: string) => { setBuscaState(v); setPage(1) }
  const limparBusca = () => setBusca("")

  // Contas só alimentam o modal de criar — 1x na montagem.
  useEffect(() => {
    getContas()
      .then(setContas)
      .catch(() => notify({ open: true, message: "Erro ao carregar contas", severity: "error" }))
  }, [notify])

  // Depois de criar/excluir: sobe a versão → a lista recarrega.
  const [versao, setVersao] = useState(0)
  const recarregar = () => setVersao((v) => v + 1)

  // Lista paginada NO SERVIDOR. `vivo` descarta resposta velha (busca trocada no meio).
  useEffect(() => {
    let vivo = true
    setCarregandoLista(true)
    listTransferenciasPage(page, pageSize, buscaDebounced)
      .then((result) => {
        if (!vivo) return
        // Página além do fim (ex.: excluiu o último item da última página) → volta pra última
        // válida e segue carregando (sem piscar a lista antiga no meio).
        if (result.items.length === 0 && result.total > 0 && page > 1) {
          setPage(Math.max(1, Math.ceil(result.total / pageSize)))
          return
        }
        setTransferencias(result.items)
        setTotal(result.total)
        setCarregandoLista(false)
      })
      .catch(() => {
        if (!vivo) return
        notify({ open: true, message: "Erro ao carregar transferências", severity: "error" })
        setCarregandoLista(false)
      })
    return () => { vivo = false }
  }, [notify, page, pageSize, buscaDebounced, versao])

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
      recarregar()
      window.dispatchEvent(new Event("transactionCreated"))
    } catch {
      notify({ open: true, message: "Erro ao criar transferência", severity: "error" })
    } finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!delId) return
    try {
      await deleteTransferencia(delId)
      notify({ open: true, message: "Transferência excluída", severity: "success" })
      recarregar()
      window.dispatchEvent(new Event("transactionCreated"))
    } catch {
      notify({ open: true, message: "Erro ao excluir transferência", severity: "error" })
    } finally { setDelId(null) }
  }

  const botaoCriar = (
    <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={openCreate}>
      Nova transferência
    </PontesButton>
  )

  const optsOrigem = contas
    .filter((c) => c.id !== form.contaDestinoId)
    .map((c) => ({ value: c.id, label: c.nome }))
  const optsDestino = contas
    .filter((c) => c.id !== form.contaOrigemId)
    .map((c) => ({ value: c.id, label: c.nome }))

  return (
    <div className={styles.root}>
      <PontesPageHeader actionLabel="Nova transferência" onAction={openCreate} />

      <PontesToolbar
        search={{ value: busca, onChange: setBusca, placeholder: "Buscar transferência…", ariaLabel: "Buscar transferência" }}
      />

      {carregandoLista ? (
        <PontesSkeletonList rows={4} />
      ) : transferencias.length === 0 ? (
        buscaDebounced || busca.trim() ? (
          <PontesEmptyState
            icon={<SearchX size={28} strokeWidth={2.5} />}
            title="Nada encontrado"
            actions={<PontesButton variant="outline" size="sm" onClick={limparBusca}>Limpar filtros</PontesButton>}
          />
        ) : (
          <PontesEmptyState
            icon={<ArrowLeftRight size={28} strokeWidth={2.5} />}
            title="Nenhuma transferência ainda"
            actions={botaoCriar}
          />
        )
      ) : (
        <PontesCard padding={0} radius={16}>
          <ul className={styles.list}>
            {transferencias.map((t) => (
              <li key={t.id} className={styles.item}>
                <div className={styles.itemLeft}>
                  <div className={styles.itemIcon}><ArrowLeftRight size={16} strokeWidth={2.5} /></div>
                  <div className={styles.itemMeta}>
                    <span className={styles.itemDesc}>{t.descricao || "Transferência"}</span>
                    <div className={styles.itemRoute}>
                      <PontesBadge tone="danger" size="sm">{t.contaOrigemNome}</PontesBadge>
                      <ArrowLeftRight size={12} className={styles.routeArrow} />
                      <PontesBadge tone="success" size="sm">{t.contaDestinoNome}</PontesBadge>
                      <span className={styles.itemDate}>{formatDate(t.data)}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.itemRight}>
                  <span className={styles.itemValue}>{formatMoney(t.valor)}</span>
                  <PontesRowActions
                    actions={[{
                      key: "excluir", label: "Excluir", danger: true,
                      icon: <Trash2 size={16} strokeWidth={2.5} />, onClick: () => setDelId(t.id),
                    }]}
                  />
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
        </PontesCard>
      )}

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
        title="Excluir transferência?"
        description="As duas transações vinculadas (saída + entrada) também serão excluídas."
        tone="danger"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDelId(null)}
      />
    </div>
  )
}
