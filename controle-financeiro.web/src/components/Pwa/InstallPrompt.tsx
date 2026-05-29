import { useEffect, useState } from "react"
import { Smartphone, X } from "lucide-react"
import { PontesButton, PontesIconButton } from "@/components/pontes"
import styles from "./InstallPrompt.module.css"

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
    <div className={styles.root} role="dialog" aria-label="Instalar app">
      <Smartphone size={20} className={styles.icon} />
      <div className={styles.body}>
        <span className={styles.title}>Instalar o app</span>
        <span className={styles.desc}>Adicione à tela inicial para acesso rápido.</span>
      </div>
      <PontesButton size="sm" onClick={instalar}>Instalar</PontesButton>
      <PontesIconButton size={32} variant="ghost" aria-label="Dispensar" onClick={dispensar}>
        <X size={16} />
      </PontesIconButton>
    </div>
  )
}
