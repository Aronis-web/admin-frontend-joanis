# Módulo de Deudas de Proveedores

## 📋 Descripción

Módulo completo para la gestión de deudas y transacciones con proveedores. Permite registrar compras, pagos, ajustes, notas de crédito/débito, adjuntar archivos y asignar transacciones a empresas.

## 🎯 Características Implementadas

### ✅ Tipos de Transacciones
- **PURCHASE** - Compra (aumenta deuda)
- **PAYMENT** - Pago (reduce deuda)
- **ADJUSTMENT** - Ajuste (aumenta o reduce)
- **CREDIT_NOTE** - Nota de Crédito (reduce deuda)
- **DEBIT_NOTE** - Nota de Débito (aumenta deuda)

### ✅ Funcionalidades
- ✅ Ver todas las transacciones de un proveedor
- ✅ Ver transacciones sin asignar a empresa
- ✅ Ver resumen de deudas por empresa
- ✅ Crear nuevas transacciones
- ✅ Editar transacciones existentes
- ✅ Eliminar transacciones
- ✅ Asignar transacciones a empresas
- ✅ Adjuntar archivos (facturas, vouchers, fotos)
- ✅ Registrar información bancaria
- ✅ Tomar fotos desde la cámara
- ✅ Seleccionar imágenes de la galería
- ✅ Adjuntar documentos PDF

## 📁 Estructura de Archivos

```
src/
├── screens/Suppliers/
│   ├── SupplierDebtsScreen.tsx          # Pantalla principal de deudas
│   └── SupplierDetailScreen.tsx         # Actualizado con botón a deudas
├── components/Suppliers/
│   ├── DebtTransactionCard.tsx          # Card para mostrar transacciones
│   ├── DebtSummaryCard.tsx              # Card de resumen de deudas
│   ├── DebtTransactionFormModal.tsx     # Modal para crear/editar transacciones
│   ├── AssignCompanyModal.tsx           # Modal para asignar a empresa
│   └── index.ts                         # Exportaciones
├── types/
│   └── suppliers.ts                     # Tipos actualizados
├── services/api/
│   └── suppliers.ts                     # Servicios API actualizados
└── constants/
    └── routes.ts                        # Rutas actualizadas
```

## 🚀 Navegación

### Desde Detalle de Proveedor
1. Ir a **Proveedores**
2. Seleccionar un proveedor
3. Ir a la pestaña **"Deudas"**
4. Hacer clic en **"Ir a Gestión de Deudas"**

### Ruta Directa
```typescript
navigation.navigate('SupplierDebts', { supplierId: 'uuid-del-proveedor' });
```

## 💻 Uso del Módulo

### Crear una Transacción de Compra

```typescript
// 1. Subir archivo adjunto (opcional)
const file = await uploadFile(selectedFile);

// 2. Crear transacción
const transaction = await suppliersService.createTransaction(supplierId, {
  companyId: empresaId,                    // Opcional
  supplierLegalEntityId: razonSocialId,    // Opcional
  transactionType: TransactionType.PURCHASE,
  amountCents: 150000,                     // S/ 1,500.00
  referenceNumber: 'F001-00123',
  transactionDate: '2024-01-15',
  attachmentFileId: file?.path,
  notes: 'Compra de mercadería'
});
```

### Crear una Transacción de Pago

```typescript
const payment = await suppliersService.createTransaction(supplierId, {
  companyId: empresaId,
  transactionType: TransactionType.PAYMENT,
  amountCents: -100000,                    // Negativo reduce deuda
  referenceNumber: 'OP-987654321',
  transactionDate: '2024-01-20',
  bankName: 'BCP',
  bankAccountNumber: '19312345678',
  attachmentFileId: voucherFileId,
  notes: 'Pago parcial'
});
```

### Asignar Transacción a Empresa

```typescript
await suppliersService.assignTransactionToCompany(
  supplierId,
  transactionId,
  { companyId: empresaId }
);
```

