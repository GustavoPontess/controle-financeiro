// Verificação em duas etapas (MFA) nas Configurações do v2 — opcional, nunca obrigatória. Desligada → Ativar:
// QR + chave manual, código do app pra confirmar → códigos de recuperação (mostrados UMA vez: baixar/copiar)
// → Ativa (quantos códigos de recuperação sobram) → Desativar pede senha atual + código (step-up, como no
// servidor). Tudo na própria seção, sem popup. A tela do convite pós-login usa esta mesma seção com `iniciar`
// (abre direto no QR), `aoConcluir` e `aoCancelar`.
import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Check, Copy, Download, ShieldCheck } from "lucide-react"
import mfaService, { type MfaStatus } from "../services/mfaService"
import { mensagemDeErro } from "../api/cliente"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import Etiqueta from "../componentes/Etiqueta"
import styles from "./SegurancaMfa.module.css"

type Fase = "carregando" | "desligada" | "configurar" | "recuperacao" | "ativa" | "desativar"
type Erros = Partial<Record<"codigo" | "senha" | "codigoDesativar", string>>
const CODIGO = /^\d{6}$/

/** Arquivo .txt dos códigos de recuperação (\r\n abre bem no Bloco de Notas). */
const arquivoRecuperacao = (codigos: string[]) => [
  "Pontes: códigos de recuperação da verificação em duas etapas",
  `Gerados em: ${new Date().toLocaleString("pt-BR")}`,
  "",
  "Cada código funciona uma vez, pra quando você estiver sem o app autenticador.",
  "Guarde num lugar seguro. Eles não aparecem de novo.",
  "",
  ...codigos,
  "",
].join("\r\n")

