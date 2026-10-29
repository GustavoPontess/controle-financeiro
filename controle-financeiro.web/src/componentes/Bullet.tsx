// Bullet do Few (uma medida contra faixas): o fundo em três faixas do mesmo matiz (tranquilo · atenção · alerta, com os
// limites que o servidor manda) e a barra fina da medida por cima. Relatórios › Comprometido (% da renda que já tem dono).
import styles from "./Bullet.module.css"

export default function Bullet({ valor, faixas, rotulo }: {
  /** A medida, em % (passa de 100 e a barra fica cheia). */
  valor: number
  /** Onde começam a atenção e o alerta (ex.: [40, 60]). */
  faixas: [number, number]
  rotulo: string
}) {
  const [a, b] = faixas
  return (
    <div className={styles.bullet}>
      <div className={styles.trilha} role="img" aria-label={rotulo}>
        <span className={styles.faixa} data-faixa="1" style={{ width: `${a}%` }} />
        <span className={styles.faixa} data-faixa="2" style={{ width: `${b - a}%` }} />
        <span className={styles.faixa} data-faixa="3" style={{ width: `${100 - b}%` }} />
        <span className={styles.medida} style={{ width: `${Math.min(100, Math.max(0, valor))}%` }} />
      </div>
      <div className={styles.escala} aria-hidden="true">
        <span style={{ left: 0 }}>0</span>
        <span style={{ left: `${a}%` }}>{a}%</span>
        <span style={{ left: `${b}%` }}>{b}%</span>
        <span style={{ left: "100%" }}>100%</span>
      </div>
    </div>
  )
}
