# =====================================================================
# create-github-issues.ps1
# Bootstrap das 21 Issues do roadmap Q3 2026 no GitHub.
#
# Pré-requisitos:
#   - gh CLI instalado e autenticado (`gh auth status`)
#   - Repositório git com remoto GitHub configurado
#   - Rodar a partir da raiz do repo: pwsh scripts/create-github-issues.ps1
#
# Rodar UMA VEZ. Se rodar de novo, vai criar issues duplicadas.
# =====================================================================

$ErrorActionPreference = "Stop"

Write-Host "==> Verificando autenticação gh..." -ForegroundColor Cyan
gh auth status
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRO: gh CLI não está autenticado. Rode 'gh auth login' primeiro." -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------
# Labels — criar antes das issues para poder atribuir
# ---------------------------------------------------------------------

Write-Host "`n==> Criando labels..." -ForegroundColor Cyan

$labels = @(
    @{ name = "bloco-a"; color = "B60205"; description = "Bloco A — Higiene de Produção" },
    @{ name = "bloco-b"; color = "D93F0B"; description = "Bloco B — Infraestrutura para Escalar" },
    @{ name = "bloco-c"; color = "0E8A16"; description = "Bloco C — Pivot Família" },
    @{ name = "bloco-d"; color = "1D76DB"; description = "Bloco D — Retenção e UX B2C" },
    @{ name = "severidade/critica"; color = "B60205"; description = "Bloqueador — atacar imediatamente" },
    @{ name = "severidade/alta"; color = "FBCA04"; description = "Importante — atacar logo após críticas" },
    @{ name = "severidade/media"; color = "C5DEF5"; description = "Pode esperar mas precisa entrar" },
    @{ name = "tipo/feature"; color = "0E8A16"; description = "Funcionalidade nova" },
    @{ name = "tipo/seguranca"; color = "B60205"; description = "Segurança" },
    @{ name = "tipo/infra"; color = "D93F0B"; description = "Infraestrutura, DevOps, CI/CD" }
)

