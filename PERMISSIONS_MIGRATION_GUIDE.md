# 🔐 Guía de Migración del Sistema de Permisos

## 📋 Resumen de la Migración

Se ha completado la migración del sistema de permisos del frontend para alinearlo con los ~150 permisos implementados en el backend.

**Fecha de migración:** 2024
**Estado:** ✅ Completado (Infraestructura base + Ejemplos de migración)

---

## 🎯 Objetivos Alcanzados

### ✅ Infraestructura Creada

1. **Constantes de Permisos** (`src/constants/permissions.ts`)
   - Mapeo completo de ~150 permisos del backend
   - Estructura jerárquica organizada por módulos
   - Helpers para construcción y validación de permisos

2. **Componentes Protegidos**
   - `ProtectedButton` - Botón con verificación de permisos
   - `ProtectedTouchableOpacity` - TouchableOpacity protegido
   - `ProtectedActionButton` - Botón de acción CRUD con mapeo automático

3. **Hooks Mejorados**
   - `usePermissions` - Mejorado con soporte de jerarquía
   - `useActionPermissions` - Verificación CRUD por módulo
   - `useModulePermissions` - Verificación de permisos específicos

4. **Sistema de Jerarquía**
   - `permissionHierarchy.ts` - Define permisos padre/hijo
   - Soporte para permisos administrativos que incluyen otros

---

## 📁 Archivos Creados

### Constantes
- ✅ `src/constants/permissions.ts` - Mapeo de todos los permisos

### Componentes UI
- ✅ `src/components/ui/ProtectedButton.tsx`
- ✅ `src/components/ui/ProtectedTouchableOpacity.tsx`
- ✅ `src/components/ui/ProtectedActionButton.tsx`
- ✅ `src/components/ui/index.ts` - Exports

### Hooks
- ✅ `src/hooks/useActionPermissions.ts`
- ✅ `src/hooks/index.ts` - Actualizado con nuevos exports

### Utilidades
- ✅ `src/utils/permissionHierarchy.ts`

---

## 📝 Archivos Modificados

### Hooks Mejorados
- ✅ `src/hooks/usePermissions.ts` - Agregado soporte de jerarquía

### Pantallas Migradas (Ejemplos)
- ✅ `src/screens/Inventory/ProductsScreen.tsx`
- ✅ `src/screens/Presentations/PresentationsScreen.tsx`
- ✅ `src/screens/Warehouses/WarehousesScreen.tsx`

---

## 🚀 Cómo Usar el Nuevo Sistema

### 1. Importar Constantes de Permisos

```tsx
import { PERMISSIONS } from '@/constants/permissions';
```

### 2. Usar ProtectedButton

```tsx
import { ProtectedButton } from '@/components/ui/ProtectedButton';

<ProtectedButton
  title="Crear Producto"
  onPress={handleCreate}
  requiredPermissions={[PERMISSIONS.PRODUCTS.CREATE]}
  hideIfNoPermission={true}
  variant="primary"
/>
```

### 3. Usar ProtectedTouchableOpacity

```tsx
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';

<ProtectedTouchableOpacity
  style={styles.editButton}
  onPress={handleEdit}
  requiredPermissions={[PERMISSIONS.PRODUCTS.UPDATE]}
  hideIfNoPermission={true}
>
  <Text>✏️ Editar</Text>
</ProtectedTouchableOpacity>
```

### 4. Usar ProtectedActionButton (Mapeo Automático)

```tsx
import { ProtectedActionButton } from '@/components/ui/ProtectedActionButton';

// Automáticamente verifica 'products.create'
<ProtectedActionButton
  action="create"
  module="products"
  onPress={handleCreate}
  icon="+"
  label="Nuevo"
  variant="primary"
/>

// Automáticamente verifica 'products.update'
<ProtectedActionButton
  action="update"
  module="products"
  onPress={handleEdit}
  icon="✏️"
  variant="secondary"
/>

// Automáticamente verifica 'products.delete'
<ProtectedActionButton
  action="delete"
  module="products"
  onPress={handleDelete}
  icon="🗑️"
  variant="danger"
/>
```

### 5. Usar Hooks de Permisos

