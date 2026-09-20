/**
 * Primitivos de layout — empilhar (Stack) e lado-a-lado (Inline) com gap/align tokenizados.
 *
 * Existem pra a PÁGINA parar de recriar flexbox em cada *.module.css. Em vez de escrever
 * `display:flex; gap:12px` num CSS por tela, você compõe `<PontesStack gap="md">`. O gap segue a
 * escala base-4 do theme; a implementação é CSS puro por data-attribute (sem inline de estilo).
 */

import { type ReactNode, type CSSProperties } from "react"
import styles from "./Layout.module.css"

type Gap = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
type Align = "start" | "center" | "end" | "stretch"
type Justify = "start" | "center" | "end" | "between"

export type PontesStackProps = {
  children: ReactNode
  /** Espaço entre os filhos (escala base-4). Default md (12px). */
  gap?: Gap
  align?: Align
  className?: string
  style?: CSSProperties
}

/** Empilha os filhos na vertical com gap. */
export function PontesStack({ children, gap = "md", align, className, style }: PontesStackProps) {
  return (
    <div
      className={[styles.stack, className].filter(Boolean).join(" ")}
      data-gap={gap}
      data-align={align}
      style={style}
    >
      {children}
    </div>
  )
}

export type PontesInlineProps = {
  children: ReactNode
  gap?: Gap
  align?: Align
  justify?: Justify
  wrap?: boolean
  className?: string
  style?: CSSProperties
}

/** Coloca os filhos lado a lado (linha) com gap + alinhamento. */
export function PontesInline({ children, gap = "md", align = "center", justify, wrap, className, style }: PontesInlineProps) {
  return (
    <div
      className={[styles.inline, className].filter(Boolean).join(" ")}
      data-gap={gap}
      data-align={align}
      data-justify={justify}
      data-wrap={wrap ? "true" : undefined}
      style={style}
    >
      {children}
    </div>
  )
}
