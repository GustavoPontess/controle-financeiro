import { useEffect, useState, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Bell } from "lucide-react"
import { PontesIconButton, PontesLoadingDots } from "@/components/pontes"
import {
  getNotificacoes, getContagemNaoLidas, marcarNotificacaoLida, marcarTodasLidas,
} from "../../services/notificacaoService"
import type { Notificacao } from "../../types/Notificacao"
import styles from "./NotificationBell.module.css"

const POLL_MS = 60_000

const formatarQuando = (iso: string) => {
  const d = new Date(iso)
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (diffMin < 1) return "agora"
  if (diffMin < 60) return `${diffMin} min atrás`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} h atrás`
  return d.toLocaleDateString("pt-BR")
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const ref = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [naoLidas, setNaoLidas] = useState(0)
  const [itens, setItens] = useState<Notificacao[]>([])
  const [carregando, setCarregando] = useState(false)

  const atualizarContagem = useCallback(async () => {
    try {
      const c = await getContagemNaoLidas()
      setNaoLidas(c.naoLidas)
    } catch { /* contador não é crítico */ }
  }, [])

  useEffect(() => {
    atualizarContagem()
    const timer = setInterval(atualizarContagem, POLL_MS)
    return () => clearInterval(timer)
  }, [atualizarContagem])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  const abrir = async () => {
    setOpen((o) => !o)
    if (open) return
    setCarregando(true)
    try {
      setItens(await getNotificacoes())
    } catch {
      setItens([])
    } finally {
      setCarregando(false)
    }
  }

  const handleClicar = async (n: Notificacao) => {
    setOpen(false)
    if (!n.lida) {
      try {
        await marcarNotificacaoLida(n.id)
        atualizarContagem()
      } catch { /* ignora */ }
    }
    if (n.linkRelativo) navigate(n.linkRelativo)
  }

  const handleMarcarTodas = async () => {
    try {
      await marcarTodasLidas()
      setItens((prev) => prev.map((n) => ({ ...n, lida: true })))
      setNaoLidas(0)
    } catch { /* ignora */ }
  }

  return (
    <span ref={ref} className={styles.wrap}>
      <PontesIconButton
        variant="ghost" size={40}
        onClick={abrir}
        badge={naoLidas > 0 ? naoLidas : undefined}
        aria-label="Notificações"
      >
        <Bell size={18} strokeWidth={2} />
      </PontesIconButton>

      {open && (
        <div className={styles.panel}>
          <div className={styles.head}>
            <span className={styles.headTitle}>Notificações</span>
            {naoLidas > 0 && (
              <span onClick={handleMarcarTodas} className={styles.markAll}>Marcar todas como lidas</span>
            )}
          </div>

          {carregando ? (
            <div className={styles.loading}><PontesLoadingDots /></div>
          ) : itens.length === 0 ? (
            <div className={styles.empty}>Nenhuma notificação.</div>
          ) : itens.map((n) => (
            <div
              key={n.id}
              onClick={() => handleClicar(n)}
              className={styles.item}
              data-unread={n.lida ? "false" : "true"}
            >
              <div className={styles.itemTitle}>{n.titulo}</div>
              <div className={styles.itemMsg}>{n.mensagem}</div>
              <div className={styles.itemWhen}>{formatarQuando(n.criadoEm)}</div>
            </div>
          ))}
        </div>
      )}
    </span>
  )
}
