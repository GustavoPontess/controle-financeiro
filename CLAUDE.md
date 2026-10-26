# CLAUDE.md

Guia para Claude trabalhar eficientemente com este repositório. **Leia este arquivo antes de qualquer mudança.**

> **Antes de uma sessão de trabalho:** ler `PROMPT_NOVA_SESSAO.md` (ponto de entrada do workflow de sessão), `STATE.md` (onde a última sessão parou) e `ROADMAP.md` (backlog vivo).
>
> **Projeto solo** (Gustavo). Sem coordenação de dupla. `gh issue` é opcional pra rastrear trabalho, sem assignee de terceiros.
>
> ### ⚖️ Segurança & Conformidade — regra inegociável
> **Antes de QUALQUER lançamento, é obrigatório pesquisar e aplicar as práticas de segurança nível bancário/fintech, os requisitos da LGPD e as regras regulatórias aplicáveis (ANPD; BACEN/Open Finance se aplicável), e respeitar TODAS as regras impostas.** É um app de dinheiro + dados pessoais — nenhuma feature que toca auth/PII/dados sensíveis sobe sem essa checagem. Pesquisa = **fonte primária** (OWASP/NIST/ANPD/BACEN), nunca chute. **Método proporcional à dúvida (orçamento de uso é escasso):** reusar `docs/SEGURANCA_BEST_PRACTICES.md` + `docs/CONFORMIDADE_BR.md` primeiro (não re-pesquisar o documentado); `WebFetch` leve na fonte por padrão; **deep-research pesado só pra incógnita grande e nova, avisando o custo e pedindo OK antes** (ver `PROMPT_NOVA_SESSAO.md` §8.6). **Fontes autoritativas (consultar sempre): `docs/CONFORMIDADE_BR.md`.** Spec técnico vivo: `docs/SEGURANCA_BEST_PRACTICES.md`. **Todo achado → catalogar+priorizar em `ROADMAP.md` (protocolo em `PROMPT_NOVA_SESSAO.md` §8.5).** **`1.0.0` só sai com isso fechado.**

## Project Overview

Produto B2C de finanças pessoais e familiares, com diferencial em **gestão financeira de casais e famílias** (ver `docs/features/familia/visao.md`).

