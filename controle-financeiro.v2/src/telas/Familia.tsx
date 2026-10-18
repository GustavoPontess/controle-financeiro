// Página de uma família (/familias/:id), o carro-chefe do produto. Três abas (pesquisa de 2026-10-18: Splitwise,
// Tricount e Settle Up separam despesas de saldos; Monarch põe membros e papéis longe do dia a dia):
// - Mês: o equilíbrio (quanto cada um pagou e a parte de cada um, como FATO: "pagou a mais", "pagou a menos",
//   "equilibrado"; nunca "deve"), a sugestão de quem passa quanto pra quem zerar o mês, as despesas compartilhadas
//   (aprovação e responsável na própria linha) e o dinheiro que já passou entre vocês;
// - Pessoas: membros (renda e relação na própria ficha; admin promove, rebaixa e remove), convites, dependentes;
// - Regras: como divide, a partir de quanto precisa de aprovação, e sair ou dissolver.
// O servidor é quem manda nas permissões; a tela só esconde o que a pessoa não pode fazer.
// Visão: docs/features/familia/visao.md; permissões: docs/features/familia/papeis-permissoes.md.
import { useEffect, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowRight, Check, ChevronLeft, ChevronRight, Pencil, Trash2, X, ExternalLink, LogOut } from "lucide-react"
import { Link } from "react-router-dom"
import { useAuth } from "../auth/useAuth"
import {
  aprovarDespesa, atribuirResponsavel, cancelarAcerto, definirLimiteAprovacao, definirModoRateio,
  dissolverFamilia, editarPapel, editarPermissao, getAcertos, getBalancoFamilia, getDependentes, getDespesasFamilia,
  getFamilia, inativarDependente, rejeitarDespesa, removerMembro, revogarConvite,
} from "../services/familiaService"
import { getRendaFamilia } from "../services/rendaService"
import { mensagemDeErro } from "../api/cliente"
import type { AcertoContas, BalancoFamilia, ConviteFamilia, Dependente, DespesaCompartilhada, FamiliaDetalhe, MembroFamilia, ModoRateio } from "../types/Familia"
import type { RendaFamilia } from "../types/Renda"
import { VISIBILIDADE_RENDA } from "../types/Renda"

