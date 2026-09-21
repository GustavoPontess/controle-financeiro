# Monarch — **Household / Members** (`/settings/members`) ⭐⭐⭐ NOSSOS DOIS FOSSOS

> Aqui está literalmente a tese do Gustavo: casal/família + contador. Monarch já faz — estudar a fundo pra fazer MELHOR (com sabor BR + copy sensível).

## Modelo de casal/família ("yours, mine, and ours")
- **"Add another member for free"** — membro convidado **NÃO paga a mais** (incluso no plano). Ganha **login próprio** (username/senha dele).
- Descrição oficial: *"Members you invite will be able to login with their own username/password at no extra cost. Once they join, you can **mark accounts and transactions as personal or shared** to reflect ownership and **toggle between solo and shared views**."*
- Papéis: o titular é **Admin**; convidado é membro.
- Proposta de valor (3 pilares deles):
  1. 😊 **"One place for yours, mine, and ours"** — junta contas separadas + compartilhadas numa visão só.
  2. 👥 **"See your finances, solo and together"** — alterna visão **pessoal × compartilhada** de gasto, net worth etc.
  3. 💡 **"Reach your goals as a team"** — metas compartilhadas, crescer net worth juntos.

### ⭐ Conceito-chave: ownership por conta/transação + toggle de visão
- Cada **conta** e cada **transação** pode ser marcada **personal** ou **shared**.
- Usuário alterna entre **Solo view** (só o dele) e **Shared/Household view** (o casal).
- Metas podem ser alimentadas por contas de **ambos** (visto em [goals](./goals.md) — "Jon's Savings" + "Melanie's Brokerage").

## Contador / B2B ("Financial Professionals")
- **"Give Access to Financial Professional"** — acesso via **Monarch for Professionals Program**.
- **Revogável a qualquer momento**; **acesso expira em 365 dias** (auto-revoga).
- = nosso **eixo contador (B2B)**. Modelo: profissional tem acesso ao painel do cliente, com validade e revogação.

## ⭐⭐ Como fazer MELHOR no nosso (a jogada de ganhar)
Monarch faz o básico do casal. Onde a gente **passa a régua** (ver `docs/features/familia/visao.md`):
- **Rateio/divisão** de despesas compartilhadas (quem paga o quê, "a acertar/a receber") — Monarch só marca personal/shared, **não faz o acerto entre o casal**. Nosso diferencial.
- **Copy sensível** ([[feedback_copy_sensivel_casal]]): "acerto/equilíbrio/a acertar", nunca "deve/cobrança".
- **Papéis e dependentes** (filhos, mesada) — além de 2 adultos.
- **IA de casal** (ver [ai-assistant](./ai-assistant.md)): "quanto gastamos juntos?", "como dividir a meta da casa?" — ninguém faz.
- **PIX entre o casal** pra quitar o acerto (local, Monarch não tem).

## Modelo de dados (nosso)
- `Household { Id }` + `HouddholdMember { HouseholdId, UsuarioId, Papel(Admin/Member/Dependente) }`.
- `Conta`/`Transacao` ganham `Visibilidade(Personal/Shared)` + `DonoUsuarioId`.
- View toggle = filtro (solo = `DonoId==eu`; shared = household inteiro).
- Acesso contador: `AcessoProfissional { HouseholdId, ProfissionalId, ExpiraEm, Revogado }` (expira em N dias, revogável) — casa com nosso eixo B2B contadores.

## O que roubar / superar
- **Membro grátis** (não cobrar por parceiro) — remove atrito de adoção do casal. **Copiar.**
- **Personal/Shared + toggle solo/together** — base. **Copiar e somar rateio.**
- **Acesso profissional com expiração/revogação** — copiar pro eixo contador.
- **Superar em:** rateio, copy sensível, IA de casal, PIX — é onde nenhum BR e nem o Monarch chegam.
