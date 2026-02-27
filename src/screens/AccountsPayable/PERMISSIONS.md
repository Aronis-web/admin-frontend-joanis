# Documentación de Permisos - Módulo Cuentas por Pagar

## 📋 Descripción

Este documento describe todos los permisos disponibles para el módulo de Cuentas por Pagar y cómo se implementan en el frontend.

## 📊 Resumen de Permisos

**Total de permisos**: 54 permisos individuales + 5 permisos combinados = **59 permisos**

### Categorías:
- 🔍 **Lectura**: 4 permisos
- ✏️ **Escritura**: 3 permisos
- 🔎 **Búsqueda**: 3 permisos
- 🔄 **Estado**: 5 permisos
- 💰 **Pagos**: 5 permisos
- 📊 **Reportes**: 8 permisos
- 📅 **Cronograma**: 4 permisos
- 📜 **Historial**: 2 permisos
- 📎 **Documentos**: 4 permisos
- ⚙️ **Administración**: 6 permisos
- 🔧 **Configuración**: 2 permisos
- 🔔 **Notificaciones**: 4 permisos
- 🔗 **Integración**: 3 permisos
- 🎯 **Combinados**: 5 permisos

---

## 🔍 Permisos de Lectura

| Permiso | Constante | Descripción | Uso Común |
|---------|-----------|-------------|-----------|
| `accounts-payable.read` | `PERMISSIONS.ACCOUNTS_PAYABLE.READ` | Ver cuentas por pagar | Todos los usuarios que necesiten consultar |
| `accounts-payable.read-all` | `PERMISSIONS.ACCOUNTS_PAYABLE.READ_ALL` | Ver todas las cuentas de todas las empresas | Administradores, Auditores |
| `accounts-payable.read-own-company` | `PERMISSIONS.ACCOUNTS_PAYABLE.READ_OWN_COMPANY` | Ver solo cuentas de su empresa | Usuarios estándar |
| `accounts-payable.read-details` | `PERMISSIONS.ACCOUNTS_PAYABLE.READ_DETAILS` | Ver detalles completos (pagos, historial) | Contadores, Tesorería |

### Implementación en Frontend:

```typescript
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/usePermissions';

const { hasPermission, hasAnyPermission } = usePermissions();

// Verificar si puede leer (cualquier nivel)
const canRead = hasAnyPermission([
  PERMISSIONS.ACCOUNTS_PAYABLE.READ,
  PERMISSIONS.ACCOUNTS_PAYABLE.READ_OWN_COMPANY,
  PERMISSIONS.ACCOUNTS_PAYABLE.READ_ALL,
]);

// Verificar si puede ver detalles
const canReadDetails = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.READ_DETAILS);
```

---

## ✏️ Permisos de Escritura

| Permiso | Constante | Descripción | Uso Común |
|---------|-----------|-------------|-----------|
| `accounts-payable.create` | `PERMISSIONS.ACCOUNTS_PAYABLE.CREATE` | Crear cuentas por pagar | Contadores, Asistentes contables |
| `accounts-payable.update` | `PERMISSIONS.ACCOUNTS_PAYABLE.UPDATE` | Actualizar cuentas por pagar | Contadores, Tesorería |
| `accounts-payable.delete` | `PERMISSIONS.ACCOUNTS_PAYABLE.DELETE` | Eliminar cuentas por pagar | Supervisores, Administradores |

### Implementación en Frontend:

```typescript
const canCreate = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.CREATE);
const canUpdate = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.UPDATE);
const canDelete = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.DELETE);

// Ejemplo de uso en botón
{canCreate && (
  <TouchableOpacity onPress={handleCreate}>
    <Text>Crear Cuenta por Pagar</Text>
  </TouchableOpacity>
)}
```

---

## 🔎 Permisos de Búsqueda

