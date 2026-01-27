# 🔍 Auditoría de Endpoints V2 - Oportunidades de Migración

## 📊 Resumen Ejecutivo

He revisado todo el proyecto para identificar dónde más pueden servir los nuevos endpoints V2 optimizados. A continuación se presenta un análisis completo de las oportunidades de migración.

---

## ✅ Ya Migrados a V2 (Completado)

### 1. **Pantalla de Productos** (`src/screens/Inventory/ProductsScreen.tsx`)
- ✅ Usa `getProductsV2()` con `includePhotos: true`
- ✅ Debounce de 800ms
- ✅ Prioriza `photos[0]` para miniaturas

### 2. **Modal de Agregar Producto a Transmisión** (`src/components/Transmisiones/AddProductModal.tsx`)
- ✅ Usa `searchProductsV2()` con `includePhotos: true`
- ✅ Debounce de 800ms
- ✅ Muestra miniaturas de 50x50px

### 3. **Pantalla de Agregar Producto a Campaña** (`src/screens/Campaigns/AddProductScreen.tsx`)
- ✅ Usa `searchProductsV2()` con `includePhotos: true`
- ✅ Debounce de 800ms
- ✅ Prioriza `photos[0]` sobre `imageUrl`

### 4. **Lista de Productos de Transmisión** (`src/components/Transmisiones/TransmisionProductsList.tsx`)
- ✅ Usa `searchProductsV2()` con `includePhotos: true`
- ✅ Debounce de 800ms

### 5. **Transferencias Internas** (`src/screens/Transfers/InternalTransfersScreen.tsx`)
- ✅ Usa `getProductsV2()` con límite de 100 productos

### 6. **Transferencias Externas** (`src/screens/Transfers/ExternalTransfersScreen.tsx`)
- ✅ Usa `getProductsV2()` con límite de 100 productos

---

## 🚀 Oportunidades de Migración Identificadas

### **ALTA PRIORIDAD** 🔴

#### 1. **Servicio de Transmisiones** (`src/services/api/transmisiones.ts`)
**Líneas 183-206**

**Problema Actual:**
```typescript
searchProducts: async (query: string, status?: string): Promise<any> => {
  return apiClient.get('/admin/products', {  // ❌ Endpoint V1
    params: {
      q: query,
      status: status || 'active,preliminary',
      limit: 20,
    },
  });
},

getProductByCode: async (code: string): Promise<any> => {
  try {
    return await apiClient.get(`/admin/products/sku/${code}`);  // ❌ Endpoint V1
  } catch (error) {
    return apiClient.get('/admin/products', {  // ❌ Endpoint V1
      params: { barcode: code, limit: 1 },
    });
  }
},
```

**Beneficios de Migrar:**
- ✅ **Búsqueda más rápida** con Full-Text Search y caché Redis
- ✅ **Soporte para fotos** en resultados de búsqueda
- ✅ **Mejor rendimiento** con miles de productos
- ✅ **Ordenamiento por relevancia** automático

**Solución Propuesta:**
```typescript
searchProducts: async (query: string, status?: string): Promise<any> => {
  return productsApi.searchProductsV2({
    q: query,
    status: status || 'active,preliminary',
    limit: 20,
    includePhotos: true,
  });
},

getProductByCode: async (code: string): Promise<any> => {
  // Buscar por SKU o código de barras usando v2
  const response = await productsApi.searchProductsV2({
    q: code,
    limit: 1,
    includePhotos: true,
  });

  if (response.results.length > 0) {
    return response.results[0];
  }

  throw new Error('Producto no encontrado');
},
```

**Impacto:** 🔥 **ALTO** - Este servicio es usado por múltiples componentes de transmisiones

---

#### 2. **Detalle de Campaña - Carga de Productos** (`src/screens/Campaigns/CampaignDetailScreen.tsx`)
**Líneas 203-215**

