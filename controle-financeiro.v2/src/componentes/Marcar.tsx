// Caixa de marcar do v2: uma linha da lista entra ou não (importar extrato), "marcar todas". É o <input
// type="checkbox"> de verdade (teclado e leitor de tela de graça) com a cor do tema. `misto` = algumas marcadas.
import { useEffect, useRef, type ReactNode } from "react"
import styles from "./Marcar.module.css"

export default function Marcar({ marcado, onChange, misto, desabilitado, ariaLabel, children }: {
  marcado: boolean
  onChange: (marcado: boolean) => void
  misto?: boolean
  desabilitado?: boolean
  /** Obrigatório quando não há texto ao lado. */
  ariaLabel?: string
  children?: ReactNode
}) {
  const ref = useRef<HTMLInputElement | null>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!misto && !marcado }, [misto, marcado])
  return (
    <label className={styles.marcar} data-desabilitado={desabilitado || undefined}>
      <input ref={ref} type="checkbox" className={styles.caixa} checked={marcado} disabled={desabilitado}
        aria-label={ariaLabel} onChange={(e) => onChange(e.target.checked)} />
      {children && <span className={styles.texto}>{children}</span>}
    </label>
  )
}
