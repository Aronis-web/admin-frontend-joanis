# Módulo de Campañas - Frontend

## 📋 Descripción

El módulo de campañas permite gestionar la distribución planificada de productos entre diferentes destinatarios (empresas externas o sedes internas de la organización).

## 🎯 Características Principales

### 1. Gestión de Campañas
- **Crear campañas** con nombre, descripción y fechas
- **Estados de campaña**: DRAFT, ACTIVE, CLOSED, CANCELLED
- **Código único** generado automáticamente (ej: CAMP-2024-00001)

### 2. Gestión de Participantes
- **Tipos de participantes**:
  - Empresas Externas (EXTERNAL_COMPANY)
  - Sedes Internas (INTERNAL_SITE)
- **Monto asignado** para cálculo proporcional
- Agregar/modificar/eliminar participantes (solo en estado DRAFT)

### 3. Gestión de Productos
- **Agregar productos** de dos formas:
  - Manual: Seleccionar producto del catálogo
  - Desde Compra: Importar productos de una compra validada
- **Estados de producto**:
  - ACTIVE: Listo para generar reparto
  - PRELIMINARY: En planificación
- **Tipos de distribución**:
  - ALL: Entre todos los participantes
  - INTERNAL_ONLY: Solo sedes internas
  - EXTERNAL_ONLY: Solo empresas externas
  - CUSTOM: Distribución personalizada

### 4. Distribución de Productos
- **Vista previa** de distribución antes de generar
- **Generación automática** de repartos según tipo de distribución
- **Distribuciones personalizadas** con cantidades específicas

## 📁 Estructura de Archivos

```
src/screens/Campaigns/
├── CampaignsScreen.tsx              # Lista de campañas
├── CreateCampaignScreen.tsx         # Crear nueva campaña
├── CampaignDetailScreen.tsx         # Detalle con tabs (resumen, participantes, productos)
├── AddParticipantScreen.tsx         # Agregar participante
├── AddProductScreen.tsx             # Agregar producto
├── CampaignProductDetailScreen.tsx  # Detalle de producto con vista previa y generación
├── index.ts                         # Exports
└── README.md                        # Esta documentación

src/types/campaigns.ts               # Tipos TypeScript
src/services/api/campaigns.ts        # Servicio API
```

## 🔄 Flujo de Trabajo

### 1. Crear Campaña (Estado: DRAFT)
```typescript
POST /api/campaigns
{
  "name": "Campaña Navidad 2024",
  "description": "Reparto de productos navideños",
  "startDate": "2024-12-01",
  "endDate": "2024-12-31"
}
```

### 2. Agregar Participantes
```typescript
POST /api/campaigns/{campaignId}/participants
{
  "participantType": "INTERNAL_SITE",
  "siteId": "uuid-sede-lima",
  "assignedAmount": 8000.00  // S/ 8,000
}
```

### 3. Agregar Productos
```typescript
POST /api/campaigns/{campaignId}/products
{
  "productId": "uuid-producto-arroz",
  "sourceType": "MANUAL",
  "totalQuantity": 1000,
  "productStatus": "ACTIVE",
  "distributionType": "ALL"
}
```

### 4. Vista Previa de Distribución
```typescript
GET /api/campaigns/{campaignId}/products/{productId}/preview
```

### 5. Generar Reparto
```typescript
POST /api/campaigns/{campaignId}/products/{productId}/generate
```

### 6. Activar Campaña (DRAFT → ACTIVE)
```typescript
POST /api/campaigns/{campaignId}/activate
```

### 7. Cerrar Campaña (ACTIVE → CLOSED)
```typescript
POST /api/campaigns/{campaignId}/close
```

## 🎨 Pantallas

### CampaignsScreen
- Lista de todas las campañas
- Filtros por estado
- Estadísticas por campaña (participantes, productos, repartos)
- Navegación a detalle de campaña

### CreateCampaignScreen
- Formulario para crear nueva campaña
- Campos: nombre, descripción, fechas, notas
- Validación de fechas

### CampaignDetailScreen
- **Tab Resumen**: Información general y estadísticas
- **Tab Participantes**: Lista de participantes con montos
- **Tab Productos**: Lista de productos con estados
- Botones de acción según estado (Activar, Cerrar, Cancelar)

### AddParticipantScreen
- Selección de tipo (Empresa/Sede)
- Selección de empresa o sede
- Asignación de monto
- Validaciones

### AddProductScreen
- Selección de origen (Manual/Desde Compra)
- Configuración de cantidad y estado
- Selección de tipo de distribución
- Soporte para múltiples productos desde compra

### CampaignProductDetailScreen
- Información del producto
- Vista previa de distribución
- Generación de reparto
- Gestión de distribuciones personalizadas

## 🔐 Permisos Requeridos

