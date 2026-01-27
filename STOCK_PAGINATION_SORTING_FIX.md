# 🔧 Corrección de Paginación y Ordenamiento en Stock

## 🎯 Problemas Detectados

### 1. **Cantidad Inconsistente de Productos por Página**
**Problema**: El backend retorna 50 ubicaciones, pero el frontend mostraba menos productos porque los agrupaba por SKU.

**Ejemplo**:
- Backend: 50 ubicaciones (puede ser el mismo producto en diferentes áreas)
- Frontend: 15 productos agrupados (agrupación por SKU)
- **Resultado**: Paginación inconsistente

### 2. **Falta de Ordenamiento por Correlativo**
**Problema**: Los productos no estaban ordenados por correlativo descendente.

---

## ✅ Soluciones Implementadas

### 1. **Agregado Soporte para Ordenamiento en API**

**Archivo**: `src/services/api/inventory.ts`

```typescript
getStockV2: async (params?: {
  page?: number;
  limit?: number;
  warehouseId?: string;
  areaId?: string;
  lowStockOnly?: boolean;
  q?: string;
  sortBy?: string;           // ✅ NUEVO
  sortOrder?: 'ASC' | 'DESC'; // ✅ NUEVO
}): Promise<{...}> => {
  const response = await apiClient.get('/admin/inventory/v2/list', { params });
  return {
    ...response,
    results: response.data,
  };
}
```

---

### 2. **Actualizado Hook para Soportar Ordenamiento**

**Archivo**: `src/hooks/api/useStock.ts`

```typescript
export const useStockV2 = (params?: {
  page?: number;
  limit?: number;
  warehouseId?: string;
  areaId?: string;
  lowStockOnly?: boolean;
  q?: string;
  sortBy?: string;           // ✅ NUEVO
  sortOrder?: 'ASC' | 'DESC'; // ✅ NUEVO
}) => {
  return useQuery({
    queryKey: ['stock', 'v2', 'list', params],
    queryFn: () => inventoryApi.getStockV2(params),
    staleTime: 5 * 60 * 1000,
  });
};
```

---

### 3. **Configurado Ordenamiento por Correlativo Descendente**

**Archivo**: `src/screens/Inventory/StockScreen.tsx`

```typescript
const {
  data: stockResponseV2,
  isLoading: isLoadingStock,
  isRefetching,
  refetch: refetchStock,
} = useStockV2({
  page,
  limit,
  warehouseId: selectedWarehouseId !== 'all' ? selectedWarehouseId : undefined,
  areaId: selectedAreaId !== 'all' ? selectedAreaId : undefined,
  sortBy: 'product.correlativo',  // ✅ NUEVO
  sortOrder: 'DESC',               // ✅ NUEVO
});
```

---

### 4. **Eliminada Agrupación de Productos**

**Antes** (Agrupaba por SKU):
```typescript
const getGroupedProducts = useMemo(() => {
  const grouped: { [key: string]: StockItem[] } = {};

  filteredStockItems.forEach((item) => {
    if (!grouped[item.productId]) {
      grouped[item.productId] = [];
    }
    grouped[item.productId].push(item);
  });

  // Retornaba productos agrupados (menos items que ubicaciones)
  return Object.entries(grouped).map(([productId, items]) => ({
    productId,
    totalStock: items.reduce(...),
    locations: items.length,
    items,
  }));
}, [filteredStockItems]);
```

**Ahora** (Muestra cada ubicación individualmente):
```typescript
const getGroupedProducts = useMemo(() => {
  const products = filteredStockItems.map((item) => {
    const quantity =
      typeof item.availableQuantityBase === 'number'
        ? item.availableQuantityBase
        : typeof item.quantityBase === 'string'
          ? parseFloat(item.quantityBase)
          : item.quantityBase || 0;

    return {
      productId: item.productId,
      productTitle: item.productTitle || 'Sin nombre',
      productSku: item.productSku || 'Sin SKU',
      totalStock: quantity,
      locations: 1,              // ✅ Cada item es una ubicación
      warehouseName: item.warehouseName,  // ✅ NUEVO
      areaName: item.areaName,            // ✅ NUEVO
      items: [item],
      minStockAlert: item.minStockAlert,
    };
  });

  // Filtros de stock
  if (stockLevelFilter === 'normal') {
    return products.filter((p) => p.totalStock > 0);
  } else if (stockLevelFilter === 'no-stock') {
    return products.filter((p) => p.totalStock === 0);
  }
  return products;
}, [filteredStockItems, stockLevelFilter]);
```

**Beneficios**:
- ✅ Cada ubicación se muestra como un item separado
- ✅ La cantidad de items coincide con la paginación del backend
- ✅ Paginación consistente: 50 ubicaciones = 50 items mostrados

---

### 5. **Actualizada UI para Mostrar Ubicación**

**Antes**:
```tsx
<Text style={styles.productDetailLabel}>📍 Ubicaciones:</Text>
<Text style={styles.productDetailValue}>
  {product.locations} almacén(es)/área(s)
</Text>
```

