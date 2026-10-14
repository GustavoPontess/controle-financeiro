import React, { useCallback, useEffect, useState } from "react"
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom"
import { ChevronLeft, Pencil, Split, Trash2, Undo2, User, Users } from "lucide-react"
import { PontesBadge, PontesButton, PontesCard, PontesDialog } from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import TransactionForm, { type TransactionFormData } from "./components/TransactionForm/TransactionForm"
import EstornarPagamentoDialog from "../CreditCards/EstornarPagamentoDialog"
import { podeCompartilhar, useAcoesFamilia } from "./components/AcoesFamilia/useAcoesFamilia"
import { useDetalheNoCaminho } from "../../layouts/Default/useDetalheNoCaminho"
import { createTransaction, deleteTransaction, getTransaction, updateTransaction } from "../../services/transactionService"
import { createRecorrente } from "../../services/recorrenteService"
import { createTransferencia } from "../../services/transferenciaService"
import { getCategories } from "../../services/categoryService"
import { getSubcategories } from "../../services/subcategoryService"
import { getContas } from "../../services/contaService"
import { getCartoes } from "../../services/cartaoCreditoService"
import type { Transaction } from "../../types/Transaction"
import type { Category } from "../../types/Category"
import type { Subcategory } from "../../types/Subcategory"
import type { Conta } from "../../types/Conta"
import type { CartaoCredito } from "../../types/CartaoCredito"
import styles from "./TransactionPage.module.css"

type Notification = { open: boolean; message: string; severity: "success" | "error" | "warning" }
type OutletContextType = { notify: React.Dispatch<React.SetStateAction<Notification>> }

/** Pra onde o "Voltar" / salvar leva: a tela de onde a pessoa veio (o botão global manda), senão a lista. */
type EstadoNavegacao = { voltarPara?: string } | null

/** Converte string BR ("1.234,56") para número. */
const parseValor = (v: string) => Number(v.replace(/\./g, "").replace(",", "."))
const formatValor = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** "YYYY-MM-DD" → "dd/mm/aaaa" lendo o string (sem fuso). */
const fmtData = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

const natureza = (t: Transaction) =>
  t.ehTransferencia ? "Transferência" : t.ehPagamentoFatura ? "Pagamento de fatura" : t.tipo === 2 ? "Receita" : "Despesa"

/**
 * Tela única da transação — criar, ver e editar (substitui os popups "Nova transação" e "Editar").
 * `/transactions/nova` cria; `/transactions/:id` mostra; `/transactions/:id/editar` liga o formulário
 * na mesma tela. Pagamento de fatura e perna de transferência não se editam (o outro lado ficaria
 * desemparelhado): o pagamento se estorna, a transferência se exclui inteira.
 */
