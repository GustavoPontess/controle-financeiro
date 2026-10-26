// Redefinir senha (/redefinir-senha?token=…): a tela do link que chega por e-mail. Nova senha (regra NIST,
// mostrar/ocultar) + confirmação → POST /auth/reset-password. Token vale 1 hora e uma vez só; inválido ou
// vencido, a API responde "Token inválido ou expirado" e a tela oferece pedir outro. O visual é o do rascunho
// aprovado (rascunhos/nova-senha.html do hub Pontes Dev, 2026-10-26): passos `nova`, `alterada` e `invalido`.
import { useState, type FormEvent } from "react"
import { Link, useSearchParams } from "react-router-dom"
import MolduraAcesso, { CampoAcesso, Seta } from "../site/MolduraAcesso"
import css from "../site/Acesso.module.css"
import { BarraDev, useEstadoDev } from "../dev/BarraDev"
import { ESTADOS_ACESSO } from "../dev/estadosAcesso"
import { redefinirSenha } from "../services/senhaService"
import { mensagemDeErro } from "../api/cliente"
import { ehErroDaSenha, SENHA_MAX, senhaValida } from "../dominio/senha"

type Erros = Partial<Record<"senha" | "confirmar", string>>

export default function RedefinirSenha() {
  const [params] = useSearchParams()
  const token = params.get("token")?.trim() ?? ""
  const [senha, setSenha] = useState("")
  const [confirmar, setConfirmar] = useState("")
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [pronto, setPronto] = useState(false)
  const limpa = (k: keyof Erros) => setErros((e) => ({ ...e, [k]: undefined }))

  // DEV: a barra de estados põe a tela direto em cada passo (sem API). O token vem no endereço da barra. Some no build.
  useEstadoDev(import.meta.env.DEV ? (e) => { setPronto(e === "alterada"); setErros({}); setErro(null) } : undefined)

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
    catch (err) { const msg = mensagemDeErro(err); if (ehErroDaSenha(msg)) setErros({ senha: msg }); else setErro(msg) }
    finally { setEnviando(false) }
  }

  return (
    <MolduraAcesso titulo="Criar senha nova · Pontes" foto="1758523417185-5d46089b870a-1400.jpg" frase="Uma senha nova," fraseSuave="e pronto."
      lead="Pode ser uma frase, fácil de lembrar e difícil de adivinhar. Só precisa ter 15 caracteres ou mais.">
      {pronto ? (
        <section data-passo="alterada" className="ativo" role="status">
          <h1>Senha alterada</h1>
          <p className="alerta-ok">Pronto, a sua senha nova já vale.</p>
          <p className={`sub ${css.depois}`}>Por segurança, você foi desconectado de todos os aparelhos. Entre com a senha nova.</p>
          <Link className="btn btn--acc btn-cheio" to="/entrar">Entrar <Seta /></Link>
        </section>
      ) : !token ? (
        <section data-passo="invalido" className="ativo">
          <h1>Link inválido</h1>
          <p className="sub">Este link venceu ou não tem o código de recuperação. Abra o link do e-mail inteiro, ou peça outro.</p>
          <Link className="btn btn--acc btn-cheio" to="/entrar" state={{ esqueci: true }}>Pedir outro link <Seta /></Link>
        </section>
      ) : (
        <section data-passo="nova" className="ativo">
          <h1>Criar uma senha nova</h1>
          <p className="sub">Depois de salvar, você sai de todos os aparelhos e entra de novo com a senha nova.</p>
          <form className="form-a" onSubmit={enviar} noValidate>
            {erro && (
              <p className="erro" role="alert">
                {erro}{/token/i.test(erro) && <> <Link to="/entrar" state={{ esqueci: true }}>Pedir outro link</Link>.</>}
              </p>
            )}
            <CampoAcesso rotulo="Senha nova" senha erro={erros.senha} name="senha" autoComplete="new-password" maxLength={SENHA_MAX} autoFocus value={senha}
              onChange={(e) => { setSenha(e.target.value); limpa("senha") }} />
            {!erros.senha && (
              <ul className="req" aria-label="Requisitos da senha"><li data-ok={senhaValida(senha) || undefined}>Mínimo 15 caracteres</li></ul>
            )}
            <CampoAcesso rotulo="Confirmar senha" senha erro={erros.confirmar} name="confirmar" autoComplete="new-password" maxLength={SENHA_MAX} value={confirmar}
              onChange={(e) => { setConfirmar(e.target.value); limpa("confirmar") }} />
            <button className="btn btn--acc btn-cheio" type="submit" disabled={enviando}>{enviando ? "Salvando…" : "Salvar senha nova"}</button>
          </form>
        </section>
      )}
      {import.meta.env.DEV && <BarraDev grupos={ESTADOS_ACESSO} atual={pronto ? "alterada" : !token ? "invalido" : "nova"} />}
    </MolduraAcesso>
  )
}
