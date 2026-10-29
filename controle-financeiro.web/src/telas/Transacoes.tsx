// Transações do v2, em duas visões (como o Organizze; decisão do Gustavo 2026-10-19):
// - Saldo: o extrato de caixa, só o que mexe no saldo (receita/despesa de conta, pagamento de fatura e
//   transferências). Compra no crédito não entra: o dinheiro sai quando a fatura é paga.
// - Gastos: o que a pessoa gastou, na data em que gastou, em conta e no cartão; compra parcelada uma vez só,
//   com o total (abre o parcelamento). Sem pagamento de fatura nem transferência, senão contaria duas vezes.
// Busca, filtros e paginação rodam no servidor. Nada de enfeite: cada controle filtra.
// Sem período escolhido, a lista vai até HOJE, o mais recente em cima: as previsões das contas fixas
// (geradas meses pra frente) empurravam o dia de hoje pro fim. Os previstos aparecem pelo filtro de status
// (do mais perto pro mais longe) ou escolhendo as datas.
import { useEffect, useMemo, useState } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import { listTransactionsPage, getResumoGastos, getTransactionStats, type ListTransactionsFilter, type ResumoGastos } from "../services/transactionService"
import { getContas } from "../services/contaService"
import { getCategories } from "../services/categoryService"
import type { Transaction } from "../types/Transaction"
import type { Conta } from "../types/Conta"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import { Dinheiro } from "../componentes/Dinheiro"
import ListaPorDia from "../componentes/ListaPorDia"
import Paginacao, { TAMANHOS } from "../componentes/Paginacao"
import Selecao from "../componentes/Selecao"
import Segmentos from "../componentes/Segmentos"
import PainelFiltros from "../componentes/PainelFiltros"
import Busca from "../componentes/Busca"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import SeletorData from "../componentes/SeletorData"
import { maskMoney, parseMoney } from "../utils/money"
import { dataLocalISO, diaSeguinte } from "../utils/dateTime"
import { useAtrasado } from "../utils/useAtrasado"
import { linhaDoLancamento } from "../dominio/linhaLancamento"
import styles from "./Transacoes.module.css"

// Linhas por página: lembra a escolha neste navegador (conveniência; volta pra 25 se não der pra ler).
const CHAVE_POR_PAGINA = "v2:porPagina:transacoes"
const porPaginaSalvo = (): number => {
  try { const n = Number(localStorage.getItem(CHAVE_POR_PAGINA)); return (TAMANHOS as readonly number[]).includes(n) ? n : 25 } catch { return 25 }
}

type Visao = "saldo" | "gastos"
const VISOES: { valor: Visao; rotulo: string }[] = [{ valor: "saldo", rotulo: "Saldo" }, { valor: "gastos", rotulo: "Gastos" }]
// A visão também fica lembrada neste navegador (mesma conveniência das linhas por página).
const CHAVE_VISAO = "v2:visao:transacoes"
const visaoSalva = (): Visao => {
  try { return localStorage.getItem(CHAVE_VISAO) === "gastos" ? "gastos" : "saldo" } catch { return "saldo" }
}

type Natureza = "" | "entrada" | "saida" | "transferencia" | "fatura"
const NATUREZAS: { valor: Natureza; rotulo: string }[] = [
  { valor: "", rotulo: "Todos" },
  { valor: "entrada", rotulo: "Entradas" },
  { valor: "saida", rotulo: "Saídas" },
  { valor: "transferencia", rotulo: "Transferências" },
  { valor: "fatura", rotulo: "Pagamento de fatura" },
]

/** Filtros avançados — vivem num rascunho enquanto o painel está aberto e só valem no "Aplicar". `categoriaId` também
 *  chega pela URL (Relatórios › tocar numa categoria ou "Classificar"; o id vazio é "sem categoria") e aparece no painel. */
type Filtros = { natureza: Natureza; contaId: string; status: string; valorMin: string; valorMax: string; de: string; ate: string; categoriaId: string }
const SEM_FILTRO: Filtros = { natureza: "", contaId: "", status: "", valorMin: "", valorMax: "", de: "", ate: "", categoriaId: "" }
const SEM_CATEGORIA = "00000000-0000-0000-0000-000000000000"

