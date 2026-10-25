// Página da pessoa na família (/familias/:id/membros/:membroId; docs/features/familia/membros-e-permissoes.md, passo 2).
// Quem é (relação, desde quando), o perfil e o que ele deixa fazer nesta casa, a renda (a sua sempre, com quem vê;
// a dos outros só se a pessoa liberou pra você) e, no pé, remover (quem administra) ou sair (a própria pessoa).
// Mudar o perfil pede confirmação dizendo o que muda. Quem decide é o servidor: a tela só mostra o que ele deixa.
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Check, Minus, Trash2 } from "lucide-react"
import { useAuth } from "../auth/useAuth"
import { editarPapel, editarPermissao, removerMembro } from "../services/familiaService"
import { definirVisibilidadeRenda, getRendaFamilia } from "../services/rendaService"
import { mensagemDeErro } from "../api/cliente"
import { usePeriodoFamilia } from "../estado/espaco"
import type { FamiliaDetalhe, MembroFamilia, PapelFamilia } from "../types/Familia"
import type { RendaFamilia, VisibilidadeRenda } from "../types/Renda"
import { VISIBILIDADE_RENDA } from "../types/Renda"
import Avatar, { urlFoto } from "../componentes/Avatar"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Entrada from "../componentes/Entrada"
import Etiqueta from "../componentes/Etiqueta"
import Marcar from "../componentes/Marcar"
import { nomeDoPeriodo } from "../componentes/NavegadorMes"
import Segmentos from "../componentes/Segmentos"
import { MAX_PAPEL, PAPEL_PERMISSAO, ROTULO_PERMISSAO, oQuePode, primeiroNome } from "../dominio/familia"
import { dataBR } from "../utils/dateTime"
import { Alerta, SairOuDissolver, papeisDe, useFamilia } from "./FamiliaPecas"
import styles from "./Familia.module.css"

const PERFIS: PapelFamilia[] = [PAPEL_PERMISSAO.admin, PAPEL_PERMISSAO.membro, PAPEL_PERMISSAO.dependente]
const O_QUE_MUDA: Record<PapelFamilia, string> = {
  1: "passa a mudar as regras, convidar e cuidar dos membros.",
  2: "divide as contas da casa, mas não muda as regras nem os membros.",
  3: "passa a só ver: fica fora das próximas despesas divididas e não vê a renda de ninguém. O que já foi dividido fica como está.",
}

export default function FamiliaPessoa() {
  const { id = "", membroId = "" } = useParams<{ id: string; membroId: string }>()
  const { usuario } = useAuth()
  const meuId = usuario?.id ?? ""
  const [versao, setVersao] = useState(0)
  const { detalhe, erro } = useFamilia(id, versao)
  const [periodo] = usePeriodoFamilia()
  const [renda, setRenda] = useState<RendaFamilia | null>(null)

  useEffect(() => {
    let vivo = true
    getRendaFamilia(id, periodo.ano, periodo.mes).then((r) => { if (vivo) setRenda(r) }).catch(() => { /* sem a renda */ })
    return () => { vivo = false }
  }, [id, periodo, versao])

  if (erro) return <div className={styles.pagina}><Alerta erro={erro} /></div>
  if (!detalhe) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>
  const m = detalhe.membros.find((x) => x.id === membroId)
  if (!m) {
    return (
      <div className={styles.pagina}>
        <Bloco><p className={styles.vazio}>Essa pessoa não está mais na família. <Link to={`/familias/${detalhe.id}/membros`} className={styles.linkFicha}>Ver os membros</Link></p></Bloco>
      </div>
    )
  }
  return (
    <Pessoa key={m.id} m={m} familia={detalhe} meuId={meuId} mesNome={nomeDoPeriodo(periodo).toLowerCase()}
      renda={renda?.membros.find((r) => r.usuarioId === m.usuarioId)} aoMudar={() => setVersao((v) => v + 1)} />
  )
}

