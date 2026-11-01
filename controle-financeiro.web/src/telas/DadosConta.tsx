// Dados e privacidade (Configurações): baixar uma cópia dos próprios dados (LGPD art. 18, acesso e
// portabilidade) e excluir a conta em dois passos (senha atual + código por e-mail ou do autenticador; a API
// faz o soft delete com carência de 30 dias e encerra a sessão). Depois de excluir, sai de todas as contas
// deste navegador e volta pro login com o aviso de como reativar.
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Download } from "lucide-react"
import { useAuth } from "../auth/useAuth"
import { mensagemDeErro } from "../api/cliente"
import contaService, { type MetodoExclusao } from "../services/minhaContaService"
import { getFamilias } from "../services/familiaService"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import styles from "./DadosConta.module.css"
import { dataLocalISO } from "../utils/dateTime"

type Fase = "inicio" | "senha" | "codigo"

export default function DadosConta() {
  return (
    <>
      <BaixarDados />
      <ExcluirConta />
    </>
  )
}

function BaixarDados() {
  const [erro, setErro] = useState<string | null>(null)
  const [baixando, setBaixando] = useState(false)
  const baixar = async () => {
    setErro(null); setBaixando(true)
    try {
      const dados = await contaService.exportarMeusDados()
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `pontes-meus-dados-${dataLocalISO()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) { setErro(mensagemDeErro(e)) }
    setBaixando(false)
  }
  return (
    <Bloco titulo="Seus dados">
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      <div className={styles.linha}>
        <p className={styles.texto}>Uma cópia de tudo que é seu, em JSON: perfil, contas, cartões, lançamentos, contas fixas, compras parceladas, empréstimos, metas, limites, renda e categorias.</p>
        <Botao disabled={baixando} onClick={() => void baixar()} icone={<Download size={15} strokeWidth={2.25} aria-hidden="true" />}>{baixando ? "Preparando…" : "Baixar meus dados"}</Botao>
      </div>
    </Bloco>
  )
}

function ExcluirConta() {
  const navigate = useNavigate()
  const { sair } = useAuth()
  // Quem está numa família precisa saber o que fica lá (LGPD, transparência): só os números, como "Membro que saiu".
  const [temFamilia, setTemFamilia] = useState(false)
  useEffect(() => {
    let vivo = true
    getFamilias().then((f) => { if (vivo) setTemFamilia(f.length > 0) }).catch(() => { /* sem o aviso */ })
    return () => { vivo = false }
  }, [])
  const [fase, setFase] = useState<Fase>("inicio")
  const [senha, setSenha] = useState("")
  const [metodo, setMetodo] = useState<MetodoExclusao>("email")
  const [codigo, setCodigo] = useState("")
  const [erroCampo, setErroCampo] = useState<string | undefined>()
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const cancelar = () => { setFase("inicio"); setSenha(""); setCodigo(""); setErroCampo(undefined); setErro(null) }

  const continuar = async () => {
    setErro(null)
    if (!senha) { setErroCampo("Digite a senha atual."); return }
    setOcupado(true)
    try { setMetodo(await contaService.enviarCodigoExclusao(senha)); setCodigo(""); setFase("codigo") }
    catch (e) { setErro(mensagemDeErro(e)) }
    setOcupado(false)
  }
  const excluir = async () => {
    setErro(null)
    if (!codigo.trim()) { setErroCampo("Digite o código."); return }
    setOcupado(true)
    try {
      await contaService.excluirConta(senha, codigo.trim())
      await sair()
      navigate("/entrar", { replace: true, state: { contaExcluida: true } })
    } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false) }
  }

  return (
    <Bloco titulo="Excluir a conta" className={styles.perigo}>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      {fase === "inicio" && (
        <div className={styles.linha}>
          <p className={styles.texto}>
            A conta fica 30 dias esperando: nesse prazo, entrar de novo reativa. Depois disso, apaga de vez.
            {temFamilia && " Na família, as despesas que você dividiu e o dinheiro que passou entre vocês ficam só com valor, data e categoria, como \"Membro que saiu\", pra conta dos outros não mudar."}
          </p>
          <Botao perigo onClick={() => { setErro(null); setFase("senha") }}>Excluir minha conta</Botao>
        </div>
      )}
      {fase === "senha" && (
        <form className={styles.form} noValidate onSubmit={(e) => { e.preventDefault(); void continuar() }}>
          <div className={styles.formLinha}>
            <Campo rotulo="Senha atual" erro={erroCampo}>
              <Entrada type="password" autoComplete="current-password" value={senha} autoFocus onChange={(e) => { setSenha(e.target.value); setErroCampo(undefined) }} />
            </Campo>
            <div className={styles.acoes}>
              <Botao onClick={cancelar} disabled={ocupado}>Cancelar</Botao>
              <Botao perigo type="submit" disabled={ocupado}>Continuar</Botao>
            </div>
          </div>
        </form>
      )}
      {fase === "codigo" && (
        <form className={styles.form} noValidate onSubmit={(e) => { e.preventDefault(); void excluir() }}>
          <p className={styles.texto}>{metodo === "totp" ? "Digite o código do app autenticador ou um código de recuperação." : "Mandamos um código pro seu e-mail."}</p>
          <div className={styles.formLinha}>
            <Campo rotulo="Código" erro={erroCampo}>
              <Entrada inputMode="numeric" autoComplete="one-time-code" placeholder="000000" value={codigo} autoFocus onChange={(e) => { setCodigo(e.target.value); setErroCampo(undefined) }} />
            </Campo>
            <div className={styles.acoes}>
              <Botao onClick={cancelar} disabled={ocupado}>Cancelar</Botao>
              <Botao perigo type="submit" disabled={ocupado}>{ocupado ? "Excluindo…" : "Excluir de vez"}</Botao>
            </div>
          </div>
        </form>
      )}
    </Bloco>
  )
}
