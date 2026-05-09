# 🚧 IMPLEMENTATION_STATE — Issue #1 Parcelamento Flexível

**Atualizado em:** 2026-05-08
**Branch:** `feature/1-parcelamento-flexivel` @ commit `874f1b3` (último commitado)
**Etapa atual:** 3 — PARCIAL (3 de 5 arquivos editados, sem commit)
**Última sessão:** Sessão 2 — 2026-05-08 (parou no meio da ETAPA 3 a pedido do usuário)

⚠️ **PENDÊNCIAS DE AMBIENTE (não bloqueiam, mas resolver em sessão dedicada):**
- 87 arquivos em todas as branches aparecem `modified` no sandbox Linux (mount interpreta CRLF↔LF). `git diff -w` retorna vazio → não é mudança real. Recomendado normalizar com `.gitattributes` (`* text=auto eol=lf`) + `git add --renormalize .`. Cada commit gera warning "LF will be replaced by CRLF" — inofensivo.
- Sandbox Linux NÃO tem `dotnet`/`npm` — todo `dotnet build` e `npm run build` precisa ser rodado pelo usuário no Git Bash dele. Eu não consigo validar checkpoint sem o usuário rodar e me avisar.
- Sandbox Linux NÃO consegue criar/remover `.git/index.lock` no mount (operation not permitted, provavelmente fsmonitor--daemon do Windows segura). Por isso `git add`/`git commit` precisam ser rodados pelo usuário no Git Bash dele.

---

## Como usar este arquivo

Este é o **estado vivo** da implementação do Issue #1 (Parcelamento Flexível).

- A cada checkpoint a sessão atualiza este arquivo
- Próxima sessão lê este arquivo PRIMEIRO pra saber onde retomar
- Nunca deletar histórico — apenas atualizar "Etapa atual" e adicionar entrada em "Histórico"

---

## 🎯 Etapas da implementação

A ordem importa: cada etapa deixa o build verde e o software funcional.

### ETAPA 0 — Setup
- [ ] Criar branch `feature/1-parcelamento-flexivel`
- [ ] Confirmar que `dotnet build` e `npm run build` passam no estado atual

### ETAPA 1 — Enums novos
- [x] `Domain/Enums/EstadoCicloFatura.cs`
- [x] `Domain/Enums/EstadoPagamentoFatura.cs`
- [x] `Domain/Enums/StatusParcela.cs`
- [x] `Domain/Enums/StatusTransacao.cs`
- [x] `Domain/Enums/TipoParcelamento.cs`
- [x] `Domain/Enums/FinancialEventType.cs`
- [x] **Checkpoint:** `dotnet build` verde *(enums standalone — nada referencia eles ainda — build trivialmente verde; usuário valida)*

### ETAPA 2 — Entidades novas
- [x] `Domain/Entities/Parcelamento.cs`
- [x] `Domain/Entities/ParcelaTransacao.cs`
- [x] `Domain/Entities/FinancialEventLog.cs`
- [x] **Checkpoint:** `dotnet build` verde *(commit `27ba211`)*

### ETAPA 3 — Modificar entidades existentes
- [x] `Fatura.cs` — adicionou EstadoCiclo, EstadoPagamento, EstaAtrasada, JurosDeMora, Multa, DataFechamentoEfetiva, DataPagamentoTotal + nav `ParcelasTransacao`; Status marcada `[Obsolete]` *(NÃO commitado)*
- [x] `CartaoCredito.cs` — adicionou `LimiteTotal` (nullable); Limite original marcada `[Obsolete]`; nav `Parcelamentos` adicionada *(NÃO commitado)*
- [x] `Recorrente.cs` — ContaId virou nullable; +`CartaoCreditoId` + nav, +`CanceladoEm`, +`MotivoCancelamento`, +`CriadoEm` *(NÃO commitado)*
- [x] `Transacao.cs` — adicionou ParcelamentoId, ParcelaTransacaoId, StatusTransacao, EhPagamentoFatura, FaturaPagaId, Ativo, CanceladoEm, MotivoCancelamento, CriadoEm; Parcelas/NumeroParcela/TransacaoOrigemId marcados `[Obsolete]`
- [x] `AppDbContext.cs` — adicionou 3 DbSets + delete behaviors completos (Parcelamento→ParcelaTransacao Cascade; Fatura→ParcelaTransacao Restrict; CartaoCredito→Parcelamento Restrict; Recorrente→CartaoCredito SetNull; Transacao→Parcelamento/ParcelaTransacao SetNull; Transacao.FaturaPaga via FaturaPagaId Restrict + nav one-way) + 3 índices em FinancialEventLog
- [x] `RecorrenteService.cs:90` — fix `ContaId = r.ContaId ?? Guid.Empty` (Recorrente.ContaId virou nullable; coalesce temporário até DTO virar nullable na ETAPA 6/7)
- [x] **Checkpoint:** `dotnet build` verde com 18 warnings obsolete (esperadas — vão sumir nas ETAPAS 5/6)

