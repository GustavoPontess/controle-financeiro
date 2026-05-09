# 🚧 IMPLEMENTATION_STATE — Issue #1 Parcelamento Flexível

**Atualizado em:** 2026-05-09
**Branch:** `feature/1-parcelamento-flexivel`
**Etapa atual:** 6 — PARCIAL (6 de 8 sub-itens: FinancialEventLogService + LimiteCalculatorService + ParcelamentoService + ParcelaTransacaoService + adapt FaturaService [3 flags] + DI prontos; falta adapt RecorrenteService + middleware idempotência)
**Última sessão:** Sessão 4 — 2026-05-09 (ParcelaTransacaoService + DTOs + adapt FaturaService 3 flags; build verde)

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
- [x] DI: ambos + ParcelamentoService registrados como Scoped em `Program.cs`
- [x] `Services/ParcelamentoService.cs` (Criar, Cancelar, Listar, Detalhe — coração do issue, transação ACID + idempotência + FinancialEventLog) + DTOs em `DTOs/Parcelamento/` (CriarParcelamentoDto, CancelarParcelamentoDto, CancelamentoResultadoDto, LimiteSnapshotDto, ParcelamentoDto, ParcelamentoDetalheDto, ParcelaDto, ProximaParcelaDto). PIX juros simples (placeholder MVP). Reaproveita `FaturaService.ObterOuCriarFaturaAsync`. Commit `ef9db19`.
- [x] `Services/ParcelaTransacaoService.cs` (PagarAntecipado, Cancelar) + `DTOs/ParcelaTransacao/` (PagarParcelaDto, FaturaAtualizadaDto, PagarParcelaResultadoDto, CancelarParcelaDto, CancelarParcelaResultadoDto) — Sessão 4.
- [x] Adaptar `FaturaService.cs` para 3 flags — Sessão 4: PagarFaturaAsync usa EstadoPagamento; PreencherDto expõe 3 flags; CalcularValorTotal inclui ParcelasTransacao; queries incluem ParcelasTransacao.
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
[████▌▓▓▓░░░░] 4.5 + ~75% da ETAPA 6 / 12 etapas concluídas
```

---

## 📜 Histórico de sessões

### Sessão 4 — 2026-05-09 (ParcelaTransacaoService + adapt FaturaService)
- **Etapas concluídas:** nenhuma fechada inteira; ETAPA 6 avançou de ~50% para ~75% (6 de 8 sub-itens prontos)
- **Etapas iniciadas (incompletas):** ETAPA 6 segue aberta — falta RecorrenteService adapt e middleware idempotência
- **Commits a fazer:**
  - `feat(parcelamento): adicionar ParcelaTransacaoService (PagarAntecipado/Cancelar) + DTOs + DI`
  - `feat(parcelamento): adaptar FaturaService para 3 flags (EstadoPagamento, CalcularValorTotal, ParcelasTransacao)`
  - `chore: atualizar implementation state — fim da sessão 4`
- **Estado do build:** verde (usuário rodou `dotnet build` pós-ParcelaTransacaoService; adaptar FaturaService precisa de novo build)
- **Arquivos criados/editados:**
  - `DTOs/ParcelaTransacao/PagarParcelaDto.cs` — PagarParcelaDto + FaturaAtualizadaDto + PagarParcelaResultadoDto
  - `DTOs/ParcelaTransacao/CancelarParcelaDto.cs` — CancelarParcelaDto + CancelarParcelaResultadoDto
  - `Services/ParcelaTransacaoService.cs` — PagarAntecipadoAsync + CancelarAsync (ACID, idempotência, FinancialEventLog)
  - `Program.cs` — AddScoped<ParcelaTransacaoService>()
  - `DTOs/Fatura/FaturaDto.cs` — adicionou EstadoCiclo, EstadoPagamento, EstaAtrasada, DataPagamentoTotal
  - `Services/FaturaService.cs` — PagarFaturaAsync usa EstadoPagamento; PreencherDto expõe 3 flags + #pragma legacy Status; CalcularValorTotal (static helper) inclui ParcelasTransacao; 3 queries incluem Include(ParcelasTransacao)
- **Decisões:**
  - Transacao de pagamento de parcela usa FaturaPagaId (não FaturaId) → não polui total da fatura
  - CalcularValorTotal = legacy UsadoComoCredito+Ativo + ParcelasTransacao — sem dupla contagem
  - Saldo da conta: SUM Receitas - SUM Despesas (Ativo+Executado) — conforme convenção do projeto
  - LimiteLiberado emitido em PagarAntecipado E Cancelar parcela (parcela sai de Pendente → sai do LimiteBloqueado)
  - `#pragma warning disable CS0618` envolve acesso a `Status` legado em PreencherDto
