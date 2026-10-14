// Passador da bancada de Cartões: ◀ ▶ entre a tela atual e as variantes (atual → a → b → c → atual),
// na MESMA aba (Cartões ou Parcelamentos) — o módulo é um só.
// Bancada = rotas sem item no menu (/credit-cards/lab-*); sai quando escolher a vencedora.
import { useLocation, useNavigate } from "react-router-dom"
import { ChevronLeft, ChevronRight, FlaskConical } from "lucide-react"
import { PontesIconButton } from "@/components/pontes"
import styles from "./CartoesLab.module.css"

const PAGINAS = [
  { id: "atual", rotulo: "Tela atual", rota: "/credit-cards" },
  { id: "a", rotulo: "A · Painel", rota: "/credit-cards/lab-a" },
  { id: "b", rotulo: "B · Lista lateral", rota: "/credit-cards/lab-b" },
  { id: "c", rotulo: "C · Extrato do banco", rota: "/credit-cards/lab-c" },
] as const
export type PaginaLab = (typeof PAGINAS)[number]["id"]

export default function CartoesLabNav({ atual }: { atual: PaginaLab }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const i = PAGINAS.findIndex((p) => p.id === atual)
  const naAbaParcelamentos = pathname.startsWith(`${PAGINAS[i].rota}/parcelamentos`)
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
