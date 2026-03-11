# Documentación: Sistema de Login y Renovación de Tokens

## Tabla de Contenidos
1. [Resumen General](#resumen-general)
2. [Endpoints del Backend](#endpoints-del-backend)
3. [Flujo de Login](#flujo-de-login)
4. [Flujo de Renovación de Token](#flujo-de-renovación-de-token)
5. [Archivos Principales](#archivos-principales)
6. [Almacenamiento de Datos](#almacenamiento-de-datos)
7. [Headers Requeridos](#headers-requeridos)
8. [Manejo de Errores](#manejo-de-errores)
9. [Seguridad](#seguridad)
10. [Casos Especiales](#casos-especiales)

---

## Resumen General

El sistema de autenticación utiliza **JWT (JSON Web Tokens)** con dos tipos de tokens:
- **Access Token**: Token de corta duración para autenticar requests
- **Refresh Token**: Token de larga duración para renovar el access token

### Configuración Base
```typescript
// src/utils/config.ts
API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080'
APP_ID: process.env.EXPO_PUBLIC_APP_ID || 'e28208b8-89b4-4682-80dc-925059424b1f'
```

---

## Endpoints del Backend

### 1. POST /auth/login
**Descripción**: Autenticación de usuario con email y password

**Request:**
```typescript
// Headers
{
  "Content-Type": "application/json",
  "X-App-Id": "e28208b8-89b4-4682-80dc-925059424b1f"
}

// Body
{
  "email": "usuario@ejemplo.com",
  "password": "contraseña123"
}
```

**Response (200 OK):**
```typescript
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "accessTokenExpiresIn": 3600,  // segundos (1 hora)
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-del-usuario",
    "email": "usuario@ejemplo.com",
    "name": "Nombre Usuario",
    "phone": "+51999999999",
    "avatar": "url-avatar",
    "roles": [
      {
        "id": "role-uuid",
        "code": "ADMIN",
        "name": "Administrador",
        "description": "Rol de administrador"
      }
    ],
    "permissions": ["USERS_READ", "USERS_WRITE", ...]
  }
}
```

**Errores:**
- `400 Bad Request`: Credenciales inválidas
- `401 Unauthorized`: Email o password incorrectos
- `500 Server Error`: Error del servidor

**Archivo Frontend**: `src/services/AuthService.ts` (líneas 33-92)

---

### 2. POST /auth/refresh
**Descripción**: Renovar el access token usando el refresh token

**Request:**
```typescript
// Headers
{
  "X-App-Id": "e28208b8-89b4-4682-80dc-925059424b1f",
  "Content-Type": "application/json"  // Solo si se envía body
}

// Body (Mobile - React Native)
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

// Body (Web - Cookie-based)
// No se envía body, el refresh token va en cookie HTTP-only
```

**Response (200 OK):**
```typescript
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "accessTokenExpiresIn": 3600,  // segundos
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  // Nuevo refresh token
}
```

**Errores:**
- `401 Unauthorized`: Refresh token inválido o expirado
- `403 Forbidden`: Refresh token revocado
- `500 Server Error`: Error del servidor

**Archivo Frontend**: `src/services/AuthService.ts` (líneas 101-167)

---

### 3. POST /auth/logout
**Descripción**: Cerrar sesión del usuario (invalida tokens en el backend)

**Request:**
```typescript
// Headers
{
  "X-App-Id": "e28208b8-89b4-4682-80dc-925059424b1f"
}

// No requiere body
```

**Response (200 OK):**
```typescript
// Sin contenido (void)
```

**Archivo Frontend**: `src/services/AuthService.ts` (líneas 173-189)

---

### 4. GET /iam/users/:userId/effective-permissions
**Descripción**: Obtener permisos efectivos del usuario (llamado automáticamente después del login)

**Request:**
```typescript
// Headers
{
  "Content-Type": "application/json",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "X-App-Id": "e28208b8-89b4-4682-80dc-925059424b1f"
}
```

**Response (200 OK):**
```typescript
[
  "USERS_READ",
  "USERS_WRITE",
  "PRODUCTS_READ",
  "INVENTORY_MANAGE",
  ...
]
```

**Archivo Frontend**: `src/services/AuthService.ts` (líneas 54-80)

---

## Flujo de Login

### Diagrama de Flujo
```
Usuario ingresa credenciales
         ↓
LoginScreen.tsx (handleLogin)
         ↓
useAuthStore.loginWithCredentials()
         ↓
AuthService.login(email, password)
         ↓
POST /auth/login
         ↓
¿Respuesta exitosa?
    ↓ Sí              ↓ No
    ↓                 ↓
    ↓            Mostrar error
    ↓                 ↓
    ↓            Fin (login fallido)
    ↓
¿Usuario tiene permisos?
    ↓ No              ↓ Sí
    ↓                 ↓
GET /iam/users/:id/effective-permissions
    ↓                 ↓
Agregar permisos     ↓
    ↓                 ↓
    └────────┬────────┘
             ↓
Almacenar tokens en SecureStorage
             ↓
Almacenar usuario en AsyncStorage
             ↓
Sincronizar con AuthService
             ↓
Actualizar estado en useAuthStore
             ↓
Navegar a selección de empresa/sitio
             ↓
Fin (login exitoso)
```

### Código Detallado

#### 1. Inicio del Login (LoginScreen.tsx)
```typescript
// src/screens/Auth/LoginScreen.tsx (líneas 38-62)
const handleLogin = async () => {
  console.log('🔑 Iniciando proceso de login...');
  const success = await loginWithCredentials(email, password, rememberMe);

  if (!success) {
    console.log('❌ Login falló');
    return;
  }

  console.log('✅ Login exitoso, limpiando contexto de tenant...');
  await clearTenantContext();
  console.log('✅ Login completado - La navegación se manejará automáticamente');
};
```

#### 2. Login con Credenciales (auth.ts store)
```typescript
// src/store/auth.ts (líneas 173-249)
loginWithCredentials: async (email, password, rememberMe = false) => {
  set({ isLoading: true, error: null });

  // Llamar al AuthService
  const response = await authService.login(email, password);

  // Validar datos del usuario
  if (!response.user || !response.user.id) {
    throw new Error('Invalid user data received from server');
  }

  // Limpiar selección previa de empresa/sitio
  await AsyncStorage.removeItem(config.STORAGE_KEYS.CURRENT_COMPANY);
  await AsyncStorage.removeItem(config.STORAGE_KEYS.CURRENT_SITE);

  // Almacenar tokens en SecureStorage (encriptado)
  await secureStorage.setItem(config.STORAGE_KEYS.AUTH_TOKEN, response.accessToken);
  await secureStorage.setItem(config.STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
  await secureStorage.setItem(config.STORAGE_KEYS.REMEMBER_ME, rememberMe ? 'true' : 'false');

  // Calcular expiración del token
  let expiresAt: number | null = null;
  if (rememberMe) {
    // 30 días si "Recordarme" está activado
    expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
  } else if (response.accessTokenExpiresIn) {
    // Usar expiración del servidor
    expiresAt = Date.now() + response.accessTokenExpiresIn * 1000;
  }

  if (expiresAt) {
    await secureStorage.setItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
  }

  // Almacenar usuario en AsyncStorage
  await AsyncStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(response.user));

  // Sincronizar token con AuthService
  authService.setAccessToken(response.accessToken);

  // Actualizar estado
  set({
    user: response.user,
    token: response.accessToken,
    refreshToken: response.refreshToken,
    tokenExpiresAt: expiresAt,
    isAuthenticated: true,
    error: null,
    isLoading: false,
    currentCompany: null,
    currentSite: null,
  });

  return true;
};
```

#### 3. Llamada al Backend (AuthService.ts)
```typescript
// src/services/AuthService.ts (líneas 33-92)
async login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${this.baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Id': this.appId,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw this.createAuthError(response.status, errorData.message || 'Login failed');
  }

  const data: LoginResponse = await response.json();

  // Si el usuario no tiene permisos, obtenerlos
  if (data.user && (!data.user.permissions || data.user.permissions.length === 0)) {
    const permissionsResponse = await fetch(
      `${this.baseUrl}/iam/users/${data.user.id}/effective-permissions`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.accessToken}`,
          'X-App-Id': this.appId,
        },
      }
    );

    if (permissionsResponse.ok) {
      const permissions = await permissionsResponse.json();
      if (Array.isArray(permissions)) {
        data.user.permissions = permissions;
      }
    }
  }

  // Almacenar tokens y datos del usuario
  await this.storeAuthData(data);

  return data;
}
```

---

## Flujo de Renovación de Token

### Diagrama de Flujo
```
Request API con token expirado
         ↓
Interceptor detecta 401
         ↓
¿Ya se intentó renovar?
    ↓ Sí              ↓ No
    ↓                 ↓
Logout           Marcar como reintento
    ↓                 ↓
Fin              AuthService.refreshToken()
                      ↓
                 ¿Refresh en progreso?
                   ↓ Sí         ↓ No
                   ↓            ↓
              Reusar promise    ↓
                   ↓            ↓
                   └─────┬──────┘
                         ↓
                 POST /auth/refresh
                         ↓
                 ¿Respuesta exitosa?
                   ↓ Sí         ↓ No
                   ↓            ↓
                   ↓       Logout + Error
                   ↓            ↓
            Actualizar tokens   Fin
                   ↓
            Reintentar request original
                   ↓
                  Fin
```

### Código Detallado

#### 1. Detección de Token Expirado (client.ts)
```typescript
// src/services/api/client.ts (líneas 236-276)
// Response interceptor
if (error.response?.status === 401 && !originalRequest._retry) {
  originalRequest._retry = true;

  // Prevenir loops infinitos
  if (this.refreshAttempts >= this.maxRefreshAttempts) {
    console.error(`Max refresh attempts (${this.maxRefreshAttempts}) reached, logging out...`);
    this.refreshAttempts = 0;
    await useAuthStore.getState().logout();
    return Promise.reject(error);
  }

  this.refreshAttempts++;

  try {
    console.log(`Attempting token refresh (${this.refreshAttempts}/${this.maxRefreshAttempts})...`);

    // Usar AuthService para renovar token
    await authService.refreshToken();
    const newToken = authService.getAccessToken();

    if (newToken) {
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      console.log('Token refreshed, retrying request...');
      this.refreshAttempts = 0;
      return this.client(originalRequest);
    } else {
      console.log('No new token after refresh, logging out...');
      this.refreshAttempts = 0;
      await useAuthStore.getState().logout();
    }
  } catch (refreshError) {
    console.error('Token refresh failed:', refreshError);
    this.refreshAttempts = 0;
    await useAuthStore.getState().logout();
  }
}
```

#### 2. Renovación de Token (AuthService.ts)
```typescript
// src/services/AuthService.ts (líneas 101-167)
async refreshToken(): Promise<RefreshTokenResponse> {
  // Si ya hay una renovación en progreso, reusar la promesa
  if (this.refreshPromise) {
    console.log('🔄 Token refresh already in progress, reusing existing promise');
    return this.refreshPromise;
  }

  // Crear nueva promesa de renovación
  this.refreshPromise = this.performTokenRefresh();

  try {
    const result = await this.refreshPromise;
    return result;
  } finally {
    // Limpiar promesa después de completar
    this.refreshPromise = null;
  }
}

private async performTokenRefresh(): Promise<RefreshTokenResponse> {
  console.log('🔄 Starting token refresh...');

  const headers: Record<string, string> = {
    'X-App-Id': this.appId,
  };

  // Para mobile, enviar refresh token en el body
  if (this.refreshTokenValue) {
    headers['Content-Type'] = 'application/json';
  }

  const body = this.refreshTokenValue
    ? JSON.stringify({ refreshToken: this.refreshTokenValue })
    : undefined;

  const response = await fetch(`${this.baseUrl}/auth/refresh`, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('❌ Token refresh failed:', response.status, errorData.message);
    throw this.createAuthError(response.status, errorData.message || 'Token refresh failed');
  }

  const data: RefreshTokenResponse = await response.json();

  // Actualizar tokens almacenados
  await this.updateTokens(data);

  console.log('✅ Token refresh successful');
  return data;
}
```

#### 3. Actualización de Tokens (AuthService.ts)
```typescript
// src/services/AuthService.ts (líneas 324-360)
private async updateTokens(data: RefreshTokenResponse): Promise<void> {
  this.accessToken = data.accessToken;
  this.refreshTokenValue = data.refreshToken;

  // Verificar si "Recordarme" está activado
  const rememberMeStr = await secureStorage.getItem(config.STORAGE_KEYS.REMEMBER_ME);
  const rememberMe = rememberMeStr === 'true';

  // Calcular tiempo de expiración
  if (rememberMe) {
    // Si "Recordarme" está activado, extender sesión a 30 días
    this.tokenExpiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
    console.log('🔐 AuthService: Token updated with extended session (30 days)');
  } else if (data.accessTokenExpiresIn) {
    // Usar expiración del servidor
    this.tokenExpiresAt = Date.now() + data.accessTokenExpiresIn * 1000;
    console.log('🔐 AuthService: Token updated with standard expiration');
  } else {
    this.tokenExpiresAt = null;
  }

  // Almacenar en SecureStorage
  await secureStorage.setItem(config.STORAGE_KEYS.AUTH_TOKEN, data.accessToken);
  if (data.refreshToken) {
    await secureStorage.setItem(config.STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
  }
  if (this.tokenExpiresAt) {
    await secureStorage.setItem(
      config.STORAGE_KEYS.TOKEN_EXPIRES_AT,
      this.tokenExpiresAt.toString()
    );
  }
}
```

#### 4. Renovación Automática (useSessionWarning.ts)
```typescript
// src/hooks/useSessionWarning.ts (líneas 26-61)
// Verificar cada 30 segundos si se debe renovar el token
const interval = setInterval(async () => {
  const now = Date.now();
  const timeUntilExpiry = tokenExpiresAt - now;
  const minutesRemaining = Math.floor(timeUntilExpiry / (60 * 1000));

  const timeSinceLastRefresh = now - lastRefreshAttemptRef.current;
  const minTimeBetweenRefreshes = 1 * 60 * 1000; // 1 minuto

  // Auto-renovar token si:
  // 1. Quedan 15 minutos o menos
  // 2. Ha pasado al menos 1 minuto desde el último intento
  if (
    timeUntilExpiry <= 15 * 60 * 1000 &&
    timeUntilExpiry > 0 &&
    timeSinceLastRefresh >= minTimeBetweenRefreshes
  ) {
    lastRefreshAttemptRef.current = now;

    try {
      console.log(
        `🔄 Auto-refreshing token (${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''} remaining)...`
      );

      const success = await refreshAccessToken();

      if (success) {
        console.log('✅ Token auto-refreshed successfully');
      } else {
        console.error('❌ Token auto-refresh failed');
      }
    } catch (error) {
      console.error('❌ Error auto-refreshing token:', error);
    }
  }
}, 30000); // Verificar cada 30 segundos
```

---

## Archivos Principales

### 1. AuthService.ts
**Ubicación**: `src/services/AuthService.ts`

**Responsabilidades**:
- Comunicación directa con endpoints de autenticación
- Gestión de tokens en memoria
- Almacenamiento seguro de credenciales
- Deduplicación de llamadas de refresh

**Métodos principales**:
- `login(email, password)`: Login de usuario
- `refreshToken()`: Renovar access token
- `logout()`: Cerrar sesión
- `makeAuthenticatedRequest(endpoint, options)`: Request autenticado
- `isAuthenticated()`: Verificar si está autenticado
- `shouldRefreshToken()`: Verificar si debe renovar token
- `isTokenExpired()`: Verificar si token expiró

---

### 2. auth.ts (Store)
**Ubicación**: `src/store/auth.ts`

**Responsabilidades**:
- Estado global de autenticación (Zustand)
- Sincronización con AuthService
- Gestión de empresa y sitio actual
- Verificación de permisos

**Estado**:
```typescript
{
  user: User | null,
  token: string | null,
  refreshToken: string | null,
  tokenExpiresAt: number | null,
  isAuthenticated: boolean,
  isLoading: boolean,
  error: string | null,
  currentCompany: CurrentCompany | null,
  currentSite: CurrentSite | null
}
```

**Métodos principales**:
- `loginWithCredentials(email, password, rememberMe)`: Login completo
- `logout()`: Cerrar sesión
- `initAuth()`: Inicializar autenticación al arrancar app
- `refreshAccessToken()`: Renovar token
- `clearInvalidAuth()`: Limpiar datos de autenticación inválidos
- `hasPermission(permission)`: Verificar permiso
- `hasRole(roleCode)`: Verificar rol

---

### 3. client.ts (API Client)
**Ubicación**: `src/services/api/client.ts`

**Responsabilidades**:
- Cliente HTTP centralizado (Axios)
- Interceptores de request/response
- Manejo automático de renovación de token en 401
- Inyección de headers (Authorization, X-App-Id, tenant context)

**Interceptores**:
- **Request**: Agrega Authorization, X-App-Id, X-Company-Id, X-Site-Id
- **Response**: Maneja 401 (renovación de token), 403 (permisos)

---

### 4. auth.ts (API)
**Ubicación**: `src/services/api/auth.ts`

**Responsabilidades**:
- Wrapper de alto nivel para endpoints de autenticación
- Usa apiClient (Axios) en lugar de fetch directo
- Carga automática de permisos después del login

**Métodos**:
- `login(credentials)`: POST /auth/login
- `register(data)`: POST /auth/register
- `logout()`: POST /auth/logout
- `refreshToken()`: POST /auth/refresh
- `getCurrentUser()`: GET /auth/me
- `updateProfile(data)`: PUT /auth/profile
- `changePassword(oldPassword, newPassword)`: POST /auth/change-password
- `resetPassword(email)`: POST /auth/reset-password

---

### 5. types/auth.ts
**Ubicación**: `src/types/auth.ts`

**Responsabilidades**:
- Definición de tipos TypeScript para autenticación

**Tipos principales**:
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar?: string;
  roles?: Role[];
  permissions?: string[];
}

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  user: User;
}

interface RefreshTokenResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

class AuthError extends Error {
  code: 'INVALID_CREDENTIALS' | 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | ...;
  status?: number;
}
```

---

## Almacenamiento de Datos

### SecureStorage (Datos Sensibles - Encriptados)
**Ubicación**: `src/utils/secureStorage.ts`

**Datos almacenados**:
```typescript
{
  "auth_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_expires_at": "1704067200000",  // timestamp
  "remember_me": "true"  // o "false"
}
```

**Características**:
- Usa `expo-secure-store` en mobile
- Encriptación nativa del sistema operativo
- Solo para datos sensibles (tokens, passwords)

---

### AsyncStorage (Datos No Sensibles)
**Ubicación**: `@react-native-async-storage/async-storage`

**Datos almacenados**:
```typescript
{
  "@joanis:user": "{\"id\":\"...\",\"email\":\"...\",\"name\":\"...\"}",
  "@joanis:current_company": "{\"id\":\"...\",\"name\":\"...\"}",
  "@joanis:current_site": "{\"id\":\"...\",\"code\":\"...\",\"name\":\"...\"}"
}
```

**Características**:
- Sin encriptación
- Para datos no sensibles
- Más rápido que SecureStorage

---

## Headers Requeridos

### Headers en Todos los Requests

#### 1. X-App-Id (OBLIGATORIO)
```typescript
"X-App-Id": "e28208b8-89b4-4682-80dc-925059424b1f"
```
- Identifica la aplicación cliente
- Requerido por el backend para validar origen
- Se agrega automáticamente en `client.ts` (línea 126)

#### 2. Authorization (Para endpoints protegidos)
```typescript
"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```
- Contiene el access token JWT
- Se agrega automáticamente en `client.ts` (línea 100)
- No se incluye en `/auth/login` y `/auth/refresh`

#### 3. Content-Type
```typescript
"Content-Type": "application/json"
```
- Para requests con body JSON
- Se agrega automáticamente en `client.ts`

#### 4. Headers de Contexto Multi-Tenant (Opcionales)
```typescript
"X-User-Id": "uuid-del-usuario"
"X-Company-Id": "uuid-de-la-empresa"
"X-Site-Id": "uuid-del-sitio"
"X-Warehouse-Id": "uuid-del-almacen"
```
- Se agregan automáticamente desde el estado de la app
- Permiten filtrar datos por empresa/sitio
- Se agregan en `client.ts` (líneas 137-148)

---

## Manejo de Errores

### Códigos de Error de Autenticación

#### AuthError Codes
```typescript
type AuthErrorCode =
  | 'INVALID_CREDENTIALS'  // 400 - Email/password incorrectos
  | 'TOKEN_EXPIRED'        // 401 - Token expirado
  | 'TOKEN_INVALID'        // 401 - Token inválido
  | 'UNAUTHORIZED'         // 401 - No autenticado
  | 'FORBIDDEN'            // 403 - Sin permisos
  | 'SERVER_ERROR'         // 500 - Error del servidor
  | 'NETWORK_ERROR';       // 0 - Error de red
```

### Manejo de Errores por Código HTTP

#### 400 Bad Request
```typescript
// AuthService.ts (línea 429)
case 400:
  code = 'INVALID_CREDENTIALS';
  break;
```
**Acción**: Mostrar mensaje de error al usuario

#### 401 Unauthorized
```typescript
// client.ts (líneas 236-276)
if (error.response?.status === 401 && !originalRequest._retry) {
  // Intentar renovar token
  await authService.refreshToken();
  // Reintentar request
  return this.client(originalRequest);
}
```
**Acción**: Renovar token automáticamente y reintentar

#### 403 Forbidden
```typescript
// client.ts (líneas 278-300)
if (error.response?.status === 403) {
  const errorMessage = error.response?.data?.message ||
    'No tienes los permisos necesarios para realizar esta acción.';

  error.isPermissionError = true;
  error.permissionMessage = errorMessage;
}
```
**Acción**: Mostrar mensaje de permisos insuficientes

#### 500 Server Error
```typescript
// AuthService.ts (línea 440)
default:
  code = 'SERVER_ERROR';
```
**Acción**: Mostrar mensaje de error del servidor

---

## Seguridad

### 1. Almacenamiento Seguro de Tokens
- **Access Token**: SecureStorage (encriptado)
- **Refresh Token**: SecureStorage (encriptado)
- **Usuario**: AsyncStorage (no sensible)

### 2. Prevención de Race Conditions
```typescript
// AuthService.ts (líneas 101-118)
async refreshToken(): Promise<RefreshTokenResponse> {
  // Si ya hay una renovación en progreso, reusar la promesa
  if (this.refreshPromise) {
    console.log('🔄 Token refresh already in progress, reusing existing promise');
    return this.refreshPromise;
  }

  this.refreshPromise = this.performTokenRefresh();

  try {
    const result = await this.refreshPromise;
    return result;
  } finally {
    this.refreshPromise = null;
  }
}
```
**Beneficio**: Evita múltiples llamadas simultáneas de refresh que pueden causar detección de reuso de tokens en el backend

### 3. Límite de Intentos de Renovación
```typescript
// client.ts (líneas 241-248)
if (this.refreshAttempts >= this.maxRefreshAttempts) {
  console.error(`Max refresh attempts (${this.maxRefreshAttempts}) reached, logging out...`);
  this.refreshAttempts = 0;
  await useAuthStore.getState().logout();
  return Promise.reject(error);
}
```
**Beneficio**: Previene loops infinitos de renovación

### 4. Renovación Proactiva de Token
```typescript
// useSessionWarning.ts (líneas 40-58)
// Auto-renovar token si quedan 15 minutos o menos
if (
  timeUntilExpiry <= 15 * 60 * 1000 &&
  timeUntilExpiry > 0 &&
  timeSinceLastRefresh >= minTimeBetweenRefreshes
) {
  const success = await refreshAccessToken();
}
```
**Beneficio**: Evita que el usuario experimente errores 401 durante su sesión activa

### 5. Limpieza de Datos al Cerrar Sesión
```typescript
// auth.ts (líneas 455-494)
clearInvalidAuth: async (showSessionExpiredMessage = false) => {
  // Limpiar SecureStorage
  await secureStorage.deleteItem(config.STORAGE_KEYS.AUTH_TOKEN);
  await secureStorage.deleteItem(config.STORAGE_KEYS.REFRESH_TOKEN);
  await secureStorage.deleteItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);
  await secureStorage.deleteItem(config.STORAGE_KEYS.REMEMBER_ME);

  // Limpiar AsyncStorage
  await AsyncStorage.removeItem(config.STORAGE_KEYS.USER);
  await AsyncStorage.removeItem(config.STORAGE_KEYS.CURRENT_COMPANY);
  await AsyncStorage.removeItem(config.STORAGE_KEYS.CURRENT_SITE);

  // Limpiar estado
  set({
    user: null,
    token: null,
    refreshToken: null,
    tokenExpiresAt: null,
    isAuthenticated: false,
    error: null,
    currentCompany: null,
    currentSite: null,
  });

  // Limpiar AuthService
  authService.setAccessToken(null);
}
```

---

## Casos Especiales

### 1. Función "Recordarme"
Cuando el usuario activa "Recordarme" en el login:

```typescript
// auth.ts (líneas 211-217)
if (rememberMe) {
  // 30 días en millisegundos
  expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
  console.log('🔐 Extended session enabled: 30 days');
} else if (response.accessTokenExpiresIn) {
  expiresAt = Date.now() + response.accessTokenExpiresIn * 1000;
}
```

**Comportamiento**:
- Token se renueva automáticamente por 30 días
- Cada renovación extiende la sesión otros 30 días
- El usuario no necesita volver a hacer login

---

### 2. Inicialización de la App
Al abrir la app, se restaura la sesión automáticamente:

```typescript
// auth.ts (líneas 285-408)
initAuth: async () => {
  // Cargar tokens de SecureStorage
  const token = await secureStorage.getItem(config.STORAGE_KEYS.AUTH_TOKEN);
  const refreshToken = await secureStorage.getItem(config.STORAGE_KEYS.REFRESH_TOKEN);
  const tokenExpiresAtStr = await secureStorage.getItem(config.STORAGE_KEYS.TOKEN_EXPIRES_AT);

  // Cargar usuario de AsyncStorage
  const userJson = await AsyncStorage.getItem(config.STORAGE_KEYS.USER);

  if (token && userJson) {
    const user = JSON.parse(userJson);
    const tokenExpiresAt = tokenExpiresAtStr ? parseInt(tokenExpiresAtStr, 10) : null;

    // Si el token expiró, renovarlo
    if (tokenExpiresAt && Date.now() >= tokenExpiresAt) {
      if (refreshToken) {
        const refreshed = await get().refreshAccessToken();
        if (!refreshed) {
          await get().clearInvalidAuth(true);
          return;
        }
      } else {
        await get().clearInvalidAuth();
        return;
      }
    }

    // Sincronizar con AuthService
    authService.setAccessToken(currentToken);

    // Actualizar estado
    set({
      user,
      token: currentToken,
      refreshToken,
      tokenExpiresAt,
      isAuthenticated: true,
    });
  }
}
```

---

### 3. Carga de Permisos
Los permisos se cargan automáticamente después del login:

```typescript
// AuthService.ts (líneas 52-80)
if (data.user && (!data.user.permissions || data.user.permissions.length === 0)) {
  try {
    const permissionsResponse = await fetch(
      `${this.baseUrl}/iam/users/${data.user.id}/effective-permissions`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.accessToken}`,
          'X-App-Id': this.appId,
        },
      }
    );

    if (permissionsResponse.ok) {
      const permissions = await permissionsResponse.json();
      if (Array.isArray(permissions)) {
        data.user.permissions = permissions;
      }
    }
  } catch (permError) {
    console.warn('Error fetching permissions during login:', permError);
    data.user.permissions = [];
  }
}
```

---

### 4. Requests con FormData
Para uploads de archivos, se usa fetch directo en lugar de Axios:

```typescript
// client.ts (líneas 343-348)
if (isFormData) {
  console.log('📦 Using fetch for FormData upload to bypass axios Content-Type issues');
  const isOcrRequest = url.includes('/ocr/scan');
  return this.postFormDataWithFetch<T>(url, data, config, isOcrRequest);
}
```

**Razón**: Axios tiene problemas con el boundary de FormData en React Native

---

## Resumen de Sincronización

### Flujo de Sincronización de Tokens

```
AuthService (memoria)
    ↕ setAccessToken()
useAuthStore (Zustand)
    ↕ secureStorage.setItem()
SecureStorage (encriptado)
```

**Puntos de sincronización**:
1. **Login**: AuthService → Store → SecureStorage
2. **Refresh**: AuthService → Store → SecureStorage
3. **Init**: SecureStorage → Store → AuthService
4. **Logout**: Limpiar todos

---

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │ LoginScreen  │─────▶│ useAuthStore │                     │
│  └──────────────┘      └──────┬───────┘                     │
│                               │                              │
│                               ▼                              │
│                        ┌──────────────┐                      │
│                        │ AuthService  │                      │
│                        └──────┬───────┘                      │
│                               │                              │
│                               ▼                              │
│                        ┌──────────────┐                      │
│                        │  API Client  │                      │
│                        │   (Axios)    │                      │
│                        └──────┬───────┘                      │
│                               │                              │
│  ┌──────────────┐      ┌─────┴────────┐                     │
│  │SecureStorage │◀────▶│ AsyncStorage │                     │
│  │ (encrypted)  │      │ (plain text) │                     │
│  └──────────────┘      └──────────────┘                     │
│                                                               │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  POST /auth/login                                            │
│  POST /auth/refresh                                          │
│  POST /auth/logout                                           │
│  GET  /iam/users/:id/effective-permissions                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Checklist de Validación con Backend

### Login Endpoint
- [ ] URL correcta: `POST /auth/login`
- [ ] Header `X-App-Id` requerido
- [ ] Body con `email` y `password`
- [ ] Response incluye `accessToken`, `refreshToken`, `accessTokenExpiresIn`, `user`
- [ ] Campo `user.permissions` es array (puede estar vacío)
- [ ] Campo `user.roles` es array (puede estar vacío)

### Refresh Endpoint
- [ ] URL correcta: `POST /auth/refresh`
- [ ] Header `X-App-Id` requerido
- [ ] Body con `refreshToken` (mobile) o cookie (web)
- [ ] Response incluye nuevo `accessToken`, `refreshToken`, `accessTokenExpiresIn`
- [ ] Backend invalida el refresh token anterior (rotation)

### Logout Endpoint
- [ ] URL correcta: `POST /auth/logout`
- [ ] Header `X-App-Id` requerido
- [ ] Backend invalida tokens del usuario

### Permissions Endpoint
- [ ] URL correcta: `GET /iam/users/:userId/effective-permissions`
- [ ] Header `Authorization` requerido
- [ ] Header `X-App-Id` requerido
- [ ] Response es array de strings (permisos)

### Validaciones Generales
- [ ] Todos los endpoints validan `X-App-Id`
- [ ] Tokens JWT tienen expiración (`exp` claim)
- [ ] Refresh token tiene mayor duración que access token
- [ ] Backend detecta reuso de refresh tokens (security)
- [ ] Errores 401 devuelven mensaje descriptivo
- [ ] Errores 403 incluyen permisos requeridos en mensaje

---

## Notas Importantes

1. **Deduplicación de Refresh**: El sistema previene múltiples llamadas simultáneas de refresh usando una promesa compartida.

2. **Renovación Proactiva**: El token se renueva automáticamente cuando quedan 15 minutos o menos de expiración.

3. **Sincronización**: AuthService y useAuthStore deben estar siempre sincronizados para evitar inconsistencias.

4. **Seguridad**: Los tokens NUNCA se almacenan en AsyncStorage sin encriptar, solo en SecureStorage.

5. **Headers Multi-Tenant**: Los headers `X-Company-Id`, `X-Site-Id` se agregan automáticamente desde el estado de la app.

6. **FormData**: Los uploads de archivos usan fetch directo en lugar de Axios para evitar problemas con Content-Type boundary.

---

**Fecha de Creación**: 2024
**Última Actualización**: 2024
**Versión del Documento**: 1.0
