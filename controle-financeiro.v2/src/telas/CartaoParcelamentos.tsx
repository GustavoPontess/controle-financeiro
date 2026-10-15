// Parcelamentos de um cartão (/cartoes/:id/parcelamentos): página própria porque podem ser muitos —
// a página do cartão mostra só o número e "Ver todos" traz pra cá. Cabeçalho com a carinha + nome e os
// dois números (em andamento, faltam); lista paginada no servidor.
import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { getCartoes } from "../services/cartaoCreditoService"
import { ParcelamentoService } from "../services/ParcelamentoService"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { Parcelamento } from "../types/Parcelamento"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import BarraProgresso from "../componentes/BarraProgresso"
import { Dinheiro } from "../componentes/Dinheiro"
import FaceCartao from "../componentes/FaceCartao"
import Paginacao, { TAMANHOS } from "../componentes/Paginacao"
import { diaMes } from "../dominio/fatura"
import styles from "./CartaoParcelamentos.module.css"

const CHAVE_POR_PAGINA = "v2:porPagina:parcelamentos"
const porPaginaSalvo = (): number => {
  try { const n = Number(localStorage.getItem(CHAVE_POR_PAGINA)); return (TAMANHOS as readonly number[]).includes(n) ? n : 10 } catch { return 10 }
}

export default function CartaoParcelamentos() {
  const { id = "" } = useParams<{ id: string }>()
  const [cartao, setCartao] = useState<CartaoCredito | null | undefined>(undefined)
  const [stats, setStats] = useState<{ ativos: number; totalRestante: number } | null>(null)

  useEffect(() => {
    let vivo = true
    setCartao(undefined); setStats(null)
    getCartoes().then((cs) => { if (vivo) setCartao(cs.find((x) => x.id === id) ?? null) }).catch(() => { if (vivo) setCartao(null) })
    ParcelamentoService.obterStats(id).then((s) => { if (vivo) setStats(s) }).catch(() => { /* fica sem número */ })
    return () => { vivo = false }
  }, [id])

  if (cartao === undefined) return <div className={styles.pagina}><Bloco><Esqueleto linhas={3} altura={16} /></Bloco></div>
  if (cartao === null) return <div className={styles.pagina}><Bloco><p className={styles.muted}>Cartão não encontrado.</p></Bloco></div>

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div className={styles.identidade}>
          <FaceCartao bandeira={cartao.bandeira} cor={cartao.bancoCor} />
          <div className={styles.identidadeTexto}>
            <h2 className={styles.titulo}>{cartao.nome}</h2>
            <span className={styles.muted}>Parcelamentos</span>
          </div>
        </div>
        <div className={styles.numeros}>
          <div className={styles.numero}>
            <span className={styles.rotulo}>Em andamento</span>
            {!stats ? <span className={styles.numeroEsqueleto} /> : <span className={styles.numeroValor}>{stats.ativos}</span>}
          </div>
          <div className={styles.numero}>
            <span className={styles.rotulo}>Faltam</span>
            {!stats ? <span className={styles.numeroEsqueleto} /> : <Dinheiro valor={stats.totalRestante} className={styles.numeroValor} />}
          </div>
        </div>
      </header>

      <Lista cartaoId={cartao.id} />
    </div>
  )
}

function Lista({ cartaoId }: { cartaoId: string }) {
  const [itens, setItens] = useState<Parcelamento[] | null>(null)
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(porPaginaSalvo)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    setErro(false)
    ParcelamentoService.listarPaginado(pagina, porPagina, true, cartaoId)
      .then((r) => { if (vivo) { setItens(r.items); setTotal(r.total) } })
      .catch(() => { if (vivo) { setItens([]); setErro(true) } })
    return () => { vivo = false }
  }, [cartaoId, pagina, porPagina])

  return (
    <Bloco semRespiro>
      {itens === null ? <div className={styles.respiro}><Esqueleto linhas={3} altura={16} /></div>
        : erro ? <p className={styles.vazio}>Não deu pra carregar os parcelamentos.</p>
        : itens.length === 0 ? <p className={styles.vazio}>Nenhum parcelamento em andamento neste cartão.</p>
        : (
          <ul className={styles.lista}>
            {itens.map((p) => {
              const pagas = p.parcelasPagas
              const prox = p.proximaParcela
              return (
                <li key={p.id}>
                  <Link to={`/cartoes/${cartaoId}/parcelamentos/${p.id}`} state={{ voltarPara: `/cartoes/${cartaoId}/parcelamentos` }} className={styles.linha}>
                  <span className={styles.icone}>{p.descricao.trim().charAt(0).toUpperCase() || "•"}</span>
                  <span className={styles.texto}>
                    <span className={styles.nome}>{p.descricao}</span>
                    <span className={styles.muted}>
                      {pagas} de {p.quantidadeParcelas} pagas{prox ? <> · próxima {diaMes(prox.faturaDataVencimento)} · <Dinheiro valor={prox.valorComJuros ?? prox.valor} /></> : null}
                    </span>
                    <BarraProgresso fracao={pagas / p.quantidadeParcelas} tom="positivo" rotulo={`${pagas} de ${p.quantidadeParcelas} parcelas pagas`} />
                  </span>
                  <span className={styles.direita}>
                    <Dinheiro valor={p.valorRestante} className={styles.valor} />
                    <span className={styles.muted}>faltam</span>
                  </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      {total > 0 && (
        <Paginacao total={total} pagina={pagina} porPagina={porPagina} onPagina={setPagina}
          onPorPagina={(n) => { setPorPagina(n); setPagina(1); try { localStorage.setItem(CHAVE_POR_PAGINA, String(n)) } catch { /* só não lembra */ } }}
          rotulo="parcelamentos" rotuloSingular="parcelamento" />
      )}
    </Bloco>
  )
}
