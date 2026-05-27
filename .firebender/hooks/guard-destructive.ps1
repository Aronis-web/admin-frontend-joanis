# beforeShellExecution hook: pide confirmación al usuario para comandos destructivos.
# Solo se invoca cuando el matcher del hooks.json hace match.

$ErrorActionPreference = 'SilentlyContinue'

function Emit-Permission([string]$perm, [string]$userMsg, [string]$agentMsg) {
    $obj = @{ permission = $perm; user_message = $userMsg; agent_message = $agentMsg } | ConvertTo-Json -Compress
    Write-Output $obj
    exit 0
}

try {
    $raw = [Console]::In.ReadToEnd()
    if (-not $raw) { Emit-Permission 'allow' '' '' }

    $payload = $raw | ConvertFrom-Json
    $cmd = $payload.command
    if (-not $cmd) { Emit-Permission 'allow' '' '' }

    $lc = $cmd.ToLower()

    if ($lc -match 'push\s+.*--force' -or $lc -match 'push\s+--force') {
        Emit-Permission 'ask' "Push con --force detectado. ¿Confirmas?" "Pediste push --force. Necesita confirmación humana."
    }
    if ($lc -match 'remove-item.*-recurse.*-force' -and $lc -match '\bc:\\?') {
        Emit-Permission 'ask' "Borrado recursivo en C:\ detectado. ¿Confirmas la ruta?" "Operación destructiva en raíz C:\. Pide confirmación al usuario."
    }
    if ($lc -match 'rm\s+-rf\s+/') {
        Emit-Permission 'deny' "Bloqueado: 'rm -rf /' es catastrófico." "No ejecutes 'rm -rf /'. Usa rutas específicas."
    }

    Emit-Permission 'allow' '' ''
} catch {
    Emit-Permission 'allow' '' ''
}
