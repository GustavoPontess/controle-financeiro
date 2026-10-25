// Receitas e Investimentos do Orçamento (/orcamento): a MESMA peça (decisão do Gustavo 2026-10-22, seções irmãs
// iguais), cada uma passando o seu jeito (`JEITOS`). Uma linha por FONTE: a subcategoria (Salário, Tesouro Direto…) ou
// a categoria que não tem subcategoria. O planejado VALE TODO MÊS até mudar, muda clicando no próprio valor, sai pela
// lixeira. Só o planejado aparece (decisão do Gustavo 2026-10-22: nada de "sem planejado" na tabela); as outras fontes
// ficam na lista da linha nova. "Planejar categoria" é a última linha da tabela e abre a linha nova logo acima; o que
// a pessoa planeja agora fica no fim até ela sair e voltar (aí entra na ordem do servidor). O Orçamento não cria categoria. Receitas: o que caiu (renda).
// Investimentos: o que foi investido (aporte menos resgate; não é gasto nem renda). Metas ficam fora (moram em Metas).
// Mudou, `aoMudar` refaz o "a ser alocado" da página.
import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { definirFonte, getFontesDoMes, tirarFonte, type LadoFonte } from "../services/limiteService"
import { mensagemDeErro } from "../api/cliente"
import type { FonteDoMes, FontesDoMes } from "../types/Orcamento"
import BarraProgresso from "../componentes/BarraProgresso"
import Botao from "../componentes/Botao"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import { InicialFicha } from "../componentes/ListaFicha"
import { nomeDoPeriodo, type Periodo } from "../componentes/NavegadorMes"
import { CelulaPlanilha, LinhaBotaoPlanilha, LinhaNovaPlanilha, LinhaPlanilha } from "../componentes/Planilha"
import SecaoPlanilha from "../componentes/SecaoPlanilha"
import ValorNaLinha from "../componentes/ValorNaLinha"

type Jeito = {
  titulo: string
  /** Planejado · Realizado · Falta */
  colunas: [string, string, string]
  verboMudar: string
  aindaVem: string
  vazio: string
}
const JEITOS: Record<LadoFonte, Jeito> = {
  receitas: {
    titulo: "Receitas", colunas: ["Esperado", "Recebido", "Falta"],
    verboMudar: "Mudar o esperado de", aindaVem: "ainda vai cair", vazio: "Nenhuma receita esperada em",
  },
  investimentos: {
    titulo: "Investimentos", colunas: ["Planejado", "Investido", "Falta"],
    verboMudar: "Mudar o planejado de", aindaVem: "ainda vem", vazio: "Nenhum investimento planejado em",
  },
}

/** Chave da fonte: categoria + subcategoria (vazia = a categoria inteira). */
const chaveDe = (categoriaId: string, subcategoriaId: string | null) => `${categoriaId}|${subcategoriaId ?? ""}`
const daChave = (chave: string) => {
  const [categoriaId, sub] = chave.split("|")
  return { categoriaId, subcategoriaId: sub || null }
}