function Pessoa({ m, familia, meuId, mesNome, renda, aoMudar }: {
  m: MembroFamilia; familia: FamiliaDetalhe; meuId: string; mesNome: string; renda?: RendaFamilia["membros"][number]; aoMudar: () => void
}) {
  const navigate = useNavigate()
  const { eu, souCriador } = papeisDe(familia, meuId)
  const sou = m.usuarioId === meuId
  const criador = m.usuarioId === familia.criadoPorUsuarioId
  const nome = primeiroNome(m.nomeUsuario)
  // Quem administra muda o perfil e remove; nunca o de quem criou a casa nem o próprio.
  const cuida = familia.ehAdmin && !criador && !sou
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [novoPerfil, setNovoPerfil] = useState<PapelFamilia | null>(null)
  const [removendo, setRemovendo] = useState(false)
  const [editandoRelacao, setEditandoRelacao] = useState(false)
  const [relacao, setRelacao] = useState(m.papel)
  const [erroRelacao, setErroRelacao] = useState<string | undefined>()

  const rodar = async (acao: () => Promise<unknown>, depois?: () => void) => {
    setOcupado(true); setErro(null)
    try { await acao(); depois?.(); aoMudar() } catch (e) { setErro(mensagemDeErro(e)) }
    setOcupado(false)
  }
  const salvarRelacao = () => {
    if (!relacao.trim()) { setErroRelacao("Diga qual é a sua relação com a família."); return }
    void rodar(() => editarPapel(familia.id, m.id, relacao.trim()), () => setEditandoRelacao(false))
  }
  const remover = async () => {
    setOcupado(true); setErro(null)
    try { await removerMembro(familia.id, m.id); navigate(`/familias/${familia.id}/membros`, { replace: true }) }
    catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setRemovendo(false) }
  }

  return (
    <div className={styles.pagina}>
      <Alerta erro={erro} />
      <Bloco>
        <div className={styles.pessoaTopo}>
          <Avatar className={styles.pessoaFoto} destaque={sou} foto={urlFoto(m.usuarioId, m.fotoEm)} texto={m.nomeUsuario.trim().charAt(0).toUpperCase() || "?"} />
          <div className={styles.pessoaTexto}>
            <h2 className={styles.pessoaNome}>{m.nomeUsuario}{sou && <span className={styles.voce}> você</span>}</h2>
            {!editandoRelacao && (
              <span className={styles.pessoaSub}>
                {m.papel} · na casa desde {dataBR(m.entrouEm.slice(0, 10))}
                {sou && <> · <button type="button" className={styles.linkFicha} onClick={() => setEditandoRelacao(true)}>Editar relação</button></>}
              </span>
            )}
            <span className={styles.pessoaSub}>{m.emailUsuario}</span>
          </div>
        </div>
        {sou && editandoRelacao && (
          <div className={styles.pessoaRelacao}>
            <Campo rotulo="Sua relação com a família" erro={erroRelacao}>
              <Entrada value={relacao} maxLength={MAX_PAPEL} placeholder="Cônjuge" autoFocus onChange={(e) => { setRelacao(e.target.value); setErroRelacao(undefined) }} />
            </Campo>
            <div className={styles.fichaFormAcoes}>
              <Botao onClick={() => { setEditandoRelacao(false); setRelacao(m.papel) }} disabled={ocupado}>Cancelar</Botao>
              <Botao variante="primario" disabled={ocupado} onClick={salvarRelacao}>Salvar</Botao>
            </div>
          </div>
        )}
      </Bloco>

      <Bloco titulo="Perfil">
        <div className={styles.perfil}>
          {cuida ? (
            <Segmentos ariaLabel={`Perfil de ${nome}`} valor={String(m.papelPermissao)} onChange={(v) => setNovoPerfil(Number(v) as PapelFamilia)}
              opcoes={PERFIS.map((p) => ({ valor: String(p), rotulo: ROTULO_PERMISSAO[p] }))} />
          ) : (
            <span className={styles.perfilAtual}>{ROTULO_PERMISSAO[m.papelPermissao]}{criador && <Etiqueta>Criou a casa</Etiqueta>}</span>
          )}
          <ul className={styles.podeLista} aria-label="O que pode nesta casa">
            {oQuePode(m.papelPermissao).map((p) => (
              <li key={p.texto} data-pode={p.pode || undefined}>
                {p.pode ? <Check size={15} strokeWidth={2.5} aria-hidden="true" /> : <Minus size={15} strokeWidth={2.5} aria-hidden="true" />}
                <span>{p.texto}</span><span className={styles.somenteLeitor}>{p.pode ? ": pode" : ": não pode"}</span>
              </li>
            ))}
          </ul>
        </div>
      </Bloco>

      {(sou || renda?.mostrada) && (
        <Bloco titulo={`Renda em ${mesNome}`}>
          <div className={styles.perfil}>
            <span className={styles.pessoaRenda}>
              <Dinheiro valor={renda?.recebido ?? 0} className={styles.grande} />
              {(renda?.previsto ?? 0) > 0 && <span className={styles.dica}>esperado <Dinheiro valor={renda?.previsto ?? 0} /></span>}
              {sou && <Link to="/orcamento" className={styles.linkFicha}>Ver renda</Link>}
            </span>
            {sou && m.papelPermissao !== PAPEL_PERMISSAO.dependente && <QuemVe m={m} familia={familia} meuId={meuId} ocupado={ocupado} rodar={rodar} />}
          </div>
        </Bloco>
      )}

      {cuida && (
        <Bloco>
          <div className={styles.sair}>
            <span className={styles.sairTitulo}>Remover {nome} da família</span>
            <Botao perigo disabled={ocupado} onClick={() => setRemovendo(true)} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Remover</Botao>
          </div>
        </Bloco>
      )}
      {/* A própria pessoa sai daqui; quem criou a casa não sai: dissolve, em Regras. */}
      {sou && !souCriador && <SairOuDissolver familia={familia} eu={eu} souCriador={false} />}

      <Confirmar aberto={novoPerfil !== null} ocupado={ocupado} titulo={`Mudar o perfil de ${nome}?`}
        texto={novoPerfil !== null ? `Como ${ROTULO_PERMISSAO[novoPerfil]}, ${nome} ${O_QUE_MUDA[novoPerfil]}` : ""} rotuloConfirmar="Mudar"
        onConfirmar={() => { const p = novoPerfil!; setNovoPerfil(null); void rodar(() => editarPermissao(familia.id, m.id, p)) }} onCancelar={() => setNovoPerfil(null)} />
      <Confirmar aberto={removendo} perigo ocupado={ocupado} titulo={`Remover ${nome} da família?`}
        texto={`${nome} deixa de ver as despesas e o equilíbrio. Os lançamentos de ${nome} continuam com ${nome}.`} rotuloConfirmar="Remover"
        onConfirmar={() => { void remover() }} onCancelar={() => setRemovendo(false)} />
    </div>
  )
}

