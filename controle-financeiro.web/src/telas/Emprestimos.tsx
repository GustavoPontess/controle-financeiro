// Empréstimos (/emprestimos), desenho aprovado pelo Gustavo em 2026-10-19: três números (falta voltar do que você
// emprestou, falta devolver do que você pegou, o que vence em 30 dias), a resposta dos próximos 30 dias (o que você
// devolve, se o saldo nas contas cobre, o que volta pra você) e "Pra responder" (pagamento que alguém registrou pra
// você confirmar, convite pra acompanhar junto). Embaixo, Em andamento | Quitados, em dois grupos: Você emprestou e
// Você pegou. A linha abre a ficha ali mesmo (modelo de Bancos): valores, parcelas e as ações; os formulários
// (novo, registrar o que voltou/devolvi, convidar, confirmar) têm página própria. Linguagem de fato: "falta voltar",
// "falta devolver", nunca deve/dívida/cobrar. Banco pode estar no lugar da pessoa; juntar empréstimos fica pra depois.
import { useCallback, useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Archive, Check, HandCoins, Plus, Trash2, UserPlus, X } from "lucide-react"
import {
  aceitarVinculoEmprestimoPorId, arquivarEmprestimo, deleteEmprestimo, getEmprestimoStats, getProximosEmprestimos,
  listConvitesPendentesEmprestimo, listEmprestimosPage, listParcelasEmprestimo, listSolicitacoesPagamentoPendentes,
  quitarEmprestimo, recusarVinculoEmprestimoPorId, rejeitarPagamentoEmprestimo, type EmprestimoStats,
} from "../services/emprestimoService"
import { mensagemDeErro } from "../api/cliente"
import type {
  Emprestimo, EmprestimoConvitePendente, EmprestimoPagamentoSolicitacao, EmprestimoParcela, ProximosEmprestimos, VencimentoEmprestimo,
} from "../types/Emprestimo"
import { StatusParcelaEmprestimo } from "../types/Emprestimo"
import type { AindaVem } from "../types/DinheiroDoMes"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import ListaAindaVem from "../componentes/ListaAindaVem"
import { AcoesFicha, DadosFicha, GrupoFicha, InicialFicha, ItemFicha, ListaFicha } from "../componentes/ListaFicha"
import LogoMarca from "../componentes/LogoMarca"
import Resposta from "../componentes/Resposta"
import Segmentos from "../componentes/Segmentos"
import {
  acompanhaJunto, conviteEnviado, emprestei, parcelado, quandoCurto, quemDoOutroLado, rotuloFalta, rotuloPago, rotuloRegistrar,
} from "../dominio/emprestimo"
import { dataBR } from "../utils/dateTime"
import { formatMoney } from "../utils/money"
import styles from "./Emprestimos.module.css"

type Aba = "andamento" | "quitados"

