// Dependentes da família (/familias/:id/dependentes): filhos, pais, pets, quem não usa o app mas tem gasto
// que a família acompanha. A ficha mostra o gasto do mês (o mês do espaço) e o nascimento.
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import { getDependentes } from "../services/familiaService"
import { usePeriodoFamilia } from "../estado/espaco"
import type { Dependente } from "../types/Familia"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import { GrupoFicha, ListaFicha } from "../componentes/ListaFicha"
import { nomeDoPeriodo } from "../componentes/NavegadorMes"
import { Alerta, DependenteLinha, papeisDe, useFamilia } from "./FamiliaPecas"
import styles from "./Familia.module.css"

export default function FamiliaDependentes() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const meuId = usuario?.id ?? ""
  const [versao, setVersao] = useState(0)
  const recarregar = () => setVersao((v) => v + 1)
  const { detalhe, erro } = useFamilia(id, versao)
  const [periodo] = usePeriodoFamilia()
  const [dependentes, setDependentes] = useState<Dependente[] | null>(null)

  useEffect(() => {
    let vivo = true
    getDependentes(id).then((d) => { if (vivo) setDependentes(d) }).catch(() => { if (vivo) setDependentes([]) })
    return () => { vivo = false }
  }, [id, versao])

  if (erro) return <div className={styles.pagina}><Alerta erro={erro} /></div>
  if (!detalhe) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>

  const { podeAgir } = papeisDe(detalhe, meuId)
  const mesMin = nomeDoPeriodo(periodo).toLowerCase()
  const novo = () => navigate(`/familias/${detalhe.id}/dependentes/novo`)

  return (
    <div className={styles.pagina}>
      <Bloco semRespiro>
        {dependentes === null ? <div className={styles.respiro}><Esqueleto linhas={2} altura={18} /></div>
          : dependentes.length === 0 ? (
            <div className={styles.vazioAcao}>
              <p className={styles.vazio}>Filhos, pais, pets: quem não usa o app mas tem gasto que a família acompanha.</p>
              {podeAgir && <Botao variante="primario" onClick={novo}>Adicionar</Botao>}
            </div>
          ) : (
            <ListaFicha rotulo="Dependentes">
              <GrupoFicha rotulo="Dependentes da família" extra={podeAgir ? <button type="button" className={styles.linkFicha} onClick={novo}>Adicionar</button> : undefined}>
                {dependentes.map((d) => <DependenteLinha key={d.id} d={d} familiaId={detalhe.id} periodo={periodo} mesNome={mesMin} podeAgir={podeAgir} aoMudar={recarregar} />)}
              </GrupoFicha>
            </ListaFicha>
          )}
      </Bloco>
    </div>
  )
}