```tsx
import { useActionPermissions } from '@/hooks/useActionPermissions';

const { canCreate, canUpdate, canDelete, canManage } = useActionPermissions('products');

if (canCreate) {
  // Mostrar botón de crear
}
```

### 6. Verificar Permisos Manualmente

```tsx
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';

const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

// Verificar un permiso
if (hasPermission(PERMISSIONS.PRODUCTS.CREATE)) {
  // Usuario puede crear productos
}

// Verificar al menos uno (OR)
if (hasAnyPermission([PERMISSIONS.PRODUCTS.UPDATE, PERMISSIONS.PRODUCTS.DELETE])) {
  // Usuario puede editar O eliminar
}

// Verificar todos (AND)
if (hasAllPermissions([PERMISSIONS.PRODUCTS.CREATE, PERMISSIONS.PRODUCTS.UPDATE])) {
  // Usuario puede crear Y editar
}
```

---

## 📊 Permisos por Módulo

### Usuarios (4 permisos)
- `PERMISSIONS.USERS.CREATE`
- `PERMISSIONS.USERS.READ`
- `PERMISSIONS.USERS.UPDATE`
- `PERMISSIONS.USERS.DELETE`

### Productos (4 permisos)
- `PERMISSIONS.PRODUCTS.CREATE`
- `PERMISSIONS.PRODUCTS.READ`
- `PERMISSIONS.PRODUCTS.UPDATE`
- `PERMISSIONS.PRODUCTS.DELETE`

### Compras (12 permisos)
- `PERMISSIONS.PURCHASES.CREATE`
- `PERMISSIONS.PURCHASES.READ`
- `PERMISSIONS.PURCHASES.UPDATE`
- `PERMISSIONS.PURCHASES.DELETE`
- `PERMISSIONS.PURCHASES.CLOSE`
- `PERMISSIONS.PURCHASES.VALIDATE`
- `PERMISSIONS.PURCHASES.VALIDATE_CLOSE`
- `PERMISSIONS.PURCHASES.PRODUCTS_ADD`
- `PERMISSIONS.PURCHASES.PRODUCTS_EDIT`
- `PERMISSIONS.PURCHASES.PRODUCTS_DELETE`
- `PERMISSIONS.PURCHASES.DEBT_ASSIGN`
- `PERMISSIONS.PURCHASES.OCR_SCAN`

### Gastos (45 permisos)
- `PERMISSIONS.EXPENSES.CREATE`
- `PERMISSIONS.EXPENSES.READ`
- `PERMISSIONS.EXPENSES.UPDATE`
- `PERMISSIONS.EXPENSES.DELETE`
- `PERMISSIONS.EXPENSES.ADMIN` (incluye todos los permisos de gastos)
- `PERMISSIONS.EXPENSES.PAYMENTS.*` (5 permisos)
- `PERMISSIONS.EXPENSES.CATEGORIES.*` (4 permisos)
- `PERMISSIONS.EXPENSES.PROJECTS.*` (5 permisos)
- `PERMISSIONS.EXPENSES.TEMPLATES.*` (6 permisos)
- `PERMISSIONS.EXPENSES.ALERTS.*` (4 permisos)
- `PERMISSIONS.EXPENSES.PROJECTIONS.*` (5 permisos)

### Campañas (7 permisos)
- `PERMISSIONS.CAMPAIGNS.CREATE`
- `PERMISSIONS.CAMPAIGNS.READ`
- `PERMISSIONS.CAMPAIGNS.UPDATE`
- `PERMISSIONS.CAMPAIGNS.DELETE`
- `PERMISSIONS.CAMPAIGNS.ACTIVATE`
- `PERMISSIONS.CAMPAIGNS.CLOSE`
- `PERMISSIONS.CAMPAIGNS.CANCEL`

### Repartos (9 permisos)
- `PERMISSIONS.REPARTOS.CREATE`
- `PERMISSIONS.REPARTOS.READ`
- `PERMISSIONS.REPARTOS.UPDATE`
- `PERMISSIONS.REPARTOS.DELETE`
- `PERMISSIONS.REPARTOS.CANCEL`
- `PERMISSIONS.REPARTOS.VALIDATE`
- `PERMISSIONS.REPARTOS.EXPORT`
- `PERMISSIONS.REPARTOS.REPORTS`
- `PERMISSIONS.REPARTOS.GENERATE_TRANSFER`

