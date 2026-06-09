<!--firebender-plan
name: cumplimiento campana participante
overview: Eliminar la columna "Venta esperada" del modal V2 y reemplazarla por un mapeo de cumplimiento acumulado: por participante mostramos cuánto del `assignedAmountCents` (esperado total de campaña) ya está cubierto sumando lo distribuido en productos previos + lo que aporta el producto actual con la edición en curso.
todos:
  - id: types
    content: "Extender ParticipantRowV2 con previousSaleCents, expectedTotalCents y campaignCoveragePercent"
  - id: hook-prev
    content: "En useDistributionFormV2.load(): calcular previousSaleCents por participante (Promise.all de salePrices de productos previos generados)"
  - id: hook-weight
    content: "Cambiar pesos de autoDistributeRest a max(0, expectedTotal - previousSale - currentSale) con fallback uniforme"
  - id: hook-derived
    content: "recomputeDerived: setear campaignCoveragePercent = (previousSale+currentSale)/expectedTotal*100"
  - id: table
    content: "Quitar columna expected, transformar realSale en venta acumulada + badge %campaña"
  - id: summary
    content: "Quitar suma de venta esperada y agregar contadores de cumplimiento (completos/en rango/bajos/sobre)"
  - id: verify
    content: "Lint + typecheck"
-->


## Objetivo

Quitar la columna **Venta esperada** (que hoy muestra el `assignedAmountCents` del participante a nivel campaña, lo cual era confuso por fila de producto) y mostrar en su lugar el **% de cumplimiento contra el monto esperado total de campaña**, acumulando:

- **previousSaleCents**: suma de lo ya distribuido a ese participante en OTROS productos de la campaña con `distributionGenerated=true` (calculado en cliente con `assignedQuantityBase` × precio de venta del perfil del participante para cada producto previo).
- **currentSaleCents**: `unitPriceCents × quantityBase` de este producto (lo que ya calculamos hoy como `realSaleCents`).
- **expectedTotalCents**: `participant.assignedAmountCents`.

Métricas mostradas por fila:
- `% campaña = (previousSale + currentSale) / expectedTotal * 100`
- delta y badge OK/warn/bad reusando `computeSaleStatus`.

Y en el `DistributionSummaryPanel` agregamos un mini-resumen global: cuántos participantes están **completos / en rango / sobre-asignados / sub-asignados**.

## Archivos a tocar

- `src/components/Campaigns/distribution-form-v2/types.ts`: agregar a `ParticipantRowV2` los campos `previousSaleCents`, `expectedTotalCents` y derivado `campaignCoveragePercent`. Quitamos uso de `expectedAmountCents` como "esperado del producto" (lo conservamos solo como peso para el auto-reparto).
- `src/components/Campaigns/distribution-form-v2/useDistributionFormV2.ts`:
  - Calcular `previousSaleCents` por participante al cargar (ver más abajo).
  - En `recomputeDerived`: setear `campaignCoveragePercent`.
  - El peso para `autoDistributeRest` cambia a "**gap pendiente**" = `max(0, expectedTotal - previousSale)` (en lugar de `assignedAmountCents` plano). Así el auto-reparto prioriza a quienes están más lejos del objetivo. Si no hay gaps (todos cubiertos), se cae a peso uniforme.
- `src/components/Campaigns/distribution-form-v2/ParticipantDistributionTable.tsx`:
  - Quitar columna `expected` ("Venta esp.").
  - Reemplazar columna `realSale` por una más rica: monto venta total acumulado (`previousSale + currentSale`) y debajo el badge `% campaña` contra el esperado.
  - Opcional pequeño tooltip/hint mostrando el desglose (prev vs current) si entra; si no, va al summary.
- `src/components/Campaigns/distribution-form-v2/DistributionSummaryPanel.tsx`:
  - Quitar la suma "Venta esperada".
  - Agregar bloque "**Cumplimiento campaña**" con contadores: `n completos (≥98%)`, `n en rango (90-98%)`, `n bajos (<90%)`, `n sobre (>102%)`.
- (No tocar el endpoint, todo se calcula en cliente).

## Cálculo de `previousSaleCents`

Usamos lo que ya viene cargado en `campaign.products[*].customDistributions[0].items[*]` (cuando `distributionGenerated=true` y `campaignProductId !== este producto`).

Por cada producto previo:
1. Necesitamos el **precio venta por perfil** para sus presentaciones. La forma más limpia: hacer `priceProfilesApi.getProductSalePrices(productId)` por cada producto previo en paralelo y cachear los resultados (`Promise.all` durante el load del modal, junto al fetch de salePrices del producto actual).
2. Para cada item de la distribución previa, multiplicar `assignedQuantityBase × pricePerBaseUnit(perfilDelParticipante, productoPrevio)`. Si falta precio o factor, marcar `priceWarning` y excluir ese tramo del acumulado (lo flaggeamos visualmente para que el usuario sepa que el cumplimiento es estimación parcial).

Suma todos esos parciales por `participantId` → `previousSaleCents` por fila.

Si por performance es excesivo (campañas con muchos productos), se puede degradar a "solo cantidad" mostrando un disclaimer; pero arrancamos con el cálculo completo y revisamos.

## UX

```
Participante  | Cajas | Med | Suelt | Total | Precio U. | Venta acum. (% camp.) | Costo | Util | Lock
Cliente X     |   3   |  0  |   2   |  62   |  S/ 12.50 |  S/ 1 230.00          |  ...  | ...  | 🔓
                                                              [ 87% ] (esp. S/1 400)
```

Y en el summary:

```
Cumplimiento campaña
  Completos (≥98%): 4
  En rango (90-98%): 3
  Bajos (<90%): 2
  Sobre (>102%): 0
```

## Edge cases

- Participante con `assignedAmountCents = 0`: `% = —` y badge gris "Sin esperado".
- Participante sin precio venta: badge gris "Sin precio" (igual que hoy).
- Producto previo sin precio del perfil: lo acumulamos parcialmente y al lado del % anotamos `~` (parcial).
- Si `distributionGenerated=false` en el producto actual, no descontamos nada de los productos previos (no hay doble conteo: en `previousSale` filtramos por `campaignProductId !== current.campaignProductId`).
