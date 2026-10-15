// Cartões do v2 — visão geral: três números (a pagar, próximo vencimento, limite disponível) e a lista
// de cartões como linhas: fatura atual, estado (fecha em N dias / atrasada / paga) e a barra do limite.
// A fatura atual de cada cartão vem das faturas dele (poucos cartões → poucas chamadas); se um dia pesar,
// o resumo passa a vir no DTO do cartão.
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"
import { getCartoes } from "../services/cartaoCreditoService"
import { getFaturasByCartao } from "../services/faturaService"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { Fatura } from "../types/Fatura"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import BarraProgresso from "../componentes/BarraProgresso"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import FaceCartao from "../componentes/FaceCartao"
import { NOME_BANDEIRA, diaMes, diasAte, estadoDaFatura, indiceMes, indiceMesDeHoje } from "../dominio/fatura"
import styles from "./Cartoes.module.css"

/** O que a linha do cartão precisa da lista de faturas dele. */
type ResumoCartao = {
  /** Fatura do ciclo de hoje (aberta). Sem lançamento no ciclo = undefined. */
  atual?: Fatura
  /** Fechadas que ainda devem — a mais antiga primeiro. */
  devendo: Fatura[]
}

function resumir(c: CartaoCredito, faturas: Fatura[], hoje: Date): ResumoCartao {
  const mesHoje = indiceMesDeHoje(hoje, c.diaFechamento)
  const atual = faturas.find((f) => indiceMes(f.dataFechamento) === mesHoje)
  const devendo = faturas
    .filter((f) => f.estadoCiclo === 1 && f.valorRestante > 0)
    .sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))
  return { atual, devendo }
}

export default function Cartoes() {
  const navigate = useNavigate()
  const [cartoes, setCartoes] = useState<CartaoCredito[] | null>(null)
  const [faturas, setFaturas] = useState<Record<string, Fatura[]> | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    getCartoes()
      .then(async (cs) => {
        if (!vivo) return
        setCartoes(cs)
        const pares = await Promise.all(cs.filter((c) => c.temCredito).map((c) =>
          getFaturasByCartao(c.id).then((fs) => [c.id, fs] as const).catch(() => [c.id, [] as Fatura[]] as const)))
        if (vivo) setFaturas(Object.fromEntries(pares))
      })
      .catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [])

  const hoje = useMemo(() => new Date(), [])
  const resumos = useMemo(() => {
    const r: Record<string, ResumoCartao> = {}
    for (const c of cartoes ?? []) r[c.id] = resumir(c, faturas?.[c.id] ?? [], hoje)
    return r
  }, [cartoes, faturas, hoje])

  // Números do topo: o que está pra pagar AGORA (fatura do ciclo atual + fechadas devendo — parcela de mês
  // futuro fica fora, ela aparece no limite usado), o vencimento mais próximo entre essas e o limite livre.
  const totais = useMemo(() => {
    if (!cartoes || !faturas) return null
    const todas = cartoes.flatMap((c) => {
      const r = resumos[c.id]
      return [...(r?.atual ? [r.atual] : []), ...(r?.devendo ?? [])]
    }).filter((f) => f.valorRestante > 0)
    const aPagar = todas.reduce((s, f) => s + f.valorRestante, 0)
    // A que vence primeiro entre as que devem (aberta ou fechada; atrasada conta — é a mais urgente).
    const proxima = [...todas].sort((a, b) => a.dataVencimento.localeCompare(b.dataVencimento))[0]
    const limite = cartoes.filter((c) => c.temCredito).reduce((s, c) => s + (c.limiteDisponivel ?? 0), 0)
    return { aPagar, proxima, limite }
  }, [cartoes, faturas, resumos])

  return (
    <div className={styles.pagina}>
      <Bloco className={styles.resumo}>
        <div className={styles.numeros}>
          <Numero rotulo="A pagar" valor={totais?.aPagar} />
          <div className={styles.numero}>
            <span className={styles.rotulo}>Próximo vencimento</span>
            {!totais ? <span className={styles.numeroEsqueleto} />
              : totais.proxima ? (
                <span className={styles.numeroValor} data-tom={diasAte(totais.proxima.dataVencimento, hoje) < 0 ? "negativo" : diasAte(totais.proxima.dataVencimento, hoje) <= 3 ? "alerta" : undefined}>
                  {diaMes(totais.proxima.dataVencimento)} · <Dinheiro valor={totais.proxima.valorRestante} />
                </span>
              ) : <span className={styles.numeroValor} data-vazio="true">Nenhum</span>}
          </div>
          <Numero rotulo="Limite disponível" valor={totais?.limite} />
        </div>
      </Bloco>

      <Bloco semRespiro>
        <div className={styles.toolbar}>
          <Botao onClick={() => navigate("/cartoes/novo", { state: { voltarPara: "/cartoes" } })} icone={<Plus size={15} strokeWidth={2.5} aria-hidden="true" />}>Novo cartão</Botao>
        </div>
        {cartoes === null ? (
          <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
        ) : erro ? (
          <p className={styles.vazio}>Não deu pra carregar os cartões.</p>
        ) : cartoes.length === 0 ? (
          <p className={styles.vazio}>Nenhum cartão ainda.</p>
        ) : (
          <ul className={styles.lista}>
            {cartoes.map((c) => <Linha key={c.id} c={c} resumo={resumos[c.id]} carregando={faturas === null} hoje={hoje} />)}
          </ul>
        )}
      </Bloco>
    </div>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor?: number }) {
  return (
    <div className={styles.numero}>
      <span className={styles.rotulo}>{rotulo}</span>
      {valor === undefined ? <span className={styles.numeroEsqueleto} /> : <Dinheiro valor={valor} className={styles.numeroValor} />}
    </div>
  )
}

