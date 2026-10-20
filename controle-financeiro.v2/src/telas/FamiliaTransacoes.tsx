// Transações da família (/familias/:id/transacoes; passo 4 do espaço da família): tudo que é da casa no mês numa lista
// só, do mais recente pro mais antigo: as despesas divididas por qualquer membro (quem pagou, sua parte, a situação) e
// o dinheiro que passou entre vocês. Aguardando aprovação vem primeiro; aprovação, Recusar e responsável na própria
// linha. Filtros no servidor (quem pagou, categoria, situação); com categoria ou situação, o dinheiro entre vocês sai
// (não tem categoria nem aprovação).
import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import { getAcertos, getDespesasFamilia } from "../services/familiaService"
import { usePeriodoFamilia } from "../estado/espaco"
import type { AcertoContas, DespesaCompartilhada } from "../types/Familia"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Campo from "../componentes/Campo"
import { GrupoFicha, ListaFicha } from "../componentes/ListaFicha"
import NavegadorMes, { nomeDoPeriodo } from "../componentes/NavegadorMes"
import PainelFiltros from "../componentes/PainelFiltros"
import Selecao from "../componentes/Selecao"
import { APROVACAO, PAPEL_PERMISSAO, primeiroNome } from "../dominio/familia"
import { Acerto, Alerta, Despesa, fotosDe, papeisDe, useFamilia } from "./FamiliaPecas"
import styles from "./Familia.module.css"

type Filtros = { pagadorId: string; categoriaId: string; situacao: "" | "esperando" | "dividida" | "recusada" }
const SEM_FILTRO: Filtros = { pagadorId: "", categoriaId: "", situacao: "" }
const SITUACOES = [
  { valor: "", rotulo: "Qualquer situação" },
  { valor: "esperando", rotulo: "Aguardando aprovação" },
  { valor: "dividida", rotulo: "No equilíbrio do mês" },
  { valor: "recusada", rotulo: "Recusada" },
]
type Linha = { tipo: "despesa"; quando: string; d: DespesaCompartilhada } | { tipo: "acerto"; quando: string; a: AcertoContas }

