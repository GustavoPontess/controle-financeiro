// Lista de notificações — a mesma na página Notificações e no painel do sino: ponto aceso = não lida,
// título + mensagem, quando. Cada linha é um botão (quem usa decide: marcar lida e abrir o assunto).
import type { Notificacao } from "../types/Notificacao"
import styles from "./ListaNotificacoes.module.css"

/** "agora", "12 min", "3 h", "ontem", "08/10" — curto, cabe na direita da linha. */
function quando(iso: string, agora: Date): string {
  const d = new Date(iso)
  const min = Math.floor((agora.getTime() - d.getTime()) / 60_000)
  if (min < 1) return "agora"
  if (min < 60) return `${min} min`
  if (min < 24 * 60) return `${Math.floor(min / 60)} h`
  if (min < 48 * 60) return "ontem"
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

export default function ListaNotificacoes({ itens, onAbrir, compacta }: {
  itens: Notificacao[]
  onAbrir: (n: Notificacao) => void
  /** No painel do sino: mensagem numa linha só (cortada), respiro menor. */
  compacta?: boolean
}) {
  const agora = new Date()
  return (
    <ul className={styles.lista} data-compacta={compacta || undefined}>
      {itens.map((n) => (
        <li key={n.id}>
          <button type="button" className={styles.linha} data-lida={n.lida} onClick={() => onAbrir(n)}>
            <span className={styles.ponto} aria-hidden="true" />
            <span className={styles.texto}>
              <span className={styles.titulo}>{n.titulo}</span>
              <span className={styles.mensagem}>{n.mensagem}</span>
            </span>
            <span className={styles.quando}>{quando(n.criadoEm, agora)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
