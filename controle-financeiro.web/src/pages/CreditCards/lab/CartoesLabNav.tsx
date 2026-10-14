// Passador da bancada de Cartões: ◀ ▶ entre as variantes (a → b → c → a) + atalho pra tela atual.
// Bancada = rota sem item no menu (/credit-cards/lab-*), só URL direta; sai quando escolher a vencedora.
import { Link, useNavigate } from "react-router-dom"
import { ChevronLeft, ChevronRight, FlaskConical } from "lucide-react"
import { PontesIconButton } from "@/components/pontes"
import styles from "./CartoesLab.module.css"

const VARIANTES = [
  { id: "a", nome: "Painel" },
  { id: "b", nome: "Lista lateral" },
  { id: "c", nome: "Extrato do banco" },
] as const
export type VarianteLab = (typeof VARIANTES)[number]["id"]

export default function CartoesLabNav({ atual }: { atual: VarianteLab }) {
  const navigate = useNavigate()
  const i = VARIANTES.findIndex((v) => v.id === atual)
  const ir = (passo: number) => navigate(`/credit-cards/lab-${VARIANTES[(i + passo + VARIANTES.length) % VARIANTES.length].id}`)
  return (
    <nav className={styles.labNav} aria-label="Variantes da tela de cartões">
      <FlaskConical size={16} strokeWidth={2.5} aria-hidden="true" />
      <PontesIconButton size={32} variant="ghost" aria-label="Variante anterior" onClick={() => ir(-1)}>
        <ChevronLeft size={16} strokeWidth={2.5} />
      </PontesIconButton>
      <span className={styles.labNavNome}>
        {atual.toUpperCase()} · {VARIANTES[i].nome} <span className={styles.muted}>({i + 1} de {VARIANTES.length})</span>
      </span>
      <PontesIconButton size={32} variant="ghost" aria-label="Próxima variante" onClick={() => ir(1)}>
        <ChevronRight size={16} strokeWidth={2.5} />
      </PontesIconButton>
      <Link to="/credit-cards" className={styles.link}>Tela atual</Link>
    </nav>
  )
}
