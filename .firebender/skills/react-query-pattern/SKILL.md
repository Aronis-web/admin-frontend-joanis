---
name: react-query-pattern
description: Cookbook de React Query v5 para este proyecto. Úsalo cuando agregues hooks de datos, mutations, invalidaciones, o cuando refactorices fetching que no use React Query. Patrón canónico extraído de useProducts.ts.
version: 1.0.0
---

# React Query · patrón canónico

Referencia viva: `src/hooks/api/useProducts.ts`.

## Query keys

Siempre objeto jerárquico:

```ts
export const fooKeys = {
  all: ['foos'] as const,
  lists: () => [...fooKeys.all, 'list'] as const,
  list: (filters?: FooFilters) => [...fooKeys.lists(), filters] as const,
  details: () => [...fooKeys.all, 'detail'] as const,
  detail: (id: string) => [...fooKeys.details(), id] as const,
};
```

## Query · lista

```ts
export const useFoos = (filters?: FooFilters) =>
  useQuery({
    queryKey: fooKeys.list(filters),
    queryFn: () => fooApi.getFoos(filters),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
```

## Query · detalle condicional

```ts
export const useFoo = (id: string, enabled = true) =>
  useQuery({
    queryKey: fooKeys.detail(id),
    queryFn: () => fooApi.getFooById(id),
    enabled: enabled && !!id,
    staleTime: 5 * 60 * 1000,
  });
```

## Mutation · create

```ts
export const useCreateFoo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFooDto) => fooApi.createFoo(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: fooKeys.lists() });
      qc.setQueryData(fooKeys.detail(created.id), created);
      logger.info('Foo creado', { id: created.id });
    },
    onError: (err) => logger.error('Error al crear foo', err),
  });
};
```

## Mutation · update

```ts
export const useUpdateFoo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFooDto }) =>
      fooApi.updateFoo(id, data),
    onSuccess: (updated, vars) => {
      qc.setQueryData(fooKeys.detail(vars.id), updated);
      qc.invalidateQueries({ queryKey: fooKeys.lists() });
    },
    onError: (err) => logger.error('Error al actualizar foo', err),
  });
};
```

## Mutation · delete

```ts
export const useDeleteFoo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fooApi.deleteFoo(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: fooKeys.detail(id) });
      qc.invalidateQueries({ queryKey: fooKeys.lists() });
    },
    onError: (err) => logger.error('Error al eliminar foo', err),
  });
};
```

## staleTime sugerido

- 3 min — datos volátiles (precios, stock).
- 5 min — entidades de negocio normales.
- 10 min — recursos casi estáticos (imágenes, catálogos pequeños).

## Anti-patrones

- ❌ `queryKey: ['foo', id]` suelto. Usar `fooKeys.detail(id)`.
- ❌ Olvidar invalidar listas en create/update/delete.
- ❌ `refetchOnWindowFocus: true` en listas grandes (mata UX en Electron/web).
- ❌ Llamar a `axios`/`fetch` desde el hook. Usar el servicio en `@/services/api`.
- ❌ Tragarse errores sin loguear con `logger`.
