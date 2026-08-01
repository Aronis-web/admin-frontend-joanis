<!-- METADATA
name: stock transfers batch
overview: Reemplazar en el autocomplete de Traslados el endpoint de stock por producto (roto) por el buscador inteligente de Campanias (/admin/inventory/products/stock), que ya devuelve productos con stock consolidado y filtrado por la sede activa via X-Site-Id.
-->

# Traslados: usar el buscador inteligente de stock de Campanias

## Diagnostico (verificado contra backend con `admin@example.com`)

- Hoy `ProductAutocomplete` de Traslados hace dos llamadas por keystroke:
  1. `productsApi.searchProductsV2({ q })` para buscar productos.
  2. Por cada producto: `inventoryApi.getStockByProductWithAreas(productId)` (`GET /inventory/stock/product/:productId`).

  Ese segundo endpoint **devuelve vacio** para el tenant real, por eso no se ve stock ni ubicaciones.

- Campanias usa el **buscador inteligente**: [`inventoryApi.getProductsStock`](src/services/api/inventory.ts#L420) -> `GET /admin/inventory/products/stock`. Devuelve productos con su stock consolidado y respeta `X-Site-Id`, o sea que ya limita a los almacenes/areas de la sede seleccionada en el login.

  Respuesta verificada (`q=cielo` con sede AREQUIPA):

  ```json
  {
    "data": [{
      "productId": "...", "sku": "Mer-cie", "name": "CIELO RAZO...",
      "totalStock": 500, "availableStock": 500, "reservedStock": 0,
      "warehouses": [{
        "warehouseId": "...", "warehouseName": "Principal ", "warehouseCode": "ARQ",
        "siteCode": "AREQUIPA", "totalStock": 500, "reservedStock": 0, "availableStock": 500,
        "areas": [{
          "areaId": "...", "areaCode": "GENERAL", "areaName": "Area general",
          "totalStock": 500, "reservedStock": 0, "availableStock": 500
        }]
      }]
    }],
    "meta": { "page": 1, "limit": 3, "totalItems": 1, ... }
  }
  ```

## Cambios

### 1) [`src/components/Transfers/ProductAutocomplete.tsx`](src/components/Transfers/ProductAutocomplete.tsx)

Reemplazar `searchProductsV2 + getStockByProductWithAreas` por una sola llamada al buscador inteligente y adaptar la respuesta al shape que ya consume el UI (`stockItems: StockItemResponse[]` con `warehouse`/`area` anidados y `availableQuantityBase/reservedQuantityBase/quantityBase`).

```ts
const response = await inventoryApi.getProductsStock({
  q: searchQuery,
  limit: 10,
  includeZeroStock: true,
});

const productsWithStock = (response.data || []).map((item) => ({
  id: item.productId,
  correlativeNumber: item.correlativeNumber,
  sku: item.sku,
  title: item.name,
  status: item.status,
  // Aplanar warehouses[].areas[] al shape StockItemResponse[]
  stockItems: item.warehouses.flatMap((w) =>
    w.areas.map((a) => ({
      productId: item.productId,
      warehouseId: w.warehouseId,
      areaId: a.areaId,
      quantityBase: a.totalStock,
      reservedQuantityBase: a.reservedStock,
      availableQuantityBase: a.availableStock,
      warehouse: { id: w.warehouseId, name: w.warehouseName, code: w.warehouseCode },
      area: { id: a.areaId, name: a.areaName, code: a.areaCode },
    }))
  ),
})) as unknown as Product[];

setFilteredProducts(productsWithStock);
```

Notas:
- El backend ya filtra por `X-Site-Id` (header global inyectado por `apiClient`), no hace falta pasar `siteId` explicito ni filtrar en cliente.
- Ya no se necesita `Promise.all` de N llamadas: **1 request por busqueda** en lugar de 1 + N.
- El shape aplanado calza 1:1 con lo que consume el UI de traslados (`stockItem.warehouse?.name`, `stockItem.area?.name`, `availableQuantityBase`, `reservedQuantityBase`, `quantityBase`, `warehouseId`, `areaId`).

### 2) [`src/screens/Transfers/ExternalTransfersScreen.tsx`](src/screens/Transfers/ExternalTransfersScreen.tsx)

Eliminar el filtro cliente por `siteId` que no funciona (la respuesta consolidada no incluye `warehouse.siteId` y el backend ya filtro por sede):

- L418: quitar `product.stockItems?.filter((stockItem) => (stockItem.warehouse as any)?.siteId === effectiveSite?.id)` -> usar `product.stockItems` directo.
- L978: idem, quitar el `.filter(...)`.

### 3) [`src/screens/Transfers/InternalTransfersScreen.tsx`](src/screens/Transfers/InternalTransfersScreen.tsx)

Sin cambios adicionales; ya consume `product.stockItems` sin filtro, y ahora vendran solo los de la sede activa.

### 4) Cleanup opcional (no bloqueante)

- Marcar `inventoryApi.getStockByProductWithAreas` como deprecated si no lo usa nadie mas (buscar usos primero).

## Validacion

- Login con `admin@example.com` (sede AREQUIPA). En Traslado Interno y Traslado Externo, buscar "cielo" u otro producto y verificar que aparece stock disponible con la ubicacion `Principal / Area general`.
- Cambiar de sede a una sin stock y confirmar que el buscador no muestra ubicaciones.
- `npm run typecheck`.

## Fuera de alcance

- No se refactoriza `AddProductScreen.tsx` (Campanias) — ya usa `getProductsStock` correctamente.
- No se toca `/inventory/stock` ni sus tipos.
