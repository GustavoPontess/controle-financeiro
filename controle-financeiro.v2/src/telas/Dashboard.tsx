// Visão geral do v2: o saldo num palco escuro com os 4 números do mês; embaixo, evolução, maiores gastos,
// recentes, contas e cartões — mesmos dados do /dashboard do app atual.
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowDownLeft, ArrowDownRight, ArrowLeftRight, ArrowUpRight, ChevronLeft, ChevronRight, CreditCard } from "lucide-react"
import { getDashboard } from "../services/dashboardService"
import { getRendaMes } from "../services/rendaService"
import type { RendaMes } from "../types/Renda"
import type { DashboardData, TransacaoRecente } from "../types/Dashboard"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import { Dinheiro, diaCurto, variacao, type TomDinheiro } from "../componentes/Dinheiro"
import LogoMarca from "../componentes/LogoMarca"
import GraficoLinha from "../componentes/GraficoLinha"
import styles from "./Dashboard.module.css"

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]

export default function Dashboard() {
  const hoje = new Date()
  const [ref, setRef] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 })
  const [dados, setDados] = useState<DashboardData | null>(null)
  const [erro, setErro] = useState(false)
  // Renda do mês (previsto × recebido): pedido à parte, a Visão geral não espera por ele.
  const [renda, setRenda] = useState<RendaMes | null>(null)

  useEffect(() => {
    let vivo = true
    setDados(null); setErro(false); setRenda(null)
    getDashboard(ref.ano, ref.mes).then((d) => { if (vivo) setDados(d) }).catch(() => { if (vivo) setErro(true) })
    getRendaMes(ref.ano, ref.mes).then((r) => { if (vivo) setRenda(r) }).catch(() => { /* o cartão fica sem número */ })
    return () => { vivo = false }
  }, [ref])

  const mudarMes = (passo: number) => setRef(({ ano, mes }) => {
    const i = ano * 12 + (mes - 1) + passo
    return { ano: Math.floor(i / 12), mes: (i % 12) + 1 }
  })
  const ehMesAtual = ref.ano === hoje.getFullYear() && ref.mes === hoje.getMonth() + 1
  const mesAnterior = MESES[(ref.mes + 10) % 12]
  const d = dados
  const diferenca = d ? d.saldoTotal - d.saldoMesAnterior : 0

  return (
    <div className={styles.pagina}>
      <section className={styles.palco}>
        <div className={styles.palcoTopo}>
          <span className={styles.rotulo}>Saldo total</span>
          <div className={styles.mes}>
            <button type="button" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft size={16} strokeWidth={2.25} /></button>
            <span>{MESES[ref.mes - 1]} {ref.ano}</span>
            <button type="button" aria-label="Próximo mês" disabled={ehMesAtual} onClick={() => mudarMes(1)}><ChevronRight size={16} strokeWidth={2.25} /></button>
          </div>
        </div>
        {d ? <Dinheiro valor={d.saldoTotal} className={styles.hero} /> : <span className={styles.heroEsqueleto} aria-hidden="true" />}
        <span className={styles.palcoSub}>
          {erro ? "Não deu pra carregar." : d ? (
            <><Dinheiro valor={Math.abs(diferenca)} /> {diferenca >= 0 ? "a mais" : "a menos"} que no fim de {mesAnterior.toLowerCase()}</>
          ) : " "}
        </span>
        <div className={styles.palcoNumeros}>
          <Numero rotulo="Entrou" valor={d?.entradasCaixa} vari={d ? variacao(d.entradasCaixa, d.entradasCaixaMesAnterior) : null} />
          <Numero rotulo="Saiu" valor={d?.saidasCaixa} vari={d ? variacao(d.saidasCaixa, d.saidasCaixaMesAnterior) : null} />
          <Numero rotulo="Sobrou" valor={d?.saldoCaixaMes} palco={d ? (d.saldoCaixaMes < 0 ? "negativo" : "positivo") : undefined} />
          <Numero rotulo="No cartão" valor={d ? (d.gastoCartaoMes ?? 0) : undefined} />
        </div>
      </section>

      <Bloco titulo="Renda do mês" acao="Ver renda" para="/renda">
        {!renda ? <Esqueleto linhas={1} altura={28} /> : (
          <div className={styles.renda}>
            <div className={styles.rendaNumero}><span className={styles.rendaRotulo}>Previsto</span><Dinheiro valor={renda.previsto} className={styles.rendaValor} /></div>
            <div className={styles.rendaNumero}><span className={styles.rendaRotulo}>Recebido</span><Dinheiro valor={renda.recebido} className={styles.rendaValor} tom="positivo" /></div>
            <div className={styles.rendaNumero}>
              <span className={styles.rendaRotulo}>{renda.falta > 0 ? "Falta" : "A mais que o previsto"}</span>
              <Dinheiro valor={renda.falta > 0 ? renda.falta : Math.max(0, renda.recebido - renda.previsto)} className={styles.rendaValor} />
            </div>
            <span className={styles.rendaDetalhe}>
              {renda.previsto === 0
                ? (renda.sugestaoMedia3Meses !== null ? <>Diga o que espera receber; nos últimos meses deu em média <Dinheiro valor={renda.sugestaoMedia3Meses} />.</> : "Diga o que espera receber no mês em Renda.")
                : <>Contas fixas <Dinheiro valor={renda.fixas} /> · variável esperada <Dinheiro valor={renda.variavelEsperada} /></>}
            </span>
          </div>
        )}
      </Bloco>

      <div className={styles.grade}>
        <Bloco titulo="Saldo nos últimos meses">
          {d ? <GraficoLinha pontos={d.evolucaoSaldo.map((p) => ({ rotulo: p.label, valor: p.saldo }))} /> : <Esqueleto linhas={4} altura={18} />}
        </Bloco>
        <Bloco titulo="Maiores gastos do mês">
          {!d ? <Esqueleto /> : d.topCategorias.length === 0 ? <Vazio texto="Sem gastos neste mês." /> : (
            <ul className={styles.categorias}>
              {d.topCategorias.slice(0, 5).map((c) => (
                <li key={c.descricao} className={styles.categoria}>
                  <span className={styles.categoriaNome}>{c.descricao}</span>
                  <span className={styles.categoriaValor}><Dinheiro valor={c.valor} /> <span className={styles.categoriaPct}>{Math.round(c.percentual)}%</span></span>
                  <span className={styles.trilho}><span className={styles.trilhoFill} style={{ width: `${Math.min(100, c.percentual)}%` }} /></span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>

      <div className={styles.grade}>
        <Bloco titulo="Transações recentes" acao="Ver todas" para="/transacoes" semRespiro>
          {!d ? <div className={styles.respiro}><Esqueleto linhas={5} /></div> : d.transacoesRecentes.length === 0 ? <div className={styles.respiro}><Vazio texto="Nada lançado neste mês." /></div> : (
            <ul className={styles.lista}>{d.transacoesRecentes.slice(0, 8).map((t) => <LinhaTransacao key={t.id} t={t} />)}</ul>
          )}
        </Bloco>
        <div className={styles.coluna}>
          <Bloco titulo="Contas" acao="Ver todas" para="/bancos" semRespiro>
            {!d ? <div className={styles.respiro}><Esqueleto linhas={3} /></div> : (
              <ul className={styles.lista}>
                {d.saldoContas.map((c) => (
                  <li key={c.id} className={styles.linha}>
                    <LogoMarca nome={c.nome} logoUrl={c.logoUrl} cor={c.cor} tamanho={36} />
                    <span className={styles.texto}><span className={styles.nome}>{c.nome}</span><span className={styles.sub}>{c.tipoDescricao}</span></span>
                    <Dinheiro valor={c.saldo} className={styles.valor} tom={c.saldo < 0 ? "negativo" : undefined} />
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
          <Bloco titulo="Cartões" acao="Ver todos" para="/cartoes" semRespiro>
            {!d ? <div className={styles.respiro}><Esqueleto linhas={2} /></div> : d.cartoesResumo.length === 0 ? <div className={styles.respiro}><Vazio texto="Nenhum cartão." /></div> : (
              <ul className={styles.lista}>
                {d.cartoesResumo.map((c) => (
                  <li key={c.id}>
                    <Link to={`/cartoes/${c.id}`} className={styles.linha}>
                      <LogoMarca nome={c.bancoNome ?? c.nome} logoUrl={c.bancoLogoUrl} cor={c.bancoCor} tamanho={36} />
                      <span className={styles.texto}>
                        <span className={styles.nome}>{c.nome}</span>
                        <span className={styles.sub}>{fechamento(c.diasAteFechamento)} · disponível <Dinheiro valor={c.limiteDisponivel} /></span>
                        <span className={styles.trilhoFino}><span className={styles.trilhoFill} style={{ width: `${Math.min(100, c.percentualUsado)}%` }} /></span>
                      </span>
                      <Dinheiro valor={c.limiteUsado} className={styles.valor} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
        </div>
      </div>
    </div>
  )
}

function fechamento(dias?: number | null) {
  if (dias == null) return "sem fechamento"
  if (dias === 0) return "fecha hoje"
  if (dias === 1) return "fecha amanhã"
  if (dias < 0) return `fechou há ${-dias} dias`
  return `fecha em ${dias} dias`
}

function Numero({ rotulo, valor, vari, palco }: { rotulo: string; valor?: number; vari?: { texto: string; sobe: boolean } | null; palco?: "positivo" | "negativo" }) {
  return (
    <div className={styles.numero}>
      <span className={styles.rotulo}>{rotulo}</span>
      {valor == null ? <span className={styles.numeroEsqueleto} aria-hidden="true" /> : <Dinheiro valor={valor} className={styles.numeroValor} tom={palco} />}
      {vari && (
        <span className={styles.numeroVar}>
          {vari.sobe ? <ArrowUpRight size={12} strokeWidth={2.5} aria-hidden="true" /> : <ArrowDownRight size={12} strokeWidth={2.5} aria-hidden="true" />}
          {vari.texto} <span>vs mês anterior</span>
        </span>
      )}
    </div>
  )
}

function Vazio({ texto }: { texto: string }) {
  return <p className={styles.vazio}>{texto}</p>
}

function LinhaTransacao({ t }: { t: TransacaoRecente }) {
  const receita = t.tipo === 2
  const neutra = !!(t.ehTransferencia || t.ehPagamentoFatura)
  const tom: TomDinheiro | undefined = neutra ? "neutro" : receita ? "positivo" : undefined
  const icone = t.ehPagamentoFatura ? <CreditCard size={16} strokeWidth={2} aria-hidden="true" />
    : t.ehTransferencia ? <ArrowLeftRight size={16} strokeWidth={2} aria-hidden="true" />
    : receita ? <ArrowDownLeft size={16} strokeWidth={2.25} aria-hidden="true" />
    : (t.categoria ?? t.descricao).trim().charAt(0).toUpperCase()
  return (
    <li>
      <Link to={`/transacoes/${t.id}`} className={styles.linha}>
        <span className={styles.icone} data-tom={tom}>{icone}</span>
        <span className={styles.texto}>
          <span className={styles.nome}>{t.descricao}</span>
          <span className={styles.sub}>{t.conta ?? "Cartão"} · {diaCurto(t.data)}{t.categoria ? ` · ${t.categoria}` : ""}</span>
        </span>
        <Dinheiro valor={t.valor} tom={tom} className={styles.valor} />
      </Link>
    </li>
  )
}
