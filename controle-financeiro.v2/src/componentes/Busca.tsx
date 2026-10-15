// Campo de busca das listas (Transações, Cartões…): lupa + input de pesquisa, 36px, mesma cara em toda tela.
// Só a aparência e o valor — quem filtra (servidor ou a lista já carregada) é a tela.
import { Search } from "lucide-react"
import styles from "./Busca.module.css"

export default function Busca({ valor, onChange, placeholder, className }: {
  valor: string
  onChange: (valor: string) => void
  /** Também é o aria-label. */
  placeholder: string
  className?: string
}) {
  return (
    <label className={[styles.busca, className].filter(Boolean).join(" ")}>
      <Search size={16} strokeWidth={2.25} aria-hidden="true" />
      <input type="search" placeholder={placeholder} aria-label={placeholder} value={valor} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
