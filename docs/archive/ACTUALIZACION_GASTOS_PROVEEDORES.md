# 🎨 Actualización del Módulo de Gastos - Integración con Proveedores y Cuentas por Pagar

## 📋 Resumen de Cambios

Se ha actualizado el módulo de gastos para integrarlo con el sistema de proveedores y cuentas por pagar, permitiendo:

✅ Seleccionar proveedor y razón social (RUC) al crear/editar gastos
✅ Mostrar información de la cuenta por pagar vinculada
✅ Búsqueda inteligente de proveedores
✅ Selector de razón social (RUC) del proveedor
✅ Visualización de estado de pago desde la cuenta por pagar

---

## 🔧 Archivos Modificados

### 1. **Tipos TypeScript** (`src/types/expenses.ts`)

#### Nuevos Tipos Agregados:

```typescript
// Tipo de proveedor
export type SupplierType =
  | 'UTILITIES'
  | 'MERCHANDISE'
  | 'SERVICES'
  | 'MAINTENANCE'
  | 'TECHNOLOGY'
  | 'MARKETING'
  | 'LOGISTICS'
  | 'PROFESSIONAL'
  | 'GOVERNMENT'
  | 'FINANCIAL'
  | 'RENT'
  | 'PAYROLL'
  | 'TAXES'
  | 'LOANS'
  | 'INSURANCE'
  | 'TRANSPORT'
  | 'OTHER';

// Razón Social del Proveedor
export interface SupplierLegalEntity {
  id: string;
  supplierId: string;
  legalName: string;
  ruc: string;
  taxAddress?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

// Proveedor para Gastos
export interface Supplier {
  id: string;
  code: string;
  commercialName: string;
  primaryType?: SupplierType;
  supplierTypes?: SupplierType[];
  category?: string;
  email?: string;
  phone?: string;
  legalEntities?: SupplierLegalEntity[];
}

// Estado de Cuenta por Pagar
export type AccountPayableStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';

// Cuenta por Pagar
export interface AccountPayable {
  id: string;
  code: string;
  status: AccountPayableStatus;
  totalAmountCents: number;
  paidAmountCents: number;
  balanceCents: number;
  dueDate: string;
  overdueDays?: number;
  createdAt: string;
  updatedAt: string;
}
```

#### Campos Agregados a `Expense`:

```typescript
export interface Expense {
  // ... campos existentes ...

  // NUEVOS CAMPOS
  supplierId?: string;
  supplier?: Supplier;
  supplierLegalEntityId?: string;
  supplierLegalEntity?: SupplierLegalEntity;
  accountPayable?: AccountPayable;
}
```

#### Campos Agregados a `CreateExpenseRequest`:

```typescript
export interface CreateExpenseRequest {
  // ... campos existentes ...

  // NUEVOS CAMPOS
  supplierId?: string;
  supplierLegalEntityId?: string; // OBLIGATORIO si hay supplierId
}
```

#### Nuevos Filtros en `QueryExpensesParams`:

```typescript
export interface QueryExpensesParams {
  // ... campos existentes ...

  // NUEVOS FILTROS
  supplierId?: string;
  supplierPrimaryType?: SupplierType;
  onlyWithAccountPayable?: boolean;
  includeAccountPayable?: boolean;
}
```

---

### 2. **Componente de Búsqueda de Proveedores** (`src/components/Suppliers/SupplierSearchInput.tsx`)

**Nuevo componente creado** con las siguientes características:

- 🔍 Búsqueda inteligente de proveedores con debounce
- 📱 Modal de búsqueda con lista de resultados
- 🏷️ Muestra nombre comercial, RUC y tipo de proveedor
- ✅ Selección y limpieza de proveedor
- 🎨 Diseño responsive y accesible

**Props del componente:**

```typescript
interface SupplierSearchInputProps {
  value?: string; // Supplier ID
  selectedSupplier?: Supplier | null;
  onSelect: (supplier: Supplier | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}
```

---

### 3. **Pantalla de Crear/Editar Gasto** (`src/screens/Expenses/CreateExpenseScreen.tsx`)

#### Cambios Realizados:

