// Onde a conta está aberta e onde o código é pulado — Configurações do v2, logo abaixo da verificação em duas
// etapas. Sessões ativas: cada aparelho logado; "Encerrar" desloga aquele aparelho (o deste navegador não se
// encerra aqui — é o "Sair" do menu); "Sair dos outros" deixa só este. Dispositivos confiáveis: onde o login
// pula o código por 30 dias; "Esquecer" faz pedir o código de novo; "Esquecer todos" inclui este navegador.
// As ações em massa pedem confirmação; a de um aparelho só é direta (fácil de refazer: é só entrar de novo).
import { useEffect, useState, type ReactNode } from "react"
import { Monitor, Smartphone } from "lucide-react"
import sessaoService from "../services/sessaoService"
import dispositivoService, { type DispositivoConfiavel } from "../services/dispositivoService"
import type { Sessao } from "../types/Sessao"
import { mensagemDeErro } from "../api/cliente"
import { quandoLocal, resumirAparelho } from "../dominio/dispositivo"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Confirmar from "../componentes/Confirmar"
import Etiqueta from "../componentes/Etiqueta"
import styles from "./SegurancaDispositivos.module.css"

type EmMassa = "sessoes" | "dispositivos" | null

export default function SegurancaDispositivos() {
  const [sessoes, setSessoes] = useState<Sessao[] | null>(null)
  const [dispositivos, setDispositivos] = useState<DispositivoConfiavel[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [emMassa, setEmMassa] = useState<EmMassa>(null)

  const carregar = async () => {
    const [s, d] = await Promise.allSettled([sessaoService.listar(), dispositivoService.listar()])
    setSessoes(s.status === "fulfilled" ? s.value : [])
    setDispositivos(d.status === "fulfilled" ? d.value : [])
    if (s.status === "rejected" || d.status === "rejected") setErro("Não deu pra carregar tudo. Recarregue a página.")
  }
  useEffect(() => { void carregar() }, [])

  const agir = async (chave: string, acao: () => Promise<unknown>) => {
    setErro(null); setOcupado(chave)
    try { await acao(); await carregar() }
    catch (e) { setErro(mensagemDeErro(e)) }
    finally { setOcupado(null); setEmMassa(null) }
  }

  const outrasSessoes = (sessoes ?? []).filter((s) => !s.atual).length

  return (
    <>
      <Bloco titulo="Sessões ativas">
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        {sessoes === null ? <Esqueleto linhas={2} altura={16} /> : (
          <ul className={styles.lista} aria-label="Sessões ativas">
            {sessoes.map((s) => (
              <Linha key={s.id} ua={s.dispositivo} atual={s.atual}
                detalhe={[s.ip, `último uso ${quandoLocal(s.ultimoUsoEm ?? s.criadoEm)}`].filter(Boolean).join(" · ")}
                acao={s.atual ? null : (
                  <Botao perigo disabled={ocupado !== null} onClick={() => { void agir(s.id, () => sessaoService.revogar(s.id)) }}>
                    {ocupado === s.id ? "Encerrando…" : "Encerrar"}
                  </Botao>
                )} />
            ))}
          </ul>
        )}
        {outrasSessoes > 0 && (
          <div className={styles.rodape}>
            <Botao perigo disabled={ocupado !== null} onClick={() => setEmMassa("sessoes")}>Sair dos outros aparelhos</Botao>
          </div>
        )}
      </Bloco>

      <Bloco titulo="Dispositivos confiáveis">
        {dispositivos === null ? <Esqueleto linhas={2} altura={16} /> : dispositivos.length === 0 ? (
          <p className={styles.vazio}>Nenhum dispositivo confiável.</p>
        ) : (
          <ul className={styles.lista} aria-label="Dispositivos confiáveis">
            {dispositivos.map((d) => (
              <Linha key={d.id} ua={d.dispositivo} atual={d.atual}
                detalhe={[d.ip, `pula o código até ${quandoLocal(d.expiraEm).split(" às ")[0]}`].filter(Boolean).join(" · ")}
                acao={
                  <Botao perigo disabled={ocupado !== null} onClick={() => { void agir(d.id, () => dispositivoService.esquecer(d.id)) }}>
                    {ocupado === d.id ? "Esquecendo…" : "Esquecer"}
                  </Botao>
                } />
            ))}
          </ul>
        )}
        {(dispositivos?.length ?? 0) > 0 && (
          <div className={styles.rodape}>
            <Botao perigo disabled={ocupado !== null} onClick={() => setEmMassa("dispositivos")}>Esquecer todos</Botao>
          </div>
        )}
      </Bloco>

      <Confirmar
        aberto={emMassa === "sessoes"}
        titulo="Sair dos outros aparelhos?"
        texto={`${outrasSessoes === 1 ? "O outro aparelho vai" : `Os outros ${outrasSessoes} aparelhos vão`} precisar entrar de novo. Este navegador continua conectado.`}
        rotuloConfirmar="Sair dos outros"
        perigo
        ocupado={ocupado === "sessoes"}
        onConfirmar={() => { void agir("sessoes", () => sessaoService.revogarOutras()) }}
        onCancelar={() => setEmMassa(null)}
      />
      <Confirmar
        aberto={emMassa === "dispositivos"}
        titulo="Esquecer todos os dispositivos?"
        texto="O próximo login em qualquer aparelho — inclusive este — vai pedir o código do app."
        rotuloConfirmar="Esquecer todos"
        perigo
        ocupado={ocupado === "dispositivos"}
        onConfirmar={() => { void agir("dispositivos", () => dispositivoService.esquecerTodos()) }}
        onCancelar={() => setEmMassa(null)}
      />
    </>
  )
}

/** Uma linha: ícone (computador/celular), "Chrome no Windows" + "Este navegador", detalhe e a ação. */
function Linha({ ua, atual, detalhe, acao }: { ua?: string | null; atual: boolean; detalhe: string; acao: ReactNode }) {
  const a = resumirAparelho(ua)
  const Icone = a.celular ? Smartphone : Monitor
  return (
    <li className={styles.linha}>
      <span className={styles.icone} aria-hidden="true"><Icone size={18} strokeWidth={2} /></span>
      <span className={styles.texto}>
        <span className={styles.nome}>{a.nome}{atual && <Etiqueta tom="positivo">Este navegador</Etiqueta>}</span>
        <span className={styles.sub}>{detalhe}</span>
      </span>
      {acao}
    </li>
  )
}
