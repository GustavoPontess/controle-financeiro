// Painel do sino: abre embaixo do botão com as notificações mais recentes, "Marcar todas como lidas" e
// "Ver todas" (a página Notificações). Clique numa notificação marca lida e leva pro assunto. Quem abre
// e fecha é o layout (clique fora, Esc, troca de tela).
import { useNavigate } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { useListaNotificacoes } from "../estado/notificacoes"
import type { Notificacao } from "../types/Notificacao"
import { Esqueleto } from "../componentes/Bloco"
import ListaNotificacoes from "../componentes/ListaNotificacoes"
import styles from "./PainelNotificacoes.module.css"

const NO_PAINEL = 6

export default function PainelNotificacoes({ voltarPara, aoFechar }: {
  /** Onde a pessoa estava — a seta de voltar da página/assunto leva de volta pra cá. */
  voltarPara: string
  aoFechar: () => void
}) {
  const navigate = useNavigate()
  const { itens, erro, naoLidas, marcarLida, marcarTodas, marcandoTodas } = useListaNotificacoes()

  const abrir = (n: Notificacao) => {
    void marcarLida(n)
    aoFechar()
    if (n.linkRelativo) navigate(n.linkRelativo, { state: { voltarPara } })
  }

  return (
    <div className={styles.painel} role="dialog" aria-label="Notificações">
      <div className={styles.topo}>
        <span className={styles.titulo}>Notificações</span>
        {naoLidas > 0 && (
          <button type="button" className={styles.acao} disabled={marcandoTodas} onClick={() => { void marcarTodas() }}>
            Marcar todas como lidas
          </button>
        )}
      </div>
      <div className={styles.corpo}>
        {itens === null && !erro ? <div className={styles.respiro}><Esqueleto linhas={3} altura={16} /></div>
          : erro || itens === null ? <p className={styles.vazio}>Não deu pra carregar as notificações.</p>
          : itens.length === 0 ? <p className={styles.vazio}>Nenhuma notificação.</p>
          : <ListaNotificacoes compacta itens={itens.slice(0, NO_PAINEL)} onAbrir={abrir} />}
      </div>
      <button type="button" className={styles.todas} onClick={() => { aoFechar(); navigate("/notificacoes", { state: { voltarPara } }) }}>
        Ver todas as notificações <ArrowRight size={14} strokeWidth={2.25} aria-hidden="true" />
      </button>
    </div>
  )
}
