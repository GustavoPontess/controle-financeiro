// Cupom (2026-11-07, Gustavo: "organiza isso como se fosse um cupom de nota"): uma caixa com linhas de rótulo à
// esquerda e valor (ou campo escrito como texto) à direita, uma linha tracejada entre cada. Ficha do Importar extrato
// e "Nota e local" do formulário de transação.
import type { ReactNode } from "react"
import styles from "./Cupom.module.css"

export default function Cupom({ children, rotulo, className }: {
  children: ReactNode
  /** Nome do grupo pra leitor de tela. */
  rotulo?: string
  /** Só posição no layout da tela. */
  className?: string
}) {
  return <div className={className ? `${styles.cupom} ${className}` : styles.cupom} role={rotulo ? "group" : undefined} aria-label={rotulo}>{children}</div>
}

/** `empilhado`: o rótulo em cima e o conteúdo embaixo, à esquerda (ex.: as miniaturas dos anexos). */
export function LinhaCupom({ rotulo, children, empilhado }: { rotulo: ReactNode; children: ReactNode; empilhado?: boolean }) {
  return (
    <div className={styles.linha} data-empilhado={empilhado || undefined}>
      <span className={styles.rotulo}>{rotulo}</span>
      <span className={styles.valor}>{children}</span>
    </div>
  )
}
