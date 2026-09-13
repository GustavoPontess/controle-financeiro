# Empréstimo bancário via Open Finance — pesquisa (2026-09-13)

> Origem: pesquisa multi-agente em fontes primárias (Open Finance Brasil, BACEN, docs de
> agregadores, LGPD/ANPD) + mapeamento do repo. Achado catalogado no `ROADMAP.md` (§8.5).
> **Decisão de produto pendente:** suportar empréstimo bancário + P2P no mesmo `Emprestimo`
> (via `BancoId?` + `Pessoa`) ou separar. Ver §6.1.

# BRIEF DECISÓRIO — Empréstimo × Banco × Open Finance no Pontes

## 1. O Open Finance JÁ entrega taxa + parcelas + saldo? **SIM, e completo.**

A API **Loans v2.5.0** (Fase 2, com consentimento) entrega tudo que a entidade `Emprestimo` precisa. basePath `/open-banking/loans/v2`, escopo OAuth `loans` + `consent:consentId`.

| O que o Pontes precisa | Endpoint | Campo exato |
|---|---|---|
| **Taxa de juros** (mensal/anual, pré/pós) | `GET /contracts/{id}` | `interestRates[]` → `preFixedRate`, `postFixedRate`, `taxPeriodicity` (AA/AM) |
| **CET** | `GET /contracts/{id}` | `CET` |
| **Valor contratado** | `GET /contracts/{id}` | `contractAmount` |
| **Nº de parcelas** (pagas/vencer/vencidas) | `GET /contracts/{id}/scheduled-instalments` | `totalNumberOfInstalments`, `paidInstalments`, `dueInstalments`, `pastDueInstalments` |
| **Valor próxima parcela** | `GET /contracts/{id}` | `nextInstalmentAmount` |
| **Vencimentos** | `GET /contracts/{id}` | `dueDate`, `firstInstalmentDueDate`, `instalmentPeriodicity` |
| **Saldo devedor** | `GET /contracts/{id}/payments` | `contractOutstandingBalance` |
| **Amortização** (SAC/PRICE) | `GET /contracts/{id}` | `amortizationScheduled` |
| **Encargos/tarifas** | `GET /contracts/{id}` | `contractedFinanceCharges[]`, `contractedFees[]` |
| Garantias | `GET /contracts/{id}/warranties` | `warrantyType`, `warrantyAmount` |

Financiamentos ficam numa API irmã (`/open-banking/financings/v2`, estrutura idêntica).
**Fonte primária:** spec YAML `https://raw.githubusercontent.com/OpenBanking-Brasil/openapi/main/swagger-apis/loans/2.5.0.yml` · pasta `https://github.com/OpenBanking-Brasil/openapi/tree/main/swagger-apis/loans`

> Nota conceitual importante: o modelo OFB é **empréstimo do usuário CONTRA uma instituição** (crédito bancário). O modelo atual do Pontes é **P2P** (`Emprestimo.Pessoa` = texto livre, "de quem peguei / pra quem emprestei"). São dois casos de uso diferentes — OFB cobre só o bancário. Isso é decisão de produto, não bloqueio técnico.

## 2. NÓS conseguimos acessar? **Não diretamente. Só via agregador (hoje).**

Regra dura (fonte primária): só **instituição autorizada a funcionar pelo BACEN + registrada no Diretório de Participantes** recebe dados. Startup B2C não regulada **não** se enquadra (Res. Conjunta 1/2020, art. 1º — `https://normativos.bcb.gov.br/Lists/Normativos/Attachments/51028/Res_Conj_0001_v7_L.pdf`).

| Caminho | Viável p/ Pontes? | Exigência regulatória | Custo | Esforço |
|---|---|---|---|---|
| **(a) Participante direto** | ❌ agora | Autorização BACEN (IP/SCD) + certificação FAPI-BR 2.1 + mTLS + ICP-Brasil + DCR/SSA | Capital mínimo, PLD/FT, meses de processo | Altíssimo |
| **(b) Agregador (Pluggy/Belvo/Klavi)** | ✅ **recomendado** | Nenhuma própria — o agregador é a receptora regulada (Pluggy = ITP). Exige **DPA/contrato de tratamento** (LGPD art. 39) | Pluggy ~R$2.5k/mês (Dados); Belvo ~R$6k/mês *(preços: fonte secundária, fórum — ordem de grandeza, **não confirmado** oficialmente)* | Médio (integração de API) |
| **(c) Entrada manual** | ✅ **já dá pra fazer** | Só LGPD do dado que o usuário digita | R$ 0 | Baixo |

