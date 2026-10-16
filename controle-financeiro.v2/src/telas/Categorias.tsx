// Categorias do v2: a lista é a tela (modelo de Bancos). Despesas | Receitas em cima ("as duas" aparece nas duas
// abas); as criadas pela pessoa primeiro, depois as padrão. Clicar abre a ficha na linha: as subcategorias (as
// dela com Editar/Excluir) e "Nova subcategoria"; categoria dela tem Editar e Excluir no pé. Padrão não muda nem
// sai, mas ganha subcategoria. Excluir em uso pergunta pra onde mover (página própria). Outra tela pode mandar
// `state.abrir` (id) e `state.tipo` pra chegar com aquela categoria aberta.
import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Lock, Pencil, Plus, Trash2 } from "lucide-react"
import { getCategories } from "../services/categoryService"
import { getSubcategories } from "../services/subcategoryService"
import type { Category } from "../types/Category"
import type { Subcategory } from "../types/Subcategory"
import Bloco, { Esqueleto } from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import { AcoesFicha, GrupoFicha, InicialFicha, ItemFicha, ListaFicha, VazioFicha } from "../componentes/ListaFicha"
import Segmentos from "../componentes/Segmentos"
import { FINALIDADE, serveParaTipo } from "../dominio/categoria"
import styles from "./Categorias.module.css"

type Aba = "despesa" | "receita"
const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "despesa", rotulo: "Despesas" },
  { valor: "receita", rotulo: "Receitas" },
]
const porNome = <T,>(nome: (x: T) => string) => (a: T, b: T) => nome(a).localeCompare(nome(b), "pt-BR")

export default function Categorias() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const chegou = state as { abrir?: string; tipo?: number } | null
  const [categorias, setCategorias] = useState<Category[] | null>(null)
  const [subcategorias, setSubcategorias] = useState<Subcategory[]>([])
  const [erro, setErro] = useState(false)
  const [aba, setAba] = useState<Aba>(chegou?.tipo === FINALIDADE.receita ? "receita" : "despesa")
  const [abertaId, setAbertaId] = useState<string | null>(chegou?.abrir ?? null)

  useEffect(() => {
    let vivo = true
    Promise.all([getCategories(), getSubcategories()])
      .then(([cats, subs]) => { if (!vivo) return; setCategorias(cats); setSubcategorias(subs) })
      .catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [])

  const finalidade = aba === "receita" ? FINALIDADE.receita : FINALIDADE.despesa
  const grupos = useMemo(() => {
    const daAba = (categorias ?? []).filter((c) => serveParaTipo(c, finalidade)).sort(porNome((c) => c.descricao))
    // "Suas" aparece mesmo vazio: é o que marca a divisão com as padrão (que não se editam nem saem).
    return [
      { chave: "suas", rotulo: "Suas categorias", itens: daAba.filter((c) => !c.isPadrao) },
      { chave: "padrao", rotulo: "Padrão", itens: daAba.filter((c) => c.isPadrao) },
    ].filter((g) => g.chave === "suas" || g.itens.length > 0)
  }, [categorias, finalidade])
  const subsDe = (id: string) => subcategorias.filter((s) => s.categoriaId === id).sort(porNome((s) => s.nome))

  return (
    <div className={styles.pagina}>
      <Bloco semRespiro>
        <div className={styles.toolbar}>
          <Segmentos ariaLabel="Tipo" valor={aba} onChange={(a) => { setAba(a); setAbertaId(null) }} opcoes={ABAS} />
          <Botao compactoNoCelular onClick={() => navigate("/categorias/nova", { state: { voltarPara: "/categorias", tipo: finalidade } })}
            icone={<Plus size={15} strokeWidth={2.5} aria-hidden="true" />}>Nova categoria</Botao>
        </div>
        {categorias === null && !erro ? (
          <div className={styles.respiro}><Esqueleto linhas={4} altura={18} /></div>
        ) : erro ? (
          <p className={styles.vazio}>Não deu pra carregar as categorias.</p>
        ) : (
          <ListaFicha rotulo="Categorias">
            {grupos.map((g) => (
              <GrupoFicha key={g.chave} rotulo={g.rotulo}
                icone={g.chave === "padrao" ? <Lock size={13} strokeWidth={2.25} aria-hidden="true" /> : undefined}
                extra={g.chave === "padrao" ? <span className={styles.grupoNota}>Não dá pra editar nem excluir</span> : undefined}>
                {g.chave === "suas" && g.itens.length === 0 && <VazioFicha>Nenhuma ainda.</VazioFicha>}
                {g.itens.map((c) => (
                  <Linha key={c.id} c={c} subs={subsDe(c.id)} aberta={c.id === abertaId}
                    aoAbrir={() => setAbertaId((atual) => (atual === c.id ? null : c.id))} />
                ))}
              </GrupoFicha>
            ))}
          </ListaFicha>
        )}
      </Bloco>
    </div>
  )
}

/** Uma categoria: inicial · nome + subcategorias. Aberta: as subcategorias com as ações e, se for dela, Editar/Excluir. */
function Linha({ c, subs, aberta, aoAbrir }: { c: Category; subs: Subcategory[]; aberta: boolean; aoAbrir: () => void }) {
  const navigate = useNavigate()
  const ir = (rota: string) => navigate(rota, { state: { voltarPara: "/categorias" } })
  const detalhe = [
    c.finalidade === FINALIDADE.ambas ? "Despesa e receita" : null,
    subs.length > 0 ? subs.map((s) => s.nome).join(", ") : "Sem subcategorias",
  ].filter(Boolean).join(" · ")

  return (
    <ItemFicha id={`categoria-${c.id}`} aberto={aberta} aoAbrir={aoAbrir} marca={<InicialFicha texto={c.descricao} destaque={!c.isPadrao} />}
      titulo={c.descricao} detalhe={detalhe}
      direita={c.isPadrao ? <span className={styles.cadeado} title="Padrão: não dá pra editar nem excluir"><Lock size={15} strokeWidth={2} aria-hidden="true" /></span> : undefined}>
      <div className={styles.subs}>
        <div className={styles.subsTopo}>
          <span className={styles.subsTitulo}>Subcategorias</span>
          <Botao variante="texto" onClick={() => ir(`/categorias/${c.id}/subcategorias/nova`)}
            icone={<Plus size={15} strokeWidth={2.5} aria-hidden="true" />}>Nova subcategoria</Botao>
        </div>
        {subs.length > 0 && (
          <ul className={styles.subsLista} aria-label={`Subcategorias de ${c.descricao}`}>
            {subs.map((s) => (
              <li key={s.id} className={styles.sub}>
                <span className={styles.subNome}>{s.nome}</span>
                {!s.isPadrao && (
                  <span className={styles.subAcoes}>
                    <Botao variante="texto" soIcone aria-label={`Editar ${s.nome}`} onClick={() => ir(`/subcategorias/${s.id}/editar`)}
                      icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />} />
                    <Botao variante="texto" perigo soIcone aria-label={`Excluir ${s.nome}`} onClick={() => ir(`/subcategorias/${s.id}/excluir`)}
                      icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {!c.isPadrao && (
        <AcoesFicha>
          <Botao perigo onClick={() => ir(`/categorias/${c.id}/excluir`)} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />}>Excluir</Botao>
          <Botao variante="primario" onClick={() => ir(`/categorias/${c.id}/editar`)} icone={<Pencil size={15} strokeWidth={2.25} aria-hidden="true" />}>Editar</Botao>
        </AcoesFicha>
      )}
    </ItemFicha>
  )
}
