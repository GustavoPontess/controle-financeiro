// Interruptor (liga/desliga) do v2 — pra opção que vale na hora, tipo "Já paguei" ou "Conta fixa".
// É um botão com role="switch": Espaço/Enter alternam, o leitor de tela anuncia ligado/desligado.
import type { ReactNode } from "react"
import styles from "./Interruptor.module.css"

export default function Interruptor({ ligado, onChange, children, desabilitado }: {
  ligado: boolean
  onChange: (ligado: boolean) => void
  /** O rótulo, à direita do trilho. */
  children: ReactNode
  desabilitado?: boolean
}) {
  return (
    <button type="button" role="switch" aria-checked={ligado} className={styles.interruptor} disabled={desabilitado}
      onClick={() => onChange(!ligado)}>
      <span className={styles.trilho} data-ligado={ligado || undefined} aria-hidden="true"><span className={styles.bolinha} /></span>
      <span className={styles.rotulo}>{children}</span>
    </button>
  )
}
