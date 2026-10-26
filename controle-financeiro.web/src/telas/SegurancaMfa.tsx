// Verificação em duas etapas (MFA) nas Configurações do v2 — opcional, nunca obrigatória. Desligada → Ativar:
// QR + chave manual, código do app pra confirmar → códigos de recuperação (mostrados UMA vez: baixar/copiar)
// → Ativa (quantos códigos de recuperação sobram) → Desativar pede senha atual + código (step-up, como no
// servidor). Tudo na própria seção, sem popup. Ativar (QR, código, códigos de recuperação) é o useAtivacaoMfa,
// o mesmo do convite pós-login (ProtejaConta).
import { useEffect, useState } from "react"
import { Check, Copy, Download, ShieldCheck } from "lucide-react"
import mfaService, { type MfaStatus } from "../services/mfaService"
import { mensagemDeErro } from "../api/cliente"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import Etiqueta from "../componentes/Etiqueta"
import { useAtivacaoMfa } from "./useAtivacaoMfa"
import styles from "./SegurancaMfa.module.css"

type Fase = "carregando" | "desligada" | "configurar" | "recuperacao" | "ativa" | "desativar"
type Erros = Partial<Record<"senha" | "codigoDesativar", string>>

export default function SegurancaMfa() {
  const [fase, setFase] = useState<Fase>("carregando")
  const [status, setStatus] = useState<MfaStatus | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [erros, setErros] = useState<Erros>({})
  const [ocupadoAqui, setOcupado] = useState(false)
  const at = useAtivacaoMfa()
  const { qr, chave, codigo, recuperacao, copiado } = at
  const ocupado = ocupadoAqui || at.ocupado
  const [senha, setSenha] = useState("")
  const [codigoDesativar, setCodigoDesativar] = useState("")
  const limpa = (k: keyof Erros) => setErros((e) => ({ ...e, [k]: undefined }))

  const carregar = async () => {
    try { const s = await mfaService.status(); setStatus(s); setFase(s.ativo ? "ativa" : "desligada") }
    catch { setErro("Não deu pra carregar a verificação em duas etapas."); setFase("desligada") }
  }
  useEffect(() => { void carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const ativar = async () => { setErro(null); if (await at.iniciar()) setFase("configurar") }
  const confirmar = async () => { if (await at.confirmar()) setFase("recuperacao") }

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

  const titulo = (
    <span className={styles.titulo}>
      Verificação em duas etapas
      {fase === "ativa" && <Etiqueta tom="positivo">Ativa</Etiqueta>}
      {fase === "desligada" && <Etiqueta>Desligada</Etiqueta>}
    </span>
  )

  return (
    <Bloco titulo={titulo}>
      {(erro || at.erro) && <p className={styles.alerta} role="alert">{erro ?? at.erro}</p>}

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
              <Botao variante="texto" onClick={() => { void at.copiar(chave, "chave") }}
                icone={copiado === "chave" ? <Check size={15} strokeWidth={2.5} aria-hidden="true" /> : <Copy size={15} strokeWidth={2.25} aria-hidden="true" />}>
                {copiado === "chave" ? "Copiada" : "Copiar chave"}
              </Botao>
            </div>
          </div>
          <form className={styles.form} noValidate onSubmit={(e) => { e.preventDefault(); void confirmar() }}>
            <Campo rotulo="Código do app" erro={at.erroCodigo}>
              <Entrada inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" value={codigo} autoFocus
                onChange={(e) => at.setCodigo(e.target.value)} />
            </Campo>
            <div className={styles.acoes}>
              <Botao onClick={() => { at.limpar(); setFase("desligada"); setErro(null) }} disabled={ocupado}>Cancelar</Botao>
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
            <Botao onClick={at.baixar} icone={<Download size={15} strokeWidth={2.25} aria-hidden="true" />}>Baixar .txt</Botao>
            <Botao onClick={() => { void at.copiar(recuperacao.join("\n"), "codigos") }}
              icone={copiado === "codigos" ? <Check size={15} strokeWidth={2.5} aria-hidden="true" /> : <Copy size={15} strokeWidth={2.25} aria-hidden="true" />}>
              {copiado === "codigos" ? "Copiados" : "Copiar"}
            </Botao>
            <Botao variante="primario" onClick={() => { at.limpar(); void carregar() }}>Guardei, concluir</Botao>
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
