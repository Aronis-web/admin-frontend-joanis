# 💰 Módulo de Gastos - Frontend React Native

## 📋 Descripción

Módulo completo de interfaz móvil para la gestión de gastos operativos con soporte para:

✅ **Gastos Únicos**: Gastos que ocurren una sola vez
✅ **Gastos Recurrentes**: Gastos que se repiten automáticamente (diario, semanal, mensual, anual)
✅ **Gastos Semi-recurrentes**: Gastos con patrones personalizados (días específicos del mes, etc.)
✅ **Costos Fijos y Variables**: Clasificación de gastos
✅ **Registro de Pagos**: Separación entre gasto y pago
✅ **Alertas Automáticas**: Notificaciones por WhatsApp y Email
✅ **Gestión de Proyectos**: Agrupación de gastos por proyecto
✅ **Información de Pago**: Instrucciones detalladas de cómo pagar

## 🗂️ Estructura del Módulo

```
src/
├── types/
│   └── expenses.ts                    # Tipos TypeScript completos
│
├── services/api/
│   └── expenses.ts                    # Servicio API para gastos
│
├── components/Expenses/
│   ├── ExpenseCard.tsx                # Tarjeta de gasto
│   ├── ExpenseStatusBadge.tsx         # Badge de estado de gasto
│   ├── ProjectCard.tsx                # Tarjeta de proyecto
│   ├── ProjectStatusBadge.tsx         # Badge de estado de proyecto
│   ├── PaymentCard.tsx                # Tarjeta de pago
│   ├── PaymentStatusBadge.tsx         # Badge de estado de pago
│   └── CategoryCard.tsx               # Tarjeta de categoría
│
└── screens/Expenses/
    ├── ExpensesScreen.tsx             # Pantalla principal de gastos
    ├── ExpenseDetailScreen.tsx        # Detalle de gasto
    ├── ExpenseCategoriesScreen.tsx    # Listado de categorías
    └── ExpenseProjectsScreen.tsx      # Listado de proyectos
```

## 🚀 Características Implementadas

### ✅ Tipos TypeScript
- Definiciones completas de todas las entidades
- Enums para estados, tipos y métodos
- Interfaces para requests y responses
- Labels y colores para UI

### ✅ Servicios API
- CRUD completo de gastos
- CRUD de categorías
- CRUD de proyectos
- Gestión de recurrencia
- Gestión de pagos
- Configuración de alertas
- Información de pago

### ✅ Componentes Reutilizables
- **ExpenseCard**: Tarjeta visual de gasto con progreso de pago
- **ProjectCard**: Tarjeta de proyecto con progreso de presupuesto
- **PaymentCard**: Tarjeta de pago con detalles
- **CategoryCard**: Tarjeta de categoría con icono
- **Badges**: Indicadores visuales de estado

### ✅ Pantallas Principales
- **ExpensesScreen**: Listado de gastos con filtros por estado y tipo
- **ExpenseDetailScreen**: Detalle completo del gasto con acciones
- **ExpenseCategoriesScreen**: Gestión de categorías
- **ExpenseProjectsScreen**: Gestión de proyectos con filtros

## 📱 Pantallas Implementadas

### 1. ExpensesScreen
**Ruta**: `/expenses`

**Características**:
- Listado de todos los gastos
- Filtros por estado (Draft, Active, Paid, Overdue, Cancelled)
- Filtros por tipo (Único, Recurrente, Semi-recurrente)
- Pull-to-refresh
- Navegación a detalle
- Botón para crear nuevo gasto
- Acceso rápido a categorías

### 2. ExpenseDetailScreen
**Ruta**: `/expenses/:id`

**Características**:
- Información completa del gasto
- Badge de estado
- Progreso de pago visual
- Detalles (categoría, tipo, método de pago, etc.)
- Información de pago del beneficiario
- Lista de pagos registrados
- Acciones contextuales:
  - Activar gasto (si está en Draft)
  - Registrar pago (si está Active)
  - Agregar información de pago
  - Configurar recurrencia
  - Configurar alertas
  - Cancelar gasto

### 3. ExpenseCategoriesScreen
**Ruta**: `/expense-categories`

**Características**:
- Listado de categorías
- Iconos y colores personalizados
- Indicador de categorías inactivas
- Pull-to-refresh
- Botón para crear nueva categoría

### 4. ExpenseProjectsScreen
**Ruta**: `/expense-projects`

**Características**:
- Listado de proyectos
- Filtros por estado (Planning, Active, On Hold, Completed, Cancelled)
- Progreso de presupuesto visual
- Indicador de presupuesto excedido
- Pull-to-refresh
- Botón para crear nuevo proyecto

## 🎨 Componentes UI

### ExpenseCard
```tsx
<ExpenseCard
  expense={expense}
  onPress={(expense) => handleExpensePress(expense)}
/>
```

