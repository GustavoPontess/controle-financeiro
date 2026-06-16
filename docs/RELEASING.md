---
owner: Gustavo
last_reviewed: 2026-06-16
status: ATIVO
---

# RELEASING — como cortar uma versão

> **Instruções operacionais para o Claude.** Quando o Gustavo pedir "corta uma release", "bumpa a versão", "marca a v0.x" ou similar, **siga este passo a passo**. Sem script, sem CI mágico — é processo manual guiado por este arquivo.

## Esquema de versão

**SemVer `MAJOR.MINOR.PATCH`**, atualmente em **0.x (pré-lançamento)**:

| Mudança | Bump | Exemplo |
|---|---|---|
| Só correções de bug | **PATCH** | `0.9.0` → `0.9.1` |
| Feature nova compatível | **MINOR** | `0.9.0` → `0.10.0` |
| Lançamento público / breaking | **MAJOR** | `0.x` → `1.0.0` |

**`1.0.0` só quando:** os 🔴 da auditoria (`docs/AUDITORIA_CODIGO_HERDADO.md` — C1 reset token, C2 exceções, C3 soft-delete) estiverem corrigidos **e** o produto estiver pronto pra público (gating/preço definidos). Até lá, fica em `0.x`.

## Onde a versão mora (manter sincronizado)

1. `controle-financeiro.web/package.json` → campo `"version"`
2. `ControleFinanceiro.Api/ControleFinanceiro.Api.csproj` → `<Version>`
3. `CHANGELOG.md` → seção da versão
4. Tag git `vX.Y.Z` + GitHub Release

## Passo a passo (Claude executa quando pedido)

1. **Definir o número** conforme a tabela acima. Em dúvida entre minor/patch: se entrou `feat`, é minor.

2. **Derivar o que mudou** desde a última tag:
   ```bash
   git log $(git describe --tags --abbrev=0)..HEAD --format='%s'
   ```
   Agrupar por: **Added** (`feat`), **Changed** (`refactor`/`chore` de comportamento), **Fixed** (`fix`), **Security** (segurança).

3. **Atualizar `CHANGELOG.md`:** mover o conteúdo de `[Unreleased]` para uma seção nova `[X.Y.Z] - AAAA-MM-DD` (data de hoje), preencher os grupos, deixar `[Unreleased]` vazio. Atualizar os links de compare no rodapé.

4. **Bumpar a versão** em `package.json` e no `.csproj` (os dois iguais).

5. **Commit via branch + PR** (a `main` é protegida — nunca commitar direto):
   ```bash
   git checkout -b chore/release-vX.Y.Z
   git commit -am "chore(release): vX.Y.Z"
   git push -u origin chore/release-vX.Y.Z
   gh pr create --base main --fill
   ```
   Esperar **CI verde** (Backend + Frontend) e mergear (**squash**).

6. **Sincronizar a main local** e **taggar** o commit do merge:
   ```bash
   git checkout main && git pull
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

7. **Criar o GitHub Release** com as notas do CHANGELOG:
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes "<seção do CHANGELOG>"
   ```
   Para lançamento ainda não público, pode usar `--draft`.

8. **Atualizar `STATE.md`** registrando a versão cortada.

## Regras

- **Nunca** commitar/taggar direto na `main` fora do fluxo PR (protegida).
- A tag aponta para o commit do **merge na main**, não para a branch.
- Não pular números. Não reaproveitar tag já publicada.
- Toda assinatura de release é do Gustavo — **nunca** adicionar co-autoria de IA (regra global do projeto).
