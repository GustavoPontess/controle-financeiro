# Monarch — **AI Assistant** (chat, rodapé esquerdo)

> O que substitui o [Advice](./advice.md). Chat sobre os dados financeiros do usuário. **Este é o nível de software que nenhum BR tem** — a tese do Gustavo em ação.

## Ativação (consentimento)
Primeira vez abre onboarding:
- **"Ask anything about your money"** — "From spending trends to real estate equity, we're confident we can guide you on your money journey."
- **"Your privacy and security matter"** — usa **LLMs de terceiros** ("Monarch uses 3rd-party LLMs for the Assistant's conversational AI and analysis"). Consentimento explícito: "By clicking Continue, you agree that messages may be sent to our AI partner… per our Privacy Policy."
- **"It gets better with your feedback"** — rate 👍/👎 melhora respostas futuras.
- ⚠️ Disclaimer fixo no rodapé do chat: **"AI Assistant can make mistakes and isn't for financial advice."**

## UI do chat
- Painel flutuante (canto inf. dir.), header: **título da conversa (auto-gerado)** + ícones **nova conversa · expandir · settings · minimizar · fechar**.
- **Prompts sugeridos** (starter): "How much did I spend on coffee last month?" · "What are my biggest recent expenses?" · "How has my net worth changed over time?" · "Where am I spending more this year?" · "What's a Traditional vs. a Roth IRA?".
- Input "Ask anything about your money…" + enviar.

## ⭐ Qualidade (testei ao vivo — a régua)
Perguntei: *"What is my current savings rate and where is most of my money going?"*
- Mostrou um passo **"Thought"** (raciocínio colapsável — estilo reasoning model).
- Assumiu **janela default de 3 meses** (Jun 1 – Aug 31/2026).
- Resposta: *"I couldn't calculate a savings rate or spending breakdown because there are **no recorded transactions from June 1 through August 31, 2026**. Add or sync transaction history…"*
- ⭐ **NÃO alucinou** — minhas transações são de Set/20; ele checou o período real, não achou dado e **admitiu** em vez de inventar. **Grounded nos dados reais** + honesto sobre limite.
- Auto-titulou a conversa ("Understanding your savings…").

## Como fazer no nosso (stack + tese)
- **Arquitetura:** LLM (Claude — usar o mais capaz, ver ambiente) com **tool-use/function-calling** sobre nossos próprios endpoints (query de transações, saldos, metas, orçamento). O LLM **não recebe dump** — ele **chama funções** e responde com dados reais → evita alucinação (como o Monarch fez).
- **Grounding obrigatório:** nunca deixar o modelo inventar número; toda resposta financeira sai de query real. Se não tem dado, admite (igual Monarch).
- **Privacidade/LGPD:** consentimento explícito antes de mandar dado pra IA; minimizar o que vai (só o necessário, IDs não-PII); documentar em CONFORMIDADE_BR. Ameaça = atacante com IA sem limites ([[feedback_baseline_seguranca_qualidade]]).
- **Disclaimer** "não é aconselhamento financeiro" — obrigatório (regulatório).
- **Feedback 👍/👎** → dataset de melhoria.
- **⭐ Nosso diferencial (fosso casal):** assistente que entende **household** — "quanto o casal gastou junto?", "como dividir a meta da casa?", "quem pagou mais esse mês?". Nenhum concorrente (nem o Monarch) faz IA de casal. **Aqui a gente passa a régua deles.**

## Prompts sugeridos = roadmap de capacidades
As sugestões deles revelam o que a IA sabe fazer: gasto por categoria/merchant num período · maiores despesas · evolução de net worth · comparação de gasto ano-a-ano · educação financeira (Roth IRA etc). Replicar as equivalentes BR + as de casal.
