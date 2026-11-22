// Formulário da transação — UM só pra criar e editar (senão os dois divergem). Duas colunas: campos à
// esquerda; à direita a prévia de como vai aparecer, as opções e os botões. Regras do app atual:
// - crédito só em despesa: escolhe o cartão e, ao lado, em quantas vezes (à vista, 2x, 3x…);
// - parcelado não guarda hora (cada parcela cai numa fatura);
// - data futura só no cartão ou como previsão (desligar "Já paguei");
// - transferência: entre duas contas diferentes, nunca no futuro;
// - conta fixa tem formulário próprio (FormularioContaFixa), criada em Contas fixas; aqui não entra.
// Editar é o MESMO formulário (Gustavo: "posso ter colocado tudo e errado o tipo"): um PUT só, com tudo.
// O servidor muda conta/cartão/status no lugar e, quando vira transferência / parcelado, troca o
// registro numa transação só do banco (tudo ou nada). Idempotency-Key em criar e editar: reenviar não repete.
// Regra do formulário (Gustavo, 2026-10-31): o que é obrigatório pra criar é obrigatório pra editar, e vice-versa,
// aqui e no servidor. Hora é opcional nos dois (ao criar já vem a de agora): lançamento antigo, importado, de conta
// fixa ou parcela edita sem inventar hora. Transferência existente edita inteira (contas, valor, data, hora,
// descrição) pelo mesmo formulário e pela mesma conferência do servidor; não vira despesa/receita.
// Despesa nova: antes de salvar, o servidor diz se a compra tira o dinheiro das contas fixas dos próximos 30 dias
// (limite no cartão, saldo na conta) e a resposta aparece embaixo da prévia. Só avisa (decisão do Gustavo 2026-10-19).
// "Nota e local" (2026-11-07): onde foi ("Usar onde estou", o ponto do aparelho) e os anexos (print da nota, foto, PDF).
// Criar e editar exigem o mesmo: nos dois, o que a pessoa mexe ali só vai pro servidor ao salvar, depois do lançamento.
// Não aparece em transferência nem em compra parcelada (não é UM lançamento).
import { useEffect, useMemo, useState } from "react"
import { avisoDeCompra, createTransaction, updateTransaction, type EdicaoLancamentoResultado } from "../services/transactionService"
import { createTransferencia, editarTransferencia } from "../services/transferenciaService"
import { getFamilia, getFamilias } from "../services/familiaService"
import { mensagemDeErro } from "../api/cliente"
import type { AnexoTransacao, Ponto, Transaction } from "../types/Transaction"
import { definirLocalizacao, enviarAnexo, listarAnexos, removerAnexo, urlDoAnexo } from "../services/anexoService"
import Anexos from "../componentes/Anexos"
import Cupom, { LinhaCupom } from "../componentes/Cupom"
import Localizacao from "../componentes/Localizacao"
import type { Familia, FamiliaDetalhe } from "../types/Familia"
import type { Conta } from "../types/Conta"
import type { CartaoCredito } from "../types/CartaoCredito"
import type { Category } from "../types/Category"
import type { Subcategory } from "../types/Subcategory"
import Bloco from "../componentes/Bloco"
import Botao from "../componentes/Botao"
import Campo from "../componentes/Campo"
import Etiqueta from "../componentes/Etiqueta"
import { CampoDescricao, CampoMeio, CampoValor, CamposCategoria, CamposDataHora } from "./CamposLancamento"
import Formulario, { Campos, Lado, LinhaCampos, RodapeFormulario } from "../componentes/Formulario"
import Interruptor from "../componentes/Interruptor"
import ListaAindaVem from "../componentes/ListaAindaVem"
import PreviaLancamento from "../componentes/PreviaLancamento"
import Resposta from "../componentes/Resposta"
import Segmentos from "../componentes/Segmentos"
import Selecao from "../componentes/Selecao"
import { formatarData } from "../componentes/SeletorData"
import { MEIO, MEIOS_PAGAMENTO, MEIOS_RECEBIMENTO, PARCELAS, TIPO, horaValida } from "../dominio/transacao"
import { aceitaTipo } from "../dominio/categoria"
import { PAPEL_PERMISSAO, primeiroNome } from "../dominio/familia"
import { formatMoney, moneyParaCampo, parseMoney } from "../utils/money"
import { dataLocalISO, horaLocalHHMM, somaDias } from "../utils/dateTime"
import { useAtrasado } from "../utils/useAtrasado"
import type { AvisoDeCompra } from "../types/DinheiroDoMes"
import styles from "./FormularioTransacao.module.css"

