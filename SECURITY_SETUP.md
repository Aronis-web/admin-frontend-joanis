# 🔐 CONFIGURACIÓN DE SEGURIDAD

## ⚠️ ACCIÓN INMEDIATA REQUERIDA

Este proyecto tenía API keys expuestas en el código. Se han movido a variables de entorno.

### 1. Rotar API Keys Comprometidas

#### Google Maps API Key
La key `AIzaSyBWLYNj3GR7rtyYlenKw3Bvyg6_bUce3BA` estaba expuesta en `app.json`.

**PASOS OBLIGATORIOS:**

1. **Ir a Google Cloud Console:**
   - https://console.cloud.google.com/apis/credentials

2. **ELIMINAR la key comprometida:**
   - Buscar la key que termina en `...bUce3BA`
   - Eliminarla inmediatamente

3. **Crear una nueva key:**
   - Click en "Create Credentials" > "API Key"
   - Nombrarla: `admin-frontend-joanis-maps`

4. **Configurar restricciones (CRÍTICO):**
   - **Para Android:**
     - Tipo: "Android apps"
     - Package name: `com.paneladmin.grit`
     - SHA-1: Obtener con `keytool -list -v -keystore ~/.android/debug.keystore`

   - **Para iOS:**
     - Tipo: "iOS apps"
     - Bundle ID: `com.paneladmin.grit`

5. **Habilitar APIs necesarias:**
   - Maps SDK for Android
   - Maps SDK for iOS
   - Places API
   - Geocoding API

#### App ID del Backend
El APP_ID `e28208b8-89b4-4682-80dc-925059424b1f` también estaba expuesto.

**PASOS:**

1. **Contactar al equipo de backend** para rotar este APP_ID
2. Obtener el nuevo APP_ID
3. Configurarlo en el archivo `.env` (ver abajo)

---

### 2. Configurar Variables de Entorno

Tienes **2 opciones** para manejar las variables de entorno:

#### Opción A: Desarrollo Local (archivo `.env`)

1. **Copiar el archivo de ejemplo:**
   ```bash
   cp .env.example .env
   ```

2. **Editar `.env` con tus valores reales:**
   ```bash
   # API Configuration
   EXPO_PUBLIC_API_URL=https://api.app-joanis-backend.com
   EXPO_PUBLIC_PUBLIC_ASSETS_PREFIX=https://api.app-joanis-backend.com/public

   # App Configuration
   EXPO_PUBLIC_APP_ID=tu-nuevo-app-id-aqui
   EXPO_PUBLIC_ENV=dev

   # Google Maps API Key (la nueva que creaste)
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=tu-nueva-google-maps-key-aqui
   ```

3. **VERIFICAR que `.env` está en `.gitignore`:**
   ```bash
   cat .gitignore | grep .env
   ```
   Debe aparecer `.env` en la lista.

#### Opción B: Builds con EAS (EAS Secrets) - RECOMENDADO

Para builds de producción con EAS, las variables se configuran como **secrets encriptados**:

1. **Autenticarse en EAS:**
   ```bash
   eas login
   ```

2. **Configurar secrets automáticamente:**
   ```powershell
   # Ejecutar el script (lee valores de .env y los sube a EAS)
   .\scripts\setup-eas-secrets.ps1
   ```

   O **manualmente** uno por uno:
   ```bash
   # Google Maps API Key
   eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value "tu-nueva-key-aqui" --type string

   # App ID
   eas secret:create --scope project --name EXPO_PUBLIC_APP_ID --value "tu-nuevo-app-id" --type string

   # API URL
   eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value "https://api.app-joanis-backend.com" --type string

   # Assets Prefix
   eas secret:create --scope project --name EXPO_PUBLIC_PUBLIC_ASSETS_PREFIX --value "https://api.app-joanis-backend.com/public" --type string

   # Environment
   eas secret:create --scope project --name EXPO_PUBLIC_ENV --value "production" --type string
   ```

3. **Verificar secrets configurados:**
   ```bash
   eas secret:list
   ```

4. **Hacer build (los secrets se inyectan automáticamente):**
   ```bash
   eas build --platform android --profile production
   eas build --platform ios --profile production
   ```

**Ventajas de EAS Secrets:**
- ✅ Variables encriptadas en servidores de Expo
- ✅ No se commitean a Git
- ✅ Fácil rotación de API keys
- ✅ Diferentes valores por entorno (dev/staging/prod)
- ✅ Compartidas con todo el equipo automáticamente

**Nota:** El archivo `.env` solo se usa para desarrollo local. Para builds con EAS, usa EAS Secrets.

---

### 3. Verificar la Configuración

```bash
# Limpiar caché
rm -rf .expo
rm -rf node_modules/.cache

# Reinstalar
npm install

# Probar que funciona
npm start
```

---

### 4. Para el Equipo

**NUNCA hacer commit de:**
- Archivos `.env` (excepto `.env.example`)
- API keys
- Tokens
- Contraseñas
- Secretos de cualquier tipo

**SIEMPRE:**
- Usar variables de entorno
- Rotar keys comprometidas inmediatamente
- Configurar restricciones en las API keys
- Revisar el código antes de hacer commit

---

### 5. Monitoreo

**Configurar alertas en Google Cloud Console:**
1. Ir a "APIs & Services" > "Credentials"
2. Click en tu API key
3. Configurar "Quota" alerts
4. Revisar "Usage" regularmente

**Si detectas uso sospechoso:**
1. Rotar la key inmediatamente
2. Revisar logs de acceso
3. Reportar al equipo de seguridad

---

## ✅ Checklist de Seguridad

### Para Desarrollo Local:
- [ ] Google Maps API key antigua eliminada
- [ ] Nueva Google Maps API key creada con restricciones
- [ ] APP_ID rotado con el backend
- [ ] Archivo `.env` configurado con valores reales
- [ ] Archivo `.env` NO está en Git (verificar con `git status`)
- [ ] Aplicación probada y funcionando

### Para Builds con EAS:
- [ ] Autenticado en EAS (`eas login`)
- [ ] EAS Secrets configurados (`.\scripts\setup-eas-secrets.ps1` o manualmente)
- [ ] Secrets verificados (`eas secret:list`)
- [ ] Build de prueba exitoso (`eas build --platform android --profile preview`)
- [ ] Variables correctas en producción

### General:
- [ ] Equipo notificado del cambio
- [ ] Documentación actualizada

---

## 📞 Contacto

Si tienes dudas sobre la configuración de seguridad, contacta al equipo de DevOps/Seguridad.
