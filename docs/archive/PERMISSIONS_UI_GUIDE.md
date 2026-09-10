# 🔐 Guía de Uso: Componentes Protegidos por Permisos

## 📚 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Componentes Disponibles](#componentes-disponibles)
3. [Ejemplos de Uso](#ejemplos-de-uso)
4. [Patrones Comunes](#patrones-comunes)
5. [Mejores Prácticas](#mejores-prácticas)

---

## Introducción

Este proyecto implementa un sistema de componentes protegidos por permisos que automáticamente ocultan o deshabilitan elementos de la UI según los permisos del usuario.

### Beneficios:
- ✅ **Mejor UX**: Los usuarios solo ven lo que pueden hacer
- ✅ **Seguridad**: Doble capa de protección (UI + Backend)
- ✅ **Mantenibilidad**: Patrón consistente
- ✅ **Autodocumentado**: Los permisos están en el código

---

## Componentes Disponibles

### 1. ProtectedFAB
Floating Action Button con verificación de permisos.

```tsx
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';

<ProtectedFAB
  icon="+"
  onPress={handleCreate}
  requiredPermissions={['products.create']}
  hideIfNoPermission={true}
/>
```

**Props:**
- `icon`: string - Emoji o texto del icono
- `label?`: string - Etiqueta opcional debajo del FAB
- `onPress`: () => void - Función al presionar
- `requiredPermissions?`: string[] - Permisos requeridos
- `requireAll?`: boolean - Si requiere todos los permisos (default: false)
- `hideIfNoPermission?`: boolean - Ocultar si no tiene permiso (default: true)
- `bottom?`: number - Offset desde el bottom (default: 90px)

---

### 2. ProtectedButton
Botón estándar con verificación de permisos.

```tsx
import { ProtectedButton } from '@/components/ui/ProtectedButton';

<ProtectedButton
  title="Crear Producto"
  onPress={handleCreate}
  requiredPermissions={['products.create']}
  hideIfNoPermission={true}
  variant="primary"
/>
```

**Props:**
- `title`: string - Texto del botón
- `onPress`: () => void - Función al presionar
- `variant?`: 'primary' | 'secondary' | 'outline' | 'text'
- `size?`: 'small' | 'medium' | 'large'
- `requiredPermissions?`: string[] - Permisos requeridos
- `hideIfNoPermission?`: boolean - Ocultar si no tiene permiso

---

### 3. ProtectedTouchableOpacity
TouchableOpacity con verificación de permisos.

```tsx
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';

<ProtectedTouchableOpacity
  style={styles.editButton}
  onPress={handleEdit}
  requiredPermissions={['products.update']}
  hideIfNoPermission={true}
>
  <Text>✏️ Editar</Text>
</ProtectedTouchableOpacity>
```

**Props:**
- Todas las props de `TouchableOpacity`
- `requiredPermissions?`: string[] - Permisos requeridos
- `hideIfNoPermission?`: boolean - Ocultar si no tiene permiso
- `fallback?`: React.ReactNode - Componente alternativo

---

### 4. ProtectedIconButton
Botón de icono con verificación de permisos.

```tsx
import { ProtectedIconButton } from '@/components/ui/ProtectedIconButton';

<ProtectedIconButton
  icon="✏️"
  label="Editar"
  onPress={handleEdit}
  requiredPermissions={['products.update']}
  hideIfNoPermission={true}
/>
```

**Props:**
- `icon`: string - Emoji o texto del icono
- `label?`: string - Etiqueta opcional
- `onPress`: () => void - Función al presionar
- `requiredPermissions?`: string[] - Permisos requeridos
- `hideIfNoPermission?`: boolean - Ocultar si no tiene permiso

---

### 5. ProtectedView
View con verificación de permisos para ocultar secciones completas.

```tsx
import { ProtectedView } from '@/components/ui/ProtectedView';

<ProtectedView requiredPermissions={['expenses.reports.view']}>
  <View style={styles.reportsSection}>
    <Text>Reportes</Text>
    <ReportsList />
  </View>
</ProtectedView>
```

**Props:**
- Todas las props de `View`
- `requiredPermissions?`: string[] - Permisos requeridos
- `hideIfNoPermission?`: boolean - Ocultar si no tiene permiso
- `fallback?`: React.ReactNode - Componente alternativo

---

### 6. ProtectedPressable
Pressable con verificación de permisos.

```tsx
import { ProtectedPressable } from '@/components/ui/ProtectedPressable';

<ProtectedPressable
  onPress={handlePress}
  requiredPermissions={['products.update']}
  hideIfNoPermission={true}
>
  {({ pressed }) => (
    <View style={[styles.item, pressed && styles.itemPressed]}>
      <Text>Editar</Text>
    </View>
  )}
</ProtectedPressable>
```

---

## Ejemplos de Uso

### Ejemplo 1: Pantalla de Listado con FAB

```tsx
import React from 'react';
import { View, FlatList } from 'react-native';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';

export const ProductsScreen = () => {
  const handleCreateProduct = () => {
    // Lógica para crear producto
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        renderItem={renderProduct}
      />

      {/* FAB solo visible si tiene permiso de crear */}
      <ProtectedFAB
        icon="+"
        onPress={handleCreateProduct}
        requiredPermissions={['products.create']}
        hideIfNoPermission={true}
      />
    </View>
  );
};
```

---

### Ejemplo 2: Card con Botones de Acción

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';

export const ProductCard = ({ product, onEdit, onDelete }) => {
  return (
    <View style={styles.card}>
      <Text>{product.name}</Text>

      <View style={styles.actions}>
        {/* Botón de editar - solo visible con permiso */}
        <ProtectedTouchableOpacity
          style={styles.editButton}
          onPress={() => onEdit(product)}
          requiredPermissions={['products.update']}
          hideIfNoPermission={true}
        >
          <Text>✏️ Editar</Text>
        </ProtectedTouchableOpacity>

        {/* Botón de eliminar - solo visible con permiso */}
        <ProtectedTouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(product)}
          requiredPermissions={['products.delete']}
          hideIfNoPermission={true}
        >
          <Text>🗑️ Eliminar</Text>
        </ProtectedTouchableOpacity>
      </View>
    </View>
  );
};
```

---

### Ejemplo 3: Sección de Reportes Condicional

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { ProtectedView } from '@/components/ui/ProtectedView';

export const ExpenseDetailScreen = () => {
  return (
    <View style={styles.container}>
      {/* Información básica - siempre visible */}
      <View style={styles.basicInfo}>
        <Text>Información del Gasto</Text>
      </View>

      {/* Sección de reportes - solo visible con permiso */}
      <ProtectedView requiredPermissions={['expenses.reports.view']}>
        <View style={styles.reportsSection}>
          <Text style={styles.sectionTitle}>Reportes</Text>
          <ReportsList />
        </View>
      </ProtectedView>

      {/* Sección de pagos - solo visible con permiso */}
      <ProtectedView requiredPermissions={['expenses.payments.read']}>
        <View style={styles.paymentsSection}>
          <Text style={styles.sectionTitle}>Pagos</Text>
          <PaymentsList />
        </View>
      </ProtectedView>
    </View>
  );
};
```

---

### Ejemplo 4: Múltiples Permisos (OR)

```tsx
// El usuario necesita AL MENOS UNO de los permisos
<ProtectedButton
  title="Gestionar"
  onPress={handleManage}
  requiredPermissions={[
    'products.create',
    'products.update',
    'products.delete'
  ]}
  requireAll={false} // OR - al menos uno
  hideIfNoPermission={true}
/>
```

---

### Ejemplo 5: Múltiples Permisos (AND)

```tsx
// El usuario necesita TODOS los permisos
<ProtectedButton
  title="Aprobar y Publicar"
  onPress={handleApproveAndPublish}
  requiredPermissions={[
    'products.approve',
    'products.publish'
  ]}
  requireAll={true} // AND - todos requeridos
  hideIfNoPermission={true}
/>
```

---

### Ejemplo 6: Botón con Fallback

```tsx
// Mostrar un mensaje en lugar de ocultar
<ProtectedButton
  title="Crear Producto"
  onPress={handleCreate}
  requiredPermissions={['products.create']}
  hideIfNoPermission={true}
  fallback={
    <Text style={styles.noPermissionText}>
      No tienes permiso para crear productos
    </Text>
  }
/>
```

---

## Patrones Comunes

### Patrón 1: FAB en Pantallas de Listado

```tsx
// ✅ CORRECTO
<ProtectedFAB
  icon="+"
  onPress={handleCreate}
  requiredPermissions={['module.create']}
  hideIfNoPermission={true}
/>

// ❌ INCORRECTO - No usar ProtectedElement + AddButton
<ProtectedElement requiredPermissions={['module.create']}>
  <AddButton onPress={handleCreate} />
</ProtectedElement>
```

---

### Patrón 2: Botones en Cards

```tsx
// ✅ CORRECTO - Cada botón con su permiso
<View style={styles.actions}>
  <ProtectedTouchableOpacity
    onPress={handleEdit}
    requiredPermissions={['module.update']}
    hideIfNoPermission={true}
  >
    <Text>Editar</Text>
  </ProtectedTouchableOpacity>

  <ProtectedTouchableOpacity
    onPress={handleDelete}
    requiredPermissions={['module.delete']}
    hideIfNoPermission={true}
  >
    <Text>Eliminar</Text>
  </ProtectedTouchableOpacity>
</View>

// ❌ INCORRECTO - Verificación manual
{hasPermission('module.update') && (
  <TouchableOpacity onPress={handleEdit}>
    <Text>Editar</Text>
  </TouchableOpacity>
)}
```

---

### Patrón 3: Secciones Completas

```tsx
// ✅ CORRECTO - Usar ProtectedView
<ProtectedView requiredPermissions={['module.reports.view']}>
  <ReportsSection />
</ProtectedView>

// ❌ INCORRECTO - Verificación manual
{hasPermission('module.reports.view') && (
  <ReportsSection />
)}
```

---

## Mejores Prácticas

### 1. Siempre usar `hideIfNoPermission={true}`
```tsx
// ✅ RECOMENDADO - Ocultar completamente
<ProtectedButton
  title="Crear"
  onPress={handleCreate}
  requiredPermissions={['module.create']}
  hideIfNoPermission={true}
/>

// ⚠️ USAR CON PRECAUCIÓN - Mostrar deshabilitado
<ProtectedButton
  title="Crear"
  onPress={handleCreate}
  requiredPermissions={['module.create']}
  hideIfNoPermission={false}
/>
```

---

### 2. Permisos Específicos

```tsx
// ✅ CORRECTO - Permiso específico
<ProtectedFAB
  icon="+"
  onPress={handleCreate}
  requiredPermissions={['products.create']}
  hideIfNoPermission={true}
/>

// ❌ INCORRECTO - Permiso muy amplio
<ProtectedFAB
  icon="+"
  onPress={handleCreate}
  requiredPermissions={['products']}
  hideIfNoPermission={true}
/>
```

---

### 3. No Proteger Navegación Básica

```tsx
// ✅ CORRECTO - Botón atrás sin protección
<TouchableOpacity onPress={() => navigation.goBack()}>
  <Text>← Atrás</Text>
</TouchableOpacity>

// ❌ INCORRECTO - No proteger navegación básica
<ProtectedTouchableOpacity
  onPress={() => navigation.goBack()}
  requiredPermissions={['some.permission']}
>
  <Text>← Atrás</Text>
</ProtectedTouchableOpacity>
```

---

### 4. Agrupar Permisos Relacionados

```tsx
// ✅ CORRECTO - Permisos relacionados agrupados
const EXPENSE_ACTIONS = {
  edit: ['expenses.update'],
  delete: ['expenses.delete'],
  pay: ['expenses.payments.create'],
  viewPayments: ['expenses.payments.read'],
};

<ProtectedTouchableOpacity
  onPress={handleEdit}
  requiredPermissions={EXPENSE_ACTIONS.edit}
  hideIfNoPermission={true}
>
  <Text>Editar</Text>
</ProtectedTouchableOpacity>
```

---

### 5. Documentar Permisos en Componentes

```tsx
/**
 * ProductCard - Tarjeta de producto con acciones
 *
 * Permisos requeridos:
 * - products.update: Para mostrar botón de editar
 * - products.delete: Para mostrar botón de eliminar
 * - products.prices.update: Para mostrar botón de precios
 */
export const ProductCard = ({ product }) => {
  // ...
};
```

---

## Mapeo de Permisos por Módulo

### Products
- `products.create` → FAB "Crear"
- `products.update` → Botón "Editar"
- `products.delete` → Botón "Eliminar"
- `products.prices.update` → Sección de precios

### Expenses
- `expenses.create` → FAB "Crear"
- `expenses.update` → Botón "Editar"
- `expenses.delete` → Botón "Eliminar"
- `expenses.payments.create` → Botón "Pagar"
- `expenses.payments.read` → Botón "Ver Pagos"
- `expenses.reports.view` → Sección de reportes

### Purchases
- `purchases.create` → FAB "Crear"
- `purchases.update` → Botón "Editar"
- `purchases.delete` → Botón "Cancelar"
- `purchases.ocr.scan` → Botón "Escanear OCR"
- `purchases.validate` → Botón "Validar"

### Users
- `users.create` → FAB "Crear"
- `users.update` → Botón "Editar"
- `users.delete` → Botón "Eliminar"

---

## Troubleshooting

### Problema: El componente no se oculta
**Solución**: Verificar que `hideIfNoPermission={true}` esté configurado.

### Problema: El permiso no funciona
**Solución**: Verificar que el permiso existe en el backend y está asignado al usuario.

### Problema: Todos los botones desaparecen
**Solución**: Verificar que el usuario tenga al menos un permiso básico de lectura.

---

## Recursos Adicionales

- **Componentes**: `src/components/ui/`
- **Hooks**: `src/hooks/usePermissions.ts`
- **Constantes**: `src/constants/permissions.ts`
- **Resumen**: `PERMISSIONS_IMPLEMENTATION_SUMMARY.md`

---

**Última actualización**: 2024
**Versión**: 1.0