### Balances (20 permisos)
- `PERMISSIONS.BALANCES.*` (7 permisos base)
- `PERMISSIONS.BALANCES.FILES.*` (3 permisos)
- `PERMISSIONS.BALANCES.OPERATIONS.*` (4 permisos)
- `PERMISSIONS.BALANCES.REPORTS.*` (1 permiso)

### Traslados (9 permisos)
- `PERMISSIONS.TRANSFERS.CREATE`
- `PERMISSIONS.TRANSFERS.READ`
- `PERMISSIONS.TRANSFERS.EXECUTE`
- `PERMISSIONS.TRANSFERS.APPROVE`
- `PERMISSIONS.TRANSFERS.SHIP`
- `PERMISSIONS.TRANSFERS.RECEIVE`
- `PERMISSIONS.TRANSFERS.VALIDATE`
- `PERMISSIONS.TRANSFERS.COMPLETE`
- `PERMISSIONS.TRANSFERS.CANCEL`

### Proveedores (16 permisos)
- `PERMISSIONS.SUPPLIERS.*` (4 permisos base)
- `PERMISSIONS.SUPPLIERS.DEBTS.*` (3 permisos)
- `PERMISSIONS.SUPPLIERS.PAYMENTS.*` (5 permisos)

### IAM y Roles (18 permisos)
- `PERMISSIONS.ROLES.*` (5 permisos)
- `PERMISSIONS.PERMISSIONS_MODULE.READ`
- `PERMISSIONS.IAM.*` (2 permisos)
- `PERMISSIONS.ACCESS.READ`
- `PERMISSIONS.SCOPES.*` (7 permisos)
- `PERMISSIONS.APPS.*` (12 permisos)

### Otros Módulos
- Categorías (4 permisos)
- Presentaciones (4 permisos)
- Perfiles de Precio (4 permisos)
- Métodos de Pago (4 permisos)
- Sedes (6 permisos)
- Archivos (4 permisos)
- Transmisiones (4 permisos)
- Almacenes (4 permisos)
- Áreas (4 permisos)

---

## 🔄 Sistema de Jerarquía de Permisos

Algunos permisos "padre" incluyen automáticamente permisos "hijo":

### Ejemplo: expenses.admin
```typescript
'expenses.admin' incluye automáticamente:
  - expenses.create
  - expenses.read
  - expenses.update
  - expenses.delete
  - expenses.payments.*
  - expenses.categories.*
  - expenses.projects.*
  - expenses.templates.*
  - expenses.alerts.*
  - expenses.projections.*
  - expenses.reports.view
```

### Ejemplo: apps.manage
```typescript
'apps.manage' incluye automáticamente:
  - apps.create
  - apps.read
  - apps.update
  - apps.delete
  - apps.scopes.read
  - apps.users.read
  - apps.permissions.read
```

---

## 📋 Tareas Pendientes de Migración

Las siguientes pantallas aún necesitan ser migradas para usar los nuevos componentes protegidos:

### Alta Prioridad
- [ ] `src/screens/Purchases/*` - Pantallas de compras (12 permisos)
- [ ] `src/screens/Expenses/*` - Pantallas de gastos (45 permisos)
- [ ] `src/screens/Balances/*` - Pantallas de balances (20 permisos)
- [ ] `src/screens/Users/*` - Pantallas de usuarios (4 permisos)
- [ ] `src/screens/Roles/*` - Pantallas de roles (5 permisos)

### Media Prioridad
- [ ] `src/screens/Campaigns/*` - Pantallas de campañas (7 permisos)
- [ ] `src/screens/Repartos/*` - Pantallas de repartos (9 permisos)
- [ ] `src/screens/Transfers/*` - Pantallas de traslados (9 permisos)
- [ ] `src/screens/Suppliers/*` - Pantallas de proveedores (16 permisos)