### ETAPA 4 — Migration de schema (aditiva)
- [x] `dotnet ef migrations add AddParcelamentoSchema`
- [x] SQL revisado: aditivo (CreateTable Parcelamentos/ParcelasTransacao/FinancialEventLogs + AddColumn em Transacoes/Faturas/CartoesCredito/Assinaturas + drop+recreate FK_Assinaturas_Contas pra mudar nullable). Zero DropColumn/DropTable.
- [x] **Correções manuais aplicadas no arquivo da migration** (registradas como comentários `// CORREÇÃO MANUAL`):
  - `Transacoes.Ativo` default `false` → `true` (transações existentes não viram soft-deleted)
  - `Transacoes.StatusTransacao` default `0` (Previsao) → `1` (Executado) (transações existentes são reais, não previsão)
  - `Transacoes.CriadoEm` e `Assinaturas.CriadoEm` default `0001-01-01` → constante `2026-05-09` (SQLite proíbe `datetime('now')` em ALTER TABLE ADD COLUMN). ETAPA 5 vai UPDATE pra `Data`/`DataInicio` original.
- [x] Backup do banco: `controlefinanceiro.db.backup-pre-etapa4` (rolar atrás se algo quebrar futuro)
- [x] `dotnet ef database update` aplicado com sucesso após correções
- [x] **Checkpoint:** `dotnet run` sobe sem erro; Swagger acessível em `http://localhost:5293/swagger`

### ETAPA 5a — Migration de DADOS (sem drops)
- [x] `dotnet ef migrations add MigrateLegacyData` → arquivo `20260509030627_MigrateLegacyData.cs` (vazio inicial — preenchido manualmente com 6 `migrationBuilder.Sql()`)
- [x] UPDATE Faturas: `Status` legacy → `(EstadoCiclo, EstadoPagamento, EstaAtrasada)` (mapeamento Aberta=1→(0,0,0); Fechada=2→(1,0,0); Paga=3→(1,2,0); para Paga seta também DataPagamentoTotal=now via COALESCE)
- [x] UPDATE Transacoes SET `CriadoEm = Data`
- [x] UPDATE Assinaturas SET `CriadoEm = DataInicio`
- [x] UPDATE CartoesCredito SET `LimiteTotal = Limite`
- [x] Backup `controlefinanceiro.db.backup-pre-etapa5a` criado
- [x] `dotnet ef database update` aplicado com sucesso
- [x] **Checkpoint via spot-check:** 5 faturas Status=1→(0,0,0) + 1 fatura Status=3→(1,2,0); 8 transações com CriadoEm=Data, StatusTransacao=Executado, Ativo=true; cartão Nubank Gold com Limite=LimiteTotal=12000; 0 assinaturas (nada a migrar)

