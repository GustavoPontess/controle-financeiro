// O que ainda vem no mês (contas previstas): nome, dia e categoria, o valor e, com `base`, quanto é da renda.
// Cada linha leva pra conta fixa de onde veio (pausar ou cancelar) ou pro lançamento previsto avulso (`semLink`: só
// mostra, como no aviso do formulário, onde sair da tela perderia o que foi digitado).
// Usada no cartão da renda (UsoDaRenda), na ficha do limite e no aviso antes de salvar a compra.
import { Link } from "react-router-dom"
import type { AindaVem } from "../types/DinheiroDoMes"
import { Dinheiro } from "./Dinheiro"
import { dataLocalISO } from "../utils/dateTime"
import styles from "./ListaAindaVem.module.css"

const pct = (v: number) => `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v)}%`

/** "dia 25" no mês de hoje; "5/11" em outro mês; "não passou" quando o dia já foi (cobrança que o app tenta de novo). */
const quandoCom = (iso: string, hoje: string) =>
  iso < hoje ? "não passou"
  : iso.slice(0, 7) === hoje.slice(0, 7) ? `dia ${Number(iso.slice(8, 10))}`
  : `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`

export default function ListaAindaVem({ itens, base, semCategoria, semLink, comMes, rotulo = "Ainda vem este mês" }: {
  itens: AindaVem[]
  /** Renda do mês: mostra a coluna de % (no cartão da renda). */
  base?: number
  /** Esconde a categoria (na ficha do limite ela já é a da linha). */
  semCategoria?: boolean
  /** Linha sem link (onde sair da tela perderia o que foi digitado). */
  semLink?: boolean
  /** Itens de mais de um mês: "5/11" fora do mês de hoje. */
  comMes?: boolean
  rotulo?: string
}) {
  const hoje = dataLocalISO()
  return (
    <ul className={styles.lista} data-com-pct={base ? "true" : undefined} aria-label={rotulo}>
      {itens.map((a) => {
        const nome = (
          <>{a.descricao}<span className={styles.mudo}> · {comMes ? quandoCom(a.data, hoje) : `dia ${Number(a.data.slice(8, 10))}`}{semCategoria ? "" : ` · ${a.categoria}`}</span></>
        )
        return (
          <li key={a.transacaoId}>
            <span className={styles.ponto} aria-hidden="true" />
            {semLink ? <span className={styles.nome}>{nome}</span> : (
              <Link className={styles.nome} to={a.contaFixaId ? `/contas-fixas/${a.contaFixaId}` : `/transacoes/${a.transacaoId}`}>{nome}</Link>
            )}
            <Dinheiro valor={a.valor} className={styles.valor} />
            {base ? <span className={styles.pct}>{pct(Math.round((a.valor * 1000) / base) / 10)}</span> : null}
          </li>
        )
      })}
    </ul>
  )
}
