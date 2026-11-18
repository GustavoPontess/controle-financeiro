// As telas dos links de e-mail que agem sem login, na moldura das telas de acesso:
//  - /confirmar-email#token=…  "Confirmar meu e-mail": o pedido segue pra aprovação (só pedido confirmado é aprovado).
//  - /nao-fui-eu#token=…       "Não fui eu": apaga o pedido e os dados que vieram com ele (LGPD art. 18).
//  - /nao-pedi-senha#token=…   "Não fui eu" do e-mail de senha nova: cancela o link (a conta não trava).
// Abrir o link não faz nada: a ação é o botão (leitor de e-mail e antivírus abrem links sozinhos e cancelariam o pedido).
import { useState } from "react"
import { Link } from "react-router-dom"
import { useTokenDoLink } from "../auth/useTokenDoLink"
import MolduraAcesso, { Seta } from "../site/MolduraAcesso"
import css from "../site/Acesso.module.css"
import { confirmarEmailDoCadastro, naoFuiEuNoCadastro } from "../services/cadastroService"
import { cancelarLinkDeSenha } from "../services/senhaService"
import { mensagemDeErro } from "../api/cliente"

type Textos = {
  tituloAba: string
  titulo: string
  sub: string
  botao: string
  enviando: string
  feitoTitulo: string
  feito: string
  feitoDepois: string
}

const CONFIRMAR: Textos = {
  tituloAba: "Confirmar e-mail · Pontes",
  titulo: "Confirme seu e-mail",
  sub: "Confirmando, o seu pedido de acesso segue pra aprovação.",
  botao: "Confirmar meu e-mail",
  enviando: "Confirmando…",
  feitoTitulo: "E-mail confirmado",
  feito: "Pronto, o seu pedido seguiu pra aprovação.",
  feitoDepois: "Você recebe outro e-mail assim que o acesso for liberado.",
}

const NAO_FUI_EU: Textos = {
  tituloAba: "Não fui eu · Pontes",
  titulo: "Não pediu acesso?",
  sub: "Alguém usou o seu e-mail pra pedir acesso ao Pontes. Apague o pedido e os dados que vieram com ele.",
  botao: "Apagar o pedido",
  enviando: "Apagando…",
  feitoTitulo: "Pedido apagado",
  feito: "Pronto, o pedido e os dados dele foram apagados.",
  feitoDepois: "O seu e-mail não recebe mais nada por causa dele.",
}

const NAO_PEDI_SENHA: Textos = {
  tituloAba: "Cancelar link de senha · Pontes",
  titulo: "Não pediu senha nova?",
  sub: "Alguém digitou o seu e-mail no \"Esqueci a senha\". Sem o link do e-mail ninguém entra. Cancele o link e ele para de valer.",
  botao: "Cancelar o link",
  enviando: "Cancelando…",
  feitoTitulo: "Link cancelado",
  feito: "Pronto, o link não vale mais e a sua senha continua a mesma.",
  feitoDepois: "Pra proteger mais a conta, ligue a verificação em duas etapas em Configurações.",
}

function TelaDoLink({ textos, acao }: { textos: Textos; acao: (token: string) => Promise<void> }) {
  const token = useTokenDoLink()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [feito, setFeito] = useState(false)

  const fazer = async () => {
    setErro(null)
    setEnviando(true)
    try { await acao(token); setFeito(true) }
    catch (e) { setErro(mensagemDeErro(e)) }
    finally { setEnviando(false) }
  }

  return (
    <MolduraAcesso titulo={textos.tituloAba} foto="1740679954227-a0cd19c042a6-1400.webp" frase="O dinheiro da casa," fraseSuave="sem briga."
      lead="Um lugar só pra você e pra quem divide a casa com você.">
      {feito ? (
        <section data-passo="feito" className="ativo" role="status">
          <h1>{textos.feitoTitulo}</h1>
          <p className="alerta-ok">{textos.feito}</p>
          <p className={`sub ${css.depois}`}>{textos.feitoDepois}</p>
          <Link className="btn btn--acc btn-cheio" to="/">Ir pro site <Seta /></Link>
        </section>
      ) : !token ? (
        <section data-passo="invalido" className="ativo">
          <h1>Link inválido</h1>
          <p className="sub">Este link está incompleto. Abra o link do e-mail inteiro.</p>
        </section>
      ) : (
        <section data-passo="pedir" className="ativo">
          <h1>{textos.titulo}</h1>
          <p className="sub">{textos.sub}</p>
          {erro && <p className={`erro ${css.erroTopo}`} role="alert">{erro}</p>}
          <button className="btn btn--acc btn-cheio" type="button" disabled={enviando} onClick={() => void fazer()}>
            {enviando ? textos.enviando : textos.botao}
          </button>
        </section>
      )}
    </MolduraAcesso>
  )
}

export const ConfirmarEmail = () => <TelaDoLink textos={CONFIRMAR} acao={confirmarEmailDoCadastro} />
export const NaoFuiEu = () => <TelaDoLink textos={NAO_FUI_EU} acao={naoFuiEuNoCadastro} />
export const NaoPediSenha = () => <TelaDoLink textos={NAO_PEDI_SENHA} acao={cancelarLinkDeSenha} />