| Permiso | Constante | Descripción | Uso Común |
|---------|-----------|-------------|-----------|
| `accounts-payable.search` | `PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH` | Buscar cuentas por pagar | Todos los usuarios |
| `accounts-payable.search-intelligent` | `PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH_INTELLIGENT` | Usar búsqueda inteligente avanzada | Usuarios avanzados |
| `accounts-payable.search-all-companies` | `PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH_ALL_COMPANIES` | Buscar en todas las empresas | Administradores |

### Implementación en Frontend:

```typescript
const canUseIntelligentSearch = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH_INTELLIGENT);
const canSearchAllCompanies = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH_ALL_COMPANIES);

// Usar búsqueda inteligente si tiene permiso
const loadAccountsPayable = async () => {
  if (canUseIntelligentSearch && debouncedSearchQuery) {
    // Usar endpoint de búsqueda inteligente
    const response = await accountsPayableService.searchIntelligent(params);
  } else {
    // Usar endpoint básico
    const response = await accountsPayableService.getAccountsPayable(params);
  }
};
```

---

## 🔄 Permisos de Estado

| Permiso | Constante | Descripción | Uso Común |
|---------|-----------|-------------|-----------|
| `accounts-payable.change-status` | `PERMISSIONS.ACCOUNTS_PAYABLE.CHANGE_STATUS` | Cambiar estado de cuentas | Tesorería, Supervisores |
| `accounts-payable.approve` | `PERMISSIONS.ACCOUNTS_PAYABLE.APPROVE` | Aprobar cuentas por pagar | Gerentes, Directores |
| `accounts-payable.reject` | `PERMISSIONS.ACCOUNTS_PAYABLE.REJECT` | Rechazar cuentas por pagar | Gerentes, Directores |
| `accounts-payable.cancel` | `PERMISSIONS.ACCOUNTS_PAYABLE.CANCEL` | Cancelar cuentas por pagar | Supervisores |
| `accounts-payable.dispute` | `PERMISSIONS.ACCOUNTS_PAYABLE.DISPUTE` | Marcar como en disputa | Tesorería, Legal |

---

## 💰 Permisos de Pagos

| Permiso | Constante | Descripción | Uso Común |
|---------|-----------|-------------|-----------|
| `accounts-payable.payments.read` | `PERMISSIONS.ACCOUNTS_PAYABLE.PAYMENTS.READ` | Ver pagos | Todos los usuarios |
| `accounts-payable.payments.create` | `PERMISSIONS.ACCOUNTS_PAYABLE.PAYMENTS.CREATE` | Registrar pagos | Tesorería, Cajeros |
| `accounts-payable.payments.update` | `PERMISSIONS.ACCOUNTS_PAYABLE.PAYMENTS.UPDATE` | Actualizar pagos | Tesorería |
| `accounts-payable.payments.delete` | `PERMISSIONS.ACCOUNTS_PAYABLE.PAYMENTS.DELETE` | Eliminar pagos | Supervisores |
| `accounts-payable.payments.approve` | `PERMISSIONS.ACCOUNTS_PAYABLE.PAYMENTS.APPROVE` | Aprobar pagos | Gerentes de Tesorería |

### Implementación en Frontend:

```typescript
const canViewPayments = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.PAYMENTS.READ);
const canCreatePayment = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.PAYMENTS.CREATE);
const canApprovePayment = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.PAYMENTS.APPROVE);

// Mostrar sección de pagos solo si tiene permiso
{canViewPayments && accountPayable.payments && (
  <View>
    <Text>Historial de Pagos</Text>
    {/* Lista de pagos */}
  </View>
)}
```

---

## 📊 Permisos de Reportes

