/**
 * ListItem — a LINHA padrão das listas internas (variante `list` da receita, skill pontes-telas;
 * o que vai em cada posição, por entidade: docs/features/padrao-telas/ficha-por-entidade.md).
 *
 * Anatomia fixa, sempre nesta ordem: ícone · título (+ status) · meta · valor · ⋮
 *  - status: badge SÓ quando o item foge do normal (Pausada, Cancelada, Atrasada…);
 *  - meta: UMA linha de fatos em TEXTO, separados por " · " — o tipo só aceita texto, então
 *    badge colorido de frequência/categoria não cabe aqui (regra "normal não se anuncia");
 *  - teto: o resto mora no detalhe.
 * Clicar na linha (se `onClick`) abre o detalhe — a área clicável é um <button> de verdade
 * (teclado/leitor de tela); o ⋮ fica fora dele.
 */

import { Fragment, type ReactNode } from "react"
import { PontesBadge, type PontesBadgeTone } from "./Badge"
import { PontesRowActions, type PontesRowAction } from "../buttons/RowActions"
import styles from "./ListItem.module.css"

export type PontesListItemTom = "neutro" | "entrada" | "saida" | "info"

/** Um fato da meta. `alerta` pinta em aviso (ex.: prazo em até 7 dias). Falsy = omitido. */
export type PontesListItemMeta = string | { texto: string; alerta?: boolean } | null | undefined | false

export type PontesListItemProps = {
  /** Ícone lucide 18px / strokeWidth 2.4, ou `PontesBankBadge`/avatar. */
  icone: ReactNode
  /** Cor do quadrado do ícone. Default "info". */
  tom?: PontesListItemTom
  titulo: string
  status?: { label: string; tone: PontesBadgeTone }
  meta?: PontesListItemMeta[]
  valor?: ReactNode
  /** "entrada" pinta o valor de verde; "problema" de vermelho (só pra problema). Default "neutro". */
  valorTom?: "neutro" | "entrada" | "problema"
  /** Item encerrado/cancelado: linha esmaecida. */
  inativo?: boolean
  acoes?: PontesRowAction[]
  onClick?: () => void
}

export function PontesListItem({
  icone, tom = "info", titulo, status, meta, valor, valorTom = "neutro", inativo, acoes, onClick,
}: PontesListItemProps) {
  const fatos = (meta ?? []).filter(Boolean).map((m) => (typeof m === "string" ? { texto: m } : m)) as
    { texto: string; alerta?: boolean }[]

  const corpo = (
    <>
      <span className={styles.icone} data-tom={tom} aria-hidden="true">{icone}</span>
      <span className={styles.info}>
        <span className={styles.topo}>
          <span className={styles.titulo} title={titulo}>{titulo}</span>
          {status && <PontesBadge tone={status.tone} size="sm">{status.label}</PontesBadge>}
        </span>
        {fatos.length > 0 && (
          <span className={styles.meta} title={fatos.map((f) => f.texto).join(" · ")}>
            {fatos.map((f, i) => (
              <Fragment key={i}>
                {/* " · " é visual; o leitor de tela ouve a vírgula, não os fatos colados */}
                {i > 0 && <><span aria-hidden="true"> · </span><span className={styles.soLeitor}>, </span></>}
                <span data-alerta={f.alerta ? "true" : undefined}>{f.texto}</span>
              </Fragment>
            ))}
          </span>
        )}
      </span>
    </>
  )

  return (
    <li className={styles.item} data-inativo={inativo ? "true" : undefined} data-clicavel={onClick ? "true" : undefined}>
      {onClick ? (
        <button type="button" className={styles.principal} onClick={onClick}>{corpo}</button>
      ) : (
        <div className={styles.principal}>{corpo}</div>
      )}
      {(valor !== undefined || (acoes && acoes.length > 0)) && (
        <span className={styles.direita}>
          {valor !== undefined && <span className={styles.valor} data-tom={valorTom}>{valor}</span>}
          {acoes && acoes.length > 0 && <PontesRowActions actions={acoes} />}
        </span>
      )}
    </li>
  )
}

/** Container da lista: `<ul>` sem estilo de marcador; o cartão com borda vem do `PontesListPage`. */
export function PontesList({ children, ariaLabel }: { children: ReactNode; ariaLabel?: string }) {
  return <ul className={styles.lista} aria-label={ariaLabel}>{children}</ul>
}
