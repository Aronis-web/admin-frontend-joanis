# 🔐 Ejemplos de Uso del Sistema de Permisos

## 📚 Guía Rápida con Ejemplos de Código

Este documento contiene ejemplos prácticos para migrar pantallas al nuevo sistema de permisos.

---

## 🎯 Ejemplo 1: Botón de Crear (AddButton)

### ❌ ANTES
```tsx
<AddButton onPress={handleCreateProduct} icon="📦" />
```

### ✅ DESPUÉS
```tsx
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { PERMISSIONS } from '@/constants/permissions';

<ProtectedElement
  requiredPermissions={[PERMISSIONS.PRODUCTS.CREATE]}
  fallback={null}
>
  <AddButton onPress={handleCreateProduct} icon="📦" />
</ProtectedElement>
```

---

## 🎯 Ejemplo 2: Botón de Editar

### ❌ ANTES
```tsx
<TouchableOpacity
  style={styles.editButton}
  onPress={() => handleEdit(item)}
>
  <Text style={styles.editButtonText}>✏️ Editar</Text>
</TouchableOpacity>
```

### ✅ DESPUÉS
```tsx
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { PERMISSIONS } from '@/constants/permissions';

<ProtectedTouchableOpacity
  style={styles.editButton}
  onPress={() => handleEdit(item)}
  requiredPermissions={[PERMISSIONS.PRODUCTS.UPDATE]}
  hideIfNoPermission={true}
>
  <Text style={styles.editButtonText}>✏️ Editar</Text>
</ProtectedTouchableOpacity>
```

---

## 🎯 Ejemplo 3: Botón de Eliminar

### ❌ ANTES
```tsx
<TouchableOpacity
  style={[styles.actionButton, styles.deleteButton]}
  onPress={() => handleDelete(item)}
>
  <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
    🗑️ Eliminar
  </Text>
</TouchableOpacity>
```

### ✅ DESPUÉS
```tsx
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { PERMISSIONS } from '@/constants/permissions';

<ProtectedTouchableOpacity
  style={[styles.actionButton, styles.deleteButton]}
  onPress={() => handleDelete(item)}
  requiredPermissions={[PERMISSIONS.PRODUCTS.DELETE]}
  hideIfNoPermission={true}
>
  <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
    🗑️ Eliminar
  </Text>
</ProtectedTouchableOpacity>
```

---

## 🎯 Ejemplo 4: Botones CRUD Completos con ProtectedActionButton

### ✅ OPCIÓN SIMPLIFICADA
```tsx
import { ProtectedActionButton } from '@/components/ui/ProtectedActionButton';

<View style={styles.actions}>
  {/* Crear - verifica automáticamente 'products.create' */}
  <ProtectedActionButton
    action="create"
    module="products"
    onPress={handleCreate}
    icon="+"
    label="Nuevo"
    variant="primary"
  />

  {/* Editar - verifica automáticamente 'products.update' */}
  <ProtectedActionButton
    action="update"
    module="products"
    onPress={() => handleEdit(item)}
    icon="✏️"
    label="Editar"
    variant="secondary"
  />

  {/* Eliminar - verifica automáticamente 'products.delete' */}
  <ProtectedActionButton
    action="delete"
    module="products"
    onPress={() => handleDelete(item)}
    icon="🗑️"
    label="Eliminar"
    variant="danger"
  />
</View>
```

---

## 🎯 Ejemplo 5: Acciones Especiales (Cerrar, Aprobar, etc.)

### Para Compras - Cerrar
```tsx
import { ProtectedButton } from '@/components/ui/ProtectedButton';
import { PERMISSIONS } from '@/constants/permissions';

<ProtectedButton
  title="Cerrar Compra"
  onPress={handleClosePurchase}
  requiredPermissions={[PERMISSIONS.PURCHASES.CLOSE]}
  variant="primary"
  hideIfNoPermission={true}
/>
```

### Para Gastos - Aprobar Pago
```tsx
<ProtectedButton
  title="Aprobar Pago"
  onPress={handleApprovePayment}
  requiredPermissions={[PERMISSIONS.EXPENSES.PAYMENTS.APPROVE]}
  variant="primary"
  hideIfNoPermission={true}
/>
```

### Para Balances - Activar/Desactivar
```tsx
<ProtectedButton
  title={balance.isActive ? "Desactivar" : "Activar"}
  onPress={handleToggleActive}
  requiredPermissions={[
    balance.isActive
      ? PERMISSIONS.BALANCES.DEACTIVATE
      : PERMISSIONS.BALANCES.ACTIVATE
  ]}
  variant="secondary"
  hideIfNoPermission={true}
/>
```

