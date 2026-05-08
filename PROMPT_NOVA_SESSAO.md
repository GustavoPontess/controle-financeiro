# 🤖 PROMPT_NOVA_SESSAO — Instruções para o Claude da próxima sessão

**Este arquivo é o ponto de entrada de qualquer sessão de implementação do Issue #1.**

Lê este arquivo do começo ao fim antes de fazer QUALQUER outra coisa.

---

## 1. Identidade da sessão

Você é Claude trabalhando no projeto **Controle Financeiro** (`E:\VSCode\controle-financeiro`).

Objetivo desta sessão e das próximas: implementar o **Issue #1 — Parcelamento Flexível** seguindo o design já fechado em `ARQUITETURA_PARCELAMENTO.md`.

Não é projeto pessoal — é **produto futuro** (app financeiro sofisticado, estilo Mobills/YNAB/Monarch). Padrão de qualidade alto.

---

## 2. PRIMEIRA AÇÃO obrigatória — invocar caveman skill

Antes de tudo, invoque a skill `caveman` no modo `full` para reduzir consumo de tokens em respostas conversacionais. Código e arquivos do projeto seguem normais (sem caveman) — caveman afeta apenas as respostas em chat.

Se a skill já estiver ativa de invocação anterior, ignore.

---

## 3. Leia esta ordem (uma vez por sessão)

Use o tool `Read` nestes arquivos, na ordem:

1. `IMPLEMENTATION_STATE.md` — onde a implementação parou. **Mais importante.**
2. `CLAUDE.md` — convenções do projeto, comandos, padrões
3. `ARQUITETURA_PARCELAMENTO.md` — especificação completa do que implementar
4. `UX_PARCELAMENTO.md` — mockups e copy de UI (consultar quando estiver no frontend)
5. `GIT_WORKFLOW.md` — padrão de branch e commit
6. `CONTROLLER_TEMPLATE.md` — padrão de controller
7. `ISSUES.md` (apenas seção do #1) e `PROGRESS.md` — contexto geral

Não precisa ler outros arquivos antes de começar — descubra o que precisar conforme avança.

---

## 4. O trabalho

A `ETAPA atual` em `IMPLEMENTATION_STATE.md` diz onde retomar.

Siga as etapas IN ORDER. Cada etapa tem um **Checkpoint** que precisa estar verde antes de passar pra próxima:

- ETAPA 1-3: build C# verde após cada etapa
- ETAPA 4-5: migrations aplicam sem erro, banco íntegro
- ETAPA 6-7: build verde + Swagger lista endpoints novos
- ETAPA 8: dashboard Hangfire acessível
- ETAPA 9: testes passam
- ETAPA 10-11: build frontend verde + nova tela renderiza
- ETAPA 12: docs atualizadas, PR pronta

Cada etapa, ao terminar:
1. Roda o checkpoint dela (`dotnet build` ou `npm run build` ou rodar testes — o que aplicar)
2. Faz commit seguindo `GIT_WORKFLOW.md` (`feat: <descrição>`, `fix: <descrição>`, etc)
3. Marca a etapa como `[x]` em `IMPLEMENTATION_STATE.md`
4. Atualiza a barra de progresso e o "Etapa atual"

---

## 5. Regra de ouro — NÃO PARAR EM ESTADO QUEBRADO

Se sentir pressão de tokens (você sabe quando está chegando no limite — se passar de ~70% do contexto disponível), **interrompa em ponto seguro**:

**Pontos seguros para parar:**
- Após qualquer Checkpoint verde de etapa
- Após commit bem-sucedido
- Antes de começar uma nova entidade/serviço/componente

**Pontos PERIGOSOS — nunca parar aqui:**
- Migration criada mas não aplicada
- Entidade modificada mas DbContext não atualizado (build vermelho)
- Service refatorado mas controller ainda chamando assinatura antiga
- Frontend chamando endpoint que não existe no backend
- Testes quebrados que não estavam quebrados antes

Se identificar que a próxima ação vai te empurrar pra ponto perigoso e os tokens estão escassos, **pare ANTES** dessa ação.

---

## 6. Procedimento de encerramento de sessão

Quando decidir parar (limite de tokens, fim natural de etapa, ou usuário pediu):

1. Garante que build está verde (`dotnet build` no backend, `npm run build` no frontend se mexeu lá)
2. Commit do que foi feito (mesmo que parcial — desde que compile)
3. Atualiza `IMPLEMENTATION_STATE.md`:
   - Atualiza "Etapa atual" para a próxima a fazer
   - Atualiza "Última sessão" e barra de progresso
   - Adiciona entrada nova em "Histórico de sessões" usando o template no fim do arquivo
   - Especifica em "Próxima ação" exatamente o próximo passo (ex: "criar arquivo Services/ParcelamentoService.cs com método CriarAsync — assinatura está em ARQUITETURA_PARCELAMENTO.md > Fluxo 1")
4. Commita esse update do state file separadamente: `chore: atualizar implementation state — fim da sessão N`
5. Avisa o usuário em chat (caveman): em qual etapa parou, o que foi feito, e que ele pode rodar mesmo prompt em sessão futura pra retomar

---

## 7. Comandos úteis (do CLAUDE.md)

```powershell
# Backend
cd E:\VSCode\controle-financeiro\ControleFinanceiro.Api
dotnet build
dotnet run                    # http://localhost:5293/swagger
dotnet ef migrations add <Name>
dotnet ef database update

# Frontend
cd E:\VSCode\controle-financeiro\controle-financeiro.web
npm install
npm run build
npm run dev                   # http://localhost:5173
npm run lint
```

---

## 8. Padrões críticos para lembrar

- **Soft delete em todo o domínio financeiro** — nunca `_context.Remove()` em Parcelamento/ParcelaTransacao/Recorrente/Transacao
- **Idempotência obrigatória** em endpoints transacionais — header `Idempotency-Key`
- **FinancialEventLog** registra cada mudança de saldo/limite — não esquecer
- **`UsuarioId` no doc = `CriadoPor` no código** (convenção existente do projeto)
- **Janela de 3 meses** para Recorrentes — não 12, não infinito
- **3 flags ortogonais** na Fatura, não enum monolítico
- **Hangfire** para jobs — não on-demand
- **Não vazar UI** no backend (copy "URGENTE", contagem de dias, etc — UX_PARCELAMENTO.md cuida)

---

## 9. Quando em dúvida

- **Sobre o domínio:** consultar `ARQUITETURA_PARCELAMENTO.md`
- **Sobre UI/copy:** consultar `UX_PARCELAMENTO.md`
- **Sobre código existente:** `Grep`/`Read` direto, não chuta
- **Sobre algo realmente ambíguo:** pergunta ao usuário em vez de inventar — mas pergunta UMA coisa específica, não bloco genérico

---

## 10. Pra começar AGORA

1. Invoca skill `caveman`
2. `Read` em `IMPLEMENTATION_STATE.md`
3. Identifica `Etapa atual`
4. Continua dali em diante

Boa sessão.
