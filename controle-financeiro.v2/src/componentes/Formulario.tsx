// Esqueleto de formulário do v2: campos empilhados com o mesmo respiro, linha de 2–3 campos lado a lado
// (vira 1 por linha no celular) e o rodapé de ações à direita. As telas não desenham layout de form.
import type { FormEvent, ReactNode } from "react"
import Bloco, { Esqueleto } from "./Bloco"
import styles from "./Formulario.module.css"

/** <form> sem a validação do navegador (a validação é por campo, nossa).
 *  `pilha` (padrão): campos empilhados. `lateral`: <Campos> à esquerda e <Lado> (prévia, opções, botões)
 *  à direita; no celular vira uma coluna só. `livre`: a tela desenha a grade pelo `className`. */
export default function Formulario({ onSubmit, children, layout = "pilha", className }: {
  onSubmit: () => void; children: ReactNode; layout?: "pilha" | "lateral" | "livre"; className?: string
}) {
  const base = layout === "pilha" ? styles.form : layout === "lateral" ? styles.lateral : ""
  return (
    <form className={[base, className].filter(Boolean).join(" ")} noValidate onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit() }}>
      {children}
    </form>
  )
}

/** Campos lado a lado, em colunas iguais (quantas forem os filhos) — ou nas `colunas` dadas (grid-template-columns). */
export function LinhaCampos({ children, colunas }: { children: ReactNode; colunas?: string }) {
  return <div className={styles.linha} style={colunas ? { gridTemplateColumns: colunas } : undefined}>{children}</div>
}

/** Ações do formulário (Cancelar / Salvar), à direita. Dentro do <Lado>, gruda no pé da coluna. */
export function RodapeFormulario({ children }: { children: ReactNode }) {
  return <div className={styles.rodape}>{children}</div>
}

/** A casca de uma tela de formulário: título da página, aviso de carga ou esqueleto, e o formulário. */
export function PaginaFormulario({ titulo, carregando, erroCarga, children }: {
  titulo: string; carregando?: boolean; erroCarga?: string | null; children: ReactNode
}) {
  return (
    <div className={styles.pagina}>
      <h1 className={styles.tituloPagina}>{titulo}</h1>
      {erroCarga ? <p className={styles.alertaPagina} role="alert">{erroCarga}</p>
        : carregando ? <Bloco className={styles.esqueletoPagina}><Esqueleto linhas={6} altura={18} /></Bloco>
        : children}
    </div>
  )
}

/** O cartão dos campos (layout lateral). */
export function Campos({ children }: { children: ReactNode }) {
  return <Bloco className={styles.campos}>{children}</Bloco>
}

/** A coluna da direita (layout lateral): prévia, opções e o rodapé. */
export function Lado({ children }: { children: ReactNode }) {
  return <aside className={styles.lado}>{children}</aside>
}
