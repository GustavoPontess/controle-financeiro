// Bullet do Few (uma medida contra faixas): o fundo em três faixas do mesmo matiz (tranquilo · atenção · alerta, com os
// limites que o servidor manda) e a barra fina da medida por cima. Relatórios › Comprometido (% da renda que já tem dono)
// e Reserva (meses numa régua de 0 a 12, com `escala` própria).
import styles from "./Bullet.module.css"

export default function Bullet({ valor, faixas, rotulo, escala }: {
  /** A medida, em % (passa de 100 e a barra fica cheia). */
  valor: number
  /** Onde começam a atenção e o alerta (ex.: [40, 60]). */
  faixas: [number, number]
  rotulo: string
  /** Os quatro rótulos da régua (0, as duas faixas e o fim); padrão em %. */
  escala?: [string, string, string, string]
}) {
  const [a, b] = faixas
  const [r0, ra, rb, rFim] = escala ?? ["0", `${a}%`, `${b}%`, "100%"]
  return (
    <div className={styles.bullet}>
      <div className={styles.trilha} role="img" aria-label={rotulo}>
        <span className={styles.faixa} data-faixa="1" style={{ width: `${a}%` }} />
        <span className={styles.faixa} data-faixa="2" style={{ width: `${b - a}%` }} />
        <span className={styles.faixa} data-faixa="3" style={{ width: `${100 - b}%` }} />
        <span className={styles.medida} style={{ width: `${Math.min(100, Math.max(0, valor))}%` }} />
      </div>
      <div className={styles.escala} aria-hidden="true">
        <span style={{ left: 0 }}>{r0}</span>
        <span style={{ left: `${a}%` }}>{ra}</span>
        <span style={{ left: `${b}%` }}>{rb}</span>
        <span style={{ left: "100%" }}>{rFim}</span>
      </div>
    </div>
  )
}
