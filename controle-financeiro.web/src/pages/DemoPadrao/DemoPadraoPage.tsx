/**
 * SANDBOX — rota /demo-padrao. Mostra Empréstimos e Transações CLONADOS no MESMO padrão, pro Gustavo
 * validar antes de aplicar nas telas reais. NÃO altera nada das telas de verdade; só lê os dados.
 */

import { useEffect, useMemo, useState } from "react"
import { HandCoins, TrendingUp, TrendingDown, Eye, Pencil, Trash2 } from "lucide-react"
import {
  PontesPageHeader, PontesToolbar, PontesSegmented, PontesStatCard, PontesSkeletonList, PontesEmptyState,
} from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import { listEmprestimosPage, getEmprestimoStats, type EmprestimoStats } from "@/services/emprestimoService"
import { listTransactionsPage, getTransactionStats } from "@/services/transactionService"
import type { Emprestimo } from "@/types/Emprestimo"
import type { Transaction } from "@/types/Transaction"
import { TabelaPadrao, StatusPadrao, type ColunaPadrao, type TagFiltro } from "./TabelaPadrao"
import styles from "./DemoPadrao.module.css"

const fmtData = (s?: string) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—")
const acoesDemo = [
  { key: "ver", label: "Ver detalhes", icon: <Eye size={16} strokeWidth={2.5} />, onClick: () => {} },
  { key: "editar", label: "Editar", icon: <Pencil size={16} strokeWidth={2.5} />, onClick: () => {} },
  { key: "excluir", label: "Excluir", danger: true, icon: <Trash2 size={16} strokeWidth={2.5} />, onClick: () => {} },
]

// ── Empréstimos (clone) ────────────────────────────────────────────────────────
function SecaoEmprestimos() {
  const [itens, setItens] = useState<Emprestimo[]>([])
  const [stats, setStats] = useState<EmprestimoStats | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState("")
  const [direcao, setDirecao] = useState<"tudo" | "receber" | "pagar">("tudo")

  useEffect(() => {
    setCarregando(true)
    Promise.all([
      listEmprestimosPage(1, 25, false, busca || undefined, direcao === "tudo" ? undefined : direcao),
      getEmprestimoStats(),
    ])
      .then(([lista, s]) => { setItens(lista.items); setStats(s) })
      .finally(() => setCarregando(false))
  }, [busca, direcao])

  const colunas: ColunaPadrao<Emprestimo>[] = [
    {
      key: "desc", header: "Empréstimo",
      render: (e) => (
        <span className={styles.ident}>
          <span className={styles.identIcone} data-tom={e.tipo === 1 ? "saida" : "entrada"}><HandCoins size={17} strokeWidth={2.2} /></span>
          <span>
            <span className={styles.identNome}>{e.descricao}</span>
            <span className={styles.sub}> · {e.pessoa}</span>
          </span>
        </span>
      ),
    },
    { key: "forma", header: "Forma", render: (e) => e.tipoDescricao },
    {
      key: "status", header: "Status",
      render: (e) => e.quitado
        ? <StatusPadrao tone="neutral">Quitado</StatusPadrao>
        : e.vencido
          ? <StatusPadrao tone="danger">Vencido</StatusPadrao>
          : <StatusPadrao tone={e.tipo === 1 ? "warning" : "success"}>{e.tipo === 1 ? "A pagar" : "A receber"}</StatusPadrao>,
    },
    { key: "restante", header: "Restante", numerica: true, render: (e) => formatMoney(e.valorRestante) },
  ]

  const tags: TagFiltro[] = []
  if (busca) tags.push({ label: `Busca: "${busca}"`, onRemover: () => setBusca("") })
  if (direcao !== "tudo") tags.push({ label: direcao === "receber" ? "A receber" : "A pagar", onRemover: () => setDirecao("tudo") })

  return (
    <section className={styles.secao}>
      <PontesPageHeader titulo="Empréstimos" descricao="Dinheiro que você emprestou ou pegou emprestado" actionLabel="Novo empréstimo" onAction={() => {}} />
      <div className={styles.stats}>
        <PontesStatCard label="A receber" value={formatMoney(stats?.totalAReceber ?? 0)} tone="success" />
        <PontesStatCard label="A pagar" value={formatMoney(stats?.totalAPagar ?? 0)} tone="danger" />
        <PontesStatCard label="Ativos" value={String(stats?.ativos ?? 0)} />
      </div>
      <div className={styles.toolbar}>
        <div className={styles.toolbarBusca}>
          <PontesToolbar search={{ value: busca, onChange: setBusca, placeholder: "Buscar por descrição ou pessoa…", ariaLabel: "Buscar empréstimo" }} />
        </div>
        <PontesSegmented
          ariaLabel="Direção"
          options={[{ value: "tudo", label: "Tudo" }, { value: "receber", label: "A receber" }, { value: "pagar", label: "A pagar" }]}
          value={direcao}
          onChange={(v) => setDirecao(v as typeof direcao)}
        />
      </div>
      {carregando ? <PontesSkeletonList rows={3} />
        : itens.length === 0 ? <PontesEmptyState icon={<HandCoins size={28} strokeWidth={2.5} />} title="Nenhum empréstimo" />
          : <TabelaPadrao colunas={colunas} itens={itens} chave={(e) => e.id} acoes={() => acoesDemo} onLinhaClick={() => {}} tags={tags} />}
    </section>
  )
}

