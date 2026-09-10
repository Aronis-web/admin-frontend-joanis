# 📝 Changelog - Módulo de Retenciones

## [1.1.0] - 2024-01-XX - Reversión de Retenciones

### ✨ Nuevas Funcionalidades

#### 🔄 Reversión (Anulación) de Retenciones
- **Anular retenciones aceptadas**: Permite anular retenciones que han sido aceptadas por SUNAT
- **Documento de reversión**: Genera automáticamente un documento de reversión (tipo RC)
- **Validaciones completas**:
  - Solo se pueden anular retenciones con estado ACCEPTED
  - No se pueden anular retenciones ya revertidas
  - Motivo obligatorio (mínimo 5 caracteres)
- **Trazabilidad completa**:
  - Registro del documento de reversión generado
  - Fecha y hora de la anulación
  - Usuario que realizó la anulación
  - Motivo de la anulación

### 🎨 Mejoras de UI/UX

#### Pantalla de Detalle de Retención
- **Badge de estado**: Muestra "ANULADA" en rojo cuando la retención ha sido revertida
- **Alerta de reversión**: Banner informativo con:
  - Documento de reversión que la anuló
  - Motivo de la anulación
  - Fecha de anulación
- **Botón de anular**:
  - Visible solo para retenciones aceptadas y no anuladas
  - Solicita confirmación y motivo antes de proceder
  - Advertencia clara sobre la irreversibilidad de la acción

#### Pantalla de Lista de Retenciones
- **Badge visual**: Retenciones anuladas se muestran con badge rojo "ANULADA"
- **Banner informativo**: Muestra el motivo de anulación en cada tarjeta

### 🔧 Cambios Técnicos

#### Tipos y DTOs
- **Nuevos campos en `Retencion`**:
  - `isReversed?: boolean` - Indica si fue revertida
  - `reversedByDocumentId?: string` - ID del documento de reversión
  - `reversedBySerieNumero?: string` - Serie del documento de reversión
  - `reversedAt?: string` - Fecha de reversión
  - `reversedByUserId?: string` - Usuario que revirtió
  - `reversalReason?: string` - Motivo de reversión

- **Nuevo DTO**: `RevertirRetencionDto`
  - `motivoReversion: string` - Motivo obligatorio
  - `serieReversion?: string` - Serie opcional (usa RR01 por defecto)

#### API
- **Nuevo endpoint**: `PATCH /bizlinks/retenciones/:id/revertir`
  - Revierte una retención existente
  - Genera documento de reversión automáticamente
  - Actualiza el estado de la retención original
  - Timeout: 60 segundos

#### Servicios
- **bizlinksApi.revertirRetencion()**: Nueva función para anular retenciones

### 📋 Notas Importantes

#### Backend Requerido
Esta funcionalidad requiere que el backend tenga implementado:
1. **Migración SQL**: Campos de reversión en `bizlinks_documents`
2. **Endpoint**: `PATCH /bizlinks/retenciones/:id/revertir`
3. **Serie RR01**: Configurada para documentos de reversión
4. **Tipo de documento RC**: Configurado en el sistema

#### Flujo de Reversión
1. Usuario solicita anular retención desde el detalle
2. Sistema valida que la retención pueda ser anulada
3. Usuario ingresa motivo de anulación
4. Sistema genera documento de reversión (RC)
5. Documento se envía a Bizlinks/SUNAT
6. Retención original se marca como revertida
7. Se registra toda la información de trazabilidad

### 🎯 Casos de Uso

#### Cuándo usar la reversión
- Error en el cálculo de la retención
- Datos incorrectos del proveedor
- Documentos relacionados incorrectos
- Duplicación de retención
- Cualquier error que requiera anular el documento

#### Restricciones
- Solo retenciones con estado ACCEPTED
- Una retención solo puede revertirse una vez
- El proceso es irreversible
- Requiere motivo válido

### 📚 Documentación Relacionada
- Ver guías adjuntas para más detalles sobre la implementación
- Consultar documentación del backend para configuración de series

