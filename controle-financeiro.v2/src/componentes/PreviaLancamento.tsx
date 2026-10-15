// "Como vai aparecer": a linha do lançamento igual à da lista de Transações + o que acontece ao salvar.
// Usada ao lado do formulário (nova e editar) — pega sinal, conta e parcela errados antes de gravar.
import type { ReactNode } from "react"
import Bloco from "./Bloco"
import { formatMoney } from "../utils/money"
import styles from "./PreviaLancamento.module.css"

export default function PreviaLancamento({ descricao, valor, tom, detalhe, etiquetas, efeito }: {
  descricao: string
  valor: number
  tom: "positivo" | "negativo" | "neutro"
  /** "Nubank · Alimentação · Pix" ou "Carteira → Nubank" */
  detalhe?: string
  etiquetas?: ReactNode
  /** "Sai do Nubank hoje às 23:47." */
  efeito?: string | null
}) {
  const nome = descricao.trim()
  return (
    <Bloco titulo="Como vai aparecer" className={styles.previa}>
      <div className={styles.linha}>
        <span className={styles.icone} data-tom={tom === "negativo" ? undefined : tom}>{nome ? nome[0].toUpperCase() : "?"}</span>
        <span className={styles.texto}>
          <span className={styles.nome} data-vazio={nome ? undefined : "true"}>{nome || "Descrição"}</span>
          {detalhe && <span className={styles.detalhe}>{detalhe}</span>}
        </span>
        <span className={styles.valor} data-tom={valor > 0 ? tom : undefined} data-vazio={valor > 0 ? undefined : "true"}>{formatMoney(valor)}</span>
      </div>
      {etiquetas && <div className={styles.etiquetas}>{etiquetas}</div>}
      {efeito && <p className={styles.efeito}>{efeito}</p>}
    </Bloco>
  )
}
