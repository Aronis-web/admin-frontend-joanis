/**
 * Búsqueda inteligente + paginación de los listados de Post venta, y búsqueda
 * puntual de un pedido por QR o número.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, useThemedStyles } from '@/design-system';
import { usePostsalePage } from '@/hooks/api/useChatbotPostsale';
import {
  chatbotPostsaleApi,
  type PostsaleOrder,
  type PostsaleStatus,
} from '@/services/api/chatbot-postsale';
import { PageControls } from '../components/PageControls';
import { createPostsaleStyles } from './shared';

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

/**
 * Paginación fija al pie. Renderizar fuera del ScrollView (prop `footer` de
 * `PostsaleShell`): eleva los botones flotantes para que no la tapen.
 */
export const Pager: React.FC<{ paged: PagedOrders }> = ({ paged }) => (
  <PageControls
    total={paged.total}
    page={paged.page}
    pageSize={paged.pageSize}
    count={paged.items.length}
    busy={paged.query.isFetching}
    onPage={paged.setPage}
  />
);

/** Texto escaneado de un sticker (QR cifrado `GP1.…` o formato antiguo `GRITPED:…`). */
export const looksLikeOrderCode = (text: string): boolean => /^(GP1\.|GRITPED:)/i.test(text.trim());

/**
 * Busca un pedido por el texto escaneado de su sticker o por número de pedido,
 * y devuelve además el bulto escaneado. El QR es un token cifrado: la app no lo
 * interpreta, el backend lo resuelve (`/resolve`). Con `statuses` solo considera
 * pedidos en esos estados. Si el código es inválido lanza el error del backend.
 */
export const lookupOrderWithPackage = async (
  raw: string,
  statuses?: PostsaleStatus[]
): Promise<{ order: PostsaleOrder | null; packageNo: number | null }> => {
  const text = raw.trim();
  if (!text) return { order: null, packageNo: null };
  if (looksLikeOrderCode(text)) {
    const resolved = await chatbotPostsaleApi.resolve(text);
    const order = await lookupOrderById(resolved.orderId, statuses, text);
    return { order, packageNo: resolved.packageNo ?? null };
  }
  const res = await chatbotPostsaleApi.listPage({ statuses, q: text, page: 1, pageSize: 5 });
  const items = res.items ?? [];
  const norm = text.replace(/^#/, '').toUpperCase();
  const order =
    items.find((o) => o.orderNo.replace(/^#/, '').toUpperCase() === norm) ??
    (items.length === 1 ? items[0] : null);
  return { order, packageNo: null };
};

/** Igual que `lookupOrderWithPackage`, solo el pedido. */
export const lookupOrder = async (
  raw: string,
  statuses?: PostsaleStatus[]
): Promise<PostsaleOrder | null> => (await lookupOrderWithPackage(raw, statuses)).order;

/** Fila del listado de un pedido por id (para refrescarlo). */
export const lookupOrderById = async (
  orderId: string,
  statuses?: PostsaleStatus[],
  /** Texto de búsqueda; el listado acepta el QR cifrado o el formato antiguo por id. */
  q = `GRITPED:${orderId}`
): Promise<PostsaleOrder | null> => {
  const res = await chatbotPostsaleApi.listPage({ statuses, q, page: 1, pageSize: 5 });
  return (res.items ?? []).find((o) => o.id === orderId) ?? null;
};
