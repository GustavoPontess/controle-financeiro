/**
 * SANDBOX FUNCIONAL — /demo-transacoes. Transações no padrão novo, de verdade: paginação no servidor
 * + criar/editar/excluir com os modais reais. Só o layout é o padrão novo. A tela monta só o resumo,
 * as colunas e as ações; todo o resto vem do PontesTabela.
 */

import { useCallback, useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { TrendingUp, TrendingDown, Pencil, Trash2 } from "lucide-react"
import {
  PontesStatCard, PontesTablePagination, PontesDialog, PONTES_TABLE_PAGE_SIZE_DEFAULT,
} from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { listTransactionsPage, getTransactionStats, deleteTransaction } from "@/services/transactionService"
import type { Transaction } from "@/types/Transaction"
import NewTransactionDialog from "../Transactions/components/NewTransactionDialog/NewTransactionDialog"
import EditTransactionDialog, { type EditableTransaction } from "../Transactions/components/EditTransactionDialog/EditTransactionDialog"
import { PontesTabela, PontesCelulaIdentidade, PontesBadge, type PontesTabelaColuna, type PontesTabelaTag } from "@/components/pontes"
import styles from "./DemoPadrao.module.css"

const fmtData = (s?: string) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—")
type Notification = { open: boolean; message: string; severity: "success" | "error" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

const paraEditavel = (t: Transaction): EditableTransaction => ({
  id: t.id, descricao: t.descricao, valor: t.valor, tipo: t.tipo,
  categoriaId: t.categoriaId ?? undefined, subcategoriaId: t.subcategoriaId ?? undefined,
  contaId: t.contaId, cartaoCreditoId: t.cartaoCreditoId, meioPagamento: t.meioPagamento, data: t.data,
})

export default function DemoTransacoesPage() {
  const { notify } = useOutletContext<OutletContextType>()
  const [itens, setItens] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<{ entradas: number; saidas: number; saldo: number } | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(PONTES_TABLE_PAGE_SIZE_DEFAULT)
  const [busca, setBusca] = useState("")
  const buscaAplicada = useDebouncedValue(busca.trim())
  const [tipo, setTipo] = useState<"tudo" | "1" | "2">("tudo")
  // Filtros avançados (todos no servidor): status, faixa de valor, período.
  const [status, setStatus] = useState("")        // "" = qualquer | "1" = efetivado | "0" = previsto
  const [valorMin, setValorMin] = useState<number>()
  const [valorMax, setValorMax] = useState<number>()
  const [de, setDe] = useState<string>()
  const [ate, setAte] = useState<string>()

  const [novoAberto, setNovoAberto] = useState(false)
  const [editando, setEditando] = useState<Transaction | null>(null)
  const [excluindo, setExcluindo] = useState<Transaction | null>(null)

  useEffect(() => { setPage(1) }, [buscaAplicada, tipo, status, valorMin, valorMax, de, ate])

  const [versao, setVersao] = useState(0)
  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    Promise.all([
      listTransactionsPage(page, pageSize, {
        q: buscaAplicada || undefined,
        tipo: tipo === "tudo" ? undefined : Number(tipo),
        status: status !== "" ? Number(status) : undefined,
        valorMin, valorMax, from: de, to: ate,
      }),
      getTransactionStats({}).catch(() => null),
    ])
      .then(([lista, s]) => {
        if (!vivo) return
        setItens(lista.items)
        setTotal(lista.total)
        setStats(s ? { entradas: s.entradas, saidas: s.saidas, saldo: s.saldoPeriodo } : null)
      })
      .catch(() => { if (vivo) notify({ open: true, message: "Erro ao carregar transações", severity: "error" }) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [page, pageSize, buscaAplicada, tipo, status, valorMin, valorMax, de, ate, versao, notify])

  const handleExcluir = async () => {
    if (!excluindo) return
    try {
      await deleteTransaction(excluindo.id)
      notify({ open: true, message: "Transação excluída", severity: "success" })
      recarregar()
    } catch {
      notify({ open: true, message: "Erro ao excluir transação", severity: "error" })
    } finally {
      setExcluindo(null)
    }
  }

  const colunas: PontesTabelaColuna<Transaction>[] = [
    {
      key: "desc", header: "Transação",
      render: (t) => <PontesCelulaIdentidade icone={t.tipo === 1 ? <TrendingUp size={17} strokeWidth={2.2} /> : <TrendingDown size={17} strokeWidth={2.2} />} tom={t.tipo === 1 ? "entrada" : "saida"} nome={t.descricao} sub={t.contaNome} />,
    },
    { key: "data", header: "Data", render: (t) => fmtData(t.data) },
    {
      key: "status", header: "Status",
      render: (t) => t.statusTransacao === 0
        ? <PontesBadge tone="warning" size="sm">Previsto</PontesBadge>
        : <PontesBadge tone="neutral" size="sm">{t.tipo === 1 ? "Recebido" : "Pago"}</PontesBadge>,
    },
    {
      key: "valor", header: "Valor", numerica: true,
      render: (t) => <span className={t.tipo === 1 ? styles.valEntrada : undefined}>{t.tipo === 1 ? "+" : "−"}{formatMoney(t.valor)}</span>,
    },
  ]

  const acoes = (t: Transaction) => [
    { key: "editar", label: "Editar", icon: <Pencil size={16} strokeWidth={2.5} />, onClick: () => setEditando(t) },
    { key: "excluir", label: "Excluir", danger: true, icon: <Trash2 size={16} strokeWidth={2.5} />, onClick: () => setExcluindo(t) },
  ]

  const tags: PontesTabelaTag[] = []
  if (busca) tags.push({ label: `Busca: "${busca}"`, onRemover: () => setBusca("") })
  if (tipo !== "tudo") tags.push({ label: tipo === "1" ? "Receitas" : "Despesas", onRemover: () => setTipo("tudo") })

  return (
    <>
      <div className={styles.aviso}>Tela de teste FUNCIONAL — Transações no padrão novo. Cria, edita e exclui de verdade (mesmos dados de /transactions).</div>
      <PontesTabela
        titulo="Transações"
        descricao="Todos os seus lançamentos, mês a mês"
        acao={{ label: "Nova transação", onClick: () => setNovoAberto(true) }}
        resumo={
          <div className={styles.stats}>
            <PontesStatCard label="Entrou" value={formatMoney(stats?.entradas ?? 0)} tone="success" />
            <PontesStatCard label="Saiu" value={formatMoney(stats?.saidas ?? 0)} tone="danger" />
            <PontesStatCard label="Saldo" value={formatMoney(stats?.saldo ?? 0)} />
          </div>
        }
        busca={{ value: busca, onChange: setBusca, placeholder: "Buscar lançamento…", ariaLabel: "Buscar transação" }}
        filtros={[{
          value: tipo, ariaLabel: "Tipo",
          options: [{ value: "tudo", label: "Tudo" }, { value: "1", label: "Receitas" }, { value: "2", label: "Despesas" }],
          onChange: (v) => setTipo(v as typeof tipo),
        }]}
        filtrosAvancados={[
          {
            tipo: "select", id: "status", label: "Status", value: status,
            opcoes: [{ value: "", label: "Qualquer status" }, { value: "1", label: "Efetivado" }, { value: "0", label: "Previsto" }],
            onChange: setStatus,
          },
          { tipo: "faixaValor", id: "valor", label: "Valor", min: valorMin, max: valorMax, onChange: (mn, mx) => { setValorMin(mn); setValorMax(mx) } },
          { tipo: "faixaData", id: "data", label: "Período", de, ate, onChange: (d, a) => { setDe(d); setAte(a) } },
        ]}
        tags={tags}
        colunas={colunas}
        itens={itens}
        chave={(t) => t.id}
        acoes={acoes}
        carregando={carregando}
        vazio={{ icone: <TrendingUp size={28} strokeWidth={2.5} />, titulo: "Nenhuma transação" }}
        paginacao={
          <PontesTablePagination
            total={total} page={page} pageSize={pageSize}
            onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
            itemLabel="transações" itemLabelSingular="transação"
          />
        }
      />

      <NewTransactionDialog open={novoAberto} onClose={() => setNovoAberto(false)} notify={notify as unknown as React.Dispatch<React.SetStateAction<{ open: boolean; message: string; severity: "success" | "error" | "warning" }>>} />
      <EditTransactionDialog transaction={editando ? paraEditavel(editando) : null} onClose={() => setEditando(null)} onSaved={() => { setEditando(null); recarregar() }} notify={notify} />
      <PontesDialog
        open={excluindo !== null}
        title="Excluir transação?"
        description={excluindo ? `${excluindo.descricao} · ${formatMoney(excluindo.valor)}` : undefined}
        tone="danger"
        confirmLabel="Excluir"
        onConfirm={handleExcluir}
        onCancel={() => setExcluindo(null)}
      />
    </>
  )
}
