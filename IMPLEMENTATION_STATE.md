# 🚧 IMPLEMENTATION_STATE — Issue #1 Parcelamento Flexível

**Atualizado em:** 2026-05-08
**Branch:** `feature/1-parcelamento-flexivel` @ commit `27ba211`
**Etapa atual:** 3 — Modificar entidades existentes (próxima a iniciar)
**Última sessão:** Sessão 1 — 2026-05-08 (ETAPAS 0, 1, 2 fechadas)

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
- [ ] `Fatura.cs` — adicionar EstadoCiclo, EstadoPagamento, EstaAtrasada, JurosDeMora, Multa, DataFechamentoEfetiva, DataPagamentoTotal; manter Status (deprecated, removido na ETAPA 5)
- [ ] `CartaoCredito.cs` — rename Limite → LimiteTotal (manter coluna antiga até ETAPA 5)
- [ ] `Recorrente.cs` — tornar ContaId nullable, adicionar CartaoCreditoId, CanceladoEm, MotivoCancelamento, CriadoEm
- [ ] `Transacao.cs` — adicionar ParcelamentoId, ParcelaTransacaoId, StatusTransacao, EhPagamentoFatura, FaturaPagaId, Ativo, CanceladoEm, MotivoCancelamento, CriadoEm; manter Parcelas/NumeroParcela/TransacaoOrigemId (removido na ETAPA 5)
- [ ] **Checkpoint:** `dotnet build` verde + AppDbContext atualizado

### ETAPA 4 — Migration de schema (aditiva)
- [ ] `dotnet ef migrations add AddParcelamentoSchema`
- [ ] Verificar SQL gerado é puramente aditivo (não dropa nada)
- [ ] `dotnet ef database update`
- [ ] **Checkpoint:** `dotnet run` sobe sem erro; Swagger acessível

### ETAPA 5 — Migration de data + cleanup
- [ ] `dotnet ef migrations add MigrateLegacyParcelamentoData`
- [ ] Migrar dados: StatusFatura antigo → 3 flags novas
- [ ] Drop colunas legadas (Parcelas, NumeroParcela, TransacaoOrigemId, Status, Limite)
- [ ] `dotnet ef database update`
- [ ] **Checkpoint:** dados existentes sobreviveram a migração

### ETAPA 6 — Serviços
- [ ] `Services/FinancialEventLogService.cs`
- [ ] `Services/LimiteCalculatorService.cs` (LimiteBloqueado/Disponivel derivados)
- [ ] `Services/ParcelamentoService.cs` (Criar, Cancelar, Listar, Detalhe)
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
[██░░░░░░░░░░] 2/12 etapas concluídas
```

---

## 📜 Histórico de sessões

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
