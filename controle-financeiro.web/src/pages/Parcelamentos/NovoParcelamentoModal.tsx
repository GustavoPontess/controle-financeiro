// "Novo parcelamento" — formulário e regras (piso/teto do mês da 1ª parcela, compra em andamento,
// juros do Pix Crédito, Idempotency-Key por abertura). Usado pela tela de Parcelamentos e pelas bancadas
// de layout de Cartões (/credit-cards/lab-*). Quem abre remonta com `key` a cada abertura (form zerado,
// chave nova).
import React, { useRef, useState } from "react"
import { dataLocalISO } from "@/utils/dateTime"
import {
  PontesButton, PontesModal, PontesField, PontesInput, PontesDateInput, PontesMonthInput, PontesSelect,
} from "@/components/pontes"
import { ParcelamentoService } from "../../services/ParcelamentoService"
import { TipoParcelamento } from "../../types/Parcelamento"
import type { CriarParcelamentoPayload } from "../../types/Parcelamento"
import type { CartaoCredito } from "../../types/CartaoCredito"
import { notificacaoDeErro } from "@/utils/apiError"
import { indiceMes, mesDaFaturaDoDia, mesMinimoPrimeiraParcela, rotuloMesFatura, somarMeses } from "../CreditCards/ciclosFatura"
import styles from "./ParcelamentosPage.module.css"

const parseMoney = (masked: string): number | undefined => {
  const digits = masked.replace(/\D/g, "")
  return digits ? Number(digits) / 100 : undefined
}
const fmtMoney = (n?: number): string =>
  n != null ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""

const TIPOS_OPTS = [
  { value: "0", label: "Compra Parcelada" },
  { value: "1", label: "PIX Crédito" },
]

type FormState = {
  descricao: string
  valor?: number
  tipo: string
  cartaoCreditoId: string
  dataCompra: string
  parcelas: number
  /** Compra em andamento: quantas já foram pagas antes de registrar (0 = compra nova). */
  jaPagas: number
  /** Mês do campo: a fatura da 1ª parcela a registrar — a 1ª, ou a PRÓXIMA a pagar se `jaPagas` > 0.
   *  O payload manda o mês da parcela 1 (`mesInicio − jaPagas`). */
  mesInicio: string
  taxaJuroMensal?: number
}
type Errors = Partial<Record<
  "descricao" | "valor" | "cartaoCreditoId" | "parcelas" | "jaPagas" | "mesInicio" | "taxaJuroMensal", string
>>

type Notification = { open: boolean; message: string; severity: "success" | "error" | "warning" }

// "Primeira parcela: outubro" = a fatura que FECHA em outubro (o rótulo da tela Cartões). A sugestão é
// a mais cedo que o banco cobraria: a fatura em que a compra cai ou, se a compra é antiga, a aberta
// hoje. Sem cartão escolhido ainda, mês calendário.
const emptyForm = (): FormState => {
  const dataCompra = dataLocalISO()
  return {
    descricao: "", valor: undefined, tipo: "0", cartaoCreditoId: "",
    dataCompra,
    parcelas: 3, jaPagas: 0, mesInicio: mesMinimoPrimeiraParcela(dataCompra, dataCompra), taxaJuroMensal: undefined,
  }
}

type Props = {
  aberto: boolean
  onFechar: () => void
  /** Depois de criar (recarregar a lista). */
  onCriado: () => Promise<void> | void
  cartoes: CartaoCredito[]
  notify: React.Dispatch<React.SetStateAction<Notification>>
  /** Cartão já escolhido ao abrir (ex.: aberto de dentro de um cartão). */
  cartaoInicialId?: string
}

