// Despesas compartilhadas da família no mês (/familias/:id/despesas): aguardando aprovação primeiro; aprovação,
// Recusar e responsável na própria linha. Sem filtro de responsável (a linha já diz).
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import { getDespesasFamilia } from "../services/familiaService"
import { usePeriodoFamilia } from "../estado/espaco"
import type { DespesaCompartilhada } from "../types/Familia"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import { GrupoFicha, ListaFicha } from "../componentes/ListaFicha"
import NavegadorMes, { nomeDoPeriodo } from "../componentes/NavegadorMes"
import { APROVACAO, primeiroNome } from "../dominio/familia"
import { Alerta, Despesa, fotosDe, papeisDe, useFamilia } from "./FamiliaPecas"
import styles from "./Familia.module.css"

export default function FamiliaDespesas() {
  const { id = "" } = useParams<{ id: string }>()
  const { usuario } = useAuth()
  const meuId = usuario?.id ?? ""
  const [versao, setVersao] = useState(0)
  const recarregar = () => setVersao((v) => v + 1)
  const { detalhe, erro } = useFamilia(id, versao)
  const [periodo, setPeriodo] = usePeriodoFamilia()
  const [despesas, setDespesas] = useState<DespesaCompartilhada[] | null>(null)

  useEffect(() => {
    let vivo = true
    setDespesas(null)
    getDespesasFamilia(id, periodo.mes, periodo.ano).then((d) => { if (vivo) setDespesas(d) }).catch(() => { if (vivo) setDespesas([]) })
    return () => { vivo = false }
  }, [id, periodo, versao])

  if (erro) return <div className={styles.pagina}><Alerta erro={erro} /></div>
  if (!detalhe) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>

  const { podeAgir } = papeisDe(detalhe, meuId)
  const aqui = `/familias/${detalhe.id}/despesas`
  const mesNome = nomeDoPeriodo(periodo)
  const membrosOpcoes = detalhe.membros.map((m) => ({ valor: m.usuarioId, rotulo: primeiroNome(m.nomeUsuario) }))
  const pendentes = (despesas ?? []).filter((d) => d.statusAprovacao === APROVACAO.pendente)
  const doMes = (despesas ?? []).filter((d) => d.statusAprovacao !== APROVACAO.pendente)
  const fotos = fotosDe(detalhe)
  const linha = (d: DespesaCompartilhada) => <Despesa key={d.id} d={d} familiaId={detalhe.id} meuId={meuId} podeAgir={podeAgir} membros={membrosOpcoes} voltarPara={aqui} aoMudar={recarregar} foto={fotos[d.pagadorUsuarioId]} />

  return (
    <div className={styles.pagina}>
      <NavegadorMes periodo={periodo} onChange={setPeriodo} />
      <Bloco semRespiro>
        {despesas === null ? <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
          : despesas.length === 0 ? <p className={styles.vazio}>Nenhuma despesa compartilhada em {mesNome.toLowerCase()}.</p>
          : (
            <ListaFicha rotulo="Despesas compartilhadas">
              {pendentes.length > 0 && <GrupoFicha rotulo="Aguardando aprovação">{pendentes.map(linha)}</GrupoFicha>}
              {doMes.length > 0 && <GrupoFicha rotulo={mesNome}>{doMes.map(linha)}</GrupoFicha>}
            </ListaFicha>
          )}
      </Bloco>
    </div>
  )
}
