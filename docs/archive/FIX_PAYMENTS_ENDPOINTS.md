# 🔧 Fix - Endpoints de Pagos (Payments)

## 📋 Problema

**Error reportado:**
```
ERROR [AllExceptionsFilter] reqId=e82e4733-548d-4a9c-9945-274bdcd72395 status=404 msg=Cannot POST /expenses/c89a6629-d6c9-4195-b7ca-dce1399e02e7/payments/reconcile
```

**Causa raíz:**
- El backend tiene el controlador de pagos con la ruta base: `@Controller('admin/expenses/:expenseId/payments')`
- El frontend estaba usando `/expenses/:expenseId/payments/*` (sin el prefijo `/admin`)
- Esto causaba 404 en todas las operaciones de pagos

## ✅ Solución Implementada

### Archivo modificado: `src/services/api/expenses.ts`

**1. Agregado nuevo path para pagos:**
```typescript
class ExpensesService {
  private readonly basePath = '/expenses';
  private readonly paymentsBasePath = '/admin/expenses'; // Payments endpoints use /admin prefix
  private readonly categoriesPath = '/admin/expense-categories';
  private readonly templatesPath = '/admin/expense-templates';
  private readonly projectionsPath = '/admin/expense-projections';
  private readonly projectsPath = '/admin/expense-projects';
```

**2. Actualizados todos los métodos de pagos:**

Los siguientes métodos ahora usan `paymentsBasePath` en lugar de `basePath`:

- ✅ `createPayment()` - Crear pago simple
- ✅ `createPaymentWithFile()` - Crear pago con archivo adjunto
- ✅ `registerPartialPayment()` - Registrar pago parcial
- ✅ `registerPartialPaymentWithFile()` - Registrar pago parcial con archivo
- ✅ `reconcileAmount()` - Reconciliar monto real
- ✅ `getPayments()` - Obtener todos los pagos
- ✅ `getPaymentStatus()` - Obtener estado de pago

**Ejemplo de cambio:**
```typescript
// ❌ Antes
async reconcileAmount(expenseId: string, data: ReconcileAmountRequest): Promise<any> {
  return apiClient.post(`${this.basePath}/${expenseId}/payments/reconcile`, data);
}

// ✅ Después
async reconcileAmount(expenseId: string, data: ReconcileAmountRequest): Promise<any> {
  return apiClient.post(`${this.paymentsBasePath}/${expenseId}/payments/reconcile`, data);
}
```

## 🎯 Endpoints Corregidos

Todos los endpoints de pagos ahora apuntan correctamente a:

| Método | Endpoint Anterior | Endpoint Correcto |
|--------|------------------|-------------------|
| POST | `/expenses/:id/payments` | `/admin/expenses/:id/payments` |
| POST | `/expenses/:id/payments/with-file` | `/admin/expenses/:id/payments/with-file` |
| POST | `/expenses/:id/payments/partial` | `/admin/expenses/:id/payments/partial` |
| POST | `/expenses/:id/payments/partial/with-file` | `/admin/expenses/:id/payments/partial/with-file` |
| POST | `/expenses/:id/payments/reconcile` | `/admin/expenses/:id/payments/reconcile` |
| GET | `/expenses/:id/payments` | `/admin/expenses/:id/payments` |
| GET | `/expenses/:id/payments/status` | `/admin/expenses/:id/payments/status` |

## 📊 Estructura de Endpoints del Backend

Ahora tenemos clara la estructura de endpoints:

### Sin prefijo `/admin`:
- `/expenses` - CRUD de gastos
- `/sites` - Sedes
- `/suppliers` - Proveedores

### Con prefijo `/admin`:
- `/admin/expenses/:id/payments` - **Pagos de gastos**
- `/admin/expense-categories` - Categorías
- `/admin/expense-templates` - Templates
- `/admin/expense-projections` - Proyecciones
- `/admin/expense-projects` - Proyectos

## ✅ Verificación

- ✅ No hay errores de TypeScript
- ✅ Todos los métodos de pagos actualizados
- ✅ Estructura consistente con el backend

## 🚀 Próximos Pasos

1. Probar la reconciliación de montos
2. Probar la creación de pagos
3. Probar pagos parciales
4. Verificar la visualización de pagos en las tarjetas de gastos

---

**Fecha:** 27 de febrero de 2025
**Archivos modificados:** 1
**Métodos actualizados:** 7
