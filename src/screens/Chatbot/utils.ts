/**
 * Helpers compartidos del módulo Chatbot.
 */
import type { BadgeVariant } from '@/design-system';
import type { PurchaseStage } from '@/types/chatbot';
import type {
  Product,
  ProductAutocompleteItem,
  ProductPresentation,
  ProductSalePrice,
} from '@/services/api/products';

/** Etiqueta legible del estado de compra (embudo). */
export const PURCHASE_STAGE_LABEL: Record<PurchaseStage, string> = {
  NUEVO: 'Nuevo',
  EXPLORANDO: 'Explorando',
  NEGOCIANDO: 'Negociando',
  POR_PAGAR: 'Por pagar',
  EN_VALIDACION: 'En validación',
  COMPRADO: 'Comprado',
  POSTVENTA: 'Postventa',
  SOPORTE: 'Soporte',
  PERDIDO: 'Perdido',
};

/** Variante de Badge para cada estado de compra. */
export const PURCHASE_STAGE_VARIANT: Record<PurchaseStage, BadgeVariant> = {
  NUEVO: 'info',
  EXPLORANDO: 'default',
  NEGOCIANDO: 'primary',
  POR_PAGAR: 'warning',
  EN_VALIDACION: 'pending',
  COMPRADO: 'success',
  POSTVENTA: 'active',
  SOPORTE: 'danger',
  PERDIDO: 'cancelled',
};

/** Lista ordenada de estados para renderizar filtros. */
export const PURCHASE_STAGES: PurchaseStage[] = [
  'NUEVO',
  'EXPLORANDO',
  'NEGOCIANDO',
  'POR_PAGAR',
  'EN_VALIDACION',
  'COMPRADO',
  'POSTVENTA',
  'SOPORTE',
  'PERDIDO',
];

/** Convierte totalCents (bigint como string) a un string con formato de soles. */
export const formatSolesFromCents = (cents: string | null | undefined): string => {
  if (cents === null || cents === undefined || cents === '') return '-';
  const num = Number(cents) / 100;
  if (Number.isNaN(num)) return '-';
  try {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    return `S/ ${num.toFixed(2)}`;
  }
};

/**
 * Precio de venta real (en centavos) de una presentación del producto.
 * Busca en `Product.salePrices` la primera entrada que coincida con la
 * presentación; devuelve `null` si no hay precio configurado.
 */
export const getPresentationUnitPriceCents = (
  product: Product | null | undefined,
  presentationId: string
): number | null => {
  if (!product || !presentationId) return null;
  const sp = product.salePrices?.find(
    (p) => p.presentationId === presentationId && typeof p.priceCents === 'number'
  );
  return sp ? sp.priceCents : null;
};

/**
 * Combina el item del autocomplete (que SIEMPRE trae `presentations` con
 * `factorToBase` y `priceProfiles` con precios por presentación) dentro de un
 * objeto `Product`. `GET /admin/products/:id` puede no devolver
 * `presentations`/`salePrices`, así que aquí se prioriza el dato confiable del
 * buscador y se conserva lo demás de `full` (foto, título, stock, etc.).
 */
export const mergeAutocompleteIntoProduct = (
  item: ProductAutocompleteItem,
  full: Product | null | undefined
): Product => {
  const presentations: ProductPresentation[] = (item.presentations ?? []).map((p) => ({
    productId: item.id,
    presentationId: p.id,
    isBase: p.isBase,
    factorToBase: p.factorToBase,
    minOrderQty: 0,
    orderStep: 1,
    presentation: {
      id: p.id,
      code: p.code,
      name: p.name,
      isBase: p.isBase,
      createdAt: '',
      updatedAt: '',
    },
  }));

  const salePrices: ProductSalePrice[] = [];
  for (const profile of item.priceProfiles ?? []) {
    for (const price of profile.prices ?? []) {
      if (price.presentationId && typeof price.priceCents === 'number') {
        salePrices.push({
          productId: item.id,
          presentationId: price.presentationId,
          profileId: profile.profileId,
          priceCents: price.priceCents,
          currency: price.currency ?? full?.currency ?? 'PEN',
          isOverridden: price.isOverridden,
        });
      }
    }
  }

  return {
    ...(full ?? {}),
    id: item.id,
    title: full?.title ?? item.title,
    sku: full?.sku ?? item.sku,
    correlativeNumber: full?.correlativeNumber ?? item.correlativeNumber,
    barcode: full?.barcode ?? item.barcode ?? '',
    costCents: full?.costCents ?? item.costCents,
    currency: full?.currency ?? item.currency,
    photos: full?.photos ?? item.photos ?? [],
    presentations: presentations.length > 0 ? presentations : (full?.presentations ?? []),
    salePrices: salePrices.length > 0 ? salePrices : (full?.salePrices ?? []),
  } as Product;
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
};

export const formatRelative = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `hace ${days} d`;
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' });
};