export default function NovoParcelamentoModal({ aberto, onFechar, onCriado, cartoes, notify, cartaoInicialId }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormState>(() => {
    const f = emptyForm()
    if (!cartaoInicialId) return f
    const c = cartoes.find((x) => x.id === cartaoInicialId)
    return { ...f, cartaoCreditoId: cartaoInicialId, mesInicio: mesMinimoPrimeiraParcela(f.dataCompra, f.dataCompra, c?.diaFechamento, c?.diaVencimento) }
  })
  // Usuário escolheu o mês da 1ª parcela à mão: mudar a data da compra ou o cartão não sobrescreve
  // a escolha (se ela ficar antes do mínimo, a validação do submit avisa no campo).
  const [mesEscolhido, setMesEscolhido] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  // Idempotency-Key nasce quando a janela ABRE (o componente remonta a cada abertura — `key` de quem
  // abre) e vale pra toda tentativa dela: se a rede cair depois de o servidor gravar, tentar de novo
  // devolve o mesmo parcelamento em vez de criar outro.
  const chaveCriar = useRef(crypto.randomUUID())

  const clearErr = (k: keyof Errors) => setErrors((p) => ({ ...p, [k]: undefined }))
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const diaFechamentoDo = (cartaoId: string) => cartoes.find((c) => c.id === cartaoId)?.diaFechamento
  const diaVencimentoDo = (cartaoId: string) => cartoes.find((c) => c.id === cartaoId)?.diaVencimento
  // Primeira parcela mais cedo possível no cartão escolhido (o backend recusa antes dela): a fatura em
  // que a compra cai ou, compra antiga, a 1ª que ainda não venceu — as anteriores já venceram. Mínimo do seletor e
  // sugestão enquanto o usuário não escolhe o mês. Compra em andamento: o campo é a PRÓXIMA a pagar.
  const diaFechamento = diaFechamentoDo(form.cartaoCreditoId)
  const emAndamento = form.jaPagas > 0
  const mesMinimo = mesMinimoPrimeiraParcela(form.dataCompra, dataLocalISO(), diaFechamento, diaVencimentoDo(form.cartaoCreditoId), form.jaPagas)
  const minimoEhAFaturaDaCompra = mesMinimo === somarMeses(mesDaFaturaDoDia(form.dataCompra, diaFechamento), form.jaPagas)
  // Compra em andamento: a última já paga é de fatura que fechou → a próxima vai no máximo na aberta.
  const mesMaximo = emAndamento ? mesDaFaturaDoDia(dataLocalISO(), diaFechamento) : ""
  // …e por isso a compra precisa ser antiga o bastante: no máximo uma paga por fatura entre a da compra
  // e a aberta (compra de hoje ainda não tem parcela paga).
  const mesDaCompra = mesDaFaturaDoDia(form.dataCompra, diaFechamento)
  const maxJaPagas = mesMaximo && mesDaCompra ? indiceMes(mesMaximo) - indiceMes(mesDaCompra) : Infinity

  const mudarCompra = (patch: Partial<Pick<FormState, "dataCompra" | "cartaoCreditoId" | "jaPagas">>) => {
    setForm((f) => {
      const next = { ...f, ...patch }
      if (mesEscolhido) return next
      return {
        ...next,
        mesInicio: mesMinimoPrimeiraParcela(next.dataCompra, dataLocalISO(), diaFechamentoDo(next.cartaoCreditoId), diaVencimentoDo(next.cartaoCreditoId), next.jaPagas),
      }
    })
    clearErr("mesInicio")
  }

  const handleCriar = async () => {
    const e: Errors = {}
    if (!form.descricao.trim()) e.descricao = "Informe a descrição"
    if (form.valor == null) e.valor = "Informe o valor"
    else if (form.valor <= 0) e.valor = "Valor deve ser maior que zero"
    if (!form.cartaoCreditoId) e.cartaoCreditoId = "Selecione o cartão"
    if (form.parcelas < 2 || form.parcelas > 36) e.parcelas = "Entre 2 e 36 parcelas"
    if (!Number.isInteger(form.jaPagas) || form.jaPagas < 0) e.jaPagas = "Informe um número inteiro"
    else if (form.jaPagas >= form.parcelas) e.jaPagas = "Precisa sobrar pelo menos 1 parcela"
    else if (form.jaPagas > maxJaPagas)
      e.jaPagas = maxJaPagas <= 0
        ? "Compra dessa data ainda não tem parcela paga"
        : `Compra dessa data tem no máximo ${maxJaPagas} já ${maxJaPagas === 1 ? "paga" : "pagas"}`
    const rotuloMin = rotuloMesFatura(`${mesMinimo}-01`)
    // A faixa do mês depende das já pagas: com erro lá, o aviso fica só nas já pagas.
    const faixaDoMes = !e.jaPagas
    if (!form.mesInicio) e.mesInicio = emAndamento ? "Informe o mês da próxima parcela" : "Informe o mês da primeira parcela"
    else if (faixaDoMes && mesMinimo && form.mesInicio < mesMinimo)
      e.mesInicio = !minimoEhAFaturaDaCompra
        ? `Não pode ser antes da fatura de ${rotuloMin} — as anteriores já venceram`
        : emAndamento
          ? `Com ${form.jaPagas} já ${form.jaPagas === 1 ? "paga" : "pagas"} desde a compra, não pode ser antes de ${rotuloMin}`
          : `Não pode ser antes da fatura da compra (${rotuloMin})`
    else if (faixaDoMes && mesMaximo && form.mesInicio > mesMaximo)
      e.mesInicio = `Não pode passar da fatura aberta (${rotuloMesFatura(`${mesMaximo}-01`)})`
    if (form.tipo === "1") {
      const t = form.taxaJuroMensal ?? 0
      if (t < 1.99 || t > 11.99) e.taxaJuroMensal = "PIX Crédito exige juros entre 1,99 e 11,99%"
    }
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    try {
      const payload: CriarParcelamentoPayload = {
        descricao: form.descricao.trim(),
        valor: form.valor!,
        tipo: Number(form.tipo) as TipoParcelamento,
        cartaoCreditoId: form.cartaoCreditoId,
        dataCompra: form.dataCompra,
        parcelas: form.parcelas,
        parcelasJaPagas: form.jaPagas,
        // O backend quer o mês da parcela 1; o campo mostra a próxima a pagar na compra em andamento.
        primeiraParcelaMes: somarMeses(form.mesInicio, -form.jaPagas),
        // Taxa só é válida em PIX Crédito (tipo "1"); o backend rejeita (409) qualquer taxa
        // — inclusive 0 — em Compra Parcelada. Enviar undefined pros demais tipos.
        taxaJuroMensal: form.tipo === "1" ? (form.taxaJuroMensal ?? 0) : undefined,
        idempotencyKey: chaveCriar.current,
      }
      await ParcelamentoService.criar(payload)
      notify({ open: true, message: "Parcelamento criado", severity: "success" })
      onFechar()
      await onCriado()
    } catch (err) {
      // Ex.: limite do cartão insuficiente → aviso com a mensagem do servidor, não erro genérico.
      notify({ open: true, ...notificacaoDeErro(err, "Erro ao criar parcelamento") })
    } finally { setLoading(false) }
  }

  return (
    <PontesModal
      open={aberto}
      title="Novo parcelamento"
      onClose={onFechar}
      footer={<>
        <PontesButton variant="outline" onClick={onFechar}>Cancelar</PontesButton>
        <PontesButton onClick={handleCriar} loading={loading} disabled={loading}>Criar</PontesButton>
      </>}
    >
      <form noValidate onSubmit={(e) => { e.preventDefault(); void handleCriar() }} className={styles.formCol}>
        <PontesField label="Descrição" required error={errors.descricao}>
          <PontesInput
            value={form.descricao}
            onChange={(e) => { setF("descricao", e.target.value); clearErr("descricao") }}
            invalid={!!errors.descricao}
            placeholder="Ex: Notebook, Monitor"
          />
        </PontesField>

        <div className={styles.grid2}>
          <PontesField label="Valor total" required error={errors.valor}>
            <PontesInput
              iconStart="R$"
              value={fmtMoney(form.valor)}
              onChange={(e) => { setF("valor", parseMoney(e.target.value)); clearErr("valor") }}
              invalid={!!errors.valor}
              inputMode="decimal"
              placeholder="0,00"
            />
          </PontesField>
          <PontesField label="Parcelas" required error={errors.parcelas}>
            <PontesInput
              type="number"
              value={String(form.parcelas)}
              onChange={(e) => { setF("parcelas", Number(e.target.value)); clearErr("parcelas") }}
              invalid={!!errors.parcelas}
              min={2} max={36} step={1} inputMode="numeric"
            />
          </PontesField>
        </div>

        <div className={styles.grid2}>
          <PontesField label="Data da compra" required>
            <PontesDateInput value={form.dataCompra} onChange={(v) => mudarCompra({ dataCompra: v })} />
          </PontesField>
          {/* Compra em andamento ("estou na 3 de 7" → 2): só as que faltam entram no app. */}
          <PontesField label="Parcelas já pagas" error={errors.jaPagas} htmlFor="parcelamento-ja-pagas">
            <PontesInput
              id="parcelamento-ja-pagas"
              type="number"
              value={String(form.jaPagas)}
              onChange={(e) => { mudarCompra({ jaPagas: Number(e.target.value) }); clearErr("jaPagas") }}
              invalid={!!errors.jaPagas}
              min={0} max={Math.max(0, form.parcelas - 1)} step={1} inputMode="numeric"
            />
          </PontesField>
        </div>

        <div className={styles.grid2}>
          <PontesField label={emAndamento ? "Próxima parcela (mês)" : "Primeira parcela (mês)"} required error={errors.mesInicio}>
            <PontesMonthInput
              value={form.mesInicio}
              min={mesMinimo || undefined}
              max={mesMaximo || undefined}
              onChange={(v) => { setF("mesInicio", v); setMesEscolhido(true); clearErr("mesInicio") }}
              invalid={!!errors.mesInicio}
            />
          </PontesField>
          <PontesField label="Tipo" required>
            <PontesSelect value={form.tipo} onChange={(v) => setF("tipo", v)} options={TIPOS_OPTS} />
          </PontesField>
        </div>

        <PontesField label="Cartão" required error={errors.cartaoCreditoId}>
          <PontesSelect
            value={form.cartaoCreditoId}
            onChange={(v) => { mudarCompra({ cartaoCreditoId: v }); clearErr("cartaoCreditoId") }}
            invalid={!!errors.cartaoCreditoId}
            placeholder="Selecione o cartão"
            options={cartoes.map((c) => ({ value: c.id, label: c.nome }))}
          />
        </PontesField>

        {form.tipo === "1" && (
          <PontesField label="Taxa de juros mensal (%)" required error={errors.taxaJuroMensal} helper="1,99% a 11,99%">
            <PontesInput
              type="number"
              value={form.taxaJuroMensal != null ? String(form.taxaJuroMensal) : ""}
              onChange={(e) => { setF("taxaJuroMensal", e.target.value ? Number(e.target.value) : undefined); clearErr("taxaJuroMensal") }}
              invalid={!!errors.taxaJuroMensal}
              min={1.99} max={11.99} step="0.01" inputMode="decimal"
            />
          </PontesField>
        )}
      </form>
    </PontesModal>
  )
}