export default function Emprestimos() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [aba, setAba] = useState<Aba>("andamento")
  const [itens, setItens] = useState<Emprestimo[] | null>(null)
  const [erro, setErro] = useState(false)
  const [stats, setStats] = useState<EmprestimoStats | null>(null)
  const [proximos, setProximos] = useState<ProximosEmprestimos | null>(null)
  const [pagamentos, setPagamentos] = useState<EmprestimoPagamentoSolicitacao[]>([])
  const [convites, setConvites] = useState<EmprestimoConvitePendente[]>([])
  const [abertoId, setAbertoId] = useState<string | null>(() => (state as { abrir?: string } | null)?.abrir ?? null)

  // O topo (números, resposta, pra responder) não depende da aba; a lista sim.
  const carregarTopo = useCallback(() => {
    getEmprestimoStats().then(setStats).catch(() => { /* números ficam em esqueleto */ })
    getProximosEmprestimos().then(setProximos).catch(() => { /* sem resposta */ })
    listSolicitacoesPagamentoPendentes().then(setPagamentos).catch(() => { /* sem pendências */ })
    listConvitesPendentesEmprestimo().then(setConvites).catch(() => { /* sem convites */ })
  }, [])
  const carregarLista = useCallback(async (a: Aba) => {
    setErro(false)
    try {
      const r = await listEmprestimosPage(1, 100, false, undefined, undefined, { situacao: a === "quitados" ? "quitado" : "ativo" })
      setItens(r.items)
    } catch { setErro(true); setItens([]) }
  }, [])
  useEffect(() => { carregarTopo() }, [carregarTopo])
  useEffect(() => { setItens(null); void carregarLista(aba) }, [aba, carregarLista])
  const recarregar = async () => { carregarTopo(); await carregarLista(aba) }

  const grupos = useMemo(() => [
    { chave: "emprestei", rotulo: "Você emprestou", itens: (itens ?? []).filter(emprestei) },
    { chave: "peguei", rotulo: "Você pegou", itens: (itens ?? []).filter((e) => !emprestei(e)) },
  ].filter((g) => g.itens.length > 0), [itens])

  // O que vence em 30 dias (inclui o que já venceu), por empréstimo: a próxima parcela e se alguma venceu.
  const vencimentos = useMemo(() => {
    const m = new Map<string, VencimentoEmprestimo[]>()
    for (const v of [...(proximos?.devolver ?? []), ...(proximos?.voltar ?? [])]) m.set(v.emprestimoId, [...(m.get(v.emprestimoId) ?? []), v])
    return m
  }, [proximos])
  const venceEm30 = proximos ? [...proximos.devolver, ...proximos.voltar].reduce((s, v) => s + v.valor, 0) : undefined

  return (
    <div className={styles.pagina}>
      <Bloco className={styles.resumo}>
        <div className={styles.numeros}>
          <Numero rotulo="Emprestei · falta voltar" valor={stats?.totalAReceber} />
          <Numero rotulo="Peguei · falta devolver" valor={stats?.totalAPagar} />
          <Numero rotulo="Vence nos próximos 30 dias" valor={venceEm30} />
        </div>
        {proximos?.resposta && (
          <div className={styles.resposta}>
            <Resposta tom={proximos.resposta.tom} texto={proximos.resposta.texto}>
              {proximos.devolver.length > 0 && (
                <div className={styles.lado}>
                  <span className={styles.ladoTitulo}>Você devolve</span>
                  <ListaAindaVem itens={proximos.devolver.map(paraLinha)} semCategoria semLink comMes vencido={(d) => `venceu ${quandoCurto(d)}`} rotulo="Você devolve" />
                </div>
              )}
              {proximos.voltar.length > 0 && (
                <div className={styles.lado}>
                  <span className={styles.ladoTitulo}>Volta pra você</span>
                  <ListaAindaVem itens={proximos.voltar.map(paraLinha)} semCategoria semLink comMes vencido={(d) => `venceu ${quandoCurto(d)}`} rotulo="Volta pra você" />
                </div>
              )}
            </Resposta>
          </div>
        )}
      </Bloco>

      {(pagamentos.length > 0 || convites.length > 0) && (
        <Bloco titulo="Pra responder">
          <ul className={styles.responder} aria-label="Pra responder">
            {pagamentos.map((p) => <PagamentoPraConfirmar key={p.id} p={p} aoMudar={recarregar} />)}
            {convites.map((c) => <ConvitePraResponder key={c.emprestimoId} c={c} aoMudar={recarregar} />)}
          </ul>
        </Bloco>
      )}

      <Bloco semRespiro>
        <div className={styles.toolbar}>
          <Segmentos<Aba> ariaLabel="Situação" valor={aba} onChange={(a) => { setAba(a); setAbertoId(null) }} opcoes={[
            { valor: "andamento", rotulo: "Em andamento" },
            { valor: "quitados", rotulo: "Quitados" },
          ]} />
          <Botao compactoNoCelular onClick={() => navigate("/emprestimos/novo", { state: { voltarPara: "/emprestimos" } })}
            icone={<Plus size={15} strokeWidth={2.5} aria-hidden="true" />}>Novo empréstimo</Botao>
        </div>
        {itens === null ? (
          <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
        ) : erro ? (
          <p className={styles.vazio} role="alert">Não deu pra carregar os empréstimos.</p>
        ) : grupos.length === 0 ? (
          <p className={styles.vazio}>{aba === "andamento" ? "Nenhum empréstimo em andamento." : "Nenhum empréstimo quitado."}</p>
        ) : (
          <ListaFicha rotulo="Empréstimos">
            {grupos.map((g) => (
              <GrupoFicha key={g.chave} rotulo={g.rotulo}
                extra={aba === "andamento" && <Dinheiro valor={g.itens.reduce((s, e) => s + e.valorRestante, 0)} className={styles.grupoTotal} />}>
                {g.itens.map((e) => (
                  <Linha key={e.id} e={e} vencimentos={vencimentos.get(e.id) ?? []} aberta={e.id === abertoId}
                    aoAbrir={() => setAbertoId((atual) => (atual === e.id ? null : e.id))} aoMudar={recarregar} />
                ))}
              </GrupoFicha>
            ))}
          </ListaFicha>
        )}
      </Bloco>
    </div>
  )
}

