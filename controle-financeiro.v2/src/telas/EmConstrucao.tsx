// Tela ainda não transformada: a navegação funciona de ponta a ponta e o link leva pro app atual.
import { ArrowUpRight, Hammer } from "lucide-react"
import { APP_ATUAL } from "../config"
import styles from "./EmConstrucao.module.css"

export default function EmConstrucao({ titulo, atual }: { titulo: string; atual: string }) {
  return (
    <div className={styles.caixa}>
      <Hammer size={22} strokeWidth={2} aria-hidden="true" />
      <h2 className={styles.titulo}>{titulo}</h2>
      <p className={styles.texto}>Esta tela ainda não foi transformada.</p>
      <a href={`${APP_ATUAL}${atual}`} className={styles.link}>Abrir no app atual <ArrowUpRight size={14} strokeWidth={2.25} aria-hidden="true" /></a>
    </div>
  )
}
