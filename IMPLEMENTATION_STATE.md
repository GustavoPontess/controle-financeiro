# 🚧 IMPLEMENTATION_STATE — Issue #1 Parcelamento Flexível

**Atualizado em:** 2026-05-08
**Branch:** `feature/1-parcelamento-flexivel` (criada, sem commits ainda)
**Etapa atual:** 0 — BLOQUEADA por lock + build não validado
**Última sessão:** Sessão 1 — 2026-05-08

⚠️ **AÇÃO MANUAL DO USUÁRIO ANTES DE RETOMAR:**
1. PowerShell: `Remove-Item E:\VSCode\controle-financeiro\.git\index.lock -Force`
2. PowerShell: `cd E:\VSCode\controle-financeiro\ControleFinanceiro.Api && dotnet build` — confirmar verde
3. PowerShell: `cd E:\VSCode\controle-financeiro\controle-financeiro.web && npm run build` — confirmar verde
4. Decidir o que fazer com mudanças não-commitadas em `main` (87 arquivos, mas `git diff -w` mostra que são puramente line endings CRLF↔LF — recomendado normalizar com `.gitattributes` ou `git add --renormalize .` em sessão dedicada)

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
- [ ] `Domain/Enums/EstadoCicloFatura.cs`
- [ ] `Domain/Enums/EstadoPagamentoFatura.cs`
- [ ] `Domain/Enums/StatusParcela.cs`
- [ ] `Domain/Enums/StatusTransacao.cs`
- [ ] `Domain/Enums/TipoParcelamento.cs`
- [ ] `Domain/Enums/FinancialEventType.cs`
- [ ] **Checkpoint:** `dotnet build` verde

### ETAPA 2 — Entidades novas
- [ ] `Domain/Entities/Parcelamento.cs`
- [ ] `Domain/Entities/ParcelaTransacao.cs`
- [ ] `Domain/Entities/FinancialEventLog.cs`
- [ ] **Checkpoint:** `dotnet build` verde

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
[░░░░░░░░░░░░] 0/12 etapas concluídas
```

---

## 📜 Histórico de sessões

### Sessão 1 — 2026-05-08
- **Etapas concluídas:** nenhuma
- **Etapas iniciadas (incompletas):** ETAPA 0 — branch criada (`feature/1-parcelamento-flexivel`), commit dos docs do issue (`ARQUITETURA_PARCELAMENTO.md`, `IMPLEMENTATION_STATE.md`, `PROMPT_NOVA_SESSAO.md`, `UX_PARCELAMENTO.md`) BLOQUEADO por `.git/index.lock` que o sandbox Linux não consegue remover (mount com restrição de filesystem do Windows).
- **Branch após sessão:** `feature/1-parcelamento-flexivel` em HEAD = main (sem novos commits)
- **Estado do build:** não validado (sandbox Linux não tem `dotnet`)
- **Próxima ação ao retomar:**
  1. (manual) Usuário remove `.git/index.lock` no PowerShell
  2. (manual) Usuário roda `dotnet build` e `npm run build` pra confirmar verde
  3. Commit dos 4 docs do issue (`docs(parcelamento): adicionar arquitetura + implementation state + UX + prompt de sessao`)
  4. Iniciar ETAPA 1 — criar 6 enums em `ControleFinanceiro.Api/Domain/Enums/` (EstadoCicloFatura, EstadoPagamentoFatura, StatusParcela, StatusTransacao, TipoParcelamento, FinancialEventType — assinaturas em `ARQUITETURA_PARCELAMENTO.md` § "ENUMS NOVOS E MODIFICADOS")
- **Notas:**
  - 87 arquivos aparecem `modified` em `main` — `git diff -w` retorna vazio → 100% diferenças de line ending (CRLF↔LF do mount Linux). Não é mudança real. Decidi NÃO commitar pra não poluir histórico. Recomendação: normalizar com `.gitattributes` em sessão dedicada (`* text=auto eol=lf`) e rodar `git add --renormalize .`.
  - DESIGN_SYSTEM.md e `controle-financeiro.web/src/pages/DesignSystem/` continuam untracked — não relacionados ao issue #1, deixei intocados.
  - Caveman skill ativada conforme PROMPT_NOVA_SESSAO §2.
  - Como sandbox Linux nunca terá `dotnet`/`npm`, todo checkpoint de build precisa ser manualmente confirmado pelo usuário a cada etapa daqui em diante.

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
