<!--firebender-plan
name: Grupos de fotos por referencia
overview: Reformar ProductPhotoManagerModal para soportar multiples grupos de referencia por producto (cada uno con su propio design y price via parentAssetId), usando el nuevo endpoint photo-groups, con grupos auto-numerados y un visor que permite pasar entre las fotos del grupo.
todos:
  - id: types
    content: "Ampliar tipos en photo-campaigns.ts (ProductPhotoAsset, requests, PhotoGroup)"
  - id: api
    content: "Agregar getProductPhotoGroups, deleteProductPhoto y campos parentAssetId/label/sortOrder en el servicio API"
  - id: store
    content: "Soportar parentAssetId y llaves por grupo en photoGeneration store"
  - id: modal-groups
    content: "Reformar ProductPhotoManagerModal a lista de grupos con reference/design/price por grupo y agregar/eliminar grupo"
  - id: viewer-pager
    content: "Convertir el visor de imagen en pager para pasar entre las fotos del grupo"
-->

## Contexto

Hoy el flujo asume **1 reference + 1 design + 1 price por producto** (`getPhotoByType` toma el primer activo de cada tipo). El backend ahora soporta **N grupos por producto**: cada `reference` es el ancla de un grupo y su `design`/`price` cuelgan via `parentAssetId`. Existe un endpoint nuevo `GET /products/:productId/photo-groups` que devuelve los grupos ya anidados.

Alcance: **solo `ProductPhotoManagerModal`** (usado desde `CampaignDetailScreen`). Grupos **auto-numerados** (Grupo 1, Grupo 2...). El visor de imagen ampliada debe **permitir pasar entre las fotos** del grupo.

## Cambios

### 1. Tipos — [src/types/photo-campaigns.ts](src/types/photo-campaigns.ts)
- Ampliar `ProductPhotoAsset` con `parentAssetId?: string | null`, `label?: string | null`, `sortOrder?: number`.
- Ampliar `UploadProductPhotoRequest` con `parentAssetId?`, `label?`, `sortOrder?`.
- Ampliar `GenerateAdDesignRequest` con `parentAssetId?`.
- Agregar `PhotoGroup`: `{ parentAssetId: string | null; label?: string | null; sortOrder?: number; reference: ProductPhotoAsset | null; design: ProductPhotoAsset | null; price: ProductPhotoAsset | null }`.

### 2. Servicio API — [src/services/api/photo-campaigns.ts](src/services/api/photo-campaigns.ts)
- `getProductPhotoGroups(productId)` → `GET .../products/:productId/photo-groups`.
- `deleteProductPhoto(productId, assetId)` → `DELETE .../products/:productId/photos/:assetId` (elimina grupo si es reference).
- En `uploadProductPhoto`: hacer `append` de `parentAssetId`, `label`, `sortOrder` cuando vengan.
- En `generateAdDesign`: hacer `append` de `parentAssetId`.

### 3. Store de generacion — [src/store/photoGeneration.ts](src/store/photoGeneration.ts)
- `generateDesign` y `generatePrice` aceptan `parentAssetId?` y lo pasan a `uploadProductPhoto`/`generateAdDesign`.
- Las banderas `generating` / `completedVersion` pasan a llavearse por **grupo** (`${productId}:${parentAssetId}`) en vez de solo por producto, para que cada grupo muestre su propio spinner.
- El "restore design" (subir design 3 veces) se conserva pero pasando `parentAssetId` para no afectar otros grupos.

### 4. Modal — [src/components/Photos/ProductPhotoManagerModal.tsx](src/components/Photos/ProductPhotoManagerModal.tsx)
Reforma principal:
- Reemplazar estado de fotos plano por **`groups: PhotoGroup[]`** cargado con `getProductPhotoGroups`; ordenar por `sortOrder`.
- Renderizar una **lista vertical de grupos**. Cada grupo = titulo auto ("Grupo N"), fila con las 3 tarjetas (Referencia / Diseño / Con precio) reutilizando `renderPhotoCard`, botones por grupo "Generar diseño" / "Agregar datos", y accion **eliminar grupo** (borra el reference → cascada).
- Boton **"Agregar referencia"** al pie: dispara el flujo de recorte y sube un `reference` **sin** `parentAssetId` (nuevo grupo) con `sortOrder` incremental; luego el usuario agrega design/price dentro de ese grupo (upload con `parentAssetId = group.reference.id`).
- Diseño/precio: el generar/subir dentro de un grupo pasa siempre `parentAssetId` del reference del grupo.
- Compatibilidad: un grupo con `parentAssetId: null` (grupo por defecto historico) se muestra como un grupo mas.
- Header: el contador "Fotos: x/3" pasa a mostrar cantidad de grupos (ej. "Grupos: N").

### 5. Visor de imagen — dentro del mismo modal
- Convertir el visor a **pager**: al ampliar una miniatura se abre con la lista ordenada de fotos del grupo (reference → design → price) y se puede **pasar** entre ellas (swipe horizontal / flechas prev-next), conservando pinch-zoom actual. Se abre posicionado en la foto tocada.

## Notas
- No se toca `PhotoCampaignManagementScreen` ni `campaignPhotosPdf.ts` (fuera de alcance).
- Sin nombres de grupo manuales: `label` se deja vacio/omitido; la numeracion es de UI.
- Commit + push tras cada cambio funcional (regla dura del repo).
