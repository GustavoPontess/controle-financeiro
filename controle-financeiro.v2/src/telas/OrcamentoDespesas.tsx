// Despesas do Orçamento (/orcamento, seção que era a tela Limites): quanto a pessoa PLANEJA gastar por mês em cada
// categoria e quanto já foi. O planejado VALE TODO MÊS até ela mudar (decisão do Gustavo 2026-10-19, como o Monarch);
// pôr, mudar e tirar valem do mês em diante e o mês passado fica como estava (só mostra). No topo da seção, os três
// números das categorias planejadas: planejado, gasto e quanto sobra (ou passou). A lista vem com quem precisa de
// atenção primeiro (passou, perto do planejado) e, embaixo, as categorias que gastaram sem planejado, com "Planejar".
// O gasto inclui a parcela do mês das compras parceladas (regra única no servidor). O que ainda vem (conta fixa
// prevista) entra na resposta e na situação ("Vai passar"), listrado na barra, e na ficha com link pra conta fixa;
// nunca no número da sobra. O mês vem da página; mudou o planejado, `aoMudar` refaz o "a ser alocado".
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { getLimitesDoMes, tirarLimite } from "../services/limiteService"
import { mensagemDeErro } from "../api/cliente"
import type { GastoSemLimite, LimiteDoMes, LimitesDoMes } from "../types/Limite"
import BarraProgresso from "../componentes/BarraProgresso"
import { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import { AcoesFicha, DadosFicha, GrupoFicha, InicialFicha, ItemFicha, ListaFicha } from "../componentes/ListaFicha"
import ListaAindaVem from "../componentes/ListaAindaVem"
import Resposta from "../componentes/Resposta"
import { nomeDoPeriodo, type Periodo } from "../componentes/NavegadorMes"
import styles from "./OrcamentoDespesas.module.css"

const chaveDe = (categoriaId: string | null, semLimite = false) => `${semLimite ? "sem" : "lim"}-${categoriaId ?? "todos"}`

/** `abrir`: a linha que volta aberta do formulário (só no primeiro mês mostrado). */
export default function OrcamentoDespesas({ periodo, abrir, aoMudar }: { periodo: Periodo; abrir?: string; aoMudar?: () => void }) {
  const navigate = useNavigate()
  const [dados, setDados] = useState<LimitesDoMes | null>(null)
  const [erro, setErro] = useState(false)
  const [aberta, setAberta] = useState<string | null>(abrir ?? null)
  const [primeiro] = useState(periodo)

  useEffect(() => {
    let vivo = true
    setDados(null); setErro(false)
    if (periodo !== primeiro) setAberta(null)
    getLimitesDoMes(periodo.ano, periodo.mes).then((d) => { if (vivo) setDados(d) }).catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [periodo, primeiro])

  const sobra = dados ? dados.totalLimite - dados.totalGasto : undefined
  const novo = (categoriaId?: string | null) => navigate(
    `/orcamento/planejar?ano=${periodo.ano}&mes=${periodo.mes}${categoriaId ? `&categoria=${categoriaId}` : ""}`)
  const vazio = useMemo(() => !!dados && dados.limites.length === 0 && dados.semLimite.length === 0, [dados])
  // "Planejar categoria" vai na linha do cabeçalho do primeiro grupo (pedido do Gustavo); sem grupo nenhum, numa barra só dele.
  const botaoNovo = dados?.editavel ? (
    <span className={styles.acaoGrupo}>
      <Botao compactoNoCelular onClick={() => novo()} icone={<Plus size={15} strokeWidth={2.5} aria-hidden="true" />}>Planejar categoria</Botao>
    </span>
  ) : undefined

  const mudou = (d: LimitesDoMes) => { setDados(d); aoMudar?.() }

  return (
    <>
      <div className={styles.resumo}>
        <div className={styles.numeros}>
          <Numero rotulo="Planejado" valor={dados?.totalLimite} />
          <Numero rotulo="Gasto" valor={dados?.totalGasto} />
          <Numero rotulo={sobra !== undefined && sobra < 0 ? "Passou" : "Sobra"} valor={sobra === undefined ? undefined : Math.abs(sobra)}
            tom={sobra !== undefined && sobra < 0 ? "negativo" : undefined} />
        </div>
      </div>
      {vazio && botaoNovo && <div className={styles.toolbar}>{botaoNovo}</div>}
      {dados === null && !erro ? <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
        : erro ? <p className={styles.vazio} role="alert">Não deu pra carregar as despesas.</p>
        : vazio ? <p className={styles.vazio}>Nenhum planejado nem gasto em {nomeDoPeriodo(periodo).toLowerCase()}.</p>
        : (
          <ListaFicha rotulo="Despesas">
            {dados!.limites.length > 0 && (
              <GrupoFicha rotulo="Planejadas" extra={botaoNovo}>
                {dados!.limites.map((l) => (
                  <Linha key={chaveDe(l.categoriaId)} l={l} periodo={periodo} editavel={dados!.editavel}
                    aberta={aberta === chaveDe(l.categoriaId)} aoAbrir={() => setAberta((a) => a === chaveDe(l.categoriaId) ? null : chaveDe(l.categoriaId))}
                    aoMudar={mudou} />
                ))}
              </GrupoFicha>
            )}
            {dados!.semLimite.length > 0 && (
              <GrupoFicha rotulo="Sem planejado" extra={dados!.limites.length === 0 ? botaoNovo : undefined}>
                {dados!.semLimite.map((s) => (
                  <SemLimite key={chaveDe(s.categoriaId, true)} s={s} editavel={dados!.editavel}
                    aberta={aberta === chaveDe(s.categoriaId, true)}
                    aoAbrir={() => setAberta((a) => a === chaveDe(s.categoriaId, true) ? null : chaveDe(s.categoriaId, true))}
                    aoPor={() => novo(s.categoriaId)} />
                ))}
              </GrupoFicha>
            )}
          </ListaFicha>
        )}
    </>
  )
}

function Numero({ rotulo, valor, tom }: { rotulo: string; valor?: number; tom?: "negativo" }) {
  return (
    <div className={styles.numero}>
      <span className={styles.rotulo}>{rotulo}</span>
      {valor === undefined ? <span className={styles.numeroEsqueleto} aria-hidden="true" /> : <Dinheiro valor={valor} className={styles.numeroValor} tom={tom} />}
    </div>
  )
}

const ETIQUETA: Record<LimiteDoMes["situacao"], { rotulo: string; tom: "negativo" | "alerta" } | null> = {
  passou: { rotulo: "Passou", tom: "negativo" },
  "vai-passar": { rotulo: "Vai passar", tom: "alerta" },
  perto: { rotulo: "Perto do planejado", tom: "alerta" },
  ok: null,
}
const TOM_RESPOSTA: Record<LimiteDoMes["situacao"], "negativo" | "alerta" | "neutro"> = {
  passou: "negativo", "vai-passar": "alerta", perto: "alerta", ok: "neutro",
}

/** Uma categoria planejada: a linha (categoria, gasto do planejado, situação, sobra e a barra) e a ficha com os números e as ações. */
function Linha({ l, periodo, editavel, aberta, aoAbrir, aoMudar }: {
  l: LimiteDoMes
  periodo: Periodo
  editavel: boolean
  aberta: boolean
  aoAbrir: () => void
  aoMudar: (d: LimitesDoMes) => void
}) {
  const navigate = useNavigate()
  const [tirando, setTirando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const etiqueta = ETIQUETA[l.situacao]
  const passou = l.sobra < 0
  const mesNome = nomeDoPeriodo(periodo).toLowerCase()
  const tirar = async () => {
    setOcupado(true); setErro(null)
    try { aoMudar(await tirarLimite(l.categoriaId, periodo.ano, periodo.mes)) }
    catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setTirando(false) }
  }

  return (
    <ItemFicha id={chaveDe(l.categoriaId)} aberto={aberta} aoAbrir={aoAbrir}
      marca={<InicialFicha texto={l.categoria} />}
      titulo={l.categoria}
      detalhe={<><Dinheiro valor={l.gasto} /> de <Dinheiro valor={l.limite} />{l.previsto > 0 && <> · <Dinheiro valor={l.previsto} /> ainda vem</>}</>}
      direita={
        <span className={styles.direita}>
          <span className={styles.direitaTopo}>
            {etiqueta && <Etiqueta tom={etiqueta.tom}>{etiqueta.rotulo}</Etiqueta>}
            {/* A etiqueta já diz "Passou": aqui só quanto (a mais ou o que sobra). */}
            <span className={styles.sobra} data-passou={passou || undefined}>{passou ? <><Dinheiro valor={Math.abs(l.sobra)} /> a mais</> : <>sobra <Dinheiro valor={l.sobra} /></>}</span>
          </span>
          <span className={styles.barra}>
            <BarraProgresso fracao={l.limite > 0 ? l.gasto / l.limite : 0} fracaoAVir={l.limite > 0 ? l.previsto / l.limite : 0}
              tom={l.situacao === "perto" || l.situacao === "vai-passar" ? "alerta" : undefined}
              rotulo={`${Math.round(l.percentual)}% do planejado gasto`} />
          </span>
        </span>
      }>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      <DadosFicha>
        <div><dt>Planejado por mês</dt><dd><Dinheiro valor={l.limite} /></dd></div>
        <div><dt>Gasto</dt><dd><Dinheiro valor={l.gasto} /></dd></div>
        <div><dt>{passou ? "Passou" : "Sobra"}</dt><dd><Dinheiro valor={Math.abs(l.sobra)} tom={passou ? "negativo" : undefined} /></dd></div>
        <div><dt>Vale desde</dt><dd>{nomeDoPeriodo({ ano: l.desdeAno, mes: l.desdeMes }).toLowerCase()}</dd></div>
        {l.parcelasFuturas > 0 && l.parcelasAteAno && l.parcelasAteMes && (
          <div><dt>Parcelas já compradas pros próximos meses</dt>
            <dd><Dinheiro valor={l.parcelasFuturas} /> até {nomeDoPeriodo({ ano: l.parcelasAteAno, mes: l.parcelasAteMes }).toLowerCase()}</dd></div>
        )}
      </DadosFicha>
      {l.aindaVem.length > 0 && (
        <div className={styles.vem}>
          <span className={styles.vemTitulo}>Ainda vem este mês</span>
          <ListaAindaVem itens={l.aindaVem} semCategoria={l.categoriaId !== null} />
        </div>
      )}
      {l.resposta && <div className={styles.resposta}><Resposta tom={TOM_RESPOSTA[l.situacao]} texto={l.resposta} /></div>}
      {editavel && (
        <AcoesFicha>
          <Botao perigo disabled={ocupado} onClick={() => setTirando(true)} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Tirar do planejado</Botao>
          <Botao variante="primario" disabled={ocupado} icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />}
            onClick={() => navigate(`/orcamento/editar?ano=${periodo.ano}&mes=${periodo.mes}${l.categoriaId ? `&categoria=${l.categoriaId}` : ""}`)}>Editar</Botao>
        </AcoesFicha>
      )}
      <Confirmar aberto={tirando} perigo ocupado={ocupado} titulo={`Tirar ${l.categoria} do planejado?`}
        texto={`Sai de ${mesNome} em diante. Os meses passados continuam com o planejado.`}
        rotuloConfirmar="Tirar do planejado" onConfirmar={() => void tirar()} onCancelar={() => setTirando(false)} />
    </ItemFicha>
  )
}

/** Categoria que gastou no mês sem planejado: a ficha oferece "Planejar". */
function SemLimite({ s, editavel, aberta, aoAbrir, aoPor }: {
  s: GastoSemLimite
  editavel: boolean
  aberta: boolean
  aoAbrir: () => void
  aoPor: () => void
}) {
  return (
    <ItemFicha id={chaveDe(s.categoriaId, true)} aberto={aberta} aoAbrir={aoAbrir}
      marca={<InicialFicha texto={s.categoria} />}
      titulo={s.categoria}
      direita={<Dinheiro valor={s.gasto} className={styles.valor} />}>
      <DadosFicha>
        <div><dt>Gasto</dt><dd><Dinheiro valor={s.gasto} /></dd></div>
      </DadosFicha>
      {editavel && s.categoriaId && (
        <AcoesFicha>
          <Botao variante="primario" onClick={aoPor} icone={<Plus size={15} strokeWidth={2.25} aria-hidden="true" />}>Planejar</Botao>
        </AcoesFicha>
      )}
    </ItemFicha>
  )
}
