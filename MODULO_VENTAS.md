# 📊 Módulo de Ventas - Frontend

## 🎯 Descripción
Módulo completo de gestión de ventas B2C (clientes) y B2B (empresas) con buscadores inteligentes de clientes y productos, validación de stock en tiempo real y gestión de pagos.

## ✨ Características Implementadas

### 🔍 Buscadores Inteligentes
- **Búsqueda de Clientes/Empresas**: Modal con búsqueda en tiempo real por nombre, RUC o DNI
- **Búsqueda de Productos**: Modal con búsqueda por nombre, SKU o código de barras
- **Validación de Stock**: Verificación automática de disponibilidad al seleccionar productos
- **Debounce**: Optimización de búsquedas con delay de 300ms

### 💰 Gestión de Ventas
- **Tipos de Venta**: B2C (Clientes) y B2B (Empresas)
- **Selección de Almacén**: Dropdown con almacenes activos de la sede
- **Métodos de Pago**: Selección opcional de método de pago
- **Cálculo Automático**: Subtotales, descuentos y totales en tiempo real
- **Validación de Stock**: Prevención de overselling

### 📋 Listado de Ventas
- **Filtros Avanzados**:
  - Estado de venta (Borrador, Confirmada, Cancelada, Completada)
  - Estado de pago (Pendiente, Parcial, Pagado, Vencido)
  - Tipo de venta (B2C, B2B)
  - Búsqueda por código o cliente
- **Paginación**: Carga incremental de 20 ventas por página
- **Pull to Refresh**: Actualización manual de datos
- **Badges de Estado**: Indicadores visuales de estado

### 📄 Detalle de Venta
- **Información Completa**:
  - Datos del cliente/empresa
  - Lista de productos con cantidades y precios
  - Estado de procesamiento
  - Totales y descuentos
  - Historial de pagos
- **Acciones**:
  - Registrar pagos (próximamente)
  - Cancelar venta
  - Ver estado de procesamiento

## 📁 Estructura de Archivos

```
src/
├── types/
│   └── sales.ts                          # Tipos e interfaces de ventas
├── services/
│   └── api/
│       └── sales.ts                      # API service de ventas
├── components/
│   └── Sales/
│       ├── CustomerSearchModal.tsx       # Modal de búsqueda de clientes
│       ├── ProductSearchModal.tsx        # Modal de búsqueda de productos
│       └── index.ts                      # Exports
├── screens/
│   └── Sales/
│       ├── SalesScreen.tsx               # Listado de ventas
│       ├── CreateSaleScreen.tsx          # Crear nueva venta
│       ├── SaleDetailScreen.tsx          # Detalle de venta
│       └── index.ts                      # Exports
├── navigation/
│   └── index.tsx                         # Rutas de navegación
├── constants/
│   └── routes.ts                         # Constantes de rutas
└── types/
    └── navigation.ts                     # Tipos de navegación
```

## 🚀 Uso

### Navegación a Ventas
```typescript
import { MAIN_ROUTES } from '@/constants/routes';

// Ir al listado de ventas
navigation.navigate(MAIN_ROUTES.SALES);

// Crear nueva venta
navigation.navigate(MAIN_ROUTES.CREATE_SALE);

// Ver detalle de venta
navigation.navigate(MAIN_ROUTES.SALE_DETAIL, { saleId: 'uuid' });
```

### Crear una Venta
```typescript
import { salesApi } from '@/services/api/sales';
import { SaleType } from '@/types/sales';

const createSale = async () => {
  const sale = await salesApi.createSale({
    saleType: SaleType.B2C,
    customerId: 'uuid-del-cliente',
    siteId: 'uuid-de-la-sede',
    warehouseId: 'uuid-del-almacen',
    items: [
      {
        productId: 'uuid-del-producto',
        quantity: 10,
        unitPriceCents: 1500, // S/ 15.00
        discountCents: 0,
      }
    ],
    paymentMethodId: 'uuid-metodo-pago',
    notes: 'Notas opcionales',
  });
};
```