- **Próxima ação ao retomar (ETAPA 6 — RecorrenteService):**
  1. Adaptar `RecorrenteService.cs` para janela 3 meses + soft delete + ContaId XOR CartaoCreditoId nullable
     - `ContaId` já é nullable (ETAPA 3). Service precisa validar XOR (ContaId OU CartaoCreditoId, não ambos, não nenhum)
     - Janela de 3 meses: ao criar Recorrente, gerar apenas 3 transações futuras com StatusTransacao=Previsao (não infinito)
     - Soft delete: ao cancelar Recorrente, marcar `CanceladoEm` + `MotivoCancelamento` + cancelar transações Previsao futuras (Ativo=false)
     - Expandir jobs futuros vão gerar mais transações conforme janela avança (ETAPA 8)
  2. Middleware/atributo de Idempotência (`[Idempotent]`) — extrair `Idempotency-Key` do header HTTP e passar pra service
     - Atualmente idempotencyKey vem no body do DTO. Refatorar pra extrair do header e injetar via IHttpContextAccessor ou action filter
     - Manter compatibilidade: se header presente, sobrescreve; se DTO também tem, usar header
  3. Checkpoint final ETAPA 6: `dotnet build` verde + commits dos sub-itens acima
- **Notas:**
  - Contexto encerrou em ~85%+ — paramos antes de RecorrenteService para evitar estado quebrado
  - Caveman skill ativa (full mode)
  - Sandbox sem dotnet/npm/git — usuário roda no Git Bash

### Sessão 3 — 2026-05-09 (ParcelamentoService — coração do Issue #1)
- **Etapas concluídas:** nenhuma fechada inteira; ETAPA 6 avançou de ~25% pra ~50% (4 de 8 sub-itens prontos)
- **Etapas iniciadas (incompletas):** ETAPA 6 segue aberta — falta ParcelaTransacaoService, adapt FaturaService/RecorrenteService, middleware de idempotência
- **Commits da sessão (na branch `feature/1-parcelamento-flexivel`):**
  - `ef9db19` — `feat(parcelamento): adicionar ParcelamentoService (Criar/Cancelar/Listar/Detalhe) + DTOs + DI`
  - *(opcional pós-sessão)* `chore: atualizar implementation state — fim da sessão 3`
- **Estado do build:** verde — 18 warnings obsolete legacy (mesmos da sessão 2, zero warnings novos do código novo). Validado por `dotnet build` no Git Bash do usuário.
- **Arquivos criados (3) / editados (1):**
  - `DTOs/Parcelamento/CriarParcelamentoDto.cs` — CriarParcelamentoDto, CancelarParcelamentoDto, CancelamentoResultadoDto, LimiteSnapshotDto
  - `DTOs/Parcelamento/ParcelamentoDto.cs` — ParcelamentoDto, ProximaParcelaDto, ParcelamentoDetalheDto, ParcelaDto
  - `Services/ParcelamentoService.cs` — ~440 linhas; 4 métodos públicos + `RatearValor`/`MontarDto`/`MontarCancelamentoResultadoAsync` privados; injeta `AppDbContext`, `FinancialEventLogService`, `LimiteCalculatorService`, `FaturaService`
  - `Program.cs` — `builder.Services.AddScoped<ParcelamentoService>()` adicionado ao bloco "Issue #1"
