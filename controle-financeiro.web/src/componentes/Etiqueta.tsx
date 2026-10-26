// Etiqueta de status (Despesa, Previsto, Conta fixa, Parcela 2 de 6…). Cor só quando o tom importa.
import type { ReactNode } from "react"
import styles from "./Etiqueta.module.css"

export default function Etiqueta({ tom, children, className }: {
  tom?: "positivo" | "negativo" | "alerta"
  children: ReactNode
  /** Só posição no layout da tela. */
  className?: string
}) {
  return <span className={className ? `${styles.etiqueta} ${className}` : styles.etiqueta} data-tom={tom}>{children}</span>
}
