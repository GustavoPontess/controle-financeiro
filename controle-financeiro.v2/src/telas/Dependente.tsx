// Dependente da família, novo (/familias/:id/dependentes/novo) e editar (/familias/:id/dependentes/:depId/editar):
// quem não usa o app mas tem gasto que a família acompanha (filho, pai idoso, pet). Nome, apelido, nascimento
// e tipo. Mesmas regras do servidor: nome até 120, apelido até 60.
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { atualizarDependente, criarDependente, getDependentes } from "../services/familiaService"
import { mensagemDeErro } from "../api/cliente"
import type { Dependente as DependenteT, TipoDependente } from "../types/Familia"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import Formulario, { Campos, LinhaCampos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import Segmentos from "../componentes/Segmentos"
import SeletorData from "../componentes/SeletorData"
import { TIPOS_DEPENDENTE } from "../dominio/familia"
import { dataLocalISO } from "../utils/dateTime"
import styles from "./Familia.module.css"

export default function Dependente() {
  const { id = "", depId } = useParams<{ id: string; depId?: string }>()
  const navigate = useNavigate()
  const [dependente, setDependente] = useState<DependenteT | null>(null)
  const [carregando, setCarregando] = useState(!!depId)
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  useEffect(() => {
    if (!depId) return
    let vivo = true
    getDependentes(id)
      .then((ds) => { if (!vivo) return; const d = ds.find((x) => x.id === depId); if (d) setDependente(d); else setErroCarga("Dependente não encontrado.") })
      .catch(() => { if (vivo) setErroCarga("Não deu pra carregar o dependente. Recarregue a página.") })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [id, depId])

  return (
    <PaginaFormulario titulo={depId ? "Editar dependente" : "Novo dependente"} carregando={carregando} erroCarga={erroCarga}>
      {(!depId || dependente) && (
        <FormularioDependente familiaId={id} dependente={dependente ?? undefined} aoSair={() => navigate(`/familias/${id}/dependentes`, { replace: true })} />
      )}
    </PaginaFormulario>
  )
}

type Erros = Partial<Record<"nome" | "nascimento", string>>

function FormularioDependente({ familiaId, dependente, aoSair }: { familiaId: string; dependente?: DependenteT; aoSair: () => void }) {
  const hoje = dataLocalISO()
  const [nome, setNome] = useState(dependente?.nome ?? "")
  const [apelido, setApelido] = useState(dependente?.apelido ?? "")
  const [nascimento, setNascimento] = useState(dependente?.dataNascimento?.slice(0, 10) ?? "")
  const [tipo, setTipo] = useState(String(dependente?.tipo ?? 1))
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const enviar = async () => {
    setErro(null)
    const e: Erros = {}
    if (!nome.trim()) e.nome = "Diga o nome."
    if (nascimento && nascimento > hoje) e.nascimento = "Nascimento não pode ser no futuro."
    setErros(e)
    if (Object.keys(e).length > 0) return
    setSalvando(true)
    const dto = { nome: nome.trim(), apelido: apelido.trim() || null, dataNascimento: nascimento || null, tipo: Number(tipo) as TipoDependente }
    try {
      if (dependente) await atualizarDependente(familiaId, dependente.id, dto)
      else await criarDependente(familiaId, dto)
      aoSair()
    } catch (err) { setErro(mensagemDeErro(err)); setSalvando(false) }
  }

  return (
    <Formulario onSubmit={() => { void enviar() }}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <Segmentos ariaLabel="Tipo" cheio valor={tipo} onChange={setTipo} opcoes={TIPOS_DEPENDENTE.map((t) => ({ valor: String(t.valor), rotulo: t.rotulo }))} />
        <LinhaCampos>
          <Campo rotulo="Nome" erro={erros.nome}>
            <Entrada value={nome} maxLength={120} placeholder={tipo === "3" ? "Bolt" : "Theo"} autoFocus={!dependente}
              onChange={(e) => { setNome(e.target.value); setErros((x) => ({ ...x, nome: undefined })) }} />
          </Campo>
          <Campo rotulo="Apelido">
            <Entrada value={apelido} maxLength={60} placeholder="Opcional" onChange={(e) => setApelido(e.target.value)} />
          </Campo>
        </LinhaCampos>
        <Campo rotulo="Nascimento" erro={erros.nascimento}>
          <SeletorData valor={nascimento} max={hoje} limpavel onChange={(v) => { setNascimento(v); setErros((x) => ({ ...x, nascimento: undefined })) }} />
        </Campo>
      </Campos>
      <RodapeFormulario>
        <Botao onClick={aoSair} disabled={salvando}>Cancelar</Botao>
        <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Salvando…" : dependente ? "Salvar" : "Adicionar"}</Botao>
      </RodapeFormulario>
    </Formulario>
  )
}