**Ahora**:
```tsx
<Text style={styles.productDetailLabel}>📍 Ubicación:</Text>
<Text style={styles.productDetailValue}>
  {product.warehouseName || 'Sin almacén'}
  {product.areaName ? ` / ${product.areaName}` : ''}
</Text>
```

**Ejemplo de visualización**:
- "Almacen Principal de CD / Área A1"
- "Almacen Principal de CD / Área B2"

---

### 6. **Actualizado Contador de Paginación**

**Antes**:
```tsx
<Text style={styles.paginationSubtext}>
  {getGroupedProducts.length} productos • {pagination.total} ubicaciones
</Text>
```

**Ahora**:
```tsx
<Text style={styles.paginationSubtext}>
  {getGroupedProducts.length} de {pagination.total} ubicaciones
</Text>
```

**Ejemplo**: "50 de 425 ubicaciones"

---

## 📊 Comparación Antes/Después

### Antes (Con Agrupación)
```
Backend: 50 ubicaciones en página 1
Frontend: 15 productos agrupados mostrados
Paginación: "15 productos • 425 ubicaciones" ❌ Confuso
Orden: Sin ordenamiento específico
```

### Ahora (Sin Agrupación)
```
Backend: 50 ubicaciones en página 1
Frontend: 50 ubicaciones mostradas individualmente
Paginación: "50 de 425 ubicaciones" ✅ Claro
Orden: Por correlativo descendente ✅
```

---

## 🎨 Ejemplo de Visualización

### Página 1 (50 ubicaciones)
```
┌─────────────────────────────────────┐
│ Producto A (Correlativo: 1000)      │
│ SKU: PROD-001                       │
│ Stock: 25.00 unidades               │
│ 📍 Almacen CD / Área A1             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Producto A (Correlativo: 1000)      │
│ SKU: PROD-001                       │
│ Stock: 15.00 unidades               │
│ 📍 Almacen CD / Área B2             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Producto B (Correlativo: 999)       │
│ SKU: PROD-002                       │
│ Stock: 50.00 unidades               │
│ 📍 Almacen CD / Área A1             │
└─────────────────────────────────────┘

... (47 ubicaciones más)

[← Anterior]  Pág. 1/9  [Siguiente →]
              50 de 425 ubicaciones
```

---

## ✅ Verificación Final

### Archivos Modificados
1. ✅ `src/services/api/inventory.ts` - Agregado `sortBy` y `sortOrder`
2. ✅ `src/hooks/api/useStock.ts` - Agregado soporte para ordenamiento
3. ✅ `src/screens/Inventory/StockScreen.tsx` - Eliminada agrupación, agregada ubicación

### Errores TypeScript
- ✅ `inventory.ts` - Sin errores
- ✅ `useStock.ts` - Sin errores
- ✅ `StockScreen.tsx` - Sin errores

---

## 🧪 Pruebas Recomendadas

### 1. Verificar Cantidad Consistente
- ✅ Navegar a página 1: Debe mostrar 50 ubicaciones
- ✅ Navegar a página 2: Debe mostrar 50 ubicaciones
- ✅ Última página: Puede mostrar menos de 50 (resto)

### 2. Verificar Ordenamiento
- ✅ Primera ubicación debe tener el correlativo más alto
- ✅ Última ubicación debe tener el correlativo más bajo
- ✅ Orden descendente consistente en todas las páginas

### 3. Verificar Ubicaciones
- ✅ Cada tarjeta muestra almacén y área
- ✅ Si un producto está en múltiples áreas, aparece múltiples veces
- ✅ Stock mostrado es el de esa ubicación específica

### 4. Verificar Paginación
- ✅ Contador muestra "X de Y ubicaciones"
- ✅ Botones Anterior/Siguiente funcionan correctamente
- ✅ Número de página actualiza correctamente

---

## 📝 Notas Técnicas

### Comportamiento de Productos Duplicados
Si un producto está en 3 ubicaciones diferentes:
- **Antes**: 1 tarjeta agrupada mostrando "3 ubicaciones"
- **Ahora**: 3 tarjetas separadas, cada una con su ubicación y stock específico

### Ventajas del Nuevo Enfoque
1. ✅ **Paginación consistente**: 50 items = 50 ubicaciones
2. ✅ **Información detallada**: Se ve el stock por ubicación específica
3. ✅ **Ordenamiento correcto**: Por correlativo descendente
4. ✅ **Navegación predecible**: Cada página tiene la misma cantidad de items

### Consideraciones
- Si se necesita ver el stock total de un producto, usar el botón "📊 Ver Stock por Áreas"
- El filtro de nivel de stock sigue funcionando (Normal/Sin Stock/Todos)
- La búsqueda V2 sigue funcionando independientemente

---

## 🎯 Resultado Final

**Estado**: 🟢 **COMPLETADO**

**Funcionalidades**:
- ✅ Paginación consistente (50 ubicaciones por página)
- ✅ Ordenamiento por correlativo descendente
- ✅ Cada ubicación mostrada individualmente
- ✅ Información de almacén/área visible
- ✅ Contador de paginación claro
- ✅ Sin errores TypeScript

**Listo para**: Pruebas en producción 🚀