---

## [1.3.0] - 2024-01-20

### 🐛 Correcciones de Errores

#### Fix: Datos no se muestran en la lista de retenciones
- **Problema**: La lista de retenciones no mostraba datos y los tiempos de carga eran largos
- **Causa**: Los datos están en el campo `payloadXml` pero no se estaban parseando en la pantalla de listado
- **Solución**:
  - Aplicado el mismo enriquecimiento de datos XML que en la pantalla de detalle
  - Agregadas funciones `parseXmlData()`, `parseXmlNumber()` y `enrichRetencionData()` a `RetencionesScreen`
  - Cada retención se enriquece automáticamente al cargar la lista
  - Logs detallados para diagnóstico de rendimiento
  - Parseo de: proveedor, tasaRetencion, importes, moneda, régimen
- **Impacto**: Ahora la lista muestra correctamente todos los datos de cada retención

#### Fix: Fechas no funcionan en formulario de crear retenciones
- **Problema**: Los selectores de fecha no funcionaban en el formulario de creación de retenciones
- **Causa**: Props incorrectas pasadas al componente `DatePickerButton` (usaba `date` en lugar de `label` y `value`)
- **Solución**:
  - Corregido `DatePickerButton` en fecha de emisión principal: agregado `label=""` y cambiado `date` a `value`
  - Corregido `DatePicker` modal: agregado `formatDateToString()` en el callback `onConfirm`
  - Corregido `DatePickerButton` en modal de agregar item (fecha de emisión y fecha de pago)
  - Todos los DatePickers ahora convierten correctamente Date a string usando `formatDateToString()`
- **Archivos modificados**: `CreateRetencionScreen.tsx`
- **Impacto**: Los selectores de fecha ahora funcionan correctamente en todo el formulario

#### Fix: Error al mostrar datos del proveedor en detalle y listado
- **Problema**: Las pantallas de detalle y listado fallaban con error "Cannot read property 'razonSocialProveedor' of undefined"
- **Causa**: La API devuelve los datos del proveedor directamente en el objeto raíz, no como objeto `proveedor` anidado
- **Solución**:
  - Actualizado tipo `Retencion` para soportar ambos formatos (objeto `proveedor` y campos directos)
  - Modificado `RetencionDetailScreen` para manejar ambos casos con fallback
  - Modificado `RetencionesScreen` para manejar ambos casos con fallback
  - Uso de optional chaining (`?.`) y operador OR (`||`) para acceso seguro

#### Fix: Error de renderizado de fechas en modal
- **Problema**: Error "Objects are not valid as a React child (found: [object Date])"
- **Causa**: El `DatePicker` devolvía objetos `Date` que se asignaban directamente a estados
- **Solución**: Convertir objetos `Date` a strings usando `formatDateToString()` en callbacks `onConfirm`

#### Fix: Error al mostrar valores numéricos en detalle
- **Problema**: Error "Cannot read property 'toFixed' of undefined"
- **Causa**: La API no devuelve todos los campos numéricos como propiedades del objeto JSON (están en el XML)
- **Solución**:
  - Actualizado tipo `Retencion` y `RetencionItemDto` para hacer campos numéricos opcionales
  - Creada función helper `getSafeNumber()` para manejar valores undefined
  - Aplicado en todos los lugares donde se usa `.toFixed()`
  - Agregado fallback para `tipoMoneda` con valor por defecto 'PEN'
  - Validación condicional para renderizar sección de items solo si existen

#### Fix: Datos no se muestran en pantalla de detalle
- **Problema**: Los datos de la retención no se mostraban en la pantalla de detalle
- **Causa**: Los datos están en el campo `payloadXml` pero no parseados como propiedades del objeto
- **Solución**:
  - Agregado campo `payloadXml` al tipo `Retencion`
  - Creadas funciones helper para parsear XML: `parseXmlData()`, `parseXmlNumber()`
  - Creada función `enrichRetencionData()` que extrae datos del XML y los agrega al objeto
  - Parseo automático de: proveedor, tasaRetencion, importes, moneda, régimen
  - Los datos parseados se usan como fallback cuando no están en el objeto JSON

