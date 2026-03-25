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

#### Generar APK de Producción
Para generar el APK del proyecto usando EAS Build:

```bash
cd C:/Users/aaron/IdeaProjects/admin-frontend-joanis/admin-frontend-joanis
npx eas-cli build --platform android --profile production
```

**Notas:**
- El comando incrementa automáticamente el versionCode
- El APK se genera en la nube usando EAS Build
- Al finalizar, se proporciona un enlace de descarga del APK
- El proceso toma aproximadamente 10-20 minutos
- Requiere cuenta de Expo configurada

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
