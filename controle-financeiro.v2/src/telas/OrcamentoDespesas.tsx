// Despesas do Orçamento (/orcamento, seção que era a tela Limites): quanto a pessoa PLANEJA gastar por mês em cada
// categoria e quanto já foi. O planejado VALE TODO MÊS até ela mudar (decisão do Gustavo 2026-10-19, como o Monarch);
// pôr, mudar e tirar valem do mês em diante e o mês passado fica como estava (só mostra). Planilha aberta (sem
// ficha que abre, pedido do Gustavo 2026-10-21): categoria · planejado · gasto · sobra · barra, e o planejado se
// muda clicando no próprio valor. Quem precisa de atenção vem primeiro (passou, vai passar, perto) com a frase do
// servidor embaixo do nome. Só o planejado aparece (decisão do Gustavo 2026-10-22); as outras categorias ficam na
// lista da linha nova. "Planejar categoria" é a última linha da tabela e abre a linha nova logo acima; o que a pessoa planeja agora fica no fim até
// ela sair e voltar (aí entra na ordem do servidor). O Orçamento não cria categoria.
// O gasto inclui a parcela do mês das compras parceladas (regra única no servidor). O que ainda vem (conta fixa
// prevista) entra na frase e na situação, listrado na barra; nunca no número da sobra. Mudou o planejado, `aoMudar`
// refaz o "a ser alocado" da página.
import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { definirLimite, getLimitesDoMes, tirarLimite } from "../services/limiteService"
import { mensagemDeErro } from "../api/cliente"
import type { LimiteDoMes, LimitesDoMes } from "../types/Limite"
import BarraProgresso from "../componentes/BarraProgresso"
import Botao from "../componentes/Botao"
import Confirmar from "../componentes/Confirmar"
import { Dinheiro } from "../componentes/Dinheiro"
import Etiqueta from "../componentes/Etiqueta"
import { InicialFicha } from "../componentes/ListaFicha"
import { CelulaPlanilha, LinhaBotaoPlanilha, LinhaNovaPlanilha, LinhaPlanilha } from "../componentes/Planilha"
import SecaoPlanilha from "../componentes/SecaoPlanilha"
import { nomeDoPeriodo, type Periodo } from "../componentes/NavegadorMes"
import ValorNaLinha from "../componentes/ValorNaLinha"

const chaveDe = (categoriaId: string | null) => categoriaId ?? "todos"