- **Decisões / nuances:**
  - **Reaproveita** `FaturaService.ObterOuCriarFaturaAsync(cartaoId, dataVencimentoParcela, usuarioId)` em vez de duplicar lógica de período/fechamento. Cada parcela tem `DataVencimento = (primeiraParcelaMes + i meses, dia=DataCompra.Day clampado)` e a fatura correspondente é resolvida pelo `FaturaService.CalcularPeriodo(diaTransacao, cartao.DiaFechamento)`.
  - **Idempotência por tipo de evento:** `BuscarPorIdempotencyKeyAsync` é genérica. CriarAsync filtra `prev.Tipo == ParcelamentoCriado && entidade == "Parcelamento"`; CancelarAsync filtra `prev.Tipo == ParcelamentoCancelado && entidadeId == parcelamentoId`. Replay reconstrói resposta via `ObterDetalheAsync` / `MontarCancelamentoResultadoAsync`.
  - **PIX juros (MVP):** juros simples `principal × (taxa/100) × N`. IOF = 0 placeholder (parcela.IOF=null). Documentado no doc-comment + state que valor real depende de Open Finance.
  - **Rateio centavos:** `RatearValor(total, n)` distribui em N com 2 casas; resto vai pra última parcela. Mesmo padrão pra Valor (principal) e ValorComJuros (PIX).
  - **Soft delete em CancelarAsync:** marca `Parcelamento.Ativo=false` + parcelas Pendentes viram Cancelada. Pagas preservadas; `requerEstorno=true` na response sinaliza pra UI sugerir transação de estorno (não automático).
  - **Tipo do parcelamento:** restrito a `CompraParcelada | PIXCredito` neste fluxo. `Recorrente` rejeitado (segue fluxo próprio em RecorrenteService — fora do escopo desta sessão).
  - **Validação de Categoria:** aceita `Despesa` ou `Ambas` (parcelamento sempre é saída).
  - **Conflito de namespaces:** `ControleFinanceiro.Api.DTOs.Parcelamento` (namespace) vs `ControleFinanceiro.Api.Domain.Entities.Parcelamento` (tipo) — não colide. C# resolve `Parcelamento` pra tipo (entidade) e `using DTOs.Parcelamento` traz só os tipos DENTRO do namespace pro escopo.
  - **Transação ACID:** `BeginTransactionAsync` + `try/catch` com `Rollback` em exceção. `FaturaService.ObterOuCriarFaturaAsync` chama `SaveChangesAsync` interno, mas tudo fica capturado pela transação aberta até `Commit` final.
- **Não feito (próximas sessões):**
  - `ParcelaTransacaoService` (PagarAntecipado, Cancelar individual) — Fluxo 2 da arquitetura
  - Adaptar `FaturaService.cs` pra 3 flags + remover usos legacy de `Status`
  - Adaptar `RecorrenteService.cs` pra janela de 3 meses + soft delete + ContaId XOR CartaoCreditoId
  - Middleware/atributo `[Idempotent]` (extrair Idempotency-Key do header HTTP — atualmente o service espera idempotencyKey no body do DTO)
  - ETAPAS 7-12 (Controllers, Hangfire, Testes, Frontend, docs)
