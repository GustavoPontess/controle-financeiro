// Notificações: a lista inteira (não lidas em destaque), clique marca como lida e leva pro assunto
// (família, empréstimo…). "Marcar todas como lidas" na barra. Chega pelo "Ver todas" do painel do sino.
import { useNavigate } from "react-router-dom"
import { CheckCheck } from "lucide-react"
import type { Notificacao } from "../types/Notificacao"
import { useListaNotificacoes } from "../estado/notificacoes"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import ListaNotificacoes from "../componentes/ListaNotificacoes"
import styles from "./Notificacoes.module.css"

export default function Notificacoes() {
  const navigate = useNavigate()
  const { itens, erro, naoLidas, marcarLida, marcarTodas, marcandoTodas } = useListaNotificacoes()

  const abrir = (n: Notificacao) => {
    void marcarLida(n)
    if (n.linkRelativo) navigate(n.linkRelativo, { state: { voltarPara: "/notificacoes" } })
  }

  return (
    <div className={styles.pagina}>
      <Bloco semRespiro>
        <div className={styles.toolbar}>
          <Botao onClick={() => { void marcarTodas() }} disabled={naoLidas === 0 || marcandoTodas} icone={<CheckCheck size={15} strokeWidth={2.25} aria-hidden="true" />}>
            Marcar todas como lidas
          </Botao>
        </div>
        {itens === null && !erro ? (
          <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
        ) : erro || itens === null ? (
          <p className={styles.vazio}>Não deu pra carregar as notificações.</p>
        ) : itens.length === 0 ? (
          <p className={styles.vazio}>Nenhuma notificação.</p>
        ) : (
          <ListaNotificacoes itens={itens} onAbrir={abrir} />
        )}
      </Bloco>
    </div>
  )
}