```typescript
// Lectura
'campaigns.read'

// Creación
'campaigns.create'

// Gestión de participantes
'campaigns.participants.add'

// Gestión de productos
'campaigns.products.add'
'campaigns.products.read'
```

## 📊 Tipos de Distribución Explicados

### ALL (Entre Todos)
Distribuye proporcionalmente entre todos los participantes según sus montos asignados.

**Ejemplo:**
- Producto: 1000 unidades
- Empresa ABC: S/ 15,000 (60%) → 600 unidades
- Sede Lima: S/ 8,000 (32%) → 320 unidades
- Sede Arequipa: S/ 2,000 (8%) → 80 unidades

### INTERNAL_ONLY (Solo Sedes)
Distribuye solo entre sedes internas, ignorando empresas externas.

### EXTERNAL_ONLY (Solo Empresas)
Distribuye solo entre empresas externas, ignorando sedes internas.

### CUSTOM (Personalizado)
Permite definir cantidades específicas manualmente para cada participante.

## ⚠️ Validaciones Importantes

### Campaña
- ✅ El código se genera automáticamente
- ✅ La fecha de fin debe ser >= fecha de inicio
- ✅ Solo se puede activar desde DRAFT
- ✅ Solo se puede cerrar desde ACTIVE

### Participantes
- ✅ No se puede duplicar una empresa en la misma campaña
- ✅ No se puede duplicar una sede en la misma campaña
- ✅ El monto asignado debe ser > 0
- ✅ Solo se pueden modificar en estado DRAFT

### Productos
- ✅ No se puede agregar el mismo producto dos veces
- ✅ La cantidad debe ser > 0
- ✅ Solo productos ACTIVE pueden generar reparto
- ✅ Solo se pueden modificar en estado DRAFT

### Distribución
- ✅ Solo se puede generar si el producto está en ACTIVE
- ✅ Solo se puede generar en estado DRAFT o ACTIVE
- ✅ No se puede generar si ya fue generado
- ✅ Para CUSTOM: suma de cantidades ≤ cantidad total

## 🎯 Casos de Uso

### Caso 1: Campaña Navideña
1. Crear campaña "Navidad 2024"
2. Agregar 5 sedes con montos proporcionales
3. Agregar productos (panetones, vinos, chocolates) con tipo INTERNAL_ONLY
4. Generar repartos automáticos
5. Activar campaña

### Caso 2: Reparto Mixto
1. Crear campaña "Promoción Verano 2024"
2. Agregar empresas y sedes
3. Agregar productos con diferentes tipos de distribución
4. Generar repartos según configuración
5. Activar y cerrar campaña

### Caso 3: Distribución por Zonas
1. Crear campaña "Reparto Regional 2024"
2. Agregar participantes
3. Agregar producto con tipo CUSTOM
4. Crear distribuciones personalizadas por zona
5. Generar repartos

## 🚀 Navegación

```typescript
// Ir a lista de campañas
navigation.navigate('Campaigns');

// Crear nueva campaña
navigation.navigate('CreateCampaign');

// Ver detalle de campaña
navigation.navigate('CampaignDetail', { campaignId: 'uuid' });

// Agregar participante
navigation.navigate('AddCampaignParticipant', { campaignId: 'uuid' });

// Agregar producto
navigation.navigate('AddCampaignProduct', { campaignId: 'uuid' });

// Ver detalle de producto
navigation.navigate('CampaignProductDetail', {
  campaignId: 'uuid',
  productId: 'uuid'
});
```

## 📱 Responsive Design

Todas las pantallas están optimizadas para:
- ✅ Teléfonos móviles
- ✅ Tablets (con estilos específicos)
- ✅ Orientación horizontal y vertical

## 🎨 Colores de Estado

### Estados de Campaña
- DRAFT: `#94A3B8` (Gris)
- ACTIVE: `#10B981` (Verde)
- CLOSED: `#6366F1` (Índigo)
- CANCELLED: `#EF4444` (Rojo)

### Estados de Producto
- ACTIVE: `#10B981` (Verde)
- PRELIMINARY: `#F59E0B` (Amarillo)

## 🔧 Mantenimiento

### Agregar nuevo tipo de distribución
1. Actualizar enum `DistributionType` en `types/campaigns.ts`
2. Agregar label en `DistributionTypeLabels`
3. Agregar descripción en `DistributionTypeDescriptions`
4. Implementar lógica en backend

### Agregar nuevo estado de campaña
1. Actualizar enum `CampaignStatus` en `types/campaigns.ts`
2. Agregar label en `CampaignStatusLabels`
3. Agregar color en `CampaignStatusColors`
4. Actualizar validaciones de transición

## 📚 Referencias

- Documentación del backend: Ver archivo de documentación adjunto
- API Endpoints: `/admin/campaigns/*`
- Tipos TypeScript: `src/types/campaigns.ts`
- Servicio API: `src/services/api/campaigns.ts`
