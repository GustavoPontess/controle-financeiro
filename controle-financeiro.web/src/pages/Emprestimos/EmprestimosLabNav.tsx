// Navegação entre as 3 páginas de bancada — pedido do Gustavo pra não ficar digitando URL.
import { useNavigate } from "react-router-dom"
import { ChevronLeft, ChevronRight } from "lucide-react"
import styles from "./EmprestimosLabNav.module.css"

const ORDER = [
  { slug: "a", path: "/emprestimos-lab-a", label: "Bancada · Lab A" },
  { slug: "b", path: "/emprestimos-lab-b", label: "Bancada · Lab B" },
  { slug: "c", path: "/emprestimos-lab-c", label: "Bancada · Lab C" },
] as const

export default function EmprestimosLabNav({ current }: { current: "a" | "b" | "c" }) {
  const navigate = useNavigate()
  const idx = ORDER.findIndex((o) => o.slug === current)
  const prev = ORDER[(idx - 1 + ORDER.length) % ORDER.length]
  const next = ORDER[(idx + 1) % ORDER.length]

  return (
    <div className={styles.row}>
      <button type="button" className={styles.navBtn} aria-label={`Ir para ${prev.label}`} onClick={() => navigate(prev.path)}>
        <ChevronLeft size={14} />
      </button>
      <span className={styles.tag}>{ORDER[idx].label}</span>
      <button type="button" className={styles.navBtn} aria-label={`Ir para ${next.label}`} onClick={() => navigate(next.path)}>
        <ChevronRight size={14} />
      </button>
    </div>
  )
}