### Buscar Clientes
```typescript
import { CustomerSearchModal } from '@/components/Sales';

<CustomerSearchModal
  visible={showModal}
  onClose={() => setShowModal(false)}
  onSelectCustomer={(customer) => {
    console.log('Cliente seleccionado:', customer);
  }}
  customerType={CustomerType.PERSONA} // o CustomerType.EMPRESA
/>
```

### Buscar Productos
```typescript
import { ProductSearchModal } from '@/components/Sales';

<ProductSearchModal
  visible={showModal}
  onClose={() => setShowModal(false)}
  onSelectProduct={(product, stock) => {
    console.log('Producto seleccionado:', product);
    console.log('Stock disponible:', stock);
  }}
  warehouseId="uuid-del-almacen"
  excludeProductIds={['uuid1', 'uuid2']} // Productos ya agregados
/>
```

## 🔒 Permisos Requeridos

### Permisos del Módulo
- `sales.read` - Ver ventas
- `sales.create` - Crear ventas
- `sales.update` - Actualizar ventas
- `sales.delete` - Eliminar ventas
- `sales.confirm` - Confirmar ventas
- `sales.cancel` - Cancelar ventas
- `sales.payment.register` - Registrar pagos
- `sales.payment.confirm` - Confirmar pagos

### Permisos Relacionados
- `customers.read` - Buscar clientes
- `products.read` - Buscar productos
- `inventory.read` - Verificar stock

## 🎨 Componentes Principales

### SalesScreen
Pantalla principal con listado de ventas, filtros y búsqueda.

**Props**: Ninguna

**Características**:
- Filtros por estado, tipo y pago
- Búsqueda por código o cliente
- Paginación infinita
- Pull to refresh
- FAB para crear nueva venta

### CreateSaleScreen
Formulario para crear una nueva venta.

**Props**: Ninguna

**Características**:
- Selección de tipo de venta (B2C/B2B)
- Búsqueda inteligente de clientes
- Búsqueda inteligente de productos
- Validación de stock en tiempo real
- Cálculo automático de totales
- Selección de almacén y método de pago

### SaleDetailScreen
Detalle completo de una venta.

**Props**:
- `saleId: string` - ID de la venta

**Características**:
- Información del cliente
- Lista de productos
- Estado de procesamiento
- Totales y descuentos
- Historial de pagos
- Acciones (cancelar, registrar pago)

### CustomerSearchModal
Modal de búsqueda de clientes/empresas.

**Props**:
- `visible: boolean` - Visibilidad del modal
- `onClose: () => void` - Callback al cerrar
- `onSelectCustomer: (customer: Customer) => void` - Callback al seleccionar
- `customerType?: CustomerType` - Filtro por tipo (opcional)

### ProductSearchModal
Modal de búsqueda de productos con stock.

**Props**:
- `visible: boolean` - Visibilidad del modal
- `onClose: () => void` - Callback al cerrar
- `onSelectProduct: (product: Product, stock: StockItemResponse[]) => void` - Callback al seleccionar
- `warehouseId?: string` - ID del almacén para verificar stock
- `excludeProductIds?: string[]` - IDs de productos a excluir

## 📊 Tipos de Datos

### Sale
```typescript
interface Sale {
  id: string;
  code: string;
  saleType: SaleType; // B2C | B2B
  status: SaleStatus; // DRAFT | CONFIRMED | CANCELLED | COMPLETED
  processingStatus: ProcessingStatus; // PENDING | PROCESSING | COMPLETED | FAILED
  customerId?: string;
  companyId?: string;
  siteId: string;
  warehouseId: string;
  saleDate: string;
  itemCount: number;
  totalQuantity: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  paymentStatus: PaymentStatus; // PENDING | PARTIAL | PAID | OVERDUE
  paidAmountCents: number;
  balanceCents: number;
  items?: SaleItem[];
  documents?: SaleDocument[];
  payments?: SalePayment[];
  // ... más campos
}
```

