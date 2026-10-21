// Relatórios do v2 = o check-up do mês (docs/features/respostas/visao.md, camada 3): a soma das respostas das outras
// telas. No topo a resposta em frase; os quatro números (entrou, saiu, sobrou, quanto da renda já está comprometido);
// pra onde foi o dinheiro, cada categoria contra o normal dela; a reserva em meses; e os meses lado a lado. A conta e a
// frase vêm prontas do servidor (GET /relatorios/check-up); aqui só a vitrine. Exporta o mês em CSV.
import { useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"
import { getCheckUp, urlCsvDoMes } from "../services/relatorioService"
import type { CheckUp, MesDoCheckUp } from "../types/Relatorio"
import BarraProgresso from "../componentes/BarraProgresso"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import { Dinheiro } from "../componentes/Dinheiro"
import NavegadorMes, { nomeDoPeriodo, periodoDeHoje, type Periodo } from "../componentes/NavegadorMes"
import Resposta from "../componentes/Resposta"
import styles from "./Relatorios.module.css"

const CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const numero = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })

export default function Relatorios() {
  const [periodo, setPeriodo] = useState<Periodo>(periodoDeHoje)
  const [dados, setDados] = useState<CheckUp | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    setDados(null); setErro(false)
    getCheckUp(periodo.ano, periodo.mes).then((d) => { if (vivo) setDados(d) }).catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [periodo])

  const mesNome = nomeDoPeriodo(periodo).toLowerCase()

  return (
    <div className={styles.pagina}>
      <div className={styles.topo}>
        <NavegadorMes periodo={periodo} onChange={setPeriodo} />
        <a className={styles.csv} href={urlCsvDoMes(periodo.ano, periodo.mes)} download>
          <Download size={15} strokeWidth={2.25} aria-hidden="true" />Exportar CSV
        </a>
      </div>

      {erro ? <Bloco><p className={styles.vazio} role="alert">Não deu pra carregar o check-up.</p></Bloco> : (
        <>
          <Bloco className={styles.resumo}>
            {dados ? <Resposta tom={dados.resposta.tom} texto={dados.resposta.texto} acoes={dados.resposta.acoes} /> : <Esqueleto linhas={2} altura={16} />}
            <div className={styles.numeros}>
              <Numero rotulo={dados?.mesAtual ? "Entrou até agora" : "Entrou"} valor={dados?.entrou} />
              <Numero rotulo={dados?.mesAtual ? "Saiu até agora" : "Saiu"} valor={dados?.saiu} />
              <Numero rotulo="Sobrou" valor={dados?.sobrou} tom={dados && dados.sobrou < 0 ? "negativo" : undefined}
                extra={dados?.percentualQueSobrou != null ? `${dados.percentualQueSobrou}% do que entrou` : undefined} />
              <div className={styles.numero}>
                <span className={styles.rotulo}>Comprometido</span>
                {!dados ? <span className={styles.numeroEsqueleto} aria-hidden="true" />
                  : <span className={styles.numeroValor}>{dados.percentualComprometido != null ? `${dados.percentualComprometido}%` : "Sem renda"}</span>}
                {dados && dados.percentualComprometido != null && <span className={styles.extra}>da renda em contas fixas e parcelas</span>}
              </div>
            </div>
          </Bloco>

          <div className={styles.grade}>
            <Bloco titulo={`Pra onde foi em ${mesNome}`} semRespiro>
              {!dados ? <div className={styles.respiro}><Esqueleto linhas={4} altura={18} /></div>
                : dados.praOndeFoi.length === 0 ? <p className={styles.vazio}>Nenhum gasto em {mesNome}.</p>
                : (
                  <ul className={styles.categorias} aria-label="Pra onde foi">
                    {dados.praOndeFoi.map((c) => (
                      <li key={c.categoriaId ?? c.nome}>
                        <span className={styles.catTopo}>
                          <span className={styles.catNome}>{c.nome}</span>
                          <Dinheiro valor={c.valor} className={styles.catValor} />
                        </span>
                        <BarraProgresso fracao={c.percentualDoGasto / 100} />
                        <Comparacao valor={c.valor} normal={c.normal} variacao={c.variacaoPercentual} mesAtual={dados.mesAtual} />
                      </li>
                    ))}
                  </ul>
                )}
            </Bloco>

            <div className={styles.lado}>
              <Bloco titulo="Reserva">
                {!dados ? <Esqueleto linhas={2} altura={18} /> : (
                  <div className={styles.cartao}>
                    <span className={styles.grande}>
                      {dados.mesesDeReserva != null ? `${numero(dados.mesesDeReserva)} ${dados.mesesDeReserva === 1 ? "mês" : "meses"}` : <Dinheiro valor={dados.dinheiroGuardado} />}
                    </span>
                    <dl className={styles.dados}>
                      <div><dt>Nas contas e caixinhas hoje</dt><dd><Dinheiro valor={dados.dinheiroGuardado} /></dd></div>
                      <div><dt>Gasto de um mês normal</dt><dd>{dados.gastoNormal != null ? <Dinheiro valor={dados.gastoNormal} /> : "Sem histórico"}</dd></div>
                    </dl>
                  </div>
                )}
              </Bloco>
              <Bloco titulo="Comprometido todo mês">
                {!dados ? <Esqueleto linhas={2} altura={18} /> : (
                  <div className={styles.cartao}>
                    {dados.percentualComprometido != null && <BarraProgresso fracao={dados.percentualComprometido / 100} tom={dados.percentualComprometido > 60 ? "alerta" : undefined} />}
                    <dl className={styles.dados}>
                      <div><dt>Contas fixas por mês</dt><dd><Dinheiro valor={dados.contasFixasPorMes} /></dd></div>
                      <div><dt>Parcelas em {mesNome}</dt><dd><Dinheiro valor={dados.parcelasDoMes} /></dd></div>
                    </dl>
                  </div>
                )}
              </Bloco>
            </div>
          </div>

          <Bloco titulo="Mês a mês">
            {!dados ? <Esqueleto linhas={3} altura={18} /> : <MesAMes meses={dados.mesAMes} />}
          </Bloco>
        </>
      )}
    </div>
  )
}