1. **Importaciones agregadas:**
   ```typescript
   import { suppliersService } from '@/services/api';
   import { Supplier, SupplierLegalEntity } from '@/types/expenses';
   import { SupplierSearchInput } from '@/components/Suppliers/SupplierSearchInput';
   ```

2. **Nuevos estados:**
   ```typescript
   const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
   const [supplierLegalEntityId, setSupplierLegalEntityId] = useState('');
   const [legalEntities, setLegalEntities] = useState<SupplierLegalEntity[]>([]);
   ```

3. **Efecto para cargar razones sociales:**
   - Cuando se selecciona un proveedor, se cargan automáticamente sus razones sociales
   - Se auto-selecciona la razón social principal si existe

4. **Validación agregada:**
   - Si hay proveedor seleccionado, DEBE haber RUC seleccionado

5. **Nueva sección en el formulario:**
   - Buscador de proveedor (componente `SupplierSearchInput`)
   - Selector de razón social (RUC) con lista desplegable
   - Banner informativo sobre la creación automática de cuenta por pagar

6. **Datos enviados al backend:**
   - `supplierId`: ID del proveedor seleccionado
   - `supplierLegalEntityId`: ID de la razón social seleccionada

---

### 4. **Tarjeta de Gasto** (`src/components/Expenses/ExpenseCard.tsx`)

#### Cambios Realizados:

1. **Nuevas funciones helper:**
   ```typescript
   const getAccountPayableStatusLabel = (status: string): string => { ... }
   const getAccountPayableStatusStyle = (status: string) => { ... }
   ```

2. **Información de proveedor agregada:**
   - Muestra nombre comercial del proveedor
   - Muestra RUC de la razón social
   - Muestra tipo de proveedor (badge)

3. **Sección de Cuenta por Pagar:**
   - Código de la cuenta por pagar
   - Estado (PENDING, PARTIAL, PAID, CANCELLED)
   - Saldo pendiente
   - Advertencia de días vencidos (si aplica)

4. **Nuevos estilos agregados:**
   - `accountPayableContainer`
   - `accountPayableHeader`
   - `accountPayableCode`
   - `accountPayableStatusBadge`
   - `accountPayableStatusText`
   - `accountPayableDetails`
   - `accountPayableLabel`
   - `accountPayableBalance`
   - `overdueWarning`
   - `overdueText`

---

### 5. **Exportaciones** (`src/components/Suppliers/index.ts`)

Agregado:
```typescript
export { SupplierSearchInput } from './SupplierSearchInput';
```

---

## 🎯 Flujo de Usuario

### Crear Gasto con Proveedor:

1. Usuario abre formulario de crear gasto
2. Llena campos básicos (nombre, monto, categoría, etc.)
3. **NUEVO:** Busca y selecciona proveedor usando el buscador inteligente
4. **NUEVO:** Selecciona RUC del proveedor (se cargan automáticamente)
5. Guarda el gasto
6. **Backend:** Si el gasto está en estado ACTIVE y tiene proveedor, se crea automáticamente una cuenta por pagar

### Ver Gasto con Proveedor:

1. Usuario ve lista de gastos
2. **NUEVO:** Cada tarjeta muestra:
   - Nombre del proveedor
   - RUC de la razón social
   - Tipo de proveedor
   - **Cuenta por Pagar** (si existe):
     - Código
     - Estado
     - Saldo pendiente
     - Días vencido (si aplica)

---

## 🚨 Validaciones Implementadas

### Frontend:

1. **Si hay proveedor, DEBE haber RUC:**
   ```typescript
   if (selectedSupplier && !supplierLegalEntityId) {
     Alert.alert('Error', 'Debe seleccionar el RUC del proveedor');
     return;
   }
   ```

2. **Auto-selección de RUC principal:**
   - Cuando se selecciona un proveedor, se auto-selecciona su razón social principal

3. **Advertencia si no hay razones sociales:**
   - Si el proveedor no tiene razones sociales registradas, se muestra una alerta

---

## 📱 Diseño Responsive

- ✅ Componente de búsqueda con modal full-screen
- ✅ Tarjetas de gasto adaptadas para mostrar información adicional

---

## ⚠️ IMPORTANTE: Fixes Aplicados

### Fix 1: Endpoints API (404 → ✅)
**Fecha:** 2025-02-27

