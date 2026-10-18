// Seletor de espaço no topo do menu (modelo Notion/Slack): "Pessoal" ou uma família. Trocar muda o menu
// inteiro e leva pra Visão geral do espaço escolhido. Convites pra pessoa e "Nova família" moram aqui.
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Check, ChevronsUpDown, Mail, Plus, User } from "lucide-react"
import { useEspacos } from "../estado/espaco"
import styles from "./V2Layout.module.css"

const inicial = (nome: string) => nome.trim().charAt(0).toUpperCase() || "?"

export default function SeletorEspaco({ familiaId, pathname, recolhido }: { familiaId: string | null; pathname: string; recolhido: boolean }) {
  const navigate = useNavigate()
  const { familias, convites, carregado } = useEspacos(pathname)
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { setAberto(false) }, [pathname])
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false) }
    document.addEventListener("mousedown", fora); document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc) }
  }, [aberto])

  const atual = familiaId ? familias.find((f) => f.id === familiaId) : undefined
  const nome = familiaId ? (atual?.nome ?? (carregado ? "Família" : "…")) : "Pessoal"
  const ir = (para: string) => { setAberto(false); navigate(para, { state: { voltarPara: pathname } }) }

  return (
    <div className={styles.espaco} ref={ref}>
      <button type="button" className={styles.espacoBotao} aria-haspopup="menu" aria-expanded={aberto} aria-label={`Espaço: ${nome}`}
        title={recolhido ? nome : undefined} onClick={() => setAberto((v) => !v)}>
        {familiaId
          ? <span className={styles.espacoMarca} aria-hidden="true">{inicial(nome)}</span>
          : <span className={styles.espacoIcone} aria-hidden="true"><User size={15} strokeWidth={2.25} /></span>}
        <span className={`${styles.espacoNome} ${styles.itemRotulo}`}>{nome}</span>
        <ChevronsUpDown size={15} strokeWidth={2} className={`${styles.usuarioSeta} ${styles.itemRotulo}`} aria-hidden="true" />
      </button>
      {aberto && (
        <div className={styles.espacoMenu} role="menu" aria-label="Trocar de espaço">
          <button type="button" role="menuitemradio" aria-checked={!familiaId} className={styles.espacoItem} onClick={() => ir("/dashboard")}>
            <span className={styles.espacoIcone} aria-hidden="true"><User size={15} strokeWidth={2.25} /></span>
            <span className={styles.espacoItemNome}>Pessoal</span>
            {!familiaId && <Check size={15} strokeWidth={2.5} className={styles.espacoCheck} aria-hidden="true" />}
          </button>
          {familias.map((f) => (
            <button key={f.id} type="button" role="menuitemradio" aria-checked={f.id === familiaId} className={styles.espacoItem} onClick={() => ir(`/familias/${f.id}`)}>
              <span className={styles.espacoMarca} aria-hidden="true">{inicial(f.nome)}</span>
              <span className={styles.espacoItemNome}>{f.nome}</span>
              {f.id === familiaId && <Check size={15} strokeWidth={2.5} className={styles.espacoCheck} aria-hidden="true" />}
            </button>
          ))}
          <span className={styles.espacoSeparador} aria-hidden="true" />
          {convites > 0 && (
            <button type="button" role="menuitem" className={styles.espacoItem} onClick={() => ir("/familias")}>
              <span className={styles.espacoIcone} aria-hidden="true"><Mail size={15} strokeWidth={2.25} /></span>
              <span className={styles.espacoItemNome}>Convites pra você</span>
              <span className={styles.espacoContador}>{convites}</span>
            </button>
          )}
          <button type="button" role="menuitem" className={styles.espacoItem} onClick={() => ir("/familias/nova")}>
            <span className={styles.espacoIcone} aria-hidden="true"><Plus size={15} strokeWidth={2.5} /></span>
            <span className={styles.espacoItemNome}>Nova família</span>
          </button>
        </div>
      )}
    </div>
  )
}
