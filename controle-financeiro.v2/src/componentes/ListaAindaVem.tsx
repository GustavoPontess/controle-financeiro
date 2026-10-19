// O que ainda vem no mês (contas previstas): nome, dia e categoria, o valor e, com `base`, quanto é da renda.
// Cada linha leva pra conta fixa de onde veio (pausar ou cancelar) ou pro lançamento previsto avulso.
// Usada no cartão da renda (UsoDaRenda) e na ficha do limite.
import { Link } from "react-router-dom"
import type { AindaVem } from "../types/DinheiroDoMes"
import { Dinheiro } from "./Dinheiro"
import styles from "./ListaAindaVem.module.css"

const pct = (v: number) => `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v)}%`

export default function ListaAindaVem({ itens, base, semCategoria }: {
  itens: AindaVem[]
  /** Renda do mês: mostra a coluna de % (no cartão da renda). */
  base?: number
  /** Esconde a categoria (na ficha do limite ela já é a da linha). */
  semCategoria?: boolean
}) {
  return (
    <ul className={styles.lista} data-com-pct={base ? "true" : undefined} aria-label="Ainda vem este mês">
      {itens.map((a) => (
        <li key={a.transacaoId}>
          <span className={styles.ponto} aria-hidden="true" />
          <Link className={styles.nome} to={a.contaFixaId ? `/contas-fixas/${a.contaFixaId}` : `/transacoes/${a.transacaoId}`}>
            {a.descricao}<span className={styles.mudo}> · dia {Number(a.data.slice(8, 10))}{semCategoria ? "" : ` · ${a.categoria}`}</span>
          </Link>
          <Dinheiro valor={a.valor} className={styles.valor} />
          {base ? <span className={styles.pct}>{pct(Math.round((a.valor * 1000) / base) / 10)}</span> : null}
        </li>
      ))}
    </ul>
  )
}
