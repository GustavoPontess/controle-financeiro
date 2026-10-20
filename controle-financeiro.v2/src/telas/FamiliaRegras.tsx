// Regras da família (/familias/:id/regras): como divide, se pede OK pra despesa grande e, pra quem criou, dissolver.
// Sair fica na página da própria pessoa (Membros).
import { useState } from "react"
import { useParams } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import { Alerta, Regras, SairOuDissolver, papeisDe, useFamilia } from "./FamiliaPecas"
import styles from "./Familia.module.css"

export default function FamiliaRegras() {
  const { id = "" } = useParams<{ id: string }>()
  const { usuario } = useAuth()
  const meuId = usuario?.id ?? ""
  const [versao, setVersao] = useState(0)
  const { detalhe, erro } = useFamilia(id, versao)

  if (erro) return <div className={styles.pagina}><Alerta erro={erro} /></div>
  if (!detalhe) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>

  const { eu, souCriador } = papeisDe(detalhe, meuId)
  return (
    <div className={styles.pagina}>
      <Regras familia={detalhe} aoMudar={() => setVersao((v) => v + 1)} />
      {souCriador && <SairOuDissolver familia={detalhe} eu={eu} souCriador />}
    </div>
  )
}
