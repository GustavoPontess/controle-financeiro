---
tipo: arquivo histórico
origem: ROADMAP.md
arquivado_em: 2026-08-24
---

# ROADMAP — Concluído (arquivo)

**Itens `[x]` arquivados do `ROADMAP.md`** pra manter o backlog vivo enxuto (regra em
`PROMPT_NOVA_SESSAO.md` §9). Nada aqui está pendente — é histórico consultável do que já foi entregue.
Mantidos com o texto original. Agrupados pelas seções de origem.

> Complementa os outros arquivos de `docs/history/` (ISSUES/PROGRESS/IMPLEMENTATION_STATE por quarter).

---

## Lote 1 — quick-wins

- **1.2 Privacy toggle (ocultar saldo)** — olho global no navbar, `formatMoney` central, persiste em localStorage, mascara em toda tela. _(branch `feature/privacy-toggle-ocultar-saldo`)_
- **1.1 Filtros de transação ricos** ⭐ flagship — back (`Listar`+controller: contaId/cartaoId/valorMin-Max/status/ordenacao, 4 testes) + front (`PontesDrawer` de filtros na TransactionsPage + chips removíveis + badge de contagem + "Limpar"; service `ListTransactionsFilter`, 3 testes). Verificado ponta-a-ponta (valor ≥ R$100 → 20→9). _Despezzas + Pierre._
- **1.4 Orçamento no Dashboard** — decisão: NÃO criar entidade "salário+meta"; o `Orcamento` por-categoria já suporta orçamento geral (CategoriaId=null). Card "Orçamento do mês" (safe-to-spend estilo Monarch/YNAB): barra + "ainda pode gastar X" + CTA "Configurar"→`/limites`. Front puro, 2 testes. _Despezzas/Monarch._
- **1.3 Variação % vs mês anterior** (Dashboard) — cards "Entrou/Saiu" com delta % + seta colorida. Back: `DashboardDto.EntradasCaixaMesAnterior`/`SaidasCaixaMesAnterior`. _Pierre + Despezzas._

## Lote 2 — colaboração / família (o fosso)