foreach ($label in $labels) {
    Write-Host "  - $($label.name)" -NoNewline
    gh label create $label.name --color $label.color --description $label.description --force 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✓" -ForegroundColor Green
    } else {
        Write-Host " (pulou — já existe)" -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------
# Issues — definidas como array de hashtables
# ---------------------------------------------------------------------

Write-Host "`n==> Criando 21 issues do roadmap Q3..." -ForegroundColor Cyan

function Issue-Body($numero, $resumo, $checkpoint, $esforco) {
    return @"
> Issue criada automaticamente a partir de ``ISSUES.md`` (Q3 2026).
> Spec completa: [ISSUES.md → #$numero](../blob/main/ISSUES.md)

## Resumo

$resumo

## Checkpoint de aceite

$checkpoint

## Esforço estimado

$esforco

## Antes de iniciar

- [ ] Assignar-se nesta Issue (``gh issue edit $numero --add-assignee @me``)
- [ ] ``main`` local atualizado (``git checkout main && git pull --ff-only``)
- [ ] Criar branch ``feature/$numero-<slug>``
- [ ] Ler ``docs/COLLABORATION.md`` se primeira sessão

## Documentação a atualizar ao concluir

- [ ] ``ISSUES.md`` (mover para área concluída)
- [ ] ``PROGRESS.md`` (incrementar dashboard, adicionar histórico de sessão)
- [ ] Docs específicas conforme escopo da Issue (ver PR template)
"@
}

$issues = @(
    # ===== BLOCO A — Higiene de Produção =====
    @{
        title = "#11 — Segredos via variáveis de ambiente"
        labels = "bloco-a,severidade/critica,tipo/seguranca"
        body = Issue-Body 11 `
            "JWT secret e connection string hardcoded em ``Program.cs`` e ``appsettings.json``. Mover para variáveis de ambiente." `
            "API sobe lendo variáveis do ambiente. ``appsettings.json`` versionado não contém segredos reais." `
            "2h"
    },
    @{
        title = "#12 — Corrigir CORS contraditório"
        labels = "bloco-a,severidade/critica,tipo/seguranca"
        body = Issue-Body 12 `
            "``Program.cs`` tem ``.WithOrigins('http://localhost:5173').AllowAnyOrigin()``. ``AllowAnyOrigin`` invalida a restrição na prática." `
            "Requisição de origem não-permitida retorna erro CORS no browser." `
            "30min"
    },
    @{
        title = "#13 — JWT em httpOnly cookie + CSRF token"
        labels = "bloco-a,severidade/critica,tipo/seguranca"
        body = Issue-Body 13 `
            "Frontend armazena JWT em ``localStorage`` — vulnerável a XSS. Migrar para httpOnly cookie com CSRF token." `
            "DevTools não mostra JWT em localStorage/sessionStorage. Tentativa de CSRF de outra origem é bloqueada." `
            "1 dia"
    },
    @{
        title = "#14 — Rate limiting em endpoints sensíveis"
        labels = "bloco-a,severidade/alta,tipo/seguranca"
        body = Issue-Body 14 `
            "``/auth/login``, ``/auth/register``, ``/auth/forgot-password`` sem rate limiting. Brute force trivial." `
            "6ª tentativa de login no mesmo IP retorna 429 Too Many Requests com ``Retry-After``." `
            "3h"
    },
    @{
        title = "#15 — Política de senha forte"
        labels = "bloco-a,severidade/alta,tipo/seguranca"
        body = Issue-Body 15 `
            "Senha mínima de 6 caracteres sem requisitos de complexidade. Cai em ataque de dicionário. 2FA fica fora do MVP." `
            "Cadastro com senha fraca retorna erro listando requisitos faltantes. Frontend mostra força em tempo real." `
            "4h"
    },

    # ===== BLOCO B — Infraestrutura para Escalar =====
    @{
        title = "#16 — Migrar SQLite para Postgres"
        labels = "bloco-b,severidade/critica,tipo/infra"
        body = Issue-Body 16 `
            "SQLite é single-writer. Acima de ~50 usuários ativos, queries serializam e UX cai. Sem replicação." `
            "API roda em Postgres local (docker-compose) com 100% dos testes passando. SQLite mantido em dev/test." `
            "3-4 dias"
    },
    @{
        title = "#17 — Hangfire com PostgresStorage"
        labels = "bloco-b,severidade/critica,tipo/infra"
        body = Issue-Body 17 `
            "Hangfire usa ``MemoryStorage``. Fila de jobs é perdida a cada deploy/restart." `
            "Restart da API mantém jobs agendados intactos. ``/hangfire`` dashboard protegido." `
            "4h"
    },
    @{
        title = "#18 — Docker + docker-compose"
        labels = "bloco-b,severidade/alta,tipo/infra"
        body = Issue-Body 18 `
            "Sem containerização. Deploy depende de ambiente local com .NET SDK + Node." `
            "``docker compose up`` sobe stack inteira (API + Web + Postgres) em ambiente limpo." `
            "1 dia"
    },
    @{
        title = "#19 — GitHub Actions: build, test, lint"
        labels = "bloco-b,severidade/alta,tipo/infra"
        body = Issue-Body 19 `
            "Sem CI. Mudanças vão para main sem nenhum gate automático. Bloqueia ativação de branch protection estrita." `
            "PR com código quebrado vira merge bloqueado. Badges no README mostram status." `
            "1 dia"
    },
    @{
        title = "#20 — Health checks + observabilidade"
        labels = "bloco-b,severidade/alta,tipo/infra"
        body = Issue-Body 20 `
            "Sem ``/health``, sem logs estruturados, sem rastreamento de erros. Em produção, problema vira mistério." `
            "Erro proposital aparece no Sentry com stacktrace completo e correlation ID. ``/health`` e ``/health/ready`` funcionando." `
            "1-2 dias"
    },
    @{
        title = "#21 — Testes frontend (Vitest + RTL)"
        labels = "bloco-b,severidade/media"
        body = Issue-Body 21 `
            "Zero teste no frontend. Refactor é roleta russa." `
            "30+ testes no frontend rodando no CI cobrindo páginas críticas e validação de formulários." `
            "2-3 dias"
    },

    # ===== BLOCO C — Pivot Família =====
    @{
        title = "#22 — Sub-feature 1: Família + Membros (sem rateio)"
        labels = "bloco-c,tipo/feature"
        body = Issue-Body 22 `
            "Criar família, convidar membros (existentes e novos), aceitar/recusar, papéis editáveis, listar, sair." `
            "Spec técnica detalhada em ``docs/features/familia/sub-1-familia-membros/`` (a criar)." `
            "2 semanas"
    },
    @{
        title = "#23 — Sub-feature 2: Despesa Compartilhada (modo igualitário)"
        labels = "bloco-c,tipo/feature"
        body = Issue-Body 23 `
            "Marcar transação como compartilhada, feed compartilhado, balanço mensal igualitário." `
            "Spec técnica detalhada em ``docs/features/familia/sub-2-despesa-compartilhada/`` (a criar)." `
            "1-2 semanas"
    },
    @{
        title = "#24 — Sub-feature 3: Dependentes"
        labels = "bloco-c,tipo/feature"
        body = Issue-Body 24 `
            "Criar dependente, atribuir despesa a dependente, filtro 'quanto gastei com X'." `
            "Casos de uso de gasto com filhos liberados. Spec em ``docs/features/familia/sub-3-dependentes/``." `
            "1 semana"
    },
    @{
        title = "#25 — Sub-feature 4: Modos de rateio (proporcional + custom)"
        labels = "bloco-c,tipo/feature"
        body = Issue-Body 25 `
            "Regra de divisão proporcional à renda e custom por despesa. Recalcular balanços." `
            "Casais com renda desigual conseguem configurar peso. Despesa pode ter regra ad-hoc." `
            "1 semana"
    },
    @{
        title = "#26 — Sub-feature 5: Acerto de contas"
        labels = "bloco-c,tipo/feature"
        body = Issue-Body 26 `
            "Marcar saldo como acertado, histórico de acertos, comprovante opcional." `
            "Botão 'marcar como pago' zera saldo entre membros. Notificação para outra parte. Histórico preservado." `
            "4-5 dias"
    },

    # ===== BLOCO D — Retenção e UX B2C =====
    @{
        title = "#27 — Importação OFX/CSV de extrato bancário"
        labels = "bloco-d,severidade/critica,tipo/feature"
        body = Issue-Body 27 `
            "Sem importação, usuário lança despesa a mão. Taxa de abandono em 7 dias passa de 60% em apps com entrada só manual." `
            "Upload OFX → parse → dedup → revisão pré-importação → salvar. Sugestão automática de categoria." `
            "1-2 semanas"
    },
    @{
        title = "#28 — PWA instalável + offline básico"
        labels = "bloco-d,severidade/alta,tipo/feature"
        body = Issue-Body 28 `
            "Sem PWA, sem mobile. App financeiro precisa estar no bolso no momento da compra." `
            "Manifest + Service Worker. Funciona offline para visualização. Botão 'Adicionar à tela inicial' promovido após 2ª sessão." `
            "3-4 dias"
    },
    @{
        title = "#29 — Onboarding guiado pós-cadastro"
        labels = "bloco-d,severidade/alta,tipo/feature"
        body = Issue-Body 29 `
            "Primeiro acesso joga usuário no dashboard vazio. Sem guia, abandono na hora." `
            "Fluxo: cadastrar conta → cartão → importar OFX ou lançar 3 transações exemplo → opcional criar família. Skip a qualquer momento." `
            "1 semana"
    },
    @{
        title = "#30 — Notificações (push + e-mail)"
        labels = "bloco-d,severidade/media,tipo/feature"
        body = Issue-Body 30 `
            "Vencimento de fatura, estouro de orçamento, despesa compartilhada lançada por outro membro, convite de família." `
            "Web Push API + e-mail transacional configurado e disparando nos triggers definidos." `
            "1-2 semanas"
    },
    @{
        title = "#31 — Dark mode"
        labels = "bloco-d,severidade/media,tipo/feature"
        body = Issue-Body 31 `
            "App não tem dark mode. Higiene básica de UX moderna, esperado em app financeiro consultado à noite." `
            "Theme MUI com paleta dark. Toggle persistente. Respeita ``prefers-color-scheme`` no primeiro acesso." `
            "2 dias"
    }
)

# ---------------------------------------------------------------------
# Criação das issues
# ---------------------------------------------------------------------

$created = 0
$failed = 0

foreach ($issue in $issues) {
    Write-Host "  - $($issue.title)" -NoNewline

    # Salvar body em arquivo temporário (evita problemas de escape no PowerShell)
    $tempFile = [System.IO.Path]::GetTempFileName()
    $issue.body | Out-File -FilePath $tempFile -Encoding utf8

    gh issue create `
        --title $issue.title `
        --body-file $tempFile `
        --label $issue.labels 2>&1 | Out-Null

    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✓" -ForegroundColor Green
        $created++
    } else {
        Write-Host " ✗ (erro)" -ForegroundColor Red
        $failed++
    }
}

# ---------------------------------------------------------------------
# Sumário
# ---------------------------------------------------------------------

Write-Host "`n==> Resultado:" -ForegroundColor Cyan
Write-Host "    Criadas: $created" -ForegroundColor Green
if ($failed -gt 0) {
    Write-Host "    Falhas:  $failed" -ForegroundColor Red
}

Write-Host "`nPróximos passos:" -ForegroundColor Cyan
Write-Host "  1. Verificar no GitHub: gh issue list --state open"
Write-Host "  2. (Opcional) Criar GitHub Project board e adicionar todas as issues"
Write-Host "  3. (Opcional) Configurar branch protection no main (Settings → Branches)"
Write-Host "  4. Começar Issue #11 (Bloco A) seguindo o protocolo de PROMPT_NOVA_SESSAO.md`n"
