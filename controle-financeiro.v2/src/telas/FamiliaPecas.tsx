// Peças das páginas do espaço de família (/familias/:id/...): o que mais de uma página usa. Desenho
// aprovado pelo Gustavo em 2026-10-18 (docs/features/familia): todo número é FATO, nunca cobrança
// ("pagou a mais / a menos / equilibrado", "pra equilibrar o mês: X → Y"); renda é da PESSOA e a família
// só reflete o que cada um liberou (quem não liberou pra você não tem linha de renda em lugar nenhum).
// Quem "só vê" (permissão Dependente) não age, não vê renda de ninguém e não entra na divisão (o servidor manda).
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, Check, ExternalLink, LogOut, Trash2, X } from "lucide-react"
import {
  aprovarDespesa, atribuirResponsavel, cancelarAcerto, confirmarAcerto, lancarAcerto, definirLimiteAprovacao, definirModoRateio, dissolverFamilia,
  getFamilia, rejeitarDespesa, removerMembro,
} from "../services/familiaService"
import { mensagemDeErro } from "../api/cliente"
import { useAuth } from "../auth/useAuth"
import { getContas } from "../services/contaService"
import type { Conta } from "../types/Conta"
import { recarregarEspacos } from "../estado/espaco"
import type { AcertoContas, BalancoFamilia, DespesaCompartilhada, FamiliaDetalhe, MembroFamilia, ModoRateio } from "../types/Familia"
import type { RendaFamilia } from "../types/Renda"
import { urlFoto } from "../componentes/Avatar"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import EntradaValor from "../componentes/EntradaValor"
import Etiqueta from "../componentes/Etiqueta"
import Interruptor from "../componentes/Interruptor"
import { AcoesFicha, DadosFicha, InicialFicha, ItemFicha } from "../componentes/ListaFicha"
import Selecao from "../componentes/Selecao"
import { APROVACAO, MODOS_RATEIO, PAPEL_PERMISSAO, fraseSaldo, primeiroNome, sugerirEquilibrio } from "../dominio/familia"
import { mesAnoCurto } from "../dominio/meta"
import { dataBR, diaDeInstante } from "../utils/dateTime"
import { formatMoney, moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./Familia.module.css"

export const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
export const idade = (nascimento: string) => {
  const n = new Date(nascimento.slice(0, 10)), h = new Date()
  let a = h.getFullYear() - n.getFullYear()
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--
  return a
}

/** A família da rota, com o que toda página precisa saber de quem está olhando. */
export function useFamilia(id: string, versao: number) {
  const [detalhe, setDetalhe] = useState<FamiliaDetalhe | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    getFamilia(id).then((d) => { if (vivo) setDetalhe(d) }).catch(() => { if (vivo) setErro("Não deu pra carregar a família. Recarregue a página.") })
    return () => { vivo = false }
  }, [id, versao])
  return { detalhe, erro }
}

/** Foto de cada membro (usuarioId → URL), pra pôr o rosto em quem pagou, no equilíbrio, nas passagens. */
export function fotosDe(detalhe: FamiliaDetalhe): Record<string, string | undefined> {
  return Object.fromEntries(detalhe.membros.map((m) => [m.usuarioId, urlFoto(m.usuarioId, m.fotoEm)]))
}

export function papeisDe(detalhe: FamiliaDetalhe, meuId: string) {
  const eu = detalhe.membros.find((m) => m.usuarioId === meuId)
  return {
    eu,
    admin: detalhe.ehAdmin,
    souCriador: detalhe.criadoPorUsuarioId === meuId,
    // Quem só vê não lança, não aprova, não passa dinheiro: a tela nem mostra essas ações.
    podeAgir: (eu?.papelPermissao ?? PAPEL_PERMISSAO.dependente) !== PAPEL_PERMISSAO.dependente,
  }
}

export function Alerta({ erro }: { erro: string | null }) {
  return erro ? <p className={styles.alerta} role="alert">{erro}</p> : null
}

