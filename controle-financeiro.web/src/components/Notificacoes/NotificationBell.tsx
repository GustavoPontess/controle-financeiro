import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  IconButton, Badge, Menu, Box, Typography, Divider, CircularProgress,
} from "@mui/material"
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined"
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
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [naoLidas, setNaoLidas] = useState(0)
  const [itens, setItens] = useState<Notificacao[]>([])
  const [carregando, setCarregando] = useState(false)

  const atualizarContagem = useCallback(async () => {
    try {
      const c = await getContagemNaoLidas()
      setNaoLidas(c.naoLidas)
    } catch {
      // silencioso — contador não é crítico
    }
  }, [])

  useEffect(() => {
    atualizarContagem()
    const timer = setInterval(atualizarContagem, POLL_MS)
    return () => clearInterval(timer)
  }, [atualizarContagem])

  const abrir = async (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget)
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
    setAnchorEl(null)
    if (!n.lida) {
      try {
        await marcarNotificacaoLida(n.id)
        atualizarContagem()
      } catch {
        // ignora
      }
    }
    if (n.linkRelativo) navigate(n.linkRelativo)
  }

  const handleMarcarTodas = async () => {
    try {
      await marcarTodasLidas()
      setItens(prev => prev.map(n => ({ ...n, lida: true })))
      setNaoLidas(0)
    } catch {
      // ignora
    }
  }

  return (
    <>
      <IconButton size="small" onClick={abrir} sx={{ color: "#111827" }}>
        <Badge badgeContent={naoLidas} color="error">
          <NotificationsNoneOutlinedIcon sx={{ fontSize: 20 }} />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { width: 340, maxHeight: 420, borderRadius: "12px" } }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 2, py: 1 }}>
          <Typography fontSize={14} fontWeight={700}>Notificações</Typography>
          {naoLidas > 0 && (
            <Typography fontSize={12} color="#2563eb" sx={{ cursor: "pointer" }}
              onClick={handleMarcarTodas}>
              Marcar todas como lidas
            </Typography>
          )}
        </Box>
        <Divider />

        {carregando ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
            <CircularProgress size={22} />
          </Box>
        ) : itens.length === 0 ? (
          <Typography fontSize={13} color="#9ca3af" sx={{ p: 3, textAlign: "center" }}>
            Nenhuma notificação.
          </Typography>
        ) : itens.map(n => (
          <Box
            key={n.id}
            onClick={() => handleClicar(n)}
            sx={{
              px: 2, py: 1.25, cursor: "pointer",
              borderBottom: "1px solid #f1f5f9",
              bgcolor: n.lida ? "#ffffff" : "#eff6ff",
              "&:hover": { bgcolor: "#f9fafb" },
            }}
          >
            <Typography fontSize={13} fontWeight={600} color="#111827">{n.titulo}</Typography>
            <Typography fontSize={12} color="#6b7280">{n.mensagem}</Typography>
            <Typography fontSize={11} color="#9ca3af" mt={0.25}>
              {formatarQuando(n.criadoEm)}
            </Typography>
          </Box>
        ))}
      </Menu>
    </>
  )
}
