// Entre vocês (/familias/:id/entre-voces): quem pagou o quê no mês, o que falta pra equilibrar ("X → Y",
// "Marcar como feito") e o dinheiro que já passou entre vocês (com "Desfazer"). Nunca "deve", "a receber", "a acertar".
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import { getAcertos, getBalancoFamilia } from "../services/familiaService"
import { usePeriodoFamilia } from "../estado/espaco"
import type { AcertoContas, BalancoFamilia } from "../types/Familia"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import { GrupoFicha, ListaFicha } from "../componentes/ListaFicha"
import NavegadorMes, { nomeDoPeriodo } from "../componentes/NavegadorMes"
import { Acerto, Alerta, Equilibrio, Saldos, papeisDe, useFamilia } from "./FamiliaPecas"
import styles from "./Familia.module.css"

export default function FamiliaEntreVoces() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const meuId = usuario?.id ?? ""
  const [versao, setVersao] = useState(0)
  const recarregar = () => setVersao((v) => v + 1)
  const { detalhe, erro } = useFamilia(id, versao)
  const [periodo, setPeriodo] = usePeriodoFamilia()
  const [balanco, setBalanco] = useState<BalancoFamilia | null>(null)
  const [acertos, setAcertos] = useState<AcertoContas[] | null>(null)

  useEffect(() => {
    let vivo = true
    setBalanco(null); setAcertos(null)
    getBalancoFamilia(id, periodo.mes, periodo.ano).then((b) => { if (vivo) setBalanco(b) }).catch(() => { /* sem balanço */ })
    getAcertos(id, periodo.mes, periodo.ano).then((a) => { if (vivo) setAcertos(a) }).catch(() => { if (vivo) setAcertos([]) })
    return () => { vivo = false }
  }, [id, periodo, versao])

  if (erro) return <div className={styles.pagina}><Alerta erro={erro} /></div>
  if (!detalhe) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>

  const { podeAgir } = papeisDe(detalhe, meuId)
  const aqui = `/familias/${detalhe.id}/entre-voces`
  const mesNome = nomeDoPeriodo(periodo)
  const novo = () => navigate(`/familias/${detalhe.id}/acertos/novo`, { state: { voltarPara: aqui } })

  return (
    <div className={styles.pagina}>
      <NavegadorMes periodo={periodo} onChange={setPeriodo} />
      <Bloco>
        {detalhe.membros.length === 1 ? <p className={styles.vazioMes}>Só você por aqui.</p>
          : balanco === null ? <Esqueleto linhas={3} altura={18} />
          : balanco.total === 0 && balanco.saldos.every((s) => s.saldo === 0) ? <p className={styles.vazioMes}>Nenhuma despesa compartilhada em {mesNome.toLowerCase()}.</p>
          : (
            <div className={styles.mes}>
              <Saldos balanco={balanco} meuId={meuId} />
              <Equilibrio balanco={balanco} familiaId={detalhe.id} podeAgir={podeAgir} voltarPara={aqui} />
            </div>
          )}
      </Bloco>
      <Bloco titulo="Passou entre vocês" semRespiro acao={podeAgir ? "Dinheiro entre vocês" : undefined} aoClicar={novo}>
        {acertos === null ? <div className={styles.respiro}><Esqueleto linhas={2} altura={18} /></div>
          : acertos.length === 0 ? <p className={styles.vazio}>Nada passou entre vocês em {mesNome.toLowerCase()}.</p>
          : (
            <ListaFicha rotulo="Entre vocês">
              <GrupoFicha rotulo={mesNome}>
                {acertos.map((a) => <Acerto key={a.id} a={a} familiaId={detalhe.id} podeAgir={podeAgir} aoMudar={recarregar} />)}
              </GrupoFicha>
            </ListaFicha>
          )}
      </Bloco>
    </div>
  )
}