| Permiso | Constante | Descripción | Uso Común |
|---------|-----------|-------------|-----------|
| `accounts-payable.reports.summary` | `PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.SUMMARY` | Ver resumen general | Todos los usuarios |
| `accounts-payable.reports.by-supplier` | `PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.BY_SUPPLIER` | Reporte por proveedor | Contadores, Compradores |
| `accounts-payable.reports.by-status` | `PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.BY_STATUS` | Reporte por estado | Tesorería |
| `accounts-payable.reports.aging` | `PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.AGING` | Reporte de antigüedad de saldos | Contadores, Gerencia |
| `accounts-payable.reports.overdue` | `PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.OVERDUE` | Reporte de cuentas vencidas | Tesorería, Gerencia |
| `accounts-payable.reports.export` | `PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.EXPORT` | Exportar reportes | Contadores |
| `accounts-payable.reports.download-excel` | `PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.DOWNLOAD_EXCEL` | Descargar en Excel | Contadores, Analistas |
| `accounts-payable.reports.download-pdf` | `PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.DOWNLOAD_PDF` | Descargar en PDF | Todos los usuarios |

### Implementación en Frontend:

```typescript
const canViewReports = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.SUMMARY);
const canExportExcel = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.DOWNLOAD_EXCEL);

// Mostrar resumen solo si tiene permiso
{canViewReports && summary && (
  <View>
    <Text>Total: {summary.total}</Text>
    <Text>Pendiente: {formatCurrency(summary.totalPendingCents)}</Text>
  </View>
)}
```

---

## 📅 Permisos de Cronograma

| Permiso | Constante | Descripción | Uso Común |
|---------|-----------|-------------|-----------|
| `accounts-payable.schedule.read` | `PERMISSIONS.ACCOUNTS_PAYABLE.SCHEDULE.READ` | Ver cronograma de pagos | Todos los usuarios |
| `accounts-payable.schedule.create` | `PERMISSIONS.ACCOUNTS_PAYABLE.SCHEDULE.CREATE` | Crear cronograma | Tesorería, Contadores |
| `accounts-payable.schedule.update` | `PERMISSIONS.ACCOUNTS_PAYABLE.SCHEDULE.UPDATE` | Actualizar cronograma | Tesorería |
| `accounts-payable.schedule.delete` | `PERMISSIONS.ACCOUNTS_PAYABLE.SCHEDULE.DELETE` | Eliminar cronograma | Supervisores |

### Implementación en Frontend:

```typescript
const canViewSchedule = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.SCHEDULE.READ);

// Mostrar cronograma solo si tiene permiso
{canViewSchedule && accountPayable.paymentSchedule && (
  <View>
    <Text>Cronograma de Pagos</Text>
    {/* Lista de pagos programados */}
  </View>
)}
```

---

## 📜 Permisos de Historial

| Permiso | Constante | Descripción | Uso Común |
|---------|-----------|-------------|-----------|
| `accounts-payable.history.read` | `PERMISSIONS.ACCOUNTS_PAYABLE.HISTORY.READ` | Ver historial de cambios | Auditores, Supervisores |
| `accounts-payable.history.export` | `PERMISSIONS.ACCOUNTS_PAYABLE.HISTORY.EXPORT` | Exportar historial | Auditores |

### Implementación en Frontend:

```typescript
const canViewHistory = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.HISTORY.READ);

// Mostrar historial solo si tiene permiso
{canViewHistory && accountPayable.statusHistory && (
  <View>
    <Text>Historial de Estados</Text>
    {/* Lista de cambios de estado */}
  </View>
)}
```

---

## 📎 Permisos de Documentos

| Permiso | Constante | Descripción | Uso Común |
|---------|-----------|-------------|-----------|
| `accounts-payable.documents.read` | `PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.READ` | Ver documentos adjuntos | Todos los usuarios |
| `accounts-payable.documents.upload` | `PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.UPLOAD` | Subir documentos | Contadores, Asistentes |
| `accounts-payable.documents.download` | `PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.DOWNLOAD` | Descargar documentos | Todos los usuarios |
| `accounts-payable.documents.delete` | `PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.DELETE` | Eliminar documentos | Supervisores |

---

## ⚙️ Permisos de Administración

