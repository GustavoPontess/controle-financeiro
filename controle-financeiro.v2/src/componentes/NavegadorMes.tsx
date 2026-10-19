// Barra do mês do v2: o nome do mês à esquerda e as setas à direita. Renda e Família (e quem mais for por mês)
// usam a mesma; a tela só guarda { ano, mes }. Sem limite pra frente (o próximo mês é legítimo: previsto).
import { ChevronLeft, ChevronRight } from "lucide-react"
import Botao from "./Botao"
import styles from "./NavegadorMes.module.css"

export type Periodo = { ano: number; mes: number }

export function periodoDeHoje(): Periodo {
  const h = new Date()
  return { ano: h.getFullYear(), mes: h.getMonth() + 1 }
}

export function somaMeses(p: Periodo, delta: number): Periodo {
  const d = new Date(p.ano, p.mes - 1 + delta, 1)
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 }
}

/** "Outubro de 2026" */
export function nomeDoPeriodo(p: Periodo): string {
  const txt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(p.ano, p.mes - 1, 1))
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

export default function NavegadorMes({ periodo, onChange, prefixo }: {
  periodo: Periodo
  onChange: (p: Periodo) => void
  /** Texto antes do mês ("Renda de"); sem ele, só o mês. */
  prefixo?: string
}) {
  const nome = nomeDoPeriodo(periodo)
  return (
    <div className={styles.barra}>
      <span className={styles.titulo}>{prefixo ? `${prefixo} ${nome.toLowerCase()}` : nome}</span>
      <span className={styles.setas}>
        <Botao soIcone aria-label="Mês anterior" onClick={() => onChange(somaMeses(periodo, -1))}><ChevronLeft size={16} strokeWidth={2.25} /></Botao>
        <Botao soIcone aria-label="Próximo mês" onClick={() => onChange(somaMeses(periodo, 1))}><ChevronRight size={16} strokeWidth={2.25} /></Botao>
      </span>
    </div>
  )
}
