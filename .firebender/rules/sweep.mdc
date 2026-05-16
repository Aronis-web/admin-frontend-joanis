# SWEEP.md - Reglas y Configuración del Proyecto

## Reglas de Git

### Commits y Push
- **IMPORTANTE**: Después de cada cambio realizado, debes hacer commit y push inmediatamente.
- No acumules cambios sin hacer commit.
- Cada modificación debe ser versionada de inmediato.

## Reglas de Documentación

### Archivos de Documentación
- **NO crear archivos de documentación** a menos que se solicite explícitamente.
- No generar archivos README, guías, resúmenes o documentación técnica sin autorización.
- Enfocarse en el código funcional, no en documentación adicional.

## Comandos Útiles

### Build

#### Generar Versión de Escritorio (Electron)

**Desarrollo:**
```bash
cd C:/Users/aaron/IdeaProjects/admin-frontend-joanis/admin-frontend-joanis

# Opción 1: Método recomendado (2 pasos)
# Paso 1: Ejecutar en una terminal
npm run electron:run

# Paso 2: Abrir Electron en otra terminal (después de que el servidor esté corriendo)
npx electron electron/main.js

# Opción 2: Método automático (PowerShell)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npx serve web-build -p 8081" -WindowStyle Minimized
Start-Sleep -Seconds 5
npx electron electron/main.js
```

**Nota:** El comando `npm run electron:run` tiene un problema con `concurrently` que no ejecuta Electron automáticamente. Por eso se recomienda abrir Electron manualmente en una segunda terminal.

**Generar .exe para Windows:**
```bash
cd C:/Users/aaron/IdeaProjects/admin-frontend-joanis/admin-frontend-joanis
npm run build:electron:win
```

**Notas:**
- El .exe se genera en la carpeta `dist/`
- Incluye instalador NSIS con opciones de instalación
- Tamaño aproximado: 120-150 MB
- Soporta actualizaciones automáticas vía GitHub Releases
- Ver `README_ELECTRON.md` para más detalles

#### Generar APK de Producción (Local - Recomendado)

**Build local usando Gradle** (evita límites de EAS Build):

```powershell
# ===== PASO 1: Variables de configuración =====
$PROJECT = "C:/Users/Aaron/IdeaProjects/admin-frontend-joanis"
$BUILD_DIR = "C:\erp"
$OUTPUT_DIR = "C:\Users\Aaron\OneDrive\Desktop\apps Erp aio"

# Configurar JAVA_HOME y ANDROID_HOME (CRÍTICO)
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"  # Java 21
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GRADLE_USER_HOME = "C:\gradle_cache"  # Cache limpio
$env:GRADLE_OPTS = "-Xmx4g -XX:MaxMetaspaceSize=1g"  # Aumentar memoria

Write-Host "JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Green
Write-Host "ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Green
Write-Host "GRADLE_OPTS: $env:GRADLE_OPTS" -ForegroundColor Green

# ===== PASO 2: Obtener versión del app.json =====
$appJson = Get-Content "$PROJECT\app.json" | ConvertFrom-Json
$VERSION = $appJson.expo.version
Write-Host "Versión detectada: $VERSION" -ForegroundColor Cyan

# ===== PASO 3: Limpiar directorios =====
Write-Host "Limpiando directorios..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $BUILD_DIR -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "C:\gradle_cache" -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path "C:\gradle_cache" -Force | Out-Null

# ===== PASO 4: Copiar proyecto con robocopy (evita paths largos) =====
Write-Host "Copiando proyecto con robocopy..." -ForegroundColor Yellow
# Excluir node_modules, android, .git (se regenerarán)
robocopy $PROJECT $BUILD_DIR /E /XD node_modules android .git /NFL /NDL /NJH /NJS /NC /NS /NP

# ===== PASO 5: Instalar dependencias =====
Set-Location $BUILD_DIR
Write-Host "Instalando dependencias..." -ForegroundColor Yellow
npm install

# ===== PASO 6: Generar proyecto Android con prebuild =====
Write-Host "Generando proyecto Android..." -ForegroundColor Yellow
npx expo prebuild --platform android --clean

# ===== PASO 7: Crear local.properties con SDK path =====
Write-Host "Creando local.properties..." -ForegroundColor Yellow
"sdk.dir=$($env:ANDROID_HOME -replace '\\', '/')" | Out-File -FilePath "$BUILD_DIR\android\local.properties" -Encoding UTF8

# ===== PASO 8: Compilar APK con Gradle =====
Set-Location "$BUILD_DIR\android"
Write-Host "Compilando APK (puede tardar 5-10 minutos)..." -ForegroundColor Yellow
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon

# ===== PASO 9: Copiar APK a carpeta de salida =====
$APK_SOURCE = "$BUILD_DIR\android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $APK_SOURCE) {
    $size = (Get-Item $APK_SOURCE).Length / 1MB
    Write-Host "APK generado! Tamaño: $([math]::Round($size, 2)) MB" -ForegroundColor Green
    Copy-Item $APK_SOURCE "$OUTPUT_DIR\ERP-aio-v$VERSION.apk" -Force
    Write-Host "APK copiado a: $OUTPUT_DIR\ERP-aio-v$VERSION.apk" -ForegroundColor Green
} else {
    Write-Host "ERROR: APK no encontrado" -ForegroundColor Red
}

# ===== PASO 10: Volver al proyecto original =====
Set-Location $PROJECT
Write-Host "Proceso completado!" -ForegroundColor Green
```

