// Bancos (contas) do v2: três números (saldo total, disponível em conta corrente + carteira, guardado na
// poupança, investimentos e caixinhas das metas) e a lista de contas — abertas ou encerradas. As caixinhas
// das metas aparecem num grupo próprio, só pra ver: a ficha leva pra página da meta (guardar e resgatar moram
// lá); caixinha de meta excluída não aparece. A tela é SÓ das contas: clicar numa linha abre, ali
// embaixo, a ficha dela (banco, tipo, agência, número, os cartões ligados a ela) e as ações (Excluir,
// Encerrar, Editar / Reabrir); extrato é assunto de Transações. As abertas vêm em grupos com o total de
// cada um — em conta, poupança, investimentos e dinheiro (a carteira e os cofrinhos) por último. As
// contas vêm todas de uma vez (são poucas),
// então Abertas | Encerradas filtra a lista já carregada. Outra tela pode mandar `state.abrir`
// (id) pra chegar com aquela conta aberta — é o que Nova/Editar/Encerrar fazem ao voltar.
import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ArrowRight, Ban, Pencil, PiggyBank, Plus, RotateCcw, Trash2, Wallet } from "lucide-react"
import { deleteConta, getContas, reabrirConta } from "../services/contaService"
import { getCartoes } from "../services/cartaoCreditoService"
import type { CartaoCredito } from "../types/CartaoCredito"
import { mensagemDeErro } from "../api/cliente"
import type { Conta } from "../types/Conta"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import FaceCartao from "../componentes/FaceCartao"
import { AcoesFicha, DadosFicha, GrupoFicha, ItemFicha, ListaFicha } from "../componentes/ListaFicha"
import { marcarContaDaCasa } from "../services/familiaService"
import DaCasa from "./DaCasa"
import LogoMarca from "../componentes/LogoMarca"
import Segmentos from "../componentes/Segmentos"
import { descreverConta, ehCaixinha, ehDinheiro, ehGuardado, rotuloTipo, temDadosBancarios, TIPO_CONTA } from "../dominio/conta"
import { NOME_BANDEIRA } from "../dominio/fatura"
import { dataBR } from "../utils/dateTime"
import styles from "./Bancos.module.css"

type Situacao = "abertas" | "encerradas"
const SITUACOES: { valor: Situacao; rotulo: string }[] = [
  { valor: "abertas", rotulo: "Abertas" },
  { valor: "encerradas", rotulo: "Encerradas" },
]

// Abertas e encerradas, com as caixinhas das metas; a caixinha de meta excluída (encerrada) fica de fora.
const carregarContas = () => getContas({ incluirEncerradas: true, incluirCaixinhas: true })
  .then((cs) => cs.filter((c) => !(ehCaixinha(c) && c.encerradaEm)))
// Por nome; no grupo "Dinheiro" a carteira padrão vem primeiro.
const ordenar = (xs: Conta[]) => xs.slice().sort((a, b) => Number(b.isCarteira) - Number(a.isCarteira) || a.nome.localeCompare(b.nome, "pt-BR"))
const soma = (xs: Conta[]) => xs.reduce((s, c) => s + c.saldoAtual, 0)
/** "Mastercard · •••• 0315 · fecha dia 3 · vence dia 10" (mesma linha de detalhe da lista de Cartões). */
const descreverCartao = (k: CartaoCredito) => [
  NOME_BANDEIRA[k.bandeira] ?? "Cartão",
  k.ultimosDigitos ? `•••• ${k.ultimosDigitos}` : null,
  !k.temCredito ? "só débito" : null,
  k.temCredito && k.diaFechamento ? `fecha dia ${k.diaFechamento}` : null,
  k.temCredito && k.diaVencimento ? `vence dia ${k.diaVencimento}` : null,
].filter(Boolean).join(" · ")

