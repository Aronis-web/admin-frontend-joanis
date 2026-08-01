<!--firebender-plan
name: fix stocks traslados
overview: Al crear traslados no aparecen ni el nombre del almacén/área ni el stock disponible por ubicación porque `ProductAutocomplete` está poblando `product.stockItems` con la forma equivocada devuelta por `getStockByProduct` (que solo trae `warehouseName`/`areaName` planos y `quantityBase`).
todos:
  - id: fix-autocomplete
    content: "En ProductAutocomplete.tsx sustituir getStockByProduct por getStockByProductWithAreas y asignar el array directo a stockItems"
  - id: clean-logs
    content: "Eliminar console.log de debug en ProductAutocomplete (o migrar a logger.*)"
  - id: verify
    content: "Validar visualmente creación de traslado interno y externo con producto con stock"
-->

## Diagnóstico

### Flujo actual

- `InternalTransfersScreen` e `ExternalTransfersScreen` renderizan cada ubicación de origen leyendo:
  - `stockItem.warehouse?.name`
  - `stockItem.area?.name`
  - `stockItem.availableQuantityBase`, `stockItem.reservedQuantityBase`, `stockItem.quantityBase`
  - En externos además `stockItem.warehouse?.siteId` para filtrar por sede.
- Esos campos vienen del tipo `StockItemResponse` (`src/services/api/inventory.ts` L73-98) con objetos anidados `warehouse` y `area`.

### Bug

`ProductAutocomplete` ([src/components/Transfers/ProductAutocomplete.tsx](src/components/Transfers/ProductAutocomplete.tsx) L80-88) hace:

```ts
const stockResponse = await inventoryApi.getStockByProduct(product.id);
const stockItems = stockResponse?.stockByWarehouse || [];
return { ...product, stockItems };
```

`getStockByProduct` devuelve `StockByProductResponse.stockByWarehouse` cuya forma es plana (`inventory.ts` L100-112):

```ts
{ warehouseId, warehouseName, quantityBase, areaId?, areaName? }
```

No trae `warehouse.name`, `area.name`, `availableQuantityBase`, `reservedQuantityBase` ni `warehouse.siteId`. Resultado en el modal de crear traslado:

- "Almacén: Sin nombre"
- "Área: Sin área asignada"
- "Disponible: 0.00" (cae al `quantityBase` que sí existe, pero se pierden reservados)
- En traslados externos, el filtro por `warehouse.siteId` deja `currentSiteStockItems` vacío, mostrando "no tiene stock disponible en ninguna ubicación".

## Fix

Cambiar `ProductAutocomplete` para usar `inventoryApi.getStockByProductWithAreas(productId)`, que devuelve `StockItemResponse[]` con la forma exacta que consume la UI (`warehouse`, `area`, `availableQuantityBase`, `reservedQuantityBase`, `siteId`).

Edición en [src/components/Transfers/ProductAutocomplete.tsx](src/components/Transfers/ProductAutocomplete.tsx):

```ts
const stockItems = await inventoryApi.getStockByProductWithAreas(product.id);
return { ...product, stockItems };
```

Además:

- Ajustar `getProductStock` (L125-143) para que `warehouseId` filtre por almacén como ya lo hace (los campos coinciden).
- Limpiar los `console.log` de debug agregados en el fix previo (L61, L72, L82, L90) según convención (`logger.*` o eliminar).

## Verificación manual

- Abrir "Traslados Internos" → "Nuevo" → buscar un producto con stock.
- Verificar que cada tarjeta de ubicación muestre almacén, área, disponible, y reservado si corresponde.
- Repetir en "Traslados Externos": debe filtrar correctamente por la sede actual.

## Fuera de alcance

- Cambiar el endpoint del backend.
- Refactorizar otros consumidores de `getStockByProduct` (Sales/ProductSearchModal ya construye su propio `StockItemResponse`).
