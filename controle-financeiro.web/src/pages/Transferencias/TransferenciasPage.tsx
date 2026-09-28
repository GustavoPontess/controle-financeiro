import React, { useEffect, useState } from "react"
import { dataLocalISO } from "@/utils/dateTime"
import { formatMoney } from "@/utils/money"
import { useOutletContext } from "react-router-dom"
import { Trash2, ArrowLeftRight } from "lucide-react"
import {
  PontesButton, PontesModal, PontesDialog, PontesField, PontesInput, PontesMoneyField, PontesDateInput,
  PontesSelect, PontesListPage,
} from "@/components/pontes"
import { useListaPaginada } from "@/hooks/useListaPaginada"
import { listTransferenciasPage, createTransferencia, deleteTransferencia } from "../../services/transferenciaService"
import { getContas } from "../../services/contaService"
import type { Transferencia } from "../../types/Transferencia"
import type { Conta } from "../../types/Conta"
import styles from "./TransferenciasPage.module.css"

// UTC fixo — data do backend é "dia calendário" (meia-noite UTC), não instante exato; formatar em
// fuso local desloca 1 dia pra trás em fuso negativo (Brasil inteiro).
const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" })

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

const emptyForm = (): FormState => ({
  contaOrigemId: "", contaDestinoId: "", valor: undefined, data: dataLocalISO(), descricao: "",
})

export default function TransferenciasPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [contas, setContas] = useState<Conta[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<Errors>({})
  const [delAlvo, setDelAlvo] = useState<Transferencia | null>(null)

  // Lista no servidor (busca, página, resposta velha, esqueleto): tudo no hook + molde do DS.
  // Transferência não "acaba", então não há filtro de situação — só a busca.
  const lista = useListaPaginada<Transferencia, Record<string, never>>({
    buscar: ({ page, pageSize, busca }) => listTransferenciasPage(page, pageSize, busca),
    filtrosPadrao: {},
    aoFalhar: () => notify({ open: true, message: "Erro ao carregar transferências", severity: "error" }),
  })

  // Contas só alimentam o modal de criar — 1x na montagem.
  useEffect(() => {
    getContas()
      .then(setContas)
      .catch(() => notify({ open: true, message: "Erro ao carregar contas", severity: "error" }))
  }, [notify])

  const clearErr = (k: keyof Errors) => setErrors((p) => ({ ...p, [k]: undefined }))
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const openCreate = () => { setForm(emptyForm()); setErrors({}); setDialogOpen(true) }

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
      lista.recarregar()
      window.dispatchEvent(new Event("transactionCreated"))
    } catch {
      notify({ open: true, message: "Erro ao criar transferência", severity: "error" })
    } finally { setLoading(false) }
  }

  const handleDelete = async () => {
    if (!delAlvo) return
    try {
      await deleteTransferencia(delAlvo.id)
      notify({ open: true, message: "Transferência excluída", severity: "success" })
      lista.recarregar()
      window.dispatchEvent(new Event("transactionCreated"))
    } catch {
      notify({ open: true, message: "Erro ao excluir transferência", severity: "error" })
    } finally { setDelAlvo(null) }
  }

  const optsOrigem = contas
    .filter((c) => c.id !== form.contaDestinoId)
    .map((c) => ({ value: c.id, label: c.nome }))
  const optsDestino = contas
    .filter((c) => c.id !== form.contaOrigemId)
    .map((c) => ({ value: c.id, label: c.nome }))

  return (
    <>
      <PontesListPage
        lista={lista}
        acao={{ label: "Nova transferência", onClick: openCreate }}
        busca="Buscar transferência…"
        rotulo={["transferência", "transferências"]}
        vazio={{ icone: <ArrowLeftRight size={28} strokeWidth={2.5} />, titulo: "Nenhuma transferência ainda" }}
        chave={(t) => t.id}
        // Ficha "Transferência": sem status/progresso; meta = rota · data; valor sem sinal (não é
        // entrada nem saída); sem detalhe (a linha não abre nada).
        item={(t) => {
          const rota = `${t.contaOrigemNome} → ${t.contaDestinoNome}`
          return {
            icone: <ArrowLeftRight size={18} strokeWidth={2.4} />,
            titulo: t.descricao || rota,
            // Sem descrição a rota já é o título: não repete na meta.
            meta: [t.descricao ? rota : null, formatDate(t.data)],
            valor: formatMoney(t.valor),
            acoes: [{
              key: "excluir", label: "Excluir", danger: true,
              icon: <Trash2 size={16} strokeWidth={2.5} />, onClick: () => setDelAlvo(t),
            }],
          }
        }}
      />

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
            <PontesMoneyField
              value={form.valor}
              onChange={(v) => { setF("valor", v); clearErr("valor") }}
              invalid={!!errors.valor}
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
                maxLength={255}
                placeholder="Ex.: reserva de emergência…"
              />
            </PontesField>
          </div>
        </form>
      </PontesModal>

      <PontesDialog
        open={delAlvo !== null}
        title="Excluir transferência?"
        description={delAlvo
          ? `${formatMoney(delAlvo.valor)} de ${delAlvo.contaOrigemNome} para ${delAlvo.contaDestinoNome}. As duas transações vinculadas (saída e entrada) também serão excluídas.`
          : undefined}
        tone="danger"
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDelAlvo(null)}
      />
    </>
  )
}