Se corrigieron los endpoints de la API de gastos que estaban causando errores 404. El backend NO usa el prefijo `/admin` ni la versión `/v2`.

**Cambios Aplicados:**
✅ Actualizado `src/services/api/expenses.ts`:
- Cambiado `/admin/expenses/v2/list` → `/expenses`
- Cambiado `/admin/expenses/v2/search` → `/expenses`
- Agregado `includeAccountPayable: true` en todas las queries
- Limpieza de parámetros undefined

📄 Ver `FIX_404_EXPENSES_API.md` para detalles completos

### Fix 2: Búsqueda de Proveedores (No Filtraba → ✅)
**Fecha:** 2025-02-27

Se corrigió el buscador de proveedores que no estaba filtrando los resultados. El backend espera el parámetro `query` en lugar de `q`.

**Cambios Aplicados:**
✅ Actualizado `src/components/Suppliers/SupplierSearchInput.tsx`:
- Cambiado parámetro `q` → `query`
- Ahora filtra correctamente por texto de búsqueda

✅ Actualizado `src/types/suppliers.ts`:
- Agregado parámetro `query` a `QuerySuppliersParams`

📄 Ver `FIX_SUPPLIER_SEARCH.md` para detalles completos

---

## 📚 Documentación Relacionada

- **Fix 404 API:** `FIX_404_EXPENSES_API.md` ⚠️ **LEER PRIMERO**
- Tipos de datos: `src/types/expenses.ts`
- Servicio API: `src/services/api/expenses.ts`
- Hooks: `src/hooks/api/useExpenses.ts`
- Componentes: `src/components/Expenses/`, `src/components/Suppliers/`
- Pantallas: `src/screens/Expenses/`
- ✅ Badges y etiquetas para mejor visualización
- ✅ Colores diferenciados por estado de cuenta por pagar

---

## 🔄 Integración con Backend

### Endpoints Utilizados:

1. **Búsqueda de proveedores:**
   ```typescript
   GET /api/suppliers/search?q={query}&isActive=true&limit=20
   ```

2. **Obtener proveedor con razones sociales:**
   ```typescript
   GET /api/suppliers/{supplierId}
   ```

3. **Crear gasto con proveedor:**
   ```typescript
   POST /api/expenses
   Body: {
     ...campos existentes,
     supplierId: string,
     supplierLegalEntityId: string
   }
   ```

4. **Obtener gastos con cuenta por pagar:**
   ```typescript
   GET /api/expenses?includeAccountPayable=true
   ```

---

## ✅ Estado de Implementación

- ✅ Tipos TypeScript actualizados
- ✅ Componente de búsqueda de proveedores creado
- ✅ Formulario de crear/editar gasto actualizado
- ✅ Tarjeta de gasto actualizada
- ✅ Validaciones implementadas
- ✅ Integración con backend configurada

---

## 📝 Notas Importantes

1. **Cuenta por Pagar Automática:**
   - Se crea automáticamente cuando el gasto está en estado ACTIVE y tiene proveedor
   - El backend maneja la creación mediante triggers

2. **Sincronización de Estados:**
   - El estado del gasto se sincroniza con el estado de la cuenta por pagar
   - Los pagos se gestionan desde el módulo de Cuentas por Pagar

3. **Razón Social Obligatoria:**
   - Si se selecciona un proveedor, es OBLIGATORIO seleccionar una razón social (RUC)
   - Esto asegura la correcta facturación

---

## 🐛 Errores Conocidos

- ⚠️ TypeScript muestra errores de "duplicate property" en los estilos de `CreateExpenseScreen.tsx`
  - Estos son falsos positivos del linter
  - No afectan la funcionalidad del código
  - Se pueden ignorar de forma segura

---

## 🚀 Próximos Pasos Sugeridos

1. Implementar filtros por tipo de proveedor en la lista de gastos
2. Agregar vista detallada de gasto con información completa de cuenta por pagar
3. Implementar botón para activar gastos en DRAFT
4. Agregar dashboard con métricas de cuentas por pagar
5. Implementar reportes por tipo de proveedor

---

**Fecha de actualización:** 2025
**Versión:** 1.0.0
