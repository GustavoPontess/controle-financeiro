// A renda do mês numa barra (Relatórios › Pra onde foi a sua renda): um pedaço por categoria, na cor da linha dela na
// lista logo abaixo (a lista é a legenda), e o vazio no fim é o que sobrou. Gastou mais que a renda: a barra vira o
// gasto e a marca mostra até onde ia a renda. 2px de respiro entre os pedaços; mouse num pedaço mostra o nome, o valor
// e a parte da renda. `renda`: o que entrou no mês fechado; no mês atual, a renda do mês. Só geometria: os valores vêm
// do servidor.
import { useHideBalance } from "../estado/ocultar"
import { MONEY_MASK, formatMoney } from "../utils/money"
import styles from "./BarraDaRenda.module.css"

export type PedacoDaRenda = { chave: string; nome: string; valor: number; serie: string }

const pct1 = (v: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(v)

export default function BarraDaRenda({ pedacos, renda }: { pedacos: PedacoDaRenda[]; renda: number }) {
  const [oculto] = useHideBalance()
  const gasto = pedacos.reduce((s, p) => s + p.valor, 0)
  const escala = Math.max(renda, gasto) || 1
  const largura = (v: number) => `${(v / escala) * 100}%`
  const dinheiro = (v: number) => (oculto ? MONEY_MASK : formatMoney(v))
  const parte = (v: number) => (renda > 0 ? ` · ${pct1((v / renda) * 100)}% da renda` : "")
  const sobrou = renda - gasto
  return (
    <div className={styles.lugar} data-com-marca={gasto > renda && renda > 0 ? "true" : undefined}>
      <div className={styles.barra} role="img"
        aria-label={renda > 0 ? `Gastos: ${pct1((gasto / renda) * 100)}% da renda${sobrou > 0 ? `, sobrou ${pct1((sobrou / renda) * 100)}%` : ""}` : "Gastos do mês"}>
        {pedacos.filter((p) => p.valor > 0).map((p) => (
          <span key={p.chave} className={styles.pedaco} data-serie={p.serie} style={{ width: largura(p.valor) }} title={`${p.nome}: ${dinheiro(p.valor)}${parte(p.valor)}`} />
        ))}
      </div>
      {gasto > renda && renda > 0 && (
        <span className={styles.marca} style={{ left: largura(renda) }}><span className={styles.marcaRotulo}>sua renda</span></span>
      )}
    </div>
  )
}