export default function Bancos() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [contas, setContas] = useState<Conta[] | null>(null)
  // Cartões ligados a cada conta (a ficha mostra). Sem eles a ficha só perde essa parte.
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [erro, setErro] = useState(false)
  const [situacao, setSituacao] = useState<Situacao>("abertas")
  const [abertaId, setAbertaId] = useState<string | null>(() => (state as { abrir?: string } | null)?.abrir ?? null)

  useEffect(() => {
    let vivo = true
    carregarContas().then((c) => { if (vivo) setContas(c) }).catch(() => { if (vivo) setErro(true) })
    getCartoes().then((k) => { if (vivo) setCartoes(k) }).catch(() => { /* ficha sem cartões */ })
    return () => { vivo = false }
  }, [])
  const recarregar = () => carregarContas().then(setContas)

  const abertas = useMemo(() => ordenar((contas ?? []).filter((c) => !c.encerradaEm)), [contas])
  const encerradas = useMemo(() => ordenar((contas ?? []).filter((c) => !!c.encerradaEm)), [contas])
  // Abertas em grupos (só os que têm conta): em conta, poupança, investimentos, dinheiro por último.
  // Encerradas: um grupo só.
  const grupos = useMemo(() => {
    if (situacao === "encerradas") return [{ chave: "encerradas", rotulo: "Encerradas", contas: encerradas, total: undefined as number | undefined }]
    return [
      { chave: "conta", rotulo: "Em conta", contas: abertas.filter((c) => !ehDinheiro(c) && !ehGuardado(c)) },
      { chave: "poupanca", rotulo: "Poupança", contas: abertas.filter((c) => ehGuardado(c) && c.tipo === TIPO_CONTA.poupanca) },
      { chave: "investimentos", rotulo: "Investimentos", contas: abertas.filter((c) => ehGuardado(c) && c.tipo === TIPO_CONTA.investimento) },
      { chave: "caixinhas", rotulo: "Caixinhas das metas", contas: abertas.filter(ehCaixinha) },
      { chave: "dinheiro", rotulo: "Dinheiro", contas: abertas.filter(ehDinheiro) },
    ].filter((g) => g.contas.length > 0).map((g) => ({ ...g, total: soma(g.contas) as number | undefined }))
  }, [situacao, abertas, encerradas])
  const vazio = grupos.every((g) => g.contas.length === 0)

  const totais = useMemo(() => {
    if (!contas) return null
    return {
      total: soma(abertas),
      disponivel: soma(abertas.filter((c) => !ehGuardado(c))),
      guardado: soma(abertas.filter(ehGuardado)),
    }
  }, [contas, abertas])

  // Chegou com uma conta encerrada pra abrir (acabou de encerrar): a lista mostra a aba dela.
  const abertaEncerrada = !!contas?.find((c) => c.id === abertaId)?.encerradaEm
  useEffect(() => { if (abertaEncerrada) setSituacao("encerradas") }, [abertaEncerrada])

  const mudou = async (o: "reaberta" | "excluida") => {
    await recarregar()
    if (o === "reaberta") setSituacao("abertas")
    else setAbertaId(null)
  }

  return (
    <div className={styles.pagina}>
      <Bloco className={styles.resumo}>
        <div className={styles.numeros}>
          <Numero rotulo="Saldo total" valor={totais?.total} />
          <Numero rotulo="Disponível" valor={totais?.disponivel} />
          <Numero rotulo="Guardado" valor={totais?.guardado} />
        </div>
      </Bloco>

      <Bloco semRespiro>
        <div className={styles.toolbar}>
          <Segmentos ariaLabel="Situação" valor={situacao} onChange={setSituacao}
            opcoes={SITUACOES.map((s) => ({ ...s, rotulo: s.valor === "encerradas" && encerradas.length > 0 ? `${s.rotulo} (${encerradas.length})` : s.rotulo }))} />
          <Botao compactoNoCelular onClick={() => navigate("/bancos/nova", { state: { voltarPara: "/bancos" } })}
            icone={<Plus size={15} strokeWidth={2.5} aria-hidden="true" />}>Nova conta</Botao>
        </div>
        {contas === null && !erro ? (
          <div className={styles.respiro}><Esqueleto linhas={3} altura={18} /></div>
        ) : erro ? (
          <p className={styles.vazio}>Não deu pra carregar as contas.</p>
        ) : vazio ? (
          <p className={styles.vazio}>{situacao === "abertas" ? "Nenhuma conta ainda." : "Nenhuma conta encerrada."}</p>
        ) : (
          <ListaFicha rotulo="Contas">
            {grupos.map((g) => (
              <GrupoFicha key={g.chave} rotulo={g.rotulo} extra={g.total !== undefined && <Dinheiro valor={g.total} className={styles.grupoTotal} />}>
                {g.contas.map((c) => (
                  <Linha key={c.id} c={c} cartoes={cartoes.filter((k) => k.contaId === c.id)} aberta={c.id === abertaId}
                    aoAbrir={() => setAbertaId((atual) => (atual === c.id ? null : c.id))} aoMudar={mudou} />
                ))}
              </GrupoFicha>
            ))}
          </ListaFicha>
        )}
      </Bloco>
    </div>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor?: number }) {
  return (
    <div className={styles.numero}>
      <span className={styles.rotulo}>{rotulo}</span>
      {valor === undefined ? <span className={styles.numeroEsqueleto} />
        : <Dinheiro valor={valor} className={styles.numeroValor} tom={valor < 0 ? "negativo" : undefined} />}
    </div>
  )
}