### Para Traslados - Enviar/Recibir
```tsx
<ProtectedButton
  title="Enviar Traslado"
  onPress={handleShip}
  requiredPermissions={[PERMISSIONS.TRANSFERS.SHIP]}
  variant="primary"
  hideIfNoPermission={true}
/>

<ProtectedButton
  title="Recibir Traslado"
  onPress={handleReceive}
  requiredPermissions={[PERMISSIONS.TRANSFERS.RECEIVE]}
  variant="success"
  hideIfNoPermission={true}
/>
```

---

## 🎯 Ejemplo 6: Múltiples Permisos (OR Logic)

### Usuario necesita AL MENOS UNO de estos permisos
```tsx
import { ProtectedButton } from '@/components/ui/ProtectedButton';
import { PERMISSIONS } from '@/constants/permissions';

<ProtectedButton
  title="Gestionar Gastos"
  onPress={handleManageExpenses}
  requiredPermissions={[
    PERMISSIONS.EXPENSES.UPDATE,
    PERMISSIONS.EXPENSES.ADMIN,
  ]}
  requireAll={false} // OR logic (por defecto)
  hideIfNoPermission={true}
/>
```

---

## 🎯 Ejemplo 7: Múltiples Permisos (AND Logic)

### Usuario necesita TODOS estos permisos
```tsx
<ProtectedButton
  title="Asignar Roles y Permisos"
  onPress={handleAssignRolesAndPerms}
  requiredPermissions={[
    PERMISSIONS.IAM.ASSIGN_USER_ROLES,
    PERMISSIONS.IAM.ASSIGN_USER_PERMS,
  ]}
  requireAll={true} // AND logic
  hideIfNoPermission={true}
/>
```

---

## 🎯 Ejemplo 8: Verificación Manual con Hooks

### Verificar permisos en lógica del componente
```tsx
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/constants/permissions';

const MyComponent = () => {
  const { hasPermission, hasAnyPermission } = usePermissions();

  // Verificar un permiso específico
  const canCreate = hasPermission(PERMISSIONS.PRODUCTS.CREATE);

  // Verificar múltiples permisos (OR)
  const canManage = hasAnyPermission([
    PERMISSIONS.PRODUCTS.UPDATE,
    PERMISSIONS.PRODUCTS.DELETE,
  ]);

  return (
    <View>
      {canCreate && (
        <Button title="Crear Producto" onPress={handleCreate} />
      )}

      {canManage && (
        <Button title="Gestionar" onPress={handleManage} />
      )}
    </View>
  );
};
```

---

## 🎯 Ejemplo 9: Hook de Permisos CRUD

### Verificación simplificada de permisos CRUD
```tsx
import { useActionPermissions } from '@/hooks/useActionPermissions';

const ProductsScreen = () => {
  const { canCreate, canUpdate, canDelete, canManage } = useActionPermissions('products');

  return (
    <View>
      {canCreate && <AddButton onPress={handleCreate} />}

      {canUpdate && (
        <TouchableOpacity onPress={handleEdit}>
          <Text>✏️ Editar</Text>
        </TouchableOpacity>
      )}

      {canDelete && (
        <TouchableOpacity onPress={handleDelete}>
          <Text>🗑️ Eliminar</Text>
        </TouchableOpacity>
      )}

      {canManage && (
        <Text>Tienes permisos de gestión</Text>
      )}
    </View>
  );
};
```

---

## 🎯 Ejemplo 10: Sección Completa Protegida

### Proteger un grupo de botones
```tsx
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { PERMISSIONS } from '@/constants/permissions';

<ProtectedElement
  requiredPermissions={[PERMISSIONS.EXPENSES.PAYMENTS.CREATE]}
>
  <View style={styles.paymentActions}>
    <Button title="Pago Completo" onPress={handleFullPayment} />
    <Button title="Pago Parcial" onPress={handlePartialPayment} />
    <Button title="Pago con Archivo" onPress={handlePaymentWithFile} />
  </View>
</ProtectedElement>
```

---

## 🎯 Ejemplo 11: Botón Deshabilitado vs Oculto

### Ocultar completamente (recomendado)
```tsx
<ProtectedButton
  title="Eliminar"
  onPress={handleDelete}
  requiredPermissions={[PERMISSIONS.PRODUCTS.DELETE]}
  hideIfNoPermission={true} // No se renderiza
/>
```

