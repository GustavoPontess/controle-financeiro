// Redefinir senha (/redefinir-senha?token=…): a tela do link que chega por e-mail. Nova senha (regra NIST,
// mostrar/ocultar) + confirmação → POST /auth/reset-password. Token vale 1 hora e uma vez só; inválido ou
// vencido, a API responde "Token inválido ou expirado" e a tela oferece pedir outro. Mesmo palco do Entrar.
import { useState, type FormEvent } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Check, Eye, EyeOff, KeyRound } from "lucide-react"
import Logo from "../componentes/Logo"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import { redefinirSenha } from "../services/senhaService"
import { mensagemDeErro } from "../api/cliente"
import { requisitosSenha, SENHA_MAX, senhaValida } from "../dominio/senha"
import styles from "./Auth.module.css"

type Erros = Partial<Record<"senha" | "confirmar", string>>

export default function RedefinirSenha() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get("token")?.trim() ?? ""
  const [senha, setSenha] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [pronto, setPronto] = useState(false)
  const limpa = (k: keyof Erros) => setErros((e) => ({ ...e, [k]: undefined }))

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    setErro(null)
    const e: Erros = {}
    if (!senha) e.senha = "Crie uma senha."
    else if (!senhaValida(senha)) e.senha = "A senha precisa ter pelo menos 15 caracteres."
    if (!confirmar) e.confirmar = "Repita a senha."
    else if (senha !== confirmar) e.confirmar = "As senhas não conferem."
    setErros(e)
    if (Object.keys(e).length > 0) return
    setEnviando(true)
    try { await redefinirSenha(token, senha, confirmar); setPronto(true) }
    catch (err) { setErro(mensagemDeErro(err)) }
    finally { setEnviando(false) }
  }

  const olho = (aberto: boolean, alternar: () => void) => (
    <Botao variante="texto" soIcone tabIndex={-1} aria-label={aberto ? "Ocultar senha" : "Mostrar senha"} onClick={alternar}
      icone={aberto ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />} />
  )

  return (
    <div className={`v2 ${styles.raiz}`}>
      <aside className={styles.palco}>
        <div className={styles.marca}><Logo size={28} /></div>
        <div className={styles.palcoMeio}>
          <p className={styles.frase}>Uma senha nova, <span className={styles.fraseSuave}>e pronto.</span></p>
          <p className={styles.lead}>Pode ser uma frase, fácil de lembrar e difícil de adivinhar. Só precisa ter 15 caracteres ou mais.</p>
        </div>
        <span className={styles.palcoRodape}>Pontes · finanças pessoais e familiares</span>
      </aside>

      <main className={styles.painel}>
        <div className={styles.painelMiolo}>
          <Link to="/entrar" className={styles.voltar}><ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Voltar ao login</Link>
          <div className={styles.marcaMovel}><Logo size={26} /></div>

          {pronto ? (
            <div className={styles.form} role="status">
              <span className={styles.selo}><KeyRound size={26} strokeWidth={2} aria-hidden="true" /></span>
              <h1 className={styles.titulo}>Senha alterada</h1>
              <p className={styles.sub}>Por segurança, você foi desconectado de todos os dispositivos. Entre com a senha nova.</p>
              <Botao variante="primario" tamanho="lg" cheio onClick={() => navigate("/entrar")}>Entrar</Botao>
            </div>
          ) : !token ? (
            <div className={styles.form}>
              <h1 className={styles.titulo}>Link inválido</h1>
              <p className={styles.sub}>Este link não tem o código de recuperação. Abra o link do e-mail inteiro, ou peça outro.</p>
              <Botao variante="primario" tamanho="lg" cheio onClick={() => navigate("/entrar", { state: { esqueci: true } })}>Pedir outro link</Botao>
            </div>
          ) : (
            <>
              <h1 className={styles.titulo}>Criar uma senha nova</h1>
              <form className={styles.form} onSubmit={enviar} noValidate>
                {erro && (
                  <p className={styles.alerta} role="alert">
                    {erro}{/token/i.test(erro) && <> <Link to="/entrar" state={{ esqueci: true }}>Pedir outro link</Link>.</>}
                  </p>
                )}
                <Campo rotulo="Senha nova" erro={erros.senha}>
                  <Entrada type={mostrarSenha ? "text" : "password"} autoComplete="new-password" maxLength={SENHA_MAX} autoFocus value={senha}
                    onChange={(e) => { setSenha(e.target.value); limpa("senha") }} sufixo={olho(mostrarSenha, () => setMostrarSenha((v) => !v))} />
                </Campo>
                {!erros.senha && (
                  <ul className={styles.requisitos} aria-label="Requisitos da senha">
                    {requisitosSenha(senha).map((r) => (
                      <li key={r.rotulo} data-ok={r.ok || undefined}><Check size={14} strokeWidth={3} aria-hidden="true" />{r.rotulo}</li>
                    ))}
                  </ul>
                )}
                <Campo rotulo="Confirmar senha" erro={erros.confirmar}>
                  <Entrada type={mostrarConfirmar ? "text" : "password"} autoComplete="new-password" maxLength={SENHA_MAX} value={confirmar}
                    onChange={(e) => { setConfirmar(e.target.value); limpa("confirmar") }} sufixo={olho(mostrarConfirmar, () => setMostrarConfirmar((v) => !v))} />
                </Campo>
                <Botao variante="primario" tamanho="lg" cheio type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar senha nova"}</Botao>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
