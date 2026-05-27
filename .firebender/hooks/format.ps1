# afterFileEdit hook:
#  1. Formatea con Prettier el archivo editado si es codigo fuente en src/.
#  2. Registra el path en .firebender/.session/agent-edits.txt para que el stop
#     hook sepa que archivos toco el agente en esta sesion.
# Falla silenciosamente (exit 0) para no bloquear el flujo del agente.

$ErrorActionPreference = 'SilentlyContinue'

try {
    $raw = [Console]::In.ReadToEnd()
    if (-not $raw) { exit 0 }

    $payload = $raw | ConvertFrom-Json
    $file = $payload.file_path
    if (-not $file) { exit 0 }

    $projectDir = $env:FIREBENDER_PROJECT_DIR
    if (-not $projectDir) { $projectDir = (Get-Location).Path }

    $fileNorm = $file -replace '\\', '/'
    $isSourceCode = ($fileNorm -match '\.(ts|tsx|js|jsx|json)$')
    $isInSrc = ($fileNorm -match '/src/')
    $isUbigeo = ($fileNorm -match 'ubigeo\.ts$')

    # 1) Registrar para el stop hook (cualquier ts/tsx, incluso fuera de src)
    if ($fileNorm -match '\.(ts|tsx)$' -and -not $isUbigeo) {
        $sessionDir = Join-Path $projectDir '.firebender/.session'
        if (-not (Test-Path $sessionDir)) {
            New-Item -ItemType Directory -Path $sessionDir -Force | Out-Null
        }
        $editsLog = Join-Path $sessionDir 'agent-edits.txt'
        # Path relativo al proyecto
        $rel = $fileNorm -replace [regex]::Escape(($projectDir -replace '\\', '/') + '/'), ''
        Add-Content -Path $editsLog -Value $rel -Encoding UTF8
    }

    # 2) Formatear con prettier (solo src/, evitar ubigeo)
    if ($isSourceCode -and $isInSrc -and -not $isUbigeo) {
        Push-Location $projectDir
        try {
            cmd /c "npx --no-install prettier --write --log-level silent `"$file`" 2>nul" | Out-Null
        } finally {
            Pop-Location
        }
    }
} catch {
    # Silencio absoluto
}

exit 0
