# 📥 Sistema de Seguimiento de Descargas de Hojas de Reparto

## Descripción

Se ha implementado un sistema de seguimiento **LOCAL** para marcar cuántas veces cada producto ha sido descargado en las hojas de reparto. Esto permite llevar un control interno temporal (durante unas horas) y visualizar fácilmente cuáles productos faltan por descargar.

**IMPORTANTE**: Este sistema usa almacenamiento local (localStorage en web, AsyncStorage en móvil) y **NO requiere cambios en el backend**. Los datos se guardan solo en el dispositivo del usuario.

## Características Implementadas

### 1. **Contador de Descargas por Producto**
- Cada producto en los repartos ahora tiene un contador de descargas (`downloadCount`)
- Se registra la fecha y hora de la última descarga (`lastDownloadedAt`)
- El contador se incrementa automáticamente cada vez que se genera un PDF o Excel con ese producto

### 2. **Registro Automático de Descargas (Local)**
- Cuando se descargan hojas de reparto (PDF o Excel), el sistema registra automáticamente en el almacenamiento local:
  - Los productos que fueron incluidos en la descarga
  - La fecha y hora de la descarga
  - Incrementa el contador de cada producto
- Los datos se guardan en localStorage (web) o AsyncStorage (móvil)
- **No requiere conexión al backend**

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

### 1. `src/utils/downloadTracker.ts` ⭐ NUEVO
Sistema de almacenamiento local para tracking de descargas:
- `registerDownloads()`: Registra descargas en localStorage/AsyncStorage
- `getCampaignDownloads()`: Obtiene información de descargas de una campaña
- `getDownloadInfo()`: Obtiene info de descarga de un producto específico
- `clearCampaignDownloads()`: Limpia descargas de una campaña
- `clearAllDownloads()`: Limpia todas las descargas
- `cleanOldRecords()`: Limpia registros antiguos (por defecto >24 horas)

### 2. `src/types/repartos.ts`
```typescript
export interface RepartoProducto {
  // ... campos existentes
  downloadCount?: number; // Contador de descargas
  lastDownloadedAt?: string; // Última fecha de descarga
}
```

### 3. `src/components/Repartos/ProductSelectionModal.tsx`
- Muestra contador de descargas en cada producto
- Muestra última fecha de descarga
- Filtro para ver solo productos pendientes
- Estadísticas de descarga en la parte superior

### 4. `src/screens/Repartos/RepartoCampaignDetailScreen.tsx`
- Carga información de descargas desde almacenamiento local
- Registra automáticamente las descargas al generar PDF/Excel
- Combina datos de productos con información de descargas

### 5. `src/screens/Repartos/RepartosScreen.tsx`
- Carga información de descargas desde almacenamiento local
- Registra automáticamente las descargas al generar PDF/Excel
- Combina datos de productos con información de descargas

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

### Almacenamiento Local

El sistema utiliza almacenamiento local del dispositivo:

#### Web (localStorage)
- Clave: `REPARTO_DOWNLOADS_TRACKER`
- Formato: JSON con estructura `{ "campaignId:productId": DownloadRecord }`
- Persistente hasta que se limpie el navegador

#### Móvil (AsyncStorage)
- Clave: `REPARTO_DOWNLOADS_TRACKER`
- Formato: JSON con estructura `{ "campaignId:productId": DownloadRecord }`
- Persistente en el dispositivo

#### Estructura de Datos
```typescript
interface DownloadRecord {
  productId: string;
  campaignId: string;
  downloadCount: number;
  lastDownloadedAt: string; // ISO 8601 format
}
```

#### Limpieza Automática
- Los registros antiguos (>24 horas) pueden limpiarse con `cleanOldRecords()`
- Se puede limpiar manualmente por campaña o todos los registros

## Beneficios

1. **Control de Impresiones**: Saber exactamente cuántas veces se ha impreso cada producto
2. **Evitar Duplicados**: Identificar fácilmente qué ya se imprimió
3. **Auditoría Local**: Registro temporal de cuándo se descargó cada producto
4. **Eficiencia**: Filtrar rápidamente lo que falta por imprimir
5. **Visibilidad**: Ver de un vistazo el estado de las descargas
6. **Sin Backend**: No requiere cambios en el servidor, funciona completamente offline
7. **Ligero**: Usa recursos mínimos del dispositivo

## Notas Técnicas

- El registro de descargas es **no bloqueante**: Si falla, no impide la descarga del archivo
- Los contadores se incrementan **por producto**, no por hoja de reparto completa
- El filtro funciona en **tiempo real** sin necesidad de recargar datos
- Compatible con descargas en **PDF y Excel**
- **Almacenamiento local**: Los datos solo existen en el dispositivo del usuario
- **Temporal**: Diseñado para control durante unas horas, no para auditoría permanente
- **Por dispositivo**: Cada dispositivo tiene su propio tracking independiente

## Limitaciones

1. **No sincroniza entre dispositivos**: Cada dispositivo tiene su propio contador
2. **Se pierde al limpiar caché**: En web, se borra si se limpia localStorage
3. **No es auditoría permanente**: Diseñado para uso temporal durante el día
4. **Sin respaldo**: No hay backup en el servidor

## Próximas Mejoras Sugeridas

1. Agregar botón para resetear contadores de una campaña
2. Agregar notificaciones cuando todos los productos han sido descargados
3. Exportar estadísticas de descarga a Excel
4. Agregar limpieza automática de registros antiguos al iniciar la app
5. Mostrar advertencia cuando hay muchos registros almacenados
