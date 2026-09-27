---
owner: Gustavo
last_reviewed: 2026-09-27
status: ATIVO
---

# Arquitetura — avaliação de 2026-09-27

Registro da avaliação de arquitetura feita em **2026-09-27**, com 6 agentes: 4 mapearam o código, 1 arquiteto deu nome e nota, 1 cético verificou cada afirmação no código. Só entrou aqui o que sobreviveu ao cético. Números conferidos na `main` do dia (`4f6d687`).

**TL;DR:** monólito em camadas com Service Layer e domínio anêmico. É a escolha certa pra fundador solo pré-beta — **não precisa reescrever**. A casca (auth, borda HTTP, controllers, design system) está acima da média. O miolo financeiro (isolamento nas escritas, idempotência, concorrência, regras de dinheiro) ainda não está no nível de um app de dinheiro. **Nota geral: 5,5/10.**

Os achados viraram tarefa priorizada em [`ROADMAP.md`](../ROADMAP.md) → "Auditoria de arquitetura (2026-09-27)".

---

## 1. Nome honesto

**Backend:** monólito em camadas (N-tier de 3 camadas: Controllers → Services → EF Core) com **Service Layer + Transaction Script** e **domínio anêmico**. O `AppDbContext` do EF faz o papel de Repository e Unit of Work — não há camada de repositório própria.

**Frontend:** SPA React organizada **por página**. Cada página busca os próprios dados (services Axios, sem store global). UI vem do design system próprio **Pontes** (`src/components/pontes/`).

**Números do dia:**

| O quê | Quantidade |
|---|---|
| Controllers | 23 |
| Services registrados (Scoped) | 38 — a pasta `Services/` tem 41 arquivos; os outros 3 são helpers estáticos (`FamiliaPermissoes`, `PasswordPolicyService`) e a `ForbiddenAccessException` |
| Entidades (`Domain/Entities/`) | 39 (39 `DbSet`) |
| Migrations | 41 |
| `AppDbContext.cs` | 700 linhas |
| `EmprestimoService.cs` | 1.809 linhas |
| Interfaces no backend | 3 (todas de envio de e-mail) |
| Arquivos `.tsx` em `src/pages/` | 49 — 44 importam o barrel Pontes |

---

## 2. O que NÃO é

Pra ninguém vender o projeto como outra coisa (nem tentar "consertar" pra virar):

- **Não é Clean / Onion / Hexagonal.** Os services dependem do `AppDbContext` concreto (38 dos 41 arquivos de `Services/`). A DI registra classes concretas. Só existem 3 interfaces no backend, todas de e-mail (`IContaEmailSender`, `IPasswordResetEmailSender`, `IPasswordResetDispatcher`). E há ciclo de dependência: `Services` depende de `Infrastructure` (DbContext), e o middleware de `Infrastructure` depende de `Services` por causa da `ForbiddenAccessException`.
- **Não é DDD.** As 39 entidades são só `get`/`set`. Zero métodos. A regra mora nos services.
- **Não é monólito modular.** Um `AppDbContext` único (~700 linhas) serve todos os domínios.
- **Não é Vertical Slice.** A organização é por camada técnica (Controllers/Services/DTOs), não por feature.
- **Não é CQRS / MediatR.** Leitura e escrita passam pelos mesmos services.

---

## 3. Veredito

- A escolha é **certa** pra fundador solo pré-beta. Camadas simples = pouco atrito, pouca cerimônia, fácil de ler.
- **Não precisa ser reescrita.** O problema não é o estilo de arquitetura; é disciplina no miolo financeiro.
- A **casca está acima da média:** auth/sessão, borda HTTP, controllers finos, design system.
- O **miolo financeiro ainda não está no nível de um app de dinheiro:** escrita sem checar dono, pagamento sem idempotência, zero controle de concorrência, regra de dinheiro duplicada.
- **Nota geral: 5,5/10.**

---

## 4. Notas (0-10)

