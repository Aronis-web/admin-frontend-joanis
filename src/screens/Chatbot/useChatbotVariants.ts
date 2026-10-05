import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useProductVariants, productVariantKeys } from '@/hooks/api/useProductVariants';
import { productVariantsApi, ProductVariant } from '@/services/api/product-variants';

/**
 * Variantes de un producto para el selector del catalogo/cajon del bot.
 *
 * Regla del backend (hold y checkout): una variante con `tracksStock=true`
 * (no borrada) usa su propio saldo; sin variante, o variante descriptiva, usa
 * el saldo del producto. Por eso solo las variantes con stock propio se
 * ofrecen como dimension de stock.
 */
export const useStockVariants = (productId: string | null | undefined, selectedVariantId = '') => {
  const { data } = useProductVariants(productId ?? '', !!productId);
  return useMemo(() => {
    const all: ProductVariant[] = Array.isArray(data) ? data : [];
    const stockVariants = all.filter((v) => v.tracksStock && !v.deletedAt);
    const selected = selectedVariantId ? all.find((v) => v.id === selectedVariantId) : undefined;
    const selectedTracksStock = !!selected && selected.tracksStock && !selected.deletedAt;
    return {
      stockVariants,
      /** Variante elegida (puede ser descriptiva si la fila ya la tenia). */
      selectedVariant: selected ?? null,
      /** Dimension de stock efectiva: id de la variante con stock propio o null. */
      stockVariantId: selectedTracksStock ? selectedVariantId : null,
    };
  }, [data, selectedVariantId]);
};

/**
 * Nombre de cada variante usada en una lista de filas (productId + variantId),
 * para mostrar el color en el listado. Solo consulta productos con variante.
 */
export const useVariantNames = (
  rows: Array<{ productId: string; variantId: string | null }>
): Map<string, string> => {
  const productIds = useMemo(
    () => Array.from(new Set(rows.filter((r) => r.variantId).map((r) => r.productId))),
    [rows]
  );
  const results = useQueries({
    queries: productIds.map((productId) => ({
      queryKey: productVariantKeys.list(productId),
      queryFn: () => productVariantsApi.getVariants(productId),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });
  const dataKey = results.map((r) => r.dataUpdatedAt).join('|');
  return useMemo(() => {
    const map = new Map<string, string>();
    results.forEach((r) => {
      (r.data ?? []).forEach((v) => map.set(v.id, v.name));
    });
    return map;
    // `results` cambia de identidad en cada render; dataKey refleja sus datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);
};