// ── O mês: despesas da família e renda da casa (só de quem liberou pra quem olha) ──────────────────────
export function FaixaMes({ total, renda, meuId }: { total: number; renda: RendaFamilia | null; meuId: string }) {
  // "Renda da casa" só quando alguém ALÉM de você liberou o valor pra você; lista só quem mostra.
  const rendaDaCasa = renda && renda.membros.some((m) => m.mostrada && m.usuarioId !== meuId) ? renda : null
  return (
    <div className={styles.faixa}>
      <div className={styles.numero}>
        <span className={styles.rotulo}>Despesas da família</span>
        <Dinheiro valor={total} className={styles.grande} />
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
  )
}

// ── Quem pagou o quê e o que falta pra equilibrar ───────────────────────────────────────────────────────
export function Saldos({ balanco, meuId, fotos }: { balanco: BalancoFamilia; meuId: string; fotos?: Record<string, string | undefined> }) {
  return (
    <ul className={styles.saldos} aria-label="Quanto cada um pagou">
      {balanco.saldos.map((s) => {
        const f = fraseSaldo(s.saldo)
        return (
          <li key={s.usuarioId}>
            <InicialFicha texto={s.nome} destaque={s.usuarioId === meuId} foto={fotos?.[s.usuarioId]} />
            <span className={styles.saldoTexto}>
              <span className={styles.saldoNome}>{primeiroNome(s.nome)}{s.usuarioId === meuId && <span className={styles.voce}> você</span>}{s.saiuEm && <span className={styles.voce}> saiu em {mesAnoCurto(s.saiuEm)}</span>}</span>
              <span className={styles.saldoDetalhe}>pagou <Dinheiro valor={s.pagou} /> · a parte é <Dinheiro valor={s.cota} /></span>
            </span>
            <span className={styles.saldoValor} data-tom={f.tom}>{f.tom === "neutro" ? "Equilibrado" : <>{f.texto} <Dinheiro valor={Math.abs(s.saldo)} /></>}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function Equilibrio({ balanco, familiaId, podeAgir, voltarPara }: { balanco: BalancoFamilia; familiaId: string; podeAgir: boolean; voltarPara: string }) {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const equilibrio = sugerirEquilibrio(balanco.saldos)
  return (
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
                {/* Só quem passa ou recebe registra (o fato é dos dois). */}
                {podeAgir && (e.deUsuarioId === usuario?.id || e.paraUsuarioId === usuario?.id) && <Botao onClick={() => navigate(`/familias/${familiaId}/acertos/novo`, { state: { de: e.deUsuarioId, para: e.paraUsuarioId, valor: e.valor, voltarPara } })}>Marcar como feito</Botao>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// ── Sair (quem não criou) ou dissolver (quem criou): só o botão; a consequência vai na confirmação ────────
export function SairOuDissolver({ familia, eu, souCriador }: { familia: FamiliaDetalhe; eu?: MembroFamilia; souCriador: boolean }) {
  const navigate = useNavigate()
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  if (!eu) return null
  const confirmar = async () => {
    setOcupado(true); setErro(null)
    try {
      if (souCriador) await dissolverFamilia(familia.id); else await removerMembro(familia.id, eu.id)
      void recarregarEspacos()
      navigate("/dashboard", { replace: true })
    } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setConfirmando(false) }
  }
  return (
    <Bloco>
      <Alerta erro={erro} />
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

// ── Despesa compartilhada: quem pagou, aprovação e responsável na própria linha ─────────────────────────────
export function Despesa({ d, familiaId, meuId, podeAgir, membros, voltarPara, aoMudar, foto }: {
  d: DespesaCompartilhada; familiaId: string; meuId: string; podeAgir: boolean; membros: { valor: string; rotulo: string }[]; voltarPara: string; aoMudar: () => void
  /** Foto de quem pagou. */
  foto?: string
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
      marca={<InicialFicha texto={d.pagadorNome} destaque={minha} foto={foto} />}
      titulo={d.descricao}
      detalhe={<>{primeiroNome(d.pagadorNome)} pagou · {diaMes(d.data)}{d.categoriaNome ? ` · ${d.categoriaNome}` : ""}{d.responsavelNome ? ` · responsável: ${primeiroNome(d.responsavelNome)}` : ""}</>}
      direita={<span className={styles.direita}>{etiqueta}<span className={styles.valorComParte}><Dinheiro valor={d.valor} className={styles.valor} />{d.minhaParte != null && d.minhaParte !== d.valor && <span className={styles.parte}>sua parte <Dinheiro valor={d.minhaParte} /></span>}</span></span>}>
      <Alerta erro={erro} />
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
          {minha && <Botao variante="texto" onClick={() => navigate(`/transacoes/${d.id}`, { state: { voltarPara } })} icone={<ExternalLink size={15} strokeWidth={2.25} aria-hidden="true" />}>Abrir lançamento</Botao>}
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

/** Dinheiro entre vocês (passo 3): quem passou → esperando quem recebeu confirmar; quem recebeu confirma (e diz em
 *  qual conta entrou) ou "Não recebi"; cada um lança o SEU lado numa conta sua quando quiser. */
export function Acerto({ a, familiaId, podeAgir, aoMudar, foto }: { a: AcertoContas; familiaId: string; podeAgir: boolean; aoMudar: () => void; foto?: string }) {
  const { usuario } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [dialogo, setDialogo] = useState<null | "desfazer" | "naoRecebi" | "confirmar" | "lancar">(null)
  const [contas, setContas] = useState<Conta[] | null>(null)
  const [contaId, setContaId] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const souDe = usuario?.id === a.deUsuarioId
  const souPara = usuario?.id === a.paraUsuarioId
  const pendente = !a.confirmadoEm
  const de = primeiroNome(a.deNome), para = primeiroNome(a.paraNome)
  // O meu lado ainda sem lançamento: quem passou lança quando quiser; quem recebeu, depois de confirmar.
  const possoLancar = podeAgir && !a.minhaTransacaoId && (souDe || (souPara && !pendente))

  useEffect(() => {
    if ((dialogo !== "confirmar" && dialogo !== "lancar") || contas) return
    let vivo = true
    getContas().then((c) => { if (vivo) { setContas(c); setContaId((x) => x || (c.find((k) => k.isCarteira) ?? c[0])?.id || "") } }).catch(() => { if (vivo) setContas([]) })
    return () => { vivo = false }
  }, [dialogo, contas])

  const rodar = async (acao: () => Promise<unknown>) => {
    setOcupado(true); setErro(null)
    try { await acao(); setDialogo(null); aoMudar() } catch (e) { setErro(mensagemDeErro(e)); setDialogo(null) }
    setOcupado(false)
  }
  const opcoesConta = (comSemConta: boolean) => [
    ...(contas ?? []).map((c) => ({ valor: c.id, rotulo: c.nome })),
    ...(comSemConta ? [{ valor: "", rotulo: "Não registrar em conta" }] : []),
  ]
  const escolherConta = (rotulo: string, comSemConta: boolean) => (
    <Campo rotulo={rotulo}>
      <Selecao valor={contaId} desabilitado={contas === null} placeholder={contas === null ? "Carregando…" : "Escolha a conta"}
        opcoes={opcoesConta(comSemConta)} onChange={setContaId} />
    </Campo>
  )

  return (
    <>
      <ItemFicha id={`acerto-${a.id}`} aberto={aberto} aoAbrir={() => setAberto((act) => !act)}
        marca={<InicialFicha texto={a.deNome} foto={foto} />}
        titulo={<>{de} <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" className={styles.seta} /> {para}</>}
        detalhe={`${a.data ? dataBR(a.data) : diaDeInstante(a.criadoEm)}${a.observacao ? ` · ${a.observacao}` : ""}`}
        direita={<span className={styles.acertoDireita}>
          {pendente && <Etiqueta tom="alerta">{souPara ? "Esperando você confirmar" : `Esperando ${para} confirmar`}</Etiqueta>}
          <Dinheiro valor={a.valor} className={styles.valor} />
        </span>}>
        <Alerta erro={erro} />
        {podeAgir ? (
          <AcoesFicha>
            {a.minhaTransacaoId && <Link to={`/transacoes/${a.minhaTransacaoId}`} className={styles.linkFicha}>Ver na minha conta</Link>}
            {pendente && souPara ? (
              <>
                <Botao variante="texto" perigo disabled={ocupado} onClick={() => setDialogo("naoRecebi")}>Não recebi</Botao>
                <Botao variante="primario" disabled={ocupado} onClick={() => setDialogo("confirmar")}>Confirmar</Botao>
              </>
            ) : (
              <>
                {(souDe || souPara) && <Botao variante="texto" perigo disabled={ocupado} onClick={() => setDialogo("desfazer")}>Desfazer</Botao>}
                {possoLancar && <Botao disabled={ocupado} onClick={() => setDialogo("lancar")}>Lançar na minha conta</Botao>}
              </>
            )}
          </AcoesFicha>
        ) : <p className={styles.dica}>Registrado por quem lança.</p>}
      </ItemFicha>

      <Confirmar aberto={dialogo === "desfazer"} perigo ocupado={ocupado} titulo="Desfazer este registro?"
        texto={a.confirmadoEm ? "O valor volta a contar no equilíbrio do mês e os lançamentos dele nas contas saem." : "O registro sai, e a saída lançada na conta também."}
        rotuloConfirmar="Desfazer" rotuloCancelar="Manter" onConfirmar={() => { void rodar(() => cancelarAcerto(familiaId, a.id)) }} onCancelar={() => setDialogo(null)} />
      <Confirmar aberto={dialogo === "naoRecebi"} perigo ocupado={ocupado} titulo={`Não recebeu de ${de}?`}
        texto={`O registro sai, e a saída lançada na conta de ${de} também.`}
        rotuloConfirmar="Não recebi" rotuloCancelar="Voltar" onConfirmar={() => { void rodar(() => cancelarAcerto(familiaId, a.id)) }} onCancelar={() => setDialogo(null)} />
      <Confirmar aberto={dialogo === "confirmar"} ocupado={ocupado} titulo={`${de} passou ${formatMoney(a.valor)} pra você`}
        rotuloConfirmar="Confirmar" onConfirmar={() => { void rodar(() => confirmarAcerto(familiaId, a.id, contaId || null, a.data)) }} onCancelar={() => setDialogo(null)}>
        {escolherConta("Em qual conta entrou", true)}
      </Confirmar>
      <Confirmar aberto={dialogo === "lancar"} ocupado={ocupado} titulo={souDe ? `De qual conta saíram os ${formatMoney(a.valor)}?` : `Em qual conta entraram os ${formatMoney(a.valor)}?`}
        rotuloConfirmar="Lançar" onConfirmar={() => { if (contaId) void rodar(() => lancarAcerto(familiaId, a.id, contaId, a.data)) }} onCancelar={() => setDialogo(null)}>
        {escolherConta("Conta", false)}
      </Confirmar>
    </>
  )
}

// ── Regras: como divide e se pede OK pra despesa grande (admin muda; os outros veem) ──────────────────────
export function Regras({ familia, aoMudar }: { familia: FamiliaDetalhe; aoMudar: () => void }) {
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
      <Bloco>
        <DadosFicha>
          <div><dt>Divisão</dt><dd>{modo.rotulo}<span className={styles.dica}> · {modo.detalhe}</span></dd></div>
          <div><dt>Pedir OK pra despesa grande</dt><dd>{familia.limiteAprovacao ? <>a partir de <Dinheiro valor={familia.limiteAprovacao} /></> : "Não"}</dd></div>
        </DadosFicha>
      </Bloco>
    )
  }
  return (
    <Bloco>
      <div className={styles.regras}>
        <Alerta erro={erro} />
        <Campo rotulo="Divisão das despesas">
          <Selecao valor={String(familia.modoRateioPadrao)} desabilitado={ocupado} onChange={(v) => rodar(() => definirModoRateio(familia.id, Number(v) as ModoRateio))}
            opcoes={MODOS_RATEIO.map((m) => ({ valor: String(m.valor), rotulo: m.rotulo, detalhe: m.detalhe }))} />
        </Campo>
        {/* A parte de cada um fica gravada ao dividir: mudar aqui não mexe no que já foi dividido. */}
        <p className={styles.regraNota}>Vale pras próximas despesas. As já divididas ficam como estão.</p>
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
