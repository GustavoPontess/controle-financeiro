// Relatórios do v2 = o check-up do mês (plano: docs/features/relatorios/plano.md). Cada seção responde uma pergunta, na
// ordem em que a pessoa pergunta: como foi o mês · o que vale olhar (os avisos das outras telas, juntos) · vai dar? (só
// no mês atual) · pra onde foi (cada categoria contra o normal) · dá pra cortar onde · quanto da renda já tem dono ·
// mês a mês · quanto tempo o que eu tenho dura. Os títulos das seções dizem o que é (pedido do Gustavo, 2026-10-29);
// a pergunta fica na frase de cada uma. A conta e as frases vêm prontas do servidor (GET /relatorios/check-up,
// /relatorios/sinais e /dinheiro-do-mes); aqui só a vitrine e os gráficos. Tocar numa categoria abre Transações
// filtrada (pela URL). Exporta os lançamentos do mês em CSV.
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Download } from "lucide-react"
import { getCheckUp, getSinais, urlCsvDoMes } from "../services/relatorioService"
import { getDinheiroDoMes } from "../services/dinheiroDoMesService"
import type { CheckUp, Sinal } from "../types/Relatorio"
import type { DinheiroDoMes } from "../types/DinheiroDoMes"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Bullet from "../componentes/Bullet"
import { Dinheiro } from "../componentes/Dinheiro"
import GraficoBarras from "../componentes/GraficoBarras"
import GraficoBarrasComparacao, { type LinhaComparacao } from "../componentes/GraficoBarrasComparacao"
import NavegadorMes, { nomeDoPeriodo, periodoDeHoje, type Periodo } from "../componentes/NavegadorMes"
import Resposta from "../componentes/Resposta"
import UsoDaRenda from "../componentes/UsoDaRenda"
import styles from "./Relatorios.module.css"

const CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const numero = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
/** O "O que vale olhar" mostra no máximo isto (Seus dados primeiro, depois os avisos na ordem do servidor). */
const MAX_AVISOS = 6
const SEM_CATEGORIA = "00000000-0000-0000-0000-000000000000"

