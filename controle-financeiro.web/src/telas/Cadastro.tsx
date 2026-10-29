// Pedir acesso (/cadastro): nome, e-mail, data de nascimento, senha (regra NIST: 15+ caracteres, mostrar/ocultar)
// e confirmação, aceite da Política de Privacidade (LGPD: nunca pré-marcado). No beta o cadastro não loga: a conta
// nasce aguardando aprovação e a tela vira a confirmação. O visual é o do rascunho aprovado (rascunhos/acesso.html do
// hub Pontes Dev, 2026-10-26): passos `pedir` e `enviado` da MolduraAcesso.
import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import MolduraAcesso, { CampoAcesso, Seta } from "../site/MolduraAcesso"
import css from "../site/Acesso.module.css"
import { BarraDev, useEstadoDev } from "../dev/BarraDev"
import { ESTADOS_ACESSO } from "../dev/estadosAcesso"
import { cadastrar } from "../services/cadastroService"
import { mensagemDeErro } from "../api/cliente"
import { useAuth } from "../auth/useAuth"
import { ehErroDaSenha, SENHA_MAX, senhaValida } from "../dominio/senha"
import VerificacaoHumana, { useVerificacaoHumana } from "../componentes/VerificacaoHumana"

const MAX_NOME = 200
const MAX_EMAIL = 255
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
type Erros = Partial<Record<"nome" | "email" | "nascimento" | "senha" | "confirmar" | "privacidade", string>>

export default function Cadastro() {
  const { autenticado, carregando } = useAuth()
  const navigate = useNavigate()
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [nascimento, setNascimento] = useState("")
  const [senha, setSenha] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [aceita, setAceita] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const limpa = (k: keyof Erros) => setErros((e) => ({ ...e, [k]: undefined }))
  // Pedir acesso manda e-mail pro endereço digitado: sempre com o "não sou robô" (quando ligado).
  const verif = useVerificacaoHumana()
  const hoje = new Date().toISOString().slice(0, 10)

  // DEV: a barra de estados põe a tela direto em cada passo (sem API). Some no build.
  useEstadoDev(import.meta.env.DEV ? (e) => { setEnviado(e === "enviado"); setErros({}); setErro(null) } : undefined)

  // Logado vai pra Visão geral (em dev, aberto pela barra de estados, fica pra ver o passo).
  useEffect(() => {
    if (import.meta.env.DEV && window.location.hash) return
    if (!carregando && autenticado) navigate("/dashboard", { replace: true })
  }, [autenticado, carregando, navigate])

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
    const token = verif.chave ? await verif.aguardarToken() : null
    if (verif.chave && !token) { setEnviando(false); setErro("Confirme que você não é um robô."); return }
    try {
      await cadastrar({ nome: nome.trim(), email: email.trim(), dataNascimento: nascimento || null, password: senha, confirmPassword: confirmar,
        turnstileToken: token ?? undefined })
      setEnviado(true)
    } catch (err) {
      const msg = mensagemDeErro(err)
      if (ehErroDaSenha(msg)) setErros({ senha: msg })
      else setErro(msg)
      verif.novaRodada() // o token já foi gasto
    } finally {
      setEnviando(false)
    }
  }

  return (
    <MolduraAcesso titulo="Pedir acesso · Pontes" foto="1694185752018-2ff397cb99b4-1800.webp" frase="Comece grátis." fraseSuave="Cresça com a sua casa."
      lead="Peça o seu acesso em 2 minutos. Sem cartão de crédito, sem fidelidade."
      benef={["Grátis durante o beta", "Convide quem divide a casa sem custo extra", "Seus dados são seus: exporte ou apague quando quiser"]}>
      {enviado ? (
        <section data-passo="enviado" className="ativo" role="status">
          <h1>Pedido enviado!</h1>
          <p className="alerta-ok">Recebemos o seu pedido. Abra o e-mail que mandamos e confirme que o endereço é seu.</p>
          <p className={`sub ${css.depois}`}>Com o e-mail confirmado, o pedido segue pra aprovação. Quando o acesso for liberado, chega outro e-mail.</p>
          <Link className="btn btn--acc btn-cheio" to="/entrar">Ir para o login <Seta /></Link>
        </section>
      ) : (
        <section data-passo="pedir" className="ativo">
          <h1>Pedir acesso</h1>
          <p className="sub">O Pontes está em beta fechado: você recebe acesso assim que o pedido for aprovado. Já tem conta? <Link to="/entrar">Entrar</Link></p>
          <form className="form-a" onSubmit={enviar} noValidate>
            {erro && <p className="erro" role="alert">{erro}</p>}
            <CampoAcesso rotulo="Nome completo" erro={erros.nome} name="nome" autoComplete="name" maxLength={MAX_NOME} value={nome} autoFocus
              onChange={(e) => { setNome(e.target.value); limpa("nome") }} />
            <CampoAcesso rotulo="E-mail" erro={erros.email} type="email" name="email" autoComplete="email" maxLength={MAX_EMAIL} value={email}
              onChange={(e) => { setEmail(e.target.value); limpa("email") }} />
            <CampoAcesso rotulo="Data de nascimento" erro={erros.nascimento} type="date" name="nascimento" autoComplete="bday" max={hoje} value={nascimento}
              onChange={(e) => { setNascimento(e.target.value); limpa("nascimento") }} />
            <CampoAcesso rotulo="Senha" senha erro={erros.senha} name="senha" autoComplete="new-password" maxLength={SENHA_MAX} value={senha}
              onChange={(e) => { setSenha(e.target.value); limpa("senha") }} />
            {!erros.senha && (
              <ul className="req" aria-label="Requisitos da senha">
                <li data-ok={senhaValida(senha) || undefined}>Mínimo 15 caracteres. Pode ser uma frase, fácil de lembrar.</li>
              </ul>
            )}
            <CampoAcesso rotulo="Confirmar senha" senha erro={erros.confirmar} name="confirmar" autoComplete="new-password" maxLength={SENHA_MAX} value={confirmar}
              onChange={(e) => { setConfirmar(e.target.value); limpa("confirmar") }} />
            <label className="marcar consentimento">
              <input type="checkbox" checked={aceita} aria-invalid={erros.privacidade ? true : undefined}
                onChange={(e) => { setAceita(e.target.checked); limpa("privacidade") }} />
              <span>Li e aceito a <Link to="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</Link>.</span>
              {erros.privacidade && <span className="erro">{erros.privacidade}</span>}
            </label>
            {verif.chave && <VerificacaoHumana chave={verif.chave} rodada={verif.rodada} aoMudar={verif.setToken} />}
            <button className="btn btn--acc btn-cheio" type="submit" disabled={enviando}>{enviando ? "Enviando…" : "Enviar pedido"}</button>
          </form>
          <p className="rodape-a">Ao pedir acesso você concorda com os <Link to="/termos-de-uso" target="_blank" rel="noreferrer">Termos de Uso</Link>.</p>
        </section>
      )}
      {import.meta.env.DEV && <BarraDev grupos={ESTADOS_ACESSO} atual={enviado ? "enviado" : "pedir"} />}
    </MolduraAcesso>
  )
}