function Numero({ rotulo, valor, tom, extra }: { rotulo: string; valor?: number; tom?: "negativo"; extra?: string }) {
  return (
    <div className={styles.numero}>
      <span className={styles.rotulo}>{rotulo}</span>
      {valor === undefined ? <span className={styles.numeroEsqueleto} aria-hidden="true" /> : <Dinheiro valor={valor} className={styles.numeroValor} tom={tom} />}
      {extra && <span className={styles.extra}>{extra}</span>}
    </div>
  )
}

/** A categoria contra o normal dela: acima de 30% fica em alerta; abaixo, em verde. */
function Comparacao({ valor, normal, variacao, mesAtual }: { valor: number; normal: number | null; variacao: number | null; mesAtual: boolean }) {
  if (normal == null || normal === 0 || variacao == null)
    return <span className={styles.comparacao}>{normal === 0 ? "Novo neste mês" : "Sem meses anteriores pra comparar"}</span>
  const tom = variacao >= 30 && valor - normal >= 50 ? "alerta" : variacao < 0 ? "positivo" : undefined
  const quanto = variacao === 0 ? "igual ao normal" : `${Math.abs(variacao)}% ${variacao > 0 ? "acima" : "abaixo"} do normal`
  return (
    <span className={styles.comparacao} data-tom={tom}>
      {quanto} (<Dinheiro valor={normal} />){mesAtual && variacao < 0 ? " até agora" : ""}
    </span>
  )
}

/** Os meses lado a lado (do primeiro com algum lançamento até o escolhido): entrou e saiu em barras, e o que sobrou. */
function MesAMes({ meses }: { meses: MesDoCheckUp[] }) {
  const comDado = useMemo(() => {
    const primeiro = meses.findIndex((m) => m.entrou > 0 || m.saiu > 0)
    return primeiro < 0 ? [] : meses.slice(primeiro)
  }, [meses])
  if (comDado.length === 0) return <p className={styles.vazioSemRespiro}>Ainda não há meses com lançamentos.</p>
  const maior = Math.max(...comDado.map((m) => Math.max(m.entrou, m.saiu)), 1)
  return (
    <div className={styles.legendaEBarras}>
      <span className={styles.legenda}>
        <span className={styles.legendaItem}><span className={styles.marca} data-tipo="entrou" />Entrou</span>
        <span className={styles.legendaItem}><span className={styles.marca} data-tipo="saiu" />Saiu</span>
      </span>
      <ul className={styles.meses} aria-label="Mês a mês">
        {comDado.map((m) => (
          <li key={`${m.ano}-${m.mes}`} className={styles.mes}>
            <span className={styles.barras} aria-hidden="true">
              <span className={styles.barra} data-tipo="entrou" style={{ height: `${(m.entrou / maior) * 100}%` }} />
              <span className={styles.barra} data-tipo="saiu" style={{ height: `${(m.saiu / maior) * 100}%` }} />
            </span>
            <span className={styles.mesNome}>{CURTOS[m.mes - 1]}/{String(m.ano).slice(2)}</span>
            <Dinheiro valor={m.sobrou} className={styles.mesSobrou} tom={m.sobrou < 0 ? "negativo" : undefined} />
            <span className={styles.leitor}>entrou {m.entrou}, saiu {m.saiu}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