### SaleItem
```typescript
interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  productSnapshot: {
    id: string;
    sku: string;
    title: string;
    description: string;
    barcode: string;
    imageUrl?: string;
  };
}
```

## 🎯 Flujo de Creación de Venta

```
1. Usuario selecciona tipo de venta (B2C/B2B)
   ↓
2. Busca y selecciona cliente/empresa
   ↓
3. Selecciona almacén
   ↓
4. Busca y agrega productos
   ↓
5. Sistema valida stock disponible
   ↓
6. Usuario ajusta cantidades, precios y descuentos
   ↓
7. Sistema calcula totales automáticamente
   ↓
8. Usuario selecciona método de pago (opcional)
   ↓
9. Usuario agrega notas (opcional)
   ↓
10. Usuario confirma y crea la venta
    ↓
11. Sistema crea venta y reserva stock
    ↓
12. Procesamiento en segundo plano:
    - Actualización de stock
    - Generación de documentos
    - Envío a SUNAT
    - Actualización de métricas
```

## 🔄 Estados de Venta

### SaleStatus
- **DRAFT**: Borrador (no confirmada)
- **CONFIRMED**: Confirmada (stock reservado)
- **CANCELLED**: Cancelada
- **COMPLETED**: Completada (procesamiento finalizado)

### ProcessingStatus
- **PENDING**: Pendiente de procesamiento
- **PROCESSING**: En procesamiento
- **COMPLETED**: Procesamiento completado
- **FAILED**: Procesamiento fallido

### PaymentStatus
- **PENDING**: Sin pagos
- **PARTIAL**: Pago parcial
- **PAID**: Pagado completamente
- **OVERDUE**: Pago vencido

## 🎨 Estilos y Diseño

### Colores por Estado
- **Confirmada**: Verde (#10B981)
- **Completada**: Azul (#3B82F6)
- **Cancelada**: Rojo (#EF4444)
- **Borrador**: Amarillo (#F59E0B)

### Colores por Estado de Pago
- **Pagado**: Verde (#10B981)
- **Parcial**: Amarillo (#F59E0B)
- **Pendiente**: Gris (#6B7280)
- **Vencido**: Rojo (#EF4444)

## 🚧 Próximas Funcionalidades

- [ ] Pantalla de registro de pagos
- [ ] Generación de documentos tributarios (PDF)
- [ ] Envío de documentos a SUNAT
- [ ] Dashboard de métricas de ventas
- [ ] Exportación de reportes
- [ ] Ventas masivas (batch)
- [ ] Notificaciones por email/WhatsApp
- [ ] Integración con sistema de facturación electrónica

## 📝 Notas Importantes

1. **Stock en Tiempo Real**: El sistema valida el stock disponible al momento de agregar productos
2. **Precios en Centavos**: Todos los montos se manejan en centavos para evitar problemas de redondeo
3. **Snapshots**: Se guardan copias de los datos del cliente y productos para mantener histórico
4. **Procesamiento Asíncrono**: La actualización de stock y generación de documentos se hace en segundo plano
5. **Multi-tenancy**: El sistema respeta la sede y empresa seleccionada

## 🐛 Troubleshooting

### Error: "Stock insuficiente"
- Verificar que el producto tenga stock en el almacén seleccionado
- Revisar que no haya reservas activas del producto

### Error: "No se pudieron cargar los almacenes"
- Verificar que la sede tenga almacenes configurados
- Verificar permisos de acceso a almacenes

### Error: "No se encontraron clientes"
- Verificar que existan clientes registrados
- Verificar filtros de búsqueda
- Verificar permisos de acceso a clientes

## 📞 Soporte

Para reportar bugs o solicitar nuevas funcionalidades, contactar al equipo de desarrollo.

---

**Versión**: 1.0.0
**Última actualización**: 2024
**Desarrollado por**: Equipo de Desarrollo
