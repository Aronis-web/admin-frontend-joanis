# Módulo de Cuentas por Pagar

## 📋 Descripción

Módulo completo para la gestión y visualización de cuentas por pagar con búsqueda inteligente, filtros avanzados y optimización para grandes volúmenes de datos (cientos de miles de registros).

## 🎯 Características Principales

### ✅ Búsqueda Inteligente
- Búsqueda en tiempo real con debounce (500ms)
- Búsqueda por múltiples campos:
  - Código de cuenta por pagar
  - Nombre del proveedor
  - RUC/Tax ID
  - Número de documento
  - Descripción
  - Código de origen

### 🔍 Filtros Avanzados
- **Estado**: DRAFT, PENDING_APPROVAL, APPROVED, PENDING, PARTIAL, PAID, OVERDUE, CANCELLED, DISPUTED
- **Moneda**: PEN (Soles), USD (Dólares)
- **Tipo de Proveedor**: MERCHANDISE, SERVICES, UTILITIES, TRANSPORT, MAINTENANCE, etc.
- **Vencimiento**: Solo vencidas (overdue)
- **Ordenamiento**: Por fecha de vencimiento, monto, saldo pendiente, días de atraso, etc.

### 📊 Resumen Automático
- Total de cuentas por pagar
- Monto total pendiente
- Monto total pagado
- Resumen por moneda
- Resumen por estado

### 📱 Optimizado para Móvil
- Diseño responsive adaptado para celulares y tablets
- Paginación eficiente (20 registros por página)
- Carga lazy de datos
- Scroll infinito optimizado
- Indicadores de carga y estados

### 🎨 Interfaz de Usuario
- Cards visuales con información clara
- Badges de estado con colores distintivos
- Indicadores de vencimiento y días de atraso
- Barra de progreso de pagos
- Modal de filtros avanzados
- Filtros rápidos en la parte superior

## 📁 Estructura de Archivos

```
src/screens/AccountsPayable/
├── AccountsPayableScreen.tsx       # Pantalla principal con listado y filtros
├── AccountPayableDetailScreen.tsx  # Pantalla de detalle de una cuenta
├── index.ts                        # Exportaciones del módulo
├── README.md                       # Esta documentación
└── PERMISSIONS.md                  # Documentación completa de permisos

src/services/api/
└── accounts-payable.ts             # Servicio API para cuentas por pagar

src/types/
└── accounts-payable.ts             # Tipos TypeScript

src/constants/
├── accountsPayable.ts              # Constantes (estados, iconos, colores)
└── permissions.ts                  # Constantes de permisos del sistema
```

## 🚀 Uso

### Navegación a la Pantalla Principal

```typescript
navigation.navigate('AccountsPayable');
```

### Navegación al Detalle

```typescript
navigation.navigate('AccountPayableDetail', {
  accountPayableId: 'uuid-de-la-cuenta'
});
```

## 🔌 API Endpoints

### Listado con Filtros
```typescript
GET /api/v1/accounts-payable
```

**Parámetros de Query:**
- `page`: Número de página (default: 1)
- `limit`: Registros por página (default: 20)
- `search`: Búsqueda por texto
- `statuses`: Estados separados por coma (ej: "PENDING,OVERDUE")
- `currencies`: Monedas separadas por coma (ej: "PEN,USD")
- `supplierPrimaryType`: Tipo de proveedor
- `overdue`: Solo vencidas (true/false)
- `sortBy`: Campo de ordenamiento
- `sortOrder`: ASC o DESC

### Búsqueda Inteligente
```typescript
GET /api/v1/accounts-payable/search/intelligent
```

Incluye automáticamente:
- Datos completos del proveedor
- Historial de pagos
- Historial de estados
- Cronograma de pagos
- Resumen por moneda y estado

### Detalle de Cuenta
```typescript
GET /api/v1/accounts-payable/:id
```

## 📊 Tipos de Datos

### AccountPayable
```typescript
interface AccountPayable {
  id: string;
  code: string;
  sourceType: AccountPayableSourceType;
  supplierId: string;
  supplierName: string;
  currency: string;
  totalAmountCents: number;
  paidAmountCents: number;
  remainingAmountCents: number;
  issueDate: string;
  dueDate: string;
  status: AccountPayableStatus;
  paymentPercentage: number;
  overdueDays: number;
  // ... más campos
}
```

### Estados Disponibles
```typescript
enum AccountPayableStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
}
```

## 🎨 Componentes Visuales

### Card de Cuenta por Pagar
- **Header**: Código, estado y moneda
- **Proveedor**: Nombre comercial y RUC
- **Montos**: Total, pagado y pendiente
- **Fechas**: Emisión y vencimiento
- **Metadata**: Tipo de documento y origen
- **Progreso**: Barra de progreso de pago

### Modal de Filtros
- Filtros por estado (múltiple selección)
- Filtros por moneda
- Filtros por tipo de proveedor
- Toggle para solo vencidas
- Opciones de ordenamiento
- Botones de limpiar y aplicar