| Permiso | Constante | Descripción | Uso Común |
|---------|-----------|-------------|-----------|
| `accounts-payable.admin.update-overdue` | `PERMISSIONS.ACCOUNTS_PAYABLE.ADMIN.UPDATE_OVERDUE` | Actualizar días de atraso manualmente | Administradores |
| `accounts-payable.admin.bulk-update` | `PERMISSIONS.ACCOUNTS_PAYABLE.ADMIN.BULK_UPDATE` | Actualización masiva | Administradores |
| `accounts-payable.admin.bulk-delete` | `PERMISSIONS.ACCOUNTS_PAYABLE.ADMIN.BULK_DELETE` | Eliminación masiva | Administradores |
| `accounts-payable.admin.restore` | `PERMISSIONS.ACCOUNTS_PAYABLE.ADMIN.RESTORE` | Restaurar eliminadas | Administradores |
| `accounts-payable.admin.view-deleted` | `PERMISSIONS.ACCOUNTS_PAYABLE.ADMIN.VIEW_DELETED` | Ver eliminadas | Administradores, Auditores |
| `accounts-payable.admin.permanent-delete` | `PERMISSIONS.ACCOUNTS_PAYABLE.ADMIN.PERMANENT_DELETE` | Eliminar permanentemente | Solo Administradores |

---

## 🔧 Permisos de Configuración

| Permiso | Constante | Descripción | Uso Común |
|---------|-----------|-------------|-----------|
| `accounts-payable.config.read` | `PERMISSIONS.ACCOUNTS_PAYABLE.CONFIG.READ` | Ver configuración | Administradores |
| `accounts-payable.config.update` | `PERMISSIONS.ACCOUNTS_PAYABLE.CONFIG.UPDATE` | Actualizar configuración | Solo Administradores |

---

## 🔔 Permisos de Notificaciones

| Permiso | Constante | Descripción | Uso Común |
|---------|-----------|-------------|-----------|
| `accounts-payable.notifications.read` | `PERMISSIONS.ACCOUNTS_PAYABLE.NOTIFICATIONS.READ` | Ver notificaciones | Todos los usuarios |
| `accounts-payable.notifications.create` | `PERMISSIONS.ACCOUNTS_PAYABLE.NOTIFICATIONS.CREATE` | Crear alertas | Tesorería, Supervisores |
| `accounts-payable.notifications.update` | `PERMISSIONS.ACCOUNTS_PAYABLE.NOTIFICATIONS.UPDATE` | Actualizar alertas | Tesorería |
| `accounts-payable.notifications.delete` | `PERMISSIONS.ACCOUNTS_PAYABLE.NOTIFICATIONS.DELETE` | Eliminar alertas | Supervisores |

---

## 🔗 Permisos de Integración

| Permiso | Constante | Descripción | Uso Común |
|---------|-----------|-------------|-----------|
| `accounts-payable.integration.sync` | `PERMISSIONS.ACCOUNTS_PAYABLE.INTEGRATION.SYNC` | Sincronizar con sistemas externos | Administradores, IT |
| `accounts-payable.integration.import` | `PERMISSIONS.ACCOUNTS_PAYABLE.INTEGRATION.IMPORT` | Importar cuentas | Contadores, Administradores |
| `accounts-payable.integration.export` | `PERMISSIONS.ACCOUNTS_PAYABLE.INTEGRATION.EXPORT` | Exportar cuentas | Contadores, Administradores |

---

## 🎯 Permisos Combinados

