# Script para actualizar imports de Alert en todos los archivos
# Cambia de: import { Alert } from 'react-native'
# A: import Alert from '@/utils/alert'

$files = Get-ChildItem -Path "src" -Recurse -Filter "*.tsx" -File |
    Where-Object { (Get-Content $_.FullName -Raw) -match "import.*Alert.*from 'react-native'" }

$count = 0
$errors = @()

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw
        $originalContent = $content

        # Patron 1: import { ..., Alert, ... } from 'react-native';
        # Remover Alert de la lista de imports
        $content = $content -replace "import\s*\{([^}]*),\s*Alert\s*,([^}]*)\}\s*from\s*'react-native';", "import {`$1,`$2} from 'react-native';"
        $content = $content -replace "import\s*\{([^}]*),\s*Alert\s*\}\s*from\s*'react-native';", "import {`$1} from 'react-native';"
        $content = $content -replace "import\s*\{\s*Alert\s*,([^}]*)\}\s*from\s*'react-native';", "import {`$1} from 'react-native';"

        # Patron 2: import { Alert } from 'react-native';
        $content = $content -replace "import\s*\{\s*Alert\s*\}\s*from\s*'react-native';", ""

        # Limpiar imports vacios que puedan quedar
        $content = $content -replace "import\s*\{\s*\}\s*from\s*'react-native';", ""

        # Agregar el nuevo import de Alert al inicio (despues de React)
        if ($content -notmatch "import.*Alert.*from 'react-native'") {
            # Buscar la primera linea de import de react-native
            if ($content -match "(import\s+React[^;]*;)") {
                $content = $content -replace "(import\s+React[^;]*;)", "`$1`nimport Alert from '@/utils/alert';"
            } elseif ($content -match "(import\s*\{[^}]*\}\s*from\s*'react-native';)") {
                $content = $content -replace "(import\s*\{[^}]*\}\s*from\s*'react-native';)", "import Alert from '@/utils/alert';`n`$1"
            }
        }

        # Solo escribir si hubo cambios
        if ($content -ne $originalContent) {
            Set-Content -Path $file.FullName -Value $content -NoNewline
            Write-Host "Actualizado: $($file.FullName)" -ForegroundColor Green
            $count++
        }
    }
    catch {
        Write-Host "Error en: $($file.FullName)" -ForegroundColor Red
        Write-Host "  $_" -ForegroundColor Red
        $errors += $file.FullName
    }
}

Write-Host "`n========================================"
Write-Host "Resumen:"
Write-Host "  Archivos actualizados: $count"
Write-Host "  Errores: $($errors.Count)"
Write-Host "========================================`n"

if ($errors.Count -gt 0) {
    Write-Host "Archivos con errores:"
    foreach ($err in $errors) {
        Write-Host "  - $err"
    }
}
