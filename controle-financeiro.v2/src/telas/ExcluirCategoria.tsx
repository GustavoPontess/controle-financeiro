// Excluir categoria (/categorias/:id/excluir) ou subcategoria (/subcategorias/:id/excluir). Decisão do Gustavo
// (2026-10-16, opção A): em uso, pergunta pra onde vai o que está nela e o servidor move tudo e exclui numa
// transação só. Categoria: lançamentos, contas fixas, parcelamentos, limites, metas e as subcategorias vão pra
// outra categoria (obrigatório escolher). Subcategoria: pra outra da mesma categoria ou ficam só com a categoria.
// Sem uso, exclui direto. Volta pra lista com o destino (ou a categoria) aberto.
import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { deleteCategory, getCategories, getCategory, getUsoCategoria } from "../services/categoryService"
import { deleteSubcategory, getSubcategories, getSubcategory, getUsoSubcategoria } from "../services/subcategoryService"
import { mensagemDeErro } from "../api/cliente"
import type { Category, UsoCategoria, UsoSubcategoria } from "../types/Category"
import type { Subcategory } from "../types/Subcategory"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo, { ValorFixo } from "../componentes/Campo"
import Formulario, { Campos, Lado, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import Selecao from "../componentes/Selecao"
import { FINALIDADE, descreverUso, destinosPossiveis, emUso, verboMover } from "../dominio/categoria"
import styles from "./ExcluirCategoria.module.css"

const abaDe = (c?: Category) => (c?.finalidade === FINALIDADE.receita ? FINALIDADE.receita : FINALIDADE.despesa)

type Carga =
  | { tipo: "categoria"; categoria: Category; uso: UsoCategoria; todas: Category[] }
  | { tipo: "sub"; categoria: Category; sub: Subcategory; uso: UsoSubcategoria; irmas: Subcategory[] }

export default function ExcluirCategoria({ sub: ehSub }: {
  /** Rota /subcategorias/:id/excluir. */
  sub?: boolean
} = {}) {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara ?? "/categorias"
  const [carga, setCarga] = useState<Carga | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    const p: Promise<Carga> = ehSub
      ? getSubcategory(id).then(async (s) => {
        const [categoria, uso, irmas] = await Promise.all([getCategory(s.categoriaId), getUsoSubcategoria(id), getSubcategories(s.categoriaId)])
        return { tipo: "sub" as const, categoria, sub: s, uso, irmas: irmas.filter((x) => x.id !== s.id) }
      })
      : Promise.all([getCategory(id), getUsoCategoria(id), getCategories()])
        .then(([categoria, uso, todas]) => ({ tipo: "categoria" as const, categoria, uso, todas }))
    p.then((c) => {
      if (!vivo) return
      const padrao = c.tipo === "sub" ? c.sub.isPadrao : c.categoria.isPadrao
      if (padrao) setErroCarga(c.tipo === "sub" ? "Subcategoria padrão não pode ser excluída." : "Categoria padrão não pode ser excluída.")
      else setCarga(c)
    }).catch(() => { if (vivo) setErroCarga("Não foi possível carregar. Recarregue a página.") })
    return () => { vivo = false }
  }, [id, ehSub])

  const voltarPraLista = (abrir: string, tipo: number) => navigate("/categorias", { replace: true, state: { abrir, tipo } })

  return (
    <PaginaFormulario titulo={ehSub ? "Excluir subcategoria" : "Excluir categoria"} carregando={!carga && !erroCarga} erroCarga={erroCarga}>
      {carga?.tipo === "categoria" && (
        <FormCategoria c={carga} aoSair={() => navigate(voltarPara, { replace: true })}
          aoExcluir={(destino) => voltarPraLista(destino?.id ?? "", abaDe(destino ?? carga.categoria))} />
      )}
      {carga?.tipo === "sub" && (
        <FormSub c={carga} aoSair={() => navigate(voltarPara, { replace: true })}
          aoExcluir={() => voltarPraLista(carga.categoria.id, abaDe(carga.categoria))} />
      )}
    </PaginaFormulario>
  )
}