| Permiso | Constante | Descripción | Incluye |
|---------|-----------|-------------|---------|
| `accounts-payable.read-full` | `PERMISSIONS.ACCOUNTS_PAYABLE.READ_FULL` | Acceso completo de lectura | Todos los permisos de lectura |
| `accounts-payable.write-full` | `PERMISSIONS.ACCOUNTS_PAYABLE.WRITE_FULL` | Acceso completo de escritura | Todos los permisos de escritura |
| `accounts-payable.reports-full` | `PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS_FULL` | Acceso completo a reportes | Todos los permisos de reportes |
| `accounts-payable.admin-full` | `PERMISSIONS.ACCOUNTS_PAYABLE.ADMIN_FULL` | Acceso completo de administración | Todos los permisos de admin |
| `accounts-payable.full-access` | `PERMISSIONS.ACCOUNTS_PAYABLE.FULL_ACCESS` | Acceso completo al módulo | TODOS los permisos |

---

## 👥 Roles Sugeridos

### 1. Administrador del Sistema
```typescript
// Acceso completo
PERMISSIONS.ACCOUNTS_PAYABLE.FULL_ACCESS
```

### 2. Gerente de Finanzas
```typescript
const permissions = [
  PERMISSIONS.ACCOUNTS_PAYABLE.READ_ALL,
  PERMISSIONS.ACCOUNTS_PAYABLE.READ_DETAILS,
  PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH_INTELLIGENT,
  PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH_ALL_COMPANIES,
  PERMISSIONS.ACCOUNTS_PAYABLE.APPROVE,
  PERMISSIONS.ACCOUNTS_PAYABLE.REJECT,
  PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS_FULL,
  PERMISSIONS.ACCOUNTS_PAYABLE.HISTORY.READ,
];
```

### 3. Contador
```typescript
const permissions = [
  PERMISSIONS.ACCOUNTS_PAYABLE.READ,
  PERMISSIONS.ACCOUNTS_PAYABLE.READ_DETAILS,
  PERMISSIONS.ACCOUNTS_PAYABLE.CREATE,
  PERMISSIONS.ACCOUNTS_PAYABLE.UPDATE,
  PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH,
  PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH_INTELLIGENT,
  PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.SUMMARY,
  PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.BY_SUPPLIER,
  PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.BY_STATUS,
  PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.EXPORT,
  PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.DOWNLOAD_EXCEL,
  PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.READ,
  PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.UPLOAD,
  PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.DOWNLOAD,
  PERMISSIONS.ACCOUNTS_PAYABLE.SCHEDULE.READ,
  PERMISSIONS.ACCOUNTS_PAYABLE.SCHEDULE.CREATE,
  PERMISSIONS.ACCOUNTS_PAYABLE.INTEGRATION.IMPORT,
  PERMISSIONS.ACCOUNTS_PAYABLE.INTEGRATION.EXPORT,
];
```

### 4. Tesorería
```typescript
const permissions = [
  PERMISSIONS.ACCOUNTS_PAYABLE.READ,
  PERMISSIONS.ACCOUNTS_PAYABLE.READ_DETAILS,
  PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH,
  PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH_INTELLIGENT,
  PERMISSIONS.ACCOUNTS_PAYABLE.CHANGE_STATUS,
  PERMISSIONS.ACCOUNTS_PAYABLE.PAYMENTS.READ,
  PERMISSIONS.ACCOUNTS_PAYABLE.PAYMENTS.CREATE,
  PERMISSIONS.ACCOUNTS_PAYABLE.PAYMENTS.UPDATE,
  PERMISSIONS.ACCOUNTS_PAYABLE.PAYMENTS.APPROVE,
  PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.SUMMARY,
  PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.OVERDUE,
  PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.AGING,
  PERMISSIONS.ACCOUNTS_PAYABLE.SCHEDULE.READ,
  PERMISSIONS.ACCOUNTS_PAYABLE.SCHEDULE.CREATE,
  PERMISSIONS.ACCOUNTS_PAYABLE.SCHEDULE.UPDATE,
  PERMISSIONS.ACCOUNTS_PAYABLE.NOTIFICATIONS.READ,
  PERMISSIONS.ACCOUNTS_PAYABLE.NOTIFICATIONS.CREATE,
  PERMISSIONS.ACCOUNTS_PAYABLE.NOTIFICATIONS.UPDATE,
  PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.READ,
  PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.DOWNLOAD,
];
```

