/**
 * SmartPurchaseFamiliesScreen
 *
 * Lista de familias del grupo con:
 *   - filtros (estado, score mínimo, búsqueda),
 *   - paginación,
 *   - acciones de bloquear/desbloquear/editar/mover miembros vía FamilyDetailModal.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ProtectedView } from '@/components/ui/ProtectedView';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  ChipGroup,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { useDebounce } from '@/hooks/useDebounce';
import type { MainStackParamList } from '@/types/navigation';
import type { FamilyStatus, ProductFamily, QueryFamiliesDto } from '@/types/smartPurchase';
import { useFamilies } from '@/hooks/api/useSmartPurchase';
import {
  FAMILY_STATUS_COLOR,
  FAMILY_STATUS_LABEL,
  FAMILY_STATUS_OPTIONS,
  formatDateTime,
  safeFixed,
} from './helpers';
import { FamilyDetailModal } from './components/FamilyDetailModal';

type Props = NativeStackScreenProps<MainStackParamList, 'SmartPurchaseFamilies'>;

const PAGE_LIMIT = 25;

export const SmartPurchaseFamiliesScreen: React.FC<Props> = ({ navigation, route }) => {
  const { groupId } = route.params;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [status, setStatus] = useState<FamilyStatus | 'ALL'>('ALL');
  const [minScoreText, setMinScoreText] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [page, setPage] = useState(1);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | undefined>();

  const minScore = useMemo(() => {
    if (!minScoreText.trim()) return undefined;
    const n = Number(minScoreText);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }, [minScoreText]);

  const query: QueryFamiliesDto = useMemo(
    () => ({
      status: status === 'ALL' ? undefined : status,
      minScore,
      search: debouncedSearch || undefined,
      page,
      limit: PAGE_LIMIT,
    }),
    [status, minScore, debouncedSearch, page]
  );

  const { data, isLoading, isError, refetch, isRefetching } = useFamilies(groupId, query);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const handleFilterChange = useCallback((fn: () => void) => {
    fn();
    setPage(1);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ProductFamily }) => {
      const score = Number(item.score ?? 0) || 0;
      const scoreColor =
        score >= 70
          ? theme.color.text.success
          : score >= 40
            ? theme.color.text.warning
            : theme.color.text.muted;

      return (
        <Card style={styles.card} onPress={() => setSelectedFamilyId(item.id)}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '600' }} numberOfLines={2}>
                {item.title}
              </Body>
              <Caption color="muted">
                SKU {item.normalizedSku} · {item.memberCount} producto(s)
              </Caption>
            </View>
            <View style={styles.statusChip}>
              <View
                style={[styles.statusDot, { backgroundColor: FAMILY_STATUS_COLOR[item.status] }]}
              />
              <Body size="small" style={{ fontWeight: '600' }}>
                {FAMILY_STATUS_LABEL[item.status]}
              </Body>
            </View>
          </View>

          <View style={styles.rowFooter}>
            <View style={styles.scoreBox}>
              <Caption color="muted" style={{ fontSize: 10 }}>
                Score
              </Caption>
              <Body size="small" style={{ fontWeight: '700', color: scoreColor }}>
                {safeFixed(item.score, 1)}
              </Body>
            </View>
            {item.status === 'BLOCKED' && item.requiredDiscountPct !== null && (
              <Badge variant="warning" label={`Requiere ${item.requiredDiscountPct}% dscto`} />
            )}
            {item.source === 'MANUAL' && <Badge variant="info" label="Manual" />}
            <View style={{ flex: 1 }} />
            <Caption color="muted">Act. {formatDateTime(item.updatedAt)}</Caption>
          </View>
        </Card>
      );
    },
    [
      styles.card,
      styles.cardHeader,
      styles.statusChip,
      styles.statusDot,
      styles.rowFooter,
      styles.scoreBox,
      theme,
    ]
  );

  const renderEmpty = () => {
    if (isError) {
      return (
        <ErrorState
          title="No se pudieron cargar las familias"
          description="Reintenta en unos segundos."
          onRetry={() => refetch()}
        />
      );
    }
    if (!isLoading) {
      return (
        <EmptyState
          icon="albums-outline"
          title="Sin familias"
          description="Reconstruye familias desde el detalle del grupo o ajusta los filtros."
          actionLabel="Volver al grupo"
          onAction={() => navigation.goBack()}
        />
      );
    }
    return null;
  };

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={theme.color.text.body} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Title>Familias del grupo</Title>
            <Caption color="muted">
              {total > 0 ? `${total} familia(s) · ` : ''}
              Consolidación por SKU normalizado.
            </Caption>
          </View>
          <ProtectedView requiredPermissions={['smart_purchase.products.read']}>
            <Badge variant="default" label={`Pág. ${page}/${totalPages}`} />
          </ProtectedView>
        </View>

        <View style={styles.filters}>
          <Input
            leftIcon="search"
            placeholder="Buscar título o SKU..."
            value={search}
            onChangeText={(v) => handleFilterChange(() => setSearch(v))}
            autoCapitalize="none"
          />
          <View style={styles.filtersRow}>
            <View style={{ flex: 1 }}>
              <ChipGroup
                options={FAMILY_STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
                selected={[status]}
                onChange={(vals) =>
                  handleFilterChange(() => setStatus((vals[0] ?? 'ALL') as FamilyStatus | 'ALL'))
                }
              />
            </View>
            <View style={styles.scoreInput}>
              <Input
                placeholder="Score mín."
                keyboardType="number-pad"
                value={minScoreText}
                onChangeText={(v) => handleFilterChange(() => setMinScoreText(v))}
              />
            </View>
          </View>
        </View>

        {isLoading && !data ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.color.brand.primary} />
          </View>
        ) : (
          <FlatList
            data={data?.data ?? []}
            keyExtractor={(f) => f.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
            ListEmptyComponent={renderEmpty()}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme.color.brand.primary}
              />
            }
          />
        )}

        {total > PAGE_LIMIT && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={PAGE_LIMIT}
            onPageChange={setPage}
            loading={isLoading || isRefetching}
          />
        )}

        <FamilyDetailModal
          visible={!!selectedFamilyId}
          familyId={selectedFamilyId}
          groupId={groupId}
          onClose={() => setSelectedFamilyId(undefined)}
        />

        <ProtectedView requiredPermissions={['smart_purchase.orders.generate']}>
          <View style={styles.footerCta}>
            <Button
              title="Generar órdenes de este grupo"
              variant="primary"
              onPress={() => navigation.navigate('SmartPurchaseOrders', { groupId })}
              leftIcon="clipboard-outline"
            />
          </View>
        </ProtectedView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.color.background.canvas },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[6],
      paddingTop: spacing[4],
      paddingBottom: spacing[2],
    },
    filters: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[2],
      gap: spacing[2],
    },
    filtersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    scoreInput: {
      width: 110,
    },
    listContent: {
      paddingHorizontal: spacing[6],
      paddingTop: spacing[2],
      paddingBottom: spacing[8],
      flexGrow: 1,
    },
    card: { gap: spacing[2] },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.surface.subtle,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    rowFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    scoreBox: {
      minWidth: 70,
      padding: spacing[2],
      borderRadius: borderRadius.sm,
      backgroundColor: theme.color.surface.subtle,
      gap: 2,
    },
    footerCta: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[4],
      paddingTop: spacing[2],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
  });
