// Aviso de fuso (2026-11-02): o "hoje" do app segue o fuso da CONTA, que vem sozinho do aparelho (sem campo pra
// escolher). Quando o aparelho está num horário diferente (viagem, mudou de cidade), o app pergunta uma vez se é pra
// usar o novo, como o Google Agenda faz; nunca troca sozinho, pra o mês e as contas não pularem no meio de uma viagem.
// "Manter" vale pra este fuso do aparelho (se ele mudar de novo, pergunta de novo).
import { useState } from "react"
import { Clock } from "lucide-react"
import { api } from "../api/cliente"
import { agora, fusoDoAparelho } from "../utils/dateTime"
import Botao from "./Botao"
import styles from "./AvisoDeFuso.module.css"

/** Minutos de diferença do fuso pro UTC agora ("GMT-5" → −300). */
export function deslocamento(fuso: string, quando = agora()): number {
  const nome = new Intl.DateTimeFormat("en-US", { timeZone: fuso, timeZoneName: "shortOffset" }).formatToParts(quando)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT"
  const m = nome.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0
}

/** "Horário do Acre", "Horário de Brasília"… (o nome que o navegador dá, em português; senão a cidade do nome IANA). */
export function nomeDoFuso(fuso: string): string {
  try {
    const nome = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, timeZoneName: "longGeneric" }).formatToParts(agora())
      .find((p) => p.type === "timeZoneName")?.value
    // "Horário Padrão de Brasília" → "Horário de Brasília" (o Brasil não tem horário de verão: o "padrão" só confunde).
    if (nome && !/^GMT/.test(nome)) {
      const limpo = nome.replace(/\s+padrão(?=\s|$)/i, "")
      return limpo.charAt(0).toUpperCase() + limpo.slice(1)
    }
  } catch { /* fuso desconhecido */ }
  return fuso.split("/").pop()!.replace(/_/g, " ")
}

const inicialMinuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const chaveDispensado = (usuarioId: string, aparelho: string) => `v2:fuso-mantido:${usuarioId}:${aparelho}`
const lerDispensado = (chave: string) => { try { return localStorage.getItem(chave) === "1" } catch { return false } }

export default function AvisoDeFuso({ usuarioId, fusoDaConta, aoMudar }: {
  usuarioId: string
  fusoDaConta: string | null | undefined
  /** Depois de gravar o novo fuso: recarrega a pessoa (e com ela o "hoje" da tela). */
  aoMudar: () => void | Promise<void>
}) {
  const aparelho = fusoDoAparelho()
  const chave = chaveDispensado(usuarioId, aparelho)
  const [dispensado, setDispensado] = useState(() => lerDispensado(chave))
  const [gravando, setGravando] = useState(false)
  const [erro, setErro] = useState(false)

  // Mesmo horário com nome diferente (America/Bahia × America/Sao_Paulo) não é mudança.
  if (!fusoDaConta || dispensado || deslocamento(aparelho) === deslocamento(fusoDaConta)) return null

  const horas = (deslocamento(aparelho) - deslocamento(fusoDaConta)) / 60
  const diferenca = `${Math.abs(horas).toLocaleString("pt-BR")}h ${horas < 0 ? "antes" : "depois"}`
  const usar = async () => {
    setGravando(true); setErro(false)
    try { await api.put("/usuarios/me/fuso", { fuso: aparelho }, { skipErrorToast: true }); await aoMudar() } catch { setErro(true) } finally { setGravando(false) }
  }
  const manter = () => { try { localStorage.setItem(chave, "1") } catch { /* sem armazenamento */ } setDispensado(true) }

  return (
    <div className={styles.aviso} role="status">
      <Clock size={18} strokeWidth={2} aria-hidden="true" className={styles.icone} />
      <p className={styles.texto}>
        Seu aparelho está no <b>{inicialMinuscula(nomeDoFuso(aparelho))}</b> ({diferenca} do {inicialMinuscula(nomeDoFuso(fusoDaConta))}, o da sua conta).
        Usar esse horário pro "hoje" e pros horários do app?
        {erro && <span className={styles.erro}> Não deu pra trocar agora; tente de novo.</span>}
      </p>
      <span className={styles.acoes}>
        <Botao variante="primario" onClick={() => void usar()} disabled={gravando}>{gravando ? "Trocando…" : "Usar este horário"}</Botao>
        <Botao variante="texto" onClick={manter} disabled={gravando}>Manter o da conta</Botao>
      </span>
    </div>
  )
}
