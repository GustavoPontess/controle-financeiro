// Nova família (/familias/nova): só o nome. Quem cria é o admin; convida os outros na página da família.
import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { criarFamilia } from "../services/familiaService"
import { mensagemDeErro } from "../api/cliente"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import Formulario, { Campos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import { MAX_NOME_FAMILIA } from "../dominio/familia"
import { recarregarEspacos } from "../estado/espaco"
import styles from "./Familia.module.css"

export default function NovaFamilia() {
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? "/dashboard"
  const [nome, setNome] = useState("")
  const [erroNome, setErroNome] = useState<string | undefined>()
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const enviar = async () => {
    setErro(null)
    if (!nome.trim()) { setErroNome("Dê um nome pra família."); return }
    setSalvando(true)
    try {
      const f = await criarFamilia(nome.trim())
      void recarregarEspacos()
      navigate(`/familias/${f.id}`, { replace: true })
    } catch (e) { setErro(mensagemDeErro(e)); setSalvando(false) }
  }

  return (
    <PaginaFormulario titulo="Nova família">
      <Formulario onSubmit={() => { void enviar() }}>
        <Campos>
          {erro && <p className={styles.alerta} role="alert">{erro}</p>}
          <Campo rotulo="Nome" erro={erroNome}>
            <Entrada value={nome} maxLength={MAX_NOME_FAMILIA} placeholder="Casa, Família Silva, Apê 302" autoFocus
              onChange={(e) => { setNome(e.target.value); setErroNome(undefined) }} />
          </Campo>
        </Campos>
        <RodapeFormulario>
          <Botao onClick={() => navigate(voltarPara, { replace: true })} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Criando…" : "Criar família"}</Botao>
        </RodapeFormulario>
      </Formulario>
    </PaginaFormulario>
  )
}
