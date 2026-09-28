/**
 * SANDBOX — rota /demo-emprestimos. Empréstimos CLONADO no padrão novo, pro Gustavo validar.
 * NÃO altera a tela real (/emprestimos); só lê os dados.
 */

import { useEffect, useState } from "react"
import { HandCoins, Eye, Pencil, Trash2 } from "lucide-react"
import {
  PontesPageHeader, PontesToolbar, PontesSegmented, PontesStatCard, PontesSkeletonList, PontesEmptyState,
} from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import { listEmprestimosPage, getEmprestimoStats, type EmprestimoStats } from "@/services/emprestimoService"
import type { Emprestimo } from "@/types/Emprestimo"
import { TabelaPadrao, StatusPadrao, type ColunaPadrao, type TagFiltro } from "./TabelaPadrao"
import styles from "./DemoPadrao.module.css"

const acoesDemo = [
  { key: "ver", label: "Ver detalhes", icon: <Eye size={16} strokeWidth={2.5} />, onClick: () => {} },
  { key: "editar", label: "Editar", icon: <Pencil size={16} strokeWidth={2.5} />, onClick: () => {} },
  { key: "excluir", label: "Excluir", danger: true, icon: <Trash2 size={16} strokeWidth={2.5} />, onClick: () => {} },
]

export default function DemoEmprestimosPage() {
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
    <div className={styles.pagina}>
      <div className={styles.aviso}>Tela de teste — Empréstimos no padrão novo. A tela real (/emprestimos) não foi alterada.</div>
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
        {carregando ? <PontesSkeletonList rows={4} />
          : itens.length === 0 ? <PontesEmptyState icon={<HandCoins size={28} strokeWidth={2.5} />} title="Nenhum empréstimo" />
            : <TabelaPadrao colunas={colunas} itens={itens} chave={(e) => e.id} acoes={() => acoesDemo} onLinhaClick={() => {}} tags={tags} />}
      </section>
    </div>
  )
}