/** Uma conta: a linha (marca, nome + detalhe, saldo, seta) e, aberta, a ficha (dados, cartões) com as ações. */
function Linha({ c, cartoes, aberta, aoAbrir, aoMudar }: {
  c: Conta
  cartoes: CartaoCredito[]
  aberta: boolean
  aoAbrir: () => void
  /** A conta foi reaberta ou excluída: a lista recarrega. */
  aoMudar: (o: "reaberta" | "excluida") => Promise<void>
}) {
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const encerrada = !!c.encerradaEm

  const excluir = async () => {
    setOcupado(true); setErro(null)
    try { await deleteConta(c.id) } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setExcluindo(false); return }
    await aoMudar("excluida")
  }
  const reabrir = async () => {
    setOcupado(true); setErro(null)
    try { await reabrirConta(c.id); await aoMudar("reaberta") } catch (e) { setErro(mensagemDeErro(e)) }
    setOcupado(false)
  }

  return (
    <ItemFicha id={`conta-${c.id}`} aberto={aberta} aoAbrir={aoAbrir} apagado={encerrada}
      marca={c.isCarteira
        ? <span className={styles.carteira} aria-hidden="true"><Wallet size={18} strokeWidth={2} /></span>
        : ehCaixinha(c) ? <span className={styles.caixinha} aria-hidden="true"><PiggyBank size={18} strokeWidth={2} /></span>
        : <LogoMarca nome={c.bancoNome || c.nome} logoUrl={c.bancoLogoUrl} cor={c.bancoCor} tamanho={36} />}
      titulo={c.nome}
      detalhe={encerrada ? `Encerrada em ${dataBR(c.encerradaEm!)}` : descreverConta(c)}
      direita={<Dinheiro valor={c.saldoAtual} className={styles.valor} tom={encerrada ? "neutro" : c.saldoAtual < 0 ? "negativo" : undefined} />}>
          {erro && <p className={styles.alerta} role="alert">{erro}</p>}
          <DadosFicha>
            <div><dt>Tipo</dt><dd>{rotuloTipo(c)}</dd></div>
            {!c.isCarteira && temDadosBancarios(c.tipo) && (
              <>
                <div><dt>Banco</dt><dd>{c.bancoNome || "Sem banco"}</dd></div>
                <div><dt>Agência</dt><dd>{c.agencia || "—"}</dd></div>
                <div><dt>Número</dt><dd>{c.numeroConta || "—"}</dd></div>
              </>
            )}
            {encerrada && <div><dt>Encerrada em</dt><dd>{dataBR(c.encerradaEm!)}</dd></div>}
          </DadosFicha>
          {/* Conta da casa: o que nasce nela daqui pra frente já nasce dividido. Caixinha e encerrada, não. */}
          {!encerrada && !ehCaixinha(c) && (
            <DaCasa tipo="conta" className={styles.daCasa} familiaId={c.familiaId} aoMudar={(fid) => marcarContaDaCasa(c.id, fid)} />
          )}
          {cartoes.length > 0 && (
            <div className={styles.cartoes}>
              <span className={styles.cartoesTitulo}>Cartões</span>
              <ul className={styles.cartoesLista}>
                {cartoes.map((k) => (
                  <li key={k.id}>
                    <Link to={`/cartoes/${k.id}`} state={{ voltarPara: "/bancos" }} className={styles.cartao}>
                      <FaceCartao bandeira={k.bandeira} cor={k.bancoCor} />
                      <span className={styles.texto}>
                        <span className={styles.nome}>{k.nome}</span>
                        <span className={styles.sub}>{descreverCartao(k)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ehCaixinha(c) ? (
            <AcoesFicha>
              <Botao variante="primario" disabled={!c.metaId} onClick={() => navigate(`/metas/${c.metaId}`)}
                icone={<ArrowRight size={15} strokeWidth={2.25} aria-hidden="true" />}>Abrir a meta</Botao>
            </AcoesFicha>
          ) : !c.isCarteira && (
            <AcoesFicha>
                <Botao perigo disabled={ocupado} onClick={() => { setErro(null); setExcluindo(true) }} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Excluir</Botao>
                {encerrada ? (
                  <Botao variante="primario" disabled={ocupado} onClick={() => { void reabrir() }} icone={<RotateCcw size={15} strokeWidth={2.25} aria-hidden="true" />}>Reabrir</Botao>
                ) : (
                  <>
                    <Botao perigo onClick={() => navigate(`/bancos/${c.id}/encerrar`, { state: { voltarPara: "/bancos" } })}
                      icone={<Ban size={15} strokeWidth={2.25} aria-hidden="true" />}>Encerrar</Botao>
                    <Botao variante="primario" onClick={() => navigate(`/bancos/${c.id}/editar`, { state: { voltarPara: "/bancos" } })}
                      icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />}>Editar</Botao>
                  </>
                )}
            </AcoesFicha>
          )}

      <Confirmar
        aberto={excluindo}
        titulo="Excluir conta?"
        texto={<>Só dá pra excluir conta sem lançamentos (criada por engano). Conta com histórico se <strong>encerra</strong>: sai das listas e o histórico fica.</>}
        rotuloConfirmar="Excluir"
        perigo
        ocupado={ocupado}
        onConfirmar={() => { void excluir() }}
        onCancelar={() => setExcluindo(false)}
      />
    </ItemFicha>
  )
}
