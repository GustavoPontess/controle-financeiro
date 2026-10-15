// Criar conta do v2 (/cadastro): nome, e-mail, data de nascimento, senha (regra NIST: 15+ caracteres,
// mostrar/ocultar) e confirmação, aceite da Política de Privacidade (LGPD — nunca pré-marcado). No beta o
// cadastro não loga: a conta nasce aguardando aprovação e a tela vira a confirmação com a mensagem da API.
// Mesmo palco e painel do Entrar (Auth.module.css).
import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Check, Eye, EyeOff, MailCheck } from "lucide-react"
import Logo from "../componentes/Logo"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import { cadastrar } from "../services/cadastroService"
import { mensagemDeErro } from "../api/cliente"
import { useAuth } from "../auth/useAuth"
import { APP_ATUAL } from "../config"
import { ehErroDaSenha, requisitosSenha, SENHA_MAX, senhaValida } from "../dominio/senha"
import styles from "./Auth.module.css"

const MAX_NOME = 200
const MAX_EMAIL = 255
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
type Erros = Partial<Record<"nome" | "email" | "nascimento" | "senha" | "confirmar" | "privacidade", string>>

const PLANOS = [
  { nome: "Solo", preco: "Grátis", desc: "1 conta + 1 cartão, lançamentos ilimitados" },
  { nome: "Família", preco: "R$ 15/mês", desc: "Até 6 membros, rateio e aprovação" },
  { nome: "Contador", preco: "R$ 39/mês", desc: "Multi-cliente, relatórios contábeis" },
]

export default function Cadastro() {
  const { autenticado, carregando } = useAuth()
  const navigate = useNavigate()
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [nascimento, setNascimento] = useState("")
  const [senha, setSenha] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false)
  const [aceita, setAceita] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  // Deu certo: a mensagem da API ("aguardando aprovação") no lugar do formulário.
  const [enviado, setEnviado] = useState<string | null>(null)
  const limpa = (k: keyof Erros) => setErros((e) => ({ ...e, [k]: undefined }))
  const hoje = new Date().toISOString().slice(0, 10)

  useEffect(() => { if (!carregando && autenticado) navigate("/dashboard", { replace: true }) }, [autenticado, carregando, navigate])

  const validar = (): Erros => {
    const e: Erros = {}
    if (!nome.trim()) e.nome = "Informe seu nome."
    else if (nome.trim().length > MAX_NOME) e.nome = `No máximo ${MAX_NOME} caracteres.`
    if (!email.trim()) e.email = "Informe o e-mail."
    else if (!emailValido(email.trim()) || email.trim().length > MAX_EMAIL) e.email = "E-mail inválido."
    if (!nascimento) e.nascimento = "Informe a data de nascimento."
    else if (nascimento > hoje) e.nascimento = "Não pode ser no futuro."
    if (!senha) e.senha = "Crie uma senha."
    else if (!senhaValida(senha)) e.senha = "A senha precisa ter pelo menos 15 caracteres."
    if (!confirmar) e.confirmar = "Repita a senha."
    else if (senha !== confirmar) e.confirmar = "As senhas não conferem."
    if (!aceita) e.privacidade = "Aceite a Política de Privacidade pra continuar."
    return e
  }

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault()
    setErro(null)
    const e = validar()
    setErros(e)
    if (Object.keys(e).length > 0) return
    setEnviando(true)
    try {
      const r = await cadastrar({ nome: nome.trim(), email: email.trim(), dataNascimento: nascimento || null, password: senha, confirmPassword: confirmar })
      setEnviado(r.mensagem)
    } catch (err) {
      const msg = mensagemDeErro(err)
      if (ehErroDaSenha(msg)) setErros({ senha: msg })
      else setErro(msg)
    } finally {
      setEnviando(false)
    }
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
          <p className={styles.frase}>Comece grátis. <span className={styles.fraseSuave}>Cresça com sua família.</span></p>
          <p className={styles.lead}>Crie sua conta em 2 minutos. Sem cartão, sem fidelidade.</p>
          <ul className={styles.planos}>
            {PLANOS.map((p) => (
              <li key={p.nome} className={styles.plano}>
                <span className={styles.planoTexto}><span className={styles.planoNome}>{p.nome}</span><span className={styles.planoDesc}>{p.desc}</span></span>
                <span className={styles.planoPreco}>{p.preco}</span>
              </li>
            ))}
          </ul>
        </div>
        <span className={styles.palcoRodape}>Pontes · finanças pessoais e familiares</span>
      </aside>

      <main className={styles.painel}>
        <div className={styles.painelMiolo}>
          <a href={`${APP_ATUAL}/`} className={styles.voltar}><ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" /> Página inicial</a>
          <div className={styles.marcaMovel}><Logo size={26} /></div>

          {enviado ? (
            <div className={styles.form} role="status">
              <span className={styles.selo}><MailCheck size={26} strokeWidth={2} aria-hidden="true" /></span>
              <h1 className={styles.titulo}>Cadastro enviado!</h1>
              <p className={styles.ok}>{enviado}</p>
              <p className={styles.sub}>Assim que sua conta for aprovada, você já poderá entrar normalmente.</p>
              <Botao variante="primario" tamanho="lg" cheio onClick={() => navigate("/entrar")}>Ir para o login</Botao>
            </div>
          ) : (
            <>
              <h1 className={styles.titulo}>Criar conta grátis</h1>
              <p className={styles.sub}>Já tem conta? <Link to="/entrar">Entrar</Link></p>

              <form className={styles.form} onSubmit={enviar} noValidate>
                {erro && <p className={styles.alerta} role="alert">{erro}</p>}
                <Campo rotulo="Nome completo" erro={erros.nome}>
                  <Entrada autoComplete="name" maxLength={MAX_NOME} value={nome} autoFocus onChange={(e) => { setNome(e.target.value); limpa("nome") }} />
                </Campo>
                <Campo rotulo="E-mail" erro={erros.email}>
                  <Entrada type="email" autoComplete="email" maxLength={MAX_EMAIL} value={email} onChange={(e) => { setEmail(e.target.value); limpa("email") }} />
                </Campo>
                <Campo rotulo="Data de nascimento" erro={erros.nascimento}>
                  <Entrada type="date" autoComplete="bday" max={hoje} value={nascimento} onChange={(e) => { setNascimento(e.target.value); limpa("nascimento") }} />
                </Campo>
                <Campo rotulo="Senha" erro={erros.senha}>
                  <Entrada type={mostrarSenha ? "text" : "password"} autoComplete="new-password" maxLength={SENHA_MAX} value={senha}
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
                <div className={styles.consentimento}>
                  <label className={styles.lembrar}>
                    <input type="checkbox" checked={aceita} aria-invalid={erros.privacidade ? true : undefined}
                      onChange={(e) => { setAceita(e.target.checked); limpa("privacidade") }} />
                    <span>Li e aceito a <Link to="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</Link>.</span>
                  </label>
                  {erros.privacidade && <p className={styles.erroCampo} role="alert">{erros.privacidade}</p>}
                </div>
                <Botao variante="primario" tamanho="lg" cheio type="submit" disabled={enviando}>{enviando ? "Criando…" : "Criar conta grátis"}</Botao>
              </form>

              <p className={styles.rodape}>
                Ao criar sua conta você também concorda com os <Link to="/termos-de-uso" target="_blank" rel="noreferrer">Termos de Uso</Link>.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
