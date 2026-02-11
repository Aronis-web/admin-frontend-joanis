# 📄 Módulo de Comprobantes Electrónicos - Bizlinks V2.0

## ✅ Implementación Completada

Se ha rediseñado completamente el módulo de comprobantes electrónicos siguiendo el patrón de diseño de los demás módulos del sistema (Gastos, Proveedores, Compras).

### 🆕 Actualización: Menú Flotante Animado y Selección de Series

**Fecha:** 2024
**Versión:** 2.1

Se ha implementado un sistema completo de selección de tipo de comprobante y serie antes de emitir, integrándose con el módulo de configuración de series y correlativos.

---

## 🎨 Características Implementadas

### 1. **Cabecera Moderna**
- ✅ Título principal: "Comprobantes Electrónicos"
- ✅ Subtítulo descriptivo: "Gestión de facturación electrónica SUNAT"
- ✅ Diseño consistente con otros módulos
- ✅ Soporte para tablets con estilos responsivos

### 2. **Barra de Búsqueda**
- ✅ Búsqueda por serie-número del comprobante
- ✅ Debounce de 500ms para optimizar consultas
- ✅ Botón de limpiar búsqueda
- ✅ Icono de búsqueda integrado

### 3. **Filtros por Tipo de Comprobante**
Filtros con colores distintivos:
- 🔵 **Factura (01)** - Azul (#3B82F6)
- 🟢 **Boleta (03)** - Verde (#10B981)
- 🟡 **Nota de Crédito (07)** - Amarillo (#F59E0B)
- 🔴 **Nota de Débito (08)** - Rojo (#EF4444)
- 🟣 **Guía de Remisión (09)** - Púrpura (#8B5CF6)
- 🔵 **G.R. Transportista (31)** - Índigo (#6366F1)
- 🌸 **Retención (20)** - Rosa (#EC4899)
- 🔷 **Percepción (40)** - Teal (#14B8A6)

### 4. **Filtros por Estado SUNAT**
Estados con colores semánticos:
- ⚪ **Pendiente Envío** - Gris (#94A3B8)
- 🟡 **Pendiente Respuesta** - Amarillo (#F59E0B)
- 🟢 **Aceptado** - Verde (#10B981)
- 🔴 **Rechazado** - Rojo (#EF4444)
- ⚫ **Anulado** - Gris oscuro (#64748B)

### 5. **Filtros de Fecha**
- ✅ Panel desplegable/colapsable
- ✅ Selector de fecha inicial
- ✅ Selector de fecha final
- ✅ DatePicker nativo integrado
- ✅ Indicador visual de filtros activos
- ✅ Botón para limpiar filtros de fecha
- ✅ Mensaje informativo del rango seleccionado

### 6. **Tarjetas de Documentos Rediseñadas**

#### Header de la Tarjeta:
- Badge con tipo de comprobante (color distintivo)
- Serie-Número en grande y bold
- Badge de estado SUNAT (color semántico)

#### Cuerpo de la Tarjeta:
- **Cliente:** Razón social del adquiriente
- **RUC/DNI:** Número de documento
- **Total:** Monto en verde destacado
- **Fecha:** Fecha de emisión formateada

#### Footer con Acciones:
- 🔄 **Botón Actualizar Estado** (Azul)
  - Consulta el estado actual en SUNAT
  - Muestra loading mientras procesa
  - Alert con resultado de la consulta

- 📄 **Botón Descargar PDF** (Rojo)
  - Descarga el PDF desde Bizlinks
  - En web: abre en nueva pestaña
  - En móvil: descarga y permite compartir
  - Muestra loading mientras descarga

- 📝 **Botón Descargar XML** (Amarillo)
  - Descarga el XML firmado
  - Abre el archivo descargado

### 7. **Paginación**
- ✅ Navegación anterior/siguiente
- ✅ Indicador de página actual / total de páginas
- ✅ Contador de documentos mostrados / total
- ✅ Botones deshabilitados en límites
- ✅ Diseño consistente con otros módulos

### 8. **Menú Flotante Animado (FAB)**
- ✅ Botón principal "+" con rotación 45° al abrir
- ✅ 5 opciones de comprobantes con animación stagger:
  - 📄 **Factura Electrónica** (Azul #3B82F6)
  - 🧾 **Boleta de Venta** (Verde #10B981)
  - 📝 **Nota de Crédito** (Amarillo #F59E0B)
  - 📋 **Nota de Débito** (Rojo #EF4444)
  - 🚚 **Guía de Remisión** (Púrpura #8B5CF6)
- ✅ Overlay semi-transparente al abrir
- ✅ Animaciones suaves con spring physics
- ✅ Labels descriptivos para cada opción
- ✅ Componente BizlinksDocumentsFAB reutilizable

### 9. **Selección de Serie Inteligente**
- ✅ Pantalla intermedia antes de emitir comprobante
- ✅ Lista de series disponibles filtradas por tipo
- ✅ Validación de números disponibles
- ✅ Información detallada de cada serie:
  - Número actual
  - Números disponibles
  - Número máximo
- ✅ Badge de advertencia cuando quedan < 100 números
- ✅ Navegación a configuración si no hay series
- ✅ Integración con sistema de correlativos
- ✅ **Serie pre-asignada en formulario:** Una vez seleccionada, la serie se muestra como badge y NO se puede cambiar en el formulario

### 9. **Estados de Carga**
- ✅ Loading inicial con spinner y mensaje
- ✅ Pull-to-refresh en la lista
- ✅ Loading individual por documento al actualizar
- ✅ Loading individual al descargar archivos
- ✅ Mensaje de lista vacía con emoji y texto descriptivo

### 10. **Funcionalidades Avanzadas**
- ✅ Auto-reload cuando la pantalla obtiene foco (useFocusEffect)
- ✅ Recarga automática al cambiar filtros
- ✅ Debounce en búsqueda para optimizar
- ✅ Manejo de errores con Alerts
- ✅ Soporte completo para tablets
- ✅ Diseño responsivo

---

## 📱 Estructura del Código

### Archivo Principal
```
src/screens/Bizlinks/BizlinksDocumentsScreen.tsx
```

### Componentes Utilizados
- `SafeAreaView` - Área segura para dispositivos
- `StatusFilter` - Filtros de estado reutilizables
- `SearchBar` - Barra de búsqueda reutilizable
- `DatePicker` - Selector de fechas
- `DatePickerButton` - Botón para abrir DatePicker
- `AddButton` - Botón flotante de crear
- `Ionicons` - Iconos de Expo

### Hooks Utilizados
- `useBizlinksDocuments` - Hook personalizado para documentos
- `useAuthStore` - Store de autenticación (empresa, sede)
- `useDebounce` - Debounce para búsqueda
- `useFocusEffect` - Auto-reload al enfocar pantalla
- `useWindowDimensions` - Detección de tablets

---

## 🎯 Flujo de Usuario

### Flujo de Visualización

1. **Entrada a la Pantalla**
   - Se cargan automáticamente los documentos
   - Se muestran todos los tipos y estados por defecto

2. **Filtrado**
   - Usuario puede filtrar por tipo de comprobante
   - Usuario puede filtrar por estado SUNAT
   - Usuario puede buscar por serie-número
   - Usuario puede filtrar por rango de fechas

3. **Visualización**
   - Tarjetas con información clara y colores distintivos
   - Badges visuales para tipo y estado
   - Información clave visible sin entrar al detalle

4. **Acciones Rápidas**
   - Actualizar estado desde la lista
   - Descargar PDF directamente
   - Descargar XML directamente

5. **Navegación**
   - Click en tarjeta → Ver detalle completo
   - Botón flotante → Crear nuevo comprobante
   - Paginación → Navegar entre páginas

### Flujo de Emisión de Comprobantes

1. **Selección de Tipo de Comprobante**
   - Usuario hace clic en el botón flotante (+)
   - Se despliega menú animado con 5 opciones
   - Usuario selecciona el tipo de comprobante a emitir

2. **Selección de Serie**
   - Sistema muestra pantalla de selección de series
   - Filtra automáticamente por tipo de documento
   - Muestra solo series activas con números disponibles
   - Usuario selecciona la serie deseada
   - Sistema calcula automáticamente el siguiente número correlativo

3. **Formulario de Emisión**
   - Sistema navega al formulario correspondiente
   - **Serie pre-asignada:** Se muestra en un badge destacado (no editable)
   - **Tipo de documento:** Se pasa automáticamente desde la selección
   - Usuario completa datos del cliente e items
   - Sistema calcula totales automáticamente

4. **Emisión y Confirmación**
   - Usuario envía el formulario
   - **Sistema usa el endpoint correcto** según el tipo de documento
   - Sistema emite el comprobante a SUNAT
   - Navega al detalle del documento creado

---

## 🎨 Paleta de Colores

### Tipos de Documento
```typescript
const DOCUMENT_TYPE_COLORS = {
  '01': '#3B82F6', // Factura - Azul
  '03': '#10B981', // Boleta - Verde
  '07': '#F59E0B', // NC - Amarillo
  '08': '#EF4444', // ND - Rojo
  '09': '#8B5CF6', // GR - Púrpura
  '31': '#6366F1', // GRT - Índigo
  '20': '#EC4899', // Retención - Rosa
  '40': '#14B8A6', // Percepción - Teal
};
```

### Estados SUNAT
```typescript
const STATUS_SUNAT_COLORS = {
  PENDIENTE_ENVIO: '#94A3B8',      // Gris
  PENDIENTE_RESPUESTA: '#F59E0B',  // Amarillo
  ACEPTADO: '#10B981',             // Verde
  RECHAZADO: '#EF4444',            // Rojo
  ANULADO: '#64748B',              // Gris oscuro
};
```

---

## 📊 Integración con Backend

### Endpoint Principal
```
GET /api/v1/bizlinks/documents
```

### Parámetros de Consulta
```typescript
interface GetBizlinksDocumentsParams {
  page?: number;              // Página actual
  limit?: number;             // Documentos por página (20)
  companyId?: string;         // ID de la empresa
  siteId?: string;            // ID de la sede
  documentType?: string;      // Tipo de comprobante (01, 03, etc.)
  statusSunat?: string;       // Estado SUNAT
  serieNumero?: string;       // Búsqueda por serie-número
  startDate?: string;         // Fecha inicial (YYYY-MM-DD)
  endDate?: string;           // Fecha final (YYYY-MM-DD)
}
```

### Acciones Disponibles
- `refreshDocumentStatus(id)` - Actualizar estado desde SUNAT
- `downloadArtifacts(id, options)` - Descargar PDF/XML/CDR
- `getDocuments(params)` - Listar documentos con filtros

---

## 🚀 Mejoras Implementadas vs Versión Anterior

| Característica | Antes | Ahora |
|---------------|-------|-------|
| Diseño | Básico | Moderno y profesional |
| Filtros | Solo tipo | Tipo + Estado + Fecha |
| Búsqueda | ❌ | ✅ Con debounce |
| Paginación | ❌ | ✅ Completa |
| Colores | Genéricos | Distintivos por tipo |
| Acciones | Limitadas | Actualizar + PDF + XML |
| Responsive | Básico | Completo (tablet) |
| Loading States | Básico | Detallado por acción |
| Auto-reload | ❌ | ✅ Al enfocar |
| Filtros de Fecha | ❌ | ✅ Con DatePicker |

---

## 📝 Notas Técnicas

### Optimizaciones
- Debounce de 500ms en búsqueda para reducir llamadas al backend
- useFocusEffect para recargar solo cuando es necesario
- useCallback para evitar re-renders innecesarios
- useMemo para cálculos de opciones de filtros
- Animaciones con useNativeDriver para mejor performance

### Integración con Sistema de Correlativos
- **Validación de Series:** Solo muestra series activas con números disponibles
- **Cálculo Automático:** `disponibles = maxNumber - currentNumber`
- **Filtrado por Tipo:** Usa `documentType.code` para filtrar series
- **Advertencias:** Alerta cuando quedan menos de 100 números
- **Navegación Inteligente:** Redirige a configuración si no hay series
- **Serie Pre-asignada:** Una vez seleccionada, se construye el formato completo `SERIE-NUMERO`
  - Ejemplo: `BP01-00000124` (serie + número siguiente formateado a 8 dígitos)
  - Cálculo: `nextNumber = currentNumber + 1`
  - Formato: `${series}-${nextNumber.toString().padStart(8, '0')}`
- **Correlativo Automático:** El `seriesId` se usa como `correlativeId` en el DTO de emisión

### Endpoints por Tipo de Documento
El sistema ahora usa el endpoint correcto según el tipo de documento seleccionado:
- **Factura (01):** `POST /bizlinks/documents/factura`
- **Boleta (03):** `POST /bizlinks/documents/boleta`
- **Nota de Crédito (07):** `POST /bizlinks/documents/nota-credito`
- **Nota de Débito (08):** `POST /bizlinks/documents/nota-debito`
- **Guía de Remisión (09):** `POST /bizlinks/documents/guia-remision`

El tipo de documento se pasa desde `BizlinksSelectSeriesScreen` → `BizlinksEmitirFacturaScreen` → `EmitirFacturaForm`, y el hook `useBizlinksDocuments` usa el método `emitirComprobante` que selecciona el endpoint correcto automáticamente.

### Compatibilidad
- ✅ iOS
- ✅ Android
- ✅ Web (Electron)
- ✅ Tablets

### Dependencias
- `@react-navigation/native` - Navegación
- `expo-file-system` - Descarga de archivos
- `expo-sharing` - Compartir archivos en móvil
- `@expo/vector-icons` - Iconos
- `react-native-safe-area-context` - SafeAreaView
- `react-native` Animated API - Animaciones del FAB

---

## 🎓 Guía de Uso para Desarrolladores

### Agregar Nuevo Tipo de Comprobante
1. Agregar en `DOCUMENT_TYPE_LABELS`
2. Agregar color en `DOCUMENT_TYPE_COLORS`
3. Agregar opción en `documentTypeOptions`

### Agregar Nuevo Estado
1. Agregar en `STATUS_SUNAT_COLORS`
2. Agregar opción en `statusOptions`

### Modificar Diseño de Tarjeta
Editar la función `renderDocumentCard` en el archivo principal.

---

## ✨ Resultado Final

El módulo ahora tiene:
- ✅ Diseño profesional y moderno
- ✅ Experiencia de usuario fluida
- ✅ Filtros potentes y flexibles
- ✅ Acciones rápidas y eficientes
- ✅ Información clara y visual
- ✅ Compatibilidad multiplataforma
- ✅ Código limpio y mantenible

---

## 📸 Características Visuales

### Cabecera
```
┌─────────────────────────────────────┐
│ Comprobantes Electrónicos           │
│ Gestión de facturación electrónica  │
└─────────────────────────────────────┘
```

### Filtros
```
┌─────────────────────────────────────┐
│ 🔍 Buscar por serie-número...       │
├─────────────────────────────────────┤
│ [Todos] [Facturas] [Boletas] [NC]  │
├─────────────────────────────────────┤
│ [Todos] [Pendiente] [Aceptado]     │
├─────────────────────────────────────┤
│ 📅 Filtrar por Fecha ▼              │
└─────────────────────────────────────┘
```

### Tarjeta de Documento
```
┌─────────────────────────────────────┐
│ [FACTURA] F001-00000123  [ACEPTADO] │
│                                     │
│ Cliente: EMPRESA SAC                │
│ RUC/DNI: 20123456789               │
│ Total: S/ 1,770.00                 │
│ Fecha: 11/02/2024                  │
│                                     │
│ [🔄] [📄 PDF] [📝 XML]        ›    │
└─────────────────────────────────────┘
```

### Formulario de Emisión (Serie Pre-asignada)
```
┌─────────────────────────────────────┐
│ Datos Generales                     │
│                                     │
│ Serie Seleccionada                  │
│ ┌─────────────────────────────────┐ │
│ │       BP01-00000124             │ │
│ └─────────────────────────────────┘ │
│ ✓ Serie asignada automáticamente    │
│                                     │
│ Fecha de Emisión *                  │
│ [2024-02-11]                        │
└─────────────────────────────────────┘
```

**Nota:** El formato `BP01-00000124` se construye automáticamente:
- `BP01` = Serie seleccionada
- `00000124` = Siguiente número correlativo (currentNumber + 1, formateado a 8 dígitos)

---

## 🎉 Conclusión

El módulo de comprobantes electrónicos ha sido completamente rediseñado siguiendo las mejores prácticas y el patrón de diseño establecido en el proyecto. Ahora ofrece una experiencia de usuario superior con todas las funcionalidades necesarias para gestionar eficientemente la facturación electrónica SUNAT.
