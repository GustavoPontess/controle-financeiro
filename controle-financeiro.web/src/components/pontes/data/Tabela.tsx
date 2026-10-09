/**
 * PontesTabela — a TELA DE LISTA padrão do Pontes num componente só. A página declara colunas,
 * filtros, ações e de onde vêm os dados; cabeçalho, resumo, busca, filtros, tags, tabela, paginação,
 * vazio e carregando vêm daqui, IGUAL em todas — padroniza a visualização de dados.
 *
 * Busca/filtro/paginação são NO SERVIDOR (a página passa os handlers). Ações da linha SEMPRE no ⋮
 * (`acoes`) ou num slot próprio (`renderAcoes`); clicar na linha abre o detalhe.
 */

import { useState, type ReactNode } from "react"
import { AlertTriangle, ChevronDown } from "lucide-react"
import { PontesToolbar } from "../layout/Toolbar"
import { PontesSegmented } from "../nav/Segmented"
import { PontesSkeletonList } from "../feedback/Skeleton"
import { PontesEmptyState } from "../feedback/EmptyState"
import { PontesButton } from "../buttons/Button"
import { PontesRowActions, type PontesRowAction } from "../buttons/RowActions"
import { PontesTabelaPainelFiltros } from "./TabelaFiltros"
import { PontesTabelaColunas } from "./TabelaColunas"
import { tagsDeFiltrosAvancados, type PontesFiltroAvancado, type PontesTabelaTag } from "./tabelaFiltrosCore"
import styles from "./Tabela.module.css"

export type { PontesFiltroAvancado, PontesTabelaTag }

export type PontesTabelaColuna<T> = {
  key: string
  header: string
  align?: "left" | "right"
  /** Número/dinheiro: à direita + tabular (a coluna não "dança"). */
  numerica?: boolean
  render: (item: T) => ReactNode
}

export type PontesTabelaFiltroRapido = {
  value: string
  ariaLabel: string
  options: { value: string; label: ReactNode }[]
  onChange: (v: string) => void
}

export type PontesTabelaProps<T> = {
  /** id estável da tela — persiste preferências do usuário (ex.: colunas visíveis) por localStorage. */
  id?: string
  /** Nome da tela no cabeçalho. Omita quando o layout já mostra o título (ex.: painel admin). */
  titulo?: string
  descricao?: string
  /** Botão primário do cabeçalho; também vira a ação do estado vazio. */
  acao?: { label: string; onClick: () => void }
  /** Resumo do topo (cards de número). Máx. 3-4. */
  resumo?: ReactNode
  busca?: { value: string; onChange: (v: string) => void; placeholder: string; ariaLabel?: string }
  /** Filtros rápidos inline (segmented). */
  filtros?: PontesTabelaFiltroRapido[]
  /** Filtros avançados no botão "Filtros" (select, faixa de valor, período). Tags saem sozinhas. */
  filtrosAvancados?: PontesFiltroAvancado[]
  /** Controles extra da toolbar ANTES do botão de criar (ex.: "Consolidar"). Genérico. */
  ferramentas?: ReactNode
  /** Controles extra no fim da toolbar, depois do botão de criar e ANTES do seletor de colunas
   *  (o ⊞ de colunas é sempre o último). Ex.: toggle "Arquivados" só-ícone. Genérico. */
  ferramentasFim?: ReactNode
  /** Tags de busca/segmented (as dos filtros avançados são adicionadas sozinhas). */
  tags?: PontesTabelaTag[]
  colunas: PontesTabelaColuna<T>[]
  /** Colunas ocultas no padrão ORIGINAL (visão mínima). O usuário pode salvar o próprio
   *  padrão (localStorage por `id`) ou voltar a este. 1ª coluna nunca oculta. */
  colunasPadraoOcultas?: string[]
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
  /**
   * Modo "Mostrar mais" — a alternativa à paginação (use UM dos dois; com `paginacao`, este é
   * ignorado). A página busca o próximo lote NO SERVIDOR e acumula em `itens`; aqui só sai o botão
   * largo no rodapé do cartão, que some quando `restantes` chega a 0. Bom pra lista que se lê de
   * cima pra baixo (movimentos, histórico) sem carregar tudo de uma vez.
   */
  carregarMais?: { restantes: number; carregando?: boolean; onCarregarMais: () => void }
}