- **Próxima ação ao retomar (ETAPA 6 — `ParcelaTransacaoService.cs`):**
  Estrutura sugerida:
  1. **DTOs** em `DTOs/ParcelaTransacao/`:
     - `PagarParcelaDto` — `{ contaPagamentoId: Guid, dataPagamento: DateTime?, idempotencyKey: string }`
     - `PagarParcelaResultadoDto` — `{ parcelaId, status (Paga), pagoEm, faturaAtualizada (id, estadoPagamento, valorPago, valorRestante), novoLimite: LimiteSnapshotDto }`
     - `CancelarParcelaDto` — `{ motivo, idempotencyKey }` (cancelamento individual de UMA parcela específica — não confundir com cancelar parcelamento todo)
  2. **`Services/ParcelaTransacaoService.cs`** — registrar Scoped em Program.cs. Métodos:
     - `PagarAntecipadoAsync(parcelaId, dto, usuarioId)` — Fluxo 2 da arquitetura:
       - Idempotência (mesmo padrão de ParcelamentoService)
       - Validações: parcela existe + pertence ao usuário + Status==Pendente + Parcelamento.Ativo + Conta.UsuarioIdProprietario + Saldo>=parcela.Valor (calcular SaldoConta via `Receitas - Despesas` em Transacoes Executado+Ativo) + Fatura está em (Aberta,*,*) ou (Fechada,NaoPago/Parcial,*)
       - Transação ACID: UPDATE Parcela.Status=Paga+PagoEm; INSERT Transacao(EhPagamentoFatura=true, FaturaPagaId=fatura.Id, ContaId=dto.contaPagamentoId, Valor=parcela.Valor, Tipo=Despesa, StatusTransacao=Executado, Ativo=true); UPDATE Fatura.ValorPago+=parcela.Valor; recalc EstadoPagamento (NaoPago/Parcial/Pago); se EstadoPagamento==Pago, marcar DataPagamentoTotal=now e zerar EstaAtrasada
       - FinancialEventLog: ParcelaPaga + LimiteLiberado + (FaturaPagaTotal ou FaturaPagaParcial conforme caso)
       - Retornar PagarParcelaResultadoDto
     - `CancelarAsync(parcelaId, dto, usuarioId)` — cancelamento individual:
       - Idempotência
       - Validações: parcela existe + Status==Pendente + Parcelamento.Ativo
       - Transação: UPDATE Parcela.Status=Cancelada+CanceladoEm+MotivoCancelamento (NÃO cancela parcelamento inteiro); FinancialEventLog ParcelaCancelada + LimiteLiberado
       - Retornar resultado com novo LimiteSnapshot
  3. **Helper:** método privado `RecalcularEstadoPagamentoFatura(faturaId)` — soma ValorTotal das transações da fatura (UsadoComoCredito=true) + parcelas Pagas; compara com ValorPago atualizado. Talvez extrair em helper compartilhado entre Parcela/Fatura services no futuro.
  4. **Checkpoint:** `dotnet build` verde + commit `feat(parcelamento): adicionar ParcelaTransacaoService (PagarAntecipado/Cancelar) + DTOs + DI`
- **Notas:**
  - Caveman skill ativa (full mode) — usuário não pediu pra desligar.
  - Sandbox Linux continua sem `dotnet`/`npm` e sem permissão pra `.git/index.lock` — usuário roda build/git no Git Bash, eu escrevo código.
  - State file ainda menciona "87 arquivos com diff exclusivamente CRLF↔LF" — pendência de sessão dedicada de normalização. Não bloqueia.
  - Idempotência via header HTTP ainda não foi feita — atualmente service espera campo `idempotencyKey` dentro do DTO. Quando middleware for criado (ainda na ETAPA 6), refatorar para extrair do header `Idempotency-Key` e passar pra service. Por ora aceitar via DTO mantém compatibilidade.


- **Trabalho de housekeeping** (sem avançar etapas):
  - `.gitignore` enriquecido: ignora `*.db-wal`, `*.db-shm`, `*.db.backup-*`, `.fuse_hidden*`, `.claude/settings.local.json`
  - `.claude/settings.local.json` removido do tracking (`git rm --cached`)
  - 7 arquivos com diff REAL (que VS Code mostrava sem filtro) commitados em 3 commits temáticos:
    - `7037a19` — chore .gitignore (sqlite-wal/backups/fuse) [feito antes]
    - `a80bc85` — feat(design) DESIGN_SYSTEM.md + showcase [feito antes]
    - `e4e72c1` — chore .gitignore settings.local.json
    - `bec1a5e` — feat(web) integrar página Design System (package.json, package-lock.json, AppRoutes.tsx)
    - `0f024b5` — chore: fix JSON dev '}' faltante + suprimir CS1591 + completar docs/README
