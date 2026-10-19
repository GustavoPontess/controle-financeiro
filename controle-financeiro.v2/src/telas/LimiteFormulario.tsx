// Novo limite (/limites/novo?ano&mes[&categoria]) e editar (/limites/editar?ano&mes&categoria): a categoria
// (só as de gasto; no novo, só as que ainda não têm limite no mês) e quanto por mês. Vale do mês escolhido em
// diante (vale todo mês até mudar). Ao escolher a categoria, mostra quanto ela gastou em média nos 3 meses antes,
// com "Usar a média". Volta pra lista no mesmo mês, com a linha aberta.
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { getCategories } from "../services/categoryService"
import { definirLimite, getLimitesDoMes, getSugestaoLimite } from "../services/limiteService"
import { mensagemDeErro } from "../api/cliente"
import type { Category } from "../types/Category"
import type { LimitesDoMes } from "../types/Limite"
import Botao from "../componentes/Botao"
import Campo, { ValorFixo } from "../componentes/Campo"
import { Dinheiro } from "../componentes/Dinheiro"
import EntradaValor from "../componentes/EntradaValor"
import Formulario, { Campos, LinhaCampos, PaginaFormulario, RodapeFormulario } from "../componentes/Formulario"
import { nomeDoPeriodo, periodoDeHoje } from "../componentes/NavegadorMes"
import Selecao from "../componentes/Selecao"
import { moneyParaCampo, parseMoney } from "../utils/money"
import styles from "./LimiteFormulario.module.css"

type Erros = Partial<Record<"categoria" | "valor", string>>
const FINALIDADE_RECEITA = 2

export default function LimiteFormulario({ modo }: { modo: "novo" | "editar" }) {
  const [busca] = useSearchParams()
  const navigate = useNavigate()
  const hoje = periodoDeHoje()
  const ano = Number(busca.get("ano")) || hoje.ano
  const mes = Number(busca.get("mes")) || hoje.mes
  const editar = modo === "editar"
  const [categorias, setCategorias] = useState<Category[]>([])
  const [mesAtual, setMesAtual] = useState<LimitesDoMes | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [categoriaId, setCategoriaId] = useState(busca.get("categoria") ?? "")
  const [valor, setValor] = useState("")
  const [media, setMedia] = useState<number | null>(null)
  const [erros, setErros] = useState<Erros>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const limpa = (k: keyof Erros) => setErros((e) => ({ ...e, [k]: undefined }))

  useEffect(() => {
    let vivo = true
    Promise.all([getCategories(), getLimitesDoMes(ano, mes)])
      .then(([cs, d]) => {
        if (!vivo) return
        setCategorias(cs.filter((c) => c.finalidade !== FINALIDADE_RECEITA))
        setMesAtual(d)
        if (editar) {
          const atual = d.limites.find((l) => l.categoriaId === (busca.get("categoria") ?? null))
          if (!atual) { setErroCarga("Essa categoria não tem limite neste mês."); setCarregando(false); return }
          setValor(moneyParaCampo(atual.limite))
        }
        setCarregando(false)
      })
      .catch(() => { if (vivo) { setErroCarga("Não deu pra carregar."); setCarregando(false) } })
    return () => { vivo = false }
  }, [ano, mes, editar, busca])

  // Sugestão: a média dos 3 meses antes, pra categoria escolhida.
  useEffect(() => {
    let vivo = true
    setMedia(null)
    if (categoriaId) getSugestaoLimite(categoriaId, ano, mes).then((m) => { if (vivo) setMedia(m) }).catch(() => { /* sem sugestão */ })
    return () => { vivo = false }
  }, [categoriaId, ano, mes])

  // No novo, só as categorias sem limite no mês (a que já tem se muda por Editar).
  const opcoes = useMemo(() => {
    const comLimite = new Set((mesAtual?.limites ?? []).map((l) => l.categoriaId))
    return categorias.filter((c) => editar || !comLimite.has(c.id) || c.id === categoriaId)
      .map((c) => ({ valor: c.id, rotulo: c.descricao }))
  }, [categorias, mesAtual, editar, categoriaId])
  const nomeCategoria = categorias.find((c) => c.id === categoriaId)?.descricao
    ?? mesAtual?.limites.find((l) => l.categoriaId === (categoriaId || null))?.categoria ?? ""
  const voltar = (abrir?: string | null) => navigate("/limites", { replace: true, state: { ano, mes, abrir: abrir === undefined ? undefined : `lim-${abrir || "todos"}` } })

  const enviar = async () => {
    setErro(null)
    const e: Erros = {}
    if (!editar && !categoriaId) e.categoria = "Escolha a categoria."
    const v = parseMoney(valor)
    if (!(v > 0)) e.valor = "Diga o limite."
    setErros(e)
    if (Object.keys(e).length > 0) return
    setSalvando(true)
    try {
      await definirLimite(categoriaId || null, ano, mes, v)
      voltar(categoriaId)
    } catch (err) { setErro(mensagemDeErro(err)); setSalvando(false) }
  }

  return (
    <PaginaFormulario titulo={editar ? `Editar limite de ${nomeCategoria || "…"}` : "Novo limite"} carregando={carregando} erroCarga={erroCarga}>
      <Formulario onSubmit={() => { void enviar() }}>
        <Campos>
          {erro && <p className={styles.alerta} role="alert">{erro}</p>}
          <LinhaCampos colunas="minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)">
            {editar ? (
              <Campo rotulo="Categoria" estatico><ValorFixo>{nomeCategoria}</ValorFixo></Campo>
            ) : (
              <Campo rotulo="Categoria" erro={erros.categoria}>
                <Selecao valor={categoriaId} placeholder={opcoes.length === 0 ? "Todas já têm limite" : "Escolha a categoria"}
                  desabilitado={opcoes.length === 0} invalido={!!erros.categoria} opcoes={opcoes}
                  onChange={(x) => { setCategoriaId(x); limpa("categoria") }} />
              </Campo>
            )}
            <Campo rotulo="Limite por mês" erro={erros.valor}>
              <EntradaValor compacto valor={valor} autoFocus={editar} onChange={(x) => { setValor(x); limpa("valor") }} />
            </Campo>
            <Campo rotulo="Vale a partir de" estatico><ValorFixo>{nomeDoPeriodo({ ano, mes }).toLowerCase()}</ValorFixo></Campo>
          </LinhaCampos>
          {media !== null && (
            <span className={styles.dica}>Nos 3 meses antes gastou em média <Dinheiro valor={media} /> por mês.{" "}
              <button type="button" className={styles.linkBotao} onClick={() => { setValor(moneyParaCampo(media)); limpa("valor") }}>Usar a média</button>
            </span>
          )}
        </Campos>
        <RodapeFormulario>
          <Botao onClick={() => voltar(editar ? categoriaId : undefined)} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>{salvando ? "Salvando…" : editar ? "Salvar" : "Pôr limite"}</Botao>
        </RodapeFormulario>
      </Formulario>
    </PaginaFormulario>
  )
}