**Muestra**:
- Código y nombre del gasto
- Badge de estado
- Categoría y tipo
- Monto total y pagado
- Barra de progreso de pago
- Fecha de vencimiento

### ProjectCard
```tsx
<ProjectCard
  project={project}
  onPress={(project) => handleProjectPress(project)}
/>
```

**Muestra**:
- Código y nombre del proyecto
- Badge de estado
- Descripción
- Presupuesto, gastado y disponible
- Barra de progreso de presupuesto
- Fechas de inicio y fin

### PaymentCard
```tsx
<PaymentCard
  payment={payment}
  onPress={(payment) => handlePaymentPress(payment)}
/>
```

**Muestra**:
- Código del pago
- Badge de estado
- Método de pago
- Monto
- Fecha de pago
- Banco y referencia
- Notas
- Usuario que registró

### CategoryCard
```tsx
<CategoryCard
  category={category}
  onPress={(category) => handleCategoryPress(category)}
/>
```

**Muestra**:
- Icono o inicial
- Nombre y código
- Descripción
- Indicador de inactivo

## 🔧 Uso del Servicio API

### Obtener Gastos
```typescript
import { expensesService } from '@/services/api';

// Obtener todos los gastos
const response = await expensesService.getExpenses();

// Con filtros
const response = await expensesService.getExpenses({
  status: ExpenseStatus.ACTIVE,
  expenseType: ExpenseType.RECURRENT,
  categoryId: 'uuid-categoria',
});
```

### Crear Gasto
```typescript
const newExpense = await expensesService.createExpense({
  categoryId: 'uuid-categoria',
  name: 'Alquiler Oficina',
  description: 'Alquiler mensual de oficina',
  expenseType: ExpenseType.RECURRENT,
  costType: CostType.FIXED,
  amountCents: 300000, // S/ 3,000.00
  paymentMethod: PaymentMethod.BCP,
  startDate: '2024-01-01',
});
```

### Activar Gasto
```typescript
await expensesService.activateExpense(expenseId);
```

### Registrar Pago
```typescript
const payment = await expensesService.createPayment(expenseId, {
  amountCents: 300000,
  paymentMethod: PaymentMethod.BCP,
  bankName: 'BCP',
  transactionReference: 'OP-123456',
  paymentDate: '2024-01-05',
  notes: 'Pago de alquiler enero 2024',
});
```

### Configurar Recurrencia
```typescript
const recurrence = await expensesService.createRecurrence(expenseId, {
  recurrenceType: RecurrenceType.REGULAR,
  frequency: RecurrenceFrequency.MONTHLY,
  interval: 1,
  dayOfMonth: 5,
  startDate: '2024-01-01',
});
```

### Configurar Alertas
```typescript
// Crear configuración de alertas
const alertConfig = await expensesService.createAlertConfig(expenseId, {
  alertDaysBefore: [7, 3, 1],
  alertTime: '09:00:00',
  timezone: 'America/Lima',
  enableWhatsApp: true,
  enableEmail: true,
});

// Agregar contacto
const contact = await expensesService.createAlertContact(expenseId, {
  contactName: 'Juan Pérez',
  contactType: ContactType.OWNER,
  phoneNumber: '+51999888777',
  email: 'juan@empresa.com',
  receiveWhatsApp: true,
  receiveEmail: true,
});
```

## 🎯 Estados y Flujos

### Estados de Gastos
- **DRAFT**: Borrador, no activo
- **ACTIVE**: Activo, pendiente de pago
- **PAID**: Pagado completamente
- **CANCELLED**: Cancelado
- **OVERDUE**: Vencido (calculado)

### Flujo de Gasto Único
1. Crear gasto → Estado: DRAFT
2. Agregar información de pago (opcional)
3. Configurar alertas (opcional)
4. Activar gasto → Estado: ACTIVE
5. Sistema envía alertas automáticas
6. Registrar pago → Estado: PAID

### Flujo de Gasto Recurrente
1. Crear gasto → Estado: DRAFT
2. Configurar recurrencia
3. Agregar información de pago
4. Configurar alertas
5. Activar gasto → Estado: ACTIVE
6. Backend genera instancias automáticamente
7. Sistema envía alertas para cada instancia
8. Registrar pago de cada instancia

## 📊 Tipos de Datos

### Expense
```typescript
interface Expense {
  id: string;
  code: string;
  name: string;
  description?: string;
  expenseType: ExpenseType;
  costType: CostType;
  amountCents: number;
  paidAmountCents: number;
  status: ExpenseStatus;
  paymentMethod: PaymentMethod;
  dueDate?: string;
  category?: ExpenseCategory;
  project?: ExpenseProject;
  recurrence?: ExpenseRecurrence;
  paymentInfo?: ExpensePaymentInfo;
  alertConfig?: ExpenseAlertConfig;
  payments?: ExpensePayment[];
  // ... más campos
}
```