- **2.2 Família REAL — rateio + settle-up** ⭐⭐ FOSSO — rateio (igualitário/proporcional/personalizado) em `RateioService`, balanço "quem deve a quem" + abate por acerto em `DespesaCompartilhadaService`, quitação em `AcertoService`, UI completa (PR #233). Idempotência + `FinancialEventLog` no PR #221.
- **2.1 Atribuir transação a um membro/responsável** — `Transacao.ResponsavelUsuarioId` (migration `AddResponsavelTransacao`); `AtribuirResponsavelAsync`; feed filtra por `responsavelId`; endpoint `PUT /despesas/{id}/responsavel`. Front: filtro + picker + nome visível. Back +5 / front +6. _Monarch._
- **2.4 Aprovação de despesa** — `Familia.LimiteAprovacao` + `Transacao.StatusAprovacao` + `AprovadoPor`/`Em`; compartilhar ≥ limite → Pendente; endpoints `PUT /limite-aprovacao`, `POST /despesas/{id}/aprovar|rejeitar`; migration `AddAprovacaoDespesa`; 12 testes (PR #224). Front: config de limite, badge de status, botões aprovar/rejeitar. +8 testes. Spec: `docs/features/familia/aprovacao-despesa.md`.

## Empréstimo compartilhado (módulo fechado)

- **Empréstimo compartilhado (bilateral, confirmação assimétrica)** — vínculo por convite (e-mail + token hasheado, padrão `ConviteFamilia`), autorização assimétrica por `Tipo` (BOLA-safe/OWASP API1:2023), soft-delete, `FinancialEventLog`, idempotência, landing `/convite/emprestimo/:token`. Spec: `docs/features/emprestimo-compartilhado/spec.md`. Back 323/323, front 317/317.
- **Empréstimo — pagamento com comprovante + aprovação do credor** — commitado `a9586a5`, pushado. Devedor solicita anexando comprovante (`Transacao` de saída); só o credor aprova (gera entrada real) ou rejeita; reenvio permitido. Trava de escolha explícita (radio) nos 3 pontos de risco de duplicar dinheiro. Entidade `EmprestimoPagamentoSolicitacao`, migration `AddPagamentoAprovacaoEmprestimo`. Spec: `pagamento-aprovacao.md`. Back 359/359, front 322/322.
- **Empréstimo — forma de pagamento (parcelas/juros/multa) + parcelas expansíveis** (2026-08-05) — `Emprestimo.FormaPagamento`/`TaxaJuroMensal`/`PercentualMultaAtraso`; entidade `EmprestimoParcela` (migration `AddParcelamentoEmprestimo`), 2-36 parcelas, juros simples, multa snapshotada. `SolicitarPagamentoEmprestimo` ganhou `ParcelaId?`. Endpoint `GET /emprestimos/{id}/parcelas`. Front: forma no criar, badge "Parcelado Nx", chevron expandindo parcelas. Spec: `parcelamento-e-agrupamento.md`. Back 373/373, front 325/325.
- **Empréstimo — unificar/consolidar** (2026-08-14) — credor propõe juntar 2+ empréstimos ativos da mesma contraparte num plano renegociado; nada muda nos originais até o devedor aceitar. Entidade `EmprestimoConsolidacaoProposta` + join `EmprestimoConsolidacaoItem` (migration `AddConsolidacaoEmprestimo`); no aceite os originais são revalidados, o novo é criado com a soma do restante, originais viram `Quitado` + auto-arquivados. Cadeia auditável (4 `FinancialEventType` + `correlationId` compartilhado). Endpoints candidatos/consolidar/consolidacoes/aceitar|recusar|cancelar. Front: card "Consolidar dívidas" + banner + modal. Back 415/415, front 345/345. **Achado de processo:** `npx tsc --noEmit` na raiz é no-op (só delega via `references`); usar sempre `npm run build`.
- **Empréstimo — motivo da rejeição** (2026-08-06) — `EmprestimoPagamentoSolicitacao.MotivoRejeicao` (migration `AddMotivoRejeicaoEmprestimo`); notificação e histórico mostram o motivo. Front: rejeitar virou modal com textarea. Back 375/375, front 326/326.
- **Empréstimo — juros/multa também pra À vista** (2026-08-08) — mesma regra flat do Parcelado, sobre `ValorTotal` — `Emprestimo.ValorComJuros`/`ValorComMulta` (migration `AddJurosMultaAVistaEmprestimo`), multa com snapshot. Front: campos Juros/Multa sempre visíveis. Back 378/378, front 328/328.
- **Empréstimo — "Registrar pagamento" unificado pra credor e devedor** (2026-08-08) — um endpoint só (`SolicitarPagamentoAsync`) decide por papel: devedor nasce `Pendente`, credor nasce `Aprovada`. `TransacaoComprovanteId` nullable (migration `TornarComprovanteOpcionalPagamentoEmprestimo`). `RegistrarPagamentoAsync`/rota `PATCH .../pagamento`/botão "$" antigos removidos. Front: 1 botão "Registrar pagamento" pros dois papéis. Spec: `pagamento-aprovacao.md` → "Unificação". Back 373/373, front 328/328.
- **Empréstimo — card "Vencido"** (2026-08-08) — `EmprestimoStatsDto.TotalAReceberVencido` (À vista vencido + parcelas Pendente vencidas). 4º `PontesStatCard`, tone danger. Back +2 testes.
- **`PontesDateInput` — popover vazava do modal / scroll lateral** (2026-08-08) — era `position: absolute` preso ao campo; corrigido pro padrão do `PontesSelect` (portal, `position: fixed` clampado em `[data-pontes-overlay-boundary]`, z-index 10010). Testado 1333px e 1024px.
- **Empréstimo — apagar empréstimo vinculado sem atividade** (2026-08-11) — `DeletarAsync` só bloqueia `Vinculado` com atividade real (`ValorPago>0`, parcela `Paga`, ou solicitação vinculada mesmo rejeitada); sem isso, apagar liberado. Editar campos ficou fora de escopo. Spec: `pagamento-aprovacao.md`. Back 380/380.
- **Empréstimo — aprovar/rejeitar do "Histórico" pra linha da parcela** (2026-08-12, 4 rodadas de redesign) — badge no card + botões ✓/✗ 24px na linha da parcela + badge "Aguardando aprovação" + histórico inline. Back: `EmprestimoParcelaDto.SolicitacaoPendenteId`. 2 bugs pegos por teste (`GetValueOrDefault`→`TryGetValue`; `ParcelaId` nunca mapeado no DTO). Lib ganhou `PontesButton variant="success"` e `PontesIconButton variant="success"/"danger"` + tamanho 24. Back 381/381, front 331/331.
- **Empréstimo — valor de pagamento não validava contra a parcela** (2026-08-12) — escolhido "auto-aplica em sequência" (como banco): informa só o valor, cobre parcelas pendentes mais antigas em ordem. `SolicitarPagamentoEmprestimoDto.ParcelaId` removido; `SolicitarPagamentoAsync` retorna `List<...>`. Blast radius ~49 erros de compilação nos testes, reescritos. Back 384/384, front 333/333.
- **Empréstimo — sobra que não fechava parcela sumia do rastro** (2026-08-13) — `EmprestimoParcela.ValorPago` (migration `AddValorPagoParcelaEmprestimo`): parcela aceita adiantamento parcial, vira `Paga` só quando acumulado cobre. Pagar mais que o pendente → erro explícito. Front: badge "R$X de R$Y pago". Back 388/388, front 334/334. **Incidente de teste:** clique caiu em empréstimo real por engano (R$30), revertido via Postgres; lição em memória (`feedback_nao_testar_em_dado_real`).
- **Empréstimo — arquivar/ocultar quitado em vez de forçar apagar** (2026-08-14) — `Emprestimo.ArquivadoPorCriador`/`ArquivadoPorContraparte` (migration `AddArquivarEmprestimo`, per-usuário), só pra `Quitado`; `ListarAsync` ganhou `incluirArquivados`; endpoints `/arquivar` e `/desarquivar`. Front: botão + checkbox "Mostrar arquivados". Back 393/393, front 340/340.
- **`toLocaleDateString("pt-BR")` sem fuso fixo deslocava data em 1 dia** (2026-08-06) — em fuso negativo (America/Sao_Paulo) data-calendário UTC exibia o dia anterior. 6 arquivos corrigidos com `timeZone: "UTC"` (2 falso-positivos investigados e deixados). front 325/325.

## Achados da auditoria família (2026-06-17) — segurança

- **P1 — `AcertoService.CancelarAsync` sem checar dono** — só criador OU participante cancela; terceiro → 403. PR #221.
- **P1 — POST `/acertos` sem idempotência** — `idempotencyKey` no DTO + `BuscarPorIdempotencyKeyAsync`; front gera UUID estável. PR #221.
- **P1 — acerto sem `FinancialEventLog`** — `AcertoRegistrado`/`AcertoCancelado` gravados. PR #221.
- **P2 — `FamiliasPage` `ehProprio` hardcoded `true`** — `ehProprio = m.usuarioId === currentUser?.id`; remover só pro próprio (sair) ou admin; criador nunca removível. 3 testes. _branch `fix/familia-remover-membro-ehproprio`._
- **P3 — papéis (2.3) + aprovação (2.4)** — 2.3 backend (PR #228) + 2.4 back+front (PR #224/#225).
- _Descartado (não é bug):_ `RateioService.RemoveRange` hard-delete de `RateioTransacao` — é config de split, não ledger; soft-delete não se aplica.

## Sprint de Auth Hardening (OWASP/NIST)

- **C1 — reset token vazado na resposta HTTP** 🔴 (account takeover) — token fora da resposta (DTO só `Mensagem` genérica), geração+e-mail fire-and-forget (Hangfire `PasswordResetEmailJob` + `IPasswordResetEmailSender`). 6 testes. _OWASP Forgot Password._
- **C2 — contrato de exceção furado** 🔴 — 67 `throw new Exception(...)` viraram tipos certos; middleware não ecoa `Message` no 500. 5 testes do middleware + 26 asserts.
- **C3 — soft-delete de `Transacao` violado** 🔴 — `DeletarAsync` faz soft delete + global query filter `HasQueryFilter(t => t.Ativo)`; corrige pernas de transferência aparecendo na lista. 3 testes.
- **A1/A2 — PasswordHasher** 🟠 — migrado p/ Argon2id (Konscious v1.3.1) m=19456/t=2/p=1, salt 16B, saída 32B, formato `ARGON2ID$...` + rehash transparente no login. 8 testes.
- **Reset token hasheado + rate-limit por conta + política 15 chars** — token SHA-256 (`OpaqueTokenHasher`); rate-limit 3/conta/hora + 1/IP/15min; política 10→15, teto 128. 11 testes.
- **Re-auth em operação sensível + cookie HttpOnly + CSP** — troca de senha exige senha atual; jwt+refresh em cookie HttpOnly+Secure+SameSite=Strict; `SecurityHeadersMiddleware` (CSP + nosniff + X-Frame DENY + Referrer + Permissions + HSTS). 5 testes.
- **Rotacionar segredos — DEV** (2026-06-17) — `JWT_SECRET` + senha Postgres novos nos `.env` locais; volume recriado. Falta só prod (item aberto no ROADMAP).
- **A3 — segredos no compose/CI versionado** — `docker-compose.yml` exige `${POSTGRES_PASSWORD:?}` e `${JWT_SECRET:?}` (falha-rápido); `.env.example` na raiz + `.env` gitignored; CI efêmero.
- **403 (ownership) × 401 (auth)** — `ForbiddenAccessException`→403; 27 sites remapeados 401→403; os 6 de auth real ficam 401. Interceptor do front só desloga em 401. 14 asserts + caso no middleware. Convenção em `PROMPT_NOVA_SESSAO.md` §11.

## Hardening de auth 2026-08-23 (prep beta)

- **MFA opcional (opt-in)** — TOTP RFC 6238 (Otp.NET), secret cifrado (AES-256-GCM, chave `MFA_ENCRYPTION_KEY`), 10 backup codes, login 2-passos, UI ativar/desativar em `/settings` com QR. Migration `AddMfaTotp`. `docs/SEGURANCA_BEST_PRACTICES.md` §8. Back 446/446, front 341/341.
- **Pepper de senha (NIST SHOULD)** — `PASSWORD_PEPPER` no Argon2id, separado do banco, rehash transparente. `PasswordHasher.cs`.
- **Remover regra de composição de senha** — NIST SHALL NOT; agora só tamanho 15+ + blocklist. Back e front.
- **verificar-login isento de CSRF** — passo 2 do login dava 403; corrigido no `CsrfValidationMiddleware` (público + challenge de uso único + TTL + rate-limit).

## Preparação do beta (código)

- **Limpeza pré-deploy** — worktree órfã removida; `docker-compose.postgres.yml` apagado; comentário SQLite tirado do `.env.example`.
- **6 rotas demo/dev gateadas** (`/emprestimos-lab-a/b/c/d`, `/design-system`, `/logo-concepts`) atrás de `import.meta.env.DEV`; somem do bundle (JS 1321→1199kB).
- **Hangfire dashboard** — autorizava qualquer autenticado; trocado pra allowlist `HANGFIRE_ADMIN_EMAILS` (fail-closed). 5 testes.
- **axios baseURL** — `import.meta.env.VITE_API_BASE_URL` com fallback; `.env.example` no front.
- **Dockerfile do backend** — usuário não-root, `/app/logs` com owner certo, `/app/data` removido.
- **`/privacidade`** — página real fundamentada na pesquisa LGPD; checkbox de aceite real no `RegisterPage` (3 testes); aviso de minimização no campo "pessoa" do empréstimo.
- **Barra "🎨 BRAND PREVIEW" sem gate** (2026-08-19) — `SiteLayout.tsx` mostrava control bar pra todo visitante; gateada em `import.meta.env.DEV`.
- **Link "Política de Privacidade" faltando no `LoginPage`** (2026-08-19) — virou link real pra `/privacidade`, teste novo.
- **`/termos-de-uso` — rascunho** — página criada (CDC + Marco Civil). **É RASCUNHO** — revisão jurídica é item aberto no ROADMAP.
- **Proteção contra força bruta no login** — contador por conta + delay progressivo (dobra, teto 5min) + bloqueio permanente após 10 falhas. `docs/SEGURANCA_BEST_PRACTICES.md` §7. Migration `AddLoginBruteForceProtection`, 5 testes.
- **Pentest ao vivo (2026-08-23)** — cobertura ampla (auth/IDOR/JWT/SQLi/CORS/Hangfire/força bruta passaram); 2 achados corrigidos: cookie perdia `Secure` atrás de proxy TLS (`ForwardedHeadersOptions` em `Program.cs`) e cadastro com e-mail em case diferente dava 500 (`.ToLower()` na checagem, 2 testes). Back 427/427.
- **Pesquisa de conformidade completa (#126)** (2026-08-18) — LGPD base legal mapeada, DPO dispensado (pequeno porte, Resolução CD/ANPD nº 2/2022), RIPD não obrigatório; BACEN/Open Finance fora do escopo. `docs/CONFORMIDADE_BR.md`.

## Outros / higiene

- **flake `CreditCardsPage` test** — race no auto-foco + data real; fix: navegação cancela auto-foco pendente + mock de `Date.now`. 3× estável.
- **Vitrine do DS documenta todos os tokens** — aba "Espaço & Efeitos" em `/design-system`; tipografia da vitrine corrigida.
- **Warnings de CI limpos** — XML doc malformado + `async` sem `await`; 0 warning. GitHub Actions bumpados (Node 24).
- **Refresh token em plaintext no banco** — agora hash SHA-256 (`OpaqueTokenHasher`), bruto só no cookie. 3 testes.
- **CSP no SPA (prod)** — headers + CSP estrita no `nginx.conf`. Dev (Vite) intacto. _⚠️ prod: ajustar `connect-src` pro domínio do API._
- **#114 Postgres único + #92 E2E** — mergeados, auditados. Dev exige Postgres no ar.
- **Versionamento** — SemVer 0.x, CHANGELOG, `docs/RELEASING.md`, release `v0.9.0`.
- **Ex-colaboradores apagados** do repo + histórico linearizado.
- **Lint debt NBSP** — escape ` ` no ReportsPage.test.

## Branches mergeadas

- `feature/privacy-toggle-ocultar-saldo` — PR #198 (2026-06-16).
- `feature/paginacao-server-side` — PR #178 (2026-05-29).
- `chore/reorg-docs-solo` — PR #198 (2026-06-16).
- `feature/familia-papeis-permissoes` — PR #228 (2026-06-18) — backend da 2.3.
