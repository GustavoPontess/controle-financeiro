// Página de uma família (/familias/:id), o carro-chefe do produto. Desenho aprovado pelo Gustavo em 2026-10-18
// (3 propostas + juízes; docs/features/familia): a página existe pra duas pessoas se entenderem sobre o dinheiro
// do mês em 30 segundos, e todo número é FATO, nunca cobrança.
// - Mês: UM bloco conta o mês (despesas da família; renda da casa só de quem liberou pra quem olha; quem pagou o
//   quê: "pagou a mais / a menos / equilibrado"; "pra equilibrar o mês: X → Y"; o que já passou entre vocês) e,
//   embaixo, as despesas compartilhadas (aguardando aprovação primeiro; aprovação e responsável na própria linha);
// - Pessoas: membros (a sua ficha tem "quem vê a sua renda": uma caixa por pessoa, modelo Honeydue; a dos outros só
//   mostra renda se a pessoa liberou pra você, senão nem linha), convites, dependentes (idade e gasto do mês);
// - Regras: divisão, "pedir OK pra despesa grande" e sair/dissolver.
// Quem "só vê" (permissão Dependente) não age, não vê renda de ninguém e não entra na divisão (o servidor manda).
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { ArrowRight, Check, Pencil, Trash2, X, ExternalLink, LogOut } from "lucide-react"
import { useAuth } from "../auth/useAuth"
import {
  aprovarDespesa, atribuirResponsavel, cancelarAcerto, definirLimiteAprovacao, definirModoRateio, dissolverFamilia,
  editarPapel, editarPermissao, getAcertos, getBalancoFamilia, getDependentes, getDespesasFamilia, getFamilia,
  getGastoDependente, inativarDependente, rejeitarDespesa, removerMembro, revogarConvite,
} from "../services/familiaService"
import { definirVisibilidadeRenda, getRendaFamilia } from "../services/rendaService"
import { mensagemDeErro } from "../api/cliente"
import type { AcertoContas, BalancoFamilia, ConviteFamilia, Dependente, DespesaCompartilhada, FamiliaDetalhe, MembroFamilia, ModoRateio } from "../types/Familia"
import type { RendaFamilia, VisibilidadeRenda } from "../types/Renda"
import { VISIBILIDADE_RENDA } from "../types/Renda"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Entrada from "../componentes/Entrada"
import EntradaValor from "../componentes/EntradaValor"
import Etiqueta from "../componentes/Etiqueta"
import Interruptor from "../componentes/Interruptor"
import { AcoesFicha, DadosFicha, GrupoFicha, InicialFicha, ItemFicha, ListaFicha } from "../componentes/ListaFicha"
import Marcar from "../componentes/Marcar"
import NavegadorMes, { nomeDoPeriodo, periodoDeHoje, type Periodo } from "../componentes/NavegadorMes"
import Segmentos from "../componentes/Segmentos"
import Selecao from "../componentes/Selecao"
import { APROVACAO, MAX_PAPEL, MODOS_RATEIO, PAPEL_PERMISSAO, fraseSaldo, primeiroNome, rotuloTipoDependente, sugerirEquilibrio } from "../dominio/familia"
import { dataBR } from "../utils/dateTime"
import { moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./Familia.module.css"

type Aba = "mes" | "pessoas" | "regras"
const ABAS: { valor: Aba; rotulo: string }[] = [{ valor: "mes", rotulo: "Mês" }, { valor: "pessoas", rotulo: "Pessoas" }, { valor: "regras", rotulo: "Regras" }]
const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const idade = (nascimento: string) => {
  const n = new Date(nascimento.slice(0, 10)), h = new Date()
  let a = h.getFullYear() - n.getFullYear()
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--
  return a
}

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
  const [periodo, setPeriodo] = useState<Periodo>(periodoDeHoje)
  const [balanco, setBalanco] = useState<BalancoFamilia | null>(null)
  const [despesas, setDespesas] = useState<DespesaCompartilhada[] | null>(null)
  const [acertos, setAcertos] = useState<AcertoContas[] | null>(null)
  // Renda da casa: calculada no servidor pra quem pede (só entra quem liberou o valor pra essa pessoa).
  const [renda, setRenda] = useState<RendaFamilia | null>(null)
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
    getDespesasFamilia(id, periodo.mes, periodo.ano).then((d) => { if (vivo) setDespesas(d) }).catch(() => { if (vivo) setDespesas([]) })
    getAcertos(id, periodo.mes, periodo.ano).then((a) => { if (vivo) setAcertos(a) }).catch(() => { if (vivo) setAcertos([]) })
    getRendaFamilia(id, periodo.ano, periodo.mes).then((r) => { if (vivo) setRenda(r) }).catch(() => { /* sem a faixa */ })
    return () => { vivo = false }
  }, [id, periodo, versao])

  const recarregar = () => setVersao((v) => v + 1)
  const trocarAba = (a: Aba) => setParams(a === "mes" ? {} : { aba: a }, { replace: true })

  if (erroCarga) return <div className={styles.pagina}><p className={styles.alerta} role="alert">{erroCarga}</p></div>
  if (!detalhe) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>

  const eu = detalhe.membros.find((m) => m.usuarioId === meuId)
  const souCriador = detalhe.criadoPorUsuarioId === meuId
  const admin = detalhe.ehAdmin
  // Quem só vê não lança, não aprova, não passa dinheiro: a tela nem mostra essas ações.
  const podeAgir = (eu?.papelPermissao ?? PAPEL_PERMISSAO.dependente) !== PAPEL_PERMISSAO.dependente
  const membrosOpcoes = detalhe.membros.map((m) => ({ valor: m.usuarioId, rotulo: primeiroNome(m.nomeUsuario) }))
  const mesNome = nomeDoPeriodo(periodo)
  const mesMin = mesNome.toLowerCase()
  const equilibrio = balanco ? sugerirEquilibrio(balanco.saldos) : []
  // "Renda da casa" só quando alguém ALÉM de você liberou o valor pra você; lista só quem mostra.
  const rendaDaCasa = renda && renda.membros.some((m) => m.mostrada && m.usuarioId !== meuId) ? renda : null
  const pendentes = (despesas ?? []).filter((d) => d.statusAprovacao === APROVACAO.pendente)
  const doMes = (despesas ?? []).filter((d) => d.statusAprovacao !== APROVACAO.pendente)
  const sozinho = detalhe.membros.length === 1

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div className={styles.identidade}>
          <span className={styles.marcaGrande} aria-hidden="true">{detalhe.nome.trim().charAt(0).toUpperCase()}</span>
          <div className={styles.identidadeTexto}>
            <h1 className={styles.titulo}>{detalhe.nome}</h1>
            <span className={styles.iniciais} aria-hidden="true">
              {detalhe.membros.map((m) => <InicialFicha key={m.id} texto={m.nomeUsuario} destaque={m.usuarioId === meuId} />)}
            </span>
          </div>
        </div>
        {eu?.papelPermissao === PAPEL_PERMISSAO.admin && <Etiqueta>Admin</Etiqueta>}
        {eu?.papelPermissao === PAPEL_PERMISSAO.dependente && <Etiqueta>Só vê</Etiqueta>}
      </header>

      <Segmentos ariaLabel="Parte da família" valor={aba} onChange={trocarAba} opcoes={ABAS} />

      {aba === "mes" && (
        <>
          <NavegadorMes periodo={periodo} onChange={setPeriodo} />

          <Bloco>
            {sozinho ? (
              <div className={styles.sozinho}>
                <span>Só você por aqui.</span>
                {admin && <Botao variante="primario" onClick={() => navigate(`/familias/${detalhe.id}/convidar`)}>Convidar</Botao>}
              </div>
            ) : balanco === null ? <Esqueleto linhas={3} altura={18} /> : (
              <div className={styles.mes}>
                <div className={styles.faixa}>
                  <div className={styles.numero}>
                    <span className={styles.rotulo}>Despesas da família</span>
                    <Dinheiro valor={balanco.total} className={styles.grande} />
                  </div>
                  {rendaDaCasa && (
                    <div className={styles.numero}>
                      <span className={styles.rotulo}>Renda da casa{rendaDaCasa.previsto > 0 && <> · esperado <Dinheiro valor={rendaDaCasa.previsto} /></>}</span>
                      <Dinheiro valor={rendaDaCasa.total} className={styles.grande} />
                      <span className={styles.rendaQuem} aria-label="Renda por pessoa">
                        {rendaDaCasa.membros.filter((m) => m.mostrada).map((m) => (
                          <span key={m.usuarioId}>{m.usuarioId === meuId ? "você" : primeiroNome(m.nome)} <Dinheiro valor={m.recebido ?? 0} /></span>
                        ))}
                      </span>
                    </div>
                  )}
                </div>

                {balanco.total === 0 && equilibrio.length === 0 ? (
                  <p className={styles.vazioMes}>Nenhuma despesa compartilhada em {mesMin}.</p>
                ) : (
                  <>
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
                  </>
                )}

                <div className={styles.entreVoces}>
                  {acertos !== null && acertos.length > 0 ? (
                    <ListaFicha rotulo="Entre vocês">
                      <GrupoFicha rotulo="Passou entre vocês" extra={podeAgir ? <Botao variante="texto" onClick={() => navigate(`/familias/${detalhe.id}/acertos/novo`)}>Dinheiro entre vocês</Botao> : undefined}>
                        {acertos.map((a) => <Acerto key={a.id} a={a} familiaId={detalhe.id} podeAgir={podeAgir} aoMudar={recarregar} />)}
                      </GrupoFicha>
                    </ListaFicha>
                  ) : (
                    <>
                      <div className={styles.entreVocesTopo}>
                        <span className={styles.rotulo}>Passou entre vocês</span>
                        {podeAgir && <Botao variante="texto" onClick={() => navigate(`/familias/${detalhe.id}/acertos/novo`)}>Dinheiro entre vocês</Botao>}
                      </div>
                      {acertos === null ? <Esqueleto linhas={1} altura={18} /> : <p className={styles.vazioMes}>Nada passou entre vocês em {mesMin}.</p>}
                    </>
                  )}
                </div>
              </div>
            )}
          </Bloco>

          {!sozinho && (
            <Bloco titulo="Despesas compartilhadas" semRespiro>
              {despesas === null ? <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
                : despesas.length === 0 ? <p className={styles.vazio}>Nenhuma despesa compartilhada em {mesMin}.</p>
                : (
                  <ListaFicha rotulo="Despesas compartilhadas">
                    {pendentes.length > 0 && (
                      <GrupoFicha rotulo="Aguardando aprovação">
                        {pendentes.map((d) => <Despesa key={d.id} d={d} familiaId={detalhe.id} meuId={meuId} podeAgir={podeAgir} membros={membrosOpcoes} aoMudar={recarregar} />)}
                      </GrupoFicha>
                    )}
                    {doMes.length > 0 && (
                      <GrupoFicha rotulo={mesNome}>
                        {doMes.map((d) => <Despesa key={d.id} d={d} familiaId={detalhe.id} meuId={meuId} podeAgir={podeAgir} membros={membrosOpcoes} aoMudar={recarregar} />)}
                      </GrupoFicha>
                    )}
                  </ListaFicha>
                )}
            </Bloco>
          )}
        </>
      )}

      {aba === "pessoas" && (
        <>
          <Bloco titulo="Membros" semRespiro acao={admin ? "Convidar" : undefined} aoClicar={() => navigate(`/familias/${detalhe.id}/convidar`)}>
            <ListaFicha rotulo="Membros">
              <GrupoFicha rotulo="Quem está">
                {[...detalhe.membros].sort((a, b) => Number(b.usuarioId === meuId) - Number(a.usuarioId === meuId)).map((m) => (
                  <Membro key={m.id} m={m} familia={detalhe} meuId={meuId} mesNome={mesMin}
                    renda={renda?.membros.find((r) => r.usuarioId === m.usuarioId)} aoMudar={recarregar} />
                ))}
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
                    {dependentes.map((d) => <DependenteLinha key={d.id} d={d} familiaId={detalhe.id} periodo={periodo} mesNome={mesMin} podeAgir={podeAgir} aoMudar={recarregar} />)}
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

// ── Sair (quem não criou) ou dissolver (quem criou): só o botão; a consequência vai na confirmação ────────
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
    <Bloco>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}
      <div className={styles.sair}>
        <span className={styles.sairTitulo}>{souCriador ? "Dissolver a família" : "Sair da família"}</span>
        <Botao perigo onClick={() => setConfirmando(true)} icone={souCriador ? <Trash2 size={15} strokeWidth={2.25} aria-hidden="true" /> : <LogOut size={15} strokeWidth={2.25} aria-hidden="true" />}>
          {souCriador ? "Dissolver" : "Sair"}
        </Botao>
      </div>
      <Confirmar aberto={confirmando} perigo ocupado={ocupado} titulo={souCriador ? "Dissolver a família?" : "Sair da família?"}
        texto={souCriador
          ? "As despesas compartilhadas, o que passou entre vocês e os dependentes somem pra todos. Os lançamentos de cada um ficam com cada um. Não dá pra desfazer."
          : "Você deixa de ver as despesas e o equilíbrio do mês. Seus lançamentos continuam com você. Pra voltar, alguém precisa te convidar de novo."}
        rotuloConfirmar={souCriador ? "Dissolver" : "Sair"} onConfirmar={confirmar} onCancelar={() => setConfirmando(false)} />
    </Bloco>
  )
}

