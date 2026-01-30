# Análisis y Soluciones de Problemas de Tokens JWT

## Problemas Identificados

### 1. **Tokens Expirados - Falta de Refresh Proactivo**
**Problema:** Los usuarios reportaban tokens expirados frecuentemente porque el sistema solo refrescaba tokens de forma reactiva (después de recibir error 401).

**Solución Implementada:**
- ✅ Creado hook `useTokenRefresh` que monitorea tokens cada minuto
- ✅ Refresh automático 5 minutos antes de expiración
- ✅ Refresh al volver la app al foreground
- ✅ Sistema de deduplicación para evitar race conditions

### 2. **Sincronización entre AuthService y Store**
**Problema:** Posible desincronización entre el token en AuthService y el store de Zustand.

**Solución Implementada:**
- ✅ Mejorado `refreshAccessToken` para sincronizar `tokenExpiresAt` y `refreshToken`
- ✅ Logs detallados de expiración con timestamps ISO
- ✅ Validación de sincronización en interceptor de API
- ✅ Detección de estados críticos (usuario autenticado sin token)

### 3. **Manejo de Errores de Red y Timeouts**
**Problema:** El refresh de tokens podía quedarse colgado sin timeout, causando que la app se congele.

**Solución Implementada:**
- ✅ Timeout de 30 segundos en `performTokenRefresh`
- ✅ Uso de AbortController para cancelar requests
- ✅ Manejo específico de errores de timeout
- ✅ Limpieza automática de auth data cuando refresh token es inválido

### 4. **Edge Cases en Flujo de Refresh**
**Problema:** Varios casos edge no manejados correctamente.

**Soluciones Implementadas:**
- ✅ Validación de refresh token antes de intentar refresh
- ✅ Validación de respuesta del servidor (tokens presentes)
- ✅ Limpieza automática si refresh token expiró (401/403)
- ✅ Manejo de tokens sin `tokenExpiresAt` (datos legacy)
- ✅ Prevención de múltiples refreshes simultáneos a nivel de hook

### 5. **Falta de Visibilidad en Problemas**
**Problema:** Difícil diagnosticar problemas de tokens en producción.

**Solución Implementada:**
- ✅ Logs mejorados con emojis y contexto
- ✅ Timestamps ISO en logs de expiración
- ✅ Información de minutos hasta expiración
- ✅ Detección y logging de estados críticos
- ✅ Información detallada en errores de refresh

## Arquitectura de la Solución

```
┌─────────────────────────────────────────────────────────────┐
│                      App Component                          │
│                  (useTokenRefresh hook)                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Verifica cada 1 minuto
                     │ Verifica al volver al foreground
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Auth Store (Zustand)                     │
│  - shouldRefreshToken() → Verifica si falta < 5 min         │
│  - refreshAccessToken() → Llama a AuthService               │
│  - Sincroniza token, refreshToken, tokenExpiresAt           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      AuthService                            │
│  - refreshToken() → Deduplicación de llamadas               │
│  - performTokenRefresh() → Lógica real con timeout          │
│  - Validaciones y manejo de errores robusto                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Interceptor                           │
│  - Refresh reactivo en errores 401                          │
│  - Detección de problemas de sincronización                 │
│  - Retry automático después de refresh                      │
└─────────────────────────────────────────────────────────────┘
```

## Flujo de Refresh Proactivo

1. **Cada minuto:** `useTokenRefresh` verifica si `shouldRefreshToken()` es true
2. **5 minutos antes de expirar:** Se detecta que el token necesita refresh
3. **Deduplicación:** Se verifica que no haya otro refresh en progreso
4. **Refresh:** Se llama a `authService.refreshToken()`
5. **Validación:** Se valida que la respuesta tenga los tokens necesarios
6. **Sincronización:** Se actualiza store con nuevo token y expiración
7. **Logging:** Se registra el éxito con información detallada

## Flujo de Refresh Reactivo (Fallback)

1. **Request falla con 401:** Interceptor detecta token expirado
2. **Intento de refresh:** Se intenta refrescar el token (máx 2 intentos)
3. **Retry:** Si el refresh es exitoso, se reintenta el request original
4. **Logout:** Si el refresh falla, se hace logout automático

## Mejoras de Logging

### Antes:
```
Token refresh failed
```

### Ahora:
```
🔄 Token needs refresh - attempting automatic refresh... {
  minutesUntilExpiry: 3,
  expiresAt: '2026-01-29T10:30:00.000Z'
}
✅ Token refreshed successfully (automatic)
✅ Token refreshed and synced with store {
  expiresIn: 3600,
  expiresAt: '2026-01-29T11:30:00.000Z'
}
```

## Casos Edge Manejados

1. ✅ Token sin `tokenExpiresAt` (datos legacy)
2. ✅ Refresh token expirado o inválido
3. ✅ Timeout en request de refresh (30s)
4. ✅ Múltiples refreshes simultáneos
5. ✅ Usuario autenticado sin token (desincronización)
6. ✅ App vuelve al foreground después de horas
7. ✅ Errores de red durante refresh
8. ✅ Respuesta de refresh sin tokens

## Prevención de Race Conditions

### Nivel 1: AuthService
```typescript
private refreshPromise: Promise<RefreshTokenResponse> | null = null;

async refreshToken() {
  if (this.refreshPromise) {
    return this.refreshPromise; // Reusar promesa existente
  }
  this.refreshPromise = this.performTokenRefresh();
  // ...
}
```

### Nivel 2: useTokenRefresh Hook
```typescript
const isRefreshingRef = useRef(false);

if (isRefreshingRef.current) {
  return; // Skip si ya está refrescando
}
isRefreshingRef.current = true;
```

### Nivel 3: API Interceptor
```typescript
if (this.refreshAttempts >= this.maxRefreshAttempts) {
  // Máximo 2 intentos
  await logout();
}
```

## Monitoreo y Debugging

### Logs Clave a Monitorear:
- `🔄 Token needs refresh` - Refresh proactivo iniciado
- `✅ Token refreshed successfully` - Refresh exitoso
- `❌ Token refresh failed` - Refresh falló
- `⚠️ Token is expired` - Token ya expiró
- `❌ CRITICAL: User is authenticated but no token available` - Desincronización

### Métricas Importantes:
- Frecuencia de refreshes proactivos vs reactivos
- Tasa de éxito de refreshes
- Tiempo promedio de refresh
- Número de logouts forzados por refresh fallido

## Testing Recomendado

1. **Test de expiración normal:**
   - Login → Esperar 55 minutos → Verificar refresh automático

2. **Test de foreground:**
   - Login → Background por 1 hora → Foreground → Verificar refresh

3. **Test de red intermitente:**
   - Login → Simular pérdida de red durante refresh → Verificar recuperación

4. **Test de refresh token expirado:**
   - Login → Invalidar refresh token en backend → Verificar logout automático

5. **Test de múltiples tabs/ventanas:**
   - Login en múltiples instancias → Verificar deduplicación

## Próximos Pasos (Opcional)

- [ ] Implementar retry exponencial para refreshes fallidos
- [ ] Agregar métricas de Sentry para refreshes
- [ ] Implementar notificación al usuario antes de logout forzado
- [ ] Agregar tests unitarios para flujos de refresh
- [ ] Implementar refresh silencioso en background (iOS/Android)
