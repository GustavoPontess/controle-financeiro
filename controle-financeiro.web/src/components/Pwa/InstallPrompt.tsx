import { useEffect, useState } from "react"
import { Paper, Box, Typography, IconButton } from "@mui/material"
import CloseIcon from "@mui/icons-material/Close"
import InstallMobileOutlinedIcon from "@mui/icons-material/InstallMobileOutlined"
import CustomButton from "../CustomButton"

/** Evento beforeinstallprompt (não tipado no lib.dom padrão). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const CHAVE_SESSOES = "pwa-sessoes"
const CHAVE_DISPENSADO = "pwa-install-dispensado"
const SESSAO_MINIMA = 2

export default function InstallPrompt() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    // Conta a sessão atual (uma vez por carga do app).
    const sessoes = Number(localStorage.getItem(CHAVE_SESSOES) ?? "0") + 1
    localStorage.setItem(CHAVE_SESSOES, String(sessoes))

    const dispensado = localStorage.getItem(CHAVE_DISPENSADO) === "true"

    const handler = (e: Event) => {
      e.preventDefault()
      setEvento(e as BeforeInstallPromptEvent)
      // Só promove a partir da 2ª sessão e se ainda não foi dispensado.
      if (sessoes >= SESSAO_MINIMA && !dispensado) {
        setVisivel(true)
      }
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const instalar = async () => {
    if (!evento) return
    await evento.prompt()
    await evento.userChoice
    setEvento(null)
    setVisivel(false)
  }

  const dispensar = () => {
    localStorage.setItem(CHAVE_DISPENSADO, "true")
    setVisivel(false)
  }

  if (!visivel) return null

  return (
    <Paper
      elevation={6}
      sx={{
        position: "fixed", bottom: 20, left: 20, zIndex: 1300,
        maxWidth: 360, p: 2, borderRadius: "12px",
        display: "flex", alignItems: "center", gap: 1.5,
      }}
    >
      <InstallMobileOutlinedIcon sx={{ color: "#111827" }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontSize={14} fontWeight={600} color="#111827">
          Instalar o app
        </Typography>
        <Typography fontSize={12} color="#6b7280">
          Adicione à tela inicial para acesso rápido.
        </Typography>
      </Box>
      <CustomButton size="small" onClick={instalar}>Instalar</CustomButton>
      <IconButton size="small" onClick={dispensar}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Paper>
  )
}
