// "Não sou robô" (Cloudflare Turnstile) das telas de acesso: Entrar (depois de uma senha errada), Esqueci a senha e
// Pedir acesso. O script da Cloudflare só carrega quando a caixinha aparece; a caixinha quase sempre resolve sozinha e
// entrega um token (vale 5 min e uma vez só). Quem confere o token é o servidor. Regras: Services/TentativasLogin.cs.
// Depois de cada envio o token já foi gasto: a caixinha é RENOVADA (turnstile.reset), não apagada e desenhada de novo,
// e quem envia espera o token novo (aguardarToken) em vez de travar com "Confirme que você não é um robô": com a chave
// de produção a Cloudflare leva uns segundos pra entregar o próximo (2026-10-29: a pessoa errava, tentava de novo e
// ficava presa nessa mensagem sem a caixinha pedir nada).
import { useCallback, useEffect, useRef, useState } from "react"
import { chaveDaVerificacao } from "../services/verificacaoService"
import css from "./VerificacaoHumana.module.css"

type Turnstile = {
  render: (el: HTMLElement, opcoes: Record<string, unknown>) => string
  reset: (id: string) => void
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

/** Quanto o envio espera o token da caixinha antes de desistir (a Cloudflare costuma levar 1 a 3 s). */
const ESPERA_TOKEN_MS = 10_000

/**
 * Chave do widget (null = desligado), o token da rodada, `novaRodada` (depois de cada envio: o token já foi gasto) e
 * `aguardarToken` (o token; se ainda não chegou, espera até ele chegar ou o tempo acabar, aí null).
 */
export function useVerificacaoHumana() {
  const [chave, setChave] = useState<string | null>(null)
  const [token, setTokenEstado] = useState<string | null>(null)
  const [rodada, setRodada] = useState(0)
  const atual = useRef<string | null>(null)
  const esperando = useRef<((t: string | null) => void)[]>([])
  useEffect(() => {
    let vivo = true
    void chaveDaVerificacao().then((c) => { if (vivo) setChave(c) })
    return () => { vivo = false }
  }, [])
  const setToken = useCallback((t: string | null) => {
    atual.current = t
    setTokenEstado(t)
    if (t) esperando.current.splice(0).forEach((avisa) => avisa(t))
  }, [])
  const novaRodada = useCallback(() => { atual.current = null; setTokenEstado(null); setRodada((r) => r + 1) }, [])
  const aguardarToken = useCallback((ms = ESPERA_TOKEN_MS) => {
    if (atual.current) return Promise.resolve<string | null>(atual.current)
    return new Promise<string | null>((ok) => {
      const avisa = (t: string | null) => { clearTimeout(prazo); ok(t) }
      const prazo = setTimeout(() => { esperando.current = esperando.current.filter((f) => f !== avisa); ok(null) }, ms)
      esperando.current.push(avisa)
    })
  }, [])
  return { chave, token, setToken, rodada, novaRodada, aguardarToken }
}

export default function VerificacaoHumana({ chave, rodada, aoMudar }: { chave: string; rodada: number; aoMudar: (token: string | null) => void }) {
  const caixa = useRef<HTMLDivElement>(null)
  const avisar = useRef(aoMudar)
  avisar.current = aoMudar
  const [falhou, setFalhou] = useState(false)
  const widget = useRef<string | null>(null)

  // Desenha uma vez por chave; cada rodada nova só renova a mesma caixinha (abaixo).
  useEffect(() => {
    let id: string | null = null
    let vivo = true
    setFalhou(false)
    carregarTurnstile()
      .then((t) => {
        if (!vivo || !caixa.current) return
        id = widget.current = t.render(caixa.current, {
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
      widget.current = null
      if (id && window.turnstile) window.turnstile.remove(id)
    }
  }, [chave])

  // Token gasto (rodada nova): a mesma caixinha gera outro; o callback de cima entrega quando chegar.
  const primeira = useRef(true)
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return }
    if (widget.current && window.turnstile) window.turnstile.reset(widget.current)
  }, [rodada])

  return (
    <div className={css.caixa}>
      <div ref={caixa} data-testid="verificacao-humana" />
      {falhou && <p className="erro" role="alert">Não foi possível carregar a verificação. Recarregue a página.</p>}
    </div>
  )
}
