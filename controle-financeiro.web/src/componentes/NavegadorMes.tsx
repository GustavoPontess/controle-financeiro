// Mês do v2: o mês entre as setas, numa pílula só (o mesmo jeito da Visão geral; pedido do Gustavo 2026-10-22, o nome
// solto à esquerda e as setas lá na direita ficavam estranhos). Fora do mês de hoje, "Este mês" volta. Orçamento e
// Família (e quem mais for por mês) usam a mesma; a tela só guarda { ano, mes }. Sem limite pra frente por padrão (o
// próximo mês é legítimo: previsto); `ate` trava a seta onde não faz sentido ir (Relatórios: o mês de hoje).
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

export default function NavegadorMes({ periodo, onChange, prefixo, ate }: {
  periodo: Periodo
  onChange: (p: Periodo) => void
  /** Último mês navegável (a seta pra frente desliga nele). */
  ate?: Periodo
  /** O que é o mês ("Orçamento de"): vai no nome acessível, não aparece (o título da tela já diz). */
  prefixo?: string
}) {
  const nome = nomeDoPeriodo(periodo)
  const hoje = periodoDeHoje()
  const ehHoje = periodo.ano === hoje.ano && periodo.mes === hoje.mes
  const noFim = !!ate && periodo.ano * 12 + periodo.mes >= ate.ano * 12 + ate.mes
  return (
    <div className={styles.barra}>
      <span className={styles.mes} role="group" aria-label={prefixo ? `${prefixo} ${nome.toLowerCase()}` : nome}>
        <button type="button" aria-label="Mês anterior" onClick={() => onChange(somaMeses(periodo, -1))}><ChevronLeft size={16} strokeWidth={2.25} /></button>
        <span>{nome}</span>
        <button type="button" aria-label="Próximo mês" disabled={noFim} onClick={() => onChange(somaMeses(periodo, 1))}><ChevronRight size={16} strokeWidth={2.25} /></button>
      </span>
      {!ehHoje && <Botao variante="texto" onClick={() => onChange(hoje)}>Este mês</Botao>}
    </div>
  )
}