export default function OrcamentoDespesas({ periodo, aoMudar }: { periodo: Periodo; aoMudar?: () => void }) {
  const [dados, setDados] = useState<LimitesDoMes | null>(null)
  const [erro, setErro] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const [tirando, setTirando] = useState<LimiteDoMes | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [adicionando, setAdicionando] = useState(false)
  const [adicionadas, setAdicionadas] = useState<string[]>([]) // planejadas nesta visita: ficam no fim até recarregar

  useEffect(() => {
    let vivo = true
    setDados(null); setErro(false); setEditando(null); setErroAcao(null); setAdicionando(false); setAdicionadas([])
    getLimitesDoMes(periodo.ano, periodo.mes).then((d) => { if (vivo) setDados(d) }).catch(() => { if (vivo) setErro(true) })
    return () => { vivo = false }
  }, [periodo])

  const sobra = dados ? dados.totalLimite - dados.totalGasto : undefined
  const noFim = (dados?.limites ?? []).filter((l) => adicionadas.includes(chaveDe(l.categoriaId)))
    .sort((a, b) => adicionadas.indexOf(chaveDe(a.categoriaId)) - adicionadas.indexOf(chaveDe(b.categoriaId)))
  const noTopo = (dados?.limites ?? []).filter((l) => !adicionadas.includes(chaveDe(l.categoriaId)))
  const vazio = !!dados && dados.limites.length === 0
  const mesNome = nomeDoPeriodo(periodo).toLowerCase()

  const rodar = async (acao: () => Promise<LimitesDoMes>) => {
    setOcupado(true); setErroAcao(null)
    try {
      const antes = new Set(dados?.limites.map((l) => chaveDe(l.categoriaId)) ?? [])
      const novo = await acao()
      setAdicionadas((a) => [...a, ...novo.limites.map((l) => chaveDe(l.categoriaId)).filter((k) => !antes.has(k) && !a.includes(k))])
      setDados(novo); setEditando(null); setAdicionando(false); aoMudar?.()
    } catch (e) { setErroAcao(mensagemDeErro(e)) }
    setOcupado(false)
  }
  const salvar = (categoriaId: string | null, valor: number) => rodar(() => definirLimite(categoriaId, periodo.ano, periodo.mes, valor))
  const tirar = async () => {
    if (!tirando) return
    await rodar(() => tirarLimite(tirando.categoriaId, periodo.ano, periodo.mes))
    setTirando(null)
  }

  return (
    <>
      <SecaoPlanilha titulo="Despesas" rotuloNome="Categoria" colunas={["Planejado", "Gasto", "Sobra"]} carregando={!dados && !erro}
        erro={erro ? "Não deu pra carregar as despesas." : erroAcao}
        vazio={vazio && !adicionando ? `Nenhuma despesa planejada em ${mesNome}.` : undefined}
        numeros={[
          { rotulo: "Planejado", valor: dados?.totalLimite },
          { rotulo: "Gasto", valor: dados?.totalGasto },
          { rotulo: sobra !== undefined && sobra < 0 ? "Passou" : "Sobra", valor: sobra === undefined ? undefined : Math.abs(sobra),
            tom: sobra !== undefined && sobra < 0 ? "negativo" : undefined },
        ]}
        rodape={dados?.editavel ? (
          <LinhaBotaoPlanilha>
            <Botao disabled={adicionando} onClick={() => setAdicionando(true)}
              icone={<Plus size={15} strokeWidth={2.5} aria-hidden="true" />}>Planejar categoria</Botao>
          </LinhaBotaoPlanilha>
        ) : undefined}>
        {noTopo.map(linhaPlanejada)}
        {noFim.map(linhaPlanejada)}
        {adicionando && dados && (
          <LinhaNovaPlanilha rotuloValor="Planejado" ocupado={ocupado}
            opcoes={dados.semLimite.filter((s) => s.categoriaId).map((s) => ({ valor: s.categoriaId!, rotulo: s.categoria }))}
            aoSalvar={(id, v) => void salvar(id, v)} aoCancelar={() => setAdicionando(false)} />
        )}
      </SecaoPlanilha>

      <Confirmar aberto={!!tirando} perigo ocupado={ocupado} titulo={`Tirar ${tirando?.categoria ?? ""} do planejado?`}
        texto={`Sai de ${mesNome} em diante. Os meses passados continuam com o planejado.`}
        rotuloConfirmar="Tirar do planejado" onConfirmar={() => void tirar()} onCancelar={() => setTirando(null)} />
    </>
  )

  function linhaPlanejada(l: LimiteDoMes) {
    const etiqueta = ETIQUETA[l.situacao]
    return (
      <LinhaPlanilha key={chaveDe(l.categoriaId)}
        marca={<InicialFicha texto={l.categoria} />}
        nome={<><span>{l.categoria}</span>{etiqueta && <Etiqueta tom={etiqueta.tom}>{etiqueta.rotulo}</Etiqueta>}</>}
        detalhe={l.resposta ?? (l.previsto > 0 ? <><Dinheiro valor={l.previsto} /> ainda vem</> : undefined)}
        barra={<BarraProgresso fracao={l.limite > 0 ? l.gasto / l.limite : 0} fracaoAVir={l.limite > 0 ? l.previsto / l.limite : 0}
          tom={l.situacao === "perto" || l.situacao === "vai-passar" ? "alerta" : undefined}
          rotulo={`${Math.round(l.percentual)}% do planejado gasto`} />}
        acao={dados?.editavel ? (
          <Botao variante="texto" soIcone aria-label={`Tirar ${l.categoria} do planejado`} title="Tirar do planejado"
            disabled={ocupado} onClick={() => setTirando(l)} icone={<Trash2 size={15} strokeWidth={2.25} aria-hidden="true" />} />
        ) : undefined}>
        <CelulaPlanilha rotulo="Planejado">
          <ValorNaLinha valor={l.limite} rotulo={`Mudar o planejado de ${l.categoria}`} editavel={!!dados?.editavel} ocupado={ocupado}
            editando={editando === chaveDe(l.categoriaId)} aoEditar={() => setEditando(chaveDe(l.categoriaId))}
            aoCancelar={() => setEditando(null)} aoSalvar={(v) => void salvar(l.categoriaId, v)} />
        </CelulaPlanilha>
        <CelulaPlanilha rotulo="Gasto"><Dinheiro valor={l.gasto} /></CelulaPlanilha>
        <CelulaPlanilha rotulo="Sobra" tom={l.sobra < 0 ? "negativo" : undefined}><Dinheiro valor={l.sobra} /></CelulaPlanilha>
      </LinhaPlanilha>
    )
  }
}

const ETIQUETA: Record<LimiteDoMes["situacao"], { rotulo: string; tom: "negativo" | "alerta" } | null> = {
  passou: { rotulo: "Passou", tom: "negativo" },
  "vai-passar": { rotulo: "Vai passar", tom: "alerta" },
  perto: { rotulo: "Perto do planejado", tom: "alerta" },
  ok: null,
}