export default function Relatorios() {
  const navigate = useNavigate()
  const hoje = periodoDeHoje()
  const [periodo, setPeriodo] = useState<Periodo>(hoje)
  const [dados, setDados] = useState<CheckUp | null>(null)
  const [avisos, setAvisos] = useState<Sinal[]>([])
  const [doMes, setDoMes] = useState<DinheiroDoMes | null>(null)
  const [erro, setErro] = useState(false)
  const ehHoje = periodo.ano === hoje.ano && periodo.mes === hoje.mes

  useEffect(() => {
    let vivo = true
    // Trocar de mês mantém o mês anterior na tela até o novo chegar (sem esqueleto: a tela piscava inteira).
    setErro(false); if (!ehHoje) setDoMes(null)
    getCheckUp(periodo.ano, periodo.mes).then((d) => { if (vivo) setDados(d) }).catch(() => { if (vivo) setErro(true) })
    getSinais(periodo.ano, periodo.mes).then((s) => { if (vivo) setAvisos(s) }).catch(() => { if (vivo) setAvisos([]) /* a seção fica só com Seus dados */ })
    if (ehHoje) getDinheiroDoMes(periodo.ano, periodo.mes).then((d) => { if (vivo) setDoMes(d) }).catch(() => { /* "Vai dar?" some */ })
    return () => { vivo = false }
  }, [periodo, ehHoje])

  const mesNome = nomeDoPeriodo(periodo).toLowerCase()
  const mesQuery = `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}`
  const verCategoria = (chave: string) => navigate(`/transacoes?categoriaId=${chave}&mes=${mesQuery}`)
  const lista = dados ? [...dados.sinais, ...avisos].slice(0, MAX_AVISOS) : []

  return (
    <div className={styles.pagina}>
      <div className={styles.topo}>
        <NavegadorMes periodo={periodo} onChange={setPeriodo} ate={hoje} />
        <a className={styles.csv} href={urlCsvDoMes(periodo.ano, periodo.mes)} download aria-label="Exportar lançamentos do mês (CSV)">
          <Download size={15} strokeWidth={2.25} aria-hidden="true" /><span className={styles.csvTexto}>Exportar lançamentos do mês (CSV)</span>
        </a>
      </div>

      {erro ? <Bloco><p className={styles.vazio} role="alert">Não deu pra carregar o check-up.</p></Bloco> : (
        <>
          {/* Como foi o mês? */}
          <Bloco className={styles.resumo}>
            {dados ? <Resposta tom={dados.resposta.tom} texto={dados.resposta.texto} acoes={dados.resposta.acoes} /> : <Esqueleto linhas={2} altura={16} />}
            <div className={styles.numeros}>
              <Numero rotulo={dados?.mesAtual ? "Entrou até agora" : "Entrou"} valor={dados?.entrou}
                variacao={dados?.variacaoEntrou} sobeEhBom anterior={dados && CURTOS[(dados.mes + 10) % 12]} />
              <Numero rotulo={dados?.mesAtual ? "Saiu até agora" : "Saiu"} valor={dados?.saiu}
                variacao={dados?.variacaoSaiu} anterior={dados && CURTOS[(dados.mes + 10) % 12]} />
              <div className={styles.numero} data-largo="true">
                <span className={styles.rotulo}>Sobrou</span>
                {!dados ? <span className={styles.numeroEsqueleto} aria-hidden="true" />
                  : <Dinheiro valor={dados.sobrou} className={styles.numeroValor} tom={dados.sobrou < 0 ? "negativo" : undefined} />}
                {dados && (
                  <span className={styles.extra}>
                    {dados.percentualQueSobrou != null && `${dados.percentualQueSobrou}% do que entrou · `}
                    {CURTOS[(dados.mes + 10) % 12]} sobrou <Dinheiro valor={dados.sobrouMesAnterior} />
                  </span>
                )}
              </div>
            </div>
          </Bloco>

          {/* O que vale olhar */}
          {lista.length > 0 && (
            <Bloco titulo="Avisos do mês">
              <div className={styles.avisos}>
                {lista.map((s) => <Resposta key={s.chave} compacta tom={s.resposta.tom} texto={s.resposta.texto} acoes={s.resposta.acoes} />)}
              </div>
            </Bloco>
          )}

          {/* Vai dar? (só no mês atual) */}
          {ehHoje && doMes && (
            <Bloco titulo="Distribuição da renda">
              <UsoDaRenda dados={doMes} compacta />
            </Bloco>
          )}

          <div className={styles.grade}>
            {/* Pra onde foi */}
            <Bloco titulo="Gastos por categoria">
              {!dados ? <Esqueleto linhas={4} altura={18} />
                : dados.praOndeFoi.length === 0 && !dados.semCategoria ? <p className={styles.vazioSemRespiro}>Nenhum gasto em {mesNome}.</p>
                : <PraOndeFoi dados={dados} aoEscolher={verCategoria} />}
            </Bloco>

            {/* Dá pra cortar onde? */}
            {dados?.corte && (
              <Bloco titulo="Onde dá pra economizar">
                <div className={styles.cartao}>
                  <Resposta tom={dados.corte.resposta.tom} texto={dados.corte.resposta.texto} />
                  {dados.corte.itens.length > 0 && (
                    <ul className={styles.cortes}>
                      {dados.corte.itens.map((i) => (
                        <li key={`${i.tipo}-${i.id ?? i.nome}`}>
                          <span className={styles.corteTopo}>
                            <span className={styles.corteNome}>{i.tipo === "conta-fixa" ? `Conta fixa nova: ${i.nome}` : i.nome}</span>
                            <span className={styles.corteAMais}><Dinheiro valor={i.aMais} />{i.tipo === "conta-fixa" ? " por mês" : " a mais"}</span>
                          </span>
                          {i.tipo === "categoria" && i.normal != null && (
                            <span className={styles.corteDetalhe}>
                              <Dinheiro valor={i.valor} /> este mês · normal <Dinheiro valor={i.normal} />
                              {i.previsto > 0 && <> · ainda vem <Dinheiro valor={i.previsto} /></>}
                            </span>
                          )}
                          <span className={styles.corteAcoes}>
                            {i.tipo === "categoria" && i.id && <button type="button" onClick={() => verCategoria(i.id!)}>Ver lançamentos</button>}
                            {i.tipo === "categoria" && <button type="button" onClick={() => navigate("/orcamento")}>Pôr um planejado</button>}
                            {i.tipo === "conta-fixa" && i.id && <button type="button" onClick={() => navigate(`/contas-fixas/${i.id}`)}>Ver a conta fixa</button>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Bloco>
            )}
          </div>

          {/* Comprometido pro futuro */}
          <Bloco titulo="Contas fixas e parcelas">
            {!dados ? <Esqueleto linhas={3} altura={18} /> : <Comprometido dados={dados} mesNome={mesNome} />}
          </Bloco>

          {/* Mês a mês */}
          <Bloco titulo="Entradas e saídas por mês">
            {!dados ? <Esqueleto linhas={3} altura={18} /> : <MesAMes dados={dados} aoEscolher={(m) => setPeriodo(m)} />}
          </Bloco>

          {/* Reserva */}
          <Bloco titulo="Reserva de emergência">
            {!dados ? <Esqueleto linhas={2} altura={18} /> : (
              <div className={styles.reserva}>
                <div className={styles.reservaNumero}>
                  <span className={styles.grande}>
                    {dados.mesesDeReserva != null ? `${numero(dados.mesesDeReserva)} ${dados.mesesDeReserva === 1 ? "mês" : "meses"}` : <Dinheiro valor={dados.dinheiroGuardado} />}
                  </span>
                  <span className={styles.extra}>
                    <Dinheiro valor={dados.dinheiroGuardado} /> nas contas
                    {dados.gastoNormal != null ? <> ÷ <Dinheiro valor={dados.gastoNormal} /> de gasto normal por mês</> : " · sem meses anteriores pra comparar"}
                  </span>
                </div>
                <div className={styles.cartao}>
                  {dados.respostaReserva && <Resposta tom={dados.respostaReserva.tom} texto={dados.respostaReserva.texto} acoes={dados.respostaReserva.acoes} />}
                  {dados.guardadoNasMetas > 0 && (
                    <dl className={styles.dados}>
                      <div><dt>Guardado nas metas (fora da reserva)</dt><dd><Dinheiro valor={dados.guardadoNasMetas} /></dd></div>
                    </dl>
                  )}
                </div>
              </div>
            )}
          </Bloco>
        </>
      )}
    </div>
  )
}

/** Um número do resumo, com a variação contra o mês anterior (a cor diz se foi bom; sem sinal +/−). */
function Numero({ rotulo, valor, variacao, sobeEhBom, anterior }: {
  rotulo: string; valor?: number; variacao?: number | null; sobeEhBom?: boolean; anterior?: string | null
}) {
  const bom = variacao != null && (sobeEhBom ? variacao > 0 : variacao < 0)
  return (
    <div className={styles.numero}>
      <span className={styles.rotulo}>{rotulo}</span>
      {valor === undefined ? <span className={styles.numeroEsqueleto} aria-hidden="true" /> : <Dinheiro valor={valor} className={styles.numeroValor} />}
      {variacao != null && variacao !== 0 && anterior && (
        <span className={styles.extra}>
          <span className={styles.variacao} data-bom={bom || undefined}>{Math.abs(variacao)}% {variacao > 0 ? "a mais" : "a menos"}</span> que {anterior}
        </span>
      )}
    </div>
  )
}

/** As categorias na ordem do servidor (as maiores primeiro), cor pela série; "Outras" e "Sem categoria" em cinza. */
function PraOndeFoi({ dados, aoEscolher }: { dados: CheckUp; aoEscolher: (chave: string) => void }) {
  let serie = 0
  const linhas: LinhaComparacao[] = dados.praOndeFoi.map((c) => ({
    chave: c.categoriaId ?? c.nome, nome: c.nome, valor: c.valor, previsto: c.previsto, normal: c.normal, variacao: c.variacaoPercentual,
    parte: c.percentualDoGasto, serie: c.categoriaId ? String((serie++ % 5) + 1) : "cinza-2",
  }))
  const sc = dados.semCategoria
  if (sc) linhas.push({
    chave: SEM_CATEGORIA, nome: "Sem categoria", valor: sc.valor, normal: null, variacao: null, parte: sc.percentualDoGasto, serie: "cinza",
    extra: `${sc.quantidade} ${sc.quantidade === 1 ? "lançamento" : "lançamentos"} pra classificar`,
  })
  const clicaveis = (chave: string) => chave !== "Outras" && aoEscolher(chave)
  return (
    <div className={styles.cartao}>
      <GraficoBarrasComparacao rotulo="Pra onde foi" linhas={linhas} aoEscolher={clicaveis} />
      {dados.praOndeFoi.some((c) => c.normal) && (
        <span className={styles.legendaNormal}><i aria-hidden="true" />o seu normal (média dos meses anteriores) · listrado: ainda vem · toque pra ver os lançamentos</span>
      )}
    </div>
  )
}

function Comprometido({ dados, mesNome }: { dados: CheckUp; mesNome: string }) {
  const c = dados.comprometido
  return (
    <div className={styles.comprometido}>
      <div className={styles.cartao}>
        {dados.percentualComprometido != null && (
          <>
            <span className={styles.grande}>{dados.percentualComprometido}%<span className={styles.grandeRotulo}> da renda vai pra contas fixas e parcelas</span></span>
            <Bullet valor={dados.percentualComprometido} faixas={[c.faixaAtencao, c.faixaAlerta]}
              rotulo={`${dados.percentualComprometido}% da renda comprometida`} />
          </>
        )}
        {c.resposta && <Resposta tom={c.resposta.tom} texto={c.resposta.texto} acoes={c.resposta.acoes} />}
        {c.folgaPorMes != null && (
          <div className={styles.folga}>
            <span>Folga por mês</span>
            <Dinheiro valor={c.folgaPorMes} className={styles.folgaValor} tom={c.folgaPorMes < 0 ? "negativo" : undefined} />
          </div>
        )}
      </div>
      <dl className={styles.dados}>
        <div>
          <dt>Contas fixas por mês
            {c.maioresContasFixas.length > 0 && (
              <span className={styles.sub}>
                {c.maioresContasFixas.map((f) => f.descricao).join(" · ")}
                {c.totalContasFixas > c.maioresContasFixas.length && ` · e mais ${c.totalContasFixas - c.maioresContasFixas.length}`}
              </span>
            )}
          </dt>
          <dd><Dinheiro valor={dados.contasFixasPorMes} /></dd>
        </div>
        <div>
          <dt>Parcelas em {mesNome}
            {c.parcelasProximosMeses.length > 0 && (
              <span className={styles.sub}>
                {c.parcelasProximosMeses.map((p, i) => <span key={`${p.ano}-${p.mes}`}>{i > 0 && " · "}{CURTOS[p.mes - 1]} <Dinheiro valor={p.valor} /></span>)}
                {c.parcelasAteAno && ` · até ${CURTOS[(c.parcelasAteMes ?? 1) - 1]}/${String(c.parcelasAteAno).slice(2)}`}
              </span>
            )}
            {c.parcelaQueAcaba && (
              <span className={styles.subBom}>
                A parcela de {c.parcelaQueAcaba.descricao} acaba em {nomeDoPeriodo(c.parcelaQueAcaba).toLowerCase()}: <Dinheiro valor={c.parcelaQueAcaba.porMes} /> a menos todo mês depois
              </span>
            )}
          </dt>
          <dd><Dinheiro valor={dados.parcelasDoMes} /></dd>
        </div>
        {c.faturas.length > 0 && (
          <div>
            <dt>Faturas a pagar este mês
              <span className={styles.sub}>
                {c.faturas.map((f) => (
                  <span key={f.cartaoId + f.vencimento} data-atrasada={f.atrasada || undefined} className={styles.fatura}>
                    {f.cartao} {f.atrasada ? "atrasada " : ""}<Dinheiro valor={f.restante} />
                  </span>
                ))}
              </span>
            </dt>
            <dd><Dinheiro valor={c.faturas.reduce((s, f) => s + f.restante, 0)} /></dd>
          </div>
        )}
        {c.metasPedemPorMes > 0 && (
          <div><dt>As metas pedem por mês<span className={styles.sub}>fora do %: é o que você escolhe guardar</span></dt><dd><Dinheiro valor={c.metasPedemPorMes} /></dd></div>
        )}
      </dl>
    </div>
  )
}

/** Do primeiro mês com algum lançamento até o escolhido. */
function MesAMes({ dados, aoEscolher }: { dados: CheckUp; aoEscolher: (p: Periodo) => void }) {
  const primeiro = dados.mesAMes.findIndex((m) => m.entrou > 0 || m.saiu > 0)
  const meses = primeiro < 0 ? [] : dados.mesAMes.slice(primeiro)
  if (meses.length === 0) return <p className={styles.vazioSemRespiro}>Ainda não há meses com lançamentos.</p>
  return <GraficoBarras meses={meses} escolhido={{ ano: dados.ano, mes: dados.mes }} aoEscolher={(m) => aoEscolher({ ano: m.ano, mes: m.mes })} />
}