### ExpenseProject
```typescript
interface ExpenseProject {
  id: string;
  code: string;
  name: string;
  description?: string;
  budgetCents: number;
  spentCents: number;
  startDate: string;
  endDate?: string;
  status: ProjectStatus;
  expenses?: Expense[];
  // ... más campos
}
```

### ExpensePayment
```typescript
interface ExpensePayment {
  id: string;
  code: string;
  amountCents: number;
  paymentMethod: PaymentMethod;
  bankName?: string;
  transactionReference?: string;
  paymentDate: string;
  status: PaymentStatus;
  notes?: string;
  // ... más campos
}
```

## 🚧 Pendientes de Implementación

### Pantallas Faltantes
- [ ] CreateExpenseScreen - Formulario de creación de gasto
- [ ] EditExpenseScreen - Formulario de edición de gasto
- [ ] CreateExpenseCategoryScreen - Formulario de categoría
- [ ] CreateExpenseProjectScreen - Formulario de proyecto
- [ ] ExpenseProjectDetailScreen - Detalle de proyecto
- [ ] CreateExpensePaymentScreen - Formulario de pago
- [ ] ConfigureRecurrenceScreen - Configuración de recurrencia
- [ ] ConfigureAlertsScreen - Configuración de alertas
- [ ] AddPaymentInfoScreen - Formulario de información de pago

### Funcionalidades Adicionales
- [ ] Búsqueda de gastos
- [ ] Exportación de reportes
- [ ] Gráficos y estadísticas
- [ ] Filtros avanzados
- [ ] Ordenamiento personalizado
- [ ] Vista de calendario para gastos recurrentes
- [ ] Notificaciones push
- [ ] Adjuntar archivos (facturas, comprobantes)

## 🔗 Integración con Navegación

Para integrar el módulo en la navegación de la app, agregar las rutas en el stack navigator:

```typescript
// En tu NavigationStack
<Stack.Screen
  name="Expenses"
  component={ExpensesScreen}
  options={{ title: 'Gastos' }}
/>
<Stack.Screen
  name="ExpenseDetail"
  component={ExpenseDetailScreen}
  options={{ title: 'Detalle de Gasto' }}
/>
<Stack.Screen
  name="ExpenseCategories"
  component={ExpenseCategoriesScreen}
  options={{ title: 'Categorías' }}
/>
<Stack.Screen
  name="ExpenseProjects"
  component={ExpenseProjectsScreen}
  options={{ title: 'Proyectos' }}
/>
```

## 📝 Notas Técnicas

### Montos en Centavos
Todos los montos se manejan en centavos para evitar problemas de precisión:
```typescript
// S/ 1,500.00 = 150000 centavos
amountCents: 150000
```

### Formateo de Montos
```typescript
const formatAmount = (cents: number) => {
  const amount = cents / 100;
  return `S/ ${amount.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};
```

### Formateo de Fechas
```typescript
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};
```

## 🎨 Paleta de Colores

```typescript
// Estados de Gastos
ExpenseStatusColors = {
  DRAFT: '#94A3B8',      // Gris
  ACTIVE: '#3B82F6',     // Azul
  PAID: '#10B981',       // Verde
  CANCELLED: '#EF4444',  // Rojo
  OVERDUE: '#F59E0B',    // Naranja
}

// Estados de Proyectos
ProjectStatusColors = {
  PLANNING: '#94A3B8',   // Gris
  ACTIVE: '#3B82F6',     // Azul
  ON_HOLD: '#F59E0B',    // Naranja
  COMPLETED: '#10B981',  // Verde
  CANCELLED: '#EF4444',  // Rojo
}

// Estados de Pagos
PaymentStatusColors = {
  PENDING: '#F59E0B',    // Naranja
  APPROVED: '#10B981',   // Verde
  REJECTED: '#EF4444',   // Rojo
  CANCELLED: '#94A3B8',  // Gris
}
```

## 📚 Recursos Adicionales

- [Documentación del Backend](../../../backend/expenses/README.md)
- [Guía de API](../../../docs/api/expenses.md)
- [Ejemplos de Uso](../../../docs/examples/expenses.md)

## 🤝 Contribuir

Para agregar nuevas funcionalidades al módulo:

1. Agregar tipos en `src/types/expenses.ts`
2. Agregar métodos en `src/services/api/expenses.ts`
3. Crear componentes en `src/components/Expenses/`
4. Crear pantallas en `src/screens/Expenses/`
5. Actualizar este README

## 📄 Licencia

Este módulo es parte del sistema de administración y está sujeto a la licencia del proyecto principal.
