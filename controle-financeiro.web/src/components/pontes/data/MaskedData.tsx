/**
 * PontesMaskedValue / PontesMaskToggle — mascaramento de dado sensível com "revelar" (olhinho),
 * mesmo padrão do PontesSensitiveValue (dinheiro), mas para PII (e-mails) no painel admin.
 *
 * Estado global em ./useMaskData (store + localStorage, sem provider), default MASCARADO.
 *
 * Uso:
 *   <PontesMaskedValue value={usuario.email} />        // e-mail mascarado até revelar
 *   <PontesMaskToggle />                                 // botão olho (revela/oculta global)
 */

import { Eye, EyeOff } from "lucide-react"
import { useMaskData, maskEmail } from "./useMaskData"
import styles from "./SensitiveValue.module.css"

export interface PontesMaskedValueProps {
  /** Valor real (mostrado quando revelado). */
  value?: string | null
  className?: string
}

/** Mostra o valor real ou a versão mascarada, conforme o estado global de mascarar. */
export function PontesMaskedValue({ value, className }: PontesMaskedValueProps) {
  const [masked] = useMaskData()
  return <span className={className}>{masked ? maskEmail(value) : (value ?? "—")}</span>
}

export interface PontesMaskToggleProps {
  size?: number
  className?: string
}

/** Botão olho que alterna o estado global de mascarar dados sensíveis. */
export function PontesMaskToggle({ size = 16, className }: PontesMaskToggleProps) {
  const [masked, toggle] = useMaskData()
  return (
    <button
      type="button"
      onClick={toggle}
      className={[styles.toggle, "pontes-clickable", className].filter(Boolean).join(" ")}
      aria-label={masked ? "Revelar dados" : "Ocultar dados"}
      aria-pressed={!masked}
      title={masked ? "Revelar dados" : "Ocultar dados"}
    >
      {masked ? <EyeOff size={size} strokeWidth={2.5} /> : <Eye size={size} strokeWidth={2.5} />}
    </button>
  )
}
