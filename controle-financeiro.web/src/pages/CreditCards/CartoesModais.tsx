// Modais da tela de Cartões (cadastrar/editar cartão, pagar fatura, remover cartão, estornar pagamento),
// ligados ao estado do useCartoesLogic — a tela real e as bancadas abrem os MESMOS modais.
import {
  PontesButton, PontesModal, PontesDialog, PontesField, PontesInput, PontesDateInput, PontesSelect,
} from "@/components/pontes"
import EstornarPagamentoDialog from "./EstornarPagamentoDialog"
import { MODOS, type CartoesLogic, type Modo } from "./useCartoesLogic"
import BandeiraMark from "./BandeiraMark"
import { BANDEIRA_OPTIONS, MEIOS_PAGAMENTO, clampDia, fmtMoneyInput, parseMoney } from "./cartoesFormato"
import styles from "./CreditCardsPage.module.css"

export default function CartoesModais({ logic }: { logic: CartoesLogic }) {
  const { bancos, contas, notify } = logic
  const m = logic.modais
  const { form, setForm, setF, formErrors, setFormErrors, clearErr } = m

  return (
    <>
      {/* Modal Criar/Editar Cartão */}
      <PontesModal
        open={m.dialogOpen}
        title={m.editingId ? "Editar cartão" : "Novo cartão"}
        onClose={() => m.setDialogOpen(false)}
        footer={<>
          <PontesButton variant="outline" onClick={() => m.setDialogOpen(false)}>Cancelar</PontesButton>
          <PontesButton onClick={m.handleSalvar} loading={m.loading} disabled={m.loading}>{m.editingId ? "Atualizar" : "Cadastrar"}</PontesButton>
        </>}
      >
        <div className={styles.modalCol}>
          <PontesField label="Modalidade" required>
            <PontesSelect
              value={form.modo}
              onChange={(v) => setForm((f) => ({ ...f, modo: v as Modo, contaId: undefined, limite: undefined, diaFechamento: undefined, diaVencimento: undefined }))}
              options={MODOS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </PontesField>
          <PontesField label="Nome do cartão" required error={formErrors.nome}>
            <PontesInput value={form.nome} onChange={(e) => { setF("nome", e.target.value); setFormErrors((p) => ({ ...p, nome: undefined })) }} invalid={!!formErrors.nome} placeholder="Ex: Nubank Roxinho" />
          </PontesField>
          <PontesField label="Bandeira">
            <div className={styles.bandeiraGrid}>
              {BANDEIRA_OPTIONS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  className={styles.bandeiraChip}
                  data-selected={form.bandeira === b.value ? "true" : undefined}
                  onClick={() => setF("bandeira", b.value)}
                  aria-label={b.label}
                  title={b.label}
                >
                  <BandeiraMark bandeira={b.value} width={40} genericColor="var(--pontes-text-muted)" />
                </button>
              ))}
            </div>
          </PontesField>
          <PontesField label="Últimos 4 dígitos" error={formErrors.ultimosDigitos}>
            <PontesInput
              value={form.ultimosDigitos ?? ""}
              onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 4); setF("ultimosDigitos", d || undefined); clearErr("ultimosDigitos") }}
              invalid={!!formErrors.ultimosDigitos}
              inputMode="numeric" maxLength={4} placeholder="0000"
            />
          </PontesField>
          <PontesField label="Banco emissor" required error={formErrors.bancoId}>
            <PontesSelect value={form.bancoId ?? ""} onChange={(v) => { setF("bancoId", v || undefined); clearErr("bancoId") }} invalid={!!formErrors.bancoId} placeholder="Quem emitiu o cartão" options={bancos.map((b) => ({ value: b.id, label: b.nome }))} />
          </PontesField>
          {m.temCredito && (
            <PontesField label="Limite de crédito" required error={formErrors.limite}>
              <PontesInput
                iconStart="R$"
                value={fmtMoneyInput(form.limite)}
                onChange={(e) => { setF("limite", parseMoney(e.target.value)); clearErr("limite") }}
                invalid={!!formErrors.limite}
                inputMode="decimal" placeholder="0,00"
              />
            </PontesField>
          )}
          {m.temCredito && (
            <div className={styles.grid2}>
              <PontesField label="Dia fechamento" required error={formErrors.diaFechamento}>
                <PontesInput
                  type="number"
                  value={form.diaFechamento != null ? String(form.diaFechamento) : ""}
                  onChange={(e) => { setF("diaFechamento", clampDia(e.target.value)); clearErr("diaFechamento") }}
                  invalid={!!formErrors.diaFechamento}
                  min={1} max={31} step={1} inputMode="numeric" placeholder="1 a 31"
                />
              </PontesField>
              <PontesField label="Dia vencimento" required error={formErrors.diaVencimento}>
                <PontesInput
                  type="number"
                  value={form.diaVencimento != null ? String(form.diaVencimento) : ""}
                  onChange={(e) => { setF("diaVencimento", clampDia(e.target.value)); clearErr("diaVencimento") }}
                  invalid={!!formErrors.diaVencimento}
                  min={1} max={31} step={1} inputMode="numeric" placeholder="1 a 31"
                />
              </PontesField>
            </div>
          )}
        </div>
      </PontesModal>

      {/* Modal Pagar Fatura */}
      <PontesModal
        open={!!m.pagarFaturaId}
        title="Pagar fatura"
        onClose={() => m.setPagarFaturaId(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => m.setPagarFaturaId(null)}>Cancelar</PontesButton>
          <PontesButton onClick={m.handlePagar} loading={m.pagarLoading} disabled={m.pagarLoading}>Confirmar pagamento</PontesButton>
        </>}
      >
        <div className={styles.modalCol}>
          <PontesField label="Conta de débito" required error={m.pagarErrors.conta}>
            <PontesSelect
              value={m.pagarForm.contaId}
              onChange={(v) => { m.setPagarForm((f) => ({ ...f, contaId: v })); m.setPagarErrors((p) => ({ ...p, conta: undefined })) }}
              placeholder="Selecione a conta"
              invalid={!!m.pagarErrors.conta}
              options={contas.map((c) => ({ value: c.id, label: c.nome }))}
            />
          </PontesField>
          <PontesField label="Valor" required error={m.pagarErrors.valor}>
            <PontesInput
              iconStart="R$"
              value={fmtMoneyInput(m.pagarForm.valor ? Number(m.pagarForm.valor) : undefined)}
              onChange={(e) => {
                const v = parseMoney(e.target.value)
                m.setPagarForm((f) => ({ ...f, valor: v != null ? String(v) : "" }))
                m.setPagarErrors((p) => ({ ...p, valor: undefined }))
              }}
              invalid={!!m.pagarErrors.valor}
              inputMode="decimal"
              placeholder="0,00"
            />
          </PontesField>
          <div className={styles.grid2}>
            <PontesField label="Data do pagamento" required>
              <PontesDateInput value={m.pagarForm.dataPagamento} onChange={(v) => m.setPagarForm((f) => ({ ...f, dataPagamento: v }))} />
            </PontesField>
            <PontesField label="Meio de pagamento">
              <PontesSelect value={m.pagarForm.meioPagamento} onChange={(v) => m.setPagarForm((f) => ({ ...f, meioPagamento: v }))} options={MEIOS_PAGAMENTO} />
            </PontesField>
          </div>
        </div>
      </PontesModal>

      <PontesDialog
        open={m.delId !== null}
        title="Remover cartão?"
        description="O cartão sai da lista e as compras vinculadas somem do extrato, mas os pagamentos de fatura ficam preservados no histórico da conta."
        confirmLabel="Remover"
        onConfirm={m.handleDelete}
        onCancel={() => m.setDelId(null)}
      />

      <EstornarPagamentoDialog
        pagamento={m.estornando}
        onClose={() => m.setEstornando(null)}
        onEstornado={() => { if (m.estornando) void m.recarregarFaturaDoPagamento(m.estornando.cartaoId, m.estornando.faturaId) }}
        notify={notify}
      />
    </>
  )
}