- **Estado pendente:** ~80 arquivos com mudanças exclusivamente de line endings (CRLF↔LF do mount Linux). `git diff -w` = vazio. VS Code já filtra esses por config. Resolver em sessão dedicada com `.gitattributes` (`* text=auto eol=lf`) + `git add --renormalize .` num commit único.
- **Próxima ação:** ETAPA 6 segue de onde parou — `ParcelamentoService` (ver "Próxima ação ao retomar" abaixo).

### Sessão 2 — 2026-05-09
- **Etapas concluídas:** 3, 4, 5a + 25% da ETAPA 6
- **Etapas iniciadas (incompletas):** ETAPA 6 — 2 de 8 sub-itens prontos
- **Commits da sessão (na branch `feature/1-parcelamento-flexivel`):**
  - `bd4c45e` — `feat(parcelamento): modificar Fatura/CartaoCredito/Recorrente/Transacao + AppDbContext pra suportar novo modelo`
  - *(ETAPA 4)* `feat(parcelamento): migration aditiva AddParcelamentoSchema (3 tabelas novas + colunas em Transacoes/Faturas/CartoesCredito/Assinaturas)`
  - *(ETAPA 5a)* `feat(parcelamento): migration de dados legacy (Status->3 flags, CriadoEm preservado, LimiteTotal copiado)`
  - *(ETAPA 6 parcial)* `feat(parcelamento): adicionar FinancialEventLogService + LimiteCalculatorService + DI`
  - *(opcional pós-sessão)* `chore: atualizar implementation state — fim da sessão 2`
- **Estado do build:** verde (validado pelo usuário após cada checkpoint)
- **Estado do banco:** schema novo aplicado + dados legacy migrados (5 faturas Aberta + 1 Paga mapeadas certinho, 8 transações com CriadoEm=Data e StatusTransacao=Executado, 1 cartão Nubank Gold com LimiteTotal=12000)
- **Backups locais (untracked, na pasta da API):**
  - `controlefinanceiro.db.backup-pre-etapa4`
  - `controlefinanceiro.db.backup-pre-etapa5a`
