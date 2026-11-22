// SÓ EM DESENVOLVIMENTO: com "Sem sair por inatividade" ligado no painel de dev, troca o SairPorInatividade por um
// relógio que pergunta o /auth/me de 5 em 5 min (o cliente renova o token no 401, e o refresh novo não passa do
// limite do SessaoInativa). Desligado, mostra o SairPorInatividade de sempre (`children`). Carregado só pelo
// AuthProvider com import.meta.env.DEV; no build some.
import { useEffect, type ReactNode } from "react"
import { api } from "../api/cliente"
import { useSemInatividade } from "./semInatividade"

const A_CADA_MS = 5 * 60_000

export default function ManterVivoDev({ children }: { children: ReactNode }) {
  const ligada = useSemInatividade()
  useEffect(() => {
    if (!ligada) return
    const relogio = window.setInterval(() => { void api.get("/auth/me", { skipErrorToast: true }).catch(() => {}) }, A_CADA_MS)
    return () => window.clearInterval(relogio)
  }, [ligada])
  return ligada ? null : <>{children}</>
}