function FormCategoria({ c, aoSair, aoExcluir }: {
  c: Extract<Carga, { tipo: "categoria" }>; aoSair: () => void; aoExcluir: (destino?: Category) => void
}) {
  const usada = emUso(c.uso)
  const destinos = useMemo(() => destinosPossiveis(c.categoria, c.todas)
    .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR")), [c])
  const [destinoId, setDestinoId] = useState("")
  const [erroDestino, setErroDestino] = useState<string | undefined>()
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const destino = destinos.find((d) => d.id === destinoId)

  const enviar = async () => {
    setErro(null)
    if (usada && !destinoId) { setErroDestino("Escolha pra qual categoria vai"); return }
    setOcupado(true)
    try {
      await deleteCategory(c.categoria.id, usada ? destinoId : undefined)
      aoExcluir(usada ? destino : undefined)
    } catch (e) {
      setErro(mensagemDeErro(e)); setOcupado(false)
    }
  }

  return (
    <Formulario layout="lateral" onSubmit={() => { void enviar() }}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <Campo rotulo="Categoria" estatico><ValorFixo>{c.categoria.descricao}</ValorFixo></Campo>
        {usada && (
          <Campo rotulo="O que está nela vai pra" erro={erroDestino}>
            <Selecao valor={destinoId} placeholder="Escolha a categoria" desabilitado={destinos.length === 0}
              onChange={(x) => { setDestinoId(x); setErroDestino(undefined) }}
              opcoes={destinos.map((d) => ({ valor: d.id, rotulo: d.descricao }))} />
          </Campo>
        )}
      </Campos>
      <Lado>
        <Bloco titulo="Como vai ficar">
          <p className={styles.efeito}>
            {usada
              ? <>{descreverUso(c.uso)} {verboMover(c.uso)} {destino ? <>pra <strong>{destino.descricao}</strong></> : "pra categoria que você escolher"}. Subcategoria com o mesmo nome se junta à que já existe lá.</>
              : <>Nada usa essa categoria. Ela sai das listas.</>}
          </p>
        </Bloco>
        <RodapeFormulario>
          <Botao onClick={aoSair} disabled={ocupado}>Cancelar</Botao>
          <Botao variante="primario" perigo type="submit" disabled={ocupado}>{ocupado ? "Excluindo…" : "Excluir categoria"}</Botao>
        </RodapeFormulario>
      </Lado>
    </Formulario>
  )
}

function FormSub({ c, aoSair, aoExcluir }: {
  c: Extract<Carga, { tipo: "sub" }>; aoSair: () => void; aoExcluir: () => void
}) {
  const usada = c.uso.lancamentos + c.uso.contasFixas + (c.uso.parcelamentos ?? 0) > 0
  const [destinoId, setDestinoId] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const destino = c.irmas.find((s) => s.id === destinoId)
  const quanto = descreverUso({ ...c.uso, parcelamentos: c.uso.parcelamentos ?? 0, limites: 0, metas: 0, subcategorias: 0 })

  const enviar = async () => {
    setErro(null); setOcupado(true)
    try {
      await deleteSubcategory(c.sub.id, destinoId || undefined)
      aoExcluir()
    } catch (e) {
      setErro(mensagemDeErro(e)); setOcupado(false)
    }
  }

  return (
    <Formulario layout="lateral" onSubmit={() => { void enviar() }}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}
        <Campo rotulo="Subcategoria" estatico><ValorFixo>{c.categoria.descricao} › {c.sub.nome}</ValorFixo></Campo>
        {usada && (
          <Campo rotulo="O que está nela vai pra">
            <Selecao valor={destinoId} onChange={setDestinoId}
              opcoes={[{ valor: "", rotulo: `Sem subcategoria (fica só ${c.categoria.descricao})` },
                ...c.irmas.map((s) => ({ valor: s.id, rotulo: s.nome }))]} />
          </Campo>
        )}
      </Campos>
      <Lado>
        <Bloco titulo="Como vai ficar">
          <p className={styles.efeito}>
            {usada
              ? <>{quanto} {destino ? <>{verboMover(c.uso)} pra <strong>{c.categoria.descricao} › {destino.nome}</strong></> : <>{verboMover(c.uso) === "vai" ? "fica" : "ficam"} só em <strong>{c.categoria.descricao}</strong></>}.</>
              : <>Nada usa essa subcategoria. Ela sai das listas.</>}
          </p>
        </Bloco>
        <RodapeFormulario>
          <Botao onClick={aoSair} disabled={ocupado}>Cancelar</Botao>
          <Botao variante="primario" perigo type="submit" disabled={ocupado}>{ocupado ? "Excluindo…" : "Excluir subcategoria"}</Botao>
        </RodapeFormulario>
      </Lado>
    </Formulario>
  )
}