/** Uma linha: a carinha, nome + estado, detalhe + barra do limite, e a fatura atual à direita. */
function Linha({ c, resumo, carregando, hoje }: { c: CartaoCredito; resumo?: ResumoCartao; carregando: boolean; hoje: Date }) {
  const limite = c.limite ?? 0
  const usado = c.limiteUsado ?? 0
  // O que importa primeiro: fechada devendo (atrasada ou a vencer) > fatura aberta > nada.
  const destaque = resumo?.devendo[0] ?? resumo?.atual
  const estado = destaque ? estadoDaFatura(destaque, hoje) : undefined
  const detalhe = [
    NOME_BANDEIRA[c.bandeira] ?? "Cartão",
    c.ultimosDigitos ? `•••• ${c.ultimosDigitos}` : null,
    c.temCredito && c.diaFechamento ? `fecha dia ${c.diaFechamento}` : null,
    c.temCredito && c.diaVencimento ? `vence dia ${c.diaVencimento}` : null,
  ].filter(Boolean).join(" · ")
  return (
    <li>
      <Link to={`/cartoes/${c.id}`} className={styles.linha}>
        <FaceCartao bandeira={c.bandeira} cor={c.bancoCor} />
        <span className={styles.texto}>
          <span className={styles.nomeLinha}>
            <span className={styles.nome}>{c.nome}</span>
            {!c.temCredito ? <Etiqueta>Só débito</Etiqueta>
              : carregando ? null
              : estado ? <Etiqueta tom={estado.tom}>{estado.rotulo}</Etiqueta>
              : <Etiqueta>Sem lançamentos</Etiqueta>}
          </span>
          <span className={styles.sub}>{detalhe}</span>
          {c.temCredito && limite > 0 && (
            <span className={styles.limite}>
              <BarraProgresso fracao={usado / limite} tom={usado / limite >= 0.9 ? "alerta" : undefined} rotulo={`${Math.round((usado / limite) * 100)}% do limite usado`} />
              <span className={styles.limiteTexto}>disponível <Dinheiro valor={c.limiteDisponivel ?? 0} /> de <Dinheiro valor={limite} /></span>
            </span>
          )}
        </span>
        {c.temCredito && (
          <span className={styles.direita}>
            {carregando ? <span className={styles.numeroEsqueleto} /> : (
              <>
                <Dinheiro valor={destaque?.valorRestante ?? 0} className={styles.valor} tom={destaque && destaque.valorRestante > 0 ? "negativo" : "neutro"} />
                <span className={styles.direitaSub}>{resumo?.devendo[0] ? "fatura fechada" : "fatura atual"}</span>
              </>
            )}
          </span>
        )}
      </Link>
    </li>
  )
}