/** Quem vê a SUA renda: uma caixa por pessoa que lança e divide (quem só vê nunca vê renda de ninguém). Marcou alguém =
 *  essa pessoa vê o valor ("pra alguns"); ninguém marcado = só o peso (ou nada, se tirou do peso). */
function QuemVe({ m, familia, meuId, ocupado, rodar }: {
  m: MembroFamilia; familia: FamiliaDetalhe; meuId: string; ocupado: boolean; rodar: (acao: () => Promise<unknown>) => Promise<void>
}) {
  const proporcional = familia.modoRateioPadrao === 2
  const candidatos = familia.membros.filter((x) => x.usuarioId !== meuId && x.papelPermissao !== PAPEL_PERMISSAO.dependente)
  const [para, setPara] = useState<string[]>(() => (
    m.visibilidadeRenda === VISIBILIDADE_RENDA.valorParaTodos ? candidatos.map((x) => x.usuarioId) : (m.rendaVisivelPara ?? [])))
  const [contaNoPeso, setContaNoPeso] = useState(m.visibilidadeRenda !== VISIBILIDADE_RENDA.nada)
  const salvar = (lista: string[], peso: boolean) => {
    const nivel: VisibilidadeRenda = lista.length > 0 ? VISIBILIDADE_RENDA.valorParaAlguns : peso ? VISIBILIDADE_RENDA.soPeso : VISIBILIDADE_RENDA.nada
    void rodar(() => definirVisibilidadeRenda(familia.id, m.id, nivel, lista))
  }
  const marcar = (usuarioId: string, on: boolean) => {
    const lista = on ? [...para, usuarioId] : para.filter((x) => x !== usuarioId)
    setPara(lista); salvar(lista, contaNoPeso)
  }
  return (
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
        <Marcar marcado={contaNoPeso} desabilitado={ocupado} onChange={(on) => { setContaNoPeso(on); salvar([], on) }}>Contar a minha renda no peso da divisão</Marcar>
      )}
    </div>
  )
}
