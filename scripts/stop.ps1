$ErrorActionPreference = 'Stop'

$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $repositoryRoot

try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker CLI was not found. Install Docker Desktop and try again.'
    }

    docker compose down
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose failed to stop Petal (exit code $LASTEXITCODE)."
    }

    Write-Host 'Petal services stopped.'
}
finally {
    Pop-Location
}
