// Sair por inatividade: só em sessão sem "Manter-me conectado" (o /auth/me manda o limite; a trava de verdade é do
// servidor, SessaoInativa na API). Conta o tempo desde o último mexer em QUALQUER aba do app (BroadcastChannel, nada
// guardado no navegador); 1 minuto antes pergunta "Você ainda está aí?" e, no fim, chama aoSair.
import { useCallback, useEffect, useRef, useState } from "react"
import Botao from "../componentes/Botao"
import Dialogo from "../componentes/Dialogo"
import styles from "./SairPorInatividade.module.css"

const AVISO_SEGUNDOS = 60
const EVENTOS = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove", "scroll"] as const
// Outra aba só fica sabendo de 10 em 10 s (mexer o mouse dispara dezenas de eventos por segundo).
const AVISAR_ABAS_A_CADA_MS = 10_000

export interface CanalDeAtividade { postMessage(agora: number): void; close(): void; onmessage: ((e: MessageEvent) => void) | null }
const canalDoNavegador = (): CanalDeAtividade | null =>
  typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("pontes:atividade")

export default function SairPorInatividade({ minutos, aoSair, criarCanal = canalDoNavegador }: {
  minutos: number
  aoSair: () => void
  /** Só pros testes; no app é o BroadcastChannel do navegador. */
  criarCanal?: () => CanalDeAtividade | null
}) {
  const ultima = useRef(Date.now())
  const avisando = useRef(false)
  const saiu = useRef(false)
  const canal = useRef<CanalDeAtividade | null>(null)
  const aoSairRef = useRef(aoSair)
  useEffect(() => { aoSairRef.current = aoSair }, [aoSair])
  const [restam, setRestam] = useState<number | null>(null) // segundos até sair, com o aviso aberto

  const marcar = useCallback((agora: number) => {
    ultima.current = agora
    avisando.current = false
    setRestam(null)
  }, [])

  const continuar = useCallback(() => {
    const agora = Date.now()
    marcar(agora)
    canal.current?.postMessage(agora)
  }, [marcar])

  const sair = useCallback(() => {
    if (saiu.current) return
    saiu.current = true
    aoSairRef.current()
  }, [])

  useEffect(() => {
    const limite = minutos * 60_000
    canal.current = criarCanal()
    let avisouAbas = 0
    if (canal.current) canal.current.onmessage = (e) => { if (typeof e.data === "number" && e.data > ultima.current) marcar(e.data) }

    // Com o aviso aberto, só "Continuar conectado" (ou outra aba em uso) conta: mexer o mouse até o botão não fecha.
    const mexeu = () => {
      if (avisando.current) return
      const agora = Date.now()
      ultima.current = agora
      if (agora - avisouAbas >= AVISAR_ABAS_A_CADA_MS) { avisouAbas = agora; canal.current?.postMessage(agora) }
    }
    // Pelo relógio, não por contagem: aba em segundo plano ou computador que dormiu sai na hora em que volta.
    const conferir = () => {
      const parado = Date.now() - ultima.current
      if (parado >= limite) sair()
      else if (parado >= limite - AVISO_SEGUNDOS * 1000) { avisando.current = true; setRestam(Math.ceil((limite - parado) / 1000)) }
    }

    EVENTOS.forEach((ev) => window.addEventListener(ev, mexeu, { passive: true }))
    document.addEventListener("visibilitychange", conferir)
    const relogio = window.setInterval(conferir, 1000)
    return () => {
      EVENTOS.forEach((ev) => window.removeEventListener(ev, mexeu))
      document.removeEventListener("visibilitychange", conferir)
      window.clearInterval(relogio)
      canal.current?.close()
      canal.current = null
    }
  }, [minutos, criarCanal, marcar, sair])

  return (
    <Dialogo aberto={restam !== null} titulo="Você ainda está aí?" onFechar={continuar}>
      <p className={styles.texto} role="timer" aria-live="polite">
        Por segurança, a sessão fecha em {restam} {restam === 1 ? "segundo" : "segundos"} se você não mexer.
      </p>
      <div className={styles.acoes}>
        <Botao variante="texto" onClick={sair}>Sair agora</Botao>
        <Botao variante="primario" onClick={continuar} data-autofoco>Continuar conectado</Botao>
      </div>
    </Dialogo>
  )
}
