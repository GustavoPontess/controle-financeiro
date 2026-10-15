// Contas fixas do v2: três números (ativas, custo por mês, quantas cobram nos próximos 30 dias) e a
// lista paginada no servidor (busca e Ativas | Encerradas também no servidor). Linha → página da conta
// fixa. "Nova" abre o formulário de transação já como conta fixa — é o mesmo formulário.
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"
import { getRecorrenteStats, listRecorrentesPage, type RecorrenteStats } from "../services/recorrenteService"
import type { FiltroStatusRecorrente, Recorrente } from "../types/Recorrente"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Busca from "../componentes/Busca"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import Paginacao, { TAMANHOS } from "../componentes/Paginacao"
import Segmentos from "../componentes/Segmentos"
import { diaMes } from "../dominio/fatura"
import { SITUACAO, descreverRepeticao } from "../dominio/contaFixa"
import { TIPO } from "../dominio/transacao"
import { useAtrasado } from "../utils/useAtrasado"
import styles from "./ContasFixas.module.css"

const CHAVE_POR_PAGINA = "v2:porPagina:contasFixas"
const porPaginaSalvo = (): number => {
  try { const n = Number(localStorage.getItem(CHAVE_POR_PAGINA)); return (TAMANHOS as readonly number[]).includes(n) ? n : 25 } catch { return 25 }
}
const STATUS: { valor: FiltroStatusRecorrente; rotulo: string }[] = [
  { valor: "ativas", rotulo: "Ativas" },
  { valor: "encerradas", rotulo: "Encerradas" },
]

export default function ContasFixas() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<RecorrenteStats | null>(null)
  const [busca, setBusca] = useState("")
  const q = useAtrasado(busca.trim())
  const [status, setStatus] = useState<FiltroStatusRecorrente>("ativas")
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(porPaginaSalvo)
  const [itens, setItens] = useState<Recorrente[] | null>(null)
  const [total, setTotal] = useState(0)
  const [erro, setErro] = useState(false)

  useEffect(() => { getRecorrenteStats().then(setStats).catch(() => { /* fica sem os números */ }) }, [])
  useEffect(() => { setPagina(1) }, [q, status])
  useEffect(() => {
    let vivo = true
    setErro(false)
    listRecorrentesPage(pagina, porPagina, { status, busca: q })
      .then((r) => { if (vivo) { setItens(r.items); setTotal(r.total) } })
      .catch(() => { if (vivo) { setItens([]); setErro(true) } })
    return () => { vivo = false }
  }, [pagina, porPagina, q, status])

  const filtrando = !!q
  return (
    <div className={styles.pagina}>
      <Bloco className={styles.resumo}>
        <div className={styles.numeros}>
          <div className={styles.numero}>
            <span className={styles.rotulo}>Ativas</span>
            {stats ? <span className={styles.numeroValor}>{stats.ativas}</span> : <span className={styles.numeroEsqueleto} />}
          </div>
          <div className={styles.numero}>
            <span className={styles.rotulo}>Custo por mês</span>
            {stats ? <Dinheiro valor={stats.custoMensalDespesas} className={styles.numeroValor} /> : <span className={styles.numeroEsqueleto} />}
          </div>
          <div className={styles.numero}>
            <span className={styles.rotulo}>Cobram nos próximos 30 dias</span>
            {stats ? <span className={styles.numeroValor}>{stats.proximas30Dias}</span> : <span className={styles.numeroEsqueleto} />}
          </div>
        </div>
      </Bloco>

      <Bloco semRespiro>
        <div className={styles.toolbar}>
          <Busca valor={busca} onChange={setBusca} placeholder="Buscar conta fixa" />
          <div className={styles.direitaBarra}>
            <Segmentos ariaLabel="Situação" valor={status} onChange={setStatus} opcoes={STATUS} />
            <Botao onClick={() => navigate("/contas-fixas/nova", { state: { voltarPara: "/contas-fixas" } })}
              icone={<Plus size={15} strokeWidth={2.5} aria-hidden="true" />}>Nova conta fixa</Botao>
          </div>
        </div>
        {itens === null ? (
          <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
        ) : erro ? (
          <p className={styles.vazio}>Não deu pra carregar as contas fixas.</p>
        ) : itens.length === 0 ? (
          <p className={styles.vazio}>{filtrando ? `Nenhuma conta fixa com "${q}".` : status === "ativas" ? "Nenhuma conta fixa ativa." : "Nenhuma conta fixa encerrada."}</p>
        ) : (
          <ul className={styles.lista}>
            {itens.map((r) => <Linha key={r.id} r={r} />)}
          </ul>
        )}
        {total > 0 && (
          <Paginacao total={total} pagina={pagina} porPagina={porPagina} onPagina={setPagina}
            onPorPagina={(n) => { setPorPagina(n); setPagina(1); try { localStorage.setItem(CHAVE_POR_PAGINA, String(n)) } catch { /* só não lembra */ } }}
            rotulo="contas fixas" rotuloSingular="conta fixa" />
        )}
      </Bloco>
    </div>
  )
}

/** Uma linha: inicial, nome + situação, detalhe (categoria · conta · repetição); à direita o valor e a próxima cobrança. */
function Linha({ r }: { r: Recorrente }) {
  const receita = r.tipo === TIPO.receita
  const viva = r.situacao === "ativa"
  const sit = SITUACAO[r.situacao]
  const detalhe = [r.categoriaNome, r.contaNome ?? r.cartaoCreditoNome, descreverRepeticao(r)].filter(Boolean).join(" · ")
  return (
    <li>
      <Link to={`/contas-fixas/${r.id}`} className={styles.linha}>
        <span className={styles.icone} data-tom={receita ? "positivo" : undefined}>{r.descricao.trim().charAt(0).toUpperCase() || "•"}</span>
        <span className={styles.texto}>
          <span className={styles.nomeLinha}>
            <span className={styles.nome}>{r.descricao}</span>
            {!viva && <Etiqueta tom={sit.tom}>{sit.rotulo}</Etiqueta>}
          </span>
          <span className={styles.sub}>{detalhe}</span>
        </span>
        <span className={styles.direita}>
          <Dinheiro valor={r.valor} className={styles.valor} tom={!viva ? "neutro" : receita ? "positivo" : "negativo"} />
          <span className={styles.direitaSub}>{r.proximaCobranca ? `próxima ${diaMes(r.proximaCobranca)}` : " "}</span>
        </span>
      </Link>
    </li>
  )
}