### 5. Asistente Contable
```typescript
const permissions = [
  PERMISSIONS.ACCOUNTS_PAYABLE.READ,
  PERMISSIONS.ACCOUNTS_PAYABLE.READ_OWN_COMPANY,
  PERMISSIONS.ACCOUNTS_PAYABLE.CREATE,
  PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH,
  PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.READ,
  PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.UPLOAD,
  PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.DOWNLOAD,
  PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.SUMMARY,
];
```

### 6. Auditor
```typescript
const permissions = [
  PERMISSIONS.ACCOUNTS_PAYABLE.READ_ALL,
  PERMISSIONS.ACCOUNTS_PAYABLE.READ_DETAILS,
  PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH_INTELLIGENT,
  PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH_ALL_COMPANIES,
  PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS_FULL,
  PERMISSIONS.ACCOUNTS_PAYABLE.HISTORY.READ,
  PERMISSIONS.ACCOUNTS_PAYABLE.HISTORY.EXPORT,
  PERMISSIONS.ACCOUNTS_PAYABLE.ADMIN.VIEW_DELETED,
  PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.READ,
  PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.DOWNLOAD,
];
```

### 7. Consulta (Solo Lectura)
```typescript
const permissions = [
  PERMISSIONS.ACCOUNTS_PAYABLE.READ,
  PERMISSIONS.ACCOUNTS_PAYABLE.READ_OWN_COMPANY,
  PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH,
  PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.SUMMARY,
  PERMISSIONS.ACCOUNTS_PAYABLE.DOCUMENTS.READ,
];
```

---

## 🔒 Mejores Prácticas de Seguridad

### 1. Principio de Menor Privilegio
- Asignar solo los permisos necesarios para cada rol
- No usar `FULL_ACCESS` excepto para administradores
- Revisar periódicamente los permisos asignados

### 2. Separación de Funciones
- Los que crean cuentas no deberían aprobar pagos
- Los que registran pagos no deberían eliminar registros
- Implementar flujos de aprobación con diferentes roles

### 3. Validación en Frontend y Backend
```typescript
// Frontend - Ocultar UI
{canCreate && <CreateButton />}

// Backend - Validar en API
// El backend SIEMPRE debe validar permisos
// El frontend solo mejora la UX
```

### 4. Auditoría
- Asignar `HISTORY.READ` a auditores
- Registrar todas las acciones críticas
- Mantener logs de cambios de permisos

---

## 📊 Matriz de Permisos por Rol

| Permiso | Admin | Gerente | Contador | Tesorería | Asistente | Auditor | Consulta |
|---------|-------|---------|----------|-----------|-----------|---------|----------|
| read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| read-all | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| create | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| update | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| approve | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| payments.create | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| payments.approve | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| reports.export | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| admin.* | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 🚨 Permisos Críticos

### ⚠️ Alta Criticidad
Estos permisos deben asignarse con extremo cuidado:

- `ADMIN.PERMANENT_DELETE` - Eliminación permanente sin recuperación
- `ADMIN.BULK_DELETE` - Eliminación masiva de registros
- `PAYMENTS.APPROVE` - Aprobar pagos (impacto financiero)
- `CONFIG.UPDATE` - Cambiar configuración del módulo

### ⚠️ Media Criticidad

- `DELETE` - Eliminar cuentas (soft delete)
- `PAYMENTS.DELETE` - Eliminar pagos registrados
- `ADMIN.BULK_UPDATE` - Actualización masiva

---

## 📝 Ejemplos de Implementación

### Ejemplo 1: Proteger una Pantalla Completa

