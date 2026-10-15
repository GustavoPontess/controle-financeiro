// Notificações: a lista inteira (não lidas em destaque), clique marca como lida e leva pro assunto
// (família, empréstimo…). "Marcar todas como lidas" na barra. Chega pelo sino do topo.
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCheck } from "lucide-react"
import { getNotificacoes, marcarNotificacaoLida, marcarTodasLidas } from "../services/notificacaoService"
import type { Notificacao } from "../types/Notificacao"
import { definirNaoLidas, recarregarNaoLidas } from "../estado/notificacoes"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import styles from "./Notificacoes.module.css"

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

export default function Notificacoes() {
  const navigate = useNavigate()
  const [itens, setItens] = useState<Notificacao[] | null>(null)
  const [erro, setErro] = useState(false)
  const [marcandoTodas, setMarcandoTodas] = useState(false)
  const agora = new Date()

  useEffect(() => {
    let vivo = true
    getNotificacoes().then((n) => { if (vivo) setItens(n) }).catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [])

  const naoLidas = itens?.filter((n) => !n.lida).length ?? 0

  const abrir = async (n: Notificacao) => {
    if (!n.lida) {
      setItens((prev) => prev?.map((x) => (x.id === n.id ? { ...x, lida: true } : x)) ?? prev)
      try { await marcarNotificacaoLida(n.id); recarregarNaoLidas() } catch { /* a lista já mostrou como lida; o servidor acerta na próxima carga */ }
    }
    if (n.linkRelativo) navigate(n.linkRelativo, { state: { voltarPara: "/notificacoes" } })
  }

  const marcarTodas = async () => {
    setMarcandoTodas(true)
    try {
      await marcarTodasLidas()
      setItens((prev) => prev?.map((n) => ({ ...n, lida: true })) ?? prev)
      definirNaoLidas(0)
    } catch { /* botão continua disponível pra tentar de novo */ } finally { setMarcandoTodas(false) }
  }

  return (
    <div className={styles.pagina}>
      <Bloco semRespiro>
        <div className={styles.toolbar}>
          <Botao onClick={marcarTodas} disabled={naoLidas === 0 || marcandoTodas} icone={<CheckCheck size={15} strokeWidth={2.25} aria-hidden="true" />}>
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
          <ul className={styles.lista}>
            {itens.map((n) => (
              <li key={n.id}>
                <button type="button" className={styles.linha} data-lida={n.lida} onClick={() => abrir(n)}>
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
        )}
      </Bloco>
    </div>
  )
}
