// "Não sou robô" (Cloudflare Turnstile) das telas de acesso: Entrar (depois de uma senha errada), Esqueci a senha e
// Pedir acesso. O script da Cloudflare só carrega quando a caixinha aparece; a caixinha quase sempre resolve sozinha e
// entrega um token (vale 5 min e uma vez só). Quem confere o token é o servidor. Regras: Services/TentativasLogin.cs.
import { useCallback, useEffect, useRef, useState } from "react"
import { chaveDaVerificacao } from "../services/verificacaoService"
import css from "./VerificacaoHumana.module.css"

type Turnstile = {
  render: (el: HTMLElement, opcoes: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global { interface Window { turnstile?: Turnstile } }

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
let carregando: Promise<Turnstile> | null = null

function carregarTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  return (carregando ??= new Promise<Turnstile>((ok, falhou) => {
    const s = document.createElement("script")
    s.src = SCRIPT
    s.async = true
    s.onload = () => (window.turnstile ? ok(window.turnstile) : falhou(new Error("turnstile")))
    s.onerror = () => { carregando = null; falhou(new Error("turnstile")) }
    document.head.appendChild(s)
  }))
}

/** Chave do widget (null = desligado), o token da rodada e `novaRodada` (depois de cada envio: o token já foi gasto). */
export function useVerificacaoHumana() {
  const [chave, setChave] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [rodada, setRodada] = useState(0)
  useEffect(() => {
    let vivo = true
    void chaveDaVerificacao().then((c) => { if (vivo) setChave(c) })
    return () => { vivo = false }
  }, [])
  const novaRodada = useCallback(() => { setToken(null); setRodada((r) => r + 1) }, [])
  return { chave, token, setToken, rodada, novaRodada }
}

export default function VerificacaoHumana({ chave, rodada, aoMudar }: { chave: string; rodada: number; aoMudar: (token: string | null) => void }) {
  const caixa = useRef<HTMLDivElement>(null)
  const avisar = useRef(aoMudar)
  avisar.current = aoMudar
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    let id: string | null = null
    let vivo = true
    setFalhou(false)
    carregarTurnstile()
      .then((t) => {
        if (!vivo || !caixa.current) return
        id = t.render(caixa.current, {
          sitekey: chave,
          language: "pt-br",
          theme: "light",
          callback: (tk: string) => avisar.current(tk),
          "expired-callback": () => avisar.current(null),
          "error-callback": () => avisar.current(null),
        })
      })
      .catch(() => { if (vivo) setFalhou(true) })
    return () => {
      vivo = false
      if (id && window.turnstile) window.turnstile.remove(id)
    }
  }, [chave, rodada])

  return (
    <div className={css.caixa}>
      <div ref={caixa} data-testid="verificacao-humana" />
      {falhou && <p className="erro" role="alert">Não foi possível carregar a verificação. Recarregue a página.</p>}
    </div>
  )
}
