/**
 * SupplierAnalysisModal
 *
 * Muestra el detalle de análisis de un proveedor: métricas actuales +
 * historial (últimos snapshots). Usado desde el detalle de grupo cuando
 * el usuario tap sobre "Ver detalle" en la fila del proveedor.
 */
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge, Body, Caption, Divider, Title, useTheme, useThemedStyles } from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import { useSupplierAnalysisDetail } from '@/hooks/api/useSmartPurchase';
import {
  formatCents,
  formatDateTime,
  formatNumber,
  formatPct,
  safeFixed,
  VIABILITY_COLOR,
  VIABILITY_LABEL,
} from '../helpers';

interface Props {
  visible: boolean;
  supplierId: string | undefined;
  supplierName?: string;
  onClose: () => void;
}

export const SupplierAnalysisModal: React.FC<Props> = ({
  visible,
  supplierId,
  supplierName,
  onClose,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const { data, isLoading, isError, refetch } = useSupplierAnalysisDetail(
    visible ? supplierId : undefined
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Title>{supplierName ?? 'Detalle del proveedor'}</Title>
              <Caption color="muted">Historial de análisis</Caption>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={theme.color.text.body} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.color.brand.primary} />
            </View>
          ) : isError || !data ? (
            <View style={styles.centered}>
              <Body color="danger">No se pudo cargar el análisis.</Body>
              <TouchableOpacity onPress={() => refetch()} style={{ marginTop: spacing[2] }}>
                <Body color="link">Reintentar</Body>
              </TouchableOpacity>
            </View>
          ) : (
            (() => {
              const supplier = data.supplier;
              const history = data.history ?? [];
              if (!supplier) {
                return (
                  <View style={styles.centered}>
                    <Body color="muted">Este proveedor aún no tiene análisis.</Body>
                    <Caption color="muted" style={{ marginTop: spacing[2] }}>
                      Ejecuta un análisis para ver métricas.
                    </Caption>
                  </View>
                );
              }
              const viability = supplier.viability;
              return (
                <ScrollView contentContainerStyle={styles.content}>
                  <View style={styles.currentBlock}>
                    <View style={styles.viabilityRow}>
                      <View
                        style={[
                          styles.viabilityDot,
                          {
                            backgroundColor:
                              (viability && VIABILITY_COLOR[viability]) ?? theme.color.icon.muted,
                          },
                        ]}
                      />
                      <Body style={{ fontWeight: '600' }}>
                        {(viability && VIABILITY_LABEL[viability]) ?? 'Sin viabilidad'}
                      </Body>
                      <View style={{ flex: 1 }} />
                      <Caption color="muted">{formatDateTime(supplier.analyzedAt)}</Caption>
                    </View>

                    <View style={styles.metricsGrid}>
                      <Metric label="Compras (60d)" value={formatNumber(supplier.purchases60d)} />
                      <Metric label="Compras (180d)" value={formatNumber(supplier.purchases180d)} />
                      <Metric
                        label="Días entre compras"
                        value={
                          supplier.avgDaysBetweenPurchases !== null &&
                          supplier.avgDaysBetweenPurchases !== undefined
                            ? formatNumber(supplier.avgDaysBetweenPurchases, 1)
                            : '—'
                        }
                      />
                      <Metric
                        label="Productos activos"
                        value={formatPct(supplier.activeProductsPct)}
                      />
                      <Metric
                        label="Prod. con ventas"
                        value={formatPct(supplier.productsWithSalesPct)}
                      />
                      <Metric label="Cobertura" value={formatPct(supplier.coveragePct)} />
                      <Metric label="Duplicados" value={formatPct(supplier.duplicateFamilyRate)} />
                      <Metric label="Ajuste" value={safeFixed(supplier.adjustmentRatio, 2)} />
                      <Metric label="Gasto (60d)" value={formatCents(supplier.spendCents60d)} />
                      <Metric
                        label="Cobertura recomendada"
                        value={
                          supplier.recommendedCoverageDays != null
                            ? `${supplier.recommendedCoverageDays}d`
                            : '—'
                        }
                      />
                    </View>
                  </View>

                  <Divider />

                  <View style={{ paddingHorizontal: spacing[6], paddingVertical: spacing[4] }}>
                    <Body style={{ fontWeight: '600', marginBottom: spacing[2] }}>
                      Historial ({history.length})
                    </Body>
                    {history.length === 0 ? (
                      <Caption color="muted">Sin snapshots previos.</Caption>
                    ) : (
                      history.map((snap) => {
                        const snapViability = snap.viability;
                        return (
                          <View key={snap.id} style={styles.historyRow}>
                            <View
                              style={[
                                styles.viabilityDotSmall,
                                {
                                  backgroundColor:
                                    (snapViability && VIABILITY_COLOR[snapViability]) ??
                                    theme.color.icon.muted,
                                },
                              ]}
                            />
                            <View style={{ flex: 1 }}>
                              <Body size="small">
                                {(snapViability && VIABILITY_LABEL[snapViability]) ??
                                  'Sin viabilidad'}
                              </Body>
                              <Caption color="muted">{formatDateTime(snap.analyzedAt)}</Caption>
                            </View>
                            <Badge
                              variant="default"
                              label={
                                snap.recommendedCoverageDays != null
                                  ? `Cob ${snap.recommendedCoverageDays}d`
                                  : 'Cob —'
                              }
                            />
                          </View>
                        );
                      })
                    )}
                  </View>
                </ScrollView>
              );
            })()
          )}
        </Pressable>
      </Pressable>
    </Modal>
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
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      maxHeight: '90%',
      minHeight: '50%',
      paddingTop: spacing[4],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[2],
      gap: spacing[4],
    },
    content: {
      paddingBottom: spacing[8],
    },
    currentBlock: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[4],
      gap: spacing[4],
    },
    viabilityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
    },
    viabilityDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    viabilityDotSmall: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    metric: {
      minWidth: 120,
      flexGrow: 1,
      padding: spacing[2],
      borderRadius: borderRadius.sm,
      backgroundColor: theme.color.surface.subtle,
      gap: 2,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingVertical: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.subtle,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 180,
    },
  });
