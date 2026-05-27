# beforeReadFile hook: bloquea lectura completa de archivos pesados o de carpetas de build.
# Devuelve JSON: { "permission": "allow" | "deny", "user_message": "..." }

$ErrorActionPreference = 'SilentlyContinue'

function Emit-Allow {
    Write-Output '{"permission":"allow"}'
    exit 0
}

function Emit-Deny([string]$message) {
    $obj = @{ permission = 'deny'; user_message = $message } | ConvertTo-Json -Compress
    Write-Output $obj
    exit 0
}

try {
    $raw = [Console]::In.ReadToEnd()
    if (-not $raw) { Emit-Allow }

    $payload = $raw | ConvertFrom-Json
    $file = $payload.file_path
    if (-not $file) { Emit-Allow }

    $f = ($file -replace '\\', '/').ToLower()

    # Carpetas de build / dependencias
    if ($f -match '/(dist|web-build|node_modules|android/build|ios/build|vendor|gradle_cache)/') {
        Emit-Deny "Bloqueado: '$file' es un artefacto de build. Si necesitas algo de allí, pide al usuario el dato específico."
    }

    # Logs viejos de Android
    if ($f -match '/android/.*\.log$') {
        Emit-Deny "Bloqueado: log de build Android. Estos archivos son artefactos y no aportan contexto útil."
    }

    # Ubigeo: tabla de 8.961 líneas
    if ($f -match '/src/constants/ubigeo\.ts$') {
        Emit-Deny "Bloqueado: 'ubigeo.ts' tiene 192KB de datos estáticos. Usa 'grep' con el código exacto, o 'read_file' con offset/limit acotado a las líneas que necesitas."
    }

    Emit-Allow
} catch {
    Emit-Allow
}
