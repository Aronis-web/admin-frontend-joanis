/**
 * SmartPurchaseGroupDetailScreen
 *
 * Corazón del flujo. Muestra los proveedores del grupo y su análisis actual,
 * con botón "Re-analizar" (dispara global runAnalysis + refetch) por proveedor.
 * Desde aquí se navega a familias y a órdenes del grupo.
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
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import { ProtectedView } from '@/components/ui/ProtectedView';
import {
  Badge,
  Body,
  Button,
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
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import type { MainStackParamList } from '@/types/navigation';
import type { SmartPurchaseGroupSupplier, SupplierAnalysisRow } from '@/types/smartPurchase';
import {
  useAddSmartPurchaseSuppliers,
  useDeleteSmartPurchaseGroup,
  useRebuildFamilies,
  useRemoveSmartPurchaseSupplier,
  useRescoreFamilies,
  useRunAnalysis,
  useSmartPurchaseGroup,
  useSupplierAnalysis,
} from '@/hooks/api/useSmartPurchase';
import {
  formatDateTime,
  formatNumber,
  formatPct,
  formatRelative,
  VIABILITY_COLOR,
  VIABILITY_LABEL,
} from './helpers';
import { GroupFormModal } from './components/GroupFormModal';
import { SupplierPickerModal } from './components/SupplierPickerModal';
import { SupplierAnalysisModal } from './components/SupplierAnalysisModal';

type Props = NativeStackScreenProps<MainStackParamList, 'SmartPurchaseGroupDetail'>;

export const SmartPurchaseGroupDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { groupId } = route.params;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [editVisible, setEditVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [detailSupplierId, setDetailSupplierId] = useState<string | undefined>();
  const [detailSupplierName, setDetailSupplierName] = useState<string | undefined>();
  const [reanalyzingSupplierId, setReanalyzingSupplierId] = useState<string | null>(null);

  const { data: group, isLoading, isError, refetch, isRefetching } = useSmartPurchaseGroup(groupId);

  const { data: analysisAll, refetch: refetchAnalysis } = useSupplierAnalysis(undefined, {
    enabled: !!group,
  });

  const runAnalysis = useRunAnalysis();
  const rebuildFamilies = useRebuildFamilies();
  const rescoreFamilies = useRescoreFamilies();
  const addSuppliers = useAddSmartPurchaseSuppliers();
  const removeSupplier = useRemoveSmartPurchaseSupplier();
  const deleteGroup = useDeleteSmartPurchaseGroup();

  const analysisMap = useMemo(() => {
    const map = new Map<string, SupplierAnalysisRow>();
    (analysisAll ?? []).forEach((row) => map.set(row.supplierId, row));
    return map;
  }, [analysisAll]);

  const handleReanalyze = useCallback(
    async (supplierId: string) => {
      setReanalyzingSupplierId(supplierId);
      try {
        await runAnalysis.mutateAsync({ supplierId });
        await refetchAnalysis();
      } catch (err: any) {
        logger.error('Re-analizar proveedor error', err);
        Alert.alert('Error', err?.message ?? 'No se pudo re-analizar el proveedor.');
      } finally {
        setReanalyzingSupplierId(null);
      }
    },
    [runAnalysis, refetchAnalysis]
  );

  const handleReanalyzeAll = useCallback(async () => {
    try {
      const res = await runAnalysis.mutateAsync();
      await refetchAnalysis();
      Alert.alert('Análisis completado', `Se analizaron ${res.analyzed} proveedores.`);
    } catch (err: any) {
      logger.error('Re-analizar todos error', err);
      Alert.alert('Error', err?.message ?? 'No se pudo ejecutar el análisis.');
    }
  }, [runAnalysis, refetchAnalysis]);

  const handleRebuild = useCallback(async () => {
    try {
      const res = await rebuildFamilies.mutateAsync(groupId);
      Alert.alert('Familias reconstruidas', `Se reconstruyeron ${res.rebuilt} familias.`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo reconstruir familias.');
    }
  }, [rebuildFamilies, groupId]);

  const handleRescore = useCallback(async () => {
    try {
      const res = await rescoreFamilies.mutateAsync(groupId);
      Alert.alert('Score actualizado', `Se recalcularon ${res.rescored} familias.`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo recalcular score.');
    }
  }, [rescoreFamilies, groupId]);

  const handleRemoveSupplier = useCallback(
    (supplier: SmartPurchaseGroupSupplier) => {
      Alert.alert('Quitar proveedor', `¿Quitar "${supplier.supplierName}" del grupo?`, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeSupplier.mutateAsync({ id: groupId, supplierId: supplier.supplierId });
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'No se pudo quitar el proveedor.');
            }
          },
        },
      ]);
    },
    [removeSupplier, groupId]
  );

  const handleDeleteGroup = useCallback(() => {
    if (!group) return;
    Alert.alert('Eliminar grupo', `¿Eliminar el grupo "${group.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGroup.mutateAsync(groupId);
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'No se pudo eliminar el grupo.');
          }
        },
      },
    ]);
  }, [deleteGroup, group, groupId, navigation]);

  const handleAddSuppliers = useCallback(
    async (supplierIds: string[]) => {
      try {
        await addSuppliers.mutateAsync({ id: groupId, data: { supplierIds } });
        setPickerVisible(false);
      } catch (err: any) {
        Alert.alert('Error', err?.message ?? 'No se pudieron agregar los proveedores.');
      }
    },
    [addSuppliers, groupId]
  );

  if (isLoading) {
    return (
      <ScreenLayout navigation={navigation as any}>
        <View style={styles.centered}>
          <ActivityIndicator color={theme.color.brand.primary} />
        </View>
      </ScreenLayout>
    );
  }

  if (isError || !group) {
    return (
      <ScreenLayout navigation={navigation as any}>
        <ErrorState
          title="No se pudo cargar el grupo"
          description="Reintenta o vuelve a la lista."
          onRetry={() => refetch()}
        />
      </ScreenLayout>
    );
  }

  const renderSupplier = ({ item }: { item: SmartPurchaseGroupSupplier }) => {
    const analysis = analysisMap.get(item.supplierId);
    const isReanalyzing = reanalyzingSupplierId === item.supplierId;

    return (
      <Card style={styles.supplierCard}>
        <View style={styles.supplierHeader}>
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '600' }}>{item.supplierName}</Body>
            <Caption color="muted">
              {item.ruc ? `RUC ${item.ruc} · ` : ''}
              Agregado {formatDateTime(item.addedAt)}
            </Caption>
          </View>
          {analysis ? (
            <View style={styles.viabilityChip}>
              <View
                style={[
                  styles.viabilityDot,
                  { backgroundColor: VIABILITY_COLOR[analysis.viability] },
                ]}
              />
              <Body size="small" style={{ fontWeight: '600' }}>
                {VIABILITY_LABEL[analysis.viability]}
              </Body>
            </View>
          ) : (
            <Badge variant="default" label="Sin análisis" />
          )}
        </View>

        {analysis ? (
          <>
            <View style={styles.metricsRow}>
              <Metric label="Compras 60d" value={formatNumber(analysis.purchases60d)} />
              <Metric
                label="Días entre"
                value={
                  analysis.avgDaysBetweenPurchases !== null
                    ? formatNumber(analysis.avgDaysBetweenPurchases, 1)
                    : '—'
                }
              />
              <Metric label="Cobertura" value={formatPct(analysis.coveragePct)} />
              <Metric label="Duplicados" value={formatPct(analysis.duplicateFamilyRate)} />
              <Metric label="Cob. recomendada" value={`${analysis.recommendedCoverageDays}d`} />
            </View>
            <Caption color="muted">Último análisis: {formatRelative(analysis.analyzedAt)}</Caption>
          </>
        ) : (
          <Caption color="muted">
            Aún no se ha analizado. Ejecuta el análisis para ver métricas y viabilidad.
          </Caption>
        )}

        <View style={styles.supplierActions}>
          <ProtectedView requiredPermissions={['smart_purchase.analysis.run']}>
            <Button
              title="Re-analizar"
              variant="outline"
              onPress={() => handleReanalyze(item.supplierId)}
              loading={isReanalyzing}
              disabled={isReanalyzing}
              leftIcon="refresh-outline"
              size="small"
            />
          </ProtectedView>
          <ProtectedView requiredPermissions={['smart_purchase.analysis.read']}>
            <Button
              title="Historial"
              variant="ghost"
              onPress={() => {
                setDetailSupplierId(item.supplierId);
                setDetailSupplierName(item.supplierName);
              }}
              leftIcon="stats-chart-outline"
              size="small"
            />
          </ProtectedView>
          <View style={{ flex: 1 }} />
          <ProtectedView requiredPermissions={['smart_purchase.groups.manage']}>
            <TouchableOpacity onPress={() => handleRemoveSupplier(item)} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={theme.color.icon.danger} />
            </TouchableOpacity>
          </ProtectedView>
        </View>
      </Card>
    );
  };

  return (
    <ScreenLayout navigation={navigation as any}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={theme.color.text.body} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Title>{group.name}</Title>
            <Caption color="muted">
              {`Cob. ${group.coverageDays}d · Lead ${group.leadTimeDays}d · Seguridad ${group.safetyDays}d · Ventana ${group.analysisWindowDays}d`}
            </Caption>
          </View>
          <Badge
            variant={group.isEnabled ? 'success' : 'default'}
            label={group.isEnabled ? 'Activo' : 'Off'}
          />
        </View>

        <View style={styles.actionsBar}>
          <ProtectedView requiredPermissions={['smart_purchase.analysis.run']}>
            <Button
              title="Re-analizar todos"
              variant="primary"
              onPress={handleReanalyzeAll}
              loading={runAnalysis.isPending}
              disabled={runAnalysis.isPending}
              leftIcon="refresh-outline"
              size="small"
            />
          </ProtectedView>
          <ProtectedView requiredPermissions={['smart_purchase.products.read']}>
            <Button
              title="Familias"
              variant="ghost"
              onPress={() => navigation.navigate('SmartPurchaseFamilies', { groupId })}
              leftIcon="albums-outline"
              size="small"
            />
          </ProtectedView>
          <ProtectedView requiredPermissions={['smart_purchase.orders.generate']}>
            <Button
              title="Órdenes"
              variant="ghost"
              onPress={() => navigation.navigate('SmartPurchaseOrders', { groupId })}
              leftIcon="clipboard-outline"
              size="small"
            />
          </ProtectedView>
        </View>

        <FlatList
          data={group.suppliers}
          keyExtractor={(s) => s.supplierId}
          renderItem={renderSupplier}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="Grupo sin proveedores"
              description="Agrega proveedores al grupo para analizar su viabilidad."
              actionLabel="Agregar proveedores"
              onAction={() => setPickerVisible(true)}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetch();
                refetchAnalysis();
              }}
              tintColor={theme.color.brand.primary}
            />
          }
        />

        <ProtectedFAB
          actions={[
            {
              icon: 'person-add-outline',
              label: 'Agregar proveedores',
              onPress: () => setPickerVisible(true),
              requiredPermissions: ['smart_purchase.groups.manage'],
            },
            {
              icon: 'create-outline',
              label: 'Editar grupo',
              onPress: () => setEditVisible(true),
              requiredPermissions: ['smart_purchase.groups.manage'],
            },
            {
              icon: 'construct-outline',
              label: 'Reconstruir familias',
              onPress: handleRebuild,
              requiredPermissions: ['smart_purchase.products.manage'],
            },
            {
              icon: 'trending-up-outline',
              label: 'Recalcular score',
              onPress: handleRescore,
              requiredPermissions: ['smart_purchase.products.manage'],
            },
            {
              icon: 'trash-outline',
              label: 'Eliminar grupo',
              onPress: handleDeleteGroup,
              requiredPermissions: ['smart_purchase.groups.manage'],
            },
          ]}
        />

        <GroupFormModal visible={editVisible} onClose={() => setEditVisible(false)} group={group} />

        <SupplierPickerModal
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onConfirm={handleAddSuppliers}
          title="Agregar proveedores al grupo"
          confirmLabel="Agregar"
          excludeIds={group.suppliers.map((s) => s.supplierId)}
          loading={addSuppliers.isPending}
        />

        <SupplierAnalysisModal
          visible={!!detailSupplierId}
          supplierId={detailSupplierId}
          supplierName={detailSupplierName}
          onClose={() => setDetailSupplierId(undefined)}
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.metric}>
      <Caption color="muted" style={{ fontSize: 10 }}>
        {label}
      </Caption>
      <Body size="small" style={{ fontWeight: '600' }}>
        {value}
      </Body>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.canvas,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingHorizontal: spacing[6],
      paddingTop: spacing[4],
      paddingBottom: spacing[2],
    },
    actionsBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[2],
    },
    listContent: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[8] * 3,
      flexGrow: 1,
    },
    supplierCard: {
      gap: spacing[2],
    },
    supplierHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing[2],
    },
    viabilityChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.surface.subtle,
    },
    viabilityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    metricsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    metric: {
      minWidth: 90,
      flexGrow: 1,
      padding: spacing[2],
      borderRadius: borderRadius.sm,
      backgroundColor: theme.color.surface.subtle,
      gap: 2,
    },
    supplierActions: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
  });
