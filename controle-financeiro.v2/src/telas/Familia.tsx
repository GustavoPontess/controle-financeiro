// Página de uma família (/familias/:id). Em cima: nome, quem você é nela e as ações da família (convidar,
// sair ou dissolver). Na coluna principal, o mês: o balanço (quanto cada um pagou, a parte de cada um e o que
// fica a receber ou a acertar, sem cobrança no texto), as despesas compartilhadas (com aprovação e responsável
// na própria linha) e os acertos. Na coluna do lado: os membros (renda e papel se editam na própria ficha;
// admin promove, rebaixa e remove), os convites pendentes, os dependentes e as regras (como divide e a partir
// de quanto uma despesa precisa de aprovação). Visão: docs/features/familia/visao.md; permissões:
// docs/features/familia/papeis-permissoes.md (o servidor é quem manda; a tela só esconde o que não pode).
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Check, ChevronLeft, ChevronRight, Pencil, Trash2, UserPlus, X, ExternalLink, LogOut, Wallet } from "lucide-react"
import { useAuth } from "../auth/useAuth"
import {
  aprovarDespesa, atribuirResponsavel, cancelarAcerto, definirLimiteAprovacao, definirModoRateio, definirRendaMembro,
  dissolverFamilia, editarPapel, editarPermissao, getAcertos, getBalancoFamilia, getDependentes, getDespesasFamilia,
  getFamilia, inativarDependente, rejeitarDespesa, removerMembro, revogarConvite,
} from "../services/familiaService"
import { mensagemDeErro } from "../api/cliente"
import type { AcertoContas, BalancoFamilia, ConviteFamilia, Dependente, DespesaCompartilhada, FamiliaDetalhe, MembroFamilia, ModoRateio } from "../types/Familia"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Entrada from "../componentes/Entrada"
import EntradaValor from "../componentes/EntradaValor"
import Etiqueta from "../componentes/Etiqueta"
import { AcoesFicha, DadosFicha, GrupoFicha, InicialFicha, ItemFicha, ListaFicha, VazioFicha } from "../componentes/ListaFicha"
import Selecao from "../componentes/Selecao"
import { APROVACAO, MAX_PAPEL, MODOS_RATEIO, PAPEL_PERMISSAO, ROTULO_PERMISSAO, fraseSaldo, nomeDoMes, primeiroNome, rotuloModoRateio, rotuloTipoDependente } from "../dominio/familia"
import { dataBR } from "../utils/dateTime"
import { moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./Familia.module.css"

const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export default function Familia() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const meuId = usuario?.id ?? ""
  const [detalhe, setDetalhe] = useState<FamiliaDetalhe | null>(null)
  const [dependentes, setDependentes] = useState<Dependente[] | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState(() => { const h = new Date(); return { mes: h.getMonth() + 1, ano: h.getFullYear() } })
  const [balanco, setBalanco] = useState<BalancoFamilia | null>(null)
  const [despesas, setDespesas] = useState<DespesaCompartilhada[] | null>(null)
  const [acertos, setAcertos] = useState<AcertoContas[] | null>(null)
  const [responsavelFiltro, setResponsavelFiltro] = useState("")
  const [versao, setVersao] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [saindo, setSaindo] = useState<"sair" | "dissolver" | null>(null)
  const [ocupado, setOcupado] = useState(false)

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
    return () => { vivo = false }
  }, [id, periodo, responsavelFiltro, versao])

  const recarregar = () => setVersao((v) => v + 1)
  const mudarMes = (delta: number) => setPeriodo((p) => { const d = new Date(p.ano, p.mes - 1 + delta, 1); return { mes: d.getMonth() + 1, ano: d.getFullYear() } })

  if (erroCarga) return <div className={styles.pagina}><p className={styles.alerta} role="alert">{erroCarga}</p></div>
  if (!detalhe) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>

  const eu = detalhe.membros.find((m) => m.usuarioId === meuId)
  const souCriador = detalhe.criadoPorUsuarioId === meuId
  const admin = detalhe.ehAdmin
  // Quem só vê (permissão Dependente) não lança, não aprova, não acerta: a tela nem mostra essas ações.
  const podeAgir = (eu?.papelPermissao ?? PAPEL_PERMISSAO.dependente) !== PAPEL_PERMISSAO.dependente
  const membrosOpcoes = detalhe.membros.map((m) => ({ valor: m.usuarioId, rotulo: primeiroNome(m.nomeUsuario) }))

  const sairOuDissolver = async () => {
    setOcupado(true); setErro(null)
    try {
      if (saindo === "dissolver") await dissolverFamilia(detalhe.id)
      else if (eu) await removerMembro(detalhe.id, eu.id)
      navigate("/familias", { replace: true })
    } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setSaindo(null) }
  }

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div className={styles.identidade}>
          <span className={styles.marcaGrande} aria-hidden="true">{detalhe.nome.trim().charAt(0).toUpperCase()}</span>
          <div className={styles.identidadeTexto}>
            <h1 className={styles.titulo}>{detalhe.nome}</h1>
            <span className={styles.muted}>{detalhe.membros.length} {detalhe.membros.length === 1 ? "membro" : "membros"}{eu ? ` · você: ${eu.papel}` : ""}</span>
          </div>
        </div>
        <div className={styles.acoesTopo}>
          {eu && <Etiqueta>{ROTULO_PERMISSAO[eu.papelPermissao]}</Etiqueta>}
          <Etiqueta>{rotuloModoRateio(detalhe.modoRateioPadrao)}</Etiqueta>
          {admin && <Botao compactoNoCelular onClick={() => navigate(`/familias/${detalhe.id}/convidar`)} icone={<UserPlus size={15} strokeWidth={2.25} aria-hidden="true" />}>Convidar</Botao>}
          {souCriador
            ? <Botao variante="texto" perigo onClick={() => setSaindo("dissolver")} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Dissolver</Botao>
            : eu && <Botao variante="texto" perigo onClick={() => setSaindo("sair")} icone={<LogOut size={15} strokeWidth={2.25} aria-hidden="true" />}>Sair da família</Botao>}
        </div>
      </header>
      {erro && <p className={styles.alerta} role="alert">{erro}</p>}

      <div className={styles.grade}>
        <div className={styles.principal}>
          {/* ── Balanço do mês ── */}
          <Bloco semRespiro>
            <div className={styles.toolbar}>
              <span className={styles.toolbarTitulo}>{nomeDoMes(periodo.mes, periodo.ano)}</span>
              <span className={styles.meses}>
                <Botao soIcone aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft size={16} strokeWidth={2.25} /></Botao>
                <Botao soIcone aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight size={16} strokeWidth={2.25} /></Botao>
              </span>
            </div>
            {balanco === null ? <div className={styles.respiro}><Esqueleto linhas={2} altura={18} /></div> : (
              <div className={styles.balanco}>
                <div className={styles.balancoTotal}>
                  <span className={styles.rotulo}>Despesas da família</span>
                  <Dinheiro valor={balanco.total} className={styles.grande} />
                </div>
                <ul className={styles.saldos} aria-label="Balanço por pessoa">
                  {balanco.saldos.map((s) => {
                    const f = fraseSaldo(s.saldo)
                    return (
                      <li key={s.usuarioId}>
                        <InicialFicha texto={s.nome} destaque={s.usuarioId === meuId} />
                        <span className={styles.saldoTexto}>
                          <span className={styles.saldoNome}>{primeiroNome(s.nome)}{s.usuarioId === meuId && <span className={styles.voce}> você</span>}</span>
                          <span className={styles.saldoDetalhe}>pagou <Dinheiro valor={s.pagou} /> · parte <Dinheiro valor={s.cota} /></span>
                        </span>
                        <span className={styles.saldoValor} data-tom={f.tom}>{f.tom === "neutro" ? "Em dia" : <>{f.texto} <Dinheiro valor={Math.abs(s.saldo)} /></>}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </Bloco>

          {/* ── Despesas compartilhadas do mês ── */}
          <Bloco titulo="Despesas compartilhadas" semRespiro>
            {detalhe.membros.length > 1 && (
              <div className={styles.filtro}>
                <Selecao valor={responsavelFiltro} ariaLabel="Responsável" placeholder="Todos"
                  opcoes={[{ valor: "", rotulo: "Todos" }, ...membrosOpcoes]} onChange={setResponsavelFiltro} />
              </div>
            )}
            {despesas === null ? <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
              : despesas.length === 0 ? <p className={styles.vazio}>{responsavelFiltro ? "Nada com esse responsável neste mês." : `Nenhuma despesa compartilhada em ${nomeDoMes(periodo.mes, periodo.ano).toLowerCase()}.`}</p>
              : (
                <ListaFicha rotulo="Despesas compartilhadas">
                  <GrupoFicha rotulo="Despesas">
                    {despesas.map((d) => <Despesa key={d.id} d={d} familiaId={detalhe.id} meuId={meuId} podeAgir={podeAgir} membros={membrosOpcoes} aoMudar={recarregar} />)}
                  </GrupoFicha>
                </ListaFicha>
              )}
          </Bloco>

          {/* ── Acertos do mês ── */}
          <Bloco titulo="Acertos" semRespiro acao={podeAgir ? "Registrar acerto" : undefined} aoClicar={() => navigate(`/familias/${detalhe.id}/acertos/novo`)}>
            {acertos === null ? <div className={styles.respiro}><Esqueleto linhas={2} altura={18} /></div>
              : acertos.length === 0 ? <p className={styles.vazio}>Nenhum acerto em {nomeDoMes(periodo.mes, periodo.ano).toLowerCase()}.</p>
              : (
                <ListaFicha rotulo="Acertos">
                  <GrupoFicha rotulo="Acertos do mês">
                    {acertos.map((a) => <Acerto key={a.id} a={a} familiaId={detalhe.id} podeAgir={podeAgir} aoMudar={recarregar} />)}
                  </GrupoFicha>
                </ListaFicha>
              )}
          </Bloco>
        </div>

        <aside className={styles.lado}>
          {/* ── Membros e convites ── */}
          <Bloco titulo="Membros" semRespiro>
            <ListaFicha rotulo="Membros">
              <GrupoFicha rotulo="Quem está">
                {detalhe.membros.map((m) => <Membro key={m.id} m={m} familia={detalhe} meuId={meuId} aoMudar={recarregar} />)}
              </GrupoFicha>
              {detalhe.convitesPendentes.length > 0 && (
                <GrupoFicha rotulo="Convites pendentes">
                  {detalhe.convitesPendentes.map((c) => <Convite key={c.id} c={c} familiaId={detalhe.id} admin={admin} aoMudar={recarregar} />)}
                </GrupoFicha>
              )}
            </ListaFicha>
          </Bloco>

          {/* ── Dependentes ── */}
          <Bloco titulo="Dependentes" semRespiro acao={podeAgir ? "Adicionar" : undefined} aoClicar={() => navigate(`/familias/${detalhe.id}/dependentes/novo`)}>
            {dependentes === null ? <div className={styles.respiro}><Esqueleto linhas={2} altura={18} /></div>
              : dependentes.length === 0 ? <p className={styles.vazio}>Filhos, pais, pets: quem não usa o app mas tem gasto que você quer acompanhar.</p>
              : (
                <ListaFicha rotulo="Dependentes">
                  <GrupoFicha rotulo="Dependentes da família">
                    {dependentes.map((d) => <DependenteLinha key={d.id} d={d} familiaId={detalhe.id} podeAgir={podeAgir} aoMudar={recarregar} />)}
                  </GrupoFicha>
                </ListaFicha>
              )}
          </Bloco>

          <Regras familia={detalhe} aoMudar={recarregar} />
        </aside>
      </div>

      <Confirmar aberto={saindo !== null} perigo ocupado={ocupado}
        titulo={saindo === "dissolver" ? "Dissolver a família?" : "Sair da família?"}
        texto={saindo === "dissolver" ? "Ninguém mais vê as despesas compartilhadas, os acertos e os dependentes. Os lançamentos de cada um continuam nas contas de cada um." : "Você deixa de ver as despesas e o balanço. Seus lançamentos continuam com você."}
        rotuloConfirmar={saindo === "dissolver" ? "Dissolver" : "Sair"} onConfirmar={sairOuDissolver} onCancelar={() => setSaindo(null)} />
    </div>
  )
}

// ── Membro: a linha e a ficha (e-mail, renda, papel); as ações dependem de quem olha ──────────────────────
function Membro({ m, familia, meuId, aoMudar }: { m: MembroFamilia; familia: FamiliaDetalhe; meuId: string; aoMudar: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<"renda" | "papel" | null>(null)
  const [renda, setRenda] = useState(m.rendaMensal ? moneyParaCampo(m.rendaMensal) : "")
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
          {/* Renda é dado pessoal: o valor só aparece na própria linha; dos outros, só se informaram. */}
          <div><dt>Renda</dt><dd>{sou ? (m.rendaMensal ? <Dinheiro valor={m.rendaMensal} /> : "Não informada") : m.rendaInformada ? "Informada" : "Não informada"}</dd></div>
        </DadosFicha>
        {editando === "renda" && (
          <div className={styles.fichaForm}>
            <Campo rotulo="Sua renda por mês">
              <EntradaValor compacto valor={renda} onChange={setRenda} autoFocus />
            </Campo>
            <p className={styles.dica}>Só você vê o valor. Os outros veem só que você informou; ela entra como peso na divisão proporcional.</p>
            <div className={styles.fichaFormAcoes}>
              <Botao onClick={() => setEditando(null)} disabled={ocupado}>Cancelar</Botao>
              {m.rendaMensal ? <Botao variante="texto" disabled={ocupado} onClick={() => rodar(() => definirRendaMembro(familia.id, m.id, null))}>Apagar</Botao> : null}
              <Botao variante="primario" disabled={ocupado} onClick={() => rodar(() => definirRendaMembro(familia.id, m.id, parseMoney(renda) || null))}>Salvar</Botao>
            </div>
          </div>
        )}
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
            {sou && <Botao onClick={() => setEditando("renda")} icone={<Wallet size={15} strokeWidth={2.25} aria-hidden="true" />}>Minha renda</Botao>}
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
        texto="A pessoa deixa de ver as despesas e o balanço. Os lançamentos dela continuam com ela." rotuloConfirmar="Remover"
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
            <Selecao valor={d.responsavelUsuarioId ?? ""} placeholder="Ninguém" desabilitado={ocupado}
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
        titulo={`${primeiroNome(a.deNome)} acertou com ${primeiroNome(a.paraNome)}`}
        detalhe={`${dataBR(a.criadoEm)}${a.observacao ? ` · ${a.observacao}` : ""}`}
        direita={<Dinheiro valor={a.valor} className={styles.valor} />}>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <p className={styles.dica}>Acerto é só o registro de que o valor foi passado de um pro outro; as contas de cada um não mudam.</p>
        {podeAgir && <AcoesFicha><Botao variante="texto" perigo disabled={ocupado} onClick={() => setConfirmando(true)}>Cancelar acerto</Botao></AcoesFicha>}
      </ItemFicha>
      <Confirmar aberto={confirmando} perigo ocupado={ocupado} titulo="Cancelar este acerto?" texto="O valor volta a contar como a receber e a acertar no balanço."
        rotuloConfirmar="Cancelar acerto" rotuloCancelar="Manter" onConfirmar={cancelar} onCancelar={() => setConfirmando(false)} />
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
        <p className={styles.dica}>Despesa compartilhada desse valor pra cima só entra no balanço depois que outra pessoa aprova. Vazio desliga.</p>
        <div className={styles.fichaFormAcoes}>
          <Botao variante="primario" disabled={ocupado} onClick={() => rodar(() => definirLimiteAprovacao(familia.id, parseMoney(limite) || null))}>Salvar limite</Botao>
        </div>
      </div>
    </Bloco>
  )
}

export { VazioFicha }