#### Fix: Error 404 al descargar archivos PDF y XML
- **Problema**: Error 404 al intentar descargar PDF y XML usando endpoints `/pdf` y `/xml`
- **Causa**: El backend devuelve URLs directas (`pdfUrl`, `xmlSignUrl`) en lugar de endpoints de descarga
- **Solución**:
  - Modificadas funciones `handleDownloadPDF()` y `handleDownloadXML()`
  - Primero intenta abrir la URL directa si existe (`pdfUrl`, `xmlSignUrl`)
  - Usa `Linking.openURL()` para abrir archivos en el navegador
  - Fallback al método de descarga por API si no hay URL directa

### ✨ Nuevas Funcionalidades

#### Búsqueda de Facturas en Modal de Documentos 🔍
- **Selector de Modo Dual**: Nuevo selector con dos opciones claramente diferenciadas:
  - **"Buscar Factura"**: Busca y selecciona facturas existentes del sistema
  - **"Ingresar Manual"**: Ingresa datos de documentos manualmente
- **Búsqueda en Tiempo Real de Facturas**:
  - Busca facturas por código o número mientras escribes
  - Mínimo 2 caracteres para iniciar búsqueda
  - Límite de 10 resultados para mejor rendimiento
- **Autocompletado Inteligente de Facturas**: Al seleccionar una factura, se completan automáticamente:
  - Tipo de documento (mapeo automático Sales → Bizlinks)
  - Número de documento completo
  - Fecha de emisión
  - Importe total (conversión automática de centavos a unidades)
  - Importe del pago (prellenado con el total)
- **Resultados Enriquecidos**: Cada resultado muestra:
  - Número de factura completo
  - Cliente/Empresa (razón social o nombre completo)
  - Total y fecha de emisión
- **Campos Bloqueados**: Cuando se selecciona una factura, los campos se bloquean para prevenir modificaciones
- **Indicador Visual**: Badge verde que muestra la factura seleccionada
- **Opción de Limpiar**: Botón para cambiar de modo y resetear campos

### 🔧 Mejoras Técnicas

#### Integración con API de Ventas
- Uso de `salesApi.getSales()` para búsqueda de facturas
- Filtrado automático por `documentType: FACTURA`
- Inclusión de documentos relacionados (`includeDocuments: true`)
- Manejo de estados de carga y errores

#### Mapeo de Tipos de Documento
- Conversión automática de tipos de documento:
  - `FACTURA` → `01`
  - `BOLETA` → `03`
  - `NOTA_CREDITO` → `07`
  - `NOTA_DEBITO` → `08`

#### Conversión de Montos
- Conversión automática de centavos a unidades monetarias
- Formato correcto para visualización y cálculos

### 📋 Flujo Mejorado

#### Modo: Buscar Factura
```
1. Usuario selecciona "Buscar Factura"
2. Escribe código o número: "F001"
3. Selecciona factura de la lista
4. Todos los campos se completan automáticamente
5. Solo puede editar: Fecha de pago e Importe del pago
6. Agrega el documento a la retención
```

#### Modo: Ingresar Manual
```
1. Usuario selecciona "Ingresar Manual"
2. Completa todos los campos manualmente
3. Tipo, número, fecha, importes
4. Agrega el documento a la retención
```

### 🎨 Mejoras de UI/UX
- **Botones de Modo**: Diseño claro con iconos (🔍 buscar, ✍️ manual)
- **Estados Visuales**: Botón activo con borde morado y fondo claro
- **Campos Deshabilitados**: Fondo gris para campos bloqueados
- **Scroll en Resultados**: Lista scrolleable con máximo 250px
- **Sin Resultados**: Mensaje claro cuando no hay facturas

### 📚 Documentación
- Actualizado `MODULO_RETENCIONES.md` con información sobre búsqueda de facturas
- Documentados los dos modos de entrada de documentos
- Agregada descripción detallada del flujo de búsqueda

