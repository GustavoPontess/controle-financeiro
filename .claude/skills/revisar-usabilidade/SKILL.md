---
name: revisar-usabilidade
description: Revisa a usabilidade e acessibilidade de telas do Pontes (React) contra regras de mercado (Vercel Web Interface Guidelines + regras de UX) e contra o padrão de telas do projeto. Use quando pedirem "revisa a usabilidade", "audita essa tela", "checa acessibilidade", ou antes de abrir PR que muda tela.
argument-hint: <arquivo-ou-pasta>
context: fork
agent: general-purpose
---

# Revisar usabilidade de tela

Revise os arquivos em `$ARGUMENTS` (se vazio, os `.tsx`/`.module.css` alterados em `git diff main --name-only -- controle-financeiro.web/src`). **Só leitura:** não edite nada, não commite.

## Ordem de checagem

1. **Padrão do Pontes primeiro** — `.claude/skills/pontes-telas/SKILL.md` e `docs/features/padrao-telas/ficha-por-entidade.md`. Desvio de padrão pesa mais que regra genérica.
2. **Regras da Vercel** — [regras-vercel.md](regras-vercel.md).
3. **Regras de UX** — [regras-ux.md](regras-ux.md) (categorias 1, 2, 5, 8, 9 e 10; a 4 "Style Selection" não se aplica: o Pontes tem DS próprio).

## Adaptações ao Pontes (valem acima das regras copiadas)

- **Idioma:** textos em português. Botões e títulos em caixa de frase ("Nova transação"), **não** Title Case. Tratar por "você" ou imperativo.
- **Estilo:** CSS Modules + `var(--pontes-*)`. Onde a regra cita classe Tailwind (`focus-visible:ring-*`, `truncate`, `min-w-0`), procure o equivalente em CSS.
- **Sem SSR:** ignore "Hydration Safety".
- **Título da tela:** o `<h1>` mora na Navbar (`components/Navbar/Navbar.tsx`). Página interna **não** tem `<h1>` próprio — isso está certo, não é achado.
- **Sem texto explicativo:** não sugerir subtítulo, hint sob título nem "helper text" (decisão do Gustavo). Erro de campo sim.
- **Validação de formulário:** a regra do projeto é validar ao enviar, erro inline via `PontesField error=` + `invalid`, limpar ao editar (`docs/STANDARDS.md`). Não sugerir validar "no blur".
- **Estado na URL:** página e filtros na URL (com `replace`); **texto da busca não vai pra URL** (navegador compartilhado).
- **Dinheiro:** nunca aceitar valor negativo em campo de dinheiro; usar `PontesMoneyInput`, nunca `PontesInput` texto + parser próprio.
- **Desktop primeiro:** regras só de toque/mobile (safe area, tap highlight, 44px de alvo) entram como P3.
- **Menor exposição:** dado de outra pessoa (renda, e-mail completo) que não precisa aparecer é achado de privacidade (P1).

## Saída

Agrupe por arquivo, formato `arquivo:linha — problema → correção`. Marque a prioridade no início de cada linha: **P1** (quebra uso, dinheiro, privacidade ou acessibilidade grave), **P2** (desvio do padrão / usabilidade), **P3** (polimento). Sem preâmbulo. Arquivo sem achado: `✓ ok`. No fim, 1 linha com a contagem por prioridade.
