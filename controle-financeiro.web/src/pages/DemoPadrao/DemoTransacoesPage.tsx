/**
 * SANDBOX — rota /demo-transacoes. Transações CLONADO no padrão novo, pro Gustavo validar.
 * NÃO altera a tela real (/transactions); só lê os dados.
 */

import { useEffect, useState } from "react"
import { TrendingUp, TrendingDown, Eye, Pencil, Trash2 } from "lucide-react"
import {
  PontesPageHeader, PontesToolbar, PontesSegmented, PontesStatCard, PontesSkeletonList, PontesEmptyState,
} from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import { listTransactionsPage, getTransactionStats } from "@/services/transactionService"
import type { Transaction } from "@/types/Transaction"
import { TabelaPadrao, StatusPadrao, type ColunaPadrao, type TagFiltro } from "./TabelaPadrao"
import styles from "./DemoPadrao.module.css"

const fmtData = (s?: string) => (s ? new Date(s).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—")
const acoesDemo = [
  { key: "ver", label: "Ver detalhes", icon: <Eye size={16} strokeWidth={2.5} />, onClick: () => {} },
  { key: "editar", label: "Editar", icon: <Pencil size={16} strokeWidth={2.5} />, onClick: () => {} },
  { key: "excluir", label: "Excluir", danger: true, icon: <Trash2 size={16} strokeWidth={2.5} />, onClick: () => {} },
]

type TxStats = { entradas: number; saidas: number; saldo: number }

export default function DemoTransacoesPage() {
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
    <div className={styles.pagina}>
      <div className={styles.aviso}>Tela de teste — Transações no padrão novo. A tela real (/transactions) não foi alterada.</div>
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
        {carregando ? <PontesSkeletonList rows={4} />
          : itens.length === 0 ? <PontesEmptyState icon={<TrendingUp size={28} strokeWidth={2.5} />} title="Nenhuma transação" />
            : <TabelaPadrao colunas={colunas} itens={itens} chave={(t) => t.id} acoes={() => acoesDemo} onLinhaClick={() => {}} tags={tags} />}
      </section>
    </div>
  )
}
