/**
 * Búsqueda inteligente + paginación de los listados de Post venta, y búsqueda
 * puntual de un pedido por QR o número.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button, Caption, useTheme, useThemedStyles } from '@/design-system';
import { usePostsalePage } from '@/hooks/api/useChatbotPostsale';
import {
  chatbotPostsaleApi,
  type PostsaleOrder,
  type PostsaleStatus,
} from '@/services/api/chatbot-postsale';
import { createPostsaleStyles, parseOrderQr } from './shared';

const SEARCH_DEBOUNCE_MS = 350;
export const DEFAULT_PAGE_SIZE = 20;

/** Listado paginado con búsqueda (debounce 350 ms; vuelve a la página 1 al buscar). */
export const usePagedOrders = (
  statuses?: PostsaleStatus[],
  options: { pageSize?: number; enabled?: boolean } = {}
) => {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // Al cambiar el filtro de estados se vuelve a la primera página.
  const statusKey = statuses?.join(',') ?? '';
  useEffect(() => {
    setPage(1);
  }, [statusKey]);

  const query = usePostsalePage({ statuses, q, page, pageSize }, options.enabled ?? true);
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  // Si la página quedó vacía (p. ej. se procesaron pedidos), retrocede una.
  useEffect(() => {
    if (!query.isFetching && page > 1 && query.data && query.data.items.length === 0) {
      setPage((p) => Math.max(1, p - 1));
    }
  }, [query.isFetching, query.data, page]);

  return { query, items, total, page, pageSize, setPage, search, setSearch, q };
};

export type PagedOrders = ReturnType<typeof usePagedOrders>;

/** Caja de búsqueda de un listado. */
export const OrderSearchBox: React.FC<{ paged: PagedOrders; placeholder?: string }> = ({
  paged,
  placeholder = 'Buscar por pedido, cliente, teléfono, dirección o producto',
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  return (
    <View style={styles.searchBox}>
      <Ionicons name="search" size={18} color={theme.color.text.muted} />
      <TextInput
        value={paged.search}
        onChangeText={paged.setSearch}
        placeholder={placeholder}
        placeholderTextColor={theme.color.text.muted}
        autoCorrect={false}
        style={styles.searchInput}
        returnKeyType="search"
      />
      {paged.query.isFetching ? (
        <ActivityIndicator size="small" color={theme.color.brand.accent} />
      ) : paged.search ? (
        <Ionicons
          name="close-circle"
          size={18}
          color={theme.color.text.muted}
          onPress={() => paged.setSearch('')}
          accessibilityLabel="Limpiar búsqueda"
        />
      ) : null}
    </View>
  );
};

/** Controles de página: anterior / siguiente + "X–Y de N". */
export const Pager: React.FC<{ paged: PagedOrders }> = ({ paged }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const { total, page, pageSize, items } = paged;
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + items.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return (
    <View style={styles.pager}>
      <Button
        title="Anterior"
        leftIcon="chevron-back"
        variant="outline"
        size="small"
        onPress={() => paged.setPage(Math.max(1, page - 1))}
        disabled={page <= 1 || paged.query.isFetching}
      />
      <Caption color={theme.color.text.muted}>
        {from}–{to} de {total}
      </Caption>
      <Button
        title="Siguiente"
        variant="outline"
        size="small"
        onPress={() => paged.setPage(Math.min(lastPage, page + 1))}
        disabled={page >= lastPage || paged.query.isFetching}
      />
    </View>
  );
};

/**
 * Busca un pedido por QR (`GRITPED:<uuid>`, exacto) o por número de pedido.
 * Con `statuses` solo considera pedidos en esos estados.
 */
export const lookupOrder = async (
  raw: string,
  statuses?: PostsaleStatus[]
): Promise<PostsaleOrder | null> => {
  const text = raw.trim();
  if (!text) return null;
  const res = await chatbotPostsaleApi.listPage({ statuses, q: text, page: 1, pageSize: 5 });
  const items = res.items ?? [];
  const id = parseOrderQr(text);
  const norm = text.replace(/^#/, '').toUpperCase();
  return (
    items.find(
      (o) => (id && o.id.toLowerCase() === id) || o.orderNo.replace(/^#/, '').toUpperCase() === norm
    ) ?? (items.length === 1 ? items[0] : null)
  );
};