type Natureza = "despesa" | "receita" | "transferencia"
const NATUREZAS: { valor: Natureza; rotulo: string }[] = [
  { valor: "despesa", rotulo: "Despesa" },
  { valor: "receita", rotulo: "Receita" },
  { valor: "transferencia", rotulo: "Transferência" },
]
const centavos = (n: number) => Math.round(n * 100) / 100

export default function FormularioTransacao({ transacao, transferenciaEditada, contas = [], cartoes = [], categorias, subcategorias, aoSair, aoSalvo }: {
  /** Com transação = editar; sem = nova. */
  transacao?: Transaction
  /** Editando uma transferência (a transação é uma perna dela): o id e as duas contas. */
  transferenciaEditada?: { id: string; contaOrigemId: string; contaDestinoId: string }
  contas?: Conta[]
  cartoes?: CartaoCredito[]
  categorias: Category[]
  subcategorias: Subcategory[]
  aoSair: () => void
  /** Na edição recebe o resultado: se virou outro registro, a tela do id antigo não existe mais. */
  aoSalvo: (resultado?: EdicaoLancamentoResultado) => void
}) {
  const t = transacao ?? null
  const editando = !!t
  const tf = transferenciaEditada ?? null

  const [natureza, setNatureza] = useState<Natureza>(tf ? "transferencia" : t?.tipo === TIPO.receita ? "receita" : "despesa")
  const [valor, setValor] = useState(t ? moneyParaCampo(t.valor) : "")
  const [descricao, setDescricao] = useState(t?.descricao ?? "")
  const [meio, setMeio] = useState<number>(t ? (t.cartaoCreditoId ? MEIO.credito : t.meioPagamento ?? MEIO.pix) : MEIO.pix)
  const [contaId, setContaId] = useState(t?.contaId ?? "")
  const [cartaoId, setCartaoId] = useState(t?.cartaoCreditoId ?? "")
  const [parcelas, setParcelas] = useState(1)
  const [efetivado, setEfetivado] = useState(t ? t.statusTransacao !== 0 : true)
  const [data, setData] = useState(() => t?.data ?? dataLocalISO())
  const [hora, setHora] = useState(() => (t ? (t.hora ? t.hora.slice(0, 5) : "") : horaLocalHHMM()))
  const [categoriaId, setCategoriaId] = useState(t?.categoriaId ?? "")
  const [subcategoriaId, setSubcategoriaId] = useState(t?.subcategoriaId ?? "")
  // Transferência existente: as contas dela. Virou transferência: a conta do lançamento é a origem (despesa) ou o
  // destino (receita).
  const [origemId, setOrigemId] = useState(tf ? tf.contaOrigemId : t && t.tipo !== TIPO.receita ? t.contaId ?? "" : "")
  const [destinoId, setDestinoId] = useState(tf ? tf.contaDestinoId : t && t.tipo === TIPO.receita ? t.contaId ?? "" : "")
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  // Idempotency-Key: uma por abertura da tela, reusada em toda tentativa (criar e editar).
  const [chaveEnvio] = useState(() => crypto.randomUUID())
  // Nota e local: o que está no servidor (edição) e o que a pessoa mudou, gravado só ao salvar.
  const idEditado = t && !tf ? t.id : null
  const pontoSalvo: Ponto | null = t?.latitude != null && t?.longitude != null ? { latitude: t.latitude, longitude: t.longitude } : null
  const [ponto, setPonto] = useState<Ponto | null>(pontoSalvo)
  const [anexosSalvos, setAnexosSalvos] = useState<AnexoTransacao[]>([])
  const [anexosNovos, setAnexosNovos] = useState<File[]>([])
  const [anexosTirados, setAnexosTirados] = useState<string[]>([])
  const [pontoGravado, setPontoGravado] = useState(false)
  useEffect(() => {
    if (!idEditado) return
    let vivo = true
    listarAnexos(idEditado).then((a) => { if (vivo) setAnexosSalvos(a) }).catch(() => { /* sem a lista, só não mostra os já anexados */ })
    return () => { vivo = false }
  }, [idEditado])
  // Despesa nova: dividir com a família já ao salvar (a parte de cada um é gravada pela regra da família).
  const [familias, setFamilias] = useState<Familia[]>([])
  const [familiaId, setFamiliaId] = useState("")
  const [familiaDetalhe, setFamiliaDetalhe] = useState<FamiliaDetalhe | null>(null)
  const [dividir, setDividir] = useState(false)

  const transferencia = natureza === "transferencia"
  const receita = natureza === "receita"
  const tipo = receita ? TIPO.receita : TIPO.despesa
  const credito = !transferencia && meio === MEIO.credito
  const parcelado = credito && parcelas > 1
  // Parcela de parcelamento e ocorrência de conta fixa não viram outra coisa.
  const podeConverter = !t || (!t.parcelamentoId && !t.recorrenteOrigemId)
  // Na edição, isto vira outro registro no servidor (o lançamento antigo é cancelado). Transferência editada continua a mesma.
  const viraOutroRegistro = !!t && !tf && (transferencia || parcelado)
  /** "Nota e local" é de UM lançamento: fora em transferência e em compra parcelada. */
  const comNotaELocal = !transferencia && !parcelado
  const comHora = !parcelado
  const hoje = dataLocalISO()
  const ontem = somaDias(hoje, -1)
  // Futuro só no cartão ou como previsão.
  const dataMax = transferencia || (!credito && efetivado) ? hoje : undefined

  const cats = useMemo(() => categorias.filter((c) => aceitaTipo(c, tipo)), [categorias, tipo])
  const subs = useMemo(() => subcategorias.filter((s) => s.categoriaId === categoriaId), [subcategorias, categoriaId])
  const cartoesCredito = useMemo(() => cartoes.filter((c) => c.temCredito && c.ativo !== false), [cartoes])
  const opcoesConta = contas.map((c) => ({ valor: c.id, rotulo: c.nome }))
  const nomeConta = (id: string) => contas.find((c) => c.id === id)?.nome ?? (t && id === t.contaId ? t.contaNome : undefined)
  const nomeCartao = (id: string) => cartoesCredito.find((c) => c.id === id)?.nome ?? (t && id === t.cartaoCreditoId ? t.cartaoCreditoNome : undefined)

  const limpa = (...campos: string[]) => setErros((e) => {
    if (!campos.some((c) => e[c])) return e
    const n = { ...e }
    for (const c of campos) delete n[c]
    return n
  })

  const trocarNatureza = (n: Natureza) => {
    setNatureza(n)
    setErros({})
    if (n === "transferencia") return
    // Receita não usa cartão; categoria que não serve pro tipo novo cai fora.
    if (n === "receita" && !MEIOS_RECEBIMENTO.some((m) => m.valor === meio)) { setMeio(MEIO.pix); setParcelas(1) }
    const novoTipo = n === "receita" ? TIPO.receita : TIPO.despesa
    const atual = categorias.find((c) => c.id === categoriaId)
    if (atual && !aceitaTipo(atual, novoTipo)) { setCategoriaId(""); setSubcategoriaId("") }
  }
  const trocarMeio = (m: number) => {
    setMeio(m)
    if (m !== MEIO.credito) setParcelas(1)
    limpa("conta", "cartao", "data")
  }
  const escolherData = (x: string) => { setData(x); limpa("data") }

  const validar = () => {
    const e: Record<string, string> = {}
    if (parseMoney(valor) <= 0) e.valor = "Informe um valor"
    if (!descricao.trim()) e.descricao = "Informe a descrição"
    if (transferencia) {
      if (!origemId) e.origem = "Escolha a conta de origem"
      if (!destinoId) e.destino = "Escolha a conta de destino"
      else if (destinoId === origemId) e.destino = "Origem e destino precisam ser contas diferentes"
    } else {
      if (credito && !cartaoId) e.cartao = "Escolha o cartão"
      if (!credito && !contaId) e.conta = "Escolha a conta"
      if (!categoriaId) e.categoria = "Escolha a categoria"
    }
    if (!data) e.data = "Informe a data"
    else if (dataMax && data > dataMax)
      e.data = transferencia ? "Transferência não pode ser no futuro" : `Data futura só como previsão: desligue "${receita ? "Já recebi" : "Já paguei"}"`
    // Hora é opcional em criar e editar; se preencheu, tem que ser válida.
    if (comHora && hora && !horaValida(hora)) e.hora = "Hora inválida (HH:MM)"
    setErros(e)
    return Object.keys(e).length === 0
  }

  const enviar = async () => {
    setErro(null)
    if (!validar()) return
    setSalvando(true)
    const v = parseMoney(valor)
    const desc = descricao.trim()
    const horaEnvio = comHora && hora ? `${hora}:00` : null
    let resultado: EdicaoLancamentoResultado | undefined
    let idDoLancamento: string | null = null
    try {
      if (tf) {
        // Mesmo corpo de criar; a transação (perna) continua existindo, então a tela fica nela.
        await editarTransferencia(tf.id, { contaOrigemId: origemId, contaDestinoId: destinoId, valor: v, data, hora: horaEnvio, descricao: desc })
      } else if (t) {
        resultado = await updateTransaction(t.id, {
          descricao: desc, valor: v, tipo,
          categoriaId: transferencia ? null : categoriaId || null,
          subcategoriaId: transferencia ? null : subcategoriaId || null,
          contaId: transferencia || credito ? null : contaId,
          cartaoCreditoId: transferencia || !credito ? null : cartaoId,
          meioPagamento: transferencia ? null : meio,
          parcelas: parcelado ? parcelas : null,
          // No cartão não existe "previsão": a compra vai pra fatura.
          efetivado: credito ? true : efetivado,
          data,
          hora: horaEnvio,
          transferencia: transferencia ? { contaOrigemId: origemId, contaDestinoId: destinoId } : null,
          contaFixa: null,
        }, chaveEnvio)
        idDoLancamento = resultado?.tipo === "transacao" ? resultado.id : null
      } else if (transferencia) {
        await createTransferencia({ contaOrigemId: origemId, contaDestinoId: destinoId, valor: v, data, hora: horaEnvio, descricao: desc }, chaveEnvio)
      } else {
        const criada = await createTransaction({
          descricao: desc, valor: v, tipo,
          categoriaId,
          subcategoriaId: subcategoriaId || null,
          contaId: credito ? undefined : contaId,
          cartaoCreditoId: credito ? cartaoId : undefined,
          usadoComoCredito: credito,
          meioPagamento: meio,
          parcelas: parcelado ? parcelas : undefined,
          // No cartão não existe "previsão": a compra vai pra fatura.
          efetivado: credito ? true : efetivado,
          data,
          hora: horaEnvio,
          familiaId: podeDividir && !daCasa && dividir && familiaId ? familiaId : undefined,
        }, chaveEnvio)
        idDoLancamento = parcelado ? null : (criada as Transaction | null)?.id ?? null
      }
    } catch (e) {
      setErro(mensagemDeErro(e))
      setSalvando(false)
      return
    }
    // Nota e local, depois do lançamento salvo. Se algo não sobe, a tela fica com o que faltou e o aviso; salvar de
    // novo repete só isso (o lançamento não duplica: mesma Idempotency-Key).
    if (idDoLancamento && comNotaELocal) {
      const falhas = await gravarNotaELocal(idDoLancamento)
      if (falhas > 0) {
        setErro(falhas === 1 ? "O lançamento foi salvo, mas 1 anexo não subiu. Tente salvar de novo." : `O lançamento foi salvo, mas ${falhas} anexos não subiram. Tente salvar de novo.`)
        setSalvando(false)
        return
      }
    }
    aoSalvo(resultado)
  }

  /** Grava o que mudou em "Nota e local". Devolve quantas coisas falharam (as que deram certo saem da fila). */
  const gravarNotaELocal = async (id: string) => {
    let falhas = 0
    const mudouPonto = (ponto?.latitude ?? null) !== (pontoSalvo?.latitude ?? null) || (ponto?.longitude ?? null) !== (pontoSalvo?.longitude ?? null)
    if (mudouPonto && !pontoGravado) {
      try { await definirLocalizacao(id, ponto); setPontoGravado(true) } catch { falhas++ }
    }
    for (const anexoId of anexosTirados) {
      try {
        await removerAnexo(id, anexoId)
        setAnexosTirados((v) => v.filter((x) => x !== anexoId))
        setAnexosSalvos((v) => v.filter((a) => a.id !== anexoId))
      } catch { falhas++ }
    }
    for (const arquivo of anexosNovos) {
      try {
        const salvo = await enviarAnexo(id, arquivo)
        setAnexosNovos((v) => v.filter((x) => x !== arquivo))
        setAnexosSalvos((v) => [...v, salvo])
      } catch { falhas++ }
    }
    return falhas
  }

  // ── Prévia: como vai aparecer na lista + o que acontece ao salvar ───────────────────────────────
  const v = parseMoney(valor)
  const tom = transferencia ? "neutro" : receita ? "positivo" : "negativo"
  const origemNome = credito ? nomeCartao(cartaoId) : nomeConta(contaId)
  const catNome = categorias.find((c) => c.id === categoriaId)?.descricao
  const meioRotulo = MEIOS_PAGAMENTO.find((m) => m.valor === meio)?.rotulo
  const detalhe = transferencia
    ? [nomeConta(origemId), nomeConta(destinoId)].filter(Boolean).join(" → ")
    : [origemNome, catNome, meioRotulo].filter(Boolean).join(" · ")
  const quando = (() => {
    const dia = data === hoje ? "hoje" : data === ontem ? "ontem" : `em ${formatarData(data)}`
    return comHora && horaValida(hora) ? `${dia} às ${hora}` : dia
  })()
  const efeito = (() => {
    if (transferencia) {
      const de = nomeConta(origemId), para = nomeConta(destinoId)
      return de && para ? `Sai de ${de} e entra em ${para} ${quando}.` : null
    }
    if (!origemNome) return null
    if (credito) return parcelado ? `${parcelas}x de ${formatMoney(centavos(v / parcelas))} nas próximas faturas do ${origemNome}.` : `${editando && !viraOutroRegistro && cartaoId === t?.cartaoCreditoId ? "Na" : "Vai pra"} fatura do ${origemNome}.`
    return efetivado ? `${receita ? "Entra no" : "Sai do"} ${origemNome} ${quando}.` : `Fica como previsão no ${origemNome} para ${formatarData(data)}.`
  })()
  const previsto = !credito && !transferencia && !efetivado

  // Aviso da compra (só despesa nova, com valor e de onde sai): espera parar de digitar e pergunta ao servidor.
  const origemAviso = editando || transferencia || receita || v <= 0 ? null
    : credito ? (cartaoId ? `cartao:${cartaoId}` : null) : (contaId ? `conta:${contaId}` : null)
  const pedidoAviso = useAtrasado(origemAviso ? `${origemAviso}|${v}` : "")
  const [aviso, setAviso] = useState<AvisoDeCompra | null>(null)
  useEffect(() => {
    if (!pedidoAviso) { setAviso(null); return }
    let vivo = true
    const [origem, valorPedido] = pedidoAviso.split("|")
    const [tipoOrigem, id] = origem.split(":")
    avisoDeCompra(Number(valorPedido), tipoOrigem === "cartao" ? { cartaoId: id } : { contaId: id })
      .then((r) => { if (vivo) setAviso(r ?? null) })
      .catch(() => { if (vivo) setAviso(null) }) // o aviso é ajuda: sem ele, o formulário segue igual
    return () => { vivo = false }
  }, [pedidoAviso])

  useEffect(() => {
    if (editando) return
    let vivo = true
    getFamilias().then((f) => { if (vivo) { setFamilias(f); setFamiliaId((x) => x || f[0]?.id || "") } }).catch(() => { /* sem família, sem o interruptor */ })
    return () => { vivo = false }
  }, [editando])
  useEffect(() => {
    if (!familiaId) return
    let vivo = true
    getFamilia(familiaId).then((d) => { if (vivo) setFamiliaDetalhe(d) }).catch(() => { /* a frase fica sem os nomes */ })
    return () => { vivo = false }
  }, [familiaId])
  // Conta/cartão da casa: a despesa já nasce dividida no servidor (o interruptor só mostra, ligado).
  const daCasa = (credito ? cartoesCredito.find((c) => c.id === cartaoId)?.familiaId : contas.find((c) => c.id === contaId)?.familiaId) ?? null
  // Parcelada ainda não divide (o servidor recusa).
  const podeDividir = !editando && !transferencia && !receita && !parcelado && familias.length > 0
  const familiaNome = familias.find((f) => f.id === familiaId)?.nome ?? "a família"
  const comoDivide = (() => {
    if (!familiaDetalhe) return null
    const nomes = familiaDetalhe.membros.filter((m) => m.papelPermissao !== PAPEL_PERMISSAO.dependente).map((m) => primeiroNome(m.nomeUsuario))
    const entre = nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0] ?? ""
    // "Do meu jeito" começa igual; a pessoa ajusta na página da despesa.
    const modo = familiaDetalhe.modoRateioPadrao === 2 ? "Pela renda" : "Igual"
    return `${modo} entre ${entre}`
  })()

  const rotuloSalvar = salvando ? "Salvando…" : editando ? "Salvar" : transferencia ? "Transferir" : "Adicionar"

  return (
    <Formulario layout="lateral" onSubmit={() => { void enviar() }}>
      <Campos>
        {erro && <p className={styles.alerta} role="alert">{erro}</p>}

        {/* Transferência existente não vira despesa/receita: sem a escolha do tipo. */}
        {!tf && <Segmentos ariaLabel="Tipo de lançamento" cheio valor={natureza} onChange={trocarNatureza} opcoes={NATUREZAS} />}

        {/* Os campos do lançamento são as peças de CamposLancamento (as mesmas da fila do Importar extrato). */}
        <CampoValor valor={valor} tom={tom} erro={erros.valor} autoFocus={!editando} onChange={(x) => { setValor(x); limpa("valor") }} />
        <CampoDescricao valor={descricao} erro={erros.descricao} placeholder={transferencia ? "Reserva de emergência" : "Mercado"}
          onChange={(x) => { setDescricao(x); limpa("descricao") }} />
        <CamposDataHora data={data} hora={hora} erroData={erros.data} erroHora={erros.hora} rotuloData={parcelado ? "Data da compra" : "Data"}
          dataMax={dataMax} comHora={comHora} aoData={escolherData} aoHora={(x) => { setHora(x); limpa("hora") }} />

        {transferencia ? (
          <LinhaCampos>
            <Campo rotulo="De" erro={erros.origem}>
              <Selecao valor={origemId} placeholder="Conta de origem" onChange={(x) => { setOrigemId(x); limpa("origem", "destino") }}
                opcoes={opcoesConta.filter((o) => o.valor !== destinoId)} />
            </Campo>
            <Campo rotulo="Para" erro={erros.destino}>
              <Selecao valor={destinoId} placeholder="Conta de destino" onChange={(x) => { setDestinoId(x); limpa("destino") }}
                opcoes={opcoesConta.filter((o) => o.valor !== origemId)} />
            </Campo>
          </LinhaCampos>
        ) : (
          <>
            <LinhaCampos>
              <CampoMeio rotulo={receita ? "Recebido por" : "Pago com"} valor={String(meio)} onChange={(x) => trocarMeio(Number(x))}
                opcoes={(receita ? MEIOS_RECEBIMENTO : MEIOS_PAGAMENTO).map((m) => ({ valor: String(m.valor), rotulo: m.rotulo }))} />
              {credito ? (
                <Campo rotulo="Cartão" erro={erros.cartao}>
                  <Selecao valor={cartaoId} desabilitado={cartoesCredito.length === 0}
                    placeholder={cartoesCredito.length === 0 ? "Nenhum cartão de crédito" : "Escolha o cartão"}
                    onChange={(x) => { setCartaoId(x); limpa("cartao") }}
                    opcoes={cartoesCredito.map((c) => ({ valor: c.id, rotulo: c.ultimosDigitos ? `${c.nome} •••• ${c.ultimosDigitos}` : c.nome }))} />
                </Campo>
              ) : (
                <Campo rotulo="Conta" erro={erros.conta}>
                  <Selecao valor={contaId} desabilitado={contas.length === 0}
                    placeholder={contas.length === 0 ? "Nenhuma conta" : "Escolha a conta"}
                    onChange={(x) => { setContaId(x); limpa("conta") }} opcoes={opcoesConta} />
                </Campo>
              )}
              {credito && podeConverter && (
                <Campo rotulo="Parcelas">
                  <Selecao valor={String(parcelas)} onChange={(x) => setParcelas(Number(x))}
                    opcoes={PARCELAS.map((n) => ({ valor: String(n), rotulo: n === 1 ? "À vista" : v > 0 ? `${n}x de ${formatMoney(centavos(v / n))}` : `${n}x` }))} />
                </Campo>
              )}
            </LinhaCampos>
            <CamposCategoria categoriaId={categoriaId} subcategoriaId={subcategoriaId} erro={erros.categoria}
              categorias={cats.map((c) => ({ valor: c.id, rotulo: c.descricao }))} subcategorias={subs.map((s) => ({ valor: s.id, rotulo: s.nome }))}
              aoCategoria={(x) => { setCategoriaId(x); setSubcategoriaId(""); limpa("categoria") }} aoSubcategoria={setSubcategoriaId} />
          </>
        )}
      </Campos>

      <Lado>
        <PreviaLancamento descricao={descricao} valor={v} tom={tom} detalhe={detalhe} efeito={efeito}
          etiquetas={previsto || parcelado ? (
            <>
              {previsto && <Etiqueta tom="alerta">Previsto</Etiqueta>}
              {parcelado && <Etiqueta>{parcelas}x</Etiqueta>}
            </>
          ) : undefined} />

        {aviso && origemAviso && (
          <Resposta tom={aviso.tom} texto={aviso.texto} detalhe={aviso.detalhe}>
            {aviso.itens.length > 0 && (
              <ListaAindaVem itens={aviso.itens} semCategoria semLink comMes rotulo="Contas que ficam sem dinheiro" />
            )}
          </Resposta>
        )}

        {((!transferencia && !credito) || podeDividir) && (
          <Bloco titulo="Opções" className={styles.opcoes}>
            {!transferencia && !credito && (
              <Interruptor ligado={efetivado} onChange={(on) => { setEfetivado(on); limpa("data") }}>{receita ? "Já recebi" : "Já paguei"}</Interruptor>
            )}
            {podeDividir && (
              <div className={styles.dividir}>
                {daCasa ? (
                  <Interruptor ligado desabilitado onChange={() => { /* conta da casa: sempre divide */ }}>
                    Dividir com {familias.find((f) => f.id === daCasa)?.nome ?? "a família"} ({credito ? "cartão" : "conta"} da casa)
                  </Interruptor>
                ) : (
                  <Interruptor ligado={dividir} onChange={setDividir}>Dividir com {familias.length > 1 ? "a família" : familiaNome}</Interruptor>
                )}
                {!daCasa && dividir && familias.length > 1 && (
                  <Selecao tamanho="sm" ariaLabel="Família" valor={familiaId} onChange={setFamiliaId}
                    opcoes={familias.map((f) => ({ valor: f.id, rotulo: f.nome }))} />
                )}
                {(dividir || daCasa) && comoDivide && <p className={styles.dividirNota}>{comoDivide}</p>}
              </div>
            )}
          </Bloco>
        )}

        {comNotaELocal && (
          <Cupom rotulo="Nota e local">
            <LinhaCupom rotulo="Localização"><Localizacao valor={ponto} onChange={setPonto} desabilitado={salvando} /></LinhaCupom>
            <LinhaCupom rotulo="Anexos" empilhado>
              <Anexos desabilitado={salvando}
                itens={[
                  ...anexosSalvos.filter((a) => !anexosTirados.includes(a.id))
                    .map((a) => ({ chave: a.id, nome: a.nome, tipo: a.tipoConteudo, url: idEditado ? urlDoAnexo(idEditado, a.id) : undefined })),
                  ...anexosNovos.map((f, k) => ({ chave: `novo-${k}`, nome: f.name, tipo: f.type, arquivo: f })),
                ]}
                onAdicionar={(novos) => setAnexosNovos((v) => [...v, ...novos])}
                onRemover={(chave) => (chave.startsWith("novo-")
                  ? setAnexosNovos((v) => v.filter((_, k) => `novo-${k}` !== chave))
                  : setAnexosTirados((v) => [...v, chave]))} />
            </LinhaCupom>
          </Cupom>
        )}

        <RodapeFormulario>
          <Botao onClick={aoSair} disabled={salvando}>Cancelar</Botao>
          <Botao variante="primario" type="submit" disabled={salvando}>{rotuloSalvar}</Botao>
        </RodapeFormulario>
      </Lado>
    </Formulario>
  )
}
