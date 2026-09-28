/**
 * SANDBOX FUNCIONAL — /demo-emprestimos. Empréstimos no padrão novo, de verdade: hook real
 * (useEmprestimosLogic) + ações reais no ⋮ + modais reais + paginação. Só o layout é o padrão novo.
 * A tela monta só o resumo, as colunas e as ações; todo o resto vem do PontesTabela.
 */

import { HandCoins } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { PontesStatCard, PontesTablePagination } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import type { Emprestimo } from "@/types/Emprestimo"
import { useEmprestimosLogic } from "../Emprestimos/useEmprestimosLogic"
import { ActionIcons } from "../Emprestimos/EmprestimosLabItemParts"
import EmprestimosLabModals from "../Emprestimos/EmprestimosLabModals"
import { PontesTabela, PontesCelulaIdentidade, PontesBadge, type PontesTabelaColuna, type PontesTabelaTag } from "@/components/pontes"
import styles from "./DemoPadrao.module.css"

export default function DemoEmprestimosPage() {
  const l = useEmprestimosLogic()
  const navigate = useNavigate()
  const primeiraCarga = l.loading && l.emprestimos.length === 0

  const colunas: PontesTabelaColuna<Emprestimo>[] = [
    {
      key: "desc", header: "Empréstimo",
      render: (e) => <PontesCelulaIdentidade icone={<HandCoins size={17} strokeWidth={2.2} />} tom={e.tipo === 1 ? "saida" : "entrada"} nome={e.descricao} sub={e.pessoa} />,
    },
    { key: "forma", header: "Forma", render: (e) => e.tipoDescricao },
    {
      key: "status", header: "Status",
      render: (e) => e.quitado
        ? <PontesBadge tone="neutral" size="sm">Quitado</PontesBadge>
        : e.vencido
          ? <PontesBadge tone="danger" size="sm">Vencido</PontesBadge>
          : <PontesBadge tone={e.tipo === 1 ? "warning" : "success"} size="sm">{e.tipo === 1 ? "A pagar" : "A receber"}</PontesBadge>,
    },
    { key: "restante", header: "Restante", numerica: true, render: (e) => formatMoney(e.valorRestante) },
  ]

  const tags: PontesTabelaTag[] = []
  if (l.busca) tags.push({ label: `Busca: "${l.busca}"`, onRemover: () => l.setBusca("") })
  if (l.direcao !== "todos") tags.push({ label: l.direcao === "receber" ? "A receber" : "A pagar", onRemover: () => l.setDirecao("todos") })

  return (
    <>
      <div className={styles.aviso}>Tela de teste FUNCIONAL — Empréstimos no padrão novo. Cria, quita, arquiva e exclui de verdade (mesmos dados de /emprestimos).</div>
      <PontesTabela
        titulo="Empréstimos"
        descricao="Dinheiro que você emprestou ou pegou emprestado"
        acao={{ label: "Novo empréstimo", onClick: l.openCreate }}
        resumo={
          <div className={styles.stats}>
            <PontesStatCard label="A receber" value={formatMoney(l.totalAReceber)} tone="success" />
            <PontesStatCard label="A pagar" value={formatMoney(l.totalAPagar)} tone="danger" />
            <PontesStatCard label="Ativos" value={String(l.qtdAtivos)} />
          </div>
        }
        busca={{ value: l.busca, onChange: l.setBusca, placeholder: "Buscar por descrição ou pessoa…", ariaLabel: "Buscar empréstimo" }}
        filtros={[{
          value: l.direcao, ariaLabel: "Direção",
          options: [{ value: "todos", label: "Tudo" }, { value: "receber", label: "A receber" }, { value: "pagar", label: "A pagar" }],
          onChange: (v) => l.setDirecao(v as typeof l.direcao),
        }]}
        tags={tags}
        colunas={colunas}
        itens={l.emprestimos}
        chave={(e) => e.id}
        onLinhaClick={(e) => navigate(`/emprestimos/${e.id}`)}
        renderAcoes={(e) => <ActionIcons e={e} logic={l} mode="full" />}
        carregando={primeiraCarga}
        vazio={{ icone: <HandCoins size={28} strokeWidth={2.5} />, titulo: "Nenhum empréstimo" }}
        paginacao={
          <PontesTablePagination
            total={l.total} page={l.page} pageSize={l.pageSize}
            onPageChange={l.setPage} onPageSizeChange={l.setPageSize}
            itemLabel="empréstimos" itemLabelSingular="empréstimo"
          />
        }
      />
      <EmprestimosLabModals logic={l} />
    </>
  )
}