### Pantalla de Detalle
- Información completa de la cuenta
- Datos del proveedor
- Montos detallados
- Fechas importantes
- Información del documento
- Historial de pagos
- Cronograma de pagos
- Historial de cambios de estado

## 🔒 Permisos Requeridos

### Permisos Básicos
- `accounts-payable.read`: Ver cuentas por pagar
- `accounts-payable.read-own-company`: Ver solo cuentas de su empresa
- `accounts-payable.read-all`: Ver todas las cuentas de todas las empresas
- `accounts-payable.read-details`: Ver detalles completos (pagos, historial)

### Permisos de Búsqueda
- `accounts-payable.search`: Buscar cuentas por pagar
- `accounts-payable.search-intelligent`: Usar búsqueda inteligente avanzada
- `accounts-payable.search-all-companies`: Buscar en todas las empresas

### Permisos de Reportes
- `accounts-payable.reports.summary`: Ver resumen general
- `accounts-payable.reports.export`: Exportar reportes
- `accounts-payable.reports.download-excel`: Descargar en Excel
- `accounts-payable.reports.download-pdf`: Descargar en PDF

### Permisos de Pagos
- `accounts-payable.payments.read`: Ver pagos
- `accounts-payable.payments.create`: Registrar pagos
- `accounts-payable.payments.approve`: Aprobar pagos

### Permisos de Cronograma
- `accounts-payable.schedule.read`: Ver cronograma de pagos
- `accounts-payable.schedule.create`: Crear cronograma

### Permisos de Historial
- `accounts-payable.history.read`: Ver historial de cambios
- `accounts-payable.history.export`: Exportar historial

### Permisos de Documentos
- `accounts-payable.documents.read`: Ver documentos adjuntos
- `accounts-payable.documents.upload`: Subir documentos
- `accounts-payable.documents.download`: Descargar documentos

📖 **Para documentación completa de permisos, ver [PERMISSIONS.md](./PERMISSIONS.md)**

## ⚡ Optimizaciones de Performance

### Paginación
- Carga de 20 registros por página
- Navegación entre páginas eficiente
- Indicadores de página actual y total

### Debounce
- Búsqueda con debounce de 500ms
- Evita llamadas innecesarias al API
- Indicador visual de búsqueda en progreso

### Lazy Loading
- Carga diferida de pantallas
- Reducción del bundle inicial
- Mejor tiempo de carga inicial

### Caché
- Headers de cache-busting
- Refresh manual disponible
- Pull-to-refresh implementado

## 📱 Responsive Design

### Móvil (< 768px)
- Cards en columna única
- Filtros en modal deslizable
- Paginación fija en la parte inferior
- Texto optimizado para lectura

### Tablet (>= 768px)
- Cards más amplias
- Más información visible
- Fuentes más grandes
- Espaciado mejorado

## 🎯 Casos de Uso

### 1. Ver todas las cuentas pendientes
- Filtro rápido: "Pendientes"
- Ordenar por fecha de vencimiento ascendente

### 2. Buscar cuentas vencidas
- Filtro rápido: "Vencidas"
- Ordenar por días de atraso descendente

### 3. Buscar por proveedor
- Usar barra de búsqueda
- Escribir nombre o RUC del proveedor

### 4. Filtrar por moneda
- Filtro rápido: "S/ Soles" o "$ Dólares"

### 5. Búsqueda avanzada
- Abrir modal de filtros
- Combinar múltiples criterios
- Aplicar ordenamiento personalizado

## 🐛 Troubleshooting

### La búsqueda no encuentra resultados
- Verificar que no haya filtros contradictorios
- Limpiar todos los filtros y volver a intentar
- Verificar la conexión al backend

### La paginación no funciona
- Verificar que el total de registros sea mayor que el límite
- Revisar la consola para errores de API

### Los filtros no se aplican
- Verificar que se haya presionado "Aplicar" en el modal
- Revisar que los parámetros se envíen correctamente al API

## 📝 Notas Importantes

1. **Montos en Centavos**: Todos los montos se manejan en centavos (100 centavos = 1 sol)
2. **Fechas en ISO**: Las fechas se envían en formato ISO (YYYY-MM-DD)
3. **Solo Lectura**: Este módulo es solo para visualización, no permite edición
4. **Permisos**: Verificar que el usuario tenga los permisos necesarios

## 🔄 Actualizaciones Futuras

- [ ] Exportación a Excel/PDF
- [ ] Gráficos de resumen
- [ ] Notificaciones de vencimiento
- [ ] Filtros guardados
- [ ] Vista de calendario
- [ ] Integración con pagos

## 👥 Soporte

Para reportar problemas o sugerencias, contactar al equipo de desarrollo.

---

**Versión**: 1.0.0
**Última actualización**: 2024-01-31
**Autor**: Sistema de Gestión Administrativa
