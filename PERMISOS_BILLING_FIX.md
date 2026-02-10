# 🔧 Corrección de Permisos - Módulo de Facturación

## 📋 Problema Identificado

El usuario reportó que no tenía permiso para acceder a "Tipos de Documentos". El problema era que los permisos en el frontend usaban **guiones bajos** (`billing.document_types.read`) mientras que el backend usa **guiones** (`billing.document-types.read`).

## ✅ Cambios Realizados

### 1. **Actualización de Constantes de Permisos** (`src/constants/permissions.ts`)

Se agregó la sección completa de permisos de BILLING:

```typescript
BILLING: {
  READ: 'billing.read',
  ADMIN: 'billing.admin',

  DOCUMENT_TYPES: {
    READ: 'billing.document-types.read',
    MANAGE: 'billing.document-types.manage',
  },

  SERIES: {
    READ: 'billing.series.read',
    CREATE: 'billing.series.create',
    UPDATE: 'billing.series.update',
    DELETE: 'billing.series.delete',
    STATS: 'billing.series.stats',
  },

  CORRELATIVES: {
    READ: 'billing.correlatives.read',
    GENERATE: 'billing.correlatives.generate',
    VOID: 'billing.correlatives.void',
  },
}
```

### 2. **Actualización de DocumentTypesScreen** (`src/screens/Billing/DocumentTypesScreen.tsx`)

**Antes:**
```typescript
requiredPermissions={['billing.document_types.create']}
requiredPermissions={['billing.document_types.update']}
requiredPermissions={['billing.document_types.delete']}
```

**Después:**
```typescript
requiredPermissions={[PERMISSIONS.BILLING.DOCUMENT_TYPES.MANAGE]}
requiredPermissions={[PERMISSIONS.BILLING.DOCUMENT_TYPES.MANAGE]}
requiredPermissions={[PERMISSIONS.BILLING.DOCUMENT_TYPES.MANAGE]}
```

### 3. **Actualización de DocumentSeriesScreen** (`src/screens/Billing/DocumentSeriesScreen.tsx`)

**Antes:**
```typescript
requiredPermissions={['billing.series.create']}
requiredPermissions={['billing.series.update']}
requiredPermissions={['billing.series.delete']}
```

**Después:**
```typescript
requiredPermissions={[PERMISSIONS.BILLING.SERIES.CREATE]}
requiredPermissions={[PERMISSIONS.BILLING.SERIES.UPDATE]}
requiredPermissions={[PERMISSIONS.BILLING.SERIES.DELETE]}
```

### 4. **Actualización de Navegación** (`src/navigation/index.tsx`)

**Antes:**
```typescript
requiredPermissions={[
  'billing.read',
  'billing.document_types.read',
  'billing.series.read',
  'billing.correlatives.read',
]}
```

**Después:**
```typescript
requiredPermissions={[
  'billing.read',
  'billing.document-types.read',
  'billing.series.read',
  'billing.correlatives.read',
]}
```

### 5. **Actualización de Rutas** (`src/constants/routes.ts`)

**Antes:**
```typescript
DOCUMENT_TYPES: 'billing.document_types.read',
```

**Después:**
```typescript
DOCUMENT_TYPES: 'billing.document-types.read',
```

### 6. **Actualización de DrawerMenu** (`src/components/Navigation/DrawerMenu.tsx`)

**Antes:**
```typescript
requiredPermissions: ['billing.read', 'billing.document_types.read', 'billing.series.read', 'billing.correlatives.read']
```

**Después:**
```typescript
requiredPermissions: ['billing.read', 'billing.document-types.read', 'billing.series.read', 'billing.correlatives.read']
```

### 7. **Actualización de Documentación** (`MODULO_CONFIGURACION_TRIBUTARIA.md`)

Se actualizó la sección de permisos con:
- Nomenclatura correcta (guiones en lugar de guiones bajos)
- SQL completo para crear permisos en el backend
- Referencia a `PERMISSIONS.BILLING` en el código

## 🎯 Permisos Correctos del Backend

### Tipos de Documentos
- ✅ `billing.document-types.read` - Ver tipos de documentos
- ✅ `billing.document-types.manage` - Gestionar tipos (crear, editar, eliminar)

### Series
- ✅ `billing.series.read` - Ver series
- ✅ `billing.series.create` - Crear series
- ✅ `billing.series.update` - Actualizar series
- ✅ `billing.series.delete` - Eliminar series
- ✅ `billing.series.stats` - Ver estadísticas

### Correlativos
- ✅ `billing.correlatives.read` - Ver correlativos
- ✅ `billing.correlatives.generate` - Generar números
- ✅ `billing.correlatives.void` - Anular correlativos

### Administrativo
- ✅ `billing.admin` - Administración completa

## 📝 SQL para Backend

```sql
-- Permisos para Tipos de Documentos
INSERT INTO app.permissions (key, description, module) VALUES
    ('billing.document-types.read', 'Ver tipos de documentos tributarios', 'billing'),
    ('billing.document-types.manage', 'Gestionar tipos de documentos tributarios', 'billing')
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    module = EXCLUDED.module;

-- Permisos para Series
INSERT INTO app.permissions (key, description, module) VALUES
    ('billing.series.read', 'Ver series de documentos', 'billing'),
    ('billing.series.create', 'Crear series de documentos', 'billing'),
    ('billing.series.update', 'Actualizar series de documentos', 'billing'),
    ('billing.series.delete', 'Eliminar series de documentos', 'billing'),
    ('billing.series.stats', 'Ver estadísticas de series', 'billing')
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    module = EXCLUDED.module;

-- Permisos para Correlativos
INSERT INTO app.permissions (key, description, module) VALUES
    ('billing.correlatives.read', 'Ver correlativos generados', 'billing'),
    ('billing.correlatives.generate', 'Generar números correlativos', 'billing'),
    ('billing.correlatives.void', 'Anular correlativos', 'billing')
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    module = EXCLUDED.module;

-- Permisos Administrativos
INSERT INTO app.permissions (key, description, module) VALUES
    ('billing.admin', 'Administración completa del módulo de facturación', 'billing')
ON CONFLICT (key) DO UPDATE SET
    description = EXCLUDED.description,
    module = EXCLUDED.module;
```

## 🔍 Verificación

Todos los archivos modificados fueron verificados y **no tienen errores de TypeScript**.

### Archivos Modificados:
1. ✅ `src/constants/permissions.ts`
2. ✅ `src/screens/Billing/DocumentTypesScreen.tsx`
3. ✅ `src/screens/Billing/DocumentSeriesScreen.tsx`
4. ✅ `src/navigation/index.tsx`
5. ✅ `src/constants/routes.ts`
6. ✅ `src/components/Navigation/DrawerMenu.tsx`
7. ✅ `MODULO_CONFIGURACION_TRIBUTARIA.md`

## 🚀 Próximos Pasos

1. **Ejecutar el SQL en el backend** para crear los permisos
2. **Asignar permisos al rol/usuario** correspondiente
3. **Probar el acceso** a cada pantalla del módulo
4. **Verificar** que los botones de acción (Crear, Editar, Eliminar) aparezcan según los permisos

## 💡 Notas Importantes

- Los permisos ahora usan **guiones** (`-`) en lugar de guiones bajos (`_`)
- Se usa `billing.document-types.manage` para crear, editar y eliminar (un solo permiso para todas las operaciones de gestión)
- Las constantes `PERMISSIONS.BILLING.*` deben usarse en lugar de strings hardcodeados
- El permiso `billing.read` permite ver el menú principal de configuración tributaria
