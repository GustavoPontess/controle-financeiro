// Modais reais compartilhados pelas 3 páginas de bancada (lab-a/b/c) — mesmo conjunto e mesma
// lógica da EmprestimosPage.tsx real, só extraído pra não repetir 600 linhas de JSX 3x.
import { useEffect, useState } from "react"
import {
  Copy, Link2, Check, X, RotateCcw,
} from "lucide-react"
import {
  PontesButton, PontesModal, PontesDialog, PontesField, PontesInput, PontesDateInput,
  PontesSelect, PontesTextarea, PontesBadge, PontesIconButton, PontesCheckbox,
  PontesStepper, type PontesStep,
} from "@/components/pontes"
import { formatMoney } from "@/utils/money"
import {
  StatusAprovacaoPagamentoEmprestimo,
} from "../../types/Emprestimo"
import {
  TIPOS, FORMAS_PAGAMENTO, formatDate, fmtMoney, parseMoney,
  type EmprestimosLogic, type EscolhaFormaPagamento,
} from "./useEmprestimosLogic"
import GateOption from "./GateOption"
import styles from "./EmprestimosLabShared.module.css"

export default function EmprestimosLabModals({ logic }: { logic: EmprestimosLogic }) {
  const l = logic

  // Wizard de consolidação: 0 = Pessoa, 1 = Empréstimos, 2 = Detalhes.
  // Com 1 candidato só, pula a escolha de pessoa (começa no passo 1).
  const consolidarAberto = l.consolidarGrupo !== null
  const multiPessoa = l.candidatosConsolidacao.length > 1
  const stepInicial = multiPessoa ? 0 : 1
  const [consolidarStep, setConsolidarStep] = useState(stepInicial)
  useEffect(() => {
    if (consolidarAberto) setConsolidarStep(multiPessoa ? 0 : 1)
  }, [consolidarAberto]) // eslint-disable-line react-hooks/exhaustive-deps
  const consolidarPassos = multiPessoa ? [0, 1, 2] : [1, 2]
  const consolidarLabels = ["Pessoa", "Empréstimos", "Detalhes"]
  const consolidarStepperSteps: PontesStep[] = consolidarPassos.map((s) => ({
    label: consolidarLabels[s],
    status: consolidarStep === s ? "current" : consolidarStep > s ? "done" : undefined,
  }))

  // Wizard de novo empréstimo: 0 = Básico, 1 = Condições, 2 = Movimentação.
  const novoLabels = ["Básico", "Condições", "Movimentação"]
  const [novoStep, setNovoStep] = useState(0)
  useEffect(() => { if (l.dialogOpen) setNovoStep(0) }, [l.dialogOpen])
  const novoStepperSteps: PontesStep[] = novoLabels.map((label, s) => ({
    label,
    status: novoStep === s ? "current" : novoStep > s ? "done" : undefined,
  }))

  return (
    <>
      {/* Modal: Novo empréstimo */}
      <PontesModal
        open={l.dialogOpen}
        title="Novo empréstimo"
        onClose={() => l.setDialogOpen(false)}
        footer={<>
          {novoStep > 0 ? (
            <PontesButton variant="outline" onClick={() => setNovoStep((s) => s - 1)}>Voltar</PontesButton>
          ) : (
            <PontesButton variant="outline" onClick={() => l.setDialogOpen(false)}>Cancelar</PontesButton>
          )}
          {novoStep < 2 ? (
            <PontesButton onClick={() => { if (l.validarPassoNovo(novoStep)) setNovoStep((s) => s + 1) }}>Continuar</PontesButton>
          ) : (
            <PontesButton onClick={l.handleSalvar} loading={l.loading} disabled={l.loading}>Criar empréstimo</PontesButton>
          )}
        </>}
      >
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (novoStep === 2) void l.handleSalvar()
            else if (l.validarPassoNovo(novoStep)) setNovoStep((s) => s + 1)
          }}
          className={styles.formCol}
        >
          <PontesStepper steps={novoStepperSteps} />

          {novoStep === 0 && (<>
            <PontesField label="Tipo" required>
              <PontesSelect value={l.form.tipo} onChange={(v) => l.setF("tipo", v)} options={TIPOS} />
            </PontesField>

            <PontesField label="Descrição" required error={l.errors.descricao}>
              <PontesInput
                value={l.form.descricao}
                onChange={(e) => { l.setF("descricao", e.target.value); l.clearErr("descricao") }}
                invalid={!!l.errors.descricao}
                placeholder="Ex: Empréstimo para viagem"
              />
            </PontesField>

            <PontesField label={l.form.tipo === "1" ? "Para quem emprestei" : "De quem peguei"} required error={l.errors.pessoa}>
              <PontesInput
                value={l.form.pessoa}
                onChange={(e) => { l.setF("pessoa", e.target.value); l.clearErr("pessoa") }}
                invalid={!!l.errors.pessoa}
                placeholder="Nome da pessoa"
              />
            </PontesField>

            <PontesField label="Valor" required error={l.errors.valorTotal}>
              <PontesInput
                iconStart="R$"
                value={fmtMoney(l.form.valorTotal)}
                onChange={(e) => { l.setF("valorTotal", parseMoney(e.target.value)); l.clearErr("valorTotal") }}
                invalid={!!l.errors.valorTotal}
                inputMode="decimal"
                placeholder="0,00"
              />
            </PontesField>
          </>)}

          {novoStep === 1 && (<>
            <div className={styles.grid2}>
              <PontesField label="Data" required>
                <PontesDateInput value={l.form.dataInicio} onChange={(v) => l.setF("dataInicio", v)} />
              </PontesField>
              <PontesField label="Vencimento" helper="Opcional">
                <PontesDateInput value={l.form.dataVencimento} onChange={(v) => l.setF("dataVencimento", v)} />
              </PontesField>
            </div>

            <PontesField label="Forma de pagamento">
              <PontesSelect
                value={l.form.formaPagamento}
                onChange={(v) => l.setF("formaPagamento", v as EscolhaFormaPagamento)}
                options={FORMAS_PAGAMENTO}
              />
            </PontesField>

            {l.form.formaPagamento === "parcelado" && (
              <div className={styles.grid2}>
                <PontesField label="Quantidade de parcelas" required error={l.errors.quantidadeParcelas}>
                  <PontesInput
                    value={l.form.quantidadeParcelas ?? ""}
                    onChange={(e) => { l.setF("quantidadeParcelas", e.target.value ? Number(e.target.value) : undefined); l.clearErr("quantidadeParcelas") }}
                    invalid={!!l.errors.quantidadeParcelas}
                    inputMode="numeric"
                    placeholder="Ex: 12"
                  />
                </PontesField>
                <PontesField label="Vencimento da 1ª parcela" required error={l.errors.primeiroVencimento}>
                  <PontesDateInput
                    value={l.form.primeiroVencimento}
                    onChange={(v) => { l.setF("primeiroVencimento", v); l.clearErr("primeiroVencimento") }}
                  />
                </PontesField>
              </div>
            )}

            <div className={styles.grid2}>
              <PontesField label="Juros ao mês" helper={l.form.formaPagamento === "parcelado" ? "Opcional, sobre o valor da parcela" : "Opcional, sobre o total"}>
                <PontesInput
                  value={l.form.taxaJuroMensal ?? ""}
                  onChange={(e) => l.setF("taxaJuroMensal", e.target.value ? Number(e.target.value) : undefined)}
                  inputMode="decimal" iconEnd="%" placeholder="0"
                />
              </PontesField>
              <PontesField label="Multa por atraso" helper={l.form.formaPagamento === "parcelado" ? "Opcional, sobre a parcela" : "Opcional, sobre o total"}>
                <PontesInput
                  value={l.form.percentualMultaAtraso ?? ""}
                  onChange={(e) => l.setF("percentualMultaAtraso", e.target.value ? Number(e.target.value) : undefined)}
                  inputMode="decimal" iconEnd="%" placeholder="0"
                />
              </PontesField>
            </div>

            <PontesField label="Observação" helper="Opcional">
              <PontesTextarea value={l.form.observacao} onChange={(e) => l.setF("observacao", e.target.value)} rows={2} />
            </PontesField>
          </>)}

          {novoStep === 2 && (<>
            <PontesField label="Esse dinheiro já saiu/entrou de verdade?" required error={l.errors.movimentacao}>
              <div className={styles.gateGroup}>
                <GateOption name="movimentacao" value="nao" current={l.form.movimentacao} onChange={l.handleMovimentacaoChange} className={styles.gateOption}>
                  Ainda não — é só o combinado, nada pra lançar agora
                </GateOption>
                <GateOption name="movimentacao" value="existente" current={l.form.movimentacao} onChange={l.handleMovimentacaoChange} className={styles.gateOption}>
                  Já lancei isso em outro lugar — quero vincular
                </GateOption>
                <GateOption name="movimentacao" value="novo" current={l.form.movimentacao} onChange={l.handleMovimentacaoChange} className={styles.gateOption}>
                  Já movimentou e ainda não lancei — lançar agora
                </GateOption>
              </div>
            </PontesField>

            {l.form.movimentacao === "existente" && (
              <PontesField label={l.form.tipo === "1" ? "Despesa já lançada" : "Receita já lançada"} required
                error={l.errors.transacaoExistenteId} helper={l.despesasLoading || l.receitasLoading ? "Carregando…" : undefined}>
                <PontesSelect
                  value={l.form.transacaoExistenteId}
                  onChange={(v) => { l.setF("transacaoExistenteId", v); l.clearErr("transacaoExistenteId") }}
                  options={(l.form.tipo === "1" ? l.despesasRecentes : l.receitasRecentes).map((t) => ({
                    value: t.id, label: `${formatDate(t.data)} — ${t.descricao} — ${formatMoney(t.valor)}`,
                  }))}
                  placeholder="Selecione o lançamento"
                />
              </PontesField>
            )}

            {l.form.movimentacao === "novo" && (
              <div className={styles.grid2}>
                <PontesField label="Conta" required error={l.errors.contaId}>
                  <PontesSelect
                    value={l.form.contaId}
                    onChange={(v) => { l.setF("contaId", v); l.clearErr("contaId") }}
                    options={l.contas.map((c) => ({ value: c.id, label: c.nome }))}
                    placeholder="Selecione"
                  />
                </PontesField>
                <PontesField label="Categoria" required error={l.errors.categoriaId}>
                  <PontesSelect
                    value={l.form.categoriaId}
                    onChange={(v) => { l.setF("categoriaId", v); l.clearErr("categoriaId") }}
                    options={l.categorias
                      .filter((c) => c.finalidade === 3 || (l.form.tipo === "1" ? c.finalidade === 1 : c.finalidade === 2))
                      .map((c) => ({ value: c.id, label: c.descricao }))}
                    placeholder="Selecione"
                  />
                </PontesField>
              </div>
            )}
          </>)}
        </form>
      </PontesModal>

      <PontesDialog
        open={l.quitarId !== null}
        title="Marcar como quitado?"
        description="O empréstimo será fechado e não aceitará mais pagamentos."
        confirmLabel="Quitar"
        onConfirm={l.handleQuitar}
        onCancel={() => l.setQuitarId(null)}
      />

      <PontesDialog
        open={l.delId !== null}
        title="Remover empréstimo?"
        description="O registro sai da sua lista. Se já tiver pagamento registrado (por qualquer lado), não é possível remover — quite-o em vez disso."
        confirmLabel="Remover"
        onConfirm={l.handleDelete}
        onCancel={() => l.setDelId(null)}
      />

      {/* Modal: Vincular a uma pessoa */}
      <PontesModal
        open={l.vincularFor !== null}
        title="Vincular empréstimo"
        onClose={() => l.setVincularFor(null)}
        footer={l.vincularLink ? (
          <PontesButton onClick={() => l.setVincularFor(null)}>Fechar</PontesButton>
        ) : (
          <>
            <PontesButton variant="outline" onClick={() => l.setVincularFor(null)}>Cancelar</PontesButton>
            <PontesButton onClick={l.handleVincular} loading={l.vincularLoading} disabled={l.vincularLoading}>
              Gerar convite
            </PontesButton>
          </>
        )}
      >
        <div className={styles.formCol}>
          {!l.vincularLink ? (
            <PontesField label="E-mail da pessoa" required error={l.vincularErr}
              helper="Se ela já tiver conta no Pontes, aceita direto. Se não tiver, o link leva pro cadastro.">
              <PontesInput
                value={l.vincularEmail}
                onChange={(e) => { l.setVincularEmail(e.target.value); l.setVincularErr(undefined) }}
                invalid={!!l.vincularErr}
                placeholder="nome@exemplo.com"
                autoFocus
              />
            </PontesField>
          ) : (
            <>
              <p className={styles.hintText}>
                Copie e envie esse link pra pessoa por WhatsApp, e-mail ou como preferir —
                o Pontes não envia nada automaticamente.
              </p>
              <div className={styles.vincularLinkBox}>
                <Link2 size={14} />
                <span>{l.vincularLink}</span>
              </div>
              <PontesButton variant="outline" iconStart={<Copy size={14} />} onClick={l.handleCopiarLink}>
                Copiar link
              </PontesButton>
            </>
          )}
        </div>
      </PontesModal>

      {/* Modal: Registrar pagamento — mesmo formulário pros dois papéis */}
      <PontesModal
        open={l.solicitarFor !== null}
        title="Registrar pagamento"
        onClose={() => l.setSolicitarFor(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => l.setSolicitarFor(null)}>Cancelar</PontesButton>
          <PontesButton onClick={l.handleSolicitar} loading={l.loading} disabled={l.loading}>
            {l.souCredorSolicitar ? "Confirmar recebimento" : "Enviar pra aprovação"}
          </PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <p className={styles.hintText}>
            {l.souCredorSolicitar
              ? "Isso lança a entrada de verdade na sua conta e já confirma o pagamento — a outra pessoa é avisada."
              : "Isso lança a saída de verdade na sua conta e avisa o credor — só depois que ele confirmar é que o valor pago do empréstimo avança."}
            {l.isParceladoSolicitar && " Se o valor cobrir mais de uma parcela, todas são quitadas em sequência, da mais antiga pra mais nova."}
          </p>

          <PontesField label={l.souCredorSolicitar ? "Como registrar esse recebimento?" : "Como comprovar esse pagamento?"} required error={l.solicitarErrors.escolha}>
            <div className={styles.gateGroup}>
              <GateOption name="solicitar-escolha" value="existente" current={l.solicitarEscolha} onChange={l.handleSolicitarEscolhaChange} className={styles.gateOption}>
                {l.souCredorSolicitar ? "Já registrei essa entrada em outro lugar — quero vincular" : "Já lancei essa saída em outro lugar — quero vincular"}
              </GateOption>
              <GateOption name="solicitar-escolha" value="novo" current={l.solicitarEscolha} onChange={l.handleSolicitarEscolhaChange} className={styles.gateOption}>
                {l.souCredorSolicitar ? "Ainda não registrei — registrar agora" : "Ainda não lancei — lançar agora"}
              </GateOption>
            </div>
          </PontesField>

          {l.solicitarEscolha === "existente" && (
            <PontesField label={l.souCredorSolicitar ? "Receita já lançada" : "Despesa já lançada"} required error={l.solicitarErrors.transacaoExistenteId}
              helper={(l.souCredorSolicitar ? l.receitasLoading : l.despesasLoading) ? "Carregando…" : undefined}>
              <PontesSelect
                value={l.solicitarTransacaoExistenteId}
                onChange={(v) => { l.setSolicitarTransacaoExistenteId(v); l.setSolicitarErrors((p) => ({ ...p, transacaoExistenteId: undefined })) }}
                options={(l.souCredorSolicitar ? l.receitasRecentes : l.despesasRecentes).map((t) => ({
                  value: t.id, label: `${formatDate(t.data)} — ${t.descricao} — ${formatMoney(t.valor)}`,
                }))}
                placeholder={l.souCredorSolicitar ? "Selecione a receita" : "Selecione a despesa"}
              />
            </PontesField>
          )}

          {l.solicitarEscolha === "novo" && (
            <>
              <PontesField label="Valor pago" required error={l.solicitarErrors.valor}>
                <PontesInput
                  iconStart="R$"
                  value={fmtMoney(l.solicitarForm.valor)}
                  onChange={(e) => { l.setSolicitarForm((f) => ({ ...f, valor: parseMoney(e.target.value) })); l.setSolicitarErrors((p) => ({ ...p, valor: undefined })) }}
                  invalid={!!l.solicitarErrors.valor}
                  inputMode="decimal" placeholder="0,00" autoFocus
                />
              </PontesField>
              <PontesField label={l.souCredorSolicitar ? "Conta (pra onde foi)" : "Conta (de onde saiu)"} required error={l.solicitarErrors.contaId}>
                <PontesSelect
                  value={l.solicitarForm.contaId}
                  onChange={(v) => { l.setSolicitarForm((f) => ({ ...f, contaId: v })); l.setSolicitarErrors((p) => ({ ...p, contaId: undefined })) }}
                  options={l.contas.map((c) => ({ value: c.id, label: c.nome }))}
                  placeholder="Selecione"
                />
              </PontesField>
              <PontesField label="Categoria" required error={l.solicitarErrors.categoriaId}>
                <PontesSelect
                  value={l.solicitarForm.categoriaId}
                  onChange={(v) => { l.setSolicitarForm((f) => ({ ...f, categoriaId: v })); l.setSolicitarErrors((p) => ({ ...p, categoriaId: undefined })) }}
                  options={l.categorias
                    .filter((c) => (l.souCredorSolicitar ? c.finalidade === 2 : c.finalidade === 1) || c.finalidade === 3)
                    .map((c) => ({ value: c.id, label: c.descricao }))}
                  placeholder="Selecione"
                />
              </PontesField>
            </>
          )}
        </div>
      </PontesModal>

      {/* Modal: Histórico de pagamentos */}
      <PontesModal
        open={l.historicoFor !== null}
        title="Histórico de pagamentos"
        onClose={() => l.setHistoricoFor(null)}
        footer={<PontesButton onClick={() => l.setHistoricoFor(null)}>Fechar</PontesButton>}
      >
        <div className={styles.formCol}>
          {l.historicoLoading ? (
            <span className={styles.hintText}>Carregando…</span>
          ) : l.historico.length === 0 ? (
            <span className={styles.hintText}>Nenhum pagamento solicitado ainda.</span>
          ) : (
            <ul className={styles.pendentesList}>
              {l.historico.map((h) => (
                <li key={h.id} className={styles.pendenteItem}>
                  <span className={styles.pendenteDesc}>
                    <strong>{h.solicitadoPorNome}</strong> — {formatMoney(h.valor)}{" "}
                    <PontesBadge size="sm" tone={h.statusAprovacao === StatusAprovacaoPagamentoEmprestimo.Aprovada ? "success"
                      : h.statusAprovacao === StatusAprovacaoPagamentoEmprestimo.Rejeitada ? "danger" : "warning"}>
                      {h.statusAprovacaoDescricao}
                    </PontesBadge>
                    {h.motivoRejeicao && <><br /><span className={styles.hintText}>Motivo: {h.motivoRejeicao}</span></>}
                  </span>
                  {h.statusAprovacao === StatusAprovacaoPagamentoEmprestimo.Pendente && l.historicoEmprestimo?.souCredor && (
                    <div className={styles.actions}>
                      <PontesIconButton size={32} variant="ghost" aria-label="Aprovar pagamento" disabled={l.avaliandoId === h.id} onClick={() => l.openAprovar(h.id)}>
                        <Check size={14} />
                      </PontesIconButton>
                      <PontesIconButton size={32} variant="ghost" aria-label="Rejeitar pagamento" disabled={l.avaliandoId === h.id} onClick={() => l.openRejeitar(h.id)}>
                        <X size={14} />
                      </PontesIconButton>
                    </div>
                  )}
                  {h.statusAprovacao === StatusAprovacaoPagamentoEmprestimo.Rejeitada && h.solicitadoPor === l.currentUser?.id && (
                    <PontesIconButton size={32} variant="ghost" aria-label="Reenviar pagamento" disabled={l.avaliandoId === h.id} onClick={() => l.handleReenviar(h.id)}>
                      <RotateCcw size={14} />
                    </PontesIconButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PontesModal>

      {/* Modal: Aprovar pagamento */}
      <PontesModal
        open={l.aprovarFor !== null}
        title="Aprovar pagamento"
        onClose={() => l.setAprovarFor(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => l.setAprovarFor(null)}>Cancelar</PontesButton>
          <PontesButton onClick={l.handleAprovar} loading={l.avaliandoId === l.aprovarFor} disabled={l.avaliandoId === l.aprovarFor}>Confirmar recebimento</PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <PontesField label="Como registrar essa entrada?" required error={l.aprovarErrors.escolha}>
            <div className={styles.gateGroup}>
              <GateOption name="aprovar-escolha" value="existente" current={l.aprovarEscolha} onChange={l.handleAprovarEscolhaChange} className={styles.gateOption}>
                Já registrei essa entrada em outro lugar — quero vincular
              </GateOption>
              <GateOption name="aprovar-escolha" value="novo" current={l.aprovarEscolha} onChange={l.handleAprovarEscolhaChange} className={styles.gateOption}>
                Ainda não registrei — registrar agora
              </GateOption>
            </div>
          </PontesField>

          {l.aprovarEscolha === "existente" && (
            <PontesField label="Receita já lançada" required error={l.aprovarErrors.transacaoExistenteId}
              helper={l.receitasLoading ? "Carregando…" : undefined}>
              <PontesSelect
                value={l.aprovarTransacaoExistenteId}
                onChange={(v) => { l.setAprovarTransacaoExistenteId(v) }}
                options={l.receitasRecentes.map((t) => ({
                  value: t.id, label: `${formatDate(t.data)} — ${t.descricao} — ${formatMoney(t.valor)}`,
                }))}
                placeholder="Selecione a receita"
              />
            </PontesField>
          )}

          {l.aprovarEscolha === "novo" && (
            <>
              <PontesField label="Conta (pra onde foi)" required error={l.aprovarErrors.contaId}>
                <PontesSelect
                  value={l.aprovarForm.contaId}
                  onChange={(v) => l.setAprovarForm((f) => ({ ...f, contaId: v }))}
                  options={l.contas.map((c) => ({ value: c.id, label: c.nome }))}
                  placeholder="Selecione"
                />
              </PontesField>
              <PontesField label="Categoria" required error={l.aprovarErrors.categoriaId}>
                <PontesSelect
                  value={l.aprovarForm.categoriaId}
                  onChange={(v) => l.setAprovarForm((f) => ({ ...f, categoriaId: v }))}
                  options={l.categorias.filter((c) => c.finalidade === 2 || c.finalidade === 3).map((c) => ({ value: c.id, label: c.descricao }))}
                  placeholder="Selecione"
                />
              </PontesField>
            </>
          )}
        </div>
      </PontesModal>

      {/* Modal: Rejeitar pagamento */}
      <PontesModal
        open={l.rejeitarFor !== null}
        title="Rejeitar pagamento"
        onClose={() => l.setRejeitarFor(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => l.setRejeitarFor(null)}>Cancelar</PontesButton>
          <PontesButton variant="danger" onClick={l.handleRejeitar} loading={l.avaliandoId === l.rejeitarFor} disabled={l.avaliandoId === l.rejeitarFor}>
            Rejeitar
          </PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <PontesField label="Motivo" helper="Opcional — o devedor vê isso na notificação e no histórico">
            <PontesTextarea value={l.rejeitarMotivo} onChange={(e) => l.setRejeitarMotivo(e.target.value)} rows={3}
              placeholder="Ex: valor não bate com o combinado" autoFocus />
          </PontesField>
        </div>
      </PontesModal>

      {/* Modal: Propor consolidação */}
      <PontesModal
        open={consolidarAberto}
        title="Propor consolidação"
        onClose={() => l.setConsolidarGrupo(null)}
        footer={<>
          {consolidarStep > stepInicial ? (
            <PontesButton variant="outline" onClick={() => setConsolidarStep((s) => s - 1)}>Voltar</PontesButton>
          ) : (
            <PontesButton variant="outline" onClick={() => l.setConsolidarGrupo(null)}>Cancelar</PontesButton>
          )}
          {consolidarStep < 2 ? (
            <PontesButton
              onClick={() => setConsolidarStep((s) => s + 1)}
              disabled={consolidarStep === 1 && l.consolidarSelecionados.size < 2}
            >Continuar</PontesButton>
          ) : (
            <PontesButton onClick={l.handleProporConsolidacao} loading={l.consolidarLoading} disabled={l.consolidarLoading}>
              Propor
            </PontesButton>
          )}
        </>}
      >
        {l.consolidarGrupo && (
          <form noValidate onSubmit={(e) => { e.preventDefault(); if (consolidarStep === 2) void l.handleProporConsolidacao() }} className={styles.formCol}>
            <PontesStepper steps={consolidarStepperSteps} />


            {consolidarStep === 0 && (
              <PontesField label="Com quem é a consolidação?">
                <div className={styles.selectList}>
                  {l.candidatosConsolidacao.map((c) => {
                    const sel = l.consolidarGrupo?.contraparteUsuarioId === c.contraparteUsuarioId
                    return (
                      <button
                        type="button"
                        key={c.contraparteUsuarioId}
                        className={styles.pessoaRow}
                        data-selected={sel || undefined}
                        onClick={() => l.openConsolidar(c)}
                      >
                        <span className={styles.pessoaMain}>
                          <span className={styles.pessoaNome}>{c.contraparteNome}</span>
                          <span className={styles.pessoaSub}>{c.itens.length} empréstimos ativos</span>
                        </span>
                        <span className={styles.selectValor}>{formatMoney(c.itens.reduce((sum, i) => sum + i.valorRestanteSnapshot, 0))}</span>
                      </button>
                    )
                  })}
                </div>
              </PontesField>
            )}

            {consolidarStep === 1 && (
              <PontesField label="Quais empréstimos entram?" helper="Escolha 2 ou mais">
                <div className={styles.selectList}>
                  {l.consolidarGrupo.itens.map((i) => {
                    const sel = l.consolidarSelecionados.has(i.emprestimoOriginalId)
                    return (
                      <div key={i.emprestimoOriginalId} className={styles.selectRow} data-selected={sel || undefined}>
                        <PontesCheckbox
                          checked={sel}
                          onChange={() => l.toggleConsolidarSelecionado(i.emprestimoOriginalId)}
                          label={i.descricao}
                        />
                        <span className={styles.selectValor}>{formatMoney(i.valorRestanteSnapshot)}</span>
                      </div>
                    )
                  })}
                </div>
              </PontesField>
            )}

            {consolidarStep === 2 && (<>
              <PontesField label="Descrição do plano novo" required error={l.consolidarErrors.descricao}>
                <PontesInput
                  value={l.consolidarForm.descricao}
                  onChange={(e) => l.setConsolidarForm((f) => ({ ...f, descricao: e.target.value }))}
                  invalid={!!l.consolidarErrors.descricao}
                />
              </PontesField>

              <PontesField label="Forma de pagamento">
                <PontesSelect
                  value={l.consolidarForm.formaPagamento}
                  onChange={(v) => l.setConsolidarForm((f) => ({ ...f, formaPagamento: v as EscolhaFormaPagamento }))}
                  options={FORMAS_PAGAMENTO}
                />
              </PontesField>

              {l.consolidarForm.formaPagamento === "parcelado" ? (
                <div className={styles.grid2}>
                  <PontesField label="Quantidade de parcelas" required error={l.consolidarErrors.quantidadeParcelas}>
                    <PontesInput
                      value={l.consolidarForm.quantidadeParcelas ?? ""}
                      onChange={(e) => l.setConsolidarForm((f) => ({ ...f, quantidadeParcelas: e.target.value ? Number(e.target.value) : undefined }))}
                      invalid={!!l.consolidarErrors.quantidadeParcelas}
                      inputMode="numeric" placeholder="Ex: 12"
                    />
                  </PontesField>
                  <PontesField label="Vencimento da 1ª parcela" required error={l.consolidarErrors.primeiroVencimento}>
                    <PontesDateInput
                      value={l.consolidarForm.primeiroVencimento}
                      onChange={(v) => l.setConsolidarForm((f) => ({ ...f, primeiroVencimento: v }))}
                    />
                  </PontesField>
                </div>
              ) : (
                <PontesField label="Vencimento" helper="Opcional">
                  <PontesDateInput
                    value={l.consolidarForm.dataVencimento}
                    onChange={(v) => l.setConsolidarForm((f) => ({ ...f, dataVencimento: v }))}
                  />
                </PontesField>
              )}

              <div className={styles.grid2}>
                <PontesField label="Juros ao mês" helper={l.consolidarForm.formaPagamento === "parcelado" ? "Opcional, sobre o valor da parcela" : "Opcional, sobre o total"}>
                  <PontesInput
                    value={l.consolidarForm.taxaJuroMensal ?? ""}
                    onChange={(e) => l.setConsolidarForm((f) => ({ ...f, taxaJuroMensal: e.target.value ? Number(e.target.value) : undefined }))}
                    inputMode="decimal" iconEnd="%" placeholder="0"
                  />
                </PontesField>
                <PontesField label="Multa por atraso" helper={l.consolidarForm.formaPagamento === "parcelado" ? "Opcional, sobre a parcela" : "Opcional, sobre o total"}>
                  <PontesInput
                    value={l.consolidarForm.percentualMultaAtraso ?? ""}
                    onChange={(e) => l.setConsolidarForm((f) => ({ ...f, percentualMultaAtraso: e.target.value ? Number(e.target.value) : undefined }))}
                    inputMode="decimal" iconEnd="%" placeholder="0"
                  />
                </PontesField>
              </div>
            </>)}
          </form>
        )}
      </PontesModal>

      {/* Modal: Recusar consolidação */}
      <PontesModal
        open={l.recusarConsolidacaoFor !== null}
        title="Recusar consolidação"
        onClose={() => l.setRecusarConsolidacaoFor(null)}
        footer={<>
          <PontesButton variant="outline" onClick={() => l.setRecusarConsolidacaoFor(null)}>Cancelar</PontesButton>
          <PontesButton variant="danger" onClick={l.handleRecusarConsolidacao}
            loading={l.respondendoConsolidacaoId === l.recusarConsolidacaoFor} disabled={l.respondendoConsolidacaoId === l.recusarConsolidacaoFor}>
            Recusar
          </PontesButton>
        </>}
      >
        <div className={styles.formCol}>
          <PontesField label="Motivo" helper="Opcional — quem propôs vê isso na notificação">
            <PontesTextarea value={l.recusarConsolidacaoMotivo} onChange={(e) => l.setRecusarConsolidacaoMotivo(e.target.value)} rows={3}
              placeholder="Ex: prefiro manter separado" autoFocus />
          </PontesField>
        </div>
      </PontesModal>
    </>
  )
}
