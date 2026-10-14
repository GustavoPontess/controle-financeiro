// Passador da bancada de Cartões: ◀ ▶ entre a tela atual e as variantes (atual → a → b → c → atual),
// na MESMA aba (Cartões ou Parcelamentos) — o módulo é um só.
// Bancada = rotas sem item no menu (/credit-cards/lab-*); sai quando escolher a vencedora.
import { useLocation, useNavigate } from "react-router-dom"
import { ChevronLeft, ChevronRight, FlaskConical } from "lucide-react"
import { PontesIconButton } from "@/components/pontes"
import styles from "./CartoesLab.module.css"

const PAGINAS = [
  { id: "atual", rotulo: "Tela atual", rota: "/credit-cards" },
  { id: "a", rotulo: "A · Central do cartão", rota: "/credit-cards/lab-a" },
  { id: "b", rotulo: "B · Explorador", rota: "/credit-cards/lab-b" },
  { id: "c", rotulo: "C · App do banco", rota: "/credit-cards/lab-c" },
] as const
export type PaginaLab = (typeof PAGINAS)[number]["id"]

/** `secao`: a parte do módulo aberta na página (labs sem abas dizem qual é; na tela real vem do endereço). */
export default function CartoesLabNav({ atual, secao }: { atual: PaginaLab; secao?: "cartoes" | "parcelamentos" }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const i = PAGINAS.findIndex((p) => p.id === atual)
  const naAbaParcelamentos = secao ? secao === "parcelamentos" : pathname.startsWith(`${PAGINAS[i].rota}/parcelamentos`)
  const ir = (passo: number) => {
    const destino = PAGINAS[(i + passo + PAGINAS.length) % PAGINAS.length].rota
    navigate(naAbaParcelamentos ? `${destino}/parcelamentos` : destino)
  }
  return (
    <nav className={styles.labNav} aria-label="Layouts da tela de cartões">
      <FlaskConical size={16} strokeWidth={2.5} aria-hidden="true" />
      <PontesIconButton size={32} variant="ghost" aria-label="Layout anterior" onClick={() => ir(-1)}>
        <ChevronLeft size={16} strokeWidth={2.5} />
      </PontesIconButton>
      <span className={styles.labNavNome}>
        {PAGINAS[i].rotulo} <span className={styles.muted}>({i + 1} de {PAGINAS.length})</span>
      </span>
      <PontesIconButton size={32} variant="ghost" aria-label="Próximo layout" onClick={() => ir(1)}>
        <ChevronRight size={16} strokeWidth={2.5} />
      </PontesIconButton>
    </nav>
  )
}
