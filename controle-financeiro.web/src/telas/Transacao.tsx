// Tela da transação do v2 — ver, editar e excluir. Mesmas regras do app atual:
// - pagamento de fatura não se edita (se ESTORNA); a transferência edita e exclui INTEIRA, as duas pernas juntas
//   (editar pela perna abre a transferência no mesmo formulário; a de caixinha de meta só pela tela de Metas);
// - a edição é o mesmo FormularioTransacao da criação; virar transferência/parcelado o servidor troca numa
//   transação só do banco;
// - data futura só em compra no cartão ou lançamento previsto (o back recusa o resto);
// - hora é opcional em criar e editar (regra do formulário, 2026-10-31).
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { Pencil, Trash2, Undo2 } from "lucide-react"
import { deleteTransaction, getTransaction, type EdicaoLancamentoResultado } from "../services/transactionService"
import { estornarPagamento } from "../services/faturaService"
import { getCategories } from "../services/categoryService"
import { getSubcategories } from "../services/subcategoryService"
import { getContas } from "../services/contaService"
import { getCartoes } from "../services/cartaoCreditoService"
import { getTransferenciaDaTransacao } from "../services/transferenciaService"
import { mensagemDeErro } from "../api/cliente"
import type { Transaction } from "../types/Transaction"
import type { Transferencia } from "../types/Transferencia"
import type { Category } from "../types/Category"
import type { Subcategory } from "../types/Subcategory"
import type { Conta } from "../types/Conta"
import type { CartaoCredito } from "../types/CartaoCredito"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Confirmar from "../componentes/Confirmar"
import Botao from "../componentes/Botao"
import { RodapeFormulario } from "../componentes/Formulario"
import Etiqueta from "../componentes/Etiqueta"
import { Dinheiro, type TomDinheiro } from "../componentes/Dinheiro"
import { formatMoney } from "../utils/money"
import FormularioTransacao from "./FormularioTransacao"
import TransacaoFamilia from "./TransacaoFamilia"
import styles from "./Transacao.module.css"

const naturezaDe = (t: Transaction) =>
  t.ehTransferencia ? "Transferência" : t.ehPagamentoFatura ? "Pagamento de fatura" : t.ehAcerto ? "Acerto da família" : t.tipo === 2 ? "Receita" : "Despesa"
const fmtData = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

export default function Transacao() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const editando = location.pathname.endsWith("/editar")
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? "/transacoes"

  const [t, setT] = useState<Transaction | null>(null)
  const [naoEncontrada, setNaoEncontrada] = useState(false)
  const [categorias, setCategorias] = useState<Category[]>([])
  const [subcategorias, setSubcategorias] = useState<Subcategory[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])

  // Só a edição precisa das contas e cartões (pra trocar de conta/cartão ou virar transferência).
  useEffect(() => {
    if (!editando) return
    let vivo = true
    getContas().then((c) => { if (vivo) setContas(c) }).catch(() => { /* fica só com a conta atual */ })
    getCartoes().then((c) => { if (vivo) setCartoes(c) }).catch(() => { /* idem */ })
    return () => { vivo = false }
  }, [editando])

  // Relê ao trocar de modo: depois de salvar, o "ver" mostra o que ficou gravado.
  useEffect(() => {
    let vivo = true
    setT(null); setNaoEncontrada(false)
    getTransaction(id).then((x) => { if (vivo) setT(x) }).catch(() => { if (vivo) setNaoEncontrada(true) })
    return () => { vivo = false }
  }, [id, editando])

  useEffect(() => {
    let vivo = true
    getCategories().then((c) => { if (vivo) setCategorias(c) }).catch(() => { /* fica sem nome de categoria */ })
    getSubcategories().then((s) => { if (vivo) setSubcategorias(s) }).catch(() => { /* idem */ })
    return () => { vivo = false }
  }, [])


  if (naoEncontrada)
    return (
      <div className={styles.pagina}>
        <h1 className={styles.titulo}>Transação não encontrada</h1>
        <p className={styles.muted}>Ela pode ter sido excluída.</p>
      </div>
    )
  if (!t) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>

  // Acerto da família também não: desfaz em Entre vocês (o outro lado está ligado a ele).
  const editavel = !t.ehPagamentoFatura && !t.ehAcerto
  if (editando && editavel)
    return <Editar t={t} categorias={categorias} subcategorias={subcategorias} contas={contas} cartoes={cartoes}
      // Virou transferência/parcelado: o id antigo não existe mais, volta pra lista.
      aoSalvar={(r) => r && r.tipo !== "transacao"
        ? navigate(voltarPara, { replace: true })
        : navigate(`/transacoes/${t.id}`, { replace: true, state: location.state })}
      aoCancelar={() => navigate(`/transacoes/${t.id}`, { replace: true, state: location.state })} />

  return <Ver t={t} categorias={categorias} subcategorias={subcategorias} editavel={editavel}
    aoEditar={() => navigate(`/transacoes/${t.id}/editar`, { replace: true, state: location.state })}
    aoSair={() => navigate(voltarPara, { replace: true })}
    // Ação do quadro Família (dividir, parar, pra quem): relê o que ficou gravado, sem sair da página.
    aoMudar={() => { getTransaction(id).then(setT).catch(() => { /* fica com o que estava */ }) }} />
}

