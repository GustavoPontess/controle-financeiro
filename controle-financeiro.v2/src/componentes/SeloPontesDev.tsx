// Selo discreto "Pontes Finanças · um produto Pontes Dev" (link pro site do estúdio). Mesmo texto no login, nas
// telas de conta e no menu do app. A cor vem de quem usa (herda); só o link ganha sublinhado.
import { NOME_PRODUTO, SITE_PONTES_DEV } from "../config"
import styles from "./SeloPontesDev.module.css"

export default function SeloPontesDev({ className }: { className?: string }) {
  return (
    <span className={className ? `${styles.selo} ${className}` : styles.selo}>
      {NOME_PRODUTO} · um produto{" "}
      <a href={SITE_PONTES_DEV} target="_blank" rel="noopener noreferrer" className={styles.link}>Pontes Dev</a>
    </span>
  )
}