export default function OrcamentoFontes({ lado, periodo, aoMudar }: { lado: LadoFonte; periodo: Periodo; aoMudar?: () => void }) {
  const jeito = JEITOS[lado]
  const [dados, setDados] = useState<FontesDoMes | null>(null)
  const [erro, setErro] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [tirando, setTirando] = useState<FonteDoMes | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [adicionando, setAdicionando] = useState(false)
  const [adicionadas, setAdicionadas] = useState<string[]>([]) // planejadas nesta visita: ficam no fim até recarregar

  useEffect(() => {
    let vivo = true
    setDados(null); setErro(false); setEditando(null); setErroAcao(null); setAdicionando(false); setAdicionadas([])
    getFontesDoMes(lado, periodo.ano, periodo.mes).then((d) => { if (vivo) setDados(d) }).catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [lado, periodo])

  const mesNome = nomeDoPeriodo(periodo).toLowerCase()
  const vazio = !!dados && dados.fontes.length === 0
  const planejado = dados?.totalPlanejado
  const realizado = dados?.totalRealizado
  const falta = dados ? dados.fontes.reduce((t, f) => t + Math.max(0, f.planejado - f.realizado), 0) : undefined
  const aMais = planejado !== undefined && realizado !== undefined ? Math.max(0, realizado - planejado) : 0

  const rodar = async (acao: () => Promise<FontesDoMes>) => {
    setOcupado(true); setErroAcao(null)
    try {
      const antes = new Set(dados?.fontes.map((f) => chaveDe(f.categoriaId, f.subcategoriaId)) ?? [])
      const novo = await acao()
      setAdicionadas((a) => [...a, ...novo.fontes.map((f) => chaveDe(f.categoriaId, f.subcategoriaId)).filter((k) => !antes.has(k) && !a.includes(k))])
      setDados(novo); setEditando(null); setAdicionando(false); aoMudar?.()
    } catch (e) { setErroAcao(mensagemDeErro(e)) }
    setOcupado(false)
  }
  const salvar = (chave: string, valor: number) => {
    const { categoriaId, subcategoriaId } = daChave(chave)
    return rodar(() => definirFonte(lado, categoriaId, subcategoriaId, periodo.ano, periodo.mes, valor))
  }
  const tirar = async () => {
    if (!tirando) return
    await rodar(() => tirarFonte(lado, tirando.categoriaId, tirando.subcategoriaId, periodo.ano, periodo.mes))
    setTirando(null)
  }
  const [colPlanejado, colRealizado, colFalta] = jeito.colunas
  const noFim = (dados?.fontes ?? []).filter((f) => adicionadas.includes(chaveDe(f.categoriaId, f.subcategoriaId)))
    .sort((a, b) => adicionadas.indexOf(chaveDe(a.categoriaId, a.subcategoriaId)) - adicionadas.indexOf(chaveDe(b.categoriaId, b.subcategoriaId)))
  const noTopo = (dados?.fontes ?? []).filter((f) => !adicionadas.includes(chaveDe(f.categoriaId, f.subcategoriaId)))
  const tomRealizado = (v: number): "positivo" | "negativo" | "mudo" => (v > 0 ? "positivo" : v < 0 ? "negativo" : "mudo")

  return (
    <>
      <SecaoPlanilha titulo={jeito.titulo} rotuloNome="Categoria" colunas={jeito.colunas} carregando={!dados && !erro}
        erro={erro ? `Não deu pra carregar ${jeito.titulo.toLowerCase()}.` : erroAcao}
        vazio={vazio && !adicionando ? `${jeito.vazio} ${mesNome}.` : undefined}
        numeros={[
          { rotulo: colPlanejado, valor: planejado },
          { rotulo: colRealizado, valor: realizado, tom: "positivo" },
          { rotulo: falta === 0 && aMais > 0 ? "A mais" : colFalta, valor: falta === undefined ? undefined : falta > 0 ? falta : aMais },
        ]}
        rodape={dados?.editavel ? (
          <LinhaBotaoPlanilha>
            <Botao disabled={adicionando} onClick={() => setAdicionando(true)}
              icone={<Plus size={15} strokeWidth={2.5} aria-hidden="true" />}>Planejar categoria</Botao>
          </LinhaBotaoPlanilha>
        ) : undefined}>
        {noTopo.map((f) => linhaPlanejada(f))}
        {noFim.map((f) => linhaPlanejada(f))}
        {adicionando && dados && (
          <LinhaNovaPlanilha rotuloValor={colPlanejado} ocupado={ocupado}
            opcoes={dados.semPlanejado.filter((s) => s.planejavel && s.categoriaId)
              .map((s) => ({ valor: chaveDe(s.categoriaId!, s.subcategoriaId), rotulo: s.nome, detalhe: s.subcategoriaId ? s.categoria : undefined }))}
            aoSalvar={(chave, v) => void salvar(chave, v)} aoCancelar={() => setAdicionando(false)} />
        )}
      </SecaoPlanilha>

      <Confirmar aberto={!!tirando} perigo ocupado={ocupado} titulo={`Tirar ${tirando?.nome ?? ""} do planejado?`}
        texto={`Sai de ${mesNome} em diante. Os meses passados continuam com o planejado.`}
        rotuloConfirmar="Tirar do planejado" onConfirmar={() => void tirar()} onCancelar={() => setTirando(null)} />
    </>
  )

  function linhaPlanejada(f: FonteDoMes) {
    const faltaLinha = Math.max(0, f.planejado - f.realizado)
    const chave = chaveDe(f.categoriaId, f.subcategoriaId)
    const fracao = f.planejado > 0 ? Math.min(1, Math.max(0, f.realizado) / f.planejado) : 0
    return (
      <LinhaPlanilha key={chave} marca={<InicialFicha texto={f.nome} />} nome={<span>{f.nome}</span>}
        detalhe={f.aindaVem > 0 ? <><Dinheiro valor={f.aindaVem} /> {jeito.aindaVem}</> : undefined}
        barra={<BarraProgresso fracao={fracao} fracaoAVir={f.planejado > 0 ? Math.min(1, Math.max(0, f.aindaVem) / f.planejado) : 0}
          tom="positivo" rotulo={`${Math.round(fracao * 100)}% do ${colPlanejado.toLowerCase()}`} />}
        acao={dados?.editavel ? (
          <Botao variante="texto" soIcone aria-label={`Tirar ${f.nome} do planejado`} title="Tirar do planejado"
            disabled={ocupado} onClick={() => setTirando(f)} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />} />
        ) : undefined}>
        <CelulaPlanilha rotulo={colPlanejado}>
          <ValorNaLinha valor={f.planejado} rotulo={`${jeito.verboMudar} ${f.nome}`} editavel={!!dados?.editavel} ocupado={ocupado}
            editando={editando === chave} aoEditar={() => setEditando(chave)}
            aoCancelar={() => setEditando(null)} aoSalvar={(v) => void salvar(chave, v)} />
        </CelulaPlanilha>
        <CelulaPlanilha rotulo={colRealizado} tom={tomRealizado(f.realizado)}><Dinheiro valor={f.realizado} /></CelulaPlanilha>
        <CelulaPlanilha rotulo={colFalta} tom={faltaLinha === 0 ? "positivo" : undefined}><Dinheiro valor={faltaLinha} /></CelulaPlanilha>
      </LinhaPlanilha>
    )
  }
}