/** Um vencimento como linha da lista de "ainda vem": quem · parcela, dia, valor. */
const paraLinha = (v: VencimentoEmprestimo): AindaVem => ({
  transacaoId: `${v.emprestimoId}-${v.parcela ?? 0}`, contaFixaId: null, categoriaId: null, categoria: "",
  descricao: v.parcela ? `${v.quem} · ${v.parcela} de ${v.deParcelas}` : v.quem, data: v.data, valor: v.valor,
})

function Numero({ rotulo, valor }: { rotulo: string; valor?: number }) {
  return (
    <div className={styles.numero}>
      <span className={styles.rotulo}>{rotulo}</span>
      {valor === undefined ? <span className={styles.numeroEsqueleto} aria-hidden="true" /> : <Dinheiro valor={valor} className={styles.numeroValor} />}
    </div>
  )
}

/** Alguém registrou que passou dinheiro pra você: confirmar (com a conta em que entrou) ou "não recebi". */
function PagamentoPraConfirmar({ p, aoMudar }: { p: EmprestimoPagamentoSolicitacao; aoMudar: () => Promise<void> }) {
  const navigate = useNavigate()
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const naoRecebi = async () => {
    setOcupado(true); setErro(null)
    try { await rejeitarPagamentoEmprestimo(p.id); await aoMudar() } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false) }
  }
  return (
    <li className={styles.pendencia}>
      <InicialFicha texto={p.solicitadoPorNome} />
      <span className={styles.texto}>
        <span className={styles.nome}>{p.solicitadoPorNome} registrou que passou <Dinheiro valor={p.valor} /> pra você</span>
        <span className={styles.sub}>{dataBR(p.comprovanteData || p.criadoEm)}{erro ? ` · ${erro}` : ""}</span>
      </span>
      <span className={styles.botoes}>
        <Botao disabled={ocupado} onClick={() => { void naoRecebi() }} icone={<X size={15} strokeWidth={2.25} aria-hidden="true" />}>Não recebi</Botao>
        <Botao variante="primario" disabled={ocupado}
          onClick={() => navigate(`/emprestimos/pagamentos/${p.id}/confirmar`, { state: { voltarPara: "/emprestimos", pagamento: p } })}
          icone={<Check size={15} strokeWidth={2.25} aria-hidden="true" />}>Confirmar</Botao>
      </span>
    </li>
  )
}

/** Alguém quer acompanhar junto um empréstimo com você: aceitar ou recusar. */
function ConvitePraResponder({ c, aoMudar }: { c: EmprestimoConvitePendente; aoMudar: () => Promise<void> }) {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const responder = async (aceitar: boolean) => {
    setOcupado(true); setErro(null)
    try {
      await (aceitar ? aceitarVinculoEmprestimoPorId(c.emprestimoId) : recusarVinculoEmprestimoPorId(c.emprestimoId))
      await aoMudar()
    } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false) }
  }
  return (
    <li className={styles.pendencia}>
      <InicialFicha texto={c.credorOuDevedorNome} />
      <span className={styles.texto}>
        <span className={styles.nome}>{c.credorOuDevedorNome} quer acompanhar junto um empréstimo</span>
        <span className={styles.sub}>{c.descricao || "Empréstimo"} · {formatMoney(c.valorTotal)}{erro ? ` · ${erro}` : ""}</span>
      </span>
      <span className={styles.botoes}>
        <Botao disabled={ocupado} onClick={() => { void responder(false) }}>Recusar</Botao>
        <Botao variante="primario" disabled={ocupado} onClick={() => { void responder(true) }}>Aceitar</Botao>
      </span>
    </li>
  )
}

