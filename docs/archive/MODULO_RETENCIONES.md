# 📋 Módulo de Retenciones Electrónicas - Frontend

## ✅ Implementación Completada

Se ha creado exitosamente el módulo de Retenciones Electrónicas en el frontend de la aplicación.

## 📑 Índice

1. [Guía Rápida de Inicio](#-guía-rápida-de-inicio)
2. [Archivos Creados](#-archivos-creados)
3. [Funcionalidades](#-funcionalidades)
4. [Flujo de Uso](#-flujo-de-uso)
5. [Configuración de Series](#-configuración-de-series-para-retenciones)
6. [Notas Importantes](#️-notas-importantes)
7. [Próximos Pasos](#-próximos-pasos-mejoras-opcionales)

## 📚 Documentación Adicional

- **[RETENCIONES_API_EXAMPLES.md](./RETENCIONES_API_EXAMPLES.md)** - Ejemplos completos de uso de la API
  - Configuración inicial
  - Crear tipo de documento y series
  - Emitir retenciones (ejemplos con código)
  - Consultar y filtrar retenciones
  - Descargar archivos (PDF, XML, CDR)
  - Manejo de errores comunes

---

## 🚀 Guía Rápida de Inicio

### Requisitos Previos

Antes de usar el módulo de retenciones, asegúrate de:

1. **Configurar el Tipo de Documento "Retención"**
   - Código SUNAT: `20`
   - Debe existir en el sistema (ver [Configuración de Series](#-configuración-de-series-para-retenciones))

2. **Crear una Serie para Retenciones**
   - Formato recomendado: `R001`
   - Desde: Menú → Configuración → Puntos de Emisión → Series

3. **Verificar Permisos**
   - `bizlinks.documents.view` - Ver retenciones
   - `bizlinks.documents.send` - Crear retenciones

### Acceso Rápido

```
Menú → Contaduría → Retenciones
```

### Crear tu Primera Retención en 7 Pasos

1. ✅ Tap en botón "+" (FAB) en la lista de retenciones
2. ✅ **Seleccionar serie** de la lista desplegable (ej: R001)
   - El número correlativo se generará automáticamente
3. ✅ Completar datos generales (fecha, régimen: Tasa 3%, moneda)
4. ✅ **Buscar proveedor** o ingresar datos manualmente
   - Opción A: Buscar proveedor existente (autocomplete)
   - Opción B: Ingresar datos manualmente
5. ✅ **Agregar documentos relacionados** (tap en "+" junto a "Documentos Relacionados")
   - Opción A: **Buscar factura existente** del sistema
   - Opción B: **Ingresar manualmente** número de factura
6. ✅ Revisar cálculo automático de retención (3% del pago)
7. ✅ Verificar totales calculados en tiempo real
8. ✅ Tap en "Emitir Retención" y confirmar

---

## 📁 Archivos Creados

### 1. Tipos y Definiciones
- **`src/types/bizlinks.ts`** (actualizado)
  - `ProveedorRetencionDto`: Datos del proveedor
  - `RetencionItemDto`: Items/documentos relacionados
  - `CreateRetencionDto`: DTO para crear retenciones
  - `Retencion`: Interface principal de retención
  - `GetRetencionesParams`: Parámetros de consulta

### 2. Servicios API
- **`src/services/api/bizlinks.ts`** (actualizado)
  - `getRetenciones()`: Listar retenciones
  - `getRetencionById()`: Obtener retención por ID
  - `createRetencion()`: Crear nueva retención
  - `refreshRetencionStatus()`: Actualizar estado
  - `downloadRetencionPDF()`: Descargar PDF
  - `downloadRetencionXML()`: Descargar XML
  - `downloadRetencionCDR()`: Descargar CDR

### 3. Pantallas
- **`src/screens/Retenciones/RetencionesScreen.tsx`**
  - Listado de retenciones con filtros
  - Búsqueda por RUC del proveedor
  - Filtros por estado
  - Navegación a detalle y creación

- **`src/screens/Retenciones/RetencionDetailScreen.tsx`**
  - Detalle completo de la retención
  - Información del proveedor
  - Documentos relacionados
  - Totales y cálculos
  - Descarga de archivos (PDF, XML, CDR)
  - Actualización de estado

- **`src/screens/Retenciones/CreateRetencionScreen.tsx`**
  - Formulario completo de creación de retenciones
  - Datos generales (serie, fecha, régimen, tasa)
  - Datos del proveedor (RUC, razón social, dirección)
  - Gestión de documentos relacionados (facturas)
  - Cálculo automático de retenciones
  - Totales en tiempo real
  - Validaciones completas

- **`src/screens/Retenciones/index.ts`**
  - Exportaciones del módulo

### 4. Navegación
- **`src/navigation/index.tsx`** (actualizado)
  - Lazy loading de pantallas de retenciones
  - Rutas protegidas con permisos

### 5. Rutas
- **`src/constants/routes.ts`** (actualizado)
  - `RETENCIONES`: Listado de retenciones
  - `CREATE_RETENCION`: Crear retención
  - `RETENCION_DETAIL`: Detalle de retención

### 6. Tipos de Navegación
- **`src/types/navigation.ts`** (actualizado)
  - Parámetros de navegación para retenciones

### 7. Menú de Navegación
- **`src/components/Navigation/DrawerMenu.tsx`** (actualizado)
  - Nueva categoría "Contaduría"
  - Submódulos:
    - Generación de Comprobantes
    - Retenciones

---

## 🎯 Características Implementadas

### ✅ Listado de Retenciones
- Visualización de todas las retenciones
- Filtros por estado (En Cola, Enviando, Enviado, Aceptado, Rechazado, Error)
- Búsqueda por RUC del proveedor
- Refresh manual
- Navegación a detalle
- FAB para crear nueva retención

### ✅ Detalle de Retención
- Información general (fecha, régimen, tasa)
- Datos del proveedor
- Totales (pagado, retenido, neto)
- Lista de documentos relacionados
- Estado SUNAT
- Mensajes de respuesta
- Descarga de archivos (PDF, XML, CDR)
- Actualización de estado

### ✅ Creación de Retención
- **Formulario completo y funcional**
- **Sección 1: Datos Generales**
  - **Selector de serie** (carga automáticamente las series configuradas)
  - Número correlativo generado automáticamente por el backend
  - Fecha de emisión (con DatePicker)
  - Régimen de retención (Catálogo 23: 3%, 6%, Otros)
  - Tasa de retención (automática o manual)
  - Moneda (PEN/USD)
- **Sección 2: Datos del Proveedor**
  - **Buscador de proveedores** con autocompletado
    - Búsqueda en tiempo real por nombre o RUC
    - Resultados con información completa (nombre, RUC, dirección)
    - Autocompletado de todos los campos al seleccionar
    - Opción de limpiar y buscar otro proveedor
  - Tipo de documento (RUC/DNI)
  - Número de documento
  - Razón social
  - Nombre comercial (opcional)
  - Dirección completa
  - Ubigeo, departamento, provincia, distrito
  - **Campos bloqueados** cuando se selecciona un proveedor existente
- **Sección 3: Documentos Relacionados**
  - Modal para agregar facturas/documentos con **dos modos de entrada**:
    - **Modo 1: Buscar Factura Existente** 🔍
      - Búsqueda en tiempo real de facturas del sistema
      - Búsqueda por código o número de factura
      - Resultados muestran: número de factura, cliente/empresa, total y fecha
      - Autocompletado de todos los campos al seleccionar
      - Campos bloqueados para evitar modificaciones accidentales
    - **Modo 2: Ingresar Manual** ✍️
      - Tipo de documento (Factura, Boleta, NC, ND)
      - Número de documento
      - Fecha de emisión
      - Importe total del documento
  - Campos comunes (ambos modos):
    - Fecha de pago
    - Importe del pago (editable siempre)
  - **Cálculo automático de retención** según tasa
  - Vista previa del cálculo (pago, retención, neto)
  - Lista de documentos agregados con totales
  - Opción para eliminar documentos
- **Sección 4: Totales**
  - Total pagado (suma de todos los pagos)
  - Total retenido (suma de todas las retenciones)
  - Total neto (pagado - retenido)
  - Actualización en tiempo real
- **Sección 5: Observaciones**
  - Campo de texto libre para notas adicionales
- **Validaciones**
  - Campos requeridos marcados con *
  - Validación de RUC (11 dígitos) y DNI (8 dígitos)
  - Validación de ubigeo (6 dígitos)
  - Al menos un documento relacionado
  - Importes mayores a 0
- **Confirmación y Envío**
  - Resumen antes de emitir
  - Indicador de carga durante el proceso
  - Opciones post-creación: Ver detalle o Crear otra
  - Navegación automática al detalle

---

## 🔐 Permisos Requeridos

```typescript
// Permisos necesarios
bizlinks.retenciones.read    // Ver retenciones
bizlinks.retenciones.create  // Crear retenciones
bizlinks.retenciones.update  // Actualizar retenciones
bizlinks.retenciones.delete  // Eliminar retenciones
bizlinks.retenciones.download // Descargar archivos
```

---

## 📊 Estructura de Datos

### Retencion
```typescript
interface Retencion {
  id: string;
  companyId: string;
  siteId: string;
  rucEmisor: string;
  documentType: '20';
  serie: string;
  numero: string;
  serieNumero: string;
  fechaEmision: string;
  proveedor: ProveedorRetencionDto;
  regimenRetencion: string;
  tasaRetencion: number;
  importeTotalRetenido: number;
  importeTotalPagado: number;
  tipoMoneda: 'PEN' | 'USD';
  items: RetencionItemDto[];
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'ERROR';
  statusWs?: BizlinksStatusWs;
  statusSunat?: BizlinksStatusSunat;
  messageSunat?: BizlinksSunatMessage;
  hashCode?: string;
  pdfUrl?: string;
  xmlSignUrl?: string;
  xmlSunatUrl?: string;
  observaciones?: string;
  createdAt: string;
  updatedAt: string;
}
```

### CreateRetencionDto
```typescript
interface CreateRetencionDto {
  serieNumero: string;
  fechaEmision: string;
  rucEmisor: string;
  razonSocialEmisor: string;
  nombreComercialEmisor?: string;
  ubigeoEmisor: string;
  direccionEmisor: string;
  provinciaEmisor: string;
  departamentoEmisor: string;
  distritoEmisor: string;
  codigoPaisEmisor: string;
  correoEmisor: string;
  correoAdquiriente?: string;
  proveedor: ProveedorRetencionDto;
  regimenRetencion: '01' | '02' | '03';
  tasaRetencion: number;
  observaciones?: string;
  importeTotalRetenido: number;
  tipoMonedaTotalRetenido: 'PEN' | 'USD';
  importeTotalPagado: number;
  tipoMonedaTotalPagado: 'PEN' | 'USD';
  items: RetencionItemDto[];
}
```

---

## 🚀 Endpoints API

### Listar Retenciones
```
GET /bizlinks/retenciones
Query Params:
  - companyId
  - siteId
  - status
  - statusWs
  - serie
  - fechaDesde
  - fechaHasta
  - numeroDocumentoProveedor
```

### Obtener Retención
```
GET /bizlinks/retenciones/:id
```

### Crear Retención
```
POST /bizlinks/retenciones
Body: CreateRetencionDto
```

### Actualizar Estado
```
POST /bizlinks/retenciones/:id/refresh
```

### Descargar Archivos
```
GET /bizlinks/retenciones/:id/pdf
GET /bizlinks/retenciones/:id/xml
GET /bizlinks/retenciones/:id/cdr
```

---

## 🎨 Navegación

### Menú Principal
```
Contaduría
├── Generación de Comprobantes (Bizlinks)
└── Retenciones
    ├── Listado de Retenciones
    ├── Detalle de Retención
    └── Crear Retención
```

### Rutas
- `/Retenciones` - Listado
- `/RetencionDetail/:id` - Detalle
- `/CreateRetencion` - Crear

---

## 📝 Catálogos SUNAT

### Régimen de Retención (Catálogo 23)
| Código | Descripción | Tasa |
|--------|-------------|------|
| 01     | Tasa 3%     | 3.00% |
| 02     | Tasa 6%     | 6.00% |
| 03     | Otros       | Variable |

### Tipo de Documento (Catálogo 01)
| Código | Descripción |
|--------|-------------|
| 01     | Factura |
| 03     | Boleta |
| 07     | Nota de Crédito |
| 08     | Nota de Débito |

---

## 🔄 Flujo de Uso

### 1. Acceder al Módulo
   - Menú → Contaduría → Retenciones

### 2. Ver Retenciones
   - Lista de todas las retenciones
   - Filtrar por estado
   - Buscar por RUC

### 3. Ver Detalle
   - Tap en una retención
   - Ver información completa
   - Descargar archivos (PDF, XML, CDR)

### 4. Crear Retención (Flujo Completo)

   **Paso 1: Acceder al formulario**
   - Tap en botón "+" (FAB) en la pantalla de listado
   - Se abre el formulario de creación

   **Paso 2: Ingresar datos generales**
   - **Serie**: Seleccionar de la lista (ej: R001)
     - El sistema carga automáticamente las series configuradas
     - Muestra la serie por defecto si existe
     - El número correlativo se genera automáticamente
   - Fecha de emisión: Seleccionar con DatePicker
   - Régimen: Seleccionar "Tasa 3%" (01)
   - Tasa se actualiza automáticamente a 3.00%
   - Moneda: Seleccionar PEN o USD

   **Paso 3: Buscar y seleccionar proveedor**
   - **Opción A: Buscar proveedor existente**
     - Escribir nombre o RUC en el buscador
     - Seleccionar de la lista de resultados
     - Todos los datos se completan automáticamente
   - **Opción B: Ingresar manualmente**
     - Tipo de documento: RUC (6)
     - RUC: `20100359707`
     - Razón social: `PROVEEDOR SAC`
     - Dirección: `CALLE LOS OLIVOS 456`
     - Ubigeo: `150122`
     - Departamento, Provincia, Distrito

   **Paso 4: Agregar documentos relacionados**
   - Tap en botón "+" junto a "Documentos Relacionados"
   - Se abre modal para agregar documento
   - Seleccionar tipo: Factura (01)
   - Número: `F001-00000050`
   - Fecha de emisión: Seleccionar fecha
   - Importe total: `1180.00`
   - Fecha de pago: Seleccionar fecha
   - Importe del pago: `1180.00`
   - **Ver cálculo automático:**
     - Importe Pago: PEN 1180.00
     - Retención (3%): PEN 35.40
     - Neto a Pagar: PEN 1144.60
   - Tap en "Agregar"
   - Repetir para más documentos si es necesario

   **Paso 5: Revisar totales**
   - Total Pagado: PEN 1180.00
   - Total Retenido: PEN 35.40
   - Total Neto: PEN 1144.60

   **Paso 6: Agregar observaciones (opcional)**
   - Ingresar notas adicionales

   **Paso 7: Emitir retención**
   - Tap en "Emitir Retención"
   - Revisar resumen en diálogo de confirmación
   - Confirmar emisión
   - Esperar procesamiento
   - Elegir: "Ver Detalle" o "Crear Otra"

### 5. Actualizar Estado
   - Botón de refresh en detalle
   - Sincroniza con SUNAT

---

## ⚠️ Notas Importantes

1. **Formulario de Creación**: ✅ El formulario completo está implementado y funcional. Permite crear retenciones manualmente ingresando todos los datos necesarios.

2. **Permisos**: Asegúrate de que los usuarios tengan los permisos correctos configurados en el backend (`bizlinks.documents.view`, `bizlinks.documents.send`).

3. **Series**: ⚠️ **IMPORTANTE** - Debe existir una serie configurada para retenciones (tipo 20) antes de poder emitir. Ver sección "Configuración de Series" más abajo.

4. **Validaciones**:
   - El formulario valida todos los campos requeridos antes de enviar
   - Calcula automáticamente la retención según la tasa seleccionada
   - El backend valida que los totales coincidan con la suma de items

5. **Datos del Emisor**: Los datos del emisor se toman automáticamente de la empresa actual seleccionada en el sistema.

6. **Generación de Números Correlativos**:
   - El formulario solo requiere seleccionar la **serie** (ej: R001)
   - El **número correlativo** se genera automáticamente en el backend
   - El backend incrementa el `currentNumber` de la serie seleccionada
   - Ejemplo: Si la serie R001 tiene `currentNumber: 5`, el próximo documento será `R001-00000006`
   - No es necesario ingresar manualmente el número completo

---

## 🔧 Configuración de Series para Retenciones

Antes de poder emitir retenciones electrónicas, es necesario configurar una serie para el tipo de documento "Retención" (código 20).

### Opción 1: Crear Serie desde la Interfaz (Recomendado)

1. **Navegar a Puntos de Emisión**
   - Menú → Configuración → Puntos de Emisión
   - Seleccionar el punto de emisión deseado
   - Ir a la pestaña "Series"

2. **Crear Nueva Serie**
   - Tap en botón "+" o "Nueva Serie"
   - Seleccionar tipo de documento: **"Retención" (código 20)**
   - Ingresar serie: `R001` (formato recomendado)
   - Descripción: "Serie para Retenciones Electrónicas"
   - Número inicial: `1`
   - Número máximo: `99999999`
   - Marcar como "Serie por defecto" ✓
   - Marcar como "Serie activa" ✓
   - Guardar

### Opción 2: Crear Serie mediante API

Si el tipo de documento "Retención" no existe en el sistema, primero debe crearse:

#### Paso 1: Verificar/Crear el Tipo de Documento "Retención"

```http
GET /billing/document-types
```

Buscar en la respuesta el tipo de documento con `code: '20'` (Retención). Si no existe, crearlo:

```http
POST /billing/document-types
Content-Type: application/json
Authorization: Bearer {token}

{
  "code": "20",
  "name": "Retención",
  "description": "Comprobante de Retención Electrónica",
  "requiresRuc": true,
  "allowsDeduction": false,
  "isActive": true
}
```

Copiar el `id` del tipo de documento retornado.

#### Paso 2: Crear la Serie

```http
POST /billing/series
Content-Type: application/json
Authorization: Bearer {token}

{
  "companyId": "tu-company-id",
  "siteId": "tu-site-id",
  "documentTypeId": "id-del-tipo-documento-retencion",
  "emissionPointId": "tu-emission-point-id",
  "series": "R001",
  "description": "Serie para Retenciones Electrónicas",
  "startNumber": 1,
  "maxNumber": 99999999,
  "isDefault": true,
  "isActive": true
}
```

**Respuesta esperada:**
```json
{
  "id": "uuid-de-la-serie",
  "siteId": "uuid",
  "documentTypeId": "uuid",
  "series": "R001",
  "description": "Serie para Retenciones Electrónicas",
  "currentNumber": 0,
  "startNumber": 1,
  "maxNumber": 99999999,
  "isActive": true,
  "isDefault": true,
  "createdAt": "2024-01-20T10:00:00Z",
  "updatedAt": "2024-01-20T10:00:00Z"
}
```

### Formatos de Serie Recomendados

- **R001** - Serie principal de retenciones
- **R002** - Serie secundaria (si se necesita)
- **RTEST** - Serie para pruebas (ambiente de desarrollo)

### Verificación

Una vez creada la serie, verificar que aparece en:
1. Pantalla de Puntos de Emisión → Series
2. Al crear una retención, la serie debe estar disponible

### ⚠️ Problemas Comunes

**Problema**: No aparece el tipo de documento "Retención" al crear la serie

**Solución**:
- Verificar que el tipo de documento con código '20' existe en el sistema
- Usar el endpoint `GET /billing/document-types` para listar todos los tipos
- Si no existe, crearlo usando el endpoint `POST /billing/document-types` (ver Paso 1 arriba)

**Problema**: Error al crear la serie "Serie ya existe"

**Solución**:
- Cada serie debe ser única por punto de emisión
- Usar un nombre diferente (ej: R002, R003)
- O verificar si la serie ya existe y activarla

**Problema**: No puedo emitir retenciones después de crear la serie

**Solución**:
- Verificar que la serie esté marcada como "activa" (`isActive: true`)
- Verificar que el punto de emisión esté activo
- Verificar que la empresa tenga configuración de Bizlinks
- Revisar los permisos del usuario

**Problema**: No aparecen series al crear una retención

**Solución**:
- El formulario carga automáticamente las series configuradas para retenciones
- Si no aparecen series, significa que no hay series activas configuradas
- Crear una serie desde: Menú → Configuración → Puntos de Emisión → Series
- La serie debe estar asociada al tipo de documento "Retención" (código 20)
- La serie debe estar marcada como "activa"

### 📋 Checklist de Configuración

Antes de emitir retenciones, verificar:

- [ ] Tipo de documento "Retención" (código 20) existe en el sistema
- [ ] Serie creada y activa (ej: R001)
- [ ] Serie marcada como "por defecto" si es la única
- [ ] Punto de emisión activo
- [ ] Empresa tiene RUC configurado
- [ ] Empresa tiene datos de dirección completos
- [ ] Usuario tiene permisos `bizlinks.documents.view` y `bizlinks.documents.send`
- [ ] Configuración de Bizlinks activa para la empresa

---

## 🎯 Próximos Pasos (Mejoras Opcionales)

- [x] Implementar formulario completo de creación ✅
- [x] Agregar validaciones en tiempo real ✅
- [x] Implementar cálculo automático de retención ✅
- [ ] Agregar selector de proveedores desde base de datos
- [ ] Agregar selector de documentos relacionados desde facturas existentes
- [ ] Implementar edición de retenciones en borrador
- [ ] Agregar filtros avanzados (rango de fechas, rango de montos)
- [ ] Implementar exportación a Excel
- [ ] Agregar gráficos y estadísticas de retenciones
- [ ] Integración con módulo de Cuentas por Pagar
- [ ] Generación automática desde pagos a proveedores

---

## 📚 Referencias

- Documentación Bizlinks - Retenciones
- SUNAT - Régimen de Retenciones
- Catálogos SUNAT
- README del módulo de retenciones (backend)

---

**Fecha de Implementación**: 2024
**Versión**: 1.0.0
**Estado**: ✅ Completado - Módulo Funcional Completo

### Funcionalidades Implementadas:
- ✅ Listado de retenciones con filtros
- ✅ Detalle de retención con descarga de archivos
- ✅ Formulario completo de creación
- ✅ **Carga automática de series configuradas**
- ✅ **Generación automática de número correlativo**
- ✅ **Buscador de proveedores con autocompletado**
- ✅ **Autocompletado de datos del proveedor**
- ✅ Cálculo automático de retenciones
- ✅ Validaciones en tiempo real
- ✅ Integración con API de Bizlinks