export default function SegurancaMfa({ iniciar, aoConcluir, aoCancelar }: {
  /** Já abre no passo do QR (sem o "Ativar"). */
  iniciar?: boolean
  /** Depois de guardar os códigos de recuperação (em vez de voltar pro status). */
  aoConcluir?: () => void
  /** "Cancelar" no passo do QR (em vez de voltar pro "Desligada"). */
  aoCancelar?: () => void
} = {}) {
  const [fase, setFase] = useState<Fase>("carregando")
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [erros, setErros] = useState<Erros>({})
  const [ocupado, setOcupado] = useState(false)
  const [qr, setQr] = useState("")
  const [chave, setChave] = useState("")
  const [codigo, setCodigo] = useState("")
  const [recuperacao, setRecuperacao] = useState<string[]>([])
  const [copiado, setCopiado] = useState<"chave" | "codigos" | null>(null)
  const [senha, setSenha] = useState("")
  const [codigoDesativar, setCodigoDesativar] = useState("")
  const limpa = (k: keyof Erros) => setErros((e) => ({ ...e, [k]: undefined }))

  const carregar = async () => {
    try { const s = await mfaService.status(); setStatus(s); setFase(s.ativo ? "ativa" : "desligada") }
    catch { setErro("Não deu pra carregar a verificação em duas etapas."); setFase("desligada") }
  }
  useEffect(() => { if (iniciar) void ativar(); else void carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const copiar = async (texto: string, qual: "chave" | "codigos") => {
    try { await navigator.clipboard.writeText(texto); setCopiado(qual); setTimeout(() => setCopiado(null), 2000) } catch { /* sem área de transferência */ }
  }

  const ativar = async () => {
    setErro(null); setOcupado(true)
    try {
      const { secretBase32, qrCodeUri } = await mfaService.iniciarAtivacao()
      setChave(secretBase32)
      setQr(await QRCode.toDataURL(qrCodeUri, { width: 192, margin: 1 }))
      setCodigo(""); setErros({}); setFase("configurar")
    } catch (e) { setErro(mensagemDeErro(e)) }
    finally { setOcupado(false) }
  }

  const confirmar = async () => {
    setErro(null)
    const c = codigo.replace(/\s/g, "")
    if (!c) { setErros({ codigo: "Digite o código do app." }); return }
    if (!CODIGO.test(c)) { setErros({ codigo: "São 6 números." }); return }
    setOcupado(true)
    try { setRecuperacao(await mfaService.confirmarAtivacao(c)); setFase("recuperacao") }
    catch (e) { setErros({ codigo: mensagemDeErro(e) }) }
    finally { setOcupado(false) }
  }

  const desativar = async () => {
    setErro(null)
    const e: Erros = {}
    if (!senha) e.senha = "Digite sua senha."
    if (!codigoDesativar.trim()) e.codigoDesativar = "Digite um código do app ou de recuperação."
    setErros(e)
    if (Object.keys(e).length > 0) return
    setOcupado(true)
    try { await mfaService.desativar(senha, codigoDesativar.trim()); setSenha(""); setCodigoDesativar(""); await carregar() }
    catch (err) { setErro(mensagemDeErro(err)) }
    finally { setOcupado(false) }
  }

  const baixar = () => {
    const url = URL.createObjectURL(new Blob([arquivoRecuperacao(recuperacao)], { type: "text/plain;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url; a.download = "pontes-codigos-recuperacao.txt"
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  const titulo = (
    <span className={styles.titulo}>
      Verificação em duas etapas
      {fase === "ativa" && <Etiqueta tom="positivo">Ativa</Etiqueta>}
      {fase === "desligada" && <Etiqueta>Desligada</Etiqueta>}
    </span>
  )

  return (
    <Bloco titulo={titulo}>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}

      {fase === "carregando" && <Esqueleto linhas={2} altura={14} />}

      {fase === "desligada" && (
        <div className={styles.linha}>
          <p className={styles.texto}>Além da senha, pede um código do app autenticador do seu celular ao entrar.</p>
          <Botao variante="primario" disabled={ocupado} onClick={() => { void ativar() }}>{ocupado ? "Gerando…" : "Ativar"}</Botao>
        </div>
      )}

      {fase === "configurar" && (
        <div className={styles.configurar}>
          <ol className={styles.passos}>
            <li>Abra o app autenticador (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
            <li>Escaneie o QR code ou digite a chave.</li>
            <li>Digite o código de 6 números que o app mostrar.</li>
          </ol>
          <div className={styles.qrLinha}>
            {qr && <img src={qr} alt="QR code pra adicionar o Pontes no app autenticador" className={styles.qr} width={192} height={192} />}
            <div className={styles.chaveBloco}>
              <span className={styles.rotulo}>Chave</span>
              <code className={styles.chave} aria-label="Chave pra digitar no app">{chave}</code>
              <Botao variante="texto" onClick={() => { void copiar(chave, "chave") }}
                icone={copiado === "chave" ? <Check size={15} strokeWidth={2.5} aria-hidden="true" /> : <Copy size={15} strokeWidth={2.25} aria-hidden="true" />}>
                {copiado === "chave" ? "Copiada" : "Copiar chave"}
              </Botao>
            </div>
          </div>
          <form className={styles.form} noValidate onSubmit={(e) => { e.preventDefault(); void confirmar() }}>
            <Campo rotulo="Código do app" erro={erros.codigo}>
              <Entrada inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" value={codigo} autoFocus
                onChange={(e) => { setCodigo(e.target.value.replace(/[^\d\s]/g, "")); limpa("codigo") }} />
            </Campo>
            <div className={styles.acoes}>
              <Botao onClick={() => { if (aoCancelar) { aoCancelar(); return } setFase("desligada"); setErros({}); setErro(null) }} disabled={ocupado}>Cancelar</Botao>
              <Botao variante="primario" type="submit" disabled={ocupado}>{ocupado ? "Confirmando…" : "Confirmar"}</Botao>
            </div>
          </form>
        </div>
      )}

      {fase === "recuperacao" && (
        <div className={styles.configurar}>
          <p className={styles.ok}><ShieldCheck size={16} strokeWidth={2.25} aria-hidden="true" /> Verificação em duas etapas ativada.</p>
          <p className={styles.texto}>Guarde estes códigos de recuperação num lugar seguro. Cada um funciona uma vez, pra quando você estiver sem o celular. <strong>Eles não aparecem de novo.</strong></p>
          <ul className={styles.codigos} aria-label="Códigos de recuperação">
            {recuperacao.map((c) => <li key={c}><code>{c}</code></li>)}
          </ul>
          <div className={styles.acoes}>
            <Botao onClick={baixar} icone={<Download size={15} strokeWidth={2.25} aria-hidden="true" />}>Baixar .txt</Botao>
            <Botao onClick={() => { void copiar(recuperacao.join("\n"), "codigos") }}
              icone={copiado === "codigos" ? <Check size={15} strokeWidth={2.5} aria-hidden="true" /> : <Copy size={15} strokeWidth={2.25} aria-hidden="true" />}>
              {copiado === "codigos" ? "Copiados" : "Copiar"}
            </Botao>
            <Botao variante="primario" onClick={() => { setRecuperacao([]); if (aoConcluir) aoConcluir(); else void carregar() }}>Guardei, concluir</Botao>
          </div>
        </div>
      )}

      {fase === "ativa" && (
        <div className={styles.linha}>
          <p className={styles.texto}>
            Ao entrar, o Pontes pede o código do app.
            {status && <> Restam <strong>{status.backupCodesRestantes}</strong> {status.backupCodesRestantes === 1 ? "código" : "códigos"} de recuperação.</>}
          </p>
          <Botao perigo onClick={() => { setFase("desativar"); setErros({}); setErro(null) }}>Desativar</Botao>
        </div>
      )}

      {fase === "desativar" && (
        <form className={styles.form} noValidate onSubmit={(e) => { e.preventDefault(); void desativar() }}>
          <p className={styles.texto}>Pra desativar, confirme sua senha e um código do app (ou um de recuperação).</p>
          <Campo rotulo="Senha atual" erro={erros.senha}>
            <Entrada type="password" autoComplete="current-password" maxLength={128} value={senha} autoFocus
              onChange={(e) => { setSenha(e.target.value); limpa("senha") }} />
          </Campo>
          <Campo rotulo="Código" erro={erros.codigoDesativar}>
            <Entrada autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} maxLength={10} placeholder="000000" value={codigoDesativar}
              onChange={(e) => { setCodigoDesativar(e.target.value); limpa("codigoDesativar") }} />
          </Campo>
          <div className={styles.acoes}>
            <Botao onClick={() => { setFase("ativa"); setErros({}); setErro(null) }} disabled={ocupado}>Cancelar</Botao>
            <Botao variante="primario" perigo type="submit" disabled={ocupado}>{ocupado ? "Desativando…" : "Desativar"}</Botao>
          </div>
        </form>
      )}
    </Bloco>
  )
}
