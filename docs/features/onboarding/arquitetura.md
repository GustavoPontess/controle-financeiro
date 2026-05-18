---
feature: onboarding
issue: '#29'
status: CONCLUIDA
owner: Gustavo
created: 2026-05-18
---

# Feature — Onboarding guiado pós-cadastro

Spec técnica da Issue #29 (Bloco D — Retenção e UX B2C).

Entrega: depois do cadastro, o usuário é levado a um fluxo guiado que mostra os
primeiros passos para o app virar útil. Pode pular a qualquer momento.

**Por que importa:** usuário que cria conta e cai numa tela vazia não volta. O
onboarding mostra o caminho: cadastrar conta → cartão → importar/lançar
transações → (opcional) criar família.

---

## 1. Passos do onboarding

| # | Passo | Concluído quando | CTA |
|---|---|---|---|
| 1 | Cadastrar primeira conta | usuário tem ≥1 `Conta` | `/accounts` |
| 2 | Cadastrar um cartão | usuário tem ≥1 `CartaoCredito` | `/credit-cards` |
| 3 | Importar extrato ou lançar transações | usuário tem ≥1 `Transacao` | `/importacao` |
| 4 | Criar uma família (opcional) | usuário é membro de ≥1 `Familia` | `/familias` |

Cada passo mostra o estado (feito / pendente) e um botão que leva à tela certa.
O passo 4 é opcional — não bloqueia a conclusão.

---

## 2. Entidade (alteração)

`Usuario` ganha `OnboardingConcluido` (`bool`, default `false`). Marca que o
usuário já passou (ou pulou) o onboarding — não reexibe.

---

## 3. Fluxo

- Após o **registro**, o frontend redireciona para `/onboarding` (em vez do
  dashboard).
- A página de onboarding consulta o **status** (checklist computado) e desenha
  os 4 passos.
- "Pular" ou "Concluir" chamam `POST /onboarding/concluir`, que seta
  `OnboardingConcluido = true`, e o usuário vai para o dashboard.
- Usuário que já concluiu e tenta abrir `/onboarding` é mandado ao dashboard.

---

## 4. Endpoints — `/api/v1/onboarding`

| Método | Rota | Descrição |
|---|---|---|
| GET | `/onboarding/status` | Checklist computado + flag de concluído |
| POST | `/onboarding/concluir` | Marca o onboarding como concluído |

---

## 5. DTOs

- `OnboardingStatusDto { bool Concluido, bool TemConta, bool TemCartao, bool TemTransacao, bool TemFamilia }`

---

## 6. Regras

- O checklist é **computado** a cada consulta — nada além da flag é persistido.
- `TemTransacao` = existe transação ativa em conta ou cartão do usuário.
- `TemFamilia` = usuário é membro ativo de alguma família.
- Concluir é idempotente — chamar de novo não causa erro.

---

## 7. Etapas de implementação

1. Spec + `Usuario.OnboardingConcluido` + migration + `OnboardingService` +
   `OnboardingController` + DTOs
2. Frontend: `onboardingService`, `OnboardingPage` (4 passos), rota
   `/onboarding`, redirect no registro
3. Testes de serviço
