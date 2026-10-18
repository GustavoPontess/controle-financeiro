// Visão geral da família (/familias/:id, a primeira página do espaço): o mês em um bloco (despesas da
// família, renda da casa de quem liberou, quem pagou o quê, o que falta pra equilibrar, o que já passou entre
// vocês) e, embaixo, só o que pede ação: despesas aguardando aprovação.
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import { getAcertos, getBalancoFamilia, getDespesasFamilia } from "../services/familiaService"
import { getRendaFamilia } from "../services/rendaService"
import { usePeriodoFamilia } from "../estado/espaco"
import type { AcertoContas, BalancoFamilia, DespesaCompartilhada } from "../types/Familia"
import type { RendaFamilia } from "../types/Renda"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import { GrupoFicha, ListaFicha } from "../componentes/ListaFicha"
import NavegadorMes, { nomeDoPeriodo } from "../componentes/NavegadorMes"
import { APROVACAO, primeiroNome } from "../dominio/familia"
import { Acerto, Alerta, Despesa, Equilibrio, FaixaMes, Saldos, papeisDe, useFamilia } from "./FamiliaPecas"
import styles from "./Familia.module.css"

export default function FamiliaVisaoGeral() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const meuId = usuario?.id ?? ""
  const [versao, setVersao] = useState(0)
  const recarregar = () => setVersao((v) => v + 1)
  const { detalhe, erro } = useFamilia(id, versao)
  const [periodo, setPeriodo] = usePeriodoFamilia()
  const [balanco, setBalanco] = useState<BalancoFamilia | null>(null)
  const [despesas, setDespesas] = useState<DespesaCompartilhada[] | null>(null)
  const [acertos, setAcertos] = useState<AcertoContas[] | null>(null)
  // Renda da casa: calculada no servidor pra quem pede (só entra quem liberou o valor pra essa pessoa).
  const [renda, setRenda] = useState<RendaFamilia | null>(null)

  useEffect(() => {
    let vivo = true
    setBalanco(null); setDespesas(null); setAcertos(null)
    getBalancoFamilia(id, periodo.mes, periodo.ano).then((b) => { if (vivo) setBalanco(b) }).catch(() => { /* sem balanço */ })
    getDespesasFamilia(id, periodo.mes, periodo.ano).then((d) => { if (vivo) setDespesas(d) }).catch(() => { if (vivo) setDespesas([]) })
    getAcertos(id, periodo.mes, periodo.ano).then((a) => { if (vivo) setAcertos(a) }).catch(() => { if (vivo) setAcertos([]) })
    getRendaFamilia(id, periodo.ano, periodo.mes).then((r) => { if (vivo) setRenda(r) }).catch(() => { /* sem a faixa */ })
    return () => { vivo = false }
  }, [id, periodo, versao])

  if (erro) return <div className={styles.pagina}><Alerta erro={erro} /></div>
  if (!detalhe) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>

  const { admin, podeAgir } = papeisDe(detalhe, meuId)
  const aqui = `/familias/${detalhe.id}`
  const mesMin = nomeDoPeriodo(periodo).toLowerCase()
  const pendentes = (despesas ?? []).filter((d) => d.statusAprovacao === APROVACAO.pendente)
  const membrosOpcoes = detalhe.membros.map((m) => ({ valor: m.usuarioId, rotulo: primeiroNome(m.nomeUsuario) }))
  const sozinho = detalhe.membros.length === 1

  return (
    <div className={styles.pagina}>
      <NavegadorMes periodo={periodo} onChange={setPeriodo} />

      <Bloco>
        {sozinho ? (
          <div className={styles.sozinho}>
            <span>Só você por aqui.</span>
            {admin && <Botao variante="primario" onClick={() => navigate(`${aqui}/convidar`)}>Convidar</Botao>}
          </div>
        ) : balanco === null ? <Esqueleto linhas={3} altura={18} /> : (
          <div className={styles.mes}>
            <FaixaMes total={balanco.total} renda={renda} meuId={meuId} />
            {balanco.total === 0 && balanco.saldos.every((s) => s.saldo === 0) ? (
              <p className={styles.vazioMes}>Nenhuma despesa compartilhada em {mesMin}.</p>
            ) : (
              <>
                <Saldos balanco={balanco} meuId={meuId} />
                <Equilibrio balanco={balanco} familiaId={detalhe.id} podeAgir={podeAgir} voltarPara={aqui} />
              </>
            )}
            <div className={styles.entreVoces}>
              {acertos !== null && acertos.length > 0 ? (
                <ListaFicha rotulo="Entre vocês">
                  <GrupoFicha rotulo="Passou entre vocês" extra={<Botao variante="texto" onClick={() => navigate(`${aqui}/entre-voces`)}>Ver tudo</Botao>}>
                    {acertos.map((a) => <Acerto key={a.id} a={a} familiaId={detalhe.id} podeAgir={podeAgir} aoMudar={recarregar} />)}
                  </GrupoFicha>
                </ListaFicha>
              ) : (
                <>
                  <div className={styles.entreVocesTopo}>
                    <span className={styles.rotulo}>Passou entre vocês</span>
                    {podeAgir && <Botao variante="texto" onClick={() => navigate(`${aqui}/acertos/novo`, { state: { voltarPara: aqui } })}>Dinheiro entre vocês</Botao>}
                  </div>
                  {acertos === null ? <Esqueleto linhas={1} altura={18} /> : <p className={styles.vazioMes}>Nada passou entre vocês em {mesMin}.</p>}
                </>
              )}
            </div>
          </div>
        )}
      </Bloco>

      {pendentes.length > 0 && (
        <Bloco semRespiro>
          <ListaFicha rotulo="Despesas compartilhadas">
            <GrupoFicha rotulo="Aguardando aprovação" extra={<Link to={`${aqui}/despesas`} className={styles.linkFicha}>Ver todas</Link>}>
              {pendentes.map((d) => <Despesa key={d.id} d={d} familiaId={detalhe.id} meuId={meuId} podeAgir={podeAgir} membros={membrosOpcoes} voltarPara={aqui} aoMudar={recarregar} />)}
            </GrupoFicha>
          </ListaFicha>
        </Bloco>
      )}
    </div>
  )
}
