// Confirmar um pagamento (/emprestimos/pagamentos/:id/confirmar): a outra pessoa registrou que passou dinheiro pra
// você; confirmar é dizer em qual conta entrou (vira o lançamento de entrada de verdade) e com qual categoria. "Não
// recebi" mora na lista (Pra responder). Sem número na tela que pareça cobrança: só o que ela registrou.
import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { aprovarPagamentoEmprestimo, listSolicitacoesPagamentoPendentes } from "../services/emprestimoService"
import { getCategories } from "../services/categoryService"
import { getContas } from "../services/contaService"
import { mensagemDeErro } from "../api/cliente"
import type { Category } from "../types/Category"
import type { Conta } from "../types/Conta"
import type { EmprestimoPagamentoSolicitacao } from "../types/Emprestimo"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import { Dinheiro } from "../componentes/Dinheiro"
import Formulario, { Campos, LinhaCampos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import Selecao from "../componentes/Selecao"
import { categoriaDeEmprestimo } from "../dominio/emprestimo"
import { dataBR } from "../utils/dateTime"
import styles from "./EmprestimoFormulario.module.css"

type Erros = Partial<Record<"conta" | "categoria", string>>

export default function ConfirmarPagamentoEmprestimo() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const st = useLocation().state as { voltarPara?: string; pagamento?: EmprestimoPagamentoSolicitacao } | null
  const voltarPara = st?.voltarPara ?? "/emprestimos"
  const [p, setP] = useState<EmprestimoPagamentoSolicitacao | null>(st?.pagamento?.id === id ? st.pagamento : null)
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Category[]>([])
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [contaId, setContaId] = useState("")
  const [categoriaId, setCategoriaId] = useState("")
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const limpa = (k: keyof Erros) => setErros((x) => ({ ...x, [k]: undefined }))

  useEffect(() => {
    let vivo = true
    const carregar = p ? Promise.resolve(p) : listSolicitacoesPagamentoPendentes().then((ps) => ps.find((x) => x.id === id) ?? null)
    Promise.all([carregar, getContas(), getCategories()])
      .then(([pag, cs, cats]) => {
        if (!vivo) return
        if (!pag) { setErroCarga("Esse pagamento já foi respondido."); return }
        setP(pag); setContas(cs); setCategorias(cats)
        if (cs.length === 1) setContaId(cs[0].id)
      })
      .catch(() => { if (vivo) setErroCarga("Não deu pra carregar o pagamento.") })
    return () => { vivo = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const cats = useMemo(() => categorias.filter((c) => c.finalidade === 3 || c.finalidade === 2), [categorias])
  useEffect(() => { if (!cats.some((c) => c.id === categoriaId)) setCategoriaId(categoriaDeEmprestimo(cats)?.id ?? "") }, [cats, categoriaId])

  const enviar = async () => {
    if (!p) return
    setErro(null)
    const x: Erros = {}
    if (!contaId) x.conta = "Escolha em qual conta entrou."
    if (!categoriaId) x.categoria = "Escolha a categoria do lançamento."
    setErros(x)
    if (Object.keys(x).length > 0) return
    setEnviando(true)
    try {
      await aprovarPagamentoEmprestimo(p.id, { contaId, categoriaId })
      navigate(voltarPara, { replace: true, state: { abrir: p.emprestimoId } })
    } catch (err) {
      setErro(mensagemDeErro(err))
      setEnviando(false)
    }
  }

  return (
    <PaginaFormulario titulo="Confirmar o que entrou" carregando={!p && !erroCarga} erroCarga={erroCarga}>
      {p && (
        <Formulario onSubmit={() => { void enviar() }}>
          <Campos>
            {erro && <p className={styles.alerta} role="alert">{erro}</p>}
            <div className={styles.resumo}>
              <span>{p.solicitadoPorNome} registrou que passou <strong><Dinheiro valor={p.valor} /></strong> pra você em {dataBR(p.comprovanteData || p.criadoEm)}</span>
            </div>
            <LinhaCampos>
              <Campo rotulo="Em qual conta entrou" erro={erros.conta}>
                <Selecao valor={contaId} placeholder="Escolha a conta" onChange={(x) => { setContaId(x); limpa("conta") }}
                  opcoes={contas.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
              </Campo>
              <Campo rotulo="Categoria do lançamento" erro={erros.categoria}>
                <Selecao valor={categoriaId} placeholder="Escolha a categoria" onChange={(x) => { setCategoriaId(x); limpa("categoria") }}
                  opcoes={cats.map((c) => ({ valor: c.id, rotulo: c.descricao }))} />
              </Campo>
            </LinhaCampos>
          </Campos>
          <RodapeFormulario>
            <Botao onClick={() => navigate(voltarPara, { replace: true })} disabled={enviando}>Cancelar</Botao>
            <Botao variante="primario" type="submit" disabled={enviando}>{enviando ? "Confirmando…" : "Confirmar"}</Botao>
          </RodapeFormulario>
        </Formulario>
      )}
    </PaginaFormulario>
  )
}
