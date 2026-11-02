// Admin › Solicitações: o que as pessoas mandaram pelo selo Beta (algo errado / melhoria), mais recentes primeiro.
// Filtro por status e página no servidor. Tocar na linha abre a triagem ali mesmo: status, prioridade (P0 a P3) e
// uma nota que só o admin vê. O que vai pro ROADMAP sai daqui, a pedido do Gustavo.
import { useEffect, useState, type FormEvent } from "react"
import { MessageCircleMore } from "lucide-react"
import adminService from "../services/adminService"
import { mensagemDeErro } from "../api/cliente"
import { STATUS_SOLICITACAO, TIPOS_SOLICITACAO, type SolicitacaoAdmin, type StatusSolicitacao } from "../types/Solicitacao"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import AreaTexto from "../componentes/AreaTexto"
import Etiqueta from "../componentes/Etiqueta"
import Paginacao from "../componentes/Paginacao"
import Segmentos, { type OpcaoSegmento } from "../componentes/Segmentos"
import Selecao from "../componentes/Selecao"
import { diaDeInstante } from "../utils/dateTime"
import { mascararEmail } from "../utils/mascararEmail"
import { useHideBalance } from "../estado/ocultar"
import VerAnexos, { type AnexoParaVer } from "../componentes/VerAnexos"
import styles from "./SolicitacoesAdmin.module.css"

type Filtro = "todas" | "0" | "1" | "2" | "3"
const FILTROS: OpcaoSegmento<Filtro>[] = [
  { valor: "todas", rotulo: "Todas" }, { valor: "0", rotulo: "Recebidas" }, { valor: "1", rotulo: "No backlog" },
  { valor: "2", rotulo: "Feitas" }, { valor: "3", rotulo: "Não vamos fazer" },
]
const TOM: Partial<Record<StatusSolicitacao, "positivo" | "alerta">> = { 0: "alerta", 2: "positivo" }
const PRIORIDADES = [{ valor: "", rotulo: "Sem prioridade" }, ...[0, 1, 2, 3].map((p) => ({ valor: String(p), rotulo: `P${p}` }))]

export default function SolicitacoesAdmin() {
  const [oculto] = useHideBalance()
  const [filtro, setFiltro] = useState<Filtro>("todas")
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(25)
  const [itens, setItens] = useState<SolicitacaoAdmin[] | null>(null)
  const [total, setTotal] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let vivo = true
    setErro(null)
    adminService.solicitacoes(pagina, porPagina, filtro === "todas" ? undefined : (Number(filtro) as StatusSolicitacao))
      .then((r) => { if (vivo) { setItens(r.items); setTotal(r.total) } })
      .catch((e) => { if (vivo) { setErro(mensagemDeErro(e)); setItens((i) => i ?? []) } })
    return () => { vivo = false }
  }, [filtro, pagina, porPagina, versao])

  return (
    <div className={styles.pagina}>
      <Bloco semRespiro>
        <div className={styles.toolbar}>
          <Segmentos ariaLabel="Status" valor={filtro} onChange={(v) => { setFiltro(v); setPagina(1); setAberta(null) }} opcoes={FILTROS} />
        </div>
        {erro && <p className={styles.aviso} role="alert">{erro}</p>}
        {itens === null ? (
          <div className={styles.respiro}><Esqueleto linhas={4} altura={18} /></div>
        ) : itens.length === 0 ? (
          <p className={styles.vazio}>{filtro === "todas" ? "Nenhuma solicitação ainda." : "Nenhuma solicitação nesse status."}</p>
        ) : (
          <ul className={styles.lista} aria-label="Solicitações">
            {itens.map((s) => (
              <li key={s.id} className={styles.item}>
                <button type="button" className={styles.linha} aria-expanded={aberta === s.id} onClick={() => setAberta((a) => (a === s.id ? null : s.id))}>
                  <span className={styles.icone} data-tipo={s.tipo} aria-hidden="true"><MessageCircleMore size={16} strokeWidth={2} /></span>
                  <span className={styles.texto}>
                    <span className={styles.oque}>{s.titulo}</span>
                    <span className={styles.onde}>
                      {TIPOS_SOLICITACAO[s.tipo]} · {s.tela}{s.anexos.length ? ` · ${s.anexos.length === 1 ? "1 anexo" : `${s.anexos.length} anexos`}` : ""} · {s.nomeUsuario} ({oculto ? mascararEmail(s.emailUsuario) : s.emailUsuario}) · {diaDeInstante(s.criadoEm)}
                    </span>
                  </span>
                  {s.prioridade !== null && <Etiqueta>P{s.prioridade}</Etiqueta>}
                  <Etiqueta tom={TOM[s.status]}>{STATUS_SOLICITACAO[s.status]}</Etiqueta>
                </button>
                {aberta === s.id && <Triagem s={s} aoSalvar={() => { setAberta(null); setVersao((v) => v + 1) }} />}
              </li>
            ))}
          </ul>
        )}
        {total > 0 && (
          <Paginacao total={total} pagina={pagina} porPagina={porPagina} onPagina={setPagina}
            onPorPagina={(n) => { setPorPagina(n); setPagina(1) }} rotulo="solicitações" rotuloSingular="solicitação" />
        )}
      </Bloco>
    </div>
  )
}