export function PontesTabela<T>({
  id, titulo, acao, resumo, busca, filtros, filtrosAvancados, ferramentas, ferramentasFim, tags,
  colunas, colunasPadraoOcultas, itens, chave, acoes, renderAcoes, onLinhaClick,
  carregando, erro, onTentarDeNovo, vazio, paginacao, carregarMais,
}: PontesTabelaProps<T>) {
  const temAcoes = !!(acoes || renderAcoes)
  const tagsTodas = [...(tags ?? []), ...tagsDeFiltrosAvancados(filtrosAvancados ?? [])]
  const temFiltroAtivo = tagsTodas.length > 0
  const botaoCriar = acao && <PontesButton size="sm" onClick={acao.onClick}>{acao.label}</PontesButton>
  // Mostrar/ocultar colunas (1ª coluna fica fixa). Padrão ORIGINAL = colunasPadraoOcultas;
  // padrão SALVO do usuário mora em localStorage por `id`. Salvar/voltar no popover de colunas.
  const chavePadrao = id ? `pontes:tabela:${id}:colunas` : null
  const padraoOriginal = () => new Set(colunasPadraoOcultas ?? [])
  const [ocultas, setOcultas] = useState<Set<string>>(() => {
    if (chavePadrao) {
      try {
        const raw = localStorage.getItem(chavePadrao)
        if (raw) return new Set<string>(JSON.parse(raw))
      } catch { /* localStorage indisponível/privado → cai no padrão */ }
    }
    return padraoOriginal()
  })
  const alternarColuna = (key: string) => setOcultas((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })
  // "Salvar padrão" = grava a visão atual (persiste). "Voltar ao padrão" = apaga o salvo e volta ao original mínimo.
  const salvarPadraoColunas = () => { if (chavePadrao) try { localStorage.setItem(chavePadrao, JSON.stringify([...ocultas])) } catch { /* ignore */ } }
  const voltarPadraoColunas = () => { if (chavePadrao) try { localStorage.removeItem(chavePadrao) } catch { /* ignore */ } ; setOcultas(padraoOriginal()) }
  const colunasVisiveis = colunas.filter((c) => !ocultas.has(c.key))
  // Filtro só aparece se a coluna dele estiver visível (sem `coluna` = aparece sempre).
  const filtrosVisiveis = (filtrosAvancados ?? []).filter((f) => !f.coluna || !ocultas.has(f.coluna))
  const temColunas = colunas.length > 1
  const temToolbar = !!busca || (filtros && filtros.length > 0) || filtrosVisiveis.length > 0 || temColunas || !!ferramentas || !!ferramentasFim
  // Banda do topo do cartão aparece se há nome, ação ou algum controle.
  const temBanda = !!titulo || !!acao || temToolbar

  // Conteúdo (dentro do cartão, abaixo da toolbar+chips): carregando | erro | vazio | tabela.
  let conteudo: ReactNode
  if (carregando) {
    conteudo = <div className={styles.estado}><PontesSkeletonList rows={4} /></div>
  } else if (erro && itens.length === 0) {
    conteudo = (
      <div className={styles.estado}>
        <PontesEmptyState
          icon={<AlertTriangle size={28} strokeWidth={2.5} />}
          title="Não deu pra carregar"
          actions={onTentarDeNovo && <PontesButton variant="outline" size="sm" onClick={onTentarDeNovo}>Tentar de novo</PontesButton>}
        />
      </div>
    )
  } else if (itens.length === 0) {
    conteudo = (
      <div className={styles.estado}>
        <PontesEmptyState icon={vazio.icone} title={vazio.titulo} description={vazio.descricao} actions={temFiltroAtivo ? undefined : botaoCriar} />
      </div>
    )
  } else {
    conteudo = (
      <>
        <div className={styles.rolagem}>
          <table className={styles.tabela}>
            <thead>
              <tr>
                {colunasVisiveis.map((c) => (
                  <th key={c.key} scope="col" className={styles.th} data-align={c.align ?? (c.numerica ? "right" : "left")}>
                    {c.header}
                  </th>
                ))}
                {temAcoes && <th className={styles.th} data-acoes="true">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={chave(item)} className={styles.linha}
                  data-clicavel={onLinhaClick ? "true" : undefined}
                  onClick={onLinhaClick ? () => onLinhaClick(item) : undefined}>
                  {colunasVisiveis.map((c) => (
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
        {paginacao ?? (carregarMais && carregarMais.restantes > 0 && (
          <div className={styles.carregarMais}>
            <PontesButton variant="ghost" size="sm" fullWidth loading={carregarMais.carregando}
              iconEnd={<ChevronDown size={14} strokeWidth={2.5} />} onClick={carregarMais.onCarregarMais}>
              Mostrar mais <span className={styles.carregarMaisResto}>· faltam {carregarMais.restantes}</span>
            </PontesButton>
          </div>
        ))}
      </>
    )
  }

  return (
    <div className={styles.tela}>
      {resumo}
      {/* UM cartão só. Banda do topo: nome da tabela à ESQUERDA + controles (busca/filtros/ação)
          compactos à DIREITA — a busca faz parte da tabela. Depois: chips + tabela. */}
      <div className={styles.caixa}>
        {temBanda && (
          <div className={styles.toolbar}>
            {titulo && <h1 className={styles.titulo}>{titulo}</h1>}
            <div className={styles.controles}>
              {busca && <div className={styles.busca}><PontesToolbar search={{ value: busca.value, onChange: busca.onChange, placeholder: busca.placeholder, ariaLabel: busca.ariaLabel ?? busca.placeholder.replace(/…$/, "") }} /></div>}
              {filtros?.map((f, i) => (
                <PontesSegmented key={i} size="sm" ariaLabel={f.ariaLabel} options={f.options} value={f.value} onChange={f.onChange} />
              ))}
              {filtrosVisiveis.length > 0 && <PontesTabelaPainelFiltros filtros={filtrosVisiveis} />}
              {ferramentas}
              {botaoCriar}
              {ferramentasFim}
              {temColunas && (
                <PontesTabelaColunas
                  colunas={colunas.map((c) => ({ key: c.key, header: c.header }))}
                  ocultas={ocultas}
                  onToggle={alternarColuna}
                  onSalvar={chavePadrao ? salvarPadraoColunas : undefined}
                  onVoltarPadrao={chavePadrao ? voltarPadraoColunas : undefined}
                />
              )}
            </div>
          </div>
        )}
        <div aria-live="polite" aria-busy={carregando || undefined}>{conteudo}</div>
      </div>
    </div>
  )
}

/** Célula "identidade" padrão da 1ª coluna: quadradinho do ícone + nome (+ sub em cinza). */
export function PontesCelulaIdentidade({
  icone, tom = "info", nome, sub,
}: { icone: ReactNode; tom?: "info" | "entrada" | "saida" | "neutro"; nome: string; sub?: ReactNode }) {
  return (
    <span className={styles.ident}>
      <span className={styles.identIcone} data-tom={tom} aria-hidden="true">{icone}</span>
      <span className={styles.identTexto}>
        <span className={styles.identNome} title={nome}>{nome}</span>
        {sub != null && sub !== "" && <span className={styles.sub}>{sub}</span>}
      </span>
    </span>
  )
}