**Futuro (c/ ressalva):** figura de "entidade parceira" (modelo 1x1x1) permitiria acesso direto sem ser regulado — **proposta em consulta, norma prevista abr–mai/2026, ainda NÃO vigente** *(fonte imprensa Finsiders — não confirmado em norma)*. Monitorar `https://openfinancebrasil.org.br/atos-normativos/`.

**Recomendação de acesso:** **Pluggy** como parceiro quando OFB entrar — mais bem documentado, produto `LOANS` completo, sandbox 14 dias em produção sem cartão, declara explicitamente que o cliente não precisa de autorização BACEN (`https://docs.pluggy.ai/docs/loans`). Belvo é alternativa sólida (confirmar campos exatos de taxa). Klavi só se o foco for score/risco.

## 3. RECOMENDAÇÃO faseada + o que modelar agora

**Precisamos de vínculo `Banco ↔ Emprestimo`? SIM** — e é o único trabalho de modelagem que vale fazer agora, porque serve às três fases.

| Campo `Emprestimo` | Fase 1 (manual, JÁ) | Fase 2 (agregador) |
|---|---|---|
| `TaxaJuroMensal` | manual | auto (`interestRates[]`, converter AA→AM) |
| Parcelas (`QuantidadeParcelas`, `EmprestimoParcela[]`) | manual | auto (`scheduled-instalments`) |
| `ValorTotal` | manual | auto (`contractAmount`) |
| Vencimentos (`PrimeiroVencimento`, `DataVencimento`) | manual | auto (`firstInstalmentDueDate`) |
| Saldo devedor | calculado local | auto (`contractOutstandingBalance`) |
| `PercentualMultaAtraso` | manual | manual (OFB traz encargos, não o % de multa do jeito que o Pontes modela) |

**Fases:**
- **Fase 1 (agora):** vínculo opcional `Emprestimo → Banco` + entrada 100% manual. Zero regulação. (detalhe no item 4)
- **Fase 2 (quando OFB via agregador):** botão "importar do banco" que preenche os campos auto acima; usuário revisa. Marca origem do dado (`OrigemDados: Manual | OpenFinance`).
- **Fase 3 (opcional):** sync periódico do saldo devedor.

**O que modelar AGORA (mínimo, à prova de futuro):**
1. `Emprestimo.BancoId` (`Guid?`, FK opcional para `Banco`, delete `SetNull`/`Restrict`) + nav property. Não remover `Pessoa` — coexistem (P2P vs bancário).
2. Enum `OrigemEmprestimo { Manual = 1, OpenFinance = 2 }` (default Manual) — evita retrabalho na Fase 2 e permite bloquear edição de campo vindo do banco.
3. Migration + `BancoId` no `CriarEmprestimoDto`/`EmprestimoDto`, isolamento por `UsuarioId` mantido.

Não modelar agora: tabelas de consentimento, tokens OFB, `interestRates[]` cru — só quando a Fase 2 for aprovada (evita esquema morto).

## 4. MVP concreto e barato (sem OFB) — reusa o que já existe

Tudo reaproveita o catálogo `Banco` (semeado via BrasilAPI com logo/cor/COMPE) e o `PontesBankBadge`:

**Backend:**
- Migration `AddBancoIdToEmprestimo` (`BancoId Guid?` + FK) + enum `OrigemEmprestimo`.
- `EmprestimoService`: aceitar/persistir `BancoId`; incluir `.Include(e => e.Banco)` na leitura; devolver `BancoNome`/`BancoLogoUrl`/`BancoCor` no DTO.
- Validação: `BancoId`, se informado, tem que existir e estar `Ativo` (regra de campo padrão).

**Frontend:**
- `EmprestimosLabModals.tsx`: adicionar `PontesSelect` de banco (opcional), populado por `bancoService.getBancos()` — mesmo padrão do `ContaForm.tsx` L92-96.
- Melhorar o select para render com badge (hoje `ContaForm` mostra só nome): usar `PontesBankBadge` no `label`/option → o Pontes ganha seleção visual de banco reaproveitável.
- Exibir `PontesBankBadge` no card/lista de empréstimo quando houver banco vinculado.
- Copy: manter o cuidado da regra do casal — em empréstimo bancário "banco" é neutro; nada de "deve".