**Carpeta de salida:** `C:\Users\Aaron\OneDrive\Desktop\apps Erp aio\`
**Formato del archivo:** `ERP-aio-v{VERSION}.apk` (ej: `ERP-aio-v1.0.31.apk`)

**Requisitos previos:**
- ✅ Android Studio instalado (para Java 21 JBR)
- ✅ Android SDK configurado en `%LOCALAPPDATA%\Android\Sdk`
- ✅ Variables de entorno: `JAVA_HOME`, `ANDROID_HOME`, `GRADLE_USER_HOME`, `GRADLE_OPTS`

**Notas importantes:**
- **Java 21 requerido**: No usar Java 25 (incompatible con Gradle/React Native)
- **Ruta corta `C:\erp`**: Evita errores de CMake con paths largos (límite 250 caracteres)
- **Robocopy**: Maneja mejor paths largos que `Copy-Item`
- **Cache limpio**: Usar `C:\gradle_cache` evita corrupción de cache
- **Memoria aumentada**: `-Xmx4g` evita errores de OutOfMemoryError
- **Sin daemon**: `--no-daemon` previene problemas de memoria persistentes
- **Solo arm64-v8a**: Reduce tiempo de compilación (soporta 95% de dispositivos Android modernos)
- **Tiempo estimado**: 5-10 minutos en la primera compilación, 2-3 minutos en subsiguientes

#### Generar APK con EAS Build (Nube - Límite mensual)

```bash
cd C:/Users/aaron/IdeaProjects/admin-frontend-joanis/admin-frontend-joanis
npx eas-cli build --platform android --profile production
```

**Notas:**
- EAS Build tiene límite de builds gratuitos por mes
- El APK se genera en la nube
- Al finalizar, se proporciona un enlace de descarga

#### Perfiles de Build Disponibles (eas.json)
- `production`: APK de producción con auto-incremento de versión
- `preview`: APK para pruebas internas
- `preview-apk`: APK básico de preview

#### Preparar Proyecto antes del Build
Si hay problemas con dependencias, ejecutar:

```bash
# Actualizar dependencias a versiones compatibles
npx expo install --fix

# Regenerar directorio android
Remove-Item -Recurse -Force android
npx expo prebuild --platform android
```

### Test
```bash
# Agregar comandos de test aquí cuando se identifiquen
```

### Lint
```bash
npm run lint
```

### Typecheck
```bash
npm run typecheck
```

## Estilo de Código

### Convenciones
- Seguir las convenciones existentes en el proyecto
- Mantener consistencia con el código actual

## Estructura del Proyecto

### Información General
- Proyecto: admin-frontend-joanis
- Framework: React Native / Expo
- Lenguaje: TypeScript
