/**
 * SmartPurchaseGroupsScreen
 *
 * Entry point del módulo Compra Inteligente. Lista todos los grupos de compra
 * inteligente configurados (proveedores + parámetros de cobertura/lead time).
 *
 * Desde aquí el usuario:
 *   - Crea un grupo nuevo (con proveedores iniciales opcionales).
 *   - Entra al detalle del grupo, donde puede analizar cada proveedor.
 *   - Va a las órdenes sugeridas o ranking de proveedores.
 */
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import {
  Badge,
  Body,
  Caption,
  Card,
  EmptyState,
  ErrorState,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import type { MainStackParamList } from '@/types/navigation';
import type { SmartPurchaseGroup, SmartPurchaseGroupWithSuppliers } from '@/types/smartPurchase';
import { useSmartPurchaseGroups } from '@/hooks/api/useSmartPurchase';
import { formatDateTime } from './helpers';
import { GroupFormModal } from './components/GroupFormModal';

type Props = NativeStackScreenProps<MainStackParamList, 'SmartPurchaseGroups'>;

export const SmartPurchaseGroupsScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [formVisible, setFormVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SmartPurchaseGroupWithSuppliers | undefined>();

  const { data: groups, isLoading, isError, refetch, isRefetching } = useSmartPurchaseGroups();

  const handleOpenGroup = useCallback(
    (group: SmartPurchaseGroup) => {
      navigation.navigate('SmartPurchaseGroupDetail', { groupId: group.id });
    },
    [navigation]
  );

  const renderGroup = ({ item }: { item: SmartPurchaseGroup }) => (
    <Card onPress={() => handleOpenGroup(item)} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Title size="small">{item.name}</Title>
          <Caption color="muted">Actualizado {formatDateTime(item.updatedAt)}</Caption>
        </View>
        <Badge
          variant={item.isEnabled ? 'success' : 'default'}
          label={item.isEnabled ? 'Activo' : 'Deshabilitado'}
        />
      </View>

      <View style={styles.metricsRow}>
        <MetricPill icon="people-outline" label="Proveedores" value={String(item.supplierCount)} />
        <MetricPill icon="calendar-outline" label="Cobertura" value={`${item.coverageDays}d`} />
        <MetricPill icon="time-outline" label="Lead" value={`${item.leadTimeDays}d`} />
        <MetricPill
          icon="shield-checkmark-outline"
          label="Seguridad"
          value={`${item.safetyDays}d`}
        />
      </View>

      {item.notes ? (
        <Body size="small" color="muted" numberOfLines={2} style={styles.notes}>
          {item.notes}
        </Body>
      ) : null}
    </Card>
  );

  const listContent = () => {
    if (isError) {
      return (
        <ErrorState
          title="No se pudieron cargar los grupos"
          description="Reintenta en unos segundos."
          onRetry={() => refetch()}
        />
      );
    }
    if (!isLoading && (!groups || groups.length === 0)) {
      return (
        <EmptyState
          icon="people-outline"
          title="Aún no tienes grupos"
          description="Crea tu primer grupo de compra inteligente para analizar proveedores y generar órdenes sugeridas."
          actionLabel="Crear grupo"
          onAction={() => {
            setEditingGroup(undefined);
            setFormVisible(true);
          }}
        />
      );
    }
    return null;
  };

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <Title>Compra Inteligente</Title>
          <Caption color="muted">
            Grupos de compra por política. Selecciona uno para analizar sus proveedores y generar
            órdenes.
          </Caption>
        </View>

        <FlatList
          data={groups ?? []}
          keyExtractor={(g) => g.id}
          renderItem={renderGroup}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
          ListEmptyComponent={listContent()}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.color.brand.primary}
            />
          }
        />

        <ProtectedFAB
          actions={[
            {
              icon: 'add-circle-outline',
              label: 'Nuevo grupo',
              onPress: () => {
                setEditingGroup(undefined);
                setFormVisible(true);
              },
              requiredPermissions: ['smart_purchase.groups.manage'],
            },
            {
              icon: 'clipboard-outline',
              label: 'Órdenes sugeridas',
              onPress: () => navigation.navigate('SmartPurchaseOrders'),
              requiredPermissions: [
                'smart_purchase.orders.generate',
                'smart_purchase.orders.manage',
                'smart_purchase.orders.export',
              ],
              requireAll: false,
            },
            {
              icon: 'analytics-outline',
              label: 'Ranking proveedores',
              onPress: () => navigation.navigate('SmartPurchaseAnalysisRanking'),
              requiredPermissions: ['smart_purchase.analysis.read'],
            },
          ]}
        />

        <GroupFormModal
          visible={formVisible}
          onClose={() => setFormVisible(false)}
          group={editingGroup}
          onSaved={(g) => {
            if (!editingGroup) {
              navigation.navigate('SmartPurchaseGroupDetail', { groupId: g.id });
            }
          }}
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const MetricPill: React.FC<{
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}> = ({ icon, label, value }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.metricPill}>
      <Ionicons name={icon} size={14} color={theme.color.text.muted} />
      <View>
        <Caption color="muted" style={{ fontSize: 10 }}>
          {label}
        </Caption>
        <Body size="small" style={{ fontWeight: '600' }}>
          {value}
        </Body>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.canvas,
    },
    header: {
      paddingHorizontal: spacing[6],
      paddingTop: spacing[4],
      paddingBottom: spacing[2],
      gap: spacing[1],
    },
    listContent: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[8] * 3,
      paddingTop: spacing[2],
      flexGrow: 1,
    },
    card: {
      gap: spacing[2],
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
    metricsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    metricPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      borderRadius: borderRadius.sm,
      backgroundColor: theme.color.surface.subtle,
    },
    notes: {
      marginTop: spacing[1],
    },
  });