export default function FamiliaTransacoes() {
  const { id = "" } = useParams<{ id: string }>()
  const { usuario } = useAuth()
  const meuId = usuario?.id ?? ""
  const [versao, setVersao] = useState(0)
  const recarregar = () => setVersao((v) => v + 1)
  const { detalhe, erro } = useFamilia(id, versao)
  const [periodo, setPeriodo] = usePeriodoFamilia()
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTRO)
  const [rascunho, setRascunho] = useState<Filtros>(SEM_FILTRO)
  const [painel, setPainel] = useState(false)
  const [despesas, setDespesas] = useState<DespesaCompartilhada[] | null>(null)
  const [acertos, setAcertos] = useState<AcertoContas[] | null>(null)
  // As categorias que aparecem no mês (pra escolher no filtro), da lista sem filtro.
  const [categorias, setCategorias] = useState<{ valor: string; rotulo: string }[]>([])
  const semAcertos = !!(filtros.categoriaId || filtros.situacao)

  useEffect(() => {
    let vivo = true
    getDespesasFamilia(id, periodo.mes, periodo.ano).then((d) => {
      if (!vivo) return
      const vistas = new Map<string, string>()
      for (const x of d) if (x.categoriaId && x.categoriaNome) vistas.set(x.categoriaId, x.categoriaNome)
      setCategorias([...vistas].map(([valor, rotulo]) => ({ valor, rotulo })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")))
    }).catch(() => { /* o filtro fica sem categorias */ })
    return () => { vivo = false }
  }, [id, periodo, versao])

  useEffect(() => {
    let vivo = true
    setDespesas(null); setAcertos(null)
    getDespesasFamilia(id, periodo.mes, periodo.ano, {
      pagadorId: filtros.pagadorId || undefined, categoriaId: filtros.categoriaId || undefined, situacao: filtros.situacao || undefined,
    }).then((d) => { if (vivo) setDespesas(d) }).catch(() => { if (vivo) setDespesas([]) })
    if (semAcertos) setAcertos([])
    else getAcertos(id, periodo.mes, periodo.ano, filtros.pagadorId || undefined)
      .then((a) => { if (vivo) setAcertos(a) }).catch(() => { if (vivo) setAcertos([]) })
    return () => { vivo = false }
  }, [id, periodo, versao, filtros, semAcertos])

  const fecharPainel = useCallback(() => setPainel(false), [])
  const linhas = useMemo<Linha[]>(() => [
    ...(despesas ?? []).filter((d) => d.statusAprovacao !== APROVACAO.pendente).map((d) => ({ tipo: "despesa" as const, quando: d.data, d })),
    ...(acertos ?? []).map((a) => ({ tipo: "acerto" as const, quando: a.data ?? a.criadoEm, a })),
  ].sort((x, y) => y.quando.localeCompare(x.quando)), [despesas, acertos])

  if (erro) return <div className={styles.pagina}><Alerta erro={erro} /></div>
  if (!detalhe) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>

  const { podeAgir } = papeisDe(detalhe, meuId)
  const aqui = `/familias/${detalhe.id}/transacoes`
  const mesNome = nomeDoPeriodo(periodo)
  const membrosOpcoes = detalhe.membros.map((m) => ({ valor: m.usuarioId, rotulo: primeiroNome(m.nomeUsuario) }))
  const quemLanca = detalhe.membros.filter((m) => m.papelPermissao !== PAPEL_PERMISSAO.dependente)
    .map((m) => ({ valor: m.usuarioId, rotulo: m.usuarioId === meuId ? `${primeiroNome(m.nomeUsuario)} (você)` : primeiroNome(m.nomeUsuario) }))
  const pendentes = (despesas ?? []).filter((d) => d.statusAprovacao === APROVACAO.pendente)
  const fotos = fotosDe(detalhe)
  const ativos = [filtros.pagadorId, filtros.categoriaId, filtros.situacao].filter(Boolean).length
  const carregando = despesas === null || acertos === null
  const vazio = !carregando && pendentes.length === 0 && linhas.length === 0
  const despesa = (d: DespesaCompartilhada) => <Despesa key={d.id} d={d} familiaId={detalhe.id} meuId={meuId} podeAgir={podeAgir} membros={membrosOpcoes} voltarPara={aqui} aoMudar={recarregar} foto={fotos[d.pagadorUsuarioId]} />

  return (
    <div className={styles.pagina}>
      <div className={styles.barraMes}>
        <div className={styles.barraMesNav}><NavegadorMes periodo={periodo} onChange={setPeriodo} /></div>
        <PainelFiltros ativos={ativos} aberto={painel} aoAbrir={() => { setRascunho(filtros); setPainel(true) }} aoFechar={fecharPainel}
          aoAplicar={() => { setFiltros(rascunho); setPainel(false) }} aoLimpar={() => { setRascunho(SEM_FILTRO); setFiltros(SEM_FILTRO); setPainel(false) }}>
          <Campo rotulo="Quem pagou">
            <Selecao tamanho="sm" valor={rascunho.pagadorId} onChange={(v) => setRascunho((r) => ({ ...r, pagadorId: v }))}
              opcoes={[{ valor: "", rotulo: "Qualquer pessoa" }, ...quemLanca]} />
          </Campo>
          <Campo rotulo="Categoria">
            <Selecao tamanho="sm" valor={rascunho.categoriaId} onChange={(v) => setRascunho((r) => ({ ...r, categoriaId: v }))}
              opcoes={[{ valor: "", rotulo: "Qualquer categoria" }, ...categorias]} />
          </Campo>
          <Campo rotulo="Situação">
            <Selecao tamanho="sm" valor={rascunho.situacao} onChange={(v) => setRascunho((r) => ({ ...r, situacao: v as Filtros["situacao"] }))}
              opcoes={SITUACOES} />
          </Campo>
        </PainelFiltros>
      </div>
      <Bloco semRespiro>
        {carregando ? <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
          : vazio ? <p className={styles.vazio}>{ativos > 0 ? "Nada com esses filtros." : `Nada da casa em ${mesNome.toLowerCase()}.`}</p>
          : (
            <ListaFicha rotulo="Transações da família">
              {pendentes.length > 0 && <GrupoFicha rotulo="Aguardando aprovação">{pendentes.map(despesa)}</GrupoFicha>}
              {linhas.length > 0 && (
                <GrupoFicha rotulo={mesNome}>
                  {linhas.map((l) => l.tipo === "despesa" ? despesa(l.d)
                    : <Acerto key={l.a.id} a={l.a} familiaId={detalhe.id} podeAgir={podeAgir} aoMudar={recarregar} foto={fotos[l.a.deUsuarioId]} />)}
                </GrupoFicha>
              )}
            </ListaFicha>
          )}
      </Bloco>
    </div>
  )
}
