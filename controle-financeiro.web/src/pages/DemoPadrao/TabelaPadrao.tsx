/**
 * SANDBOX (só pra validação em /demo-padrao) — NÃO é do DS, NÃO usar em tela real ainda.
 * A "tabela padrão" que os dois clones (Empréstimos e Transações) usam igual, pro Gustavo comparar
 * e dizer se é ESTE o jeito único de mostrar dados/filtros/ações em todas as telas.
 */

import { type ReactNode } from "react"
import { X } from "lucide-react"
import { PontesRowActions, type PontesRowAction, PontesBadge } from "@/components/pontes"
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

export function TabelaPadrao<T>({
  colunas, itens, chave, acoes, onLinhaClick, tags,
}: {
  colunas: ColunaPadrao<T>[]
  itens: T[]
  chave: (item: T) => string
  acoes?: (item: T) => PontesRowAction[]
  onLinhaClick?: (item: T) => void
  tags?: TagFiltro[]
}) {
  return (
    <div className={styles.caixa}>
      {tags && tags.length > 0 && (
        <div className={styles.tags}>
          <span className={styles.tagsLabel}>Filtros:</span>
          {tags.map((t, i) => (
            <button key={i} type="button" className={styles.tag} onClick={t.onRemover}>
              {t.label}
              <X size={12} strokeWidth={2.5} />
            </button>
          ))}
        </div>
      )}
      <div className={styles.rolagem}>
        <table className={styles.tabela}>
          <thead>
            <tr>
              {colunas.map((c) => (
                <th key={c.key} className={styles.th} data-align={c.align ?? (c.numerica ? "right" : "left")}>
                  {c.header}
                </th>
              ))}
              {acoes && <th className={styles.th} data-acoes="true" aria-label="Ações" />}
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr
                key={chave(item)}
                className={styles.linha}
                data-clicavel={onLinhaClick ? "true" : undefined}
                onClick={onLinhaClick ? () => onLinhaClick(item) : undefined}
              >
                {colunas.map((c) => (
                  <td key={c.key} className={styles.td} data-align={c.align ?? (c.numerica ? "right" : "left")} data-num={c.numerica ? "true" : undefined}>
                    {c.render(item)}
                  </td>
                ))}
                {acoes && (
                  <td className={styles.td} data-acoes="true" onClick={(e) => e.stopPropagation()}>
                    <PontesRowActions actions={acoes(item)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Badge de status no vocabulário único — verde/amarelo/vermelho/cinza conforme o estado. */
export function StatusPadrao({ tone, children }: { tone: "success" | "warning" | "danger" | "neutral"; children: ReactNode }) {
  return <PontesBadge tone={tone} size="sm">{children}</PontesBadge>
}
