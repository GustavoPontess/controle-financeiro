import React, { useEffect, useRef, useState } from "react"
import { dataLocalISO } from "@/utils/dateTime"
import { formatMoney } from "@/utils/money"
import { useOutletContext } from "react-router-dom"
import { Trash2, ArrowLeftRight } from "lucide-react"
import {
  PontesButton, PontesBadge,
  PontesModal, PontesDialog, PontesField, PontesInput, PontesDateInput, PontesSelect,
  PontesTablePagination, PONTES_TABLE_PAGE_SIZE_DEFAULT,
  PontesTabela, PontesCelulaIdentidade, type PontesTabelaColuna, type PontesTabelaTag,
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
  const [busca, setBuscaState] = useState("")
  const buscaDebounced = useDebouncedValue(busca.trim())
  const setBusca = (v: string) => { setBuscaState(v); setPage(1) }
  const limparBusca = () => setBusca("")

  // Filtros avançados (server-side), conforme o dado da tela: faixa de valor + período.
  const [valorMin, setValorMin] = useState<number>()
  const [valorMax, setValorMax] = useState<number>()
  const [de, setDe] = useState<string>()
  const [ate, setAte] = useState<string>()

  // Contas só alimentam o modal de criar — 1x na montagem.
  useEffect(() => {
    getContas()
      .then(setContas)
      .catch(() => notify({ open: true, message: "Erro ao carregar contas", severity: "error" }))
  }, [notify])

  // Depois de criar/excluir: sobe a versão → a lista recarrega.
  const [versao, setVersao] = useState(0)
  const recarregar = () => setVersao((v) => v + 1)

  // Esqueleto só quando muda O QUE se vê (1ª carga, busca, página). A recarga depois de criar/excluir
  // (versao) troca os dados no lugar: a lista não pisca e as linhas (e seus ⋮) seguem montadas.
  const chaveListaRef = useRef<string | null>(null)

  // Lista paginada NO SERVIDOR. `vivo` descarta resposta velha (busca trocada no meio).
  useEffect(() => {
    let vivo = true
    const chave = `${page}|${pageSize}|${buscaDebounced}|${valorMin}|${valorMax}|${de}|${ate}`
    if (chave !== chaveListaRef.current) { chaveListaRef.current = chave; setCarregandoLista(true) }
    listTransferenciasPage(page, pageSize, buscaDebounced, { valorMin, valorMax, from: de, to: ate })
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
  }, [notify, page, pageSize, buscaDebounced, valorMin, valorMax, de, ate, versao])

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

  const optsOrigem = contas
    .filter((c) => c.id !== form.contaDestinoId)
    .map((c) => ({ value: c.id, label: c.nome }))
  const optsDestino = contas
    .filter((c) => c.id !== form.contaOrigemId)
    .map((c) => ({ value: c.id, label: c.nome }))

  // Colunas: identidade (ícone + descrição), rota (origem → destino), data e valor (numérica).
  const colunas: PontesTabelaColuna<Transferencia>[] = [
    {
      key: "desc", header: "Transferência",
      render: (t) => <PontesCelulaIdentidade icone={<ArrowLeftRight size={17} strokeWidth={2.2} />} tom="neutro" nome={t.descricao || "Transferência"} />,
    },
    {
      key: "rota", header: "Rota",
      render: (t) => (
        <span className={styles.rota}>
          <PontesBadge tone="danger" size="sm">{t.contaOrigemNome}</PontesBadge>
          <ArrowLeftRight size={12} className={styles.routeArrow} />
          <PontesBadge tone="success" size="sm">{t.contaDestinoNome}</PontesBadge>
        </span>
      ),
    },
    { key: "data", header: "Data", render: (t) => formatDate(t.data) },
    { key: "valor", header: "Valor", numerica: true, render: (t) => formatMoney(t.valor) },
  ]

  const tags: PontesTabelaTag[] = []
  if (busca.trim()) tags.push({ label: `Busca: "${busca.trim()}"`, onRemover: limparBusca })

  // "Nada encontrado" quando QUALQUER filtro está ativo (busca ou avançados), não só a busca.
  const algumFiltro = busca.trim() !== "" || valorMin != null || valorMax != null || !!de || !!ate

  return (
    <>
      <PontesTabela
        titulo="Transferências"
        descricao="Mova dinheiro entre suas contas"
        acao={{ label: "Nova transferência", onClick: openCreate }}
        busca={{ value: busca, onChange: setBusca, placeholder: "Buscar transferência…", ariaLabel: "Buscar transferência" }}
        filtrosAvancados={[
          { tipo: "faixaValor", id: "valor", label: "Valor", min: valorMin, max: valorMax, onChange: (mn, mx) => { setValorMin(mn); setValorMax(mx); setPage(1) } },
          { tipo: "faixaData", id: "periodo", label: "Período", de, ate, onChange: (d, a) => { setDe(d); setAte(a); setPage(1) } },
        ]}
        tags={tags}
        colunas={colunas}
        itens={transferencias}
        chave={(t) => t.id}
        acoes={(t) => [
          { key: "excluir", label: "Excluir", danger: true, icon: <Trash2 size={16} strokeWidth={2.5} />, onClick: () => setDelId(t.id) },
        ]}
        carregando={carregandoLista}
        vazio={{
          icone: <ArrowLeftRight size={28} strokeWidth={2.5} />,
          titulo: algumFiltro ? "Nada encontrado" : "Nenhuma transferência ainda",
          descricao: algumFiltro ? "Nada bate com os filtros." : "Mova dinheiro entre suas contas registrando a primeira.",
        }}
        paginacao={
          <PontesTablePagination
            total={total} page={page} pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            itemLabel="transferências" itemLabelSingular="transferência"
          />
        }
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
    </>
  )
}