### Baja Prioridad
- [ ] `src/screens/Companies/*` - Pantallas de empresas (usa scopes)
- [ ] `src/screens/Sites/*` - Pantallas de sedes (6 permisos)
- [ ] `src/screens/Apps/*` - Pantallas de apps (12 permisos)
- [ ] `src/screens/Warehouses/WarehouseAreasScreen.tsx` - Áreas (4 permisos)
- [ ] `src/screens/PriceProfiles/*` - Perfiles de precio (4 permisos)
- [ ] `src/screens/Transmisiones/*` - Transmisiones (4 permisos)

---

## 🔧 Patrón de Migración

Para migrar una pantalla existente:

### 1. Importar dependencias
```tsx
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { PERMISSIONS } from '@/constants/permissions';
```

### 2. Reemplazar TouchableOpacity sin protección
```tsx
// ❌ ANTES
<TouchableOpacity
  style={styles.editButton}
  onPress={handleEdit}
>
  <Text>✏️ Editar</Text>
</TouchableOpacity>

// ✅ DESPUÉS
<ProtectedTouchableOpacity
  style={styles.editButton}
  onPress={handleEdit}
  requiredPermissions={[PERMISSIONS.PRODUCTS.UPDATE]}
  hideIfNoPermission={true}
>
  <Text>✏️ Editar</Text>
</ProtectedTouchableOpacity>
```

### 3. Reemplazar ProtectedElement con strings
```tsx
// ❌ ANTES
<ProtectedElement
  requiredPermissions={['products.create']}
  fallback={null}
>
  <AddButton onPress={handleCreate} />
</ProtectedElement>

// ✅ DESPUÉS
<ProtectedElement
  requiredPermissions={[PERMISSIONS.PRODUCTS.CREATE]}
  fallback={null}
>
  <AddButton onPress={handleCreate} />
</ProtectedElement>
```

---

## ⚠️ Consideraciones Especiales

### Módulos con Scopes (No usan permisos tradicionales)

Los siguientes módulos usan el sistema de **Scopes** en lugar de permisos:

- **Inventario** (`inventory.*`, `stock.*`)
- **Empresas** (`companies.*`)

Para estos módulos, se debe usar el sistema de scopes existente:
```tsx
@RequireGlobalScope({ canRead: true })
@RequireWarehouseScope({ warehouseId: 'from-param', canWrite: true })
```

### Permisos Especiales

Algunos permisos tienen acciones especiales más allá de CRUD:

- `purchases.close` - Cerrar compra
- `purchases.validate` - Validar productos
- `balances.activate` / `balances.deactivate` - Activar/desactivar
- `expenses.payments.approve` - Aprobar pagos
- `transfers.ship` / `transfers.receive` - Enviar/recibir traslados

---

## 📚 Recursos Adicionales

### Documentación del Backend
Ver el archivo de documentación de permisos del backend para la lista completa de ~150 permisos y sus endpoints asociados.

### Ejemplos de Uso
- `ProductsScreen.tsx` - Ejemplo completo de migración
- `PresentationsScreen.tsx` - Ejemplo de botones protegidos
- `WarehousesScreen.tsx` - Ejemplo de acciones CRUD

---

## ✅ Verificación de la Migración

Para verificar que una pantalla está correctamente migrada:

1. ✅ Todos los botones de acción usan componentes protegidos
2. ✅ Se usan constantes `PERMISSIONS.*` en lugar de strings
3. ✅ Los permisos coinciden con los del backend
4. ✅ No hay errores de TypeScript
5. ✅ Los botones se ocultan/deshabilitan correctamente según permisos

---

## 🎯 Próximos Pasos

1. **Migrar pantallas restantes** siguiendo el patrón establecido
2. **Probar permisos** en diferentes roles de usuario
3. **Documentar casos especiales** que surjan durante la migración
4. **Optimizar rendimiento** si es necesario (memoización, etc.)
5. **Crear tests** para verificar el comportamiento de permisos

---

## 📞 Soporte

Si tienes dudas sobre la migración:
1. Revisa los ejemplos en las pantallas ya migradas
2. Consulta este documento
3. Verifica la documentación de permisos del backend
4. Contacta al equipo de desarrollo

---

**Última actualización:** 2024
**Versión:** 1.0.0
