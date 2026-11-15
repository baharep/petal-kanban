$ErrorActionPreference = 'Stop'

$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $repositoryRoot

try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker CLI was not found. Install Docker Desktop and try again.'
    }

    $environmentFile = Join-Path $repositoryRoot '.env'
    $environmentLines = [System.Collections.Generic.List[string]]::new()
    if (Test-Path -LiteralPath $environmentFile) {
        foreach ($line in Get-Content -LiteralPath $environmentFile) {
            $environmentLines.Add($line)
        }
    }

    $secretIndex = -1
    $hasSessionSecret = $false
    for ($index = 0; $index -lt $environmentLines.Count; $index++) {
        if ($environmentLines[$index] -match '^PETAL_SESSION_SECRET=(.*)$') {
            $secretIndex = $index
            $hasSessionSecret = -not [string]::IsNullOrWhiteSpace($Matches[1])
            if ($hasSessionSecret -and $Matches[1].Length -lt 32) {
                throw 'PETAL_SESSION_SECRET must contain at least 32 characters.'
            }
        }
    }

    if (-not $hasSessionSecret) {
        $secretBytes = New-Object byte[] 32
        $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            $randomGenerator.GetBytes($secretBytes)
        }
        finally {
            $randomGenerator.Dispose()
        }

        $sessionSecret = [Convert]::ToBase64String($secretBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
        $secretLine = "PETAL_SESSION_SECRET=$sessionSecret"
        if ($secretIndex -ge 0) {
            $environmentLines[$secretIndex] = $secretLine
        }
        else {
            $environmentLines.Add($secretLine)
        }
        Set-Content -LiteralPath $environmentFile -Value $environmentLines -Encoding ASCII
        Write-Host 'Created a local session key in the ignored .env file.'
    }

    docker compose up --build -d
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose failed to start Petal (exit code $LASTEXITCODE)."
    }

    Write-Host 'Petal services started. See docs/LOCAL-DEVELOPMENT.md for local URLs.'
}
finally {
    Pop-Location
}
