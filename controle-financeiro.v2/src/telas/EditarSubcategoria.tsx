// Subcategoria nova (/categorias/:id/subcategorias/nova, id = a categoria) e editar (/subcategorias/:id/editar) —
// o MESMO formulário: só o nome (até 120); a categoria aparece fixa. Padrão não se edita. Cor e ícone que já
// existam (vindos do app antigo) seguem iguais. Nome repetido na mesma categoria volta no campo.
import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { getCategory } from "../services/categoryService"
import { createSubcategory, getSubcategory, updateSubcategory } from "../services/subcategoryService"
import { mensagemDeErro } from "../api/cliente"
import type { Category } from "../types/Category"
import type { Subcategory } from "../types/Subcategory"
import Botao from "../componentes/Botao"
import Campo, { ValorFixo } from "../componentes/Campo"
import Entrada from "../componentes/Entrada"
import Formulario, { Campos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import { MAX_NOME_SUBCATEGORIA, abaDaFinalidade } from "../dominio/categoria"
import styles from "./FormularioCategoria.module.css"

export default function EditarSubcategoria({ nova }: {
  /** Rota /categorias/:id/subcategorias/nova (o id é da categoria). */
  nova?: boolean
} = {}) {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? "/categorias"
  const [categoria, setCategoria] = useState<Category | null>(null)
  const [sub, setSub] = useState<Subcategory | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    const carga = nova
      ? getCategory(id).then((c) => ({ c, s: null as Subcategory | null }))
      : getSubcategory(id).then(async (s) => ({ c: await getCategory(s.categoriaId), s }))
    carga
      .then(({ c, s }) => {
        if (!vivo) return
        if (s?.isPadrao) { setErroCarga("Subcategoria padrão não pode ser alterada."); return }
        setCategoria(c); setSub(s)
      })
      .catch(() => { if (vivo) setErroCarga("Não foi possível carregar a subcategoria. Recarregue a página.") })
      .finally(() => { if (vivo) setCarregando(false) })
    return () => { vivo = false }
  }, [id, nova])

  const voltarPraCategoria = (c: Category) => navigate("/categorias", {
    replace: true, state: { abrir: c.id, tipo: abaDaFinalidade(c.finalidade) },
  })

  return (
    <PaginaFormulario titulo={nova ? "Nova subcategoria" : "Editar subcategoria"} carregando={carregando} erroCarga={erroCarga}>
      {categoria && (
        <FormularioSubcategoria categoria={categoria} sub={sub ?? undefined}
          aoSair={() => navigate(voltarPara, { replace: true })} aoSalvo={() => voltarPraCategoria(categoria)} />
      )}
    </PaginaFormulario>
  )
}

function FormularioSubcategoria({ categoria, sub, aoSair, aoSalvo }: {
  categoria: Category; sub?: Subcategory; aoSair: () => void; aoSalvo: () => void
}) {
  const [nome, setNome] = useState(sub?.nome ?? "")
  const [erroNome, setErroNome] = useState<string | undefined>()
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const enviar = async () => {
    setErro(null)
    if (!nome.trim()) { setErroNome("Informe o nome"); return }
    setSalvando(true)
    try {
      if (sub) await updateSubcategory(sub.id, { nome: nome.trim(), cor: sub.cor ?? null, icone: sub.icone ?? null })
      else await createSubcategory({ nome: nome.trim(), categoriaId: categoria.id })
      aoSalvo()
    } catch (err) {
      const msg = mensagemDeErro(err)
      if ((err as { response?: { status?: number } })?.response?.status === 409 && /nome/i.test(msg)) setErroNome(msg)
      else setErro(msg)
      setSalvando(false)
    }
  }

  return (
    <Formulario onSubmit={() => { void enviar() }} className={styles.form}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <Campo rotulo="Categoria" estatico><ValorFixo>{categoria.descricao}</ValorFixo></Campo>
        <Campo rotulo="Nome" erro={erroNome}>
          <Entrada value={nome} maxLength={MAX_NOME_SUBCATEGORIA} placeholder="Ração" autoFocus={!sub}
            onChange={(ev) => { setNome(ev.target.value); setErroNome(undefined) }} />
        </Campo>
      </Campos>
      <RodapeFormulario>
        <Botao onClick={aoSair} disabled={salvando}>Cancelar</Botao>
        <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Salvando…" : sub ? "Salvar" : "Criar subcategoria"}</Botao>
      </RodapeFormulario>
    </Formulario>
  )
}