### Mostrar deshabilitado (para indicar funcionalidad)
```tsx
<ProtectedButton
  title="Eliminar"
  onPress={handleDelete}
  requiredPermissions={[PERMISSIONS.PRODUCTS.DELETE]}
  hideIfNoPermission={false} // Se muestra deshabilitado
/>
```

---

## 🎯 Ejemplo 12: Migración de Pantalla Completa

### Estructura típica de una pantalla migrada
```tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import { ProtectedButton } from '@/components/ui/ProtectedButton';
import { AddButton } from '@/components/Navigation/AddButton';
import { PERMISSIONS } from '@/constants/permissions';
import { useActionPermissions } from '@/hooks/useActionPermissions';

export const ProductsScreen = ({ navigation }) => {
  const [products, setProducts] = useState([]);
  const { canCreate, canUpdate, canDelete } = useActionPermissions('products');

  return (
    <View style={styles.container}>
      {/* Header con botón de crear protegido */}
      <View style={styles.header}>
        <Text style={styles.title}>Productos</Text>
        <ProtectedElement
          requiredPermissions={[PERMISSIONS.PRODUCTS.CREATE]}
          fallback={null}
        >
          <AddButton onPress={handleCreate} icon="📦" />
        </ProtectedElement>
      </View>

      {/* Lista de productos */}
      <ScrollView>
        {products.map((product) => (
          <View key={product.id} style={styles.productCard}>
            <Text>{product.name}</Text>

            {/* Botones de acción protegidos */}
            <View style={styles.actions}>
              <ProtectedTouchableOpacity
                style={styles.editButton}
                onPress={() => handleEdit(product)}
                requiredPermissions={[PERMISSIONS.PRODUCTS.UPDATE]}
                hideIfNoPermission={true}
              >
                <Text>✏️ Editar</Text>
              </ProtectedTouchableOpacity>

              <ProtectedTouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(product)}
                requiredPermissions={[PERMISSIONS.PRODUCTS.DELETE]}
                hideIfNoPermission={true}
              >
                <Text>🗑️ Eliminar</Text>
              </ProtectedTouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Botón flotante de acción */}
      {canCreate && (
        <ProtectedButton
          title="Crear Producto"
          onPress={handleCreate}
          requiredPermissions={[PERMISSIONS.PRODUCTS.CREATE]}
          variant="primary"
          style={styles.floatingButton}
        />
      )}
    </View>
  );
};
```

---

## 📋 Checklist de Migración

Al migrar una pantalla, verifica:

- [ ] Importar `PERMISSIONS` de `@/constants/permissions`
- [ ] Importar componentes protegidos necesarios
- [ ] Reemplazar todos los `TouchableOpacity` de acciones con `ProtectedTouchableOpacity`
- [ ] Usar constantes `PERMISSIONS.*` en lugar de strings
- [ ] Configurar `hideIfNoPermission={true}` para ocultar botones
- [ ] Verificar que los permisos coincidan con el backend
- [ ] Probar con diferentes roles de usuario
- [ ] No hay errores de TypeScript

---

## 🔍 Referencia Rápida de Permisos por Módulo

### Productos
```tsx
PERMISSIONS.PRODUCTS.CREATE
PERMISSIONS.PRODUCTS.READ
PERMISSIONS.PRODUCTS.UPDATE
PERMISSIONS.PRODUCTS.DELETE
```

### Compras
```tsx
PERMISSIONS.PURCHASES.CREATE
PERMISSIONS.PURCHASES.READ
PERMISSIONS.PURCHASES.UPDATE
PERMISSIONS.PURCHASES.DELETE
PERMISSIONS.PURCHASES.CLOSE
PERMISSIONS.PURCHASES.VALIDATE
PERMISSIONS.PURCHASES.VALIDATE_CLOSE
PERMISSIONS.PURCHASES.PRODUCTS_ADD
PERMISSIONS.PURCHASES.PRODUCTS_EDIT
PERMISSIONS.PURCHASES.PRODUCTS_DELETE
PERMISSIONS.PURCHASES.DEBT_ASSIGN
PERMISSIONS.PURCHASES.OCR_SCAN
```