| Critério | Nota | Por quê |
|---|---|---|
| Separação de responsabilidades | 6 | Controllers finos e regra nos services; mas há god-class (`EmprestimoService` 1.809 linhas) e GET que grava. |
| Acoplamento / coesão | 5 | Tudo depende do `AppDbContext` concreto e de services concretos; regra de dinheiro espalhada em vários services. |
| Testabilidade | 5 | ~700 testes existem, mas não rodavam no CI até o #262; rodam em InMemory, que não reproduz transação, índice único nem concorrência do Postgres. |
| Consistência / padronização | 5 | 3 modelos de dono (`UsuarioIdProprietario`/`CriadoPor`/`UsuarioId`); `GetUserId` copiado em 16 controllers; tipo `Notification` em ~23 arquivos. |
| Segurança | 6,5 | Auth/sessão forte e borda bem montada; mas furos de isolamento nas escritas, escrita anônima em Bancos e pepper fail-open. |
| Integridade de dados / domínio | 4 | Pagar fatura sem idempotência, zero token de concorrência, operação multi-commit sem transação, hard delete em cascata. |
| Escalabilidade / performance | 6 | Postgres, índices e paginação server-side nas listas; mas bundle ~1,27 MB sem code-splitting e saldo recalculado em vários lugares. |
| Manutenibilidade / DX | 6 | Estrutura previsível, docs vivos, TS strict, DS único; mas god-classes e regra duplicada pesam em toda mudança de dinheiro. |

---

## 5. Forças (com a ressalva do cético)

- **Auth/sessão forte.** Argon2id + pepper, com migração transparente do PBKDF2 legado no login. Refresh opaco com rotação e detecção de reuso. Revogação instantânea por `sid`. MFA com segredo cifrado em AES-GCM.
  _Ressalva:_ o pepper é **opcional** — sem `PASSWORD_PEPPER`, desliga em silêncio (fail-open).
- **Borda HTTP bem montada.** 500 genérico (não ecoa detalhe), CSP/HSTS, pipeline de middlewares na ordem certa.
  _Ressalva:_ `InvalidOperationException` vira 409 **ecoando a mensagem interna** — inclusive mensagem do EF.
- **Controllers majoritariamente finos** e versionamento global de rota (`/api/v1/...`).
- **Parcelamento como modelo interno:** transação explícita + idempotência + `FinancialEventLog`. É o padrão que o resto do miolo deveria seguir.
  _Ressalva:_ a idempotência é um `LIKE` no JSON do `FinancialEventLog`, consultado **fora** da transação — duas requisições simultâneas passam pelas duas checagens.
- **Front disciplinado.** 44 de 49 arquivos de página via barrel Pontes, TypeScript `strict`, zero `any` fora de teste.

---

## 6. Fraquezas — status em 2026-09-27

1. **Testes de backend não rodavam no CI.** A `.sln` só tinha o projeto da API; `dotnet test` passava vazio e o check ficava verde.
   **✅ CORRIGIDO no #262** — o projeto de testes entrou na `.sln`; o CI agora executa 706 testes.
2. **Furos de isolamento entre usuários.** Recorrente aceitava conta/cartão/categoria de outro usuário, e o job lançava no saldo da vítima. Categoria sem checagem de dono em Transação e Meta. `BancosController` com escrita anônima. Sem `FallbackPolicy`.
   **✅ CORRIGIDO** no #264 (helper `DonoRecursos` + `FallbackPolicy` + 24 testes cross-user).
3. **Pagar fatura sem idempotência e sem controle de concorrência.** Duplo clique paga 2x. O XML doc do endpoint diz "Idempotência via header Idempotency-Key", mas nada lê o header. Zero tokens de concorrência no projeto inteiro.
   **✅ CORRIGIDO na Fatura** no #268 — tabela `RegistroIdempotencia` com índice único (padrão novo pra idempotência; substitui o `LIKE` no JSON do `FinancialEventLog` daqui em diante) + `xmin` na `Fatura`. **Aberto (P1):** `xmin` em `Emprestimo`/`EmprestimoParcela`/`Meta`.