import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Entrada from "../componentes/Entrada"
import EntradaValor from "../componentes/EntradaValor"
import Etiqueta from "../componentes/Etiqueta"
import { AcoesFicha, DadosFicha, GrupoFicha, InicialFicha, ItemFicha, ListaFicha } from "../componentes/ListaFicha"
import Segmentos from "../componentes/Segmentos"
import Selecao from "../componentes/Selecao"
import { APROVACAO, MAX_PAPEL, MODOS_RATEIO, PAPEL_PERMISSAO, ROTULO_PERMISSAO, fraseSaldo, nomeDoMes, primeiroNome, rotuloModoRateio, rotuloTipoDependente, rotuloVisibilidade, sugerirEquilibrio } from "../dominio/familia"
import { dataBR } from "../utils/dateTime"
import { moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./Familia.module.css"

type Aba = "mes" | "pessoas" | "regras"
const ABAS: { valor: Aba; rotulo: string }[] = [{ valor: "mes", rotulo: "Mês" }, { valor: "pessoas", rotulo: "Pessoas" }, { valor: "regras", rotulo: "Regras" }]
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export default function Familia() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const aba: Aba = (ABAS.find((a) => a.valor === params.get("aba"))?.valor) ?? "mes"
  const { usuario } = useAuth()
  const meuId = usuario?.id ?? ""
  const [detalhe, setDetalhe] = useState<FamiliaDetalhe | null>(null)
  const [dependentes, setDependentes] = useState<Dependente[] | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState(() => { const h = new Date(); return { mes: h.getMonth() + 1, ano: h.getFullYear() } })
  const [balanco, setBalanco] = useState<BalancoFamilia | null>(null)
  const [despesas, setDespesas] = useState<DespesaCompartilhada[] | null>(null)
  const [acertos, setAcertos] = useState<AcertoContas[] | null>(null)
  // Renda da casa: calculada no servidor pra quem pede (só entra quem liberou o valor pra essa pessoa).
  const [renda, setRenda] = useState<RendaFamilia | null>(null)
  const [responsavelFiltro, setResponsavelFiltro] = useState("")
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    let vivo = true
    getFamilia(id).then((d) => { if (vivo) setDetalhe(d) }).catch(() => { if (vivo) setErroCarga("Não deu pra carregar a família. Recarregue a página.") })
    getDependentes(id).then((d) => { if (vivo) setDependentes(d) }).catch(() => { if (vivo) setDependentes([]) })
    return () => { vivo = false }
  }, [id, versao])

  useEffect(() => {
    let vivo = true
    setBalanco(null); setDespesas(null); setAcertos(null)
    getBalancoFamilia(id, periodo.mes, periodo.ano).then((b) => { if (vivo) setBalanco(b) }).catch(() => { /* sem balanço */ })
    getDespesasFamilia(id, periodo.mes, periodo.ano, responsavelFiltro || undefined).then((d) => { if (vivo) setDespesas(d) }).catch(() => { if (vivo) setDespesas([]) })
    getAcertos(id, periodo.mes, periodo.ano).then((a) => { if (vivo) setAcertos(a) }).catch(() => { if (vivo) setAcertos([]) })
    getRendaFamilia(id, periodo.ano, periodo.mes).then((r) => { if (vivo) setRenda(r) }).catch(() => { /* sem o bloco */ })
    return () => { vivo = false }
  }, [id, periodo, responsavelFiltro, versao])

  const recarregar = () => setVersao((v) => v + 1)
  const mudarMes = (delta: number) => setPeriodo((p) => { const d = new Date(p.ano, p.mes - 1 + delta, 1); return { mes: d.getMonth() + 1, ano: d.getFullYear() } })
  const trocarAba = (a: Aba) => setParams(a === "mes" ? {} : { aba: a }, { replace: true })

  if (erroCarga) return <div className={styles.pagina}><p className={styles.alerta} role="alert">{erroCarga}</p></div>
  if (!detalhe) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>

  const eu = detalhe.membros.find((m) => m.usuarioId === meuId)
  const souCriador = detalhe.criadoPorUsuarioId === meuId
  const admin = detalhe.ehAdmin
  // Quem só vê (permissão Dependente) não lança, não aprova, não passa dinheiro: a tela nem mostra essas ações.
  const podeAgir = (eu?.papelPermissao ?? PAPEL_PERMISSAO.dependente) !== PAPEL_PERMISSAO.dependente
  const membrosOpcoes = detalhe.membros.map((m) => ({ valor: m.usuarioId, rotulo: primeiroNome(m.nomeUsuario) }))
  const mesNome = nomeDoMes(periodo.mes, periodo.ano)
  const equilibrio = balanco ? sugerirEquilibrio(balanco.saldos) : []
  // "Renda da casa" só aparece se alguém ALÉM de você liberou o valor pra você (a sua sozinha não é "da casa").
  const rendaDaCasa = renda && renda.membros.some((m) => m.mostrada && m.usuarioId !== meuId) ? renda : null

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div className={styles.identidade}>
          <span className={styles.marcaGrande} aria-hidden="true">{detalhe.nome.trim().charAt(0).toUpperCase()}</span>
          <div className={styles.identidadeTexto}>
            <h1 className={styles.titulo}>{detalhe.nome}</h1>
            <span className={styles.muted}>{detalhe.membros.length} {detalhe.membros.length === 1 ? "pessoa" : "pessoas"}{eu ? ` · você: ${eu.papel}` : ""}</span>
          </div>
        </div>
        <div className={styles.chips}>
          {eu && <Etiqueta>{ROTULO_PERMISSAO[eu.papelPermissao]}</Etiqueta>}
          <Etiqueta>{rotuloModoRateio(detalhe.modoRateioPadrao)}</Etiqueta>
        </div>
      </header>

      <Segmentos ariaLabel="Parte da família" valor={aba} onChange={trocarAba} opcoes={ABAS} />

      {aba === "mes" && (
        <>
          <Bloco semRespiro>
            <div className={styles.toolbar}>
              <span className={styles.toolbarTitulo}>Equilíbrio de {mesNome.toLowerCase()}</span>
              <span className={styles.meses}>
                <Botao soIcone aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft size={16} strokeWidth={2.25} /></Botao>
                <Botao soIcone aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight size={16} strokeWidth={2.25} /></Botao>
              </span>
            </div>
            {balanco === null ? <div className={styles.respiro}><Esqueleto linhas={2} altura={18} /></div> : (
              <div className={styles.balanco}>
                <div className={styles.balancoTotal}>
                  <span className={styles.rotulo}>Despesas da família no mês</span>
                  <Dinheiro valor={balanco.total} className={styles.grande} />
                </div>
                <ul className={styles.saldos} aria-label="Quanto cada um pagou">
                  {balanco.saldos.map((s) => {
                    const f = fraseSaldo(s.saldo)
                    return (
                      <li key={s.usuarioId}>
                        <InicialFicha texto={s.nome} destaque={s.usuarioId === meuId} />
                        <span className={styles.saldoTexto}>
                          <span className={styles.saldoNome}>{primeiroNome(s.nome)}{s.usuarioId === meuId && <span className={styles.voce}> você</span>}</span>
                          <span className={styles.saldoDetalhe}>pagou <Dinheiro valor={s.pagou} /> · a parte é <Dinheiro valor={s.cota} /></span>
                        </span>
                        <span className={styles.saldoValor} data-tom={f.tom}>{f.tom === "neutro" ? "Equilibrado" : <>{f.texto} <Dinheiro valor={Math.abs(s.saldo)} /></>}</span>
                      </li>
                    )
                  })}
                </ul>
                {/* Sugestão pra zerar o mês (modelo Tricount): quem passa quanto pra quem. É sugestão, não cobrança. */}
                {balanco.total > 0 && (
                  <div className={styles.equilibrio} data-ok={equilibrio.length === 0 || undefined}>
                    {equilibrio.length === 0 ? (
                      <span className={styles.equilibrioOk}><Check size={16} strokeWidth={2.5} aria-hidden="true" />Mês equilibrado</span>
                    ) : (
                      <>
                        <span className={styles.rotulo}>Pra equilibrar o mês</span>
                        <ul className={styles.equilibrioLista} aria-label="Pra equilibrar o mês">
                          {equilibrio.map((e) => (
                            <li key={`${e.deUsuarioId}-${e.paraUsuarioId}`}>
                              <span className={styles.equilibrioTexto}>{e.de} <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" /> {e.para} <Dinheiro valor={e.valor} className={styles.equilibrioValor} /></span>
                              {podeAgir && <Botao onClick={() => navigate(`/familias/${detalhe.id}/acertos/novo`, { state: { de: e.deUsuarioId, para: e.paraUsuarioId, valor: e.valor } })}>Marcar como feito</Botao>}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </Bloco>

          {rendaDaCasa && (
            <Bloco titulo={`Renda da casa em ${mesNome.toLowerCase()}`}>
              <div className={styles.rendaCasa}>
                <div className={styles.balancoTotal}>
                  <span className={styles.rotulo}>Recebido até agora{rendaDaCasa.previsto > 0 && <> · previsto <Dinheiro valor={rendaDaCasa.previsto} /></>}</span>
                  <Dinheiro valor={rendaDaCasa.total} className={styles.grande} />
                </div>
                <ul className={styles.rendaMembros} aria-label="Renda por pessoa">
                  {rendaDaCasa.membros.map((m) => (
                    <li key={m.usuarioId}>
                      <InicialFicha texto={m.nome} destaque={m.usuarioId === meuId} />
                      <span className={styles.saldoNome}>{primeiroNome(m.nome)}{m.usuarioId === meuId && <span className={styles.voce}> você</span>}</span>
                      {m.mostrada
                        ? <span className={styles.rendaMembroValor}><Dinheiro valor={m.recebido ?? 0} />{(m.previsto ?? 0) > 0 && <span className={styles.dica}> de <Dinheiro valor={m.previsto ?? 0} /></span>}</span>
                        : <span className={styles.dica}>não mostrada</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </Bloco>
          )}

          <Bloco titulo="Despesas compartilhadas" semRespiro>
            {detalhe.membros.length > 1 && (
              <div className={styles.filtro}>
                <Selecao tamanho="sm" valor={responsavelFiltro} ariaLabel="Responsável" placeholder="Todos"
                  opcoes={[{ valor: "", rotulo: "Todos" }, ...membrosOpcoes]} onChange={setResponsavelFiltro} />
              </div>
            )}
            {despesas === null ? <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
              : despesas.length === 0 ? <p className={styles.vazio}>{responsavelFiltro ? "Nada com esse responsável neste mês." : `Nenhuma despesa compartilhada em ${mesNome.toLowerCase()}.`}</p>
              : (
                <ListaFicha rotulo="Despesas compartilhadas">
                  <GrupoFicha rotulo="Despesas">
                    {despesas.map((d) => <Despesa key={d.id} d={d} familiaId={detalhe.id} meuId={meuId} podeAgir={podeAgir} membros={membrosOpcoes} aoMudar={recarregar} />)}
                  </GrupoFicha>
                </ListaFicha>
              )}
          </Bloco>

          <Bloco titulo="Entre vocês" semRespiro acao={podeAgir ? "Registrar" : undefined} aoClicar={() => navigate(`/familias/${detalhe.id}/acertos/novo`)}>
            {acertos === null ? <div className={styles.respiro}><Esqueleto linhas={2} altura={18} /></div>
              : acertos.length === 0 ? <p className={styles.vazio}>Nenhum dinheiro passou entre vocês em {mesNome.toLowerCase()}.</p>
              : (
                <ListaFicha rotulo="Entre vocês">
                  <GrupoFicha rotulo="Dinheiro que passou entre vocês">
                    {acertos.map((a) => <Acerto key={a.id} a={a} familiaId={detalhe.id} podeAgir={podeAgir} aoMudar={recarregar} />)}
                  </GrupoFicha>
                </ListaFicha>
              )}
          </Bloco>
        </>
      )}

      {aba === "pessoas" && (
        <>
          <Bloco titulo="Membros" semRespiro acao={admin ? "Convidar" : undefined} aoClicar={() => navigate(`/familias/${detalhe.id}/convidar`)}>
            <ListaFicha rotulo="Membros">
              <GrupoFicha rotulo="Quem está">
                {detalhe.membros.map((m) => <Membro key={m.id} m={m} familia={detalhe} meuId={meuId} renda={renda?.membros.find((r) => r.usuarioId === m.usuarioId)} aoMudar={recarregar} />)}
              </GrupoFicha>
              {detalhe.convitesPendentes.length > 0 && (
                <GrupoFicha rotulo="Convites pendentes">
                  {detalhe.convitesPendentes.map((c) => <Convite key={c.id} c={c} familiaId={detalhe.id} admin={admin} aoMudar={recarregar} />)}
                </GrupoFicha>
              )}
            </ListaFicha>
          </Bloco>

          <Bloco titulo="Dependentes" semRespiro acao={podeAgir ? "Adicionar" : undefined} aoClicar={() => navigate(`/familias/${detalhe.id}/dependentes/novo`)}>
            {dependentes === null ? <div className={styles.respiro}><Esqueleto linhas={2} altura={18} /></div>
              : dependentes.length === 0 ? <p className={styles.vazio}>Filhos, pais, pets: quem não usa o app mas tem gasto que a família acompanha.</p>
              : (
                <ListaFicha rotulo="Dependentes">
                  <GrupoFicha rotulo="Dependentes da família">
                    {dependentes.map((d) => <DependenteLinha key={d.id} d={d} familiaId={detalhe.id} podeAgir={podeAgir} aoMudar={recarregar} />)}
                  </GrupoFicha>
                </ListaFicha>
              )}
          </Bloco>
        </>
      )}

      {aba === "regras" && (
        <>
          <Regras familia={detalhe} aoMudar={recarregar} />
          <SairOuDissolver familia={detalhe} eu={eu} souCriador={souCriador} />
        </>
      )}
    </div>
  )
}

// ── Sair (quem não criou) ou dissolver (quem criou), com confirmação ─────────────────────────────────────
function SairOuDissolver({ familia, eu, souCriador }: { familia: FamiliaDetalhe; eu?: MembroFamilia; souCriador: boolean }) {
  const navigate = useNavigate()
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  if (!eu) return null
  const confirmar = async () => {
    setOcupado(true); setErro(null)
    try {
      if (souCriador) await dissolverFamilia(familia.id); else await removerMembro(familia.id, eu.id)
      navigate("/familias", { replace: true })
    } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setConfirmando(false) }
  }
  return (
    <Bloco titulo={souCriador ? "Dissolver a família" : "Sair da família"}>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      <p className={styles.muted}>{souCriador
        ? "Ninguém mais vê as despesas compartilhadas, o que passou entre vocês e os dependentes. Os lançamentos de cada um continuam nas contas de cada um."
        : "Você deixa de ver as despesas e o equilíbrio do mês. Seus lançamentos continuam com você."}</p>
      <div className={styles.fichaFormAcoes}>
        <Botao perigo onClick={() => setConfirmando(true)} icone={souCriador ? <Trash2 size={15} strokeWidth={2.25} aria-hidden="true" /> : <LogOut size={15} strokeWidth={2.25} aria-hidden="true" />}>
          {souCriador ? "Dissolver" : "Sair da família"}
        </Botao>
      </div>
      <Confirmar aberto={confirmando} perigo ocupado={ocupado} titulo={souCriador ? "Dissolver a família?" : "Sair da família?"}
        texto={souCriador ? "Não dá pra desfazer." : "Pra voltar, alguém precisa te convidar de novo."}
        rotuloConfirmar={souCriador ? "Dissolver" : "Sair"} onConfirmar={confirmar} onCancelar={() => setConfirmando(false)} />
    </Bloco>
  )
}

// ── Membro: a linha e a ficha (e-mail, renda, relação); as ações dependem de quem olha ──────────────────
function Membro({ m, familia, meuId, renda, aoMudar }: {
  m: MembroFamilia; familia: FamiliaDetalhe; meuId: string; renda?: RendaFamilia["membros"][number]; aoMudar: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<"papel" | null>(null)
  const [papel, setPapel] = useState(m.papel)
  const [erroPapel, setErroPapel] = useState<string | undefined>()
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const sou = m.usuarioId === meuId
  const criador = m.usuarioId === familia.criadoPorUsuarioId
  const admin = familia.ehAdmin

  const rodar = async (acao: () => Promise<unknown>) => {
    setOcupado(true); setErro(null)
    try { await acao(); setEditando(null); aoMudar() } catch (e) { setErro(mensagemDeErro(e)) }
    setOcupado(false)
  }
  const salvarPapel = () => {
    if (!papel.trim()) { setErroPapel("Diga qual é a sua relação com a família."); return }
    void rodar(() => editarPapel(familia.id, m.id, papel.trim()))
  }

  return (
    <>
      <ItemFicha id={`membro-${m.id}`} aberto={aberto} aoAbrir={() => setAberto((a) => !a)}
        marca={<InicialFicha texto={m.nomeUsuario} destaque={sou} />}
        titulo={<>{m.nomeUsuario}{sou && <span className={styles.voce}> você</span>}</>}
        detalhe={`${m.papel} · desde ${dataBR(m.entrouEm)}`}
        direita={<Etiqueta>{ROTULO_PERMISSAO[m.papelPermissao]}</Etiqueta>}>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <DadosFicha>
          <div><dt>E-mail</dt><dd>{m.emailUsuario}</dd></div>
          {/* Renda é da pessoa: o que aparece aqui é o que ELA liberou pra quem está olhando (o servidor decide). */}
          <div>
            <dt>Renda</dt>
            <dd>
              {sou
                ? <>{rotuloVisibilidade(m.visibilidadeRenda)} <Link to="/renda" className={styles.linkFicha}>mudar</Link></>
                : renda?.mostrada
                  ? <><Dinheiro valor={renda.recebido ?? 0} /> este mês{(renda.previsto ?? 0) > 0 && <span className={styles.dica}> · previsto <Dinheiro valor={renda.previsto ?? 0} /></span>}</>
                  : m.visibilidadeRenda === VISIBILIDADE_RENDA.nada ? "Não compartilha" : "Só o peso na divisão"}
            </dd>
          </div>
        </DadosFicha>
        {editando === "papel" && (
          <div className={styles.fichaForm}>
            <Campo rotulo="Sua relação com a família" erro={erroPapel}>
              <Entrada value={papel} maxLength={MAX_PAPEL} placeholder="Cônjuge" autoFocus onChange={(e) => { setPapel(e.target.value); setErroPapel(undefined) }} />
            </Campo>
            <div className={styles.fichaFormAcoes}>
              <Botao onClick={() => setEditando(null)} disabled={ocupado}>Cancelar</Botao>
              <Botao variante="primario" disabled={ocupado} onClick={salvarPapel}>Salvar</Botao>
            </div>
          </div>
        )}
        {editando === null && (
          <AcoesFicha>
            {admin && !criador && !sou && (
              <Botao variante="texto" perigo disabled={ocupado} onClick={() => setRemovendo(true)} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Remover</Botao>
            )}
            {sou && <Botao onClick={() => setEditando("papel")} icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />}>Minha relação</Botao>}
            {admin && !criador && !sou && m.papelPermissao !== PAPEL_PERMISSAO.admin && (
              <Botao disabled={ocupado} onClick={() => rodar(() => editarPermissao(familia.id, m.id, PAPEL_PERMISSAO.admin))}>Tornar admin</Botao>
            )}
            {admin && !criador && !sou && m.papelPermissao === PAPEL_PERMISSAO.admin && (
              <Botao disabled={ocupado} onClick={() => rodar(() => editarPermissao(familia.id, m.id, PAPEL_PERMISSAO.membro))}>Tirar de admin</Botao>
            )}
            {admin && !criador && !sou && m.papelPermissao === PAPEL_PERMISSAO.dependente && (
              <Botao disabled={ocupado} onClick={() => rodar(() => editarPermissao(familia.id, m.id, PAPEL_PERMISSAO.membro))}>Deixar lançar</Botao>
            )}
          </AcoesFicha>
        )}
      </ItemFicha>
      <Confirmar aberto={removendo} perigo ocupado={ocupado} titulo={`Remover ${primeiroNome(m.nomeUsuario)} da família?`}
        texto="A pessoa deixa de ver as despesas e o equilíbrio. Os lançamentos dela continuam com ela." rotuloConfirmar="Remover"
        onConfirmar={() => { setRemovendo(false); void rodar(() => removerMembro(familia.id, m.id)) }} onCancelar={() => setRemovendo(false)} />
    </>
  )
}

function Convite({ c, familiaId, admin, aoMudar }: { c: ConviteFamilia; familiaId: string; admin: boolean; aoMudar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const revogar = async () => {
    setOcupado(true); setErro(null)
    try { await revogarConvite(familiaId, c.id); aoMudar() } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false) }
  }
  return (
    <ItemFicha id={`convite-${c.id}`} aberto={aberto} aoAbrir={() => setAberto((a) => !a)} apagado
      marca={<InicialFicha texto={c.emailConvidado} />} titulo={c.emailConvidado} detalhe={`${c.papel} · vale até ${dataBR(c.expiraEm)}`}
      direita={<Etiqueta tom="alerta">Aguardando</Etiqueta>}>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      <p className={styles.dica}>A pessoa aceita em Famílias, no app dela, com o e-mail {c.emailConvidado}.</p>
      {admin && <AcoesFicha><Botao variante="texto" perigo disabled={ocupado} onClick={revogar}>Cancelar convite</Botao></AcoesFicha>}
    </ItemFicha>
  )
}

// ── Despesa compartilhada: quem pagou, aprovação e responsável na própria linha ─────────────────────────────
function Despesa({ d, familiaId, meuId, podeAgir, membros, aoMudar }: {
  d: DespesaCompartilhada; familiaId: string; meuId: string; podeAgir: boolean; membros: { valor: string; rotulo: string }[]; aoMudar: () => void
}) {
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const minha = d.pagadorUsuarioId === meuId
  const rodar = async (acao: () => Promise<unknown>) => {
    setOcupado(true); setErro(null)
    try { await acao(); aoMudar() } catch (e) { setErro(mensagemDeErro(e)) }
    setOcupado(false)
  }
  const etiqueta = d.statusAprovacao === APROVACAO.pendente ? <Etiqueta tom="alerta">Aguardando aprovação</Etiqueta>
    : d.statusAprovacao === APROVACAO.rejeitada ? <Etiqueta tom="negativo">Rejeitada</Etiqueta>
    : d.statusAprovacao === APROVACAO.aprovada ? <Etiqueta tom="positivo">Aprovada</Etiqueta> : null

  return (
    <ItemFicha id={`despesa-${d.id}`} aberto={aberto} aoAbrir={() => setAberto((a) => !a)}
      marca={<InicialFicha texto={d.pagadorNome} destaque={minha} />}
      titulo={d.descricao}
      detalhe={<>{primeiroNome(d.pagadorNome)} pagou · {diaMes(d.data)}{d.categoriaNome ? ` · ${d.categoriaNome}` : ""}{d.responsavelNome ? ` · responsável: ${primeiroNome(d.responsavelNome)}` : ""}</>}
      direita={<span className={styles.direita}>{etiqueta}<Dinheiro valor={d.valor} className={styles.valor} /></span>}>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      <DadosFicha>
        <div><dt>Quem pagou</dt><dd>{d.pagadorNome}</dd></div>
        <div><dt>Data</dt><dd>{dataBR(d.data)}</dd></div>
        <div><dt>Categoria</dt><dd>{d.categoriaNome ?? "Sem categoria"}</dd></div>
        {d.statusAprovacao === APROVACAO.aprovada && d.aprovadoPorNome && <div><dt>Aprovada por</dt><dd>{d.aprovadoPorNome}</dd></div>}
      </DadosFicha>
      {podeAgir && (
        <div className={styles.fichaForm}>
          <Campo rotulo="Responsável">
            <Selecao tamanho="sm" valor={d.responsavelUsuarioId ?? ""} placeholder="Ninguém" desabilitado={ocupado}
              opcoes={[{ valor: "", rotulo: "Ninguém" }, ...membros]} onChange={(v) => rodar(() => atribuirResponsavel(familiaId, d.id, v || null))} />
          </Campo>
        </div>
      )}
      <AcoesFicha>
        {minha && <Botao variante="texto" onClick={() => navigate(`/transacoes/${d.id}`, { state: { voltarPara: `/familias/${familiaId}` } })} icone={<ExternalLink size={15} strokeWidth={2.25} aria-hidden="true" />}>Abrir lançamento</Botao>}
        {podeAgir && !minha && d.statusAprovacao === APROVACAO.pendente && (
          <>
            <Botao perigo disabled={ocupado} onClick={() => rodar(() => rejeitarDespesa(familiaId, d.id))} icone={<X size={15} strokeWidth={2.5} aria-hidden="true" />}>Rejeitar</Botao>
            <Botao variante="primario" disabled={ocupado} onClick={() => rodar(() => aprovarDespesa(familiaId, d.id))} icone={<Check size={15} strokeWidth={2.5} aria-hidden="true" />}>Aprovar</Botao>
          </>
        )}
      </AcoesFicha>
    </ItemFicha>
  )
}

function Acerto({ a, familiaId, podeAgir, aoMudar }: { a: AcertoContas; familiaId: string; podeAgir: boolean; aoMudar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const cancelar = async () => {
    setOcupado(true); setErro(null); setConfirmando(false)
    try { await cancelarAcerto(familiaId, a.id); aoMudar() } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false) }
  }
  return (
    <>
      <ItemFicha id={`acerto-${a.id}`} aberto={aberto} aoAbrir={() => setAberto((act) => !act)}
        marca={<InicialFicha texto={a.deNome} />}
        titulo={<>{primeiroNome(a.deNome)} <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" className={styles.seta} /> {primeiroNome(a.paraNome)}</>}
        detalhe={`${dataBR(a.criadoEm)}${a.observacao ? ` · ${a.observacao}` : ""}`}
        direita={<Dinheiro valor={a.valor} className={styles.valor} />}>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <p className={styles.dica}>Registro de que o valor passou de uma pessoa pra outra; as contas de cada um não mudam.</p>
        {podeAgir && <AcoesFicha><Botao variante="texto" perigo disabled={ocupado} onClick={() => setConfirmando(true)}>Desfazer</Botao></AcoesFicha>}
      </ItemFicha>
      <Confirmar aberto={confirmando} perigo ocupado={ocupado} titulo="Desfazer este registro?" texto="O valor volta a contar no equilíbrio do mês."
        rotuloConfirmar="Desfazer" rotuloCancelar="Manter" onConfirmar={cancelar} onCancelar={() => setConfirmando(false)} />
    </>
  )
}

function DependenteLinha({ d, familiaId, podeAgir, aoMudar }: { d: Dependente; familiaId: string; podeAgir: boolean; aoMudar: () => void }) {
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const inativar = async () => {
    setOcupado(true); setErro(null); setConfirmando(false)
    try { await inativarDependente(familiaId, d.id); aoMudar() } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false) }
  }
  return (
    <>
      <ItemFicha id={`dependente-${d.id}`} aberto={aberto} aoAbrir={() => setAberto((a) => !a)}
        marca={<InicialFicha texto={d.nome} />} titulo={d.apelido ? `${d.nome} (${d.apelido})` : d.nome}
        detalhe={rotuloTipoDependente(d.tipo)}>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <DadosFicha>
          <div><dt>Tipo</dt><dd>{rotuloTipoDependente(d.tipo)}</dd></div>
          {d.dataNascimento && <div><dt>Nascimento</dt><dd>{dataBR(d.dataNascimento)}</dd></div>}
        </DadosFicha>
        {podeAgir && (
          <AcoesFicha>
            <Botao variante="texto" perigo disabled={ocupado} onClick={() => setConfirmando(true)}>Tirar da família</Botao>
            <Botao onClick={() => navigate(`/familias/${familiaId}/dependentes/${d.id}/editar`)} icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />}>Editar</Botao>
          </AcoesFicha>
        )}
      </ItemFicha>
      <Confirmar aberto={confirmando} perigo ocupado={ocupado} titulo={`Tirar ${d.nome} da família?`} texto="Os lançamentos já atribuídos continuam no histórico."
        rotuloConfirmar="Tirar" onConfirmar={inativar} onCancelar={() => setConfirmando(false)} />
    </>
  )
}

// ── Regras: como divide e a partir de quanto precisa de aprovação (admin muda; os outros veem) ─────────────
function Regras({ familia, aoMudar }: { familia: FamiliaDetalhe; aoMudar: () => void }) {
  const [limite, setLimite] = useState(familia.limiteAprovacao ? moneyParaCampo(familia.limiteAprovacao) : "")
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const rodar = async (acao: () => Promise<unknown>) => {
    setOcupado(true); setErro(null)
    try { await acao(); aoMudar() } catch (e) { setErro(mensagemDeErro(e)) }
    setOcupado(false)
  }
  const modo = MODOS_RATEIO.find((m) => m.valor === familia.modoRateioPadrao) ?? MODOS_RATEIO[0]
  if (!familia.ehAdmin) {
    return (
      <Bloco titulo="Regras">
        <DadosFicha>
          <div><dt>Divisão</dt><dd>{modo.rotulo}<span className={styles.dica}> · {modo.detalhe}</span></dd></div>
          <div><dt>Aprovação</dt><dd>{familia.limiteAprovacao ? <>a partir de <Dinheiro valor={familia.limiteAprovacao} /></> : "Desligada"}</dd></div>
        </DadosFicha>
        <p className={styles.dica}>Só quem é admin muda as regras.</p>
      </Bloco>
    )
  }
  return (
    <Bloco titulo="Regras">
      <div className={styles.regras}>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <Campo rotulo="Divisão das despesas">
          <Selecao valor={String(familia.modoRateioPadrao)} desabilitado={ocupado} onChange={(v) => rodar(() => definirModoRateio(familia.id, Number(v) as ModoRateio))}
            opcoes={MODOS_RATEIO.map((m) => ({ valor: String(m.valor), rotulo: m.rotulo, detalhe: m.detalhe }))} />
        </Campo>
        <Campo rotulo="Aprovação a partir de">
          <EntradaValor compacto valor={limite} onChange={setLimite} />
        </Campo>
        <p className={styles.dica}>Despesa compartilhada desse valor pra cima só entra no equilíbrio depois que outra pessoa aprova. Vazio desliga.</p>
        <div className={styles.fichaFormAcoes}>
          <Botao variante="primario" disabled={ocupado} onClick={() => rodar(() => definirLimiteAprovacao(familia.id, parseMoney(limite) || null))}>Salvar limite</Botao>
        </div>
      </div>
    </Bloco>
  )
}
