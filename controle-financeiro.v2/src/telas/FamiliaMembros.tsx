// Membros da família (/familias/:id/membros): quem está (a sua ficha tem relação, renda do mês e "quem vê a
// sua renda": uma caixa por pessoa; a dos outros só mostra renda se a pessoa liberou pra você) e os convites
// pendentes. Admin convida, promove, rebaixa e remove (nunca o criador).
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import { getRendaFamilia } from "../services/rendaService"
import { usePeriodoFamilia } from "../estado/espaco"
import type { RendaFamilia } from "../types/Renda"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import { GrupoFicha, ListaFicha } from "../componentes/ListaFicha"
import { nomeDoPeriodo } from "../componentes/NavegadorMes"
import { Alerta, Convite, Membro, papeisDe, useFamilia } from "./FamiliaPecas"
import styles from "./Familia.module.css"

export default function FamiliaMembros() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const meuId = usuario?.id ?? ""
  const [versao, setVersao] = useState(0)
  const recarregar = () => setVersao((v) => v + 1)
  const { detalhe, erro } = useFamilia(id, versao)
  const [periodo] = usePeriodoFamilia()
  const [renda, setRenda] = useState<RendaFamilia | null>(null)

  useEffect(() => {
    let vivo = true
    getRendaFamilia(id, periodo.ano, periodo.mes).then((r) => { if (vivo) setRenda(r) }).catch(() => { /* sem a linha de renda */ })
    return () => { vivo = false }
  }, [id, periodo, versao])

  if (erro) return <div className={styles.pagina}><Alerta erro={erro} /></div>
  if (!detalhe) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>

  const { admin } = papeisDe(detalhe, meuId)
  const mesMin = nomeDoPeriodo(periodo).toLowerCase()

  return (
    <div className={styles.pagina}>
      <Bloco semRespiro>
        <ListaFicha rotulo="Membros">
          <GrupoFicha rotulo="Quem está" extra={admin ? <button type="button" className={styles.linkFicha} onClick={() => navigate(`/familias/${detalhe.id}/convidar`)}>Convidar</button> : undefined}>
            {[...detalhe.membros].sort((a, b) => Number(b.usuarioId === meuId) - Number(a.usuarioId === meuId)).map((m) => (
              <Membro key={m.id} m={m} familia={detalhe} meuId={meuId} mesNome={mesMin}
                renda={renda?.membros.find((r) => r.usuarioId === m.usuarioId)} aoMudar={recarregar} />
            ))}
          </GrupoFicha>
          {detalhe.convitesPendentes.length > 0 && (
            <GrupoFicha rotulo="Convites pendentes">
              {detalhe.convitesPendentes.map((c) => <Convite key={c.id} c={c} familiaId={detalhe.id} admin={admin} aoMudar={recarregar} />)}
            </GrupoFicha>
          )}
        </ListaFicha>
      </Bloco>
    </div>
  )
}