## 📊 API Endpoints Utilizados

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/suppliers/:id/debts/transactions` | Listar transacciones |
| GET | `/api/suppliers/:id/debts/unassigned` | Transacciones sin asignar |
| GET | `/api/suppliers/:id/debts/summary` | Resumen de deudas |
| GET | `/api/suppliers/:id/debts/transactions/:txnId` | Obtener transacción |
| POST | `/api/suppliers/:id/debts/transactions` | Crear transacción |
| PATCH | `/api/suppliers/:id/debts/transactions/:txnId` | Actualizar transacción |
| DELETE | `/api/suppliers/:id/debts/transactions/:txnId` | Eliminar transacción |
| POST | `/api/suppliers/:id/debts/transactions/:txnId/assign-company` | Asignar a empresa |

## 🎨 Componentes UI

### SupplierDebtsScreen
Pantalla principal con 3 pestañas:
- **Todas**: Muestra todas las transacciones
- **Sin Asignar**: Transacciones sin empresa
- **Resumen**: Resumen de deudas por empresa

### DebtTransactionCard
Muestra información de una transacción:
- Tipo de transacción (badge con color)
- Monto (rojo para débito, verde para crédito)
- Fecha, referencia, empresa
- Información bancaria
- Archivo adjunto (con vista previa)
- Botones de editar/eliminar/asignar

### DebtTransactionFormModal
Formulario completo para crear/editar transacciones:
- Selector de tipo de transacción
- Campos de monto, fecha, referencia
- Selector de empresa (opcional)
- Selector de razón social del proveedor
- Campos de banco y cuenta (para pagos)
- Adjuntar archivos (foto, imagen, documento)
- Notas adicionales

### DebtSummaryCard
Resumen visual de deudas:
- Total deuda asignada
- Balance sin asignar
- Total general
- Desglose por empresa

### AssignCompanyModal
Modal para asignar transacción a empresa:
- Lista de empresas disponibles
- Información de la transacción
- Confirmación de asignación

## 📎 Gestión de Archivos

### Tipos de Archivos Soportados
- 📄 **Facturas**: PDF, imágenes
- 📸 **Fotos**: JPG, PNG, HEIC
- 📋 **Vouchers**: PDF, imágenes
- 📊 **Documentos**: PDF, Word, Excel

### Opciones de Adjuntar
1. **Tomar foto** - Usa la cámara del dispositivo
2. **Seleccionar imagen** - Galería de fotos
3. **Seleccionar archivo** - Documentos del dispositivo

### Almacenamiento
Los archivos se suben a: `supplier-debts/{supplierId}/{filename}`

## 🔐 Permisos Requeridos

| Acción | Permiso |
|--------|---------|
| Ver deudas | `suppliers.debts.read` |
| Crear transacciones | `suppliers.debts.create` |
| Editar transacciones | `suppliers.debts.update` |
| Eliminar transacciones | `suppliers.debts.delete` |
| Asignar a empresa | `suppliers.debts.assign` |

## 💡 Reglas de Negocio

### Signos de Montos
- **PURCHASE**: Monto positivo (aumenta deuda)
- **PAYMENT**: Monto negativo (reduce deuda)
- **CREDIT_NOTE**: Monto negativo (reduce deuda)
- **DEBIT_NOTE**: Monto positivo (aumenta deuda)
- **ADJUSTMENT**: Puede ser positivo o negativo

### Validaciones
- El monto debe ser mayor a 0
- Las notas de crédito/débito requieren número de referencia
- Los pagos deben especificar el banco
- La fecha de transacción es requerida

### Asignación de Empresas
- Las transacciones pueden crearse sin empresa
- Se pueden asignar a empresa posteriormente
- Una vez asignada, la deuda se mueve al balance de la empresa

## 🎯 Casos de Uso

### 1. Registrar Compra Manual
Usuario registra una compra que no viene del módulo de compras.

### 2. Registrar Pago con Voucher
Usuario registra un pago realizado y adjunta el voucher bancario.

### 3. Compra Sin Empresa Definida
Usuario registra una compra pero aún no sabe a qué empresa asignarla.

### 4. Nota de Crédito por Devolución
Usuario registra una devolución de mercadería defectuosa.

### 5. Ajuste por Error
Usuario corrige un error en el monto de una transacción anterior.

## 🐛 Solución de Problemas

### Error: "No se pudo cargar las empresas"
- Verificar que el usuario tenga permiso `companies.read`
- Verificar conexión con el backend

### Error: "No se pudo subir el archivo"
- Verificar permisos de cámara/galería
- Verificar tamaño del archivo (máximo 10MB recomendado)
- Verificar formato del archivo

### Error: "No se pudo crear la transacción"
- Verificar que todos los campos requeridos estén completos
- Verificar que el monto sea válido
- Verificar que el proveedor exista

## 📝 Notas Técnicas

- Los montos se manejan en **centavos** para evitar problemas de redondeo
- Las fechas usan formato **ISO 8601**
- Los archivos se suben antes de crear la transacción
- Las transacciones son **inmutables** (se recomienda usar ajustes en lugar de editar)

## 🔄 Próximas Mejoras Sugeridas

- [ ] Filtros avanzados por fecha, tipo, empresa
- [ ] Exportar reporte de deudas a Excel/PDF
- [ ] Gráficos de evolución de deuda
- [ ] Notificaciones de vencimientos
- [ ] Historial de cambios en transacciones
- [ ] Conciliación automática de pagos
- [ ] Integración con sistema contable

## 📞 Soporte

Para dudas o problemas con el módulo, contactar al equipo de desarrollo.

---

**Versión**: 1.0.0
**Última actualización**: Enero 2025
**Autor**: Sistema de Gestión Admin Frontend