**Problema Actual:**
```typescript
await Promise.all(
  missingProductIds.map(async (productId) => {
    try {
      const product = await productsApi.getProductById(productId);  // ❌ V1 - Sin caché
      logger.info(
        `✅ Fetched product: ${product.id} - ${product.title || product.sku}`
      );
      productsMap[productId] = product;
    } catch (error) {
      logger.error(`❌ Error fetching product ${productId}:`, error);
    }
  })
);
```

**Problema:**
- Hace múltiples llamadas individuales sin caché
- No aprovecha el batch loading
- Puede ser lento con muchos productos

**Solución Propuesta:**
Crear un nuevo endpoint V2 para obtener múltiples productos por IDs:
```typescript
// En productsApi
getProductsByIdsV2: async (ids: string[], includePhotos = true): Promise<Product[]> => {
  return apiClient.post('/admin/products/v2/batch', {
    ids,
    includePhotos
  });
}
```

O usar búsqueda V2 con filtros:
```typescript
// Cargar todos los productos de una vez con v2
const response = await productsApi.getProductsV2({
  limit: 1000,
  includePhotos: true,
});

// Crear mapa de productos
const productsMap = {};
response.products.forEach(product => {
  productsMap[product.id] = product;
});
```

**Beneficios:**
- ✅ **Caché Redis** reduce llamadas al DB
- ✅ **Batch loading** más eficiente
- ✅ **Incluye fotos** automáticamente

**Impacto:** 🔥 **ALTO** - Mejora significativa en tiempo de carga de campañas

---

#### 3. **Actualización de Costo de Producto** (`src/screens/Campaigns/CampaignDetailScreen.tsx`)
**Líneas 1254**

**Problema Actual:**
```typescript
await productsApi.updateProduct(productId, { costCents });  // ❌ No invalida caché V2
```

**Problema:**
- Actualiza el producto pero no invalida el caché de V2
- Los cambios pueden no reflejarse inmediatamente en búsquedas

**Solución Propuesta:**
```typescript
await productsApi.updateProduct(productId, { costCents });

// Invalidar caché V2 para reflejar cambios inmediatamente
await productsApi.invalidateProductsCacheV2();
```

**Beneficios:**
- ✅ **Consistencia de datos** entre V1 y V2
- ✅ **Cambios inmediatos** en búsquedas

**Impacto:** 🟡 **MEDIO** - Mejora la consistencia de datos

---

### **MEDIA PRIORIDAD** 🟡

#### 4. **Autocomplete de Productos en Transferencias** (`src/components/Transfers/ProductAutocomplete.tsx`)
**Líneas 44-50**

**Problema Actual:**
```typescript
// Filtrado local en memoria
const filtered = products.filter(
  (product) =>
    product.title.toLowerCase().includes(query) ||
    product.sku.toLowerCase().includes(query) ||
    product.barcode?.toLowerCase().includes(query) ||
    (product.correlativeNumber && product.correlativeNumber.toString().includes(searchQuery))
);
```

**Problema:**
- Requiere cargar TODOS los productos en memoria primero
- Filtrado local no es eficiente con miles de productos
- No aprovecha Full-Text Search del backend

**Solución Propuesta:**
Cambiar a búsqueda en tiempo real con V2:
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
const [isSearching, setIsSearching] = useState(false);