### 🔗 Integraciones
- Integración completa con módulo de Ventas (Sales)
- Uso de tipos `Sale`, `DocumentType` del módulo de ventas
- Reutilización de componentes de búsqueda existentes

### 💡 Beneficios
- ✅ Reducción de errores al copiar datos de facturas
- ✅ Mayor velocidad al agregar documentos existentes
- ✅ Consistencia de datos entre módulos
- ✅ Mejor experiencia de usuario
- ✅ Flexibilidad para documentos externos (modo manual)

---

## [1.2.0] - 2024-01-20

### ✨ Nuevas Funcionalidades

#### Buscador de Proveedores con Autocompletado
- **Búsqueda en Tiempo Real**: Busca proveedores por nombre comercial o RUC mientras escribes
- **Autocompletado Inteligente**: Al seleccionar un proveedor, todos los campos se completan automáticamente:
  - RUC (desde la entidad legal principal)
  - Razón social
  - Nombre comercial
  - Dirección completa
  - Departamento, provincia, distrito
- **Resultados Enriquecidos**: Cada resultado muestra:
  - Nombre comercial
  - RUC
  - Dirección
- **Campos Bloqueados**: Cuando se selecciona un proveedor, los campos se bloquean para prevenir modificaciones accidentales
- **Opción de Limpiar**: Botón para limpiar la selección y buscar otro proveedor o ingresar manualmente
- **Indicador Visual**: Badge verde que muestra el proveedor seleccionado
- **Estado de Carga**: Indicador mientras se buscan proveedores

### 🔧 Mejoras Técnicas

#### Integración con API de Proveedores
- Uso de `suppliersService.autocompleteSuppliers()` para búsqueda
- Límite de 10 resultados para mejor rendimiento
- Búsqueda mínima de 2 caracteres
- Manejo de estados de carga y errores

#### Experiencia de Usuario
- **Búsqueda Instantánea**: Los resultados aparecen mientras escribes
- **Scroll en Resultados**: Lista scrolleable con máximo 250px de altura
- **Sin Resultados**: Mensaje claro cuando no hay coincidencias
- **Campos Deshabilitados**: Visual claro de campos autocompletados (fondo gris)

### 📋 Flujo Mejorado

#### Antes
```
1. Usuario ingresa manualmente todos los datos del proveedor
2. Riesgo de errores de tipeo
3. Datos inconsistentes con el sistema
```

#### Ahora
```
1. Usuario busca proveedor: "ACME"
2. Selecciona de la lista
3. Todos los datos se completan automáticamente
4. Datos consistentes con el sistema de proveedores
```

### 🎨 Interfaz de Usuario

#### Componentes Nuevos
- **Barra de Búsqueda**: Input con icono de búsqueda y loader
- **Lista de Resultados**: Dropdown con resultados enriquecidos
- **Badge de Selección**: Indicador verde del proveedor seleccionado
- **Botón Limpiar**: Para resetear la selección

#### Estilos Agregados
- `searchContainer` - Contenedor principal de búsqueda
- `searchInputContainer` - Input con icono
- `searchResultsContainer` - Dropdown de resultados
- `searchResultItem` - Cada resultado individual
- `selectedSupplierBadge` - Badge de confirmación
- `inputDisabled` - Estilo para campos bloqueados
- `clearButton` - Botón de limpiar

---

## [1.1.0] - 2024-01-20

### ✨ Nuevas Funcionalidades

#### Carga Automática de Series
- **Selector de Series**: El formulario ahora carga automáticamente las series configuradas para retenciones desde el punto de emisión
- **Serie por Defecto**: Si existe una serie marcada como "por defecto", se selecciona automáticamente
- **Validación de Series**: El sistema verifica que existan series configuradas antes de permitir crear retenciones
- **Mensajes Informativos**: Alertas claras cuando no hay series configuradas o cuando falta el tipo de documento

