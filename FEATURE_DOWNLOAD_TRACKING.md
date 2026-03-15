# 📥 Sistema de Seguimiento de Descargas de Hojas de Reparto

## Descripción

Se ha implementado un sistema de seguimiento para marcar cuántas veces cada producto ha sido descargado en las hojas de reparto. Esto permite llevar un control interno y visualizar fácilmente cuáles productos faltan por descargar.

## Características Implementadas

### 1. **Contador de Descargas por Producto**
- Cada producto en los repartos ahora tiene un contador de descargas (`downloadCount`)
- Se registra la fecha y hora de la última descarga (`lastDownloadedAt`)
- El contador se incrementa automáticamente cada vez que se genera un PDF o Excel con ese producto

### 2. **Registro Automático de Descargas**
- Cuando se descargan hojas de reparto (PDF o Excel), el sistema registra automáticamente:
  - Los productos que fueron incluidos en la descarga
  - La fecha y hora de la descarga
  - Incrementa el contador de cada producto

### 3. **Interfaz Visual Mejorada**

#### Modal de Selección de Productos
El modal ahora muestra:
- **Badge verde con contador**: Muestra cuántas veces se ha descargado cada producto (ej: "📥 3x")
- **Última fecha de descarga**: Muestra cuándo fue la última vez que se descargó el producto
- **Estadísticas generales**:
  - Productos descargados
  - Productos pendientes de descarga

#### Filtro de Productos Pendientes
- Botón para mostrar solo productos que NO han sido descargados
- Facilita identificar rápidamente qué productos faltan por imprimir
- El filtro se puede activar/desactivar con un clic

### 4. **Indicadores Visuales**
- **Badge verde (📥 Nx)**: Indica que el producto ha sido descargado N veces
- **Texto verde**: Muestra la última fecha de descarga
- **Sin badge**: El producto aún no ha sido descargado (pendiente)

## Archivos Modificados

### 1. `src/types/repartos.ts`
```typescript
export interface RepartoProducto {
  // ... campos existentes
  downloadCount?: number; // Contador de descargas
  lastDownloadedAt?: string; // Última fecha de descarga
}
```

### 2. `src/services/api/repartos.ts`
Nuevos métodos:
- `registerDistributionSheetDownload()`: Registra una descarga de hojas de reparto
- `getDownloadStatistics()`: Obtiene estadísticas de descargas por campaña

### 3. `src/components/Repartos/ProductSelectionModal.tsx`
- Muestra contador de descargas en cada producto
- Muestra última fecha de descarga
- Filtro para ver solo productos pendientes
- Estadísticas de descarga en la parte superior

### 4. `src/screens/Repartos/RepartoCampaignDetailScreen.tsx`
- Registra automáticamente las descargas al generar PDF/Excel

### 5. `src/screens/Repartos/RepartosScreen.tsx`
- Registra automáticamente las descargas al generar PDF/Excel

## Uso

### Para el Usuario Final

1. **Ver estadísticas de descarga**:
   - Al abrir el modal de selección de productos, verás en la parte superior:
     - Cuántos productos han sido descargados
     - Cuántos productos están pendientes

2. **Identificar productos descargados**:
   - Los productos con badge verde (📥 Nx) ya han sido descargados
   - El número indica cuántas veces se ha descargado
   - Debajo verás la fecha de la última descarga

3. **Filtrar productos pendientes**:
   - Haz clic en "Mostrar solo pendientes de descarga"
   - Solo se mostrarán los productos que NO han sido descargados
   - Útil para imprimir solo lo que falta

4. **Descargar productos**:
   - Selecciona los productos que deseas descargar
   - Elige el formato (PDF o Excel)
   - El sistema registrará automáticamente la descarga

### Endpoints del Backend (Requeridos)

El backend debe implementar estos endpoints:

#### 1. Registrar Descarga
```
POST /admin/campaigns/repartos/campaigns/:campaignId/register-download
Body: {
  productIds: string[]
}
Response: {
  success: boolean;
  updatedCount: number;
}
```

#### 2. Obtener Estadísticas
```
GET /admin/campaigns/repartos/campaigns/:campaignId/download-statistics
Response: {
  products: Array<{
    productId: string;
    productName: string;
    downloadCount: number;
    lastDownloadedAt: string | null;
    totalAssigned: number;
  }>;
}
```

#### 3. Actualizar Modelo RepartoProducto
El modelo debe incluir:
```typescript
downloadCount: number (default: 0)
lastDownloadedAt: Date | null
```

## Beneficios

1. **Control de Impresiones**: Saber exactamente cuántas veces se ha impreso cada producto
2. **Evitar Duplicados**: Identificar fácilmente qué ya se imprimió
3. **Auditoría**: Registro de cuándo se descargó cada producto
4. **Eficiencia**: Filtrar rápidamente lo que falta por imprimir
5. **Visibilidad**: Ver de un vistazo el estado de las descargas

## Notas Técnicas

- El registro de descargas es **no bloqueante**: Si falla, no impide la descarga del archivo
- Los contadores se incrementan **por producto**, no por hoja de reparto completa
- El filtro funciona en **tiempo real** sin necesidad de recargar datos
- Compatible con descargas en **PDF y Excel**

## Próximas Mejoras Sugeridas

1. Agregar un reporte de auditoría de descargas
2. Permitir resetear contadores de descarga
3. Agregar notificaciones cuando todos los productos han sido descargados
4. Exportar estadísticas de descarga a Excel
5. Agregar filtros por rango de fechas de descarga