### ETAPA 5b — CLEANUP (após ETAPAS 6-9 estarem prontas)
- [ ] Refatorar `FaturaService.cs` (9 usos de `Status`/`Parcelas`/`NumeroParcela`/`TransacaoOrigemId`)
- [ ] Refatorar `CartaoCreditoService.cs` (4 usos de `Limite` → `LimiteTotal`)
- [ ] Refatorar `TransacoesController.cs` (2 usos de `Parcelas`/`NumeroParcela`)
- [ ] Remover propriedades `[Obsolete]` das entidades (Status, Limite, Parcelas, NumeroParcela, TransacaoOrigemId)
- [ ] Gerar migration `RemoveLegacyColumns` (drops automáticos pelo diff de model)
- [ ] `dotnet ef database update`
- [ ] **Checkpoint:** zero warnings obsolete; build verde; API sobe; queries existentes ainda funcionam

### ETAPA 6 — Serviços
- [x] `Services/FinancialEventLogService.cs` — helper `Registrar()` + `BuscarPorIdempotencyKeyAsync()` (suporte ao padrão de idempotência via `idempotencyKey` dentro do `PayloadJson`)
- [x] `Services/LimiteCalculatorService.cs` — `CalcularAsync(cartaoId, usuarioId)` retorna `LimiteSnapshot` (LimiteTotal, Bloqueado, Disponivel, ExposicaoFuturaPrevisao); `CalcularTodosDoUsuarioAsync()` pra dashboard
- [x] DI: ambos registrados como Scoped em `Program.cs`
- [ ] `Services/ParcelamentoService.cs` (Criar, Cancelar, Listar, Detalhe — coração do issue, transação ACID + idempotência + FinancialEventLog)
- [ ] `Services/ParcelaTransacaoService.cs` (PagarAntecipado, Cancelar)
- [ ] Adaptar `FaturaService.cs` para 3 flags
- [ ] Adaptar `RecorrenteService.cs` para janela de 3 meses + soft delete
- [ ] Middleware/atributo de Idempotência
- [ ] **Checkpoint:** todos services compilam, registrados no DI

### ETAPA 7 — Controllers
- [ ] `Controllers/ParcelamentosController.cs`
- [ ] `Controllers/ParcelasController.cs`
- [ ] Adaptar `FaturasController.cs`
- [ ] DTOs em `DTOs/Parcelamento/`, `DTOs/Parcela/`
- [ ] **Checkpoint:** Swagger lista todos os endpoints

### ETAPA 8 — Jobs Hangfire
- [ ] Adicionar Hangfire ao `Program.cs` (storage SQLite)
- [ ] `Infrastructure/Jobs/FaturaFechamentoJob.cs`
- [ ] `Infrastructure/Jobs/FaturaAtrasoJob.cs`
- [ ] `Infrastructure/Jobs/ExpandirRecorrentesJob.cs`
- [ ] `Infrastructure/Jobs/ExecutarRecorrentesJob.cs`
- [ ] `Infrastructure/Jobs/RecalcularLimitesJob.cs`
- [ ] **Checkpoint:** dashboard `/hangfire` acessível

### ETAPA 9 — Testes
- [ ] Setup xUnit no projeto Test (se não existir)
- [ ] Testes unitários: LimiteCalculatorService
- [ ] Testes unitários: ParcelamentoService (criar/cancelar)
- [ ] Testes unitários: idempotência
- [ ] Testes integração: criar parcelamento end-to-end
- [ ] **Checkpoint:** todos testes passam

### ETAPA 10 — Frontend (Tipos e Services)
- [ ] `src/types/Parcelamento.ts`
- [ ] `src/types/ParcelaTransacao.ts`
- [ ] `src/types/Fatura.ts` (atualizado com 3 flags)
- [ ] `src/services/ParcelamentoService.ts`
- [ ] **Checkpoint:** `npm run build` verde

### ETAPA 11 — Frontend (Componentes)
- [ ] `src/pages/Parcelamentos/index.tsx`
- [ ] `src/pages/Parcelamentos/[id].tsx`
- [ ] `src/components/ParcelamentoForm.tsx`
- [ ] `src/components/ParcelamentoCard.tsx`
- [ ] `src/components/FaturaStatusBadge.tsx`
- [ ] `src/components/CancelarParcelamentoModal.tsx`
- [ ] `src/components/PagarParcelaModal.tsx`
- [ ] **Checkpoint:** `npm run dev` exibe nova tela sem erro

