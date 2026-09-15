# Empréstimos — regras de negócio

> **Fonte da verdade** das regras de empréstimo do Pontes. Objetivo: parar de recorrigir as mesmas coisas. Cada regra factual cita **fonte (URL)** ou **código (`file:line`)**. Duas marcações:
> - **REGRA DECIDIDA** — vale, é para respeitar. Se ainda não está no código, está anotado.
> - **SUGESTÃO A CONFIRMAR** — proposta técnica aguardando OK do Gustavo (ver §6).
>
> Base de código: `ControleFinanceiro.Api/`. Onde só aparece `:linha`, é `Services/EmprestimoService.cs`. Docs irmãos: `pesquisa-openfinance.md` (banco/Open Finance), `../emprestimo-compartilhado/spec.md` (vínculo bilateral), `regras-calculo.md` (sugerido, ver §6). Última atualização: 2026-09-13.

---

## 1. Conceitos

- **Credor** = quem empresta / tem direito de receber de volta. **Devedor** = quem pega emprestado / tem obrigação de pagar. Juridicamente é um contrato de **mútuo**. (Fonte: BACEN, [Glossário de crédito](https://www.bcb.gov.br/content/estatisticas/Documents/Estatisticas_mensais/Monetaria_credito/glossariocredito.pdf))
- **Direção sempre relativa a quem olha.** Não existe "a receber" absoluto: o mesmo empréstimo é "a receber" para o credor e "a pagar" para o devedor. Toda a UI e os KPIs derivam a direção do papel do usuário logado — no código, via `EhCredor` + `ToDto` que inverte tudo para a contraparte (`:1493-1501`, `:1655-1666`). Detalhe em §2 e no cálculo em §5.
- **Empréstimo × Financiamento** (REGRA DECIDIDA — distinção conceitual):
  - **Empréstimo:** crédito de **uso livre**, sem bem atrelado; juros tendem a ser mais altos.
  - **Financiamento:** crédito com **finalidade específica e bem em garantia** (imóvel/veículo, alienação fiduciária); juros menores. Regra de bolso: **tem garantia vinculada → financiamento; dinheiro solto sem destino obrigatório → empréstimo**. (Fonte: [Serasa](https://www.serasa.com.br/ensina/seu-credito/diferencas-entre-financiamento-e-emprestimo/))
  - Hoje o Pontes **não distingue** os dois no modelo (não há `TipoCredito`/`Garantia`). Ver §6.
- **Empréstimo × Investimento** (REGRA DECIDIDA — fronteira do escopo):
  - Empréstimo (crédito): usuário é **devedor**, tem **passivo/dívida**, **paga** juros. Sinal do fluxo: saída de caixa + entradas de parcela (se ele é credor) ou entrada + saídas de parcela (se devedor).
  - Investimento (CDB/poupança): usuário é **credor/aplicador**, tem **ativo**, **recebe** rendimento, com proteção do **FGC até R$ 250 mil por CPF/instituição**. "Emprestar para o banco" é isto — não é crédito. (Fontes: [XP – CDB](https://conteudos.xpi.com.br/aprenda-a-investir/relatorios/cdb/), [Nubank – CDB](https://blog.nubank.com.br/cdb-prefixado-ou-cdb-pos-fixado/))
  - **Investimento fica FORA da entidade `Emprestimo`** — ativo × passivo, sinais de fluxo opostos e matemática diferente (amortização de dívida × rentabilidade). Pertence a um módulo de investimentos separado, se/quando existir.

---

## 2. Modalidades no Pontes

Distinção no modelo: `BancoId != null` ⇒ **bancário**; `BancoId == null` ⇒ **P2P (pessoa)**. `Pessoa` e `BancoId` coexistem no mesmo `Emprestimo` (`Domain/Entities/Emprestimo.cs:9,28-33`). O mercado **não** unifica os dois (Mobills/Organizze/YNAB/Monarch só fazem banco; Splitwise só P2P) — unificar é diferencial do Pontes, mas **exige separar os dois modos na UX** (seletor de tipo no início do wizard, campos condicionais).

### 2.1 P2P (pessoa)
- Pode ser **"Emprestei"** (`TipoEmprestimo.Emprestei` → a receber) **OU "Peguei emprestado"** (`PeguiEmprestado` → a pagar), na ótica do criador (`Domain/Enums/TipoEmprestimo.cs:5-6`, `Emprestimo.cs:12`).
- Suporta vínculo bilateral com a contraparte (convite/aceite) — ver §4.
- Campos próprios: `Pessoa` (nome digitado), e-mail/convite, papéis. **Não** pede instituição, CET, amortização SAC/PRICE.

### 2.2 Bancário (`BancoId`)
- **REGRA DECIDIDA — banco ⇒ SÓ "Peguei emprestado".** Pessoa física não empresta para banco; isso seria investimento (CDB), que está fora do escopo (§1). Logo:
  - Modalidade banco ⇒ **`Tipo` travado em `PeguiEmprestado`**.
  - A UI **não deve oferecer "Emprestei"** quando banco está selecionado, **nem pedir nome de pessoa/contraparte**, nem convite/aceite bilateral.
- **Estado no código (2026-09-13):** o backend valida que o banco existe e está `Ativo` (`:163-168`), mas **NÃO força `Tipo == PeguiEmprestado`** quando `BancoId != null`. A trava é regra decidida ainda **não implementada** — hoje depende da UI. Ver item pendente em §6.
- Prepara Open Finance (Fase 2): `Origem` = `Manual` hoje; `OpenFinance` definido mas não implementado (`Domain/Enums/OrigemEmprestimo.cs:11,14`). Fase 1 é 100% manual, custo R$0, com `PontesBankBadge` para identidade visual do banco.
- Não há vínculo bilateral em bancário (não existe "contraparte usuário" do outro lado).

---

## 3. Regras de dinheiro

> **PRINCÍPIO — dados dinâmicos, nunca chumbados (REGRA DECIDIDA, Gustavo 2026-09-13).** Taxa de juros, multa e afins **pertencem ao registro do empréstimo**, informados pelo usuário (Fase 1 manual) ou trazidos da integração (Fase 2). **Nunca hardcodar taxa de banco no código** — se o banco/mercado muda, muda o *dado*, não o código. Limite legal (ex.: teto de multa) que virar regra fica em **config nomeada** (um lugar só), nunca número solto espalhado. Todo cálculo (juros/multa/mora) é fórmula sobre o dado do registro.

### 3.1 Valor e vencimento (REGRA DECIDIDA — no código)
- `ValorTotal > 0`, senão `ArgumentException` (`:145-146`).
- `DataVencimento` (nullable) não pode ser anterior a `DataInicio`, comparação por `.Date` (`:148-149`).
- `IdempotencyKey` obrigatório na criação (`:151-152`).
- Parcelado: `QuantidadeParcelas` obrigatório e **entre 2 e 36** (`:154-157`); `PrimeiroVencimento` obrigatório (`:158-159`).

### 3.2 Parcelamento (REGRA DECIDIDA — no código)
- Duas formas (`Domain/Enums/FormaPagamentoEmprestimo.cs:10,13`): **`AVista`** (valor único, pagamentos avulsos) e **`Parcelado`** (gera N parcelas na criação, vencimento mensal fixo).
- Parcelas geradas **todas na criação** (`GerarParcelas`, `:1713-1742`): valor igual = `Math.Round(valorTotal/quantidade, 2, ToEven)`; **ajuste de centavos residuais na última parcela** (`valorTotal - somaParcelas`, `:1723`); vencimento mensal `primeiroVencimento.AddMonths(i-1)` (`:1732`).
- `EmprestimoParcela.Status`: `Pendente`/`Paga`/`Cancelada`; **"Atrasada" é calculado, não persistido** (`Domain/Enums/StatusParcelaEmprestimo.cs:10-12`).

### 3.3 Juros — o que o Pontes faz HOJE (REGRA DECIDIDA — no código)
- `TaxaJuroMensal` é **% mensal, FLAT (não composto)** nos dois casos (`Emprestimo.cs:51-54`):
  - **Parcelado:** aplicado por parcela — `ValorComJuros = Valor*(1+Taxa/100)`, arredondado 2 casas, só se taxa informada (`:1734-1736`, `EmprestimoParcela.cs:23`).
  - **À vista:** markup 1x na criação — `ValorComJuros = Math.Round(ValorTotal*(1+Taxa/100), 2)` (`:251-256`, `Emprestimo.cs:60-62`); null se Parcelado ou sem taxa.

### 3.4 Juros — SUGESTÃO A CONFIRMAR (mercado BR real)
- O varejo BR usa **juros compostos** em parcelado (juros do período sobre o saldo devedor remanescente), não flat. Tabela **PRICE** (parcela fixa; padrão de empréstimo pessoal/consignado/CDC/veículo) e **SAC** (parcela decrescente, amortização constante; padrão imobiliário). (Fontes: [BACEN – Calculadora do Cidadão](https://www3.bcb.gov.br/CALCIDADAO/publico/exibirFormFinanciamentoPrestacoesFixas.do?method=exibirFormFinanciamentoPrestacoesFixas), [Santander PRICE×SAC](https://www.santander.com.br/blog/tabela-price-sac))
  - Fórmula PRICE da parcela: `PMT = PV·i·(1+i)^n / ((1+i)^n − 1)`; por parcela `k`: `juros_k = saldo_{k-1}·i`, `amort_k = PMT − juros_k`.
  - Taxa sempre **mensal** no BR; converter para anual por composto: `i_anual = (1+i_mensal)^12 − 1` (nunca `×12`).
- **Recomendação:** adotar campo `SistemaAmortizacao (PRICE | SAC)` e gerar o cronograma parcela a parcela para **empréstimo bancário** (casa com `amortizationScheduled` do Open Finance, Fase 2). Manter o **flat atual como opção "simples"** para P2P informal (onde ninguém calcula PRICE). Decisão em §6. Destino do detalhe matemático: `regras-calculo.md`.

### 3.5 Multa e mora
**HOJE no código (REGRA DECIDIDA — implementada):**
- `PercentualMultaAtraso` é **% livre (sem teto/mínimo)**, aplicado **uma vez quando atrasa** (`Emprestimo.cs:56-58`).
- Snapshot **congelado na 1ª leitura após vencer**, não recalcula:
  - Parcela: `AplicarMultaSeAtrasada` (`:1746-1755`) — só se `Pendente`, `DataVencimento.Date < hoje`, `ValorComMulta` null, e há multa configurada; grava `Valor*(1+Multa/100)` (`EmprestimoParcela.cs:27`).
  - À vista: `AplicarMultaAVistaSeAtrasada` (`:1759-1769`) — só se `AVista`, não `Quitado`, `ValorComMulta` null, tem multa, e venceu (`Emprestimo.cs:64-67`).
  - Disparo em `ListarAsync` (`:76-80`), `BuscarPorIdAsync` (`:139`), `ListarParcelasAsync` (`:838-842`); persiste só se alterou.

**A CONFIRMAR / CORRIGIR (lei BR — relação de consumo):**
- **Multa de mora: teto de 2%, uma vez só.** CDC art. 52 §1º — multa não pode passar de **2% do valor da prestação** em atraso. É penalidade única, não acumula por dia/mês. (Fonte: [CDC art. 52 §1º](https://www.planalto.gov.br/ccivil_03/leis/l8078.htm); teto reduzido de 10%→2% pela [Lei 9.298/1996](https://www.planalto.gov.br/ccivil_03/leis/l9298.htm))
  - **SUGESTÃO A CONFIRMAR:** validar `PercentualMultaAtraso ≤ 2%` (front + back) em empréstimo bancário (relação de consumo). Hoje é livre. Em P2P entre particulares o teto de consumo não se aplica do mesmo jeito — decidir se trava só bancário ou ambos. Ver §6.
- **Juros de mora: ~1% ao mês, POR TEMPO** — encargo distinto da multa, remunera a demora, recorrente enquanto durar o atraso (pro rata die), teto usual 1% a.m. (Código Civil art. 406). O Pontes **não modela juros de mora hoje** — só multa única. (Fontes: [CC art. 406](https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm), [99Pay – mora × multa](https://99app.com/blog/99pay/juros-de-mora-e-multa-moratoria/))
- Cumulação lícita (se prevista): correção monetária + multa (≤2%) + juros de mora (≤1% a.m.) — naturezas distintas. Valor de encargos **muda a cada dia**; se implementar juros de mora, calcular na consulta/renderização, não congelar (diferente da multa única de hoje).

### 3.6 CET e IOF (SUGESTÃO A CONFIRMAR — fica para Fase 2/bancário)
- **CET (Custo Efetivo Total):** taxa única % a.a. que representa o custo total (TIR do fluxo), incluindo **juros + tarifas + IOF + seguros + registro**. Dois empréstimos com a mesma taxa nominal podem ter CET bem diferente — é o único número comparável. Exigido antes da contratação (Resolução CMN 4.881/2020). (Fonte: [Res. 4.881/2020 – BACEN](https://www.bcb.gov.br/content/estabilidadefinanceira/especialnor/Resolução4881.pdf))
- **IOF em empréstimo PF** (Decreto 6.306/2007 art. 7º): **0,0082%/dia** sobre o principal (teto 365 dias ≈ 3% a.a.) **+ 0,38% fixo** uma vez. ~3,38% para prazo ≥ 1 ano. Os decretos de 2025 **não alteraram** o IOF de crédito PF. (Fontes: [Decreto 6.306/2007](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/decreto/d6306.htm), [Agência Brasil – IOF PF inalterado](https://agenciabrasil.ebc.com.br/economia/noticia/2025-06/entenda-como-fica-o-iof-apos-derrubada-de-decreto))
- **Recomendação:** CET e IOF **NÃO entram na Fase 1 (manual)**. Só fazem sentido em bancário, e chegam prontos via Open Finance (campo `CET`) na Fase 2. Se calcular internamente antes disso, exige resolver TIR (Newton-Raphson) — custo alto para pouco retorno agora. Manter fora até Fase 2.

### 3.7 Quitação, arquivamento, exclusão (REGRA DECIDIDA — no código)
- **Quitar** (`QuitarAsync`, `:274-331`): só o credor (`BuscarParaConfirmacaoAsync`, `:1480-1491`); seta `ValorPago=ValorTotal`, `Quitado=true`; **rejeita automaticamente** solicitações `Pendente` esquecidas ("Empréstimo quitado diretamente antes da aprovação") e notifica.
- **Arquivar** (`ArquivarAsync`, `:339-352`): **só se `Quitado`** (senão `ArgumentException`); é **decisão pessoal por lado** (`ArquivadoPorCriador` × `ArquivadoPorContraparte`, `Emprestimo.cs:71-77`), não estado compartilhado; idempotente. `DesarquivarAsync` reverte por lado (`:356-366`).
- **Deletar** (`DeletarAsync`, `:373-393`): **soft delete** (`Ativo=false`, `:390`) — nunca `_context.Remove()`; só o `CriadoPor`; se `Vinculado`, **bloqueia (403)** quando há atividade real (`ValorPago>0`, alguma parcela `Paga`, ou qualquer solicitação de pagamento) — protege histórico compartilhado.
- **Visibilidade** (`VisivelPara`, `:1470-1474`): só `Ativo` e (`CriadoPor==eu` OU (`Contraparte==eu` E `Vinculado`)) — contraparte só enxerga após o aceite.

---

## 4. Vínculo bilateral (P2P)

Só P2P. Spec: `../emprestimo-compartilhado/spec.md`. Vai além do Splitwise: exige **aceite explícito** da contraparte + **autorização assimétrica** (só o credor confirma pagamento).

- **Papel/direção** (`:1493-1509`): `EhCredor` — se **não** `Vinculado`, credor = `CriadoPor`; se `Vinculado`, credor = `CriadoPor` quando `Emprestei`, senão `ContraparteUsuarioId`. `CredorUsuarioId`/`DevedorUsuarioId` só válidos quando `Vinculado`.
- **Convite** (`VincularAsync`, `:403-444`): e-mail obrigatório; **só o `CriadoPor` convida**; bloqueia se já `Vinculado` ou `PendenteAceite`. Token opaco 64 bytes, **só o hash persistido** (`:423`, `:1799-1803`), expira em **7 dias**. **Resposta idêntica exista ou não conta** (anti-enumeração); notificação in-app só se a conta existir; **sem e-mail automático** — link volta na resposta.
- **Aceite** (`AceitarInternoAsync`, `:535-567`): e-mail do convidado tem que bater (`:1584-1594`); rejeita se expirado; seta `ContraparteUsuarioId`, `StatusVinculo=Vinculado`, zera o token (**uso único**); notifica o criador. **Recusa** (`RecusarInternoAsync`, `:569-588`): `StatusVinculo=Recusado`, zera token e contraparte.
- Convites pendentes filtram por e-mail + `ConviteExpiraEm > agora`; **Tipo invertido** na visão de quem recebe (`:454-471`).
- **Pagamento com aprovação** (fluxo devedor → credor):
  - `SolicitarPagamentoAsync` (`:600-807`): `IdempotencyKey` + replay; participante obrigatório.
    - **Credor registra recebimento** (Receita): solicitação **nasce `Aprovada`** (auto-aprova o que ele mesmo recebeu), avança `ValorPago`.
    - **Devedor registra comprovante** (Despesa): nasce **`Pendente`**, não mexe em `ValorPago` até aprovação.
    - Parcelado: aplica **da parcela mais antiga primeiro** (amortização); excedente abate as seguintes; sobra vira adiantamento parcial; parcela vira `Paga` só quando cobre o devido `ValorComMulta ?? ValorComJuros ?? Valor`. `Quitado` quando `ValorPago >= ValorTotal`.
  - `AprovarPagamentoSolicitacaoAsync` (`:874-965`): **só o credor**, não a própria solicitação (`:1445-1466`); cria/vincula a Receita real; avança `ValorPago` com `Math.Min(..., ValorTotal)`.
  - `RejeitarPagamentoSolicitacaoAsync` (`:969-1002`): nenhuma Transacao, `ValorPago` não muda, fica no histórico como `Rejeitada`. `Reenviar` (`:1007-1039`): só quem solicitou, só se `Rejeitada`.
  - Solicitações `Pendente`/`Rejeitada` são **informativas**, nunca contam em `ValorPago`/`PercentualPago` (`:1618-1640`).
- **Consolidação** (≥2 empréstimos, mesma contraparte vinculada, credor propõe):
  - Candidatos (`:1046-1075`): contrapartes com **2+** empréstimos ativos, vinculados, não quitados, onde o usuário é **credor**.
  - `ProporConsolidacaoAsync` (`:1080-1171`): mínimo 2; `Descricao` obrigatória; parcelado valida 2-36 + `PrimeiroVencimento`; **só o credor inclui** cada um (403 senão); todos `Vinculado` e não `Quitado`; **1 só devedor distinto**; bloqueia se algum já está em consolidação `Pendente`. Nada muda nos originais até o aceite.
  - `AceitarConsolidacaoAsync` (`:1195-1306`): **só o devedor**; revalida estado; recalcula o restante real (não confia no snapshot), exige `>0`; cria `Emprestimo` novo `Emprestei`, credor=`CriadoPor`, já `Vinculado`; cada original vira `ValorPago=ValorTotal`, `Quitado`, `ConsolidadoNoEmprestimoId=novo`, **auto-arquivado dos dois lados**. `Recusar` (só devedor) / `Cancelar` (só o credor que propôs, `:1343-1367`).
  - Status: `Pendente`/`Aceita`/`Recusada`/`Cancelada` (`Domain/Enums/StatusConsolidacaoEmprestimo.cs:11-16`).

---

## 5. Já implementado (file:line) × decisão nova/pendente

| Tema | Estado | Referência |
|---|---|---|
| Entidade `Emprestimo` + campos | Implementado | `Domain/Entities/Emprestimo.cs:7-85` |
| `EmprestimoParcela` (geração na criação, snapshot juros/multa) | Implementado | `Domain/Entities/EmprestimoParcela.cs`, `:1713-1742` |
| Enums (Tipo, Forma, StatusVinculo, StatusParcela, StatusConsolidacao, Origem, StatusAprovacao) | Implementado | `Domain/Enums/*.cs` |
| Validações de criação (valor>0, vencimento, idempotência, parcelas 2-36, banco ativo) | Implementado | `:143-272` |
| Juros **flat** (à vista 1x / parcelado por parcela) | Implementado | `:251-256`, `:1734-1736` |
| Multa única com snapshot congelado | Implementado | `:1746-1769` |
| Direção a receber/a pagar + `EhCredor` + `ToDto` invertido | Implementado | `:55-60`, `:1493-1509`, `:1655-1666` |
| Vínculo bilateral (convite/aceite/recusa, token hash, 7 dias, anti-enumeração) | Implementado | `:403-588`, `:1568-1594` |
| Pagamento com aprovação (assimétrico credor/devedor) | Implementado | `:600-1039` |
| Consolidação (propor/aceitar/recusar/cancelar) | Implementado | `:1046-1392` |
| Quitar / arquivar (só quitado) / soft-delete / visibilidade | Implementado | `:274-393`, `:1470-1491` |
| `BancoId` + `PontesBankBadge` + wizard com select de banco | Implementado (Fase 1) | `Emprestimo.cs:28-33`, front `Emprestimos/` |
| **Banco ⇒ `Tipo` travado em `PeguiEmprestado`** | **Decidido, NÃO no backend** (hoje só UI) | ver §2.2, §6 |
| Multa ≤ 2% (CDC) validada front+back | **A confirmar** — hoje % livre | §3.5, §6 |
| Juros de mora ~1% a.m. por tempo | **Não modelado** | §3.5 |
| Juros compostos PRICE/SAC | **A confirmar** — hoje só flat | §3.4, §6 |
| Cronograma "atrasada" por parcela via job (tipo `FaturaAtrasoJob`) | **Não implementado** (hoje snapshot on-read) | §3.5 |
| CET / IOF | **Fora da Fase 1**, chega via Open Finance Fase 2 | §3.6 |
| `TipoCredito` / `Garantia` (empréstimo × financiamento) | **Não modelado** | §1, §6 |
| `Origem.OpenFinance` (import automático) | **Definido, não implementado** (Fase 2) | `Domain/Enums/OrigemEmprestimo.cs:14` |

---

## 6. Decisões (fechadas em 2026-09-13)

**Diretriz geral (Gustavo):** *tudo manual na Fase 1*. Os campos manuais já existem e ficam prontos pra integração — quando ligar Pluggy/Open Finance, só troca `Origem` (Manual→OpenFinance) e preenche o mesmo campo automático. Sem engine de cálculo automático agora.

1. **Banco ⇒ `Tipo=PeguiEmprestado`** — ✅ **IMPLEMENTADO** (UI esconde Tipo + backend `CriarAsync` rejeita `Emprestei` com banco + testes). §2.2.
2. **Multa ≤ 2% (CDC)** — ⏸️ **NÃO trava agora.** `PercentualMultaAtraso` segue **manual/livre** (dado do registro, dinâmico). O teto legal fica anotado como referência; se virar validação, entra como **config nomeada** (não número solto), e provavelmente só em bancário. Revisitar antes do 1.0.0.
3. **Juros PRICE/SAC** — ⏸️ **Fica flat manual.** Usuário informa a taxa; sem engine de amortização por enquanto. PRICE/SAC entra junto com a integração (o cronograma vem pronto do Open Finance) ou quando houver demanda.
4. **Juros de mora (~1%/mês por tempo)** — ⏸️ **Não modelar agora** (só a multa única de hoje). Adiciona cálculo diário; adiar.
5. **Job diário de atraso** — ⏸️ adiado (só se entrar mora, item 4). Segue snapshot on-read.
6. **`TipoCredito`/`Garantia` (empréstimo × financiamento)** — ⏸️ **tudo "empréstimo" por enquanto.** Modelar depois se necessário.
7. **CET/IOF** — ⏸️ **fora da Fase 1**, entram via Open Finance na Fase 2. ✅ confirmado.

> Regra viva: ao mudar qualquer decisão acima, atualizar a tabela §5 + `ROADMAP.md`; se envolver cálculo, criar `regras-calculo.md`.

---

## 7. Monetização (ideia — a validar)

Gancho já existe: campo `Origem` (`Manual` | `OpenFinance`) em `Emprestimo` (`Domain/Enums/OrigemEmprestimo.cs`).

- **Grátis:** uso 100% manual — usuário digita banco, valor, taxa, parcelas, multa. Tudo que a Fase 1 já entrega.
- **Pago:** integração (Pluggy/Open Finance) que **preenche/atualiza automático** taxa, parcelas, saldo devedor — `Origem = OpenFinance`. Justifica a mensalidade (o agregador é OPEX recorrente — ver `pesquisa-openfinance.md` §2).

Como os campos são os mesmos, o plano pago não é uma feature nova de dados — é **automação + sincronização** do que o grátis faz à mão. Sem retrabalho de modelo. *(Ideia de produto; não implementar billing agora.)*
