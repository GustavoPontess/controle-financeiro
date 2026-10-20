// Contas fixas da casa (/familias/:id/contas-fixas; passo 4 do espaço da família): as contas fixas que os membros
// marcaram "Dividir com {família}" (aluguel, luz, escola do Theo). Cada cobrança nasce dividida pela regra da família
// naquele mês. A linha diz quem paga, o dia, se a cobrança do mês já saiu e a sua parte. A conta de onde sai é de
// quem paga (os outros não veem); pausar/cancelar fica na conta fixa de quem criou.
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import { getContasFixasFamilia } from "../services/familiaService"
import { usePeriodoFamilia } from "../estado/espaco"
import type { ContaFixaDaCasa } from "../types/Familia"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import { AcoesFicha, DadosFicha, GrupoFicha, InicialFicha, ItemFicha, ListaFicha } from "../componentes/ListaFicha"
import NavegadorMes, { nomeDoPeriodo } from "../componentes/NavegadorMes"
import { primeiroNome } from "../dominio/familia"
import { Alerta, diaMes, fotosDe, papeisDe, useFamilia } from "./FamiliaPecas"
import styles from "./Familia.module.css"

export default function FamiliaContasFixas() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const meuId = usuario?.id ?? ""
  const { detalhe, erro } = useFamilia(id, 0)
  const [periodo, setPeriodo] = usePeriodoFamilia()
  const [contas, setContas] = useState<ContaFixaDaCasa[] | null>(null)

  useEffect(() => {
    let vivo = true
    setContas(null)
    getContasFixasFamilia(id, periodo.mes, periodo.ano).then((c) => { if (vivo) setContas(c) }).catch(() => { if (vivo) setContas([]) })
    return () => { vivo = false }
  }, [id, periodo])

  if (erro) return <div className={styles.pagina}><Alerta erro={erro} /></div>
  if (!detalhe) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>

  const { podeAgir } = papeisDe(detalhe, meuId)
  const aqui = `/familias/${detalhe.id}/contas-fixas`
  const mesNome = nomeDoPeriodo(periodo)
  const fotos = fotosDe(detalhe)
  const nova = () => navigate("/contas-fixas/nova", { state: { voltarPara: aqui, familiaId: detalhe.id } })

  return (
    <div className={styles.pagina}>
      <NavegadorMes periodo={periodo} onChange={setPeriodo} />
      <Bloco semRespiro>
        {contas === null ? <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
          : contas.length === 0 ? (
            <div className={styles.vazioAcao}>
              <p className={styles.vazio}>Nenhuma conta fixa da casa.</p>
              {podeAgir && <Botao variante="primario" onClick={nova}>Nova conta fixa</Botao>}
            </div>
          ) : (
            <ListaFicha rotulo="Contas fixas da casa">
              <GrupoFicha rotulo={mesNome} extra={podeAgir ? <button type="button" className={styles.linkFicha} onClick={nova}>Nova</button> : undefined}>
                {contas.map((c) => <ContaFixa key={c.recorrenteId} c={c} foto={fotos[c.pagadorUsuarioId]} />)}
              </GrupoFicha>
            </ListaFicha>
          )}
      </Bloco>
    </div>
  )
}

function ContaFixa({ c, foto }: { c: ContaFixaDaCasa; foto?: string }) {
  const [aberto, setAberto] = useState(false)
  const quem = c.ehMinha ? "Você paga" : `${primeiroNome(c.pagadorNome)} paga`
  const situacao = c.cobrancaData == null ? <Etiqueta>Sem cobrança no mês</Etiqueta>
    : c.cobrancaPaga ? <Etiqueta tom="positivo">Saiu dia {diaMes(c.cobrancaData)}</Etiqueta>
    : <Etiqueta tom="alerta">Vem dia {diaMes(c.cobrancaData)}</Etiqueta>
  return (
    <ItemFicha id={`fixa-${c.recorrenteId}`} aberto={aberto} aoAbrir={() => setAberto((a) => !a)}
      marca={<InicialFicha texto={c.pagadorNome} destaque={c.ehMinha} foto={foto} />}
      titulo={c.descricao}
      detalhe={<>{quem} · todo dia {c.dia}{c.categoriaNome ? ` · ${c.categoriaNome}` : ""}</>}
      direita={<span className={styles.direita}>{situacao}<span className={styles.valorComParte}>
        <Dinheiro valor={c.valor} className={styles.valor} />
        {c.minhaParte != null && c.minhaParte !== c.valor && <span className={styles.parte}>sua parte <Dinheiro valor={c.minhaParte} /></span>}
      </span></span>}>
      <DadosFicha>
        <div><dt>Quem paga</dt><dd>{c.ehMinha ? `${primeiroNome(c.pagadorNome)} (você)` : c.pagadorNome}</dd></div>
        <div><dt>Dia</dt><dd>Todo dia {c.dia}</dd></div>
        <div><dt>Categoria</dt><dd>{c.categoriaNome ?? "Sem categoria"}</dd></div>
        {c.minhaParte != null && <div><dt>Sua parte</dt><dd><Dinheiro valor={c.minhaParte} /></dd></div>}
      </DadosFicha>
      {c.ehMinha && <AcoesFicha><Link to={`/contas-fixas/${c.recorrenteId}`} className={styles.linkFicha}>Abrir a conta fixa</Link></AcoesFicha>}
    </ItemFicha>
  )
}