// ─────────────────────────────────────────────────────────────────────────────── ver

function Ver({ t, categorias, subcategorias, editavel, aoEditar, aoSair, aoMudar }: {
  t: Transaction; categorias: Category[]; subcategorias: Subcategory[]
  editavel: boolean; aoEditar: () => void; aoSair: () => void; aoMudar: () => void
}) {
  const [excluindo, setExcluindo] = useState(false)
  const [estornando, setEstornando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // Idempotency-Key do estorno: nasce quando a confirmação ABRE e vale pra toda tentativa dela — se a rede
  // cair depois de o servidor estornar, confirmar de novo devolve o mesmo estorno em vez de estornar 2x.
  const chaveEstorno = useRef("")

  const neutro = !!(t.ehTransferencia || t.ehPagamentoFatura || t.ehAcerto)
  const tom: TomDinheiro | undefined = neutro ? "neutro" : t.tipo === 2 ? "positivo" : "negativo"
  const cat = categorias.find((c) => c.id === t.categoriaId)
  const sub = subcategorias.find((s) => s.id === t.subcategoriaId)
  const parcela = t.numeroParcela && t.parcelas && t.parcelas > 1 ? `Parcela ${t.numeroParcela} de ${t.parcelas}` : null

  const dados: [string, string][] = [
    ["Data", t.hora ? `${fmtData(t.data)} às ${t.hora.slice(0, 5)}` : fmtData(t.data)],
    [t.cartaoCreditoId ? "Cartão" : "Conta", t.cartaoCreditoNome ?? t.contaNome ?? "Não informada"],
    ["Meio de pagamento", t.meioPagamentoDescricao ?? "Não informado"],
    ["Categoria", cat ? (sub ? `${cat.descricao} › ${sub.nome}` : cat.descricao) : "Sem categoria"],
  ]
  // Pagamento de empréstimo com juros: um lançamento só, e aqui a separação (o que é do empréstimo não conta; os juros sim).
  if (t.ehEmprestimo && t.valorJuros) {
    const recebeu = t.tipo === 2
    dados.push(
      [recebeu ? "Seu dinheiro voltando" : "Devolvendo o que pegou", `${formatMoney(t.valor - t.valorJuros)}, não conta como ${recebeu ? "receita" : "gasto"}`],
      ["Juros", `${formatMoney(t.valorJuros)}, entra como ${recebeu ? "receita" : "gasto"}`],
    )
  }

  const excluir = async () => {
    setOcupado(true); setErro(null)
    try { await deleteTransaction(t.id) } catch (e) { setErro(mensagemDeErro(e)); setOcupado(false); setExcluindo(false); return }
    aoSair()
  }

  const abrirEstorno = () => { chaveEstorno.current = crypto.randomUUID(); setErro(null); setEstornando(true) }
  const estornar = async () => {
    setOcupado(true); setErro(null)
    try {
      await estornarPagamento(t.id, chaveEstorno.current)
    } catch (e) {
      // 409 = já estornado (outra aba, retry): o resultado é o mesmo — sai. Rede/5xx: fica pra tentar de novo (mesma chave).
      if ((e as { response?: { status?: number } })?.response?.status === 409) { aoSair(); return }
      setErro(mensagemDeErro(e)); setOcupado(false); return
    }
    aoSair()
  }

  return (
    <div className={styles.pagina}>
      {/* Título à esquerda, etiquetas à direita na mesma linha (as ações ficam no pé). */}
      <header className={styles.cabecalho}>
        <h1 className={styles.titulo}>{t.descricao}</h1>
        <div className={styles.chips}>
            <Etiqueta tom={neutro ? undefined : t.tipo === 2 ? "positivo" : "negativo"}>{naturezaDe(t)}</Etiqueta>
            {t.statusTransacao === 0 ? <Etiqueta tom="alerta">Previsto</Etiqueta> : <Etiqueta>Efetivado</Etiqueta>}
            {t.recorrenteOrigemId && <Etiqueta>Conta fixa</Etiqueta>}
            {parcela && <Etiqueta>{parcela}</Etiqueta>}
        </div>
      </header>

      {erro && <p className={styles.alerta} role="alert">{erro}</p>}

      <Bloco>
        <Dinheiro valor={t.valor} tom={tom} className={styles.valor} />
        <dl className={styles.dados}>
          {dados.map(([rotulo, valor]) => (
            <div key={rotulo} className={styles.dado}><dt>{rotulo}</dt><dd>{valor}</dd></div>
          ))}
        </dl>
      </Bloco>

      {/* Só despesa entra no equilíbrio da família (receita, transferência, pagamento de fatura e empréstimo não). */}
      {t.tipo !== 2 && !neutro && !t.ehEmprestimo && <TransacaoFamilia t={t} aoMudar={aoMudar} />}

      {/* Ações no pé, à direita — o mesmo lugar dos botões de Nova e Editar (destrutiva à esquerda, principal à direita). */}
      <RodapeFormulario>
        {t.ehAcerto ? null : t.ehPagamentoFatura ? (
          <Botao onClick={abrirEstorno} icone={<Undo2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Estornar pagamento</Botao>
        ) : (
          <Botao perigo onClick={() => { setErro(null); setExcluindo(true) }}
            icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Excluir</Botao>
        )}
        {editavel && (
          <Botao variante="primario" onClick={aoEditar} icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />}>Editar</Botao>
        )}
      </RodapeFormulario>

      <Confirmar
        aberto={excluindo}
        titulo="Excluir transação?"
        texto={t.ehTransferencia
          ? <>{t.descricao} · {formatMoney(t.valor)}. <strong>As duas pernas da transferência</strong> saem juntas.</>
          : <>{t.descricao} · {formatMoney(t.valor)}</>}
        rotuloConfirmar="Excluir"
        perigo
        ocupado={ocupado}
        onConfirmar={() => { void excluir() }}
        onCancelar={() => setExcluindo(false)}
      />
      <Confirmar
        aberto={estornando}
        titulo="Estornar pagamento?"
        texto={<>{formatMoney(t.valor)} voltam pra conta e a fatura volta a dever esse valor.{erro && <span className={styles.erroDialogo}>{erro}</span>}</>}
        rotuloConfirmar="Estornar"
        ocupado={ocupado}
        onConfirmar={() => { void estornar() }}
        onCancelar={() => { setEstornando(false); setErro(null) }}
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────── editar

function Editar({ t, categorias, subcategorias, contas, cartoes, aoSalvar, aoCancelar }: {
  t: Transaction; categorias: Category[]; subcategorias: Subcategory[]; contas: Conta[]; cartoes: CartaoCredito[]
  aoSalvar: (r?: EdicaoLancamentoResultado) => void; aoCancelar: () => void
}) {
  // Perna de transferência: edita a transferência inteira, então precisa dela (id e as duas contas).
  const [tf, setTf] = useState<Transferencia | null>(null)
  const [tfErro, setTfErro] = useState<string | null>(null)
  useEffect(() => {
    if (!t.ehTransferencia) return
    let vivo = true
    getTransferenciaDaTransacao(t.id).then((x) => { if (vivo) setTf(x) }).catch((e) => { if (vivo) setTfErro(mensagemDeErro(e)) })
    return () => { vivo = false }
  }, [t.id, t.ehTransferencia])

  if (t.ehTransferencia) {
    if (tfErro) return <div className={styles.pagina}><h1 className={styles.titulo}>Editar transferência</h1><p className={styles.muted}>{tfErro}</p></div>
    if (!tf) return <div className={styles.pagina}><Bloco><Esqueleto linhas={5} altura={16} /></Bloco></div>
    if (tf.comCaixinha)
      return (
        <div className={styles.pagina}>
          <h1 className={styles.titulo}>Editar transferência</h1>
          <p className={styles.muted}>Esta transferência é de uma meta: guarde ou resgate pela tela de Metas.</p>
          <RodapeFormulario><Botao onClick={aoCancelar}>Voltar</Botao></RodapeFormulario>
        </div>
      )
  }

  return (
    <div className={styles.pagina}>
      <h1 className={styles.titulo}>{t.ehTransferencia ? "Editar transferência" : "Editar transação"}</h1>
      <FormularioTransacao transacao={t} contas={contas} cartoes={cartoes} categorias={categorias} subcategorias={subcategorias}
        transferenciaEditada={tf ? { id: tf.id, contaOrigemId: tf.contaOrigemId, contaDestinoId: tf.contaDestinoId } : undefined}
        aoSair={aoCancelar} aoSalvo={aoSalvar} />
    </div>
  )
}