### Gastos
```tsx
PERMISSIONS.EXPENSES.CREATE
PERMISSIONS.EXPENSES.READ
PERMISSIONS.EXPENSES.UPDATE
PERMISSIONS.EXPENSES.DELETE
PERMISSIONS.EXPENSES.ADMIN // Incluye todos los permisos de gastos

// Pagos
PERMISSIONS.EXPENSES.PAYMENTS.CREATE
PERMISSIONS.EXPENSES.PAYMENTS.READ
PERMISSIONS.EXPENSES.PAYMENTS.UPDATE
PERMISSIONS.EXPENSES.PAYMENTS.DELETE
PERMISSIONS.EXPENSES.PAYMENTS.APPROVE

// Categorías
PERMISSIONS.EXPENSES.CATEGORIES.CREATE
PERMISSIONS.EXPENSES.CATEGORIES.READ
PERMISSIONS.EXPENSES.CATEGORIES.UPDATE
PERMISSIONS.EXPENSES.CATEGORIES.DELETE

// Proyectos
PERMISSIONS.EXPENSES.PROJECTS.CREATE
PERMISSIONS.EXPENSES.PROJECTS.READ
PERMISSIONS.EXPENSES.PROJECTS.UPDATE
PERMISSIONS.EXPENSES.PROJECTS.DELETE
PERMISSIONS.EXPENSES.PROJECTS.CLOSE

// Plantillas
PERMISSIONS.EXPENSES.TEMPLATES.CREATE
PERMISSIONS.EXPENSES.TEMPLATES.READ
PERMISSIONS.EXPENSES.TEMPLATES.UPDATE
PERMISSIONS.EXPENSES.TEMPLATES.DELETE
PERMISSIONS.EXPENSES.TEMPLATES.GENERATE
PERMISSIONS.EXPENSES.TEMPLATES.ADMIN
```

### Campañas
```tsx
PERMISSIONS.CAMPAIGNS.CREATE
PERMISSIONS.CAMPAIGNS.READ
PERMISSIONS.CAMPAIGNS.UPDATE
PERMISSIONS.CAMPAIGNS.DELETE
PERMISSIONS.CAMPAIGNS.ACTIVATE
PERMISSIONS.CAMPAIGNS.CLOSE
PERMISSIONS.CAMPAIGNS.CANCEL
```

### Repartos
```tsx
PERMISSIONS.REPARTOS.CREATE
PERMISSIONS.REPARTOS.READ
PERMISSIONS.REPARTOS.UPDATE
PERMISSIONS.REPARTOS.DELETE
PERMISSIONS.REPARTOS.CANCEL
PERMISSIONS.REPARTOS.VALIDATE
PERMISSIONS.REPARTOS.EXPORT
PERMISSIONS.REPARTOS.REPORTS
PERMISSIONS.REPARTOS.GENERATE_TRANSFER
```

### Balances
```tsx
PERMISSIONS.BALANCES.CREATE
PERMISSIONS.BALANCES.READ
PERMISSIONS.BALANCES.UPDATE
PERMISSIONS.BALANCES.DELETE
PERMISSIONS.BALANCES.ACTIVATE
PERMISSIONS.BALANCES.DEACTIVATE
PERMISSIONS.BALANCES.CLOSE

// Archivos
PERMISSIONS.BALANCES.FILES.UPLOAD
PERMISSIONS.BALANCES.FILES.READ
PERMISSIONS.BALANCES.FILES.DELETE

// Operaciones
PERMISSIONS.BALANCES.OPERATIONS.CREATE
PERMISSIONS.BALANCES.OPERATIONS.READ
PERMISSIONS.BALANCES.OPERATIONS.UPDATE
PERMISSIONS.BALANCES.OPERATIONS.DELETE

// Reportes
PERMISSIONS.BALANCES.REPORTS.READ
```

### Traslados
```tsx
PERMISSIONS.TRANSFERS.CREATE
PERMISSIONS.TRANSFERS.READ
PERMISSIONS.TRANSFERS.EXECUTE
PERMISSIONS.TRANSFERS.APPROVE
PERMISSIONS.TRANSFERS.SHIP
PERMISSIONS.TRANSFERS.RECEIVE
PERMISSIONS.TRANSFERS.VALIDATE
PERMISSIONS.TRANSFERS.COMPLETE
PERMISSIONS.TRANSFERS.CANCEL
```

---

## 💡 Tips y Mejores Prácticas

1. **Siempre usar constantes** en lugar de strings hardcodeados
2. **Ocultar botones** (`hideIfNoPermission={true}`) en lugar de deshabilitarlos
3. **Usar `ProtectedActionButton`** para acciones CRUD simples
4. **Verificar permisos en el backend** - el frontend es solo UX
5. **Probar con diferentes roles** antes de hacer commit
6. **Documentar permisos especiales** en comentarios del código

---

**Última actualización:** 2024