```typescript
// En navigation/index.tsx
<MainStackNavigator.Screen
  name={MAIN_ROUTES.ACCOUNTS_PAYABLE}
  options={{ title: 'Cuentas por Pagar' }}
>
  {(props) => (
    <ProtectedRoute
      requiredPermissions={[
        PERMISSIONS.ACCOUNTS_PAYABLE.READ,
        PERMISSIONS.ACCOUNTS_PAYABLE.READ_OWN_COMPANY,
        PERMISSIONS.ACCOUNTS_PAYABLE.READ_ALL,
      ]}
      requireAll={false} // Solo necesita UNO de estos permisos
    >
      <AccountsPayableScreen {...props} />
    </ProtectedRoute>
  )}
</MainStackNavigator.Screen>
```

### Ejemplo 2: Proteger Acciones Específicas

```typescript
// En AccountsPayableScreen.tsx
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';

const AccountsPayableScreen = () => {
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.CREATE);
  const canExport = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.REPORTS.EXPORT);

  return (
    <View>
      {/* Botón de crear solo visible si tiene permiso */}
      {canCreate && (
        <TouchableOpacity onPress={handleCreate}>
          <Text>Crear Cuenta por Pagar</Text>
        </TouchableOpacity>
      )}

      {/* Botón de exportar solo visible si tiene permiso */}
      {canExport && (
        <TouchableOpacity onPress={handleExport}>
          <Text>Exportar a Excel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
```

### Ejemplo 3: Condicionar Funcionalidad

```typescript
// Usar búsqueda inteligente solo si tiene permiso
const loadAccountsPayable = async () => {
  const canUseIntelligentSearch = hasPermission(
    PERMISSIONS.ACCOUNTS_PAYABLE.SEARCH_INTELLIGENT
  );

  if (canUseIntelligentSearch && searchQuery) {
    // Endpoint con más detalles y mejor búsqueda
    const response = await accountsPayableService.searchIntelligent({
      search: searchQuery,
      includeDetails: true,
    });
  } else {
    // Endpoint básico
    const response = await accountsPayableService.getAccountsPayable({
      search: searchQuery,
    });
  }
};
```

### Ejemplo 4: Mostrar/Ocultar Secciones

```typescript
// En AccountPayableDetailScreen.tsx
const canViewPayments = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.PAYMENTS.READ);
const canViewSchedule = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.SCHEDULE.READ);
const canViewHistory = hasPermission(PERMISSIONS.ACCOUNTS_PAYABLE.HISTORY.READ);

return (
  <ScrollView>
    {/* Información básica - siempre visible */}
    <AccountInfo account={accountPayable} />

    {/* Pagos - solo si tiene permiso */}
    {canViewPayments && (
      <PaymentsSection payments={accountPayable.payments} />
    )}

    {/* Cronograma - solo si tiene permiso */}
    {canViewSchedule && (
      <ScheduleSection schedule={accountPayable.paymentSchedule} />
    )}

    {/* Historial - solo si tiene permiso */}
    {canViewHistory && (
      <HistorySection history={accountPayable.statusHistory} />
    )}
  </ScrollView>
);
```

---

## 🔄 Flujo de Validación de Permisos

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Usuario intenta acceder a una pantalla                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. ProtectedRoute verifica permisos en navigation          │
│    - Si NO tiene permiso → Redirige a PermissionDenied     │
│    - Si tiene permiso → Renderiza la pantalla              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Pantalla carga y verifica permisos específicos          │
│    - usePermissions() obtiene permisos del usuario          │
│    - hasPermission() verifica cada permiso individual       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. UI se renderiza condicionalmente                        │
│    - Botones visibles solo con permisos                     │
│    - Secciones ocultas sin permisos                         │
│    - Funcionalidad limitada según permisos                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📞 Soporte

Para preguntas sobre permisos:

1. Revisar esta documentación
2. Consultar con el administrador del sistema
3. Revisar los logs de auditoría
4. Contactar al equipo de desarrollo

---

**Versión**: 1.0.0
**Última actualización**: 2024-01-31
**Autor**: Sistema de Gestión Administrativa