export default function TransactionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { notify } = useOutletContext<OutletContextType>()
  const estado = location.state as EstadoNavegacao
  const voltarPara = estado?.voltarPara ?? "/transactions"
  const criando = !id
  const editando = !!id && location.pathname.endsWith("/editar")

  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [cartoes, setCartoes] = useState<CartaoCredito[]>([])
  const [transacao, setTransacao] = useState<Transaction | null>(null)
  const [carregando, setCarregando] = useState(!criando)
  const [naoEncontrada, setNaoEncontrada] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [estornando, setEstornando] = useState(false)
  // Idempotency-Key da conta fixa: uma por abertura da tela (ela remonta a cada navegação), reusada no
  // retry — duplo clique ou rede não criam a conta fixa 2x.
  const [chaveRecorrente] = useState(() => crypto.randomUUID())
  // Compartilhar / atribuir / rateio — moravam no ⋮ da lista; agora só aqui.
  const familia = useAcoesFamilia(notify)

  useDetalheNoCaminho(criando ? "Nova transação" : transacao?.descricao)

  useEffect(() => {
    Promise.all([getCategories(), getSubcategories(), getContas(), getCartoes()])
      .then(([cats, subs, cts, carts]) => { setCategories(cats); setSubcategories(subs); setContas(cts); setCartoes(carts) })
      .catch(() => notify({ open: true, message: "Erro ao carregar categorias e contas", severity: "error" }))
  }, [notify])

  // Relê ao trocar de modo: depois de salvar, o "ver" mostra o que ficou gravado (não o que estava na tela).
  useEffect(() => {
    if (!id) return
    let vivo = true
    setCarregando(true)
    getTransaction(id)
      .then((t) => { if (vivo) setTransacao(t) })
      .catch(() => { if (vivo) setNaoEncontrada(true) })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [id, editando])

  const voltar = useCallback(() => navigate(voltarPara), [navigate, voltarPara])
  const verTransacao = () => navigate(`/transactions/${id}`, { replace: true, state: estado })

  // ── Criar (mesma regra do antigo popup) ───────────────────────────────────
  const criar = async (data: TransactionFormData) => {
    const valor = parseValor(data.valor)
    try {
      if (data.natureza === "transferencia") {
        await createTransferencia({
          contaOrigemId: data.contaOrigemId, contaDestinoId: data.contaDestinoId, valor,
          // date e time separados (sem fuso), como o lançamento comum: "YYYY-MM-DD" + "HH:MM:SS".
          data: data.data, hora: data.hora ? `${data.hora}:00` : null, descricao: data.descricao,
        })
        notify({ open: true, message: "Transferência criada com sucesso", severity: "success" })
      } else {
        const isCredito = data.meioPagamento === 3
        if (data.modo === "recorrente") {
          await createRecorrente({
            descricao: data.descricao, valor, tipo: data.tipo,
            categoriaId: data.categoriaId || undefined,
            contaId: isCredito ? undefined : data.contaId || undefined,
            cartaoCreditoId: isCredito ? data.cartaoCreditoId || undefined : undefined,
            frequencia: data.frequencia,
            // Backend gera por DataInicio + intervalo; "dia" é metadado → do string "YYYY-MM-DD" (sem fuso).
            dia: Number(data.data.slice(8, 10)),
            dataInicio: data.data,
            dataFim: data.dataFim || undefined,
          }, chaveRecorrente)
          notify({ open: true, message: "Recorrente criada com sucesso", severity: "success" })
        } else {
          await createTransaction({
            descricao: data.descricao, valor, tipo: data.tipo,
            categoriaId: data.categoriaId || null,
            subcategoriaId: data.subcategoriaId || null,
            contaId: isCredito ? undefined : data.contaId || undefined,
            cartaoCreditoId: isCredito ? data.cartaoCreditoId || undefined : undefined,
            usadoComoCredito: isCredito,
            meioPagamento: data.meioPagamento,
            parcelas: isCredito && data.parcelas > 1 ? data.parcelas : undefined,
            efetivado: data.efetivado,
            // date e time separados (sem fuso): data "YYYY-MM-DD", hora "HH:MM:SS" ou null.
            data: data.data,
            hora: data.hora ? `${data.hora}:00` : null,
          })
          notify({ open: true, message: "Transação criada com sucesso", severity: "success" })
        }
      }
    } catch {
      notify({ open: true, message: "Erro ao salvar", severity: "error" })
      return
    }
    window.dispatchEvent(new Event("transactionCreated"))
    navigate(voltarPara, { replace: true })
  }

  // ── Salvar edição ─────────────────────────────────────────────────────────
  const salvar = async (data: TransactionFormData) => {
    if (!transacao) return
    try {
      await updateTransaction(transacao.id, {
        descricao: data.descricao,
        valor: parseValor(data.valor),
        tipo: data.tipo,
        categoriaId: data.categoriaId || null,
        subcategoriaId: data.subcategoriaId || null,
        contaId: transacao.contaId,
        cartaoCreditoId: transacao.cartaoCreditoId,
        meioPagamento: data.meioPagamento,
        data: data.data,
        hora: data.hora ? `${data.hora}:00` : null,
      })
    } catch {
      notify({ open: true, message: "Erro ao atualizar transação", severity: "error" })
      return
    }
    notify({ open: true, message: "Transação atualizada", severity: "success" })
    verTransacao()
  }

  const excluir = async () => {
    if (!transacao) return
    setExcluindo(false)
    try {
      await deleteTransaction(transacao.id)
    } catch {
      notify({ open: true, message: "Erro ao excluir transação", severity: "error" })
      return
    }
    notify({ open: true, message: "Transação excluída", severity: "success" })
    navigate(voltarPara, { replace: true })
  }

  const cabecalho = (titulo: string, acoes?: React.ReactNode, meta?: React.ReactNode) => (
    <div className={styles.cabecalho}>
      <button type="button" className={styles.voltar} onClick={voltar}>
        <ChevronLeft size={16} strokeWidth={2.5} /> Voltar
      </button>
      <div className={styles.tituloLinha}>
        <div className={styles.tituloBloco}>
          <h1 className={styles.titulo}>{titulo}</h1>
          {meta && <div className={styles.meta}>{meta}</div>}
        </div>
        {acoes && <div className={styles.acoes}>{acoes}</div>}
      </div>
    </div>
  )

  const formulario = (modo: "create" | "edit", t?: Transaction) => (
    <PontesCard padding={24} radius={16}>
      <TransactionForm
        mode={modo}
        acoesFixas
        categories={categories}
        subcategories={subcategories}
        contas={contas}
        cartoes={cartoes}
        initial={t ? {
          natureza: t.tipo === 2 ? "receita" : "despesa",
          tipo: t.tipo,
          meioPagamento: t.meioPagamento ?? 4,
          categoriaId: t.categoriaId ?? "",
          subcategoriaId: t.subcategoriaId ?? "",
          contaId: t.contaId ?? "",
          cartaoCreditoId: t.cartaoCreditoId ?? "",
          valor: formatValor(t.valor),
          data: t.data,
          hora: t.hora ? t.hora.slice(0, 5) : "",
          descricao: t.descricao,
        } : undefined}
        onSubmit={modo === "create" ? criar : salvar}
        onCancel={modo === "create" ? voltar : verTransacao}
      />
    </PontesCard>
  )

  if (criando)
    return <div className={styles.root}>{cabecalho("Nova transação")}{formulario("create")}</div>

  if (carregando) return <div className={styles.root}><div className={styles.muted}>Carregando…</div></div>
  if (naoEncontrada || !transacao)
    return (
      <div className={styles.root}>
        {cabecalho("Transação não encontrada")}
        <div className={styles.muted}>Ela pode ter sido excluída.</div>
      </div>
    )

  const editavel = !transacao.ehPagamentoFatura && !transacao.ehTransferencia
  if (editando && editavel)
    return <div className={styles.root}>{cabecalho("Editar transação")}{formulario("edit", transacao)}</div>

  // ── Ver ───────────────────────────────────────────────────────────────────
  const cat = categories.find((c) => c.id === transacao.categoriaId)
  const sub = subcategories.find((s) => s.id === transacao.subcategoriaId)
  const neutro = transacao.ehTransferencia || transacao.ehPagamentoFatura
  const tom = neutro ? "neutro" : transacao.tipo === 2 ? "entrada" : "saida"
  const linhas: [string, string][] = [
    ["Data", transacao.hora ? `${fmtData(transacao.data)} às ${transacao.hora.slice(0, 5)}` : fmtData(transacao.data)],
    [transacao.cartaoCreditoId ? "Cartão" : "Conta", transacao.cartaoCreditoNome ?? transacao.contaNome ?? "—"],
    ["Meio de pagamento", transacao.meioPagamentoDescricao ?? "—"],
    ["Categoria", cat ? (sub ? `${cat.descricao} › ${sub.nome}` : cat.descricao) : "—"],
  ]

  return (
    <div className={styles.root}>
      {cabecalho(
        transacao.descricao,
        <>
          {editavel && (
            <PontesButton size="sm" iconStart={<Pencil size={15} strokeWidth={2.5} />}
              onClick={() => navigate(`/transactions/${transacao.id}/editar`, { replace: true, state: estado })}>
              Editar
            </PontesButton>
          )}
          {transacao.ehPagamentoFatura ? (
            <PontesButton size="sm" variant="outline" iconStart={<Undo2 size={15} strokeWidth={2.5} />} onClick={() => setEstornando(true)}>
              Estornar pagamento
            </PontesButton>
          ) : (
            <PontesButton size="sm" variant="danger-outline" iconStart={<Trash2 size={15} strokeWidth={2.5} />} onClick={() => setExcluindo(true)}>
              Excluir
            </PontesButton>
          )}
        </>,
        <>
          <PontesBadge tone={neutro ? "neutral" : transacao.tipo === 2 ? "success" : "danger"} size="sm">{natureza(transacao)}</PontesBadge>
          {transacao.statusTransacao === 0
            ? <PontesBadge tone="warning" size="sm">Previsto</PontesBadge>
            : <PontesBadge tone="success" size="sm">Efetivado</PontesBadge>}
          {transacao.recorrenteOrigemId && <PontesBadge tone="neutral" size="sm">Conta fixa</PontesBadge>}
          {transacao.parcelamentoId && <PontesBadge tone="neutral" size="sm">Parcelado</PontesBadge>}
        </>,
      )}

      <PontesCard padding={24} radius={16}>
        <div className={styles.valor} data-tom={tom}>{formatMoney(transacao.valor)}</div>
        <dl className={styles.dados}>
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo} className={styles.dado}>
              <dt>{rotulo}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
      </PontesCard>

      {podeCompartilhar(transacao) && (
        <PontesCard padding={20} radius={16}>
          <div className={styles.secaoTitulo}>Família</div>
          <div className={styles.secaoAcoes}>
            <PontesButton size="sm" variant="outline" iconStart={<Users size={15} strokeWidth={2.5} />} onClick={() => { void familia.compartilhar(transacao) }}>
              Compartilhar com família
            </PontesButton>
            <PontesButton size="sm" variant="outline" iconStart={<User size={15} strokeWidth={2.5} />} onClick={() => { void familia.atribuir(transacao) }}>
              Atribuir a dependente
            </PontesButton>
            <PontesButton size="sm" variant="outline" iconStart={<Split size={15} strokeWidth={2.5} />} onClick={() => { void familia.definirRateio(transacao) }}>
              Definir rateio
            </PontesButton>
          </div>
        </PontesCard>
      )}
      {familia.modais}

      <PontesDialog
        open={excluindo}
        title="Excluir transação?"
        description={transacao.ehTransferencia
          ? `${transacao.descricao} · ${formatMoney(transacao.valor)} — as duas pernas da transferência saem juntas.`
          : `${transacao.descricao} · ${formatMoney(transacao.valor)}`}
        tone="danger"
        confirmLabel="Excluir"
        onConfirm={() => { void excluir() }}
        onCancel={() => setExcluindo(false)}
      />
      <EstornarPagamentoDialog
        pagamento={estornando ? { id: transacao.id, valor: transacao.valor } : null}
        onClose={() => setEstornando(false)}
        onEstornado={() => navigate(voltarPara, { replace: true })}
        notify={notify}
      />
    </div>
  )
}
