// Barra fina de proporção (limite usado, fatura paga). `fracao` 0..1; passa de 1 = estourou (fica vermelha).
// `fracaoAVir` (opcional): o que ainda vem (conta prevista), listrado logo depois do que já foi.
import styles from "./BarraProgresso.module.css"

export default function BarraProgresso({ fracao, fracaoAVir, tom, rotulo }: {
  fracao: number
  fracaoAVir?: number
  /** Cor do preenchimento: padrão é a tinta; "alerta" e "negativo" quando a proporção é um aviso. */
  tom?: "alerta" | "negativo" | "positivo"
  /** Texto pro leitor de tela ("34% do limite usado"). */
  rotulo?: string
}) {
  const pct = Math.max(0, Math.min(100, Math.round(fracao * 100)))
  const aVir = fracaoAVir ? Math.max(0, Math.min(100 - pct, Math.round(fracaoAVir * 100))) : 0
  const estourou = fracao > 1
  return (
    <span className={styles.trilho} role={rotulo ? "img" : undefined} aria-label={rotulo}>
      <span className={styles.fill} data-tom={estourou ? "negativo" : tom} style={{ width: `${pct}%` }} />
      {aVir > 0 && <span className={styles.aVir} style={{ width: `${aVir}%` }} />}
    </span>
  )
}