// ── Membro: a linha e a ficha. Na SUA: relação, renda do mês e quem vê a sua renda (uma caixa por pessoa).
//    Na dos outros: renda só se a pessoa liberou pra você; senão nem linha. ─────────────────────────────────
function Membro({ m, familia, meuId, mesNome, renda, aoMudar }: {
  m: MembroFamilia; familia: FamiliaDetalhe; meuId: string; mesNome: string; renda?: RendaFamilia["membros"][number]; aoMudar: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [editandoRelacao, setEditandoRelacao] = useState(false)
  const [papel, setPapel] = useState(m.papel)
  const [erroPapel, setErroPapel] = useState<string | undefined>()
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const sou = m.usuarioId === meuId
  const criador = m.usuarioId === familia.criadoPorUsuarioId
  const admin = familia.ehAdmin
  const proporcional = familia.modoRateioPadrao === 2
  // Quem pode ver a sua renda: os membros que lançam e dividem (quem só vê nunca vê renda de ninguém).
  const candidatos = familia.membros.filter((x) => x.usuarioId !== meuId && x.papelPermissao !== PAPEL_PERMISSAO.dependente)
  const [para, setPara] = useState<string[]>(() => (
    m.visibilidadeRenda === VISIBILIDADE_RENDA.valorParaTodos ? candidatos.map((x) => x.usuarioId) : (m.rendaVisivelPara ?? [])))
  const [contaNoPeso, setContaNoPeso] = useState(m.visibilidadeRenda !== VISIBILIDADE_RENDA.nada)

  const rodar = async (acao: () => Promise<unknown>, depois?: () => void) => {
    setOcupado(true); setErro(null)
    try { await acao(); depois?.(); aoMudar() } catch (e) { setErro(mensagemDeErro(e)) }
    setOcupado(false)
  }
  const salvarPapel = () => {
    if (!papel.trim()) { setErroPapel("Diga qual é a sua relação com a família."); return }
    void rodar(() => editarPapel(familia.id, m.id, papel.trim()), () => setEditandoRelacao(false))
  }
  // Marcou alguém = essa pessoa vê o valor (nível "pra alguns"); ninguém marcado = só o peso (ou nada, se tirou do peso).
  const salvarVisibilidade = (lista: string[], peso: boolean) => {
    const nivel: VisibilidadeRenda = lista.length > 0 ? VISIBILIDADE_RENDA.valorParaAlguns : peso ? VISIBILIDADE_RENDA.soPeso : VISIBILIDADE_RENDA.nada
    void rodar(() => definirVisibilidadeRenda(familia.id, m.id, nivel, lista))
  }
  const marcar = (usuarioId: string, on: boolean) => {
    const lista = on ? [...para, usuarioId] : para.filter((x) => x !== usuarioId)
    setPara(lista); salvarVisibilidade(lista, contaNoPeso)
  }

  return (
    <>
      <ItemFicha id={`membro-${m.id}`} aberto={aberto} aoAbrir={() => setAberto((a) => !a)}
        marca={<InicialFicha texto={m.nomeUsuario} destaque={sou} />}
        titulo={<>{m.nomeUsuario}{sou && <span className={styles.voce}> você</span>}</>}
        detalhe={`${m.papel} · desde ${dataBR(m.entrouEm)}`}
        direita={m.papelPermissao === PAPEL_PERMISSAO.admin ? <Etiqueta>Admin</Etiqueta> : m.papelPermissao === PAPEL_PERMISSAO.dependente ? <Etiqueta>Só vê</Etiqueta> : undefined}>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <DadosFicha>
          <div><dt>E-mail</dt><dd>{m.emailUsuario}</dd></div>
          {sou && !editandoRelacao && (
            <div><dt>Relação</dt><dd>{m.papel} <button type="button" className={styles.linkFicha} onClick={() => setEditandoRelacao(true)}>Editar</button></dd></div>
          )}
          {!sou && <div><dt>Relação</dt><dd>{m.papel}</dd></div>}
          {/* Renda: a sua sempre; a dos outros só se a pessoa liberou pra você (o servidor decide). Senão, nem linha. */}
          {renda?.mostrada && (
            <div>
              <dt>Renda em {mesNome}</dt>
              <dd><Dinheiro valor={renda.recebido ?? 0} />{(renda.previsto ?? 0) > 0 && <span className={styles.dica}> · esperado <Dinheiro valor={renda.previsto ?? 0} /></span>}{sou && <Link to="/renda" className={styles.linkFicha}>Ver renda</Link>}</dd>
            </div>
          )}
        </DadosFicha>
        {sou && editandoRelacao && (
          <div className={styles.fichaForm}>
            <Campo rotulo="Sua relação com a família" erro={erroPapel}>
              <Entrada value={papel} maxLength={MAX_PAPEL} placeholder="Cônjuge" autoFocus onChange={(e) => { setPapel(e.target.value); setErroPapel(undefined) }} />
            </Campo>
            <div className={styles.fichaFormAcoes}>
              <Botao onClick={() => setEditandoRelacao(false)} disabled={ocupado}>Cancelar</Botao>
              <Botao variante="primario" disabled={ocupado} onClick={salvarPapel}>Salvar</Botao>
            </div>
          </div>
        )}
        {sou && m.papelPermissao !== PAPEL_PERMISSAO.dependente && (
          <div className={styles.quemVe} role="group" aria-label="Quem vê a sua renda">
            <span className={styles.rotulo}>Quem vê a sua renda</span>
            {candidatos.length === 0 ? <span className={styles.dica}>Ninguém mais lança e divide por aqui ainda.</span> : (
              <div className={styles.quemVeLista}>
                {candidatos.map((c) => (
                  <Marcar key={c.id} marcado={para.includes(c.usuarioId)} desabilitado={ocupado} onChange={(on) => marcar(c.usuarioId, on)}>{primeiroNome(c.nomeUsuario)}</Marcar>
                ))}
              </div>
            )}
            {proporcional && para.length === 0 && (
              <Marcar marcado={contaNoPeso} desabilitado={ocupado} onChange={(on) => { setContaNoPeso(on); salvarVisibilidade([], on) }}>Contar a minha renda no peso da divisão</Marcar>
            )}
          </div>
        )}
        {admin && !criador && !sou && (
          <AcoesFicha>
            <Botao variante="texto" perigo disabled={ocupado} onClick={() => setRemovendo(true)} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Remover</Botao>
            {m.papelPermissao !== PAPEL_PERMISSAO.admin && <Botao disabled={ocupado} onClick={() => rodar(() => editarPermissao(familia.id, m.id, PAPEL_PERMISSAO.admin))}>Tornar admin</Botao>}
            {m.papelPermissao === PAPEL_PERMISSAO.admin && <Botao disabled={ocupado} onClick={() => rodar(() => editarPermissao(familia.id, m.id, PAPEL_PERMISSAO.membro))}>Tirar de admin</Botao>}
            {m.papelPermissao === PAPEL_PERMISSAO.membro && <Botao disabled={ocupado} onClick={() => rodar(() => editarPermissao(familia.id, m.id, PAPEL_PERMISSAO.dependente))}>Só ver</Botao>}
            {m.papelPermissao === PAPEL_PERMISSAO.dependente && <Botao disabled={ocupado} onClick={() => rodar(() => editarPermissao(familia.id, m.id, PAPEL_PERMISSAO.membro))}>Deixar lançar</Botao>}
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
      {admin ? <AcoesFicha><Botao variante="texto" perigo disabled={ocupado} onClick={revogar}>Cancelar convite</Botao></AcoesFicha> : <p className={styles.dica}>Aguardando a pessoa aceitar.</p>}
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
  // Etiqueta só quando o estado precisa de atenção; aprovada fica na ficha ("Aprovada por").
  const etiqueta = d.statusAprovacao === APROVACAO.pendente ? <Etiqueta tom="alerta">Aguardando</Etiqueta>
    : d.statusAprovacao === APROVACAO.rejeitada ? <Etiqueta tom="negativo">Recusada</Etiqueta> : null

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
      {(minha || (podeAgir && !minha && d.statusAprovacao === APROVACAO.pendente)) && (
        <AcoesFicha>
          {minha && <Botao variante="texto" onClick={() => navigate(`/transacoes/${d.id}`, { state: { voltarPara: `/familias/${familiaId}` } })} icone={<ExternalLink size={15} strokeWidth={2.25} aria-hidden="true" />}>Abrir lançamento</Botao>}
          {podeAgir && !minha && d.statusAprovacao === APROVACAO.pendente && (
            <>
              <Botao perigo disabled={ocupado} onClick={() => rodar(() => rejeitarDespesa(familiaId, d.id))} icone={<X size={15} strokeWidth={2.5} aria-hidden="true" />}>Recusar</Botao>
              <Botao variante="primario" disabled={ocupado} onClick={() => rodar(() => aprovarDespesa(familiaId, d.id))} icone={<Check size={15} strokeWidth={2.5} aria-hidden="true" />}>Aprovar</Botao>
            </>
          )}
        </AcoesFicha>
      )}
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
        {podeAgir ? <AcoesFicha><Botao variante="texto" perigo disabled={ocupado} onClick={() => setConfirmando(true)}>Desfazer</Botao></AcoesFicha> : <p className={styles.dica}>Registrado por quem lança.</p>}
      </ItemFicha>
      <Confirmar aberto={confirmando} perigo ocupado={ocupado} titulo="Desfazer este registro?" texto="O valor volta a contar no equilíbrio do mês."
        rotuloConfirmar="Desfazer" rotuloCancelar="Manter" onConfirmar={cancelar} onCancelar={() => setConfirmando(false)} />
    </>
  )
}

function DependenteLinha({ d, familiaId, periodo, mesNome, podeAgir, aoMudar }: {
  d: Dependente; familiaId: string; periodo: Periodo; mesNome: string; podeAgir: boolean; aoMudar: () => void
}) {
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [gasto, setGasto] = useState<number | null>(null)
  useEffect(() => {
    if (!aberto) return
    let vivo = true
    setGasto(null)
    getGastoDependente(familiaId, d.id, periodo.mes, periodo.ano).then((g) => { if (vivo) setGasto(g.total) }).catch(() => { /* sem o gasto */ })
    return () => { vivo = false }
  }, [aberto, familiaId, d.id, periodo])
  const inativar = async () => {
    setOcupado(true); setErro(null); setConfirmando(false)
    try { await inativarDependente(familiaId, d.id); aoMudar() } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false) }
  }
  const anos = d.dataNascimento ? idade(d.dataNascimento) : null
  return (
    <>
      <ItemFicha id={`dependente-${d.id}`} aberto={aberto} aoAbrir={() => setAberto((a) => !a)}
        marca={<InicialFicha texto={d.nome} />} titulo={d.apelido ? `${d.nome} (${d.apelido})` : d.nome}
        detalhe={anos !== null ? `${rotuloTipoDependente(d.tipo)} · ${anos} ${anos === 1 ? "ano" : "anos"}` : rotuloTipoDependente(d.tipo)}>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <DadosFicha>
          <div><dt>Em {mesNome}</dt><dd>{gasto === null ? <span className={styles.dica}>…</span> : <Dinheiro valor={gasto} />}</dd></div>
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

// ── Regras: como divide e se pede OK pra despesa grande (admin muda; os outros veem) ──────────────────────
function Regras({ familia, aoMudar }: { familia: FamiliaDetalhe; aoMudar: () => void }) {
  const [pedirOk, setPedirOk] = useState(familia.limiteAprovacao !== null && familia.limiteAprovacao > 0)
  const [limite, setLimite] = useState(familia.limiteAprovacao ? moneyParaCampo(familia.limiteAprovacao) : "")
  const [erroLimite, setErroLimite] = useState<string | undefined>()
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const rodar = async (acao: () => Promise<unknown>) => {
    setOcupado(true); setErro(null)
    try { await acao(); aoMudar() } catch (e) { setErro(mensagemDeErro(e)) }
    setOcupado(false)
  }
  const modo = MODOS_RATEIO.find((m) => m.valor === familia.modoRateioPadrao) ?? MODOS_RATEIO[0]
  const ligar = (on: boolean) => {
    setPedirOk(on)
    if (!on) { setLimite(""); void rodar(() => definirLimiteAprovacao(familia.id, null)) }
  }
  const salvarLimite = () => {
    const v = parseMoney(limite)
    if (!(v > 0)) { setErroLimite("A partir de quanto?"); return }
    void rodar(() => definirLimiteAprovacao(familia.id, v))
  }

  if (!familia.ehAdmin) {
    return (
      <Bloco titulo="Regras">
        <DadosFicha>
          <div><dt>Divisão</dt><dd>{modo.rotulo}<span className={styles.dica}> · {modo.detalhe}</span></dd></div>
          <div><dt>Pedir OK pra despesa grande</dt><dd>{familia.limiteAprovacao ? <>a partir de <Dinheiro valor={familia.limiteAprovacao} /></> : "Não"}</dd></div>
        </DadosFicha>
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
        <Interruptor ligado={pedirOk} desabilitado={ocupado} onChange={ligar}>Pedir OK pra despesa grande</Interruptor>
        {pedirOk && (
          <div className={styles.limite}>
            <Campo rotulo="A partir de" erro={erroLimite} className={styles.limiteCampo}>
              <EntradaValor compacto valor={limite} onChange={(v) => { setLimite(v); setErroLimite(undefined) }} />
            </Campo>
            <Botao variante="primario" disabled={ocupado} onClick={salvarLimite}>Salvar</Botao>
          </div>
        )}
      </div>
    </Bloco>
  )
}