#### Generación Automática de Números Correlativos
- **Sin Entrada Manual**: El usuario ya no necesita ingresar el número completo (ej: R001-00000001)
- **Solo Serie**: El usuario solo selecciona la serie (ej: R001)
- **Backend Genera Correlativo**: El backend incrementa automáticamente el `currentNumber` de la serie
- **Prevención de Duplicados**: El sistema garantiza números únicos y secuenciales

### 🔧 Mejoras Técnicas

#### Integración con API de Billing
- Importación de `billingApi` para obtener tipos de documento y series
- Uso de `BizlinksDocumentType.RETENCION` para identificar el tipo de documento
- Carga de series filtradas por:
  - Sede actual (`siteId`)
  - Tipo de documento "Retención" (código 20)
  - Estado activo (`isActive: true`)

#### Validaciones Mejoradas
- Validación de serie seleccionada antes de enviar
- Verificación de existencia del tipo de documento "Retención"
- Alertas informativas cuando faltan configuraciones

#### Interfaz de Usuario
- **Estado de Carga**: Indicador mientras se cargan las series
- **Selector Mejorado**: Picker con descripción de cada serie
- **Indicador de Serie por Defecto**: Muestra "(Por defecto)" en la serie predeterminada
- **Mensaje de Ayuda**: Hint que indica que el correlativo se genera automáticamente
- **Alerta de No Series**: Mensaje claro cuando no hay series configuradas con opciones de acción

### 📋 Cambios en el Flujo

#### Antes
```
1. Usuario ingresa manualmente: "R001-00000001"
2. Usuario debe conocer el próximo número disponible
3. Riesgo de duplicados o números incorrectos
```

#### Ahora
```
1. Usuario selecciona serie: "R001"
2. Sistema genera automáticamente: "R001-00000006" (basado en currentNumber)
3. Garantía de números únicos y secuenciales
```

### 🐛 Correcciones

- **Prevención de Errores**: Ya no es posible ingresar números de serie incorrectos
- **Consistencia**: Todas las retenciones usan el mismo sistema de numeración que otros documentos
- **Sincronización**: El número correlativo siempre está sincronizado con la base de datos

### 📚 Documentación Actualizada

#### MODULO_RETENCIONES.md
- ✅ Actualizada sección "Creación de Retención" con selector de series
- ✅ Actualizado flujo de uso (ahora 8 pasos en lugar de 7)
- ✅ Agregada nota sobre generación automática de correlativos
- ✅ Agregado problema común: "No aparecen series al crear una retención"
- ✅ Actualizada lista de funcionalidades implementadas

#### Nuevas Secciones
- Explicación detallada de cómo funciona la generación de correlativos
- Ejemplos de cómo el backend incrementa el `currentNumber`
- Guía de troubleshooting para problemas con series

### 🔄 Migración

#### Para Usuarios Existentes
No se requiere migración. El cambio es transparente:
- Las series existentes seguirán funcionando
- El `currentNumber` de cada serie se respeta
- Los documentos anteriores no se ven afectados

#### Para Nuevas Instalaciones
1. Crear tipo de documento "Retención" (código 20)
2. Crear al menos una serie para retenciones (ej: R001)
3. Marcar una serie como "por defecto" (recomendado)

### 🎯 Próximas Mejoras Sugeridas

- [ ] Mostrar el próximo número que se generará en la vista previa
- [ ] Permitir crear series directamente desde el formulario de retención
- [ ] Agregar estadísticas de uso de series (documentos emitidos, números disponibles)
- [ ] Implementar validación de límite de serie (cuando se acerca a `maxNumber`)
- [ ] Agregar opción de "recargar series" sin salir del formulario

---

## [1.0.0] - 2024-01-15

### ✨ Lanzamiento Inicial

- ✅ Listado de retenciones con filtros
- ✅ Detalle de retención con descarga de archivos
- ✅ Formulario de creación completo
- ✅ Cálculo automático de retenciones
- ✅ Validaciones en tiempo real
- ✅ Integración con API de Bizlinks
- ✅ Documentación completa

---

**Mantenido por**: Equipo de Desarrollo
**Última actualización**: 2024-01-20
