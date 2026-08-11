import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { useCampaignProductFull } from '@/hooks/api/useCampaigns';
import type { CampaignProductFullParticipantDistribution } from '@/types/campaigns';

type ParticipantKind = 'INTERNAL_SITE' | 'EXTERNAL_COMPANY' | 'UNKNOWN';

interface ProductDistributionsBySiteModalProps {
  visible: boolean;
  campaignId: string;
  /** Product UUID (NOT campaign-product id). Used by the `/full` endpoint. */
  productId: string;
  productTitle?: string;
  productSku?: string;
  /** Optional totals for the header card. */
  campaignQuantityBase?: number;
  distributedQuantityBase?: number;
  onClose: () => void;
}

const formatNumber = (value: number): string =>
  Number.isFinite(value) ? Math.floor(value).toLocaleString('es-PE') : '—';

const toKind = (type: string): ParticipantKind =>
  type === 'INTERNAL_SITE'
    ? 'INTERNAL_SITE'
    : type === 'EXTERNAL_COMPANY'
      ? 'EXTERNAL_COMPANY'
      : 'UNKNOWN';

export const ProductDistributionsBySiteModal: React.FC<ProductDistributionsBySiteModalProps> = ({
  visible,
  campaignId,
  productId,
  productTitle,
  productSku,
  campaignQuantityBase,
  distributedQuantityBase,
  onClose,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const {
    data: fullData,
    isLoading: loading,
    isError,
    error,
  } = useCampaignProductFull(campaignId, productId, visible && !!campaignId && !!productId);

  // Repartos agrupados por participante tal como los entrega el endpoint
  // `/full`. Orden: primero sedes internas, luego empresas externas, y
  // dentro de cada grupo por cantidad descendente.
  const rows = useMemo<CampaignProductFullParticipantDistribution[]>(() => {
    const items = fullData?.distributionByParticipant ?? [];
    const groupOrder: Record<ParticipantKind, number> = {
      INTERNAL_SITE: 0,
      EXTERNAL_COMPANY: 1,
      UNKNOWN: 2,
    };
    return [...items].sort((a, b) => {
      const diff = groupOrder[toKind(a.participantType)] - groupOrder[toKind(b.participantType)];
      if (diff !== 0) return diff;
      return parseFloat(b.totalQuantityBase || '0') - parseFloat(a.totalQuantityBase || '0');
    });
  }, [fullData]);

  const totalDistributed = useMemo(
    () => rows.reduce((sum, r) => sum + (parseFloat(r.totalQuantityBase || '0') || 0), 0),
    [rows]
  );

  const sitesCount = rows.filter((r) => toKind(r.participantType) === 'INTERNAL_SITE').length;
  const companiesCount = rows.filter(
    (r) => toKind(r.participantType) === 'EXTERNAL_COMPANY'
  ).length;

  const errorMessage = isError
    ? (error as any)?.response?.data?.message ||
      (error as any)?.message ||
      'No se pudieron cargar los repartos'
    : null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Repartos por sede
            </Text>
            {(productSku || productTitle) && (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {productSku ? `${productSku} · ` : ''}
                {productTitle || ''}
              </Text>
            )}
          </View>
          <View style={styles.closeButtonSpacer} />
        </View>

        {/* Resumen */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>Campaña</Text>
            <Text style={styles.summaryValueCampaign}>
              {campaignQuantityBase !== undefined ? formatNumber(campaignQuantityBase) : '—'}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>Repartido</Text>
            <Text style={styles.summaryValueRepartido}>
              {distributedQuantityBase !== undefined
                ? formatNumber(distributedQuantityBase)
                : formatNumber(totalDistributed)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryBlock}>
            <Text style={styles.summaryLabel}>Destinos</Text>
            <Text style={styles.summaryValueDestinations}>
              {rows.length}
              {(sitesCount > 0 || companiesCount > 0) && (
                <Text style={styles.summaryValueBreakdown}>
                  {'\n'}
                  {sitesCount > 0 ? `${sitesCount} sede${sitesCount !== 1 ? 's' : ''}` : ''}
                  {sitesCount > 0 && companiesCount > 0 ? ' · ' : ''}
                  {companiesCount > 0
                    ? `${companiesCount} empresa${companiesCount !== 1 ? 's' : ''}`
                    : ''}
                </Text>
              )}
            </Text>
          </View>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={theme.color.brand.primary} />
            <Text style={styles.centeredStateText}>Cargando repartos…</Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.centeredState}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.centeredState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Aún no hay repartos para este producto</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator
          >
            {rows.map((row) => {
              const kind = toKind(row.participantType);
              const isInternal = kind === 'INTERNAL_SITE';
              const qty = parseFloat(row.totalQuantityBase || '0') || 0;
              const percent = totalDistributed > 0 ? (qty / totalDistributed) * 100 : 0;
              return (
                <View
                  key={row.campaignParticipantId}
                  style={[styles.row, isInternal ? styles.rowInternal : styles.rowExternal]}
                >
                  <View style={styles.rowTop}>
                    <View style={styles.rowIconWrap}>
                      <Text style={styles.rowIcon}>{isInternal ? '🏠' : '🏢'}</Text>
                    </View>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {row.participantName}
                      </Text>
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
                        {isInternal ? 'Sede interna' : 'Empresa externa'}
                        {row.repartos.length > 0
                          ? ` · ${row.repartos.length} reparto${row.repartos.length !== 1 ? 's' : ''}`
                          : ''}
                      </Text>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            isInternal ? styles.progressFillInternal : styles.progressFillExternal,
                            { width: `${Math.min(percent, 100)}%` },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.rowQtyWrap}>
                      <Text style={styles.rowQty}>{formatNumber(qty)}</Text>
                      <Text style={styles.rowPercent}>{percent.toFixed(1)}%</Text>
                    </View>
                  </View>

                  {/* Repartos individuales del participante */}
                  {row.repartos.length > 0 && (
                    <View style={styles.repartoList}>
                      {row.repartos.map((reparto) => (
                        <View key={reparto.repartoId} style={styles.repartoItem}>
                          <View style={styles.repartoInfo}>
                            <Text style={styles.repartoCode} numberOfLines={1}>
                              {reparto.repartoCode}
                            </Text>
                            {!!reparto.repartoName && (
                              <Text style={styles.repartoName} numberOfLines={1}>
                                {reparto.repartoName}
                              </Text>
                            )}
                          </View>
                          <View style={styles.repartoRight}>
                            <Text style={styles.repartoQty}>
                              {formatNumber(parseFloat(reparto.quantityBase || '0'))}
                            </Text>
                            <Text style={styles.repartoStatus} numberOfLines={1}>
                              {reparto.status || reparto.repartoStatus}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.default,
      backgroundColor: theme.color.surface.base,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.color.background.subtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonSpacer: {
      width: 36,
    },
    closeButtonText: {
      fontSize: 20,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: theme.space[2],
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.color.text.heading,
    },
    headerSubtitle: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.subtle,
      marginTop: 2,
    },
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      margin: theme.space[4],
      padding: theme.space[4],
      borderRadius: theme.radii.xl,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    summaryBlock: {
      flex: 1,
      alignItems: 'center',
    },
    summaryDivider: {
      width: 1,
      height: 40,
      backgroundColor: theme.color.border.default,
      marginHorizontal: theme.space[2],
    },
    summaryLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.color.text.subtle,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: theme.space[1],
    },
    summaryValueCampaign: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.color.text.warning,
    },
    summaryValueRepartido: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.color.text.success,
    },
    summaryValueDestinations: {
      fontSize: 22,
      fontWeight: '800',
      color: theme.color.brand.primary,
      textAlign: 'center',
    },
    summaryValueBreakdown: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.color.text.subtle,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: theme.space[4],
      paddingBottom: theme.space[6],
    },
    row: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[3],
      marginBottom: theme.space[2],
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    rowInternal: {
      borderLeftWidth: 3,
      borderLeftColor: theme.color.brand.primary,
    },
    rowExternal: {
      borderLeftWidth: 3,
      borderLeftColor: theme.color.icon.warning,
    },
    rowIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.color.background.subtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rowIcon: {
      fontSize: 18,
    },
    rowMain: {
      flex: 1,
      minWidth: 0,
    },
    rowName: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    rowSubtitle: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.color.text.subtle,
      marginTop: 1,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.color.background.muted,
      marginTop: theme.space[2],
      overflow: 'hidden',
    },
    progressFill: {
      height: 4,
      borderRadius: 2,
    },
    progressFillInternal: {
      backgroundColor: theme.color.brand.primary,
    },
    progressFillExternal: {
      backgroundColor: theme.color.icon.warning,
    },
    rowQtyWrap: {
      alignItems: 'flex-end',
      minWidth: 72,
    },
    rowQty: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.color.text.heading,
    },
    rowPercent: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.subtle,
      marginTop: 1,
    },
    repartoList: {
      marginTop: theme.space[3],
      paddingTop: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
      gap: theme.space[2],
    },
    repartoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.md,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
    },
    repartoInfo: {
      flex: 1,
      minWidth: 0,
      marginRight: theme.space[2],
    },
    repartoCode: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    repartoName: {
      fontSize: 11,
      fontWeight: '500',
      color: theme.color.text.subtle,
      marginTop: 1,
    },
    repartoRight: {
      alignItems: 'flex-end',
    },
    repartoQty: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.color.text.success,
    },
    repartoStatus: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.color.text.subtle,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: 1,
    },
    centeredState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.space[6],
    },
    centeredStateText: {
      fontSize: 13,
      color: theme.color.text.subtle,
      marginTop: theme.space[3],
      fontWeight: '600',
    },
    errorIcon: {
      fontSize: 36,
      marginBottom: theme.space[2],
    },
    errorText: {
      fontSize: 13,
      color: theme.color.text.danger,
      textAlign: 'center',
      fontWeight: '600',
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: theme.space[2],
    },
    emptyText: {
      fontSize: 14,
      color: theme.color.text.subtle,
      textAlign: 'center',
      fontWeight: '600',
    },
  });
