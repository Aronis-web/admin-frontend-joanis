# 📸 Actualización de Fotos en Miniaturas - Resumen

## ✅ Problema Resuelto

**Problema:** Las fotos se veían en el detalle del producto pero NO en las miniaturas de la lista de productos.

**Causa:**
1. El hook `useProducts` usaba el endpoint v1 (`getAllProducts`) que no incluía el parámetro `includePhotos`
2. El componente `ProductsScreen` no priorizaba el campo `photos` sobre `imageUrl`
3. El delay de búsqueda era muy corto (500ms), causando búsquedas prematuras

---

## 📝 Cambios Realizados

### 1. **Hook `useProducts` Migrado a V2**

**Archivo:** `src/hooks/api/useProducts.ts`

**Antes:**
```typescript
export const useProducts = (filters?: ProductFilters) => {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () => productsApi.getAllProducts(filters), // ❌ Endpoint v1
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
```

**Después:**
```typescript
export const useProducts = (filters?: ProductFilters) => {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () => {
      // ✅ Usar endpoint v2 optimizado con fotos
      return productsApi.getProductsV2({
        page: filters?.page,
        limit: filters?.limit,
        categoryId: filters?.categoryId,
        status: filters?.status,
        q: filters?.q,
        includePhotos: true, // ✅ Incluir fotos para miniaturas
      });
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
```

---

### 2. **ProductsScreen - Priorizar Campo `photos`**

**Archivo:** `src/screens/Inventory/ProductsScreen.tsx`

**Antes:**
```typescript
const hasImage =
  product.imageUrl || (product.imageUrls && product.imageUrls.length > 0);
const imageUri = product.imageUrl || product.imageUrls?.[0];
```

**Después:**
```typescript
// ✅ Priorizar photos (v2) sobre imageUrl/imageUrls
const hasImage =
  (product.photos && product.photos.length > 0) ||
  product.imageUrl ||
  (product.imageUrls && product.imageUrls.length > 0);
const imageUri =
  product.photos?.[0] || product.imageUrl || product.imageUrls?.[0];
```

**Beneficio:** Ahora usa las URLs optimizadas del backend v2 primero.

---

### 3. **Delay de Búsqueda Aumentado**

**Archivo:** `src/screens/Inventory/ProductsScreen.tsx`

**Antes:**
```typescript
debounceTimerRef.current = setTimeout(() => {
  setDebouncedSearchQuery(searchQuery);
  if (searchQuery !== debouncedSearchQuery) {
    setPage(1);
  }
}, 500); // 500ms de delay
```

**Después:**
```typescript
debounceTimerRef.current = setTimeout(() => {
  setDebouncedSearchQuery(searchQuery);
  if (searchQuery !== debouncedSearchQuery) {
    setPage(1);
  }
}, 800); // 800ms de delay (aumentado para permitir escribir)
```

---

### 4. **API - Parámetro `includePhotos` Agregado**

**Archivo:** `src/services/api/products.ts`

Se agregó el parámetro `includePhotos` a todos los métodos de listado v2:

```typescript
// ✅ getProductsV2
getProductsV2: async (params?: {
  page?: number;
  limit?: number;
  categoryId?: string;
  status?: string;
  q?: string;
  includePhotos?: boolean; // ✅ NUEVO
})

// ✅ getProductsPublicV2
getProductsPublicV2: async (params?: {
  page?: number;
  limit?: number;
  categoryId?: string;
  q?: string;
  includePhotos?: boolean; // ✅ NUEVO
})
```

---

## 🎯 Archivos Modificados (Resumen Completo)

### Búsqueda de Productos (Cambios Anteriores)
1. ✅ `src/components/Transmisiones/AddProductModal.tsx`
   - Delay: 500ms → 800ms
   - Agregado `includePhotos: true`
   - Agregado componente `Image` para miniaturas
   - Estilos para `resultImage`

2. ✅ `src/screens/Campaigns/AddProductScreen.tsx`
   - Delay: 300ms → 800ms
   - Agregado `includePhotos: true`
   - Priorizar `photos` sobre `imageUrl`

3. ✅ `src/components/Transmisiones/TransmisionProductsList.tsx`
   - Delay: 500ms → 800ms
   - Agregado `includePhotos: true`

### Lista de Productos (Cambios Nuevos)
4. ✅ `src/screens/Inventory/ProductsScreen.tsx`
   - Delay: 500ms → 800ms
   - Priorizar `photos` sobre `imageUrl/imageUrls`
   - Logs mejorados para debugging

5. ✅ `src/hooks/api/useProducts.ts`
   - Migrado de `getAllProducts` a `getProductsV2`
   - Agregado `includePhotos: true`

6. ✅ `src/services/api/products.ts`
   - Agregado parámetro `includePhotos` a `getProductsV2`
   - Agregado parámetro `includePhotos` a `getProductsPublicV2`
   - Agregado campo `photos?: string[]` a interface `Product`

---

## 🔄 Flujo Completo