// Debounced search
useEffect(() => {
  const searchProducts = async () => {
    if (searchQuery.trim() === '') {
      setFilteredProducts([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await productsApi.searchProductsV2({
        q: searchQuery,
        limit: 10,
        includePhotos: true,
      });
      setFilteredProducts(response.results);
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const timer = setTimeout(searchProducts, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);
```

**Beneficios:**
- ✅ **No requiere cargar todos los productos** en memoria
- ✅ **Búsqueda más rápida** con Full-Text Search
- ✅ **Escalable** a decenas de miles de productos
- ✅ **Incluye fotos** en resultados

**Impacto:** 🟡 **MEDIO** - Mejora rendimiento en transferencias con muchos productos

---

### **BAJA PRIORIDAD** 🟢

#### 5. **Hook useProducts** - Método `getProductById`
**Archivo:** `src/hooks/api/useProducts.ts` (Línea 47)

**Estado Actual:**
```typescript
queryFn: () => productsApi.getProductById(id),  // ❌ V1 sin caché
```

**Nota:** Este método se usa para obtener detalles de UN producto específico. El endpoint V2 está optimizado para búsquedas y listados, no para obtener por ID. **No es necesario migrar** a menos que se cree un endpoint específico `/admin/products/v2/:id` con caché.

**Recomendación:** ⏸️ **Mantener V1** - El endpoint actual es adecuado para este caso de uso.

---

## 📋 Endpoints V2 Disponibles (Referencia)

### Admin Endpoints
1. ✅ `GET /admin/products/v2/search` - Búsqueda optimizada con FTS
2. ✅ `GET /admin/products/v2/list` - Listado paginado
3. ✅ `GET /admin/products/v2/count` - Conteo cacheado
4. ✅ `DELETE /admin/products/v2/cache` - Invalidar caché

### Public Endpoints
5. ✅ `GET /catalog/products/v2/search` - Búsqueda pública
6. ✅ `GET /catalog/products/v2/list` - Listado público

---

## 🎯 Plan de Acción Recomendado

### Fase 1: Alta Prioridad (Inmediato)
1. ✅ **Migrar `transmisionesApi.searchProducts()`** a V2
2. ✅ **Migrar `transmisionesApi.getProductByCode()`** a V2
3. ✅ **Agregar invalidación de caché** después de `updateProduct()`

### Fase 2: Media Prioridad (Corto plazo)
4. ⏳ **Optimizar carga de productos** en `CampaignDetailScreen`
5. ⏳ **Migrar ProductAutocomplete** a búsqueda en tiempo real V2

### Fase 3: Mejoras Futuras (Opcional)
6. 💡 Crear endpoint `/admin/products/v2/batch` para carga por IDs
7. 💡 Crear endpoint `/admin/products/v2/:id` con caché para detalles

---

## 📊 Métricas Esperadas

### Antes de Migración
- ⏱️ Búsqueda de productos: **500-1000ms** (sin caché)
- 💾 Carga de memoria: **Alta** (todos los productos en RAM)
- 🔄 Escalabilidad: **Limitada** (< 10,000 productos)

### Después de Migración
- ⚡ Búsqueda de productos: **50-150ms** (con caché Redis)
- 💾 Carga de memoria: **Baja** (solo resultados necesarios)
- 🚀 Escalabilidad: **Excelente** (> 100,000 productos)

---

## 🔧 Archivos a Modificar

### Alta Prioridad
1. `src/services/api/transmisiones.ts` - Migrar métodos de búsqueda
2. `src/screens/Campaigns/CampaignDetailScreen.tsx` - Optimizar carga y agregar invalidación

### Media Prioridad
3. `src/components/Transfers/ProductAutocomplete.tsx` - Búsqueda en tiempo real

---

## ✅ Conclusión

**Total de oportunidades identificadas:** 5

- 🔴 **Alta prioridad:** 3 (Transmisiones, CampaignDetail, Invalidación de caché)
- 🟡 **Media prioridad:** 1 (ProductAutocomplete)
- 🟢 **Baja prioridad:** 1 (useProducts - no requiere cambios)

**Impacto estimado:** Mejora del **60-80%** en rendimiento de búsquedas y listados de productos en las áreas migradas.

**Tiempo estimado de implementación:** 2-4 horas para alta prioridad, 1-2 horas para media prioridad.

---

## 📝 Notas Adicionales

- Todos los endpoints V2 soportan el parámetro `includePhotos` para optimizar transferencia de datos
- El caché Redis tiene TTL de 5 minutos (configurable en backend)
- La invalidación de caché debe llamarse después de cualquier operación CUD (Create, Update, Delete)
- Los endpoints V2 incluyen métricas de rendimiento (`searchTime`, `cached`) útiles para debugging

---

**Fecha de auditoría:** 2024
**Versión del sistema:** Frontend Admin Joanis
**Endpoints V2 implementados:** Backend ya tiene todos los endpoints necesarios
