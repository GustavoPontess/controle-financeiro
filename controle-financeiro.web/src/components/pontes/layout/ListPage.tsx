/**
 * ListPage — a TELA DE LISTA inteira (receita da skill pontes-telas). A página só declara o que
 * quer (botão, filtros, como cada item vira linha, vazio); o molde garante o resto, igual em todas:
 *   cabeçalho → resumo do topo (opcional) → busca + filtros → esqueleto | erro | vazio | lista + paginação
 *
 * O estado vem de um hook de lista paginada no servidor (`useListaPaginada`, em src/hooks) — aqui só
 * o formato que ele precisa ter (`PontesListaEstado`), pra o DS não depender da camada de dados.
 * Busca, filtro e paginação são SEMPRE no servidor. Variante única por enquanto: `list`
 * (`PontesListItem`); `table`/`cards` entram quando uma tela precisar.
 */

import { type ReactNode } from "react"
import { AlertTriangle, Plus, SearchX } from "lucide-react"
import { PontesPageHeader } from "./PageHeader"
import { PontesToolbar } from "./Toolbar"
import { PontesSegmented } from "../nav/Segmented"
import { PontesSkeletonList } from "../feedback/Skeleton"
import { PontesEmptyState } from "../feedback/EmptyState"
import { PontesButton } from "../buttons/Button"
import { PontesTablePagination } from "../data/TablePagination"
import { PontesList, PontesListItem, type PontesListItemProps } from "../data/ListItem"
import styles from "./ListPage.module.css"

/** O que o molde precisa do estado da lista (o `useListaPaginada` devolve isso). */
export type PontesListaEstado<T> = {
  itens: T[]
  total: number
  page: number
  pageSize: number
  carregando: boolean
  erro: boolean
  busca: string
  filtros: Record<string, string>
  filtrosAtivos: boolean
  setBusca: (v: string) => void
  // método (bivariante): aceita o setFiltro tipado do hook, que só conhece os campos da tela
  setFiltro(campo: string, valor: string): void
  setPage: (p: number) => void
  setPageSize: (s: number) => void
  limparFiltros: () => void
  recarregar: () => void
}

export type PontesListPageFiltro = {
  /** Nome do filtro no estado da lista (ex.: "status"). */
  campo: string
  ariaLabel: string
  opcoes: { value: string; label: ReactNode }[]
}

export type PontesListPageProps<T> = {
  lista: PontesListaEstado<T>
  /** Botão primário do cabeçalho ("Nova <coisa>"). Também vira a ação do vazio. */
  acao?: { label: string; onClick: () => void }
  /** Abas / navegação de período à esquerda do cabeçalho. */
  inicio?: ReactNode
  /** Resumo do topo (hero/StatCards), entre o cabeçalho e a busca. Máx. 3-4 números. */
  topo?: ReactNode
  /** Placeholder da busca, ex.: "Buscar conta fixa…". Sem ele, não há busca. */
  busca?: string
  filtros?: PontesListPageFiltro[]
  chave: (item: T) => string
  item: (item: T) => PontesListItemProps
  /** Vazio SEM filtro. O botão é o da `acao`. */
  vazio: { icone: ReactNode; titulo: string }
  /** Rótulo da paginação: ["conta fixa", "contas fixas"]. */
  rotulo: [singular: string, plural: string]
  /** Dentro de uma aba/detalhe: sem cabeçalho próprio. */
  embutida?: boolean
  /** Segura o esqueleto por mais algo que a tela carrega (ex.: o resumo que decide o vazio). */
  carregando?: boolean
}

export function PontesListPage<T>({
  lista, acao, inicio, topo, busca, filtros, chave, item, vazio, rotulo, embutida, carregando,
}: PontesListPageProps<T>) {
  const botaoCriar = acao && (
    <PontesButton size="sm" iconStart={<Plus size={16} strokeWidth={2.5} />} onClick={acao.onClick}>
      {acao.label}
    </PontesButton>
  )

  let conteudo: ReactNode
  if (lista.carregando || carregando) {
    conteudo = <PontesSkeletonList rows={4} />
  } else if (lista.erro && lista.itens.length === 0) {
    conteudo = (
      <PontesEmptyState
        icon={<AlertTriangle size={28} strokeWidth={2.5} />}
        title={`Não deu pra carregar ${rotulo[1]}`}
        actions={<PontesButton variant="outline" size="sm" onClick={lista.recarregar}>Tentar de novo</PontesButton>}
      />
    )
  } else if (lista.itens.length === 0) {
    conteudo = lista.filtrosAtivos ? (
      <PontesEmptyState
        icon={<SearchX size={28} strokeWidth={2.5} />}
        title="Nada encontrado"
        actions={<PontesButton variant="outline" size="sm" onClick={lista.limparFiltros}>Limpar filtros</PontesButton>}
      />
    ) : (
      <PontesEmptyState icon={vazio.icone} title={vazio.titulo} actions={botaoCriar} />
    )
  } else {
    conteudo = (
      <div className={styles.caixa}>
        <PontesList ariaLabel={rotulo[1]}>
          {lista.itens.map((t) => <PontesListItem key={chave(t)} {...item(t)} />)}
        </PontesList>
        <PontesTablePagination
          total={lista.total} page={lista.page} pageSize={lista.pageSize}
          onPageChange={lista.setPage}
          onPageSizeChange={lista.setPageSize}
          itemLabel={rotulo[1]} itemLabelSingular={rotulo[0]}
        />
      </div>
    )
  }

  const temToolbar = !!busca || (filtros && filtros.length > 0)

  return (
    <div className={styles.tela}>
      {!embutida && (inicio || acao) && (
        <PontesPageHeader start={inicio} actionLabel={acao?.label} onAction={acao?.onClick} />
      )}
      {topo}
      {temToolbar && (
        <PontesToolbar
          search={busca ? { value: lista.busca, onChange: lista.setBusca, placeholder: busca, ariaLabel: busca.replace(/…$/, "") } : undefined}
        >
          {filtros?.map((f) => (
            <PontesSegmented
              key={f.campo}
              ariaLabel={f.ariaLabel}
              options={f.opcoes}
              value={lista.filtros[f.campo]}
              onChange={(v) => lista.setFiltro(f.campo, v)}
            />
          ))}
        </PontesToolbar>
      )}
      {conteudo}
    </div>
  )
}
