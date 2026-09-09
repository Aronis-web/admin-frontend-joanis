/**
 * useAllActiveSites
 *
 * Hook interno del módulo Compra Inteligente que trae **todas** las sedes
 * activas del tenant paginando automáticamente (auto-fetch de páginas
 * mientras `hasNextPage` sea true). El backend limita a 100 por página,
 * por eso no podemos pedir `limit=200`.
 *
 * Devuelve la lista concatenada, un helper `siteName(id)` y flags de estado.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import { sitesApi } from '@/services/api';
import type { Site } from '@/types/sites';

const PAGE_SIZE = 100;

export function useAllActiveSites(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;

  const query = useInfiniteQuery({
    queryKey: ['smart-purchase', 'all-active-sites'],
    queryFn: ({ pageParam = 1 }) =>
      sitesApi.getSites({
        isActive: true,
        page: pageParam as number,
        limit: PAGE_SIZE,
        orderBy: 'name',
        orderDir: 'ASC',
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const totalPages = last.meta?.totalPages ?? Math.ceil((last.meta?.total ?? 0) / PAGE_SIZE);
      const page = last.meta?.page ?? 1;
      return page < totalPages ? page + 1 : undefined;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
  });

  // Auto-cargar todas las páginas.
  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isLoading) {
      void query.fetchNextPage();
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.isLoading, query]);

  const sites: Site[] = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.data ?? []),
    [query.data]
  );

  const siteMap = useMemo(() => {
    const m = new Map<string, Site>();
    sites.forEach((s) => m.set(s.id, s));
    return m;
  }, [sites]);

  const siteName = useCallback(
    (id: string): string => siteMap.get(id)?.name ?? `Sede ${id.slice(0, 6)}`,
    [siteMap]
  );

  return {
    sites,
    siteMap,
    siteName,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching || query.isFetchingNextPage,
  };
}