/** `?categoriaId=…&mes=2026-10` (vindo de Relatórios) vira filtro: a categoria e o mês inteiro. */
function filtrosDaUrl(p: URLSearchParams): Partial<Filtros> {
  const f: Partial<Filtros> = {}
  const cat = p.get("categoriaId")
  if (cat && /^[0-9a-f-]{36}$/i.test(cat)) f.categoriaId = cat
  const mes = p.get("mes")
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [a, m] = mes.split("-").map(Number)
    f.de = `${mes}-01`
    f.ate = `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}`
  }
  return f
}
const ativosEm = (f: Filtros) => [f.natureza, f.contaId, f.categoriaId, f.status, f.valorMin || f.valorMax, f.de || f.ate].filter(Boolean).length


export default function Transacoes() {
  const [itens, setItens] = useState<Transaction[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(porPaginaSalvo)
  const mudarPorPagina = (n: number) => {
    setPorPagina(n); setPagina(1)
    try { localStorage.setItem(CHAVE_POR_PAGINA, String(n)) } catch { /* sem armazenamento: só não lembra */ }
  }
  const [erro, setErro] = useState(false)
  const [url, setUrl] = useSearchParams()
  // Chegou filtrado por categoria (Relatórios): a visão é Gastos, a mesma base do "Pra onde foi".
  const [visao, setVisao] = useState<Visao>(() => (url.get("categoriaId") ? "gastos" : visaoSalva()))
  const gastos = visao === "gastos"
  const [stats, setStats] = useState<{ entradas: number; saidas: number } | null>(null)
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Record<string, string>>({})

  const [busca, setBusca] = useState("")
  const buscaAplicada = useAtrasado(busca.trim())
  // Outra tela pode chegar com filtro (ex.: Importar extrato → "Ver em Transações" da conta): state.filtros.
  const { state } = useLocation()
  const [filtros, setFiltros] = useState<Filtros>(() => ({ ...SEM_FILTRO, ...((state as { filtros?: Partial<Filtros> } | null)?.filtros ?? {}), ...filtrosDaUrl(url) }))
  const [rascunho, setRascunho] = useState<Filtros>(filtros)      // o que está no painel
  const [painel, setPainel] = useState(false)

  useEffect(() => { setPagina(1) }, [buscaAplicada, filtros, visao])
  // Gastos não tem "tipo de lançamento" (é tudo saída): o filtro sai junto pra não ficar valendo escondido.
  const mudarVisao = (v: Visao) => {
    setVisao(v)
    if (v === "gastos") { setFiltros((f) => ({ ...f, natureza: "" })); setRascunho((r) => ({ ...r, natureza: "" })) }
    try { localStorage.setItem(CHAVE_VISAO, v) } catch { /* sem armazenamento: só não lembra */ }
  }

  // Painel: abre com o rascunho = o que está valendo; fecha com Esc ou clique fora (sem aplicar).
  const abrirPainel = () => { setRascunho(filtros); setPainel(true) }
  const aplicar = () => { setFiltros(rascunho); setPainel(false); if (url.size) setUrl({}, { replace: true }) }
  const limparTudo = () => { setRascunho(SEM_FILTRO); setFiltros(SEM_FILTRO); setPainel(false); if (url.size) setUrl({}, { replace: true }) }
  const edita = <K extends keyof Filtros>(k: K) => (valor: string) => setRascunho((r) => ({ ...r, [k]: valor }))
  // Valor do filtro com a mesma máscara de dinheiro dos formulários: só dígitos, nunca negativo.
  const editaValor = (k: "valorMin" | "valorMax") => (e: { target: { value: string } }) =>
    setRascunho((r) => ({ ...r, [k]: maskMoney(e.target.value.replace(/\D/g, "").slice(0, 12), r[k]) }))

  useEffect(() => {
    let vivo = true
    getContas().then((cs) => { if (vivo) setContas(cs) }).catch(() => { /* filtro fica sem contas */ })
    getCategories().then((cats) => { if (vivo) setCategorias(Object.fromEntries(cats.map((c) => [c.id, c.descricao]))) }).catch(() => { /* sem nome de categoria */ })
    getTransactionStats({}).then((s) => { if (vivo) setStats({ entradas: s.entradasCaixa, saidas: s.saidasCaixa }) }).catch(() => { /* faixa fica vazia */ })
    return () => { vivo = false }
  }, [])

  const soPrevistos = filtros.status === "0"
  // O que a lista pede (busca + filtros); o topo da visão Gastos soma exatamente isso.
  const pedido = useMemo((): ListTransactionsFilter => ({
    q: buscaAplicada || undefined,
    natureza: gastos ? undefined : filtros.natureza || undefined,
    contaId: filtros.contaId || undefined,
    categoriaId: filtros.categoriaId || undefined,
    status: filtros.status !== "" ? Number(filtros.status) : undefined,
    valorMin: filtros.valorMin !== "" ? parseMoney(filtros.valorMin) : undefined,
    valorMax: filtros.valorMax !== "" ? parseMoney(filtros.valorMax) : undefined,
    from: filtros.de || undefined,
    // "Até" inclui o dia escolhido; o back filtra Data < to. Sem período (e sem pedir os previstos): até hoje.
    to: filtros.ate ? diaSeguinte(filtros.ate) : soPrevistos || filtros.de ? undefined : diaSeguinte(dataLocalISO()),
    // Previstos: o próximo primeiro.
    ordenacao: soPrevistos ? "data_asc" : undefined,
    apenasCaixa: !gastos,
    visao: gastos ? "gastos" : undefined,
  }), [buscaAplicada, filtros, gastos, soPrevistos])

  useEffect(() => {
    let vivo = true
    setErro(false)
    listTransactionsPage(pagina, porPagina, pedido)
      .then((r) => { if (vivo) { setItens(r.items); setTotal(r.total) } })
      .catch(() => { if (vivo) { setErro(true); setItens([]) } })
    return () => { vivo = false }
  }, [pagina, porPagina, pedido])

  // Topo da visão Gastos (decisão do Gustavo, 2026-10-21): muda com a visão e acompanha a busca e os filtros.
  const [resumoGastos, setResumoGastos] = useState<ResumoGastos | null>(null)
  useEffect(() => {
    if (!gastos) return
    let vivo = true
    setResumoGastos(null)
    getResumoGastos(pedido).then((r) => { if (vivo) setResumoGastos(r) }).catch(() => { /* topo fica vazio */ })
    return () => { vivo = false }
  }, [gastos, pedido])

  const saldoEmConta = useMemo(() => contas.reduce((s, c) => s + (c.saldoAtual ?? 0), 0), [contas])
  const ativos = ativosEm(filtros)
  const temFiltro = !!busca || ativos > 0

  return (
    <div className={styles.pagina}>
      {/* Os números + quantos registros a lista tem (com os filtros de agora, contado no servidor). Saldo: o dinheiro
          que tem hoje + o que entrou e saiu do caixa. Gastos: quanto gastou no que a lista mostra, em conta e no cartão. */}
      <Bloco className={styles.resumo}>
        {gastos ? (
          <div className={styles.numeros}>
            <div className={styles.numero}>
              <span className={styles.rotulo}>Registros</span>
              {itens ? <span className={styles.numeroValor}>{total.toLocaleString("pt-BR")}</span> : <span className={styles.numeroEsqueleto} aria-hidden="true" />}
            </div>
            <div className={styles.numero}>
              <span className={styles.rotulo}>Gastos</span>
              {resumoGastos ? <Dinheiro valor={resumoGastos.total} className={styles.numeroValor} /> : <span className={styles.numeroEsqueleto} aria-hidden="true" />}
            </div>
            <div className={styles.numero}>
              <span className={styles.rotulo}>Em conta</span>
              {resumoGastos ? <Dinheiro valor={resumoGastos.emConta} className={styles.numeroValor} /> : <span className={styles.numeroEsqueleto} aria-hidden="true" />}
            </div>
            <div className={styles.numero}>
              <span className={styles.rotulo}>No cartão</span>
              {resumoGastos ? <Dinheiro valor={resumoGastos.noCartao} className={styles.numeroValor} /> : <span className={styles.numeroEsqueleto} aria-hidden="true" />}
            </div>
          </div>
        ) : (
        <div className={styles.numeros}>
          <div className={styles.numero}>
            <span className={styles.rotulo}>Registros</span>
            {itens ? <span className={styles.numeroValor}>{total.toLocaleString("pt-BR")}</span> : <span className={styles.numeroEsqueleto} aria-hidden="true" />}
          </div>
          <div className={styles.numero}>
            <span className={styles.rotulo}>Saldo em conta</span>
            {contas.length ? <Dinheiro valor={saldoEmConta} className={styles.numeroValor} /> : <span className={styles.numeroEsqueleto} aria-hidden="true" />}
          </div>
          <div className={styles.numero}>
            <span className={styles.rotulo}>Entrou</span>
            {stats ? <Dinheiro valor={stats.entradas} tom="positivo" className={styles.numeroValor} /> : <span className={styles.numeroEsqueleto} aria-hidden="true" />}
          </div>
          <div className={styles.numero}>
            <span className={styles.rotulo}>Saiu</span>
            {stats ? <Dinheiro valor={stats.saidas} className={styles.numeroValor} /> : <span className={styles.numeroEsqueleto} aria-hidden="true" />}
          </div>
        </div>
        )}
      </Bloco>

      <Bloco semRespiro>
        {/* Barra: busca + visão (Saldo | Gastos) + "Filtros". Os filtros avançados abrem num painel ancorado no
            botão e só valem no "Aplicar". Sem título — o topo da página já diz que é Transações. */}
        <div className={styles.toolbar}>
          <div className={styles.controles}>
            <Busca valor={busca} onChange={setBusca} placeholder="Buscar lançamento" />
            <div className={styles.direita}>
              <Segmentos ariaLabel="Visão" valor={visao} onChange={mudarVisao} opcoes={VISOES} />
              <PainelFiltros ativos={ativos} aberto={painel} aoAbrir={abrirPainel} aoFechar={() => setPainel(false)}
                aoAplicar={aplicar} aoLimpar={limparTudo}>
                {!gastos && (
                  <Campo rotulo="Tipo de lançamento">
                    <Selecao tamanho="sm" valor={rascunho.natureza}
                      onChange={(v) => setRascunho((r) => ({ ...r, natureza: v as Natureza }))}
                      opcoes={NATUREZAS.map((n) => ({ valor: n.valor, rotulo: n.rotulo }))} />
                  </Campo>
                )}
                <Campo rotulo="Conta">
                  <Selecao tamanho="sm" valor={rascunho.contaId}
                    onChange={(v) => setRascunho((r) => ({ ...r, contaId: v }))}
                    opcoes={[{ valor: "", rotulo: "Todas as contas" }, ...contas.map((c) => ({ valor: c.id, rotulo: c.nome }))]} />
                </Campo>
                <Campo rotulo="Categoria">
                  <Selecao tamanho="sm" valor={rascunho.categoriaId}
                    onChange={(v) => setRascunho((r) => ({ ...r, categoriaId: v }))}
                    opcoes={[{ valor: "", rotulo: "Todas as categorias" }, { valor: SEM_CATEGORIA, rotulo: "Sem categoria" },
                      ...Object.entries(categorias).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")).map(([valor, rotulo]) => ({ valor, rotulo }))]} />
                </Campo>
                <Campo rotulo="Status">
                  <Selecao tamanho="sm" valor={rascunho.status}
                    onChange={(v) => setRascunho((r) => ({ ...r, status: v }))}
                    opcoes={[{ valor: "", rotulo: "Qualquer status" }, { valor: "1", rotulo: "Efetivado" }, { valor: "0", rotulo: "Previsto" }]} />
                </Campo>
                <Campo rotulo="Valor" grupo>
                  <div className={styles.faixa}>
                    <Entrada tamanho="sm" prefixo="R$" inputMode="numeric" autoComplete="off" placeholder="0,00" aria-label="Valor mínimo" value={rascunho.valorMin} onChange={editaValor("valorMin")} />
                    <span className={styles.ate}>até</span>
                    <Entrada tamanho="sm" prefixo="R$" inputMode="numeric" autoComplete="off" placeholder="0,00" aria-label="Valor máximo" value={rascunho.valorMax} onChange={editaValor("valorMax")} />
                  </div>
                </Campo>
                <Campo rotulo="Período" grupo>
                  <div className={styles.faixa}>
                    <SeletorData tamanho="sm" limpavel placeholder="Início" ariaLabel="De" valor={rascunho.de} max={rascunho.ate || undefined} onChange={edita("de")} />
                    <span className={styles.ate}>até</span>
                    <SeletorData tamanho="sm" limpavel placeholder="Fim" ariaLabel="Até" valor={rascunho.ate} min={rascunho.de || undefined} onChange={edita("ate")} />
                  </div>
                </Campo>
              </PainelFiltros>
            </div>
          </div>
        </div>

        {itens === null ? (
          <div className={styles.respiro}><Esqueleto linhas={6} altura={16} /></div>
        ) : erro ? (
          <p className={styles.vazio}>Não deu pra carregar as transações.</p>
        ) : itens.length === 0 ? (
          <p className={styles.vazio}>{temFiltro ? "Nada com esses filtros." : gastos ? "Nenhum gasto ainda." : "Nenhum lançamento ainda."}</p>
        ) : (
          <ListaPorDia itens={itens.map((t) => linhaDoLancamento(t, categorias[t.categoriaId ?? ""]))} />
        )}

        {total > 0 && (
          <Paginacao total={total} pagina={pagina} porPagina={porPagina} onPagina={setPagina} onPorPagina={mudarPorPagina}
            rotulo="transações" rotuloSingular="transação" />
        )}
      </Bloco>
    </div>
  )
}
