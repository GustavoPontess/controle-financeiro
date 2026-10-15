// Esqueleto de formulário do v2: campos empilhados com o mesmo respiro, linha de 2–3 campos lado a lado
// (vira 1 por linha no celular) e o rodapé de ações à direita. As telas não desenham layout de form.
import type { FormEvent, ReactNode } from "react"
import styles from "./Formulario.module.css"

/** <form> sem a validação do navegador (a validação é por campo, nossa). */
export default function Formulario({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form className={styles.form} noValidate onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit() }}>
      {children}
    </form>
  )
}

/** Campos lado a lado, em colunas iguais (quantas forem os filhos). */
export function LinhaCampos({ children }: { children: ReactNode }) {
  return <div className={styles.linha}>{children}</div>
}

/** Ações do formulário (Cancelar / Salvar), à direita. */
export function RodapeFormulario({ children }: { children: ReactNode }) {
  return <div className={styles.rodape}>{children}</div>
}