- **Backend:** .NET 10 Web API com EF Core. **Postgres é o único provider** (dev e prod — paridade total, via `docker compose up -d postgres`). SQLite foi removido no #114 — rodar a API **exige** Postgres no ar
- **Frontend:** `controle-financeiro.web/` (React 19 + TypeScript + Vite), componentes próprios em `src/componentes/` e tokens `--v2-*`. É o "v2" de 2026-10, **único front desde 2026-10-26**; o v1 (biblioteca Pontes, MUI purgado) está na tag `arquivo/v1-final`. Convenções: `controle-financeiro.web/CONVENCOES.md`
- **Banco de dados:** 40 entidades. Postgres único (SQLite removido no #114); `docker-compose.yml` sobe Postgres local
- **Autenticação:** JWT Bearer (HS256) + refresh token (rotação, 7 dias) + reset password (1h)
- **API versionada:** rotas em `/api/v1/...` (via `Asp.Versioning.Mvc`)
- **Jobs:** Hangfire — `PostgreSqlStorage` (schema `hangfire`). Dashboard `/hangfire` exige autenticação
- **E-mail:** SMTP via MailKit (`Infrastructure/Email/SmtpEmailSender`, templates em `ModelosEmail`), ligado por `SMTP_HOST` no `.env`; sem ele, stub que loga (dev/CI). Dev: **Mailpit** no `docker-compose.yml` (`docker compose up -d mailpit`, caixa em http://localhost:8025). Links dos e-mails usam `APP_URL` (raiz do front v2). Log nunca leva destinatário, token nem código. Produção: **Resend** (SMTP, config em `config/deploy.api.yml`). Remetente por tipo (`TipoRemetente`, escolhido no `SmtpEmailSender`): automáticos (`naoresponda@`), segurança (`seguranca@`: exclusão da conta e futuros alertas de login/senha/2FA), produto (`pontes@` + Reply-To). E-mail novo escolhe o tipo lá
- **Observabilidade:** health checks `/health` e `/health/ready`; logs estruturados via Serilog (console JSON + arquivo); correlation ID por request; Sentry ativado por `SENTRY_DSN`
- **Produção:** https://app.pontesdev.com.br numa VPS Hostinger compartilhada com o PontesDev. O deploy é com **Kamal 2** (`config/deploy.api.yml`, `config/deploy.web.yml`, workflow Deploy por clique na main; README em `deploy/`); a máquina, o backup e o DNS moram em `E:\VSCode\pontes\servidor` (outro chat). Daqui só o app: nunca mexer na VPS nem no DNS por este repo; migração de banco sempre compatível com a versão anterior (rollback não desfaz migração)
- **Backlog ativo:** ver `ROADMAP.md` — features dos achados de concorrentes (Lotes 1-5) + fosso família. Estado granular em `STATE.md`

## Commands

### Backend (ControleFinanceiro.Api/)
```powershell
docker compose up -d postgres # Sobe o Postgres de dev (rodar uma vez)
docker compose up -d mailpit  # Caixa de e-mail local (recuperar senha etc.) — http://localhost:8025
dotnet restore
dotnet build
dotnet run                    # API at http://localhost:5293, Swagger at /swagger
dotnet ef database update     # Apply pending migrations
dotnet ef migrations add <Name>
```

### Frontend (controle-financeiro.web/)
```powershell
npm install
npm run dev     # http://localhost:5174 (a API entra por proxy em /api; o cookie do login vale direto)
npm test        # vitest + testing-library
npm run build   # tsc + vite + trava do admin fora do pacote (scripts/conferirAdminFora.mjs)
```
Pelo app: launch `web` (:5174) e `api` (:5293). O `/admin` no dev abre o mini-app do admin.

## Architecture

> **Nome honesto:** monólito em camadas (N-tier: Controllers → Services → EF Core) com Service Layer + Transaction Script e domínio anêmico; o `AppDbContext` faz o papel de Repository/Unit of Work. Front: SPA React organizada por tela + componentes próprios (`CONVENCOES.md`). **Não é** Clean/Onion, DDD, CQRS nem monólito modular — e não é pra virar. Avaliação completa (notas, forças, fraquezas, o que NÃO fazer): **`docs/ARQUITETURA.md`**.

### Backend Structure
- **Controllers/** — thin HTTP layer; 23 controllers mapping to each domain area
- **Services/** — all business logic; 38 services, each registered Scoped (+ helpers estáticos `FamiliaPermissoes`, `PasswordPolicyService`, `DonoRecursos`, `RegrasFinanceiras`)
- **Domain/Entities/** — 40 EF Core entity models, todas com `Guid Id` (never exposed directly in responses)
- **Domain/Enums/** — vários enums (TipoTransacao, Finalidade, TipoConta, StatusFatura, MeioPagamento, etc.)
- **DTOs/** — request/response contracts; services map entities ↔ DTOs. `DTOs/Common/PagedResult<T>` é o envelope padrão de listagens paginadas.
- **Infrastructure/AppDbContext.cs** — EF Core DbContext com DbSets e configuração de delete behavior
- **Infrastructure/Identity/** — JWT generation + hash de senha Argon2id (+ pepper; PBKDF2 legado migra no login) + refresh/reset tokens
- **Infrastructure/Middleware/GlobalExceptionHandlerMiddleware.cs** — captura exceções e mapeia para `ErrorResponseDto { code, message }`
- **Data/** — seeders: `BancoSeeder` (BCB live API), `CategoriaSeeder`; `DevDataSeeder` (conta de exemplo `dev@`/`conjuge@` do atlas/E2E; `SEED_DADOS_DEV=false` desliga) e `DemoSeeder` (registros de demonstração do front v2 nessa conta, via services — só com `SEED_DEMO=true` no `.env` local; **toda tela nova do v2 ganha um bloco aqui** com registros em todos os estados, pro Gustavo ver a usabilidade)
- **Infrastructure/Jobs/** — Hangfire jobs (`FaturaFechamento`, `FaturaAtraso`, `ExpandirRecorrentes`, `ExecutarRecorrentes`, `RecalcularLimites`, `PasswordResetEmail`, `PurgaExclusaoExpirada`, `PurgaRegistroAcessoExpirado`)

### Frontend Structure (`controle-financeiro.web/`)
- **src/api/cliente.ts** — único Axios: cookie httpOnly + CSRF no header, refresh **single-flight** no 401, redirect pro `/entrar` quando a sessão cai (fora das rotas públicas)
- **src/services/** — um arquivo por recurso da API (`transacoesService`, `familiasService`, `mfaService`…), todos pelo `cliente`
- **src/auth/** — `AuthProvider` (sessão, multi-conta, MFA), `Protegido` (só logado), `useAuth`
- **src/layout/** — `V2Layout` (menu lateral, topo com olho/sino/Nova transação, menu da conta, espaços Pessoal/Família), `useTema`
- **src/telas/** — uma tela por arquivo, `.module.css` ao lado; criar e editar são o MESMO formulário (`FormularioTransacao`, `FormularioContaFixa`, `MetaFormulario`)
- **src/componentes/** — ⭐ peças reutilizáveis: `Botao`, `Campo`, `Entrada`, `Selecao`, `SeletorData`, `EntradaValor`, `Segmentos`, `Interruptor`, `Marcar`, `Etiqueta`, `Planilha`/`SecaoPlanilha`, `ListaFicha`, `ListaPorDia`, `Confirmar`, `Dialogo`, `Menu`, `Paginacao`, `Resposta`, `Mosaico`… Peça em 2+ telas **nasce aqui**; a tela escolhe variante e tamanho, nunca cor ou medida
- **src/estilo/** — `tokens.css` (cores, `--v2-fs-*`, raios, sombras, séries de gráfico; tema `data-tema` no `<html>`) e `global.css`
- **src/dominio/** — regras de tela compartilhadas (`conta.ts`, `fatura.ts`, `meta.ts`, `familia.ts`, `transacao.ts`, `senha.ts`…): nunca copiadas por tela
- **src/estado/** — estado entre telas com `useSyncExternalStore` (`ocultar`, `notificacoes`, `espaco`)
- **src/types/** — interfaces espelhando os DTOs do back
- **src/admin/** — mini-app do admin (`admin.html`, entrada própria no build, fora do pacote do app; ver "Beta fechado")
- **src/site/** — site público (`/`), em construção na branch `feat/v2-site`
- **src/test/** — vitest + testing-library; toda tela nova sai com teste (submit vazio bloqueia + fluxo feliz); travas que leem o código (`adminForaDoPacoteComum`)

### Key Domain Concepts

**Transacao** — core entity. Links to either `Conta` or `CartaoCredito` (not both). Supports `parcelamento` (installments): creating one transaction can generate N installment entries spread across N consecutive `Fatura` cycles.

**Fatura** — invoice grouping for credit card transactions. Created automatically when a credit card transaction is added. Status enum controls open/closed/paid state. Delete behavior is `Restrict` (cannot delete a CartaoCredito with open Faturas).

**Conta** — bank account/wallet. `Saldo` is calculated dynamically as `Receitas - Despesas` from linked transactions, not stored. `IsCarteira` flags the user's default cash wallet.

**Categoria** — has `Finalidade` (Despesa/Receita/Ambas) that must be compatible with the transaction type.

### Auth Flow
- JWT Bearer (HS256), access token de **15 min** em cookie httpOnly (claim `sid`; a cada request confere se a sessão está viva) + refresh opaco rotativo de 7 dias com reuse-detection. O front renova **single-flight** (N 401 → 1 refresh, `axiosConfig.ts`); o back tolera reapresentação do token recém-rotacionado **< 30s e do mesmo dispositivo** (401 `REFRESH_EM_CORRIDA`, sem derrubar a família, com log de segurança) — fora disso, reuse-detection estrita
- Claims: `NameIdentifier` (user ID), `Email`, `Name`, `sid`
- CORS: em dev o front (:5174) fala com a API por proxy do vite (mesma origem); produção via `CORS_ALLOWED_ORIGINS`
- **Beta fechado:** o cadastro do app É o pedido de acesso ("Pedir acesso"): nasce `AguardandoAprovacao` e o admin aprova no **Admin, um mini-app à parte** (`controle-financeiro.v2/admin.html` + `src/admin/`, entrada própria no build): o app comum não tem rota, link nem código dele (travas `adminForaDoPacoteComum.test.ts` + `scripts/conferirAdminFora.mjs` no build). Em produção só abre no endereço secreto `ADMIN_PATH` (secret do deploy, lido pelo Caddy; nunca no código); no dev, `/admin`. Admin exige **duas etapas ligadas** (`AdminAuthorizationHandler`: IsAdmin + `MfaAtivo` + Ativo) e o login de admin ignora "lembrar este dispositivo". O nome do app é "Pontes" (o "Pontes Finanças" com selo e links pro site da Pontes Dev foi desfeito em 2026-10-25, a pedido do Gustavo: o site só mostra o projeto no portfólio)
- **API nega por padrão** (`FallbackPolicy`): tudo exige login, exceto o que declara `[AllowAnonymous]` — os endpoints públicos do `AuthController` (login, registro, MFA do login, refresh, switch, logout, roster, reativar conta, esqueci/redefinir senha) e `/health`, `/health/ready`

### Database
- **Postgres único** (SQLite removido no #114): `DATABASE_URL` deve conter connection string Npgsql (`Host=...`). Rodar a API **exige** Postgres no ar (`docker compose up -d postgres`)
- **Schema via migrations versionadas** em `Migrations/` (50 migrations, geradas pelo `AppDbContextFactory`); `dotnet ef database update` aplica e o startup roda `MigrateAsync` automático
- `Npgsql.EnableLegacyTimestampBehavior` ativo — `DateTime` mapeia para `timestamp without time zone`
- Não há mais DDL cru no startup do `Program.cs` — schema muda **só** via migration

## API Documentation

**Documentação é 100% automática** via Swagger/OpenAPI:

1. Adicione comentários XML nos controllers:
   ```csharp
   /// <summary>
   /// Descrição do endpoint
   /// </summary>
   ```

2. Build: `dotnet build`

3. Run: `dotnet run`

4. Acesse: `http://localhost:5293/swagger`

**Resultado:** Swagger gera documentação completa automaticamente. Nenhum arquivo manual.

---

## Important Notes

- Delete behavior: `Conta → Transacoes` (**restrict** desde 2026-10-15 — era cascade e apagava o histórico), `CartaoCredito → Faturas` (restrict). Conta só sai sem lançamento (além do saldo inicial) e sem conta fixa usando; cartão só sai sem fatura com restante — regras no `ContaService`/`CartaoCreditoService`
- User ID é extraído via `User.FindFirstValue(ClaimTypes.NameIdentifier)` e passado pelos serviços para isolamento de dados (multi-tenancy manual em cada query)
- **API Docs:** Swagger em `http://localhost:5293/swagger` — gerado a partir dos comentários XML dos controllers
- **Soft delete** em entidades financeiras (`Transacao`, `Parcelamento`, `ParcelaTransacao`, `Recorrente`) via flag `Ativo`. Nunca `_context.Remove()` nessas entidades.
- **Idempotência** obrigatória em endpoints transacionais via header `Idempotency-Key`. **Padrão novo (#268, pagar fatura; também estorno, marco de reconciliação e criar conta fixa):** tabela `RegistroIdempotencia` com índice **único** (usuário + operação + chave), gravada no **mesmo** `SaveChanges` da operação; replay com os mesmos dados devolve o resultado original, com outros dados → 409. Fluxos novos seguem esse padrão (criar parcelamento já segue, op `CriarParcelamento`) — o `BuscarPorIdempotencyKeyAsync` (busca `Contains` no JSON do `FinancialEventLog`, usado pelo cancelar parcelamento, ParcelaTransacao e Empréstimo) é legado e deixa passar duas requisições simultâneas.
- **Concorrência otimista:** `Fatura.Versao` e `Recorrente.Versao` são o `xmin` do Postgres (`.IsRowVersion()`); `DbUpdateConcurrencyException` → 409. Conta fixa: no máximo uma ocorrência viva por período (`Transacao.Competencia` + índice único parcial) — nunca deduplicar ocorrência por data. Job que salva lote de faturas refaz uma a uma no conflito (ver `FaturaAtrasoJob`) — um pagamento no meio não pode travar o lote de todos os usuários.
- **`FinancialEventLog`** registra mudanças de saldo/limite — usar em qualquer operação que afete saldo
- **Senha (NIST SP 800-63B rev4):** 15–128 caracteres (code points, NFC), **sem** regra de composição (proibido exigir maiúscula/número/símbolo), recusa comum/sequência/repetição/e-mail (`PasswordPolicyService`) e **vazada** (`IVerificadorSenhaVazada` → Pwned Passwords, k-anonymity, fail-open). Toda senha nova passa por `AuthService.ValidarSenhaNovaAsync` — nunca chamar só o `PasswordPolicyService`. Hash/verify normalizam NFC.
- **Compra parcelada é sempre um `Parcelamento`** (+ `ParcelaTransacao` nas faturas): o formulário de transação (`POST /transacoes` com `parcelas`) e a edição que vira parcelado passam por `ParcelamentoService.CriarDoLancamentoAsync`. Nunca criar N lançamentos soltos "X (i/N)" (o fluxo antigo saiu em 2026-10-19; os grupos antigos do banco local ficaram). Guarda subcategoria (`Parcelamento.SubcategoriaId`, sempre da categoria).
- **Família: a parte de cada um fica GRAVADA ao dividir (decisão do Gustavo 2026-10-19):** `RateioTransacao` (Percentual + Valor) existe em todo modo, calculado por `RateioService.CalcularPartesAsync` (regra única; quem "só vê" fica fora; centavos em quem pagou). Mudar `Familia.ModoRateioPadrao` vale só pras próximas; o equilíbrio do mês (`ObterBalancoAsync`) soma as partes gravadas e quem saiu continua (`MembroFamilia.SaiuEm`). **O gasto do mês de cada um é a sua parte** (`GastosPorCategoriaDoMesAsync`: a própria despesa dividida entra pela parte, e a parte da pessoa nas despesas dos outros entra no mês dela). Nunca recalcular divisão antiga pela regra de hoje; mudou o VALOR, `RateioService.RegravarPeloValorAsync` (mesmas pessoas, mesmo %). **Conta fixa da casa** (`Recorrente.FamiliaId`, só conta a pagar): cada cobrança nasce dividida no molde único `RecorrenteService.GerarOcorrenciasAsync` (parte gravada, sem aprovação de novo); mudar a regra da família regrava só as cobranças previstas. Prevista não entra em Transações da família nem no equilíbrio. **Conta/cartão da casa** (`Conta.FamiliaId`, `CartaoCredito.FamiliaId`): a despesa que NASCE ali já nasce dividida pela regra única `RateioService.DividirSeForDaCasaAsync` (já chamada em `TransacaoService.CriarTransacaoAsync` e na geração de conta fixa; fluxo novo que cria despesa chama ela também); o que não é gasto e compra parcelada ficam fora. **Quem exclui a conta** não trava a purga: `FamiliaAoExcluirConta` (na purga LGPD) deixa na família só os números (despesas divididas, partes, acertos) em nome de um "Membro que saiu" (`StatusUsuario.Removido`, nunca loga, fora do admin); vínculo NOVO com a família que guarde dado da pessoa entra AÍ. Spec: `docs/features/familia/espaco-da-familia.md`.
- **Dinheiro entre vocês (acerto da família; passo 3, decisão do Gustavo 2026-10-19):** só quem passou ou quem recebeu registra (`AcertoService`). Registrado por quem passou → espera quem recebeu confirmar (`AcertoContas.ConfirmadoEm` null = fora do equilíbrio; o balanço só soma confirmado); registrado por quem recebeu → já vale. Cada lado tem o SEU lançamento opcional numa conta sua (`TransacaoSaidaId`/`TransacaoEntradaId`), sempre `Transacao.EhAcerto` (fora do resultado e da renda; não se edita nem exclui por Transações, `TransacaoService.ExigirEditavel`); Desfazer/Não recebi cancela os dois. Nunca criar lançamento na conta do OUTRO. Idempotência nova (op `RegistrarAcerto`), xmin no confirmar/lançar.
- **Empréstimos (v2 2026-10-19):** linguagem de fato: "falta voltar" (emprestei) e "falta devolver" (peguei), nunca deve/dívida/cobrar/a receber/a pagar. O lado do DINHEIRO num pagamento segue quem emprestou (`euEmprestei`: quem emprestou recebe = receita; quem pegou devolve = despesa), não o `souCredor` (que é quem controla/confirma; sem vínculo é sempre o criador). O que falta de parcela/à vista: `EmprestimoService.RestanteDaParcela`/`RestanteAVista` (regra única). **Dinheiro de empréstimo fica fora do resultado, como transferência** (decisão do Gustavo 2026-10-19): todo lançamento que o `EmprestimoService` cria ou liga (criar, registrar, confirmar, inclusive o já existente) leva `Transacao.EhEmprestimo` (mexe no saldo, não é gasto nem renda); o v2 mostra a etiqueta "Empréstimo". O topo responde o que vence em 30 dias: `ProximosEmprestimosService` (`GET /emprestimos/proximos`, só leitura). Nome mostrado é o que a pessoa deu (o catálogo de bancos é razão social).
- **Trava de limite do cartão (decisão do Gustavo 2026-10-19):** compra no cartão só entra se o limite disponível cobre, à vista ou parcelada; na edição, só o que aumenta. Regra única: `RegrasFinanceiras.ExigirLimiteDisponivelAsync` (nunca conferir limite na mão). Conta fixa no cartão: `RegrasFinanceiras.CobrarOcorrenciasAsync` (job e geração das vencidas) não cobra a que não cabe, deixa prevista, avisa uma vez (`CobrancaSemLimite`) e tenta de novo todo dia. Antes de salvar a compra, o formulário pergunta `GET /transacoes/aviso` (`AvisoDeCompraService`: limite no cartão, saldo na conta, contas fixas dos próximos 30 dias) e mostra a resposta; só avisa. Fora: importação de extrato.
- **Transações tem duas visões (decisão do Gustavo 2026-10-19, como o Organizze):** **Saldo** (`apenasCaixa`) = só o que mexe no saldo, com pagamento de fatura; **Gastos** (`GET /transacoes?visao=gastos`, `TransacaoService.ListarGastosAsync`) = o que a pessoa gastou, na data em que gastou, em conta e no cartão, com a compra parcelada UMA vez (o total, abre o parcelamento) e sem pagamento de fatura/transferência (senão conta duas vezes). Filtro/ordem/página no banco (UNION ALL).
- **Forma de pagamento (`MeioPagamento`):** número vindo do cliente passa SEMPRE por `MeioPagamentoExtensions.DoCliente` (fora do enum → 400; antes gravava qualquer número) e o rótulo vem de `.Descricao()` (um lugar só). `DebitoAutomatico` (7) existe desde 2026-10-15. Conta fixa guarda o meio (`Recorrente.MeioPagamento`, as ocorrências herdam): no cartão é sempre Crédito, numa conta Crédito é recusado. Também guarda a subcategoria (`Recorrente.SubcategoriaId`, opcional, sempre DA categoria; as ocorrências herdam).
- **Importar extrato:** OFX (padrão aberto, um leitor só) e CSV sem "se for o banco X": o `ExtratoImportService` vira o CSV numa tabela (separador, preâmbulo e cabeçalho detectados) e um `MapeamentoCsv` diz qual coluna é o quê — vindo do que a pessoa escolheu pra aquela conta e cabeçalho (`ModeloImportacao`), dos nomes das colunas (`Sinonimos`: banco novo com nome diferente entra AÍ, como dado) ou do conteúdo; sem confiança, a tela pergunta. Linhas de saldo saem. O confirmar é uma transação só, exige `Idempotency-Key` e pula FITID que já está na conta.
- **Metas = CAIXINHA (`MetaService`; decisão do Gustavo 2026-10-19, como o Nubank):** cada meta nasce com a própria conta (`Meta.ContaId`, `TipoConta.Caixinha` = 7) e guardar é **transferência de verdade** (`TransferenciaService`, as duas pernas `EhTransferencia`, fora do resultado) da conta da pessoa pra caixinha; resgatar faz o caminho de volta. Guardado = saldo da caixinha (`RegrasFinanceiras`), histórico = as transferências dela. Guardar não passa do saldo da conta, resgatar não passa do guardado, os dois exigem Idempotency-Key. **Só Metas mexe na caixinha:** a trava mora no `AppDbContext.SaveChanges` (lançamento novo/alterado numa caixinha, conta fixa ou cartão ligado a ela → 409 `Conta.MensagemCaixinha`), e o guardar/resgatar libera com `using (_context.LiberarCaixinha())`; `DonoRecursos.ExigirContaAbertaAsync` recusa cedo; `ContaService`/`EncerramentoContaService` não editam, excluem, encerram nem reabrem caixinha. `GET /contas` esconde caixinha (só Bancos pede `incluirCaixinhas`) e a lista geral de transações mostra só a perna da conta real. Excluir meta exige caixinha zerada (aí ela é encerrada). Renomear a meta renomeia a caixinha. **Concluir e usar o dinheiro** (`ConcluirAsync`, só com guardado ≥ alvo): o guardado todo vai pra uma conta, `Meta.ConcluidaEm` (o DIA local) + `ValorJuntado` e a caixinha encerrada, numa transação. **Só a marcada é concluída** (`Concluida` = `ConcluidaEm`; guardado ≥ alvo é a situação "chegou-la", ainda Em andamento) e ela vira REGISTRO: não guarda, resgata, edita nem exclui (409); pra juntar de novo, outra meta (o v2 tem "Criar outra igual"). Guardar/resgatar/concluir da mesma meta passam um de cada vez (`FOR UPDATE` na linha da meta). Meta de outra pessoa: 404 pra quem nem vê, 403 pra quem vê pela família e não criou. Prazo é um MÊS (dia 1). Nunca voltar a ter número de meta sem conta por trás (o `ValorAtual` solto e o modelo de reserva saíram).
- **Orçamento (tela `/orcamento` do v2, juntou Renda e Limites; pedido do Gustavo 2026-10-21 a partir da planilha dele):** orçamento base zero. `OrcamentoDoMesService` (`GET /orcamento-do-mes`) junta a renda esperada (`RendaService`), o planejado das despesas (os limites, `OrcamentoService`) e o que as metas em andamento pedem no mês (`MetaService.Situacao` contado do COMEÇO do mês: guardar no mês não encolhe o pedido do mês; mês futuro usa o pedido de agora) e devolve o **"a ser alocado"** = renda esperada − planejado − metas, com a frase. Nenhuma regra nova: cada número vem de onde já mora. Na tela, "limite" se chama **planejado**; `/renda` e `/limites` redirecionam pra `/orcamento`, e todo link/aviso novo aponta pra lá. **Receitas e Investimentos são FONTES** (2026-10-22): `OrcamentoService.FontesDoMesAsync` (`GET/PUT/DELETE /orcamentos/receitas|investimentos`), uma linha por subcategoria (Salário, Tesouro Direto…; `Orcamento.SubcategoriaId`) ou pela categoria sem subcategoria, toda fonte aparece (como a planilha); a renda esperada é a soma das receitas planejadas (`ReceitaPlanejadaAsync`; quem nunca planejou segue com `RendaPrevista`). Investido = aportes menos resgates. Despesas nunca listam categoria de receita nem de investimento. **Metas ficam FORA do Orçamento** (decisão do Gustavo 2026-10-22: Investimentos é só categoria/subcategoria; "a ser alocado" = renda − despesas − investimentos planejados). Na tela, as três seções são `SecaoPlanilha` (uma peça só) e Receitas/Investimentos são o mesmo `OrcamentoFontes`; só o PLANEJADO aparece na tabela (nada de grupo "sem planejado"; as outras categorias ficam na lista da linha nova); "Planejar categoria" é a ÚLTIMA linha da tabela (`LinhaBotaoPlanilha`) e abre a linha nova logo acima (`LinhaNovaPlanilha`); o que a pessoa planeja na visita fica no fim até recarregar. O Orçamento não cria categoria.
- **Limites/planejado (`OrcamentoService`, entidade `Orcamento`; decisão do Gustavo 2026-10-19, como o Monarch):** o limite VALE TODO MÊS até a pessoa mudar. Cada linha = "desta categoria, deste mês em diante"; o do mês M é a linha mais recente até M; `ValorLimite` 0 = tirou o limite dali em diante. Pôr/mudar/tirar só do mês atual pra frente (mês passado fica como estava, 409); mudar apaga as linhas dos meses depois. **Gasto do mês por categoria = `RegrasFinanceiras.GastosPorCategoriaDoMesAsync`** (regra única, Relatórios vai usar): despesa que entra no resultado, em conta ou à vista no cartão, pela data (prevista vai pra "previsto"), e compra parcelada conta a PARCELA do mês (com juros), nunca o total no mês da compra. Excluir categoria movendo limites SOMA o que cada um valia em cada mês (`CategoriaService`). Alerta: `AlertaLimitesJob` (de hora em hora) avisa uma vez por categoria e mês no alerta (80%) e ao passar, com `NotificacaoService.CriarUmaVezAsync` (`Notificacao.Chave` única por usuário).
- **Respostas (docs/features/respostas/visao.md; direção do produto, Gustavo 2026-10-19):** o app responde as perguntas da pessoa ("vai dar?", "essa meta cabe?", "e agora?") com o número e o que fazer, contando o previsto. **A conta mora no servidor e a frase também** (`RespostaDto` tom + texto + ações): `DinheiroDoMesService` (`GET /dinheiro-do-mes`: renda base = maior entre esperado e recebido, o que já saiu por categoria, o que ainda vem = `RegrasFinanceiras.PrevistosDoMesAsync`, livre) · `OrcamentoService.Responder` (limite: situação `vai-passar`, o que vem da categoria; a sobra é só o que aconteceu) · `ViabilidadeMetaService` (`GET /metas/viabilidade`: folga = renda esperada − gasto típico 3 meses − outras metas). **Relatórios = check-up do mês** (`CheckUpService`, `GET /relatorios/check-up`): entrou/saiu/sobrou, comprometido (custo mensal das contas fixas + parcelas ÷ renda), cada categoria contra o normal (média dos meses anteriores com gasto, até 3), 12 meses, reserva em meses; tudo pelas regras únicas. Tela nova que tem pergunta óbvia responde do mesmo jeito; nunca conta solta no front.
- **Que dia é hoje: `HorarioBrasil.Hoje()` / `HojeData()` / `Agora()` (Brasília, UTC−3 fixo). Nunca `DateTime.UtcNow.Date`, `DateOnly.FromDateTime(DateTime.UtcNow)`, `DateTime.Now`/`Today`** pra decidir o dia (data futura, vencido, conta fixa do dia, mês atual, jobs): com o dia UTC, das 21h à meia-noite o servidor já estava no dia seguinte. Carimbo de quando algo aconteceu (CriadoEm, expiração) segue UTC. Teste que monta "hoje" usa o mesmo helper. Trava: `HorarioBrasilTests` (lê o código da API e falha). O parcelamento usa `DiaMaisCedo` (Acre) de propósito, pra não ser mais estrito que o formulário.
- **Valor em reais em mensagem: `Reais.Formatar(x)`; nome de mês: `MesesPt`. Nunca `{x:C}`, `ToString("C")` nem `new CultureInfo("pt-BR")`** — a imagem de produção (alpine) roda com cultura invariante (`{x:C}` sai "¤1,000.00" e o `CultureInfo` lança erro). Trava: `SemCulturaNasMensagensTests` (lê o código da API e falha) + `ReaisTests`.
- **Foto de perfil (`FotoPerfilService`, `UsuariosController`):** upload só JPG/PNG/WebP decidido pelo CONTEÚDO (SkiaSharp decodifica; SVG/GIF/disfarçado → 400), até 8 MB e com teto de pixels; a imagem é REDESENHADA (orientação EXIF, quadrado do meio, WebP 256x256) e só isso é guardado (`FotosPerfil`, 1:1 com cascade) — nunca guardar nem devolver o arquivo enviado (leva GPS/EXIF e conteúdo escondido). Quem vê: a própria pessoa e quem divide família ativa com ela (senão 404, igual pra "não existe"). A versão (`Usuario.FotoPerfilEm`) vai no `/auth/me` e no membro da família; o front monta `/usuarios/{id}/foto?v=`. Entra na exportação LGPD e sai na purga. Manter o SkiaSharp atualizado (parser de imagem de quem não confiamos).
- **DTO `record` com validação: o atributo vai no PARÂMETRO** (`[MaxLength(300)] string X`), nunca `[property: ...]` — o ASP.NET recusa o corpo da requisição (confirmar importação, convite da família, acerto e vincular empréstimo caíam nisso). Trava: `DtoRecordValidacaoTests`.
- **Renda (docs/features/familia/renda-e-visibilidade.md):** renda é da PESSOA e é derivada, nunca digitada no membro da família. `RendaService`: recebido = receitas que são renda (`RendaService.EhRenda`: entra no resultado e não é a categoria padrão "Dinheiro que volta", onde moram Cashback/Reembolso/Estorno); previsto = o que a pessoa DECLARA esperar (`RendaPrevista.FixaEsperada` + `VariavelEsperada`, uma linha por mês; sem ela vale a do último mês). **Conta fixa nunca entra na renda**: é conta a pagar. A família guarda só a regra (`MembroFamilia.VisibilidadeRenda` + `RendaVisivelPara`, que SÓ a própria pessoa muda, na ficha dela na página da família: uma caixa por membro que lança; a tela nunca grava `ValorParaTodos`) e tudo que sai pra família é calculado no servidor pra quem pede (`ObterRendaFamiliaAsync`); nunca mandar valor pro front esconder. Quem só vê (`PapelFamilia.Dependente`) não vê renda de ninguém e **não entra na divisão das despesas nem no peso** (`DespesaCompartilhadaService`, `PesosAsync`). O peso do rateio proporcional é a renda prevista do mês de quem não escondeu tudo.
- **Categorias:** padrão (UsuarioId null) ninguém edita nem exclui; nome único sem diferenciar maiúscula (entre as padrão e as do usuário; subcategoria: dentro da categoria); tipo só muda se aceitar o que já está nela. **Excluir em uso exige `moverPara`** (409 sem): `CategoriaService.DeletarAsync` move lançamentos (inclusive excluídos), contas fixas, parcelamentos, metas e limites (mesmo mês soma) e leva as subcategorias (a de mesmo nome no destino absorve), numa transação só. Nunca `Remove` de categoria sem passar por aí (a FK sem ação dava 500).
- **Tipos de conta (`TipoConta`):** a pessoa cria Corrente, Poupança, Dinheiro e Investimento (6); Cartão (3) e Empréstimo (5) são legado com entidade própria — `ContaService` recusa. `IsCarteira` é SÓ a conta padrão do cadastro (nasce `Dinheiro`, migration `CarteiraTipoDinheiro` consertou as antigas gravadas como poupança): nunca derivar do tipo nem mudar na edição — "Dinheiro" extra (cofrinho) é conta comum.
- **Quem pode o quê: UM lugar só (centralizado 2026-10-19, pedido do Gustavo antes do cartão compartilhado).** Família: `Services/FamiliaPermissoes.cs` com perguntas que têm nome (`EhMembroAsync`, `LancaNaFamiliaAsync`, `QuemLanca`, `Lanca`, `DividemFamiliaAsync`, `VeRendaDosOutros`, `EstaEmAlgumaFamiliaAsync`, `EhCriador`, `ExigirMembroAsync`/`ExigirLancarAsync`/`ExigirAdminAsync`/`ExigirCriador`); recurso da pessoa: `Services/DonoRecursos.cs`. Tabela legível em **`docs/PERMISSOES.md`**. Nunca reescrever "é membro?/lança?/só vê?" na mão: a trava `PermissoesCentralizadasTests` lê o código e falha (`MembrosFamilia.AnyAsync`, comparar papel com `PapelFamilia.Dependente`, `ExigirPapelAsync` genérico fora do helper); `QuemPodeOQueTests` confere a tabela. Regra nova = pergunta nova no helper + linha na tabela + teste.
- **Dono do recurso nas escritas:** toda escrita que recebe id de recurso vindo do cliente (conta, cartão, categoria, subcategoria) valida o dono via `Services/DonoRecursos.cs` antes de gravar — de outro usuário ou inexistente → 404. Filtrar a leitura por `UsuarioId` não basta.
- **API nega por padrão:** `FallbackPolicy` exige usuário autenticado; endpoint público declara `[AllowAnonymous]` explicitamente, nunca "sem atributo".
- **Regras de dinheiro num lugar só:** saldo de conta (Ativo + Executado, agregado no banco), o que entra no resultado (`EntraNoResultado`: fora transferência, pagamento de fatura, saldo inicial, ajuste de reconciliação, Pix no Crédito, dinheiro de empréstimo (`EhEmprestimo`), dinheiro entre vocês na família (`EhAcerto`) e investimento (`EhInvestimento`: categoria do tipo Investimento, 4; marcado SÓ pelo `AppDbContext.SaveChanges` pela categoria, e o `CategoriaService` remarca quando o tipo da categoria muda) — flag nova de "não é receita/despesa" entra AÍ; `RendaService.EhRenda` repete a lista e precisa da flag também) e total/restante de fatura (crédito à vista vivo + parcelas não canceladas) vêm de `Services/RegrasFinanceiras.cs`. Nunca recalcular na mão em service/controller/job — as cópias divergiam (fatura cobrando parcela cancelada, resumo somando previsão). Atraso/"Vencida" derivam do **restante** (não do `EstadoPagamento`); operação que baixa o total sem pagamento (cancelar parcela/parcelamento) chama `ReconciliarFaturasAposCancelamentoAsync`, e toda passagem pra `Pago` sem dinheiro novo (cancelamento ou fechamento do ciclo) registra `FaturaPagaTotal` via `RegistrarQuitacaoSemPagamentoNovo`; parcela `Pendente` em fatura **coberta** pelo pagamento (`ValorPago > 0` e restante 0 — a cobertura real, não o rótulo `Pago`, que pode ter compra nova não paga) **já foi paga** (`ParcelaQuitadaPelaFatura`) — nunca cancelar como se fosse devida, nem pagar antecipado (recusa quando o restante é menor que a parcela).
- **Testes de backend rodam no CI via `.sln`:** o job faz `dotnet test controle-financeiro.sln`. Projeto de teste novo **precisa estar na solution** — senão o CI passa verde sem rodar nada (foi o caso até o #262).

---

## Frontend Patterns & Conventions

**A fonte é `controle-financeiro.web/CONVENCOES.md`** (regras curtas, uma por decisão, com data). Resumo do que não se negocia:

- **Estilo:** CSS Module ao lado do `.tsx`, sempre `var(--v2-*)` (cor, fonte, `--v2-fs-*`, raio, sombra). Nada de cor ou tamanho cru, nada de `style={{}}` de tema. Visual do app inteiro mora em `estilo/global.css`.
- **Componentes:** peça que aparece em 2+ telas vira componente em `src/componentes/`; a tela passa variante e tamanho, `className` só pra posição. Conferir o que já existe antes de criar (`Planilha`, `ListaFicha`, `Segmentos`, `Menu`…).
- **Formulário:** todo campo dentro de `Campo`; valida ao enviar, erro **no campo** (vermelho, uma linha, não ocupa altura), limpa ao editar, não chama o servidor inválido; erro do servidor num aviso no topo. Limite de caracteres igual ao do back (`docs/REGRAS_CAMPOS.md`). Dinheiro nunca negativo (`EntradaValor`), nunca `type="number"`.
- **Layout:** ações da página no pé, à direita (`RodapeFormulario`); "Voltar" é a seta do topo (o layout põe); página de formulário sem `max-width`; formulário dentro de caixa preenche a caixa (`LinhaCampos`).
- **Listas:** busca, filtro e página **no servidor**; busca com espera de digitação (`useAtrasado`); lista com ficha na linha = `ListaFicha` (modelo Bancos), nunca dropdown de ficha; cadastros são "ficha + ações na linha", sem página de detalhe.
- **Texto:** PT-BR simples, sem travessão; dinheiro entre pessoas é fato ("pagou a mais", "pra equilibrar o mês X passa Y pra Z"), nunca deve/dívida/cobrar; sem subtítulo explicativo nem contador redundante.
- **Respostas:** a frase que responde ("vai dar?") vem pronta do servidor (`RespostaDto`); o front mostra (`componentes/Resposta`), nunca calcula.
- **Teste:** toda tela nova sai com teste (vitest + testing-library): submit vazio bloqueia + fluxo feliz; fluxos de dinheiro têm o seu.
- **Dados demo:** toda tela nova ganha um bloco no `DemoSeeder` (conta Gabriel Dev, `SEED_DEMO=true`), com registros em todos os estados.

## Backend Patterns & Conventions

### Adicionar Nova Entidade

1. **Domain/Entities/NovaEntidade.cs**
```csharp
public class NovaEntidade
{
    public Guid Id { get; set; }
    public string Nome { get; set; }
    public Guid UsuarioId { get; set; }
    
    // Relacionamentos
    public Usuario Usuario { get; set; }
}
```

2. **DTOs/NovaEntidade/NovaEntidadeDto.cs & CriarNovaEntidadeDto.cs**

3. **Services/NovaEntidadeService.cs**
```csharp
public class NovaEntidadeService
{
    private readonly AppDbContext _context;

    public async Task<NovaEntidadeDto> ObterPorId(Guid id, Guid usuarioId)
    {
        var entidade = await _context.NovaEntidades
            .FirstOrDefaultAsync(x => x.Id == id && x.UsuarioId == usuarioId);
        return _mapper.Map<NovaEntidadeDto>(entidade);
    }

    // Sempre passar usuarioId para isolamento de dados
}
```

4. **Controllers/NovaEntidadeController.cs**
```csharp
[ApiController]
[Route("api/[controller]")]
public class NovaEntidadeController : ControllerBase
{
    private readonly NovaEntidadeService _service;

    [HttpGet("{id}")]
    [Authorize]
    public async Task<ActionResult<NovaEntidadeDto>> GetById(Guid id)
    {
        var usuarioId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var result = await _service.ObterPorId(id, Guid.Parse(usuarioId));
        return Ok(result);
    }
}
```

5. **Infrastructure/AppDbContext.cs** — Adicionar DbSet

6. **Criar Migration**
```powershell
dotnet ef migrations add AddNovaEntidade
dotnet ef database update
```

---

## Database Design Principles

- **Data Isolation:** Sempre filtrar por `UsuarioId`
- **Soft Deletes:** Quando aplicável, usar `IsDeleted` flag
- **Calculated Fields:** `Conta.Saldo` é calculado, não armazenado
- **Constraints:** Validações no banco (FK, NOT NULL, unique)
- **Cascade Rules:** Documento em `Infrastructure/AppDbContext`

---

## Common Tasks

### Fix a Bug
1. Localize no código (use `Grep`)
2. Escreva teste se possível
3. Applique fix
4. Verifique com `npm run lint` (frontend) ou `dotnet build` (backend)
5. Atualizar CLAUDE.md se a correção muda padrões

### Add Feature
1. Comece pelo backend (entidade → service → controller)
2. Adicione migrations
3. Implemente frontend (service → componente → página)
4. Documente em `docs/` se for complexo
5. Atualize este arquivo com padrões novos

### Refactor Code
- Mantenha a assinatura pública igual (não quebre dependentes)
- Teste integração após mudanças
- Documente razão da refatoração

---

## Documentation Structure

```
.
├── CLAUDE.md                    ← este arquivo (convenções e padrões)
├── PROMPT_NOVA_SESSAO.md        ← ponto de entrada de cada sessão de trabalho
├── STATE.md                     ← estado vivo: onde a última sessão parou
├── ROADMAP.md                   ← backlog vivo (o que fazer a seguir, prioridade)
├── README.md                    ← README público do projeto
└── docs/
    ├── README.md                ← índice da documentação
    ├── QUICK_REFERENCE.md       ← resumo de stack/comandos/padrões
    ├── ARQUITETURA.md           ← nome honesto da arquitetura + avaliação (notas, fraquezas, o que NÃO fazer)
    ├── STANDARDS.md             ← convenções de código (naming, error handling, etc.)
    ├── DATABASE.md              ← schema, ER, delete behavior
    ├── FLOWS.md                 ← fluxos de negócio
    ├── DESIGN_SYSTEM.md         ← biblioteca Pontes do v1 (histórico; o front atual segue controle-financeiro.web/CONVENCOES.md)
    ├── GIT_WORKFLOW.md          ← padrão de branches e commits
    ├── CONTROLLER_TEMPLATE.md   ← scaffold de controller novo
    ├── ANALISE_PRODUTO.md       ← análise crítica de produto (maio/2026)
    ├── concorrentes/            ← análise de concorrentes (Pierre, Despezzas, Monarch, etc.)
    ├── features/                ← uma pasta por feature
    │   ├── parcelamento/        ← (concluída em Q2 2026)
    │   ├── familia/             ← visão do fosso (rateio/papéis/dependentes)
    │   │   └── visao.md
    │   ├── empresas/            ← visão do eixo PJ (que empresa, ordem, preço, automação com IA "Pilar")
    │   ├── b2b-contadores/      ← visão do escritório de contabilidade (passo 4 de empresas/)
    │   └── cartao-credito/      ← regras de negócio
    │       └── regras.md
    ├── referencias/             ← prints de concorrentes + iterações de logo (gitignored)
    └── history/                 ← documentos arquivados (por quarter Q2-Q5)
        └── {ISSUES,PROGRESS,IMPLEMENTATION_STATE}_2026Q{2,3,4,5}.md + BUILD_PLAN_CONCORRENTES.md
```

**Princípio:** documentação por feature mora em `docs/features/<nome>/`. Quando uma feature complexa for iniciada, criar pelo menos `arquitetura.md` (spec técnica) e `ux.md` (mockups e copy) dentro da pasta da feature.

**Manutenção:** ao fim de cada sessão que mudou padrões, schema ou fluxo, atualizar o doc correspondente — checklist em `PROMPT_NOVA_SESSAO.md` seção 9.
