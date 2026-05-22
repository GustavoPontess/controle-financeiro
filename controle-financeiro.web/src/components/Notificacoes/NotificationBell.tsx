import { useEffect, useState, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Bell } from "lucide-react"
import { PontesIconButton, PontesLoadingDots, usePontesTheme } from "@/components/pontes"
import {
  getNotificacoes, getContagemNaoLidas, marcarNotificacaoLida, marcarTodasLidas,
} from "../../services/notificacaoService"
import type { Notificacao } from "../../types/Notificacao"

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
  const { palette: p, font } = usePontesTheme()
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
    <span ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <PontesIconButton
        p={p} font={font} variant="ghost" size={40}
        onClick={abrir}
        badge={naoLidas > 0 ? naoLidas : undefined}
        aria-label="Notificações"
      >
        <Bell size={18} strokeWidth={2} />
      </PontesIconButton>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 1100,
          width: 340, maxHeight: 440, overflowY: "auto",
          background: p.surface, border: `1px solid ${p.border}`, borderRadius: 14,
          boxShadow: "0 12px 28px rgba(11,18,32,0.15)", fontFamily: font,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${p.border}` }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: p.text }}>Notificações</span>
            {naoLidas > 0 && (
              <span onClick={handleMarcarTodas} style={{ fontSize: 12, color: p.primary, cursor: "pointer", fontWeight: 600 }}>
                Marcar todas como lidas
              </span>
            )}
          </div>

          {carregando ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
              <PontesLoadingDots p={p} />
            </div>
          ) : itens.length === 0 ? (
            <div style={{ fontSize: 13, color: p.textMuted, padding: 28, textAlign: "center" }}>
              Nenhuma notificação.
            </div>
          ) : itens.map((n) => (
            <div
              key={n.id}
              onClick={() => handleClicar(n)}
              style={{
                padding: "12px 16px", cursor: "pointer", borderBottom: `1px solid ${p.border}`,
                background: n.lida ? "transparent" : p.primarySoft,
              }}
              onMouseEnter={(e) => { if (n.lida) (e.currentTarget as HTMLElement).style.background = p.bg }}
              onMouseLeave={(e) => { if (n.lida) (e.currentTarget as HTMLElement).style.background = "transparent" }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: p.text }}>{n.titulo}</div>
              <div style={{ fontSize: 12, color: p.textMuted }}>{n.mensagem}</div>
              <div style={{ fontSize: 11, color: p.textMuted, opacity: 0.8, marginTop: 2 }}>{formatarQuando(n.criadoEm)}</div>
            </div>
          ))}
        </div>
      )}
    </span>
  )
}
