// Página de quem é da casa sem conta (/familias/:id/dependentes/:depId): filho, pai, pet. Quem é (tipo, idade,
// nascimento), o gasto do mês atribuído a ele e, pra quem lança, editar e tirar da família (com confirmação).
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Pencil, Trash2 } from "lucide-react"
import { useAuth } from "../auth/useAuth"
import { getDependentes, getGastoDependente, inativarDependente } from "../services/familiaService"
import { mensagemDeErro } from "../api/cliente"
import { usePeriodoFamilia } from "../estado/espaco"
import type { Dependente } from "../types/Familia"
import Avatar from "../componentes/Avatar"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import NavegadorMes from "../componentes/NavegadorMes"
import { rotuloTipoDependente } from "../dominio/familia"
import { dataBR } from "../utils/dateTime"
import { Alerta, idade, papeisDe, useFamilia } from "./FamiliaPecas"
import styles from "./Familia.module.css"

export default function FamiliaDependente() {
  const { id = "", depId = "" } = useParams<{ id: string; depId: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { detalhe, erro: erroFamilia } = useFamilia(id, 0)
  const [periodo, setPeriodo] = usePeriodoFamilia()
  const [dep, setDep] = useState<Dependente | null | undefined>(undefined)
  const [gasto, setGasto] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [tirando, setTirando] = useState(false)

  useEffect(() => {
    let vivo = true
    getDependentes(id).then((ds) => { if (vivo) setDep(ds.find((d) => d.id === depId) ?? null) }).catch(() => { if (vivo) setDep(null) })
    return () => { vivo = false }
  }, [id, depId])

  useEffect(() => {
    let vivo = true
    setGasto(null)
    getGastoDependente(id, depId, periodo.mes, periodo.ano).then((g) => { if (vivo) setGasto(g.total) }).catch(() => { /* sem o gasto */ })
    return () => { vivo = false }
  }, [id, depId, periodo])

  if (erroFamilia) return <div className={styles.pagina}><Alerta erro={erroFamilia} /></div>
  if (!detalhe || dep === undefined) return <div className={styles.pagina}><Bloco><Esqueleto linhas={4} altura={16} /></Bloco></div>
  const membros = `/familias/${id}/membros`
  if (dep === null) {
    return <div className={styles.pagina}><Bloco><p className={styles.vazio}>Essa pessoa não está mais na família. <Link to={membros} className={styles.linkFicha}>Ver os membros</Link></p></Bloco></div>
  }

  const { podeAgir } = papeisDe(detalhe, usuario?.id ?? "")
  const anos = dep.dataNascimento ? idade(dep.dataNascimento) : null
  const tirar = async () => {
    setOcupado(true); setErro(null)
    try { await inativarDependente(id, dep.id); navigate(membros, { replace: true }) }
    catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setTirando(false) }
  }

  return (
    <div className={styles.pagina}>
      <Alerta erro={erro} />
      <Bloco>
        <div className={styles.pessoaTopo}>
          <Avatar className={styles.pessoaFoto} texto={dep.nome.trim().charAt(0).toUpperCase() || "?"} />
          <div className={styles.pessoaTexto}>
            <h2 className={styles.pessoaNome}>{dep.apelido ? `${dep.nome} (${dep.apelido})` : dep.nome}</h2>
            <span className={styles.pessoaSub}>
              {rotuloTipoDependente(dep.tipo)}{anos !== null && ` · ${anos} ${anos === 1 ? "ano" : "anos"}`}{dep.dataNascimento && ` · nasceu em ${dataBR(dep.dataNascimento.slice(0, 10))}`}
            </span>
          </div>
          <Etiqueta>Sem conta</Etiqueta>
        </div>
        {podeAgir && (
          <div className={styles.pessoaAcoes}>
            <Botao variante="texto" perigo disabled={ocupado} onClick={() => setTirando(true)} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Tirar da família</Botao>
            <Botao onClick={() => navigate(`/familias/${id}/dependentes/${dep.id}/editar`)} icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />}>Editar</Botao>
          </div>
        )}
      </Bloco>

      <NavegadorMes periodo={periodo} onChange={setPeriodo} />
      <Bloco titulo="Gasto no mês">
        <div className={styles.perfil}>
          {gasto === null ? <Esqueleto linhas={1} altura={22} /> : <Dinheiro valor={gasto} className={styles.grande} />}
        </div>
      </Bloco>

      <Confirmar aberto={tirando} perigo ocupado={ocupado} titulo={`Tirar ${dep.nome} da família?`} texto="Os lançamentos já atribuídos continuam no histórico."
        rotuloConfirmar="Tirar" onConfirmar={() => { void tirar() }} onCancelar={() => setTirando(false)} />
    </div>
  )
}
