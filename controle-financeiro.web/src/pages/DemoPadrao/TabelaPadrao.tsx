/**
 * SANDBOX (validação em /demo-*) — a TELA DE LISTA padrão num componente só. A página declara só
 * colunas, filtros, ações e de onde vêm os dados; cabeçalho, resumo, busca, filtro, tags, tabela,
 * paginação, vazio e carregando vêm daqui, IGUAL em todas — não tem como cada tela sair diferente.
 * (Quando o Gustavo aprovar, isto vira componente do DS e as telas reais passam a usar.)
 */

import { type ReactNode } from "react"
import { AlertTriangle, X } from "lucide-react"
import {
  PontesPageHeader, PontesToolbar, PontesSegmented, PontesSkeletonList, PontesEmptyState,
  PontesButton, PontesRowActions, PontesBadge, type PontesRowAction,
} from "@/components/pontes"
import styles from "./DemoPadrao.module.css"

export type ColunaPadrao<T> = {
  key: string
  header: string
  align?: "left" | "right"
  /** Número/dinheiro: alinhamento tabular pra coluna não "dançar". */
  numerica?: boolean
  render: (item: T) => ReactNode
}

export type TagFiltro = { label: string; onRemover: () => void }

export type FiltroSegmentado = {
  value: string
  ariaLabel: string
  options: { value: string; label: ReactNode }[]
  onChange: (v: string) => void
}

export function TabelaPadrao<T>({
  titulo, descricao, acao, resumo, busca, filtros, tags,
  colunas, itens, chave, acoes, renderAcoes, onLinhaClick,
  carregando, erro, onTentarDeNovo, vazio, paginacao,
}: {
  titulo: string
  descricao?: string
  /** Botão primário do cabeçalho; também vira a ação do estado vazio. */
  acao?: { label: string; onClick: () => void }
  /** Resumo do topo (cards de número). Máx. 3-4. */
  resumo?: ReactNode
  busca?: { value: string; onChange: (v: string) => void; placeholder: string; ariaLabel?: string }
  filtros?: FiltroSegmentado[]
  tags?: TagFiltro[]
  colunas: ColunaPadrao<T>[]
  itens: T[]
  chave: (item: T) => string
  acoes?: (item: T) => PontesRowAction[]
  /** Slot de ações custom (⋮ com handlers próprios). Ganha do `acoes`. */
  renderAcoes?: (item: T) => ReactNode
  onLinhaClick?: (item: T) => void
  carregando?: boolean
  erro?: boolean
  onTentarDeNovo?: () => void
  vazio: { icone: ReactNode; titulo: string; descricao?: string }
  /** Rodapé de paginação (PontesTablePagination), dentro do cartão. */
  paginacao?: ReactNode
}) {
  const temAcoes = !!(acoes || renderAcoes)
  const temFiltroAtivo = !!tags && tags.length > 0
  const botaoCriar = acao && <PontesButton size="sm" onClick={acao.onClick}>{acao.label}</PontesButton>
  const temToolbar = !!busca || (filtros && filtros.length > 0)

  let conteudo: ReactNode
  if (carregando) {
    conteudo = <PontesSkeletonList rows={4} />
  } else if (erro && itens.length === 0) {
    conteudo = (
      <PontesEmptyState
        icon={<AlertTriangle size={28} strokeWidth={2.5} />}
        title="Não deu pra carregar"
        actions={onTentarDeNovo && <PontesButton variant="outline" size="sm" onClick={onTentarDeNovo}>Tentar de novo</PontesButton>}
      />
    )
  } else if (itens.length === 0) {
    conteudo = <PontesEmptyState icon={vazio.icone} title={vazio.titulo} description={vazio.descricao} actions={temFiltroAtivo ? undefined : botaoCriar} />
  } else {
    conteudo = (
      <div className={styles.caixa}>
        {temFiltroAtivo && (
          <div className={styles.tags}>
            <span className={styles.tagsLabel}>Filtros:</span>
            {tags!.map((t, i) => (
              <button key={i} type="button" className={styles.tag} onClick={t.onRemover}>
                {t.label}<X size={12} strokeWidth={2.5} />
              </button>
            ))}
          </div>
        )}
        <div className={styles.rolagem}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                {colunas.map((c) => (
                  <th key={c.key} scope="col" className={styles.th} data-align={c.align ?? (c.numerica ? "right" : "left")}>
                    {c.header}
                  </th>
                ))}
                {temAcoes && <th className={styles.th} data-acoes="true"><span className={styles.soLeitor}>Ações</span></th>}
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={chave(item)} className={styles.linha}
                  data-clicavel={onLinhaClick ? "true" : undefined}
                  onClick={onLinhaClick ? () => onLinhaClick(item) : undefined}>
                  {colunas.map((c) => (
                    <td key={c.key} className={styles.td} data-align={c.align ?? (c.numerica ? "right" : "left")} data-num={c.numerica ? "true" : undefined}>
                      {c.render(item)}
                    </td>
                  ))}
                  {temAcoes && (
                    <td className={styles.td} data-acoes="true" onClick={(e) => e.stopPropagation()}>
                      {renderAcoes ? renderAcoes(item) : <PontesRowActions actions={acoes!(item)} />}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {paginacao}
      </div>
    )
  }

  return (
    <div className={styles.pagina}>
      <section className={styles.secao}>
        <PontesPageHeader titulo={titulo} descricao={descricao} actionLabel={acao?.label} onAction={acao?.onClick} />
        {resumo}
        {temToolbar && (
          <div className={styles.toolbar}>
            <div className={styles.toolbarBusca}>
              {busca && <PontesToolbar search={{ value: busca.value, onChange: busca.onChange, placeholder: busca.placeholder, ariaLabel: busca.ariaLabel ?? busca.placeholder.replace(/…$/, "") }} />}
            </div>
            {filtros?.map((f, i) => (
              <PontesSegmented key={i} ariaLabel={f.ariaLabel} options={f.options} value={f.value} onChange={f.onChange} />
            ))}
          </div>
        )}
        <div aria-live="polite" aria-busy={carregando || undefined}>{conteudo}</div>
      </section>
    </div>
  )
}

/** Célula "identidade" padrão da 1ª coluna: quadradinho do ícone + nome (+ sub em cinza). */
export function CelulaIdentidade({
  icone, tom = "info", nome, sub,
}: { icone: ReactNode; tom?: "info" | "entrada" | "saida" | "neutro"; nome: string; sub?: ReactNode }) {
  return (
    <span className={styles.ident}>
      <span className={styles.identIcone} data-tom={tom} aria-hidden="true">{icone}</span>
      <span>
        <span className={styles.identNome}>{nome}</span>
        {sub != null && sub !== "" && <span className={styles.sub}> · {sub}</span>}
      </span>
    </span>
  )
}

/** Badge de status no vocabulário único — verde/amarelo/vermelho/cinza conforme o estado. */
export function StatusPadrao({ tone, children }: { tone: "success" | "warning" | "danger" | "neutral"; children: ReactNode }) {
  return <PontesBadge tone={tone} size="sm">{children}</PontesBadge>
}
