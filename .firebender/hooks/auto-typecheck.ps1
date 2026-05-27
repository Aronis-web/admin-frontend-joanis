# stop hook: corre typecheck automatico al cerrar el turno.
# Reporta SOLO errores en archivos que el AGENTE edito en esta sesion
# (registrados por format.ps1 en .firebender/.session/agent-edits.txt).
# Asi evita ruido por errores preexistentes en el repo.
#
# IMPORTANTE: en Windows invocamos npm via cmd /c para evitar problemas de parsing
# de argumentos de PowerShell con npm.ps1.

$ErrorActionPreference = 'SilentlyContinue'

function Emit-Empty {
    Write-Output '{}'
    exit 0
}

try {
    $raw = [Console]::In.ReadToEnd()
    $payload = $null
    if ($raw) { $payload = $raw | ConvertFrom-Json }

    # No reintentar si ya hubo un follow-up automatico en este turno
    if ($payload -and $payload.loop_count -ge 1) { Emit-Empty }

    $projectDir = $env:FIREBENDER_PROJECT_DIR
    if (-not $projectDir) { $projectDir = (Get-Location).Path }

    $editsLog = Join-Path $projectDir '.firebender/.session/agent-edits.txt'

    # Si no hay registro de ediciones del agente, no validamos nada
    if (-not (Test-Path $editsLog)) { Emit-Empty }

    $changedFiles = @(Get-Content $editsLog -ErrorAction SilentlyContinue |
        Where-Object { $_ -match '\.(ts|tsx)$' } |
        ForEach-Object { $_ -replace '\\', '/' } |
        Sort-Object -Unique)

    if ($changedFiles.Count -eq 0) { Emit-Empty }

    Push-Location $projectDir
    try {
        $output = cmd /c "npm run typecheck 2>&1"
        $code = $LASTEXITCODE

        # Limpiar el log de la sesion despues de validar
        # (asi el proximo turno empieza fresco)
        Remove-Item $editsLog -Force -ErrorAction SilentlyContinue

        if ($code -eq 0) { Emit-Empty }

        $allLines = @($output) -split "`r?`n"

        # Sanidad: fallo del entorno, no del codigo
        $head = ($allLines | Select-Object -First 5) -join "`n"
        if ($head -match 'Unknown command' -or $head -match 'is not recognized') {
            Emit-Empty
        }

        # Filtrar errores TS solo a archivos editados por el agente
        $relevantErrors = @()
        foreach ($line in $allLines) {
            if ($line -notmatch '\.tsx?\(\d+,\d+\):\s+error TS') { continue }
            foreach ($f in $changedFiles) {
                if ($line -match [regex]::Escape($f)) {
                    $relevantErrors += $line
                    break
                }
            }
            if ($relevantErrors.Count -ge 10) { break }
        }

        if ($relevantErrors.Count -eq 0) { Emit-Empty }

        $errSnippet = ($relevantErrors -join "`n").Trim()
        $msg = "El typecheck automatico detecto errores en archivos que editaste en esta sesion. Arreglalos:`n`n$errSnippet"
        $obj = @{ followup_message = $msg } | ConvertTo-Json -Compress
        Write-Output $obj
    } finally {
        Pop-Location
    }
} catch {
    Emit-Empty
}

exit 0