// ── Transações (clone) ─────────────────────────────────────────────────────────
type TxStats = { entradas: number; saidas: number; saldo: number }
function SecaoTransacoes() {
  const [itens, setItens] = useState<Transaction[]>([])
  const [stats, setStats] = useState<TxStats | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState("")
  const [tipo, setTipo] = useState<"tudo" | "1" | "2">("tudo")

  useEffect(() => {
    setCarregando(true)
    Promise.all([
      listTransactionsPage(1, 25, { q: busca || undefined, tipo: tipo === "tudo" ? undefined : Number(tipo) }),
      getTransactionStats({}).catch(() => null),
    ])
      .then(([lista, s]) => {
        setItens(lista.items)
        setStats(s ? { entradas: s.entradas, saidas: s.saidas, saldo: s.saldoPeriodo } : null)
      })
      .finally(() => setCarregando(false))
  }, [busca, tipo])

  const colunas: ColunaPadrao<Transaction>[] = [
    {
      key: "desc", header: "Transação",
      render: (t) => (
        <span className={styles.ident}>
          <span className={styles.identIcone} data-tom={t.tipo === 1 ? "entrada" : "saida"}>{t.tipo === 1 ? <TrendingUp size={17} strokeWidth={2.2} /> : <TrendingDown size={17} strokeWidth={2.2} />}</span>
          <span>
            <span className={styles.identNome}>{t.descricao}</span>
            {t.contaNome && <span className={styles.sub}> · {t.contaNome}</span>}
          </span>
        </span>
      ),
    },
    { key: "data", header: "Data", render: (t) => fmtData(t.data) },
    {
      key: "status", header: "Status",
      render: (t) => t.statusTransacao === 0
        ? <StatusPadrao tone="warning">Previsto</StatusPadrao>
        : <StatusPadrao tone="neutral">{t.tipo === 1 ? "Recebido" : "Pago"}</StatusPadrao>,
    },
    {
      key: "valor", header: "Valor", numerica: true,
      render: (t) => <span className={t.tipo === 1 ? styles.valEntrada : undefined}>{t.tipo === 1 ? "+" : "−"}{formatMoney(t.valor)}</span>,
    },
  ]

  const tags: TagFiltro[] = []
  if (busca) tags.push({ label: `Busca: "${busca}"`, onRemover: () => setBusca("") })
  if (tipo !== "tudo") tags.push({ label: tipo === "1" ? "Receitas" : "Despesas", onRemover: () => setTipo("tudo") })

  return (
    <section className={styles.secao}>
      <PontesPageHeader titulo="Transações" descricao="Todos os seus lançamentos, mês a mês" actionLabel="Nova transação" onAction={() => {}} />
      <div className={styles.stats}>
        <PontesStatCard label="Entrou" value={formatMoney(stats?.entradas ?? 0)} tone="success" />
        <PontesStatCard label="Saiu" value={formatMoney(stats?.saidas ?? 0)} tone="danger" />
        <PontesStatCard label="Saldo" value={formatMoney(stats?.saldo ?? 0)} />
      </div>
      <div className={styles.toolbar}>
        <div className={styles.toolbarBusca}>
          <PontesToolbar search={{ value: busca, onChange: setBusca, placeholder: "Buscar lançamento…", ariaLabel: "Buscar transação" }} />
        </div>
        <PontesSegmented
          ariaLabel="Tipo"
          options={[{ value: "tudo", label: "Tudo" }, { value: "1", label: "Receitas" }, { value: "2", label: "Despesas" }]}
          value={tipo}
          onChange={(v) => setTipo(v as typeof tipo)}
        />
      </div>
      {carregando ? <PontesSkeletonList rows={3} />
        : itens.length === 0 ? <PontesEmptyState icon={<TrendingUp size={28} strokeWidth={2.5} />} title="Nenhuma transação" />
          : <TabelaPadrao colunas={colunas} itens={itens} chave={(t) => t.id} acoes={() => acoesDemo} onLinhaClick={() => {}} tags={tags} />}
    </section>
  )
}

export default function DemoPadraoPage() {
  const aviso = useMemo(() => "Tela de teste — Empréstimos e Transações no mesmo padrão. As telas reais não foram alteradas.", [])
  return (
    <div className={styles.pagina}>
      <div className={styles.aviso}>{aviso}</div>
      <SecaoEmprestimos />
      <SecaoTransacoes />
    </div>
  )
}