### ETAPA 12 — Atualização de docs e fechamento
- [ ] `docs/DATABASE.md`
- [ ] `docs/FLOWS.md`
- [ ] `docs/STANDARDS.md`
- [ ] `CLAUDE.md` (se padrão mudou)
- [ ] `PROGRESS.md` — mover #1 para "Resolvidos"
- [ ] `ISSUES.md` — marcar #1 como concluído
- [ ] Commit final + merge para main

---

## 📊 Progresso

```
[████▌░░░░░░░] 4.5/12 etapas concluídas (5a feito; 5b adiado pra após ETAPAS 6-9)
```

---

## 📜 Histórico de sessões

### Sessão 2 — 2026-05-08
- **Etapas concluídas:** nenhuma (ETAPA 3 parcial)
- **Etapas iniciadas (incompletas):** ETAPA 3 — 3 de 5 arquivos editados, sem commit, build não validado
- **Arquivos com mudanças NÃO commitadas:**
  - `ControleFinanceiro.Api/Domain/Entities/Fatura.cs` (7 campos novos + nav, Status `[Obsolete]`)
  - `ControleFinanceiro.Api/Domain/Entities/CartaoCredito.cs` (`LimiteTotal` novo, `Limite` `[Obsolete]`, nav Parcelamentos)
  - `ControleFinanceiro.Api/Domain/Entities/Recorrente.cs` (ContaId nullable, +CartaoCreditoId, +3 campos auditoria)
  - `IMPLEMENTATION_STATE.md` (este arquivo)
- **Estado do build:** NÃO validado — provavelmente verde (única atribuição que importa: `RecorrenteService.cs:143 r.ContaId = dto.ContaId` continua válida com nullable). Mas há risco de algum service quebrar em runtime se assume Recorrente.ContaId sempre presente.
- **Próxima ação ao retomar:**
  1. (manual) `cd /e/VSCode/controle-financeiro/ControleFinanceiro.Api && dotnet build` — confirmar build verde com 3 arquivos modificados. Se vermelho, colar erros e ajustar.
  2. Editar `Domain/Entities/Transacao.cs` — adicionar campos novos conforme `ARQUITETURA_PARCELAMENTO.md` § "Transacao (Mudanças)". Manter `Parcelas`, `NumeroParcela`, `TransacaoOrigemId` (remoção é ETAPA 5).
  3. Editar `Infrastructure/AppDbContext.cs` — adicionar 3 DbSets novos + configurar delete behaviors em `OnModelCreating`.
  4. (manual) `dotnet build` — confirmar verde após Transacao + AppDbContext.
  5. Commit único pra fechar ETAPA 3: `feat(parcelamento): modificar Fatura/CartaoCredito/Recorrente/Transacao + AppDbContext pra suportar novo modelo`.
- **Notas:**
  - Saída antes de mexer em `Transacao.cs` foi proposital — Transacao tem 14+ campos novos a adicionar e era arriscado parar no meio dele.
  - AppDbContext intocado: nada quebra ainda porque EF Core descobre relations sozinho via convention quando entidades têm navs configuradas. Mas delete behaviors precisam ser explicitados na ETAPA 3 antes de fazer migration na ETAPA 4.

### Sessão 1 — 2026-05-08
- **Etapas concluídas:** 0, 1, 2
- **Etapas iniciadas (incompletas):** nenhuma
- **Commits da sessão (na branch `feature/1-parcelamento-flexivel`):**
  - `5d33241` — `docs(parcelamento): adicionar arquitetura + implementation state + UX + prompt de sessao`
  - *(ETAPA 1)* `feat(parcelamento): adicionar 6 enums novos (EstadoCicloFatura, EstadoPagamentoFatura, StatusParcela, StatusTransacao, TipoParcelamento, FinancialEventType)`
  - `27ba211` — `feat(parcelamento): adicionar entidades Parcelamento, ParcelaTransacao, FinancialEventLog`
  - *(opcional pós-sessão)* `chore: atualizar implementation state — fim da sessão 1`
