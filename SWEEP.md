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
# Variables
$PROJECT = "C:/Users/aaron/IdeaProjects/admin-frontend-joanis/admin-frontend-joanis"
$BUILD_DIR = "C:\erp"
$OUTPUT_DIR = "C:\Users\aaron\OneDrive\Desktop\apps Erp aio"

# 1. Obtener versión del app.json
$appJson = Get-Content "$PROJECT\app.json" | ConvertFrom-Json
$VERSION = $appJson.expo.version

# 2. Limpiar y copiar proyecto a ruta corta (evita límite de 250 caracteres de CMake)
Remove-Item -Recurse -Force $BUILD_DIR -ErrorAction SilentlyContinue
Copy-Item -Recurse $PROJECT $BUILD_DIR

# 3. Limpiar y regenerar android en ruta corta
Set-Location $BUILD_DIR
Remove-Item -Recurse -Force node_modules, android -ErrorAction SilentlyContinue
npm install
npx expo prebuild --platform android

# 4. Compilar APK
Set-Location "$BUILD_DIR\android"
./gradlew assembleRelease

# 5. Copiar APK con versión en el nombre
Copy-Item "$BUILD_DIR\android\app\build\outputs\apk\release\app-release.apk" "$OUTPUT_DIR\ERP-aio-v$VERSION.apk"

# 6. Volver al proyecto original
Set-Location $PROJECT

Write-Host "APK generado: $OUTPUT_DIR\ERP-aio-v$VERSION.apk"
```

**Carpeta de salida:** `C:\Users\aaron\OneDrive\Desktop\apps Erp aio\`
**Formato del archivo:** `ERP-aio-v{VERSION}.apk` (ej: `ERP-aio-v1.0.2.apk`)

**Notas:**
- Se usa ruta corta `C:\erp` para evitar errores de CMake con paths largos (límite 250 caracteres)
- El build local toma ~5-10 minutos dependiendo del hardware
- Requiere Android SDK instalado (`ANDROID_HOME` configurado)
- La versión se extrae automáticamente de `app.json`

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