/** Um empréstimo: a linha (quem, o que, a próxima, o que falta) e, aberta, a ficha com valores, parcelas e ações. */
function Linha({ e, vencimentos, aberta, aoAbrir, aoMudar }: {
  e: Emprestimo
  vencimentos: VencimentoEmprestimo[]
  aberta: boolean
  aoAbrir: () => void
  aoMudar: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [parcelas, setParcelas] = useState<EmprestimoParcela[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<"excluir" | "quitar" | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    if (!aberta || !parcelado(e) || parcelas) return
    let vivo = true
    listParcelasEmprestimo(e.id).then((p) => { if (vivo) setParcelas(p) }).catch(() => { if (vivo) setParcelas([]) })
    return () => { vivo = false }
  }, [aberta, e, parcelas])

  const quem = quemDoOutroLado(e)
  const venceu = vencimentos.find((v) => v.venceu)
  const proxima = vencimentos.find((v) => !v.venceu)
  const detalhe = [
    e.descricao || null,
    parcelado(e) ? `${e.quantidadeParcelas ?? ""}x`.trim() : "à vista",
    e.quitado || venceu ? null
      : proxima ? `${parcelado(e) ? "próxima" : "até"} ${quandoCurto(proxima.data)} · ${formatMoney(proxima.valor)}`
      : !parcelado(e) && e.dataVencimento ? `até ${dataBR(e.dataVencimento)}` : null,
  ].filter(Boolean).join(" · ")

  const agir = async (acao: () => Promise<unknown>) => {
    setOcupado(true); setErro(null)
    try { await acao(); setConfirmar(null); await aoMudar() } catch (x) { setErro(mensagemDeErro(x)); setConfirmar(null) }
    setOcupado(false)
  }
  const podeConvidar = !e.bancoId && !e.quitado && !acompanhaJunto(e) && !conviteEnviado(e)

  return (
    <ItemFicha id={`emprestimo-${e.id}`} aberto={aberta} aoAbrir={aoAbrir}
      marca={e.bancoId ? <LogoMarca nome={quem} logoUrl={e.bancoLogoUrl} cor={e.bancoCor} tamanho={36} /> : <InicialFicha texto={quem} />}
      titulo={<>{quem}<Etiquetas e={e} venceu={venceu} /></>}
      detalhe={detalhe}
      direita={<Dinheiro valor={e.quitado ? e.valorTotal : e.valorRestante} className={styles.valor} tom={e.quitado ? "neutro" : undefined} />}>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      <DadosFicha>
        <div><dt>{emprestei(e) ? "Emprestado" : "Peguei"}</dt><dd><Dinheiro valor={e.valorTotal} /></dd></div>
        {/* Com juros, o que volta é mais que o emprestado: o total deixa a conta fechar (já + falta = com os juros). */}
        {!e.quitado && e.valorPago + e.valorRestante > e.valorTotal + 0.005 && (
          <div><dt>Com os juros</dt><dd><Dinheiro valor={e.valorPago + e.valorRestante} /></dd></div>
        )}
        <div><dt>{rotuloPago(e)}</dt><dd><Dinheiro valor={e.valorPago} /></dd></div>
        {!e.quitado && <div><dt>{rotuloFalta(e)}</dt><dd><Dinheiro valor={e.valorRestante} /></dd></div>}
        {e.valorPendente > 0 && <div><dt>{e.souCredor ? "Pra você confirmar" : "Esperando confirmar"}</dt><dd><Dinheiro valor={e.valorPendente} /></dd></div>}
        <div><dt>Desde</dt><dd>{dataBR(e.dataInicio)}</dd></div>
        {!parcelado(e) && e.dataVencimento && <div><dt>Combinado pra</dt><dd>{dataBR(e.dataVencimento)}</dd></div>}
        {e.taxaJuroMensal ? <div><dt>Juros</dt><dd>{e.taxaJuroMensal.toLocaleString("pt-BR")}% ao mês</dd></div> : null}
        {e.percentualMultaAtraso ? <div><dt>Multa se atrasar</dt><dd>{e.percentualMultaAtraso.toLocaleString("pt-BR")}%</dd></div> : null}
        {acompanhaJunto(e) && <div><dt>Acompanha junto</dt><dd>{e.contraparteNome}</dd></div>}
        {e.observacao && <div><dt>Observação</dt><dd>{e.observacao}</dd></div>}
      </DadosFicha>
      {parcelado(e) && (
        <div className={styles.parcelas}>
          <span className={styles.ladoTitulo}>Parcelas</span>
          {parcelas === null ? <Esqueleto linhas={2} altura={14} /> : (
            <ul className={styles.listaParcelas} aria-label="Parcelas">
              {parcelas.map((p) => (
                <li key={p.id} data-paga={p.status === StatusParcelaEmprestimo.Paga || undefined}>
                  <span>{p.numero} de {p.quantidadeTotal}</span>
                  <span className={styles.mudo}>{situacaoParcela(p, e)}</span>
                  <Dinheiro valor={p.valorComMulta ?? p.valorComJuros ?? p.valor} className={styles.valorParcela} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <AcoesFicha>
        <Botao perigo disabled={ocupado} onClick={() => setConfirmar("excluir")} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Excluir</Botao>
        {e.quitado ? (
          <Botao disabled={ocupado} onClick={() => { void agir(() => arquivarEmprestimo(e.id)) }} icone={<Archive size={15} strokeWidth={2.25} aria-hidden="true" />}>Tirar da lista</Botao>
        ) : (
          <>
            {podeConvidar && (
              <Botao onClick={() => navigate(`/emprestimos/${e.id}/convidar`, { state: { voltarPara: "/emprestimos", emprestimo: e } })}
                icone={<UserPlus size={15} strokeWidth={2.25} aria-hidden="true" />}>Convidar {quem.split(" ")[0]}</Botao>
            )}
            {e.souCredor && <Botao disabled={ocupado} onClick={() => setConfirmar("quitar")} icone={<Check size={15} strokeWidth={2.25} aria-hidden="true" />}>Quitar</Botao>}
            <Botao variante="primario" onClick={() => navigate(`/emprestimos/${e.id}/registrar`, { state: { voltarPara: "/emprestimos", emprestimo: e } })}
              icone={<HandCoins size={15} strokeWidth={2.25} aria-hidden="true" />}>{rotuloRegistrar(e)}</Botao>
          </>
        )}
      </AcoesFicha>

      <Confirmar aberto={confirmar === "excluir"} titulo="Excluir empréstimo?" perigo ocupado={ocupado} rotuloConfirmar="Excluir"
        texto={acompanhaJunto(e) ? `Some pra você e pra ${e.contraparteNome}. Os lançamentos que você já fez continuam em Transações.` : "Os lançamentos que você já fez continuam em Transações."}
        onConfirmar={() => { void agir(() => deleteEmprestimo(e.id)) }} onCancelar={() => setConfirmar(null)} />
      <Confirmar aberto={confirmar === "quitar"} titulo="Quitar empréstimo?" ocupado={ocupado} rotuloConfirmar="Quitar"
        texto={`Fica como se tudo tivesse ${emprestei(e) ? "voltado" : "sido devolvido"} (${formatMoney(e.valorTotal)}). Nenhum lançamento é criado.`}
        onConfirmar={() => { void agir(() => quitarEmprestimo(e.id)) }} onCancelar={() => setConfirmar(null)} />
    </ItemFicha>
  )
}

/** As etiquetas da linha: venceu, quitado, acompanha junto, convite enviado, valor esperando confirmação. */
function Etiquetas({ e, venceu }: { e: Emprestimo; venceu?: VencimentoEmprestimo }) {
  return (
    <span className={styles.etiquetas}>
      {e.quitado && <Etiqueta tom="positivo">Quitado</Etiqueta>}
      {!e.quitado && venceu && <Etiqueta tom="alerta">Venceu {quandoCurto(venceu.data)}</Etiqueta>}
      {!e.quitado && e.valorPendente > 0 && (
        <Etiqueta>{formatMoney(e.valorPendente)} {e.souCredor ? "pra você confirmar" : "esperando confirmar"}</Etiqueta>
      )}
      {acompanhaJunto(e) && <Etiqueta>Acompanha junto</Etiqueta>}
      {conviteEnviado(e) && <Etiqueta>Convite enviado</Etiqueta>}
    </span>
  )
}

/** "voltou" / "devolvi" / "vence 25/10" / "venceu 25/9" / "cancelada". */
function situacaoParcela(p: EmprestimoParcela, e: Emprestimo): string {
  if (p.status === StatusParcelaEmprestimo.Paga) return emprestei(e) ? "voltou" : "devolvi"
  if (p.status === StatusParcelaEmprestimo.Cancelada) return "cancelada"
  return `${p.atrasada ? "venceu" : "vence"} ${dataBR(p.dataVencimento).slice(0, 5)}`
}