4. **Regras de dinheiro duplicadas e divergentes.** Total da fatura soma parcelas canceladas. Saldo calculado em 4 lugares. Parcelamento fica fora do dashboard e dos relatórios.
   **✅ CORRIGIDO (total + saldo)** no #269 — `Services/RegrasFinanceiras.cs`, saldo agregado no banco. **Aberto (P1, decisão contábil):** parcelamento no dashboard/relatórios — regra anti-dupla-contagem no ROADMAP.
5. **Suspeita não reproduzida: logout aleatório.** O refresh silencioso do front não é single-flight; duas requisições que tomam 401 juntas mandam o mesmo refresh token duas vezes, e a reuse-detection estrita pode tratar a segunda como replay e derrubar a sessão.
   **✅ CORRIGIDO** no #267 — refresh single-flight no front + janela de 30s (mesmo dispositivo) na reuse-detection, com 401 `REFRESH_EM_CORRIDA` pra aba que perde a corrida.
6. **Operações multi-commit sem transação e hard deletes.** Excluir conta apaga as transações em cascata (contradiz a regra de soft delete). Importação pode parar pela metade.
   **Aberto** — a transação que falta (`EmprestimoService.CriarAsync`, `ImportacaoService`) é o resto do P1 do item 3; o hard delete em cascata é o P1 "Hard delete em entidade financeira" do ROADMAP.
7. **God-classes.** `EmprestimoService` com ~1.800 linhas. GET que grava (listar/buscar empréstimo aplica multa e salva). Multa **substitui** juros em vez de somar — o valor devido lê `ValorComMulta ?? ValorComJuros ?? Valor`, e a multa é calculada sobre o `Valor` sem juros. Suspeita de bug, confirmar com teste.
   **Aberto** (P2) — quebrar no boy-scout, não em mutirão.
8. **Mapeamento exceção → HTTP por tipo genérico.** Qualquer `InvalidOperationException` vira 409 e vaza a mensagem (inclusive do EF). Violação de índice único vira 500.
   **Aberto** (P2).

---

## 7. O que NÃO fazer

Custa caro, não resolve os problemas reais e trava um dev solo:

- **Migrar pra Clean/Onion multi-projeto.** Cerimônia sem ganho; os furos são de regra, não de camada.
- **Repository / UnitOfWork genérico.** O `DbContext` já é isso. Camada extra só esconde o EF.
- **MediatR / CQRS / event sourcing.** Indireção demais pro tamanho do time e do produto.
- **Microserviços.** Um dev, um banco, um deploy.
- **Reescrever as entidades como DDD rico.** Mover pra entidade/serviço único **só as regras de dinheiro duplicadas** (total de fatura, saldo, multa/juros).
- **Interface pra todo service.** Só onde há troca real de implementação (e-mail já tem).
- **`HasQueryFilter` global de tenant agora.** Existem 3 modelos de dono diferentes (`UsuarioIdProprietario`, `CriadoPor`, `UsuarioId`) — um filtro único não encaixa nos três. Preferir o helper `DonoRecursos` + testes cross-user.
- **Redux / Zustand.** Se o front precisar de cache de servidor, React Query incremental, tela a tela.
- **Parar tudo pra quebrar god-classes.** Boy-scout: quebra o pedaço que a tarefa atual toca.

---

## 8. Convenções que saíram disso

- **Toda escrita que recebe id de recurso do cliente valida o dono** via `Services/DonoRecursos.cs` (conta, cartão, categoria, subcategoria). Recurso de outro usuário ou inexistente → 404 (não revela se o id existe). O helper chega com o PR da branch `fix/isolamento-usuario-p0`.
- **A API nega por padrão.** `FallbackPolicy` exige usuário autenticado; endpoint público declara `[AllowAnonymous]` explicitamente. Também chega com o PR de `fix/isolamento-usuario-p0`.
