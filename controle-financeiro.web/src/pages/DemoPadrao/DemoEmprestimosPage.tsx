/**
 * SANDBOX FUNCIONAL — rota /demo-emprestimos. Empréstimos no padrão novo, MAS de verdade: usa o
 * hook real (useEmprestimosLogic) + os modais reais + as ações reais no ⋮ + paginação no servidor.
 * Cria/quita/arquiva/exclui de fato (mesmos dados da tela /emprestimos). Só o layout é o padrão novo.
 */

import { HandCoins } from "lucide-react"
import {
  PontesPageHeader, PontesToolbar, PontesSegmented, PontesStatCard, PontesSkeletonList,
  PontesEmptyState, PontesTablePagination,
} from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import { useNavigate } from "react-router-dom"
import type { Emprestimo } from "@/types/Emprestimo"
import { useEmprestimosLogic } from "../Emprestimos/useEmprestimosLogic"
import { ActionIcons } from "../Emprestimos/EmprestimosLabItemParts"
import EmprestimosLabModals from "../Emprestimos/EmprestimosLabModals"
import { TabelaPadrao, StatusPadrao, type ColunaPadrao, type TagFiltro } from "./TabelaPadrao"
import styles from "./DemoPadrao.module.css"

export default function DemoEmprestimosPage() {
  const l = useEmprestimosLogic()
  const navigate = useNavigate()
  const primeiraCarga = l.loading && l.emprestimos.length === 0

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
  if (l.busca) tags.push({ label: `Busca: "${l.busca}"`, onRemover: () => l.setBusca("") })
  if (l.direcao !== "todos") tags.push({ label: l.direcao === "receber" ? "A receber" : "A pagar", onRemover: () => l.setDirecao("todos") })

  return (
    <div className={styles.pagina}>
      <div className={styles.aviso}>Tela de teste FUNCIONAL — Empréstimos no padrão novo. Cria, quita, arquiva e exclui de verdade (mesmos dados de /emprestimos).</div>
      <section className={styles.secao}>
        <PontesPageHeader titulo="Empréstimos" descricao="Dinheiro que você emprestou ou pegou emprestado" actionLabel="Novo empréstimo" onAction={l.openCreate} />
        <div className={styles.stats}>
          <PontesStatCard label="A receber" value={formatMoney(l.totalAReceber)} tone="success" />
          <PontesStatCard label="A pagar" value={formatMoney(l.totalAPagar)} tone="danger" />
          <PontesStatCard label="Ativos" value={String(l.qtdAtivos)} />
        </div>
        <div className={styles.toolbar}>
          <div className={styles.toolbarBusca}>
            <PontesToolbar search={{ value: l.busca, onChange: l.setBusca, placeholder: "Buscar por descrição ou pessoa…", ariaLabel: "Buscar empréstimo" }} />
          </div>
          <PontesSegmented
            ariaLabel="Direção"
            options={[{ value: "todos", label: "Tudo" }, { value: "receber", label: "A receber" }, { value: "pagar", label: "A pagar" }]}
            value={l.direcao}
            onChange={(v) => l.setDirecao(v as typeof l.direcao)}
          />
        </div>
        {primeiraCarga ? <PontesSkeletonList rows={4} />
          : l.emprestimos.length === 0 ? <PontesEmptyState icon={<HandCoins size={28} strokeWidth={2.5} />} title="Nenhum empréstimo" />
            : (
              <TabelaPadrao
                colunas={colunas}
                itens={l.emprestimos}
                chave={(e) => e.id}
                onLinhaClick={(e) => navigate(`/emprestimos/${e.id}`)}
                renderAcoes={(e) => <ActionIcons e={e} logic={l} mode="full" />}
                tags={tags}
                paginacao={
                  <PontesTablePagination
                    total={l.total} page={l.page} pageSize={l.pageSize}
                    onPageChange={l.setPage} onPageSizeChange={l.setPageSize}
                    itemLabel="empréstimos" itemLabelSingular="empréstimo"
                  />
                }
              />
            )}
      </section>
      <EmprestimosLabModals logic={l} />
    </div>
  )
}