- **Próxima ação ao retomar (ETAPA 6 — `ParcelamentoService.cs`):**
  Esse é o coração do issue — 4 métodos públicos, ~300-400 linhas. Deve consumir uma sessão inteira sozinho. Estrutura sugerida:
  
  1. **DTOs primeiro** em `DTOs/Parcelamento/`:
     - `CriarParcelamentoDto` — `{ descricao, valor, tipo (TipoParcelamento), cartaoCreditoId, dataCompra, parcelas, primeiraParcelaMes (yyyy-MM), categoriaId?, taxaJuroMensal? (PIX), idempotencyKey }`
     - `CancelarParcelamentoDto` — `{ motivo, idempotencyKey }`
     - `ParcelamentoDto` — visão de listagem (id, descricao, tipo, qtdParcelas, parcelasPagas, valorOriginal, valorPago, valorRestante, proximaParcela{...}, ativo)
     - `ParcelamentoDetalheDto` — visão completa: tudo do anterior + array de `ParcelaDto { id, numero, dataVencimento, valor, valorComJuros, status, faturaId, faturaMesReferencia, pagoEm, canceladoEm }`
  
  2. **`Services/ParcelamentoService.cs`** — registrar Scoped no `Program.cs`. Métodos:
     - `CriarAsync(CriarParcelamentoDto, usuarioId)` — fluxo conforme `ARQUITETURA_PARCELAMENTO.md` § "Fluxo 1: Criar Parcelamento":
       - Idempotência: `FinancialEventLogService.BuscarPorIdempotencyKeyAsync(usuarioId, dto.idempotencyKey)` — se achar, retornar resultado anterior reconstruído
       - Validações: Valor>0, 2≤parcelas≤36, dataCompra<=hoje, primeiraParcelaMes>=mês atual, cartão existe + TemCredito + pertence ao usuário, categoria compatível com Tipo (se informada). PIX: 1.99% ≤ TaxaJuroMensal ≤ 11.99%, calcular ValorComJuros (juros simples por enquanto, IOF≈0.0038/dia × dias até vencimento — placeholder MVP)
       - `LimiteCalculatorService.CalcularAsync(cartaoId, usuarioId)` — checar `disponivel >= valorBloqueado` (valorBloqueado = ValorComJuros ?? ValorTotal)
       - Numa única `_context.Database.BeginTransactionAsync()`:
         - INSERT Parcelamento
         - Calcular N datas de vencimento (primeiraParcelaMes + i meses, dia = dia da DataCompra OU DiaVencimento do cartão — checar spec)
         - Pra cada parcela: `ObterOuCriarFatura(cartaoId, mesVencimento)` (helper a criar — provavelmente reaproveitar lógica de `FaturaService` se existir; se não, criar privado neste service)
         - INSERT N × ParcelaTransacao (Status=Pendente, FaturaId=resolvido)
         - 2 × `FinancialEventLog.Registrar()`: `ParcelamentoCriado` + `LimiteBloqueado` (mesmo `correlationId`); payload do primeiro contém `idempotencyKey`
         - SaveChanges + Commit
       - Retornar `ParcelamentoDetalheDto`
     - `CancelarAsync(parcelamentoId, CancelarParcelamentoDto, usuarioId)` — fluxo § "Fluxo 3":
       - Idempotência igual ao criar
       - Validar Ativo=true, motivo não-vazio
       - Numa transação: UPDATE Parcelamento(Ativo=false, CanceladoEm, MotivoCancelamento), UPDATE ParcelasTransacao SET Status=Cancelada WHERE ParcelamentoId=@id AND Status=Pendente (preservar Pagas), `FinancialEventLog.Registrar(ParcelamentoCancelado + ParcelaCancelada×N + LimiteLiberado)`
       - Retornar `{ canceladas: int, jaPagas: int, requerEstorno: bool, novoLimite: LimiteSnapshot }`
     - `ListarAsync(usuarioId, ativo?: bool)` — query Parcelamentos do user com Include(Parcelas), montar `ParcelamentoDto` de cada (parcelasPagas = COUNT Status=Paga, valorPago = SUM, valorRestante = ValorTotal - valorPago, proximaParcela = primeira Pendente ordenada por DataVencimento)
     - `ObterDetalheAsync(id, usuarioId)` — Include Parcelas + Fatura, montar `ParcelamentoDetalheDto`
  
  3. **Helper `ObterOuCriarFaturaAsync`** — provavelmente injetar `FaturaService` se já tem método público, OU criar privado neste service (consultar existência de Fatura pra (CartaoId, mês) e criar se não existir). Verificar `FaturaService.cs` antes de duplicar lógica.
  
  4. **NÃO mexer ainda em** `ParcelaTransacaoService`, `FaturaService` adapt, `RecorrenteService` adapt, middleware de idempotência — esses ficam pra ETAPA 6 sessões 4+. ParcelamentoService sozinho já é uma sessão.
  
  5. **Checkpoint final:** `dotnet build` verde + commit `feat(parcelamento): adicionar ParcelamentoService (Criar/Cancelar/Listar/Detalhe) + DTOs + DI`

- **Notas:**
  - ETAPA 5b (cleanup das colunas legacy + remoção das `[Obsolete]`) ADIADA pra após ETAPAS 6-9 conforme combinado. Não fazer agora — code legacy ainda referenciado em FaturaService/CartaoCreditoService/TransacoesController.
  - 18 warnings obsolete continuam aparecendo a cada `dotnet build` — esperados, vão sumir na ETAPA 5b.
  - `FinancialEventLogService.BuscarPorIdempotencyKeyAsync` usa `.Contains()` em string serializada do payload — funciona em SQLite mas é O(N). Se virar problema de performance em prod, normalizar idempotencyKey pra coluna dedicada na tabela. Por ora ok pra MVP.
  - `LimiteCalculatorService.CalcularTodosDoUsuarioAsync` faz N+1 queries (uma por cartão). Otimizar quando virar gargalo.

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
