# Electron Desktop App - Panel Admin Grit

## 🚀 Configuración Completada

Tu proyecto ahora soporta versión de escritorio con Electron.

---

## 📦 Instalación de Dependencias

Primero, instala las nuevas dependencias:

```bash
npm install
```

---

## 🛠️ Comandos Disponibles

### Desarrollo

```bash
# Iniciar app de escritorio en modo desarrollo
npm run electron

# O con DevTools abierto
npm run electron:dev
```

### Producción

```bash
# Generar .exe para Windows
npm run build:electron:win

# Generar .dmg para macOS
npm run build:electron:mac

# Generar AppImage para Linux
npm run build:electron:linux

# Generar para todas las plataformas
npm run build:electron
```

---

## 📁 Estructura de Archivos Electron

```
admin-frontend-joanis/
├── electron/
│   ├── main.js              # Proceso principal de Electron
│   ├── preload.js           # Script de preload (seguridad)
│   └── build/               # Iconos para el instalador
│       ├── icon.ico         # Windows (agregar)
│       ├── icon.icns        # macOS (agregar)
│       └── icon.png         # Linux (agregar)
├── web-build/               # Build web (generado automáticamente)
├── dist/                    # Instaladores .exe/.dmg (generado)
└── package.json             # Configuración actualizada
```

---

## 🎨 Agregar Iconos

Para que el instalador tenga iconos personalizados:

1. **Windows (.ico)**: Coloca `icon.ico` en `electron/build/`
2. **macOS (.icns)**: Coloca `icon.icns` en `electron/build/`
3. **Linux (.png)**: Coloca `icon.png` en `electron/build/`

Puedes generar estos iconos desde tu `assets/icon.png` usando herramientas online.

---

## 🔄 Actualizaciones Automáticas

### Configuración Actual

El proyecto está configurado para usar GitHub Releases para actualizaciones.

### Pasos para Habilitar:

1. **Actualizar `package.json`**:
   ```json
   "build": {
     "publish": {
       "provider": "github",
       "owner": "tu-usuario-github",
       "repo": "admin-frontend-joanis"
     }
   }
   ```

2. **Instalar electron-updater**:
   ```bash
   npm install electron-updater
   ```

3. **Descomentar código en `electron/main.js`**:
   ```javascript
   const { autoUpdater } = require('electron-updater');
   autoUpdater.checkForUpdatesAndNotify();
   ```

4. **Publicar releases en GitHub**:
   - Genera el .exe con `npm run build:electron:win`
   - Sube el instalador a GitHub Releases
   - La app verificará automáticamente nuevas versiones

---

## 🌐 Diferencias entre Plataformas

### Funcionalidades Móviles (Android/iOS)
- ✅ Cámara nativa (expo-camera)
- ✅ GPS/Ubicación (expo-location)
- ✅ Almacenamiento seguro (expo-secure-store)
- ✅ Notificaciones push

### Funcionalidades Desktop (Electron)
- ✅ Cámara web (navigator.mediaDevices)
- ✅ Geolocalización web
- ✅ localStorage/IndexedDB
- ✅ Notificaciones de sistema
- ✅ Pantalla grande optimizada
- ✅ Teclado y mouse

---

## 🔧 Detección de Plataforma

Usa el nuevo archivo `src/utils/platform.ts`:

```typescript
import { isElectron, isDesktop, isMobile } from '@/utils/platform';

if (isDesktop()) {
  // Código específico para desktop
}

if (isMobile()) {
  // Código específico para móvil
}
```

---

## 📊 Tamaños Aproximados

- **APK Android**: ~35-50 MB (sin cambios)
- **IPA iOS**: ~40-60 MB (sin cambios)
- **EXE Windows**: ~120-150 MB (incluye Chromium)
- **DMG macOS**: ~130-160 MB
- **AppImage Linux**: ~120-150 MB

---

## 🐛 Troubleshooting

### Error: "Cannot find module 'electron'"
```bash
npm install
```

### Error: "Port 8081 already in use"
```bash
# Detén el servidor Expo y vuelve a intentar
```

### El .exe no se genera
```bash
# Asegúrate de tener los iconos en electron/build/
# O comenta temporalmente la línea "icon" en package.json
```

---

## 📝 Próximos Pasos

1. ✅ Instalar dependencias: `npm install`
2. ✅ Probar en desarrollo: `npm run electron`
3. ✅ Agregar iconos en `electron/build/`
4. ✅ Generar primer .exe: `npm run build:electron:win`
5. ✅ Configurar auto-updates (opcional)

---

## 🎯 Distribución

### Opción 1: GitHub Releases (Gratis)
- Sube el .exe a GitHub Releases
- Los usuarios descargan e instalan manualmente
- Auto-updates funcionan automáticamente

### Opción 2: Microsoft Store (Pago)
- Distribución oficial de Windows
- Requiere certificado de desarrollador
- Actualizaciones manejadas por la tienda

### Opción 3: Servidor propio
- Hospeda el .exe en tu servidor
- Configura electron-updater para apuntar a tu servidor

---

¡Tu app ahora está lista para escritorio! 🎉
