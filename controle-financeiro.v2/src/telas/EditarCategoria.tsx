// Categoria nova (/categorias/nova) e editar (/categorias/:id/editar) — o MESMO formulário: tipo (despesa,
// receita ou as duas) e nome (até 100). Padrão não se edita. O servidor recusa nome repetido (mesmo das padrão,
// sem diferenciar maiúscula) e tipo que não aceita o que já está nela: o erro do nome volta no campo.
// Ao salvar volta pra lista com a categoria aberta na aba dela.
import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { createCategory, getCategory, updateCategory } from "../services/categoryService"
import { mensagemDeErro } from "../api/cliente"
import type { Category } from "../types/Category"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import Formulario, { Campos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import Segmentos from "../componentes/Segmentos"
import { FINALIDADE, FINALIDADES, MAX_NOME_CATEGORIA, abaDaFinalidade } from "../dominio/categoria"
import styles from "./FormularioCategoria.module.css"


export default function EditarCategoria() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const estado = location.state as { voltarPara?: string; tipo?: number } | null
  const voltarPara = estado?.voltarPara ?? "/categorias"
  const [categoria, setCategoria] = useState<Category | null>(null)
  const [carregando, setCarregando] = useState(!!id)
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let vivo = true
    getCategory(id)
      .then((c) => { if (!vivo) return; if (c.isPadrao) setErroCarga("Categoria padrão não pode ser alterada."); else setCategoria(c) })
      .catch(() => { if (vivo) setErroCarga("Não foi possível carregar a categoria. Recarregue a página.") })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [id])

  return (
    <PaginaFormulario titulo={id ? "Editar categoria" : "Nova categoria"} carregando={carregando} erroCarga={erroCarga}>
      {(!id || categoria) && (
        <FormularioCategoria categoria={categoria ?? undefined} tipoInicial={estado?.tipo}
          aoSair={() => navigate(voltarPara, { replace: true })}
          aoSalvo={(c) => navigate("/categorias", { replace: true, state: { abrir: c.id, tipo: abaDaFinalidade(c.finalidade) } })} />
      )}
    </PaginaFormulario>
  )
}

type Erros = Partial<Record<"nome", string>>

function FormularioCategoria({ categoria, tipoInicial, aoSair, aoSalvo }: {
  categoria?: Category
  /** A aba de onde veio (despesa/receita) já marcada. */
  tipoInicial?: number
  aoSair: () => void
  aoSalvo: (c: Category) => void
}) {
  const [finalidade, setFinalidade] = useState(String(categoria?.finalidade ?? tipoInicial ?? FINALIDADE.despesa))
  const [nome, setNome] = useState(categoria?.descricao ?? "")
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const enviar = async () => {
    setErro(null)
    const e: Erros = {}
    if (!nome.trim()) e.nome = "Informe o nome"
    setErros(e)
    if (Object.keys(e).length > 0) return
    setSalvando(true)
    const dto = { descricao: nome.trim(), finalidade: Number(finalidade) }
    try {
      aoSalvo(categoria ? await updateCategory(categoria.id, dto) : await createCategory(dto))
    } catch (err) {
      const msg = mensagemDeErro(err)
      // Nome repetido é erro do campo, não da tela.
      if ((err as { response?: { status?: number } })?.response?.status === 409 && /nome/i.test(msg)) setErros({ nome: msg })
      else setErro(msg)
      setSalvando(false)
    }
  }

  return (
    <Formulario onSubmit={() => { void enviar() }} className={styles.form}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <Segmentos ariaLabel="Tipo da categoria" cheio valor={finalidade} onChange={setFinalidade}
          opcoes={FINALIDADES.map((f) => ({ valor: String(f.valor), rotulo: f.rotulo }))} />
        <Campo rotulo="Nome" erro={erros.nome}>
          <Entrada value={nome} maxLength={MAX_NOME_CATEGORIA} placeholder="Pets" autoFocus={!categoria}
            onChange={(ev) => { setNome(ev.target.value); setErros({}) }} />
        </Campo>
      </Campos>
      <RodapeFormulario>
        <Botao onClick={aoSair} disabled={salvando}>Cancelar</Botao>
        <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Salvando…" : categoria ? "Salvar" : "Criar categoria"}</Botao>
      </RodapeFormulario>
    </Formulario>
  )
}