- **Estado do build:** verde (validado pelo usuário após ETAPAS 0, 1, 2)
- **Próxima ação ao retomar (ETAPA 3):**
  1. Modificar `Domain/Entities/Fatura.cs` — adicionar `EstadoCiclo` (enum), `EstadoPagamento` (enum), `EstaAtrasada` (bool), `JurosDeMora` (decimal default 0), `Multa` (decimal default 0), `DataFechamentoEfetiva` (DateTime?), `DataPagamentoTotal` (DateTime?). MANTER `Status` (StatusFatura) por ora — só remover na ETAPA 5. Spec: `ARQUITETURA_PARCELAMENTO.md` § "Fatura (Mudanças)".
  2. Modificar `Domain/Entities/CartaoCredito.cs` — adicionar propriedade `LimiteTotal` (decimal). MANTER `Limite` por ora — só remover na ETAPA 5. Limites Bloqueado/Disponível NÃO são persistidos (calculados em LimiteCalculatorService — ETAPA 6). Spec: § "CartaoCredito (Mudanças)".
  3. Modificar `Domain/Entities/Recorrente.cs` — tornar `ContaId` nullable, adicionar `CartaoCreditoId` (Guid?, com nav), `CanceladoEm` (DateTime?), `MotivoCancelamento` (string? max 400), `CriadoEm` (DateTime). Validação ContaId XOR CartaoCreditoId fica em RecorrenteService (não no domínio). Spec: § "Recorrente (alterações)".
  4. Modificar `Domain/Entities/Transacao.cs` — adicionar `ParcelamentoId` (Guid?, nav), `ParcelaTransacaoId` (Guid?, nav), `StatusTransacao` (enum, default Executado pra retrocompat), `EhPagamentoFatura` (bool default false), `FaturaPagaId` (Guid?, nav opcional), `Ativo` (bool default true), `CanceladoEm`, `MotivoCancelamento`, `CriadoEm`. MANTER `Parcelas`, `NumeroParcela`, `TransacaoOrigemId` — remoção fica pra ETAPA 5. Spec: § "Transacao (Mudanças)".
  5. Atualizar `Infrastructure/AppDbContext.cs` — adicionar `DbSet<Parcelamento>`, `DbSet<ParcelaTransacao>`, `DbSet<FinancialEventLog>`. Configurar delete behavior em `OnModelCreating`: `Parcelamento → ParcelaTransacao` cascade; `Fatura → ParcelaTransacao` restrict; `Parcelamento → Transacao (FaturaPagaId, ParcelamentoId, ParcelaTransacaoId)` restrict (não mexer em transações ao soft-deletar parcelamento).
  6. Checkpoint: `dotnet build` verde + commit `feat(parcelamento): modificar Fatura/CartaoCredito/Recorrente/Transacao + AppDbContext pra suportar novo modelo`.
  7. NÃO criar migration ainda — isso é ETAPA 4.
- **Notas:**
  - Caveman skill ativada (full mode).
  - Trabalho aconteceu via mix sandbox-Linux (Read/Write/Edit) + comandos manuais do usuário no Git Bash. Sandbox sem `dotnet`/`npm` e sem permissão de tocar `.git/` no mount Windows → usuário roda build/git, eu escrevo código.
  - Avalia opção computer-use foi descartada: terminais são tier "click" (sem input de teclado) → não vale pra loop dev.
  - 87 arquivos `modified` em `main` (line endings CRLF↔LF do mount) ainda intocados; ignorar até sessão dedicada de normalização.
  - DESIGN_SYSTEM.md e `controle-financeiro.web/src/pages/DesignSystem/` continuam untracked — fora do escopo Issue #1.

<!--
Template para entradas:

### Sessão N — YYYY-MM-DD
- **Etapas concluídas:** X, Y
- **Etapas iniciadas (incompletas):** Z (parou em <ponto exato>)
- **Branch após sessão:** <hash do último commit>
- **Estado do build:** verde/vermelho
- **Próxima ação:** <o que fazer ao retomar>
- **Notas:** <decisões tomadas, surpresas, etc>
-->