Custo: **R$ 0**, só dev. Entrega valor real (organizar empréstimos por banco, com marca) e deixa o trilho pronto pra ligar o agregador depois.

## 5. Guardrails segurança / LGPD

Válidos já na Fase 1 (dado manual) e obrigatórios na Fase 2:
- **Consentimento (Fase 2):** granular por finalidade × grupo. Pedir **só** `LOANS`/`FINANCINGS` (contrato + parcelas + saldo). **Nunca** marcar contas/cartão/investimentos "de brinde" = violação de minimização (LGPD art. 6º III, art. 8º §4). Revogável a qualquer tempo, efeito imediato. Prazo: casar com a finalidade, **não** pedir prazo aberto só porque a norma agora permite (teto de 12 meses foi extinto pela Res. Conjunta 7/2023 — *fonte secundária, confirmar texto*).
- **Minimização na borda:** transformar payload OFB em **derivado** (taxa, saldo, próxima parcela) e **descartar o cru**. Se guardar cru, TTL curto + cifrado.
- **PII de terceiros (crítico):** extrato pode trazer avalista/coobrigado que não é usuário. **Decisão MVP: não ingerir/armazenar** — filtrar na borda antes de gravar. Se não guarda, não há o que vazar nem excluir.
- **Menor exposição:** isolamento por `UsuarioId` (já é padrão do projeto); usuário vê só o próprio crédito; nunca expor no bundle/rota dado de outro.
- **Nunca logar** taxa/saldo/CPF/contrato (`SEGURANCA_BEST_PRACTICES.md` §0).
- **Cripto at-rest** para dado de crédito ingerido (domínio 🔶 aberto no doc de segurança — decidir via EF `ValueConverter`, chave separada do banco).
- **DPA obrigatório** com o agregador (LGPD art. 39): definir controlador × operador; o Pontes vira controlador do dado ingerido.
- **Catalogar em `ROADMAP.md`** (protocolo §8.5) antes de qualquer código de Fase 2. Reabre o que `docs/CONFORMIDADE_BR.md` deixou parkado.

**Fontes:** LGPD `https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm` · escopo/dicionário `https://openfinancebrasil.org.br/escopo-de-dados-dicionario/` · FAPI-BR 2.1 `https://openfinancebrasil.atlassian.net/wiki/spaces/OF/pages/1334149137`

## 6. Perguntas em aberto / riscos

1. **Produto:** OFB cobre só empréstimo bancário; o Pontes hoje é P2P. Queremos suportar os dois no mesmo `Emprestimo` (via `BancoId?` + `Pessoa`) ou separar? — **precisa de decisão do Gustavo.**
2. **Preços dos agregadores** não confirmados em fonte oficial (vieram de fórum). Confirmar cotação Pluggy/Belvo direto no comercial antes de orçar.
3. **Campos de taxa da Belvo** não enumerados em doc viva; Pluggy confirmado completo.
4. **"Entidade parceira" (1x1x1)** pode abrir acesso direto sem agregador em meados/2026, mas **não é norma vigente** — não planejar contando com ela.
5. **Fim do teto de 12 meses** confirmado só em fonte secundária — reconfirmar texto da Res. Conjunta 7/2023 antes de fixar em `docs/CONFORMIDADE_BR.md`.
6. **Custo recorrente:** agregador é OPEX mensal fixo — só liga a Fase 2 quando houver massa de usuários que justifique (a Fase 1 manual não tem esse custo e valida a demanda primeiro).
7. **Canal do agregador:** confirmar com jurídico se é OFB oficial ou "scraping" não-regulado (bases LGPD e responsabilidade mudam).

**Veredito:** faça a **Fase 1 agora** (BancoId + enum Origem + entrada manual, R$0, reusa Banco/BancoSeeder/PontesBankBadge). Isso resolve 80% do valor percebido e deixa o modelo pronto. Só invista no agregador (Pluggy) quando a demanda por importação automática for comprovada — e sempre com o gate LGPD/DPA fechado antes.