### Lista de Productos (ProductsScreen)

```
Usuario abre ProductsScreen
       ↓
useProducts hook se ejecuta
       ↓
Llama a productsApi.getProductsV2({
  page: 1,
  limit: 20,
  includePhotos: true  // ✅ Incluir fotos
})
       ↓
Backend retorna:
{
  "products": [
    {
      "id": "uuid-123",
      "sku": "AGUA-500",
      "title": "Agua Mineral",
      "photos": [  // ✅ URLs de fotos
        "http://localhost:3000/public/catalog/productos/imagenes/uuid-123/foto1.jpg"
      ]
    }
  ]
}
       ↓
ProductsScreen renderiza:
- Prioriza product.photos[0]
- Fallback a product.imageUrl
- Fallback a product.imageUrls[0]
- Si no hay imagen: placeholder 📦
       ↓
✅ Miniatura se muestra correctamente
```

### Búsqueda de Productos

```
Usuario escribe "agua"
       ↓
Debounce 800ms
       ↓
searchProductsV2({
  q: "agua",
  limit: 20,
  includePhotos: true  // ✅ Incluir fotos
})
       ↓
Backend retorna productos con photos[]
       ↓
✅ Miniaturas se muestran en resultados
```

---

## 🎨 Prioridad de Imágenes

En todos los componentes, ahora se usa esta prioridad:

1. **`product.photos[0]`** - URLs del endpoint v2 (máxima prioridad)
2. **`product.imageUrl`** - URL principal (fallback)
3. **`product.imageUrls[0]`** - Primera imagen del array (fallback)
4. **Placeholder** - Icono 📦 si no hay imagen

---

## 📊 Comparación Antes/Después

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Lista de productos** | ❌ Sin fotos | ✅ Con fotos |
| **Búsqueda de productos** | ❌ Sin fotos | ✅ Con fotos |
| **Endpoint usado (lista)** | v1 (`getAllProducts`) | v2 (`getProductsV2`) |
| **Delay de búsqueda** | 300-500ms | 800ms |
| **Campo de imagen** | `imageUrl`, `imageUrls` | `photos` (prioridad) |
| **Caché** | 5 min (React Query) | 5 min (React Query + Redis) |

---

## 🧪 Cómo Verificar

### 1. Lista de Productos (ProductsScreen)

```
1. Ir a Inventario > Productos
2. Verificar que las miniaturas se muestran
3. Abrir consola y buscar logs:
   🖼️ Product image check: {
     photos: ["http://..."],
     imageUrl: "...",
     imageUri: "http://..."
   }
4. Verificar que usa photos[0] si está disponible
```

### 2. Búsqueda de Productos

```
1. Ir a Transmisiones > Agregar Producto
2. Buscar "agua"
3. Verificar miniaturas en resultados
4. Verificar logs:
   📦 Products found: 5 products
   ⚡ Search time: 45 ms
   💾 Cached: false
```

### 3. Verificar Prioridad de Imágenes

```
1. Producto con photos[] → Debe usar photos[0]
2. Producto sin photos pero con imageUrl → Debe usar imageUrl
3. Producto sin photos ni imageUrl → Debe mostrar 📦
```

---

## 🚨 Notas Importantes

### Backend Debe Retornar `photos`

El backend debe incluir el campo `photos` cuando `includePhotos=true`:

```json
{
  "products": [
    {
      "id": "uuid-123",
      "sku": "AGUA-500",
      "title": "Agua Mineral",
      "photos": [  // ✅ Este campo debe existir
        "http://localhost:3000/public/catalog/productos/imagenes/uuid-123/foto1.jpg",
        "http://localhost:3000/public/catalog/productos/imagenes/uuid-123/foto2.jpg"
      ]
    }
  ]
}
```

### Compatibilidad

- ✅ **Backward compatible**: Si `photos` no existe, usa `imageUrl` o `imageUrls`
- ✅ **Funciona sin fotos**: Muestra placeholder si no hay imágenes
- ✅ **Funciona con endpoint v1**: Fallback a `imageUrl/imageUrls`

---

## 📈 Beneficios

1. ✅ **Miniaturas en lista de productos** - Mejor UX
2. ✅ **Miniaturas en búsqueda** - Identificación visual rápida
3. ✅ **Endpoint v2 optimizado** - Caché Redis + Full-Text Search
4. ✅ **Delay aumentado** - Mejor experiencia al escribir
5. ✅ **URLs optimizadas** - Backend controla las URLs de imágenes
6. ✅ **Logs mejorados** - Debugging más fácil

---

## 🎯 Próximos Pasos

- ✅ Probar en desarrollo
- ✅ Verificar que las fotos se cargan correctamente
- ✅ Monitorear logs de errores de carga de imágenes
- ⏳ Implementar lazy loading para imágenes (opcional)
- ⏳ Agregar placeholder animado mientras carga (opcional)

---

**Fecha:** 2024
**Versión:** 1.0
**Estado:** ✅ Completado - Listo para testing