function Triagem({ s, aoSalvar }: { s: SolicitacaoAdmin; aoSalvar: () => void }) {
  const [status, setStatus] = useState(String(s.status))
  const [prioridade, setPrioridade] = useState(s.prioridade === null ? "" : String(s.prioridade))
  const [nota, setNota] = useState(s.notaAdmin ?? "")
  const [salvando, setSalvando] = useState(false)
  const [vendo, setVendo] = useState<number | null>(null)
  const paraVer: AnexoParaVer[] = s.anexos.map((a) => ({
    url: `/api/v1/admin/solicitacoes/${s.id}/anexos/${a.id}`,
    nome: a.tipo === 1 ? `Print de ${a.tela}` : `${a.bloco ?? "Bloco"} (${a.tela})`,
    texto: a.textoDoBloco, mostrarValores: a.mostrarValores,
  }))
  const [erro, setErro] = useState<string | null>(null)

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    setSalvando(true); setErro(null)
    try {
      await adminService.atualizarSolicitacao(s.id, {
        status: Number(status) as StatusSolicitacao, prioridade: prioridade === "" ? null : Number(prioridade), notaAdmin: nota.trim() || null,
      })
      aoSalvar()
    } catch (err) {
      setErro(mensagemDeErro(err))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form className={styles.triagem} onSubmit={salvar} noValidate>
      {erro && <p className={styles.aviso} role="alert">{erro}</p>}
      {s.janela && <span className={styles.janela}>Janela {s.janela}</span>}
      {s.descricao ? <p className={styles.descricao}>{s.descricao}</p> : <p className={styles.semDescricao}>Sem descrição.</p>}
      {s.anexos.length > 0 && (
        // Os anexos somem 30 dias depois que a solicitação fecha. Clicar abre grande aqui mesmo, com ‹ › entre eles.
        <ul className={styles.anexos} aria-label="Anexos">
          {paraVer.map((a, i) => {
            const anexo = s.anexos[i]
            return (
              <li key={anexo.id} className={styles.anexo}>
                <button type="button" className={styles.anexoImagem} title={a.texto ?? a.nome} aria-label={`Ver ${a.nome}`} onClick={() => setVendo(i)}>
                  <img src={a.url} alt={a.nome} loading="lazy" />
                </button>
                <span className={styles.anexoNome}>{a.nome}</span>
                <Etiqueta tom={a.mostrarValores ? "alerta" : undefined}>{a.mostrarValores ? "Com valores" : "Valores escondidos"}</Etiqueta>
              </li>
            )
          })}
        </ul>
      )}
      {vendo !== null && <VerAnexos anexos={paraVer} indice={vendo} aoMudar={setVendo} aoFechar={() => setVendo(null)} />}
      <div className={styles.campos}>
        <Campo rotulo="Status">
          <Selecao tamanho="sm" valor={status} onChange={setStatus}
            opcoes={([0, 1, 2, 3] as StatusSolicitacao[]).map((v) => ({ valor: String(v), rotulo: STATUS_SOLICITACAO[v] }))} />
        </Campo>
        <Campo rotulo="Prioridade">
          <Selecao tamanho="sm" valor={prioridade} onChange={setPrioridade} opcoes={PRIORIDADES} />
        </Campo>
      </div>
      <Campo rotulo="Nota (só o admin vê)">
        <AreaTexto value={nota} maxLength={1000} rows={2} onChange={(e) => setNota(e.target.value)} />
      </Campo>
      <div className={styles.botoes}>
        <Botao type="submit" variante="primario" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</Botao>
      </div>
    </form>
  )
}
