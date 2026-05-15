# =====================================================================
# gh-helpers.ps1
# Helpers de mapeamento roadmap → GitHub Issue.
#
# Como usar:
#   . scripts/gh-helpers.ps1            (carrega as funções no shell atual)
#   Get-IssueByRoadmap 11               (retorna o número GitHub da Issue do roadmap #11)
#   Assign-RoadmapIssue 11              (assigna você na Issue do roadmap #11)
#   Show-RoadmapIssue 11                (abre a Issue no browser)
# =====================================================================

function Get-IssueByRoadmap {
    <#
    .SYNOPSIS
    Retorna o número do GitHub Issue correspondente a um número do roadmap.

    .PARAMETER RoadmapNumber
    Número do roadmap (ex: 11, 22, 31).

    .EXAMPLE
    Get-IssueByRoadmap 11
    #>
    param(
        [Parameter(Mandatory=$true)]
        [int]$RoadmapNumber
    )

    $searchTerm = "#$RoadmapNumber in:title"
    $result = gh issue list --search $searchTerm --state all --json number,title --jq '.[0]' | ConvertFrom-Json

    if ($null -eq $result) {
        Write-Host "Nenhuma Issue encontrada com '#$RoadmapNumber' no título." -ForegroundColor Red
        return $null
    }

    Write-Host "Roadmap #$RoadmapNumber  →  GitHub #$($result.number)  '$($result.title)'" -ForegroundColor Cyan
    return $result.number
}

function Assign-RoadmapIssue {
    <#
    .SYNOPSIS
    Assigna o usuário autenticado a uma Issue referenciada pelo número do roadmap.

    .PARAMETER RoadmapNumber
    Número do roadmap (ex: 11).

    .EXAMPLE
    Assign-RoadmapIssue 11
    #>
    param(
        [Parameter(Mandatory=$true)]
        [int]$RoadmapNumber
    )

    $ghNumber = Get-IssueByRoadmap $RoadmapNumber
    if ($null -eq $ghNumber) { return }

    gh issue edit $ghNumber --add-assignee "@me"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Assignado em GitHub #$ghNumber" -ForegroundColor Green
    } else {
        Write-Host "✗ Falha ao assignar" -ForegroundColor Red
    }
}

function Show-RoadmapIssue {
    <#
    .SYNOPSIS
    Abre a Issue no browser a partir do número do roadmap.

    .EXAMPLE
    Show-RoadmapIssue 11
    #>
    param(
        [Parameter(Mandatory=$true)]
        [int]$RoadmapNumber
    )

    $ghNumber = Get-IssueByRoadmap $RoadmapNumber
    if ($null -eq $ghNumber) { return }

    gh issue view $ghNumber --web
}

function New-RoadmapBranch {
    <#
    .SYNOPSIS
    Cria uma branch feature/N-slug a partir de main atualizado, e assigna a Issue.

    .PARAMETER RoadmapNumber
    Número do roadmap.

    .PARAMETER Slug
    Slug em kebab-case (ex: 'segredos-env-vars').

    .EXAMPLE
    New-RoadmapBranch 11 'segredos-env-vars'
    #>
    param(
        [Parameter(Mandatory=$true)]
        [int]$RoadmapNumber,

        [Parameter(Mandatory=$true)]
        [string]$Slug
    )

    Write-Host "==> Atualizando main..." -ForegroundColor Cyan
    git checkout main
    git pull --ff-only origin main

    $branchName = "feature/$RoadmapNumber-$Slug"
    Write-Host "==> Criando branch $branchName..." -ForegroundColor Cyan
    git checkout -b $branchName

    Write-Host "==> Assignando a Issue do roadmap #$RoadmapNumber..." -ForegroundColor Cyan
    Assign-RoadmapIssue $RoadmapNumber

    Write-Host "`nPronto. Você está em $branchName e a Issue está assignada a você." -ForegroundColor Green
}

Write-Host "Helpers carregados: Get-IssueByRoadmap, Assign-RoadmapIssue, Show-RoadmapIssue, New-RoadmapBranch" -ForegroundColor Green
