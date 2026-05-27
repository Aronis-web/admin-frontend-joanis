import React, { useEffect, useMemo, useState } from 'react';
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
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { repartosService } from '@/services/api/repartos';
import { Reparto } from '@/types/repartos';
import logger from '@/utils/logger';

type ParticipantKind = 'INTERNAL_SITE' | 'EXTERNAL_COMPANY' | 'UNKNOWN';

interface ProductDistributionsBySiteModalProps {
  visible: boolean;
  campaignId: string;
  /** Product UUID (NOT campaign-product id). Used to filter repartos.productos. */
  productId: string;
  productTitle?: string;
  productSku?: string;
  /** Optional totals for the header card. */
  campaignQuantityBase?: number;
  distributedQuantityBase?: number;
  onClose: () => void;
}

interface AggregatedRow {
  key: string;
  participantType: ParticipantKind;
  name: string;
  subtitle?: string;
  quantityBase: number;
  validatedBase: number;
  repartosCount: number;
}

const formatNumber = (value: number): string =>
  Number.isFinite(value) ? Math.floor(value).toLocaleString('es-PE') : '—';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repartos, setRepartos] = useState<Reparto[]>([]);

  useEffect(() => {
    if (!visible || !campaignId || !productId) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        // El endpoint list (/repartos/campaign/:id) no incluye productos.
        // Traemos la lista y luego en paralelo cada reparto con su include
        // completo (mismo patrón que RepartoParticipantDetailScreen).
        const list = await repartosService.getRepartosByCampaign(campaignId);
        const ids = (Array.isArray(list) ? list : []).map((r) => r.id);
        const full = await Promise.all(
          ids.map((id) =>
            repartosService.getReparto(id).catch((err) => {
              logger.warn(`No se pudo cargar reparto ${id}`, err);
              return null;
            })
          )
        );
        if (!cancelled) {
          setRepartos(full.filter((r): r is Reparto => !!r));
        }
      } catch (err: any) {
        logger.error('Error cargando repartos por sede:', err);
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              'No se pudieron cargar las cantidades por sede'
          );
          setRepartos([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [visible, campaignId, productId]);

  // Agrupar todas las cantidades del producto seleccionado por participante
  // (sede / empresa) sumando lo de todos los repartos de la campaña.
  const rows = useMemo<AggregatedRow[]>(() => {
    const acc = new Map<string, AggregatedRow>();

    repartos.forEach((reparto) => {
      reparto.participantes?.forEach((participante) => {
        const matchingProductos = (participante.productos || []).filter(
          (p) => p.productId === productId
        );
        if (matchingProductos.length === 0) return;

        const cp = participante.campaignParticipant;
        const type: ParticipantKind =
          cp?.participantType === 'INTERNAL_SITE'
            ? 'INTERNAL_SITE'
            : cp?.participantType === 'EXTERNAL_COMPANY'
              ? 'EXTERNAL_COMPANY'
              : 'UNKNOWN';

        const key = cp?.siteId || cp?.companyId || cp?.id || participante.id || `pa-${reparto.id}`;

        const name =
          cp?.site?.name ||
          cp?.company?.name ||
          participante.user?.name ||
          participante.user?.email ||
          `Participante ${String(key).slice(0, 8)}`;

        const subtitle =
          type === 'INTERNAL_SITE'
            ? cp?.site?.code
              ? `Sede · ${cp.site.code}`
              : 'Sede interna'
            : type === 'EXTERNAL_COMPANY'
              ? cp?.company?.ruc
                ? `Empresa · RUC ${cp.company.ruc}`
                : 'Empresa externa'
              : 'Sin participante asignado';

        const qty = matchingProductos.reduce(
          (sum, p) => sum + (Number(p.quantityAssigned) || 0),
          0
        );
        const validated = matchingProductos.reduce(
          (sum, p) => sum + (Number(p.quantityValidated) || 0),
          0
        );

        const existing = acc.get(key);
        if (existing) {
          existing.quantityBase += qty;
          existing.validatedBase += validated;
          existing.repartosCount += 1;
        } else {
          acc.set(key, {
            key,
            participantType: type,
            name,
            subtitle,
            quantityBase: qty,
            validatedBase: validated,
            repartosCount: 1,
          });
        }
      });
    });

    // Orden requerido: primero sedes internas, luego empresas externas,
    // y dentro de cada grupo por cantidad descendente.
    const groupOrder: Record<ParticipantKind, number> = {
      INTERNAL_SITE: 0,
      EXTERNAL_COMPANY: 1,
      UNKNOWN: 2,
    };
    return Array.from(acc.values()).sort((a, b) => {
      const diff = groupOrder[a.participantType] - groupOrder[b.participantType];
      if (diff !== 0) return diff;
      return b.quantityBase - a.quantityBase;
    });
  }, [repartos, productId]);

  const totalDistributed = useMemo(() => rows.reduce((sum, r) => sum + r.quantityBase, 0), [rows]);

  const sitesCount = rows.filter((r) => r.participantType === 'INTERNAL_SITE').length;
  const companiesCount = rows.filter((r) => r.participantType === 'EXTERNAL_COMPANY').length;

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
            <ActivityIndicator size="large" color={colors.primary[500]} />
            <Text style={styles.centeredStateText}>Cargando repartos…</Text>
          </View>
        ) : error ? (
          <View style={styles.centeredState}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
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
              const isInternal = row.participantType === 'INTERNAL_SITE';
              const percent =
                totalDistributed > 0 ? (row.quantityBase / totalDistributed) * 100 : 0;
              const hasValidation = row.validatedBase > 0;
              return (
                <View
                  key={row.key}
                  style={[styles.row, isInternal ? styles.rowInternal : styles.rowExternal]}
                >
                  <View style={styles.rowIconWrap}>
                    <Text style={styles.rowIcon}>{isInternal ? '🏠' : '🏢'}</Text>
                  </View>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {row.name}
                    </Text>
                    {row.subtitle && (
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
                        {row.subtitle}
                        {row.repartosCount > 1 ? ` · ${row.repartosCount} repartos` : ''}
                      </Text>
                    )}
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
                    <Text style={styles.rowQty}>{formatNumber(row.quantityBase)}</Text>
                    <Text style={styles.rowPercent}>{percent.toFixed(1)}%</Text>
                    {hasValidation && (
                      <Text style={styles.rowValidated}>✓ {formatNumber(row.validatedBase)}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    backgroundColor: colors.surface.primary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonSpacer: {
    width: 36,
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.neutral[600],
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing[2],
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[800],
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    marginTop: 2,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    margin: spacing[4],
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  summaryBlock: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.default,
    marginHorizontal: spacing[2],
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral[500],
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing[1],
  },
  summaryValueCampaign: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.warning[500],
  },
  summaryValueRepartido: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.success[500],
  },
  summaryValueDestinations: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary[500],
    textAlign: 'center',
  },
  summaryValueBreakdown: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[6],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    marginBottom: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing[3],
  },
  rowInternal: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },
  rowExternal: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning[500],
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.secondary,
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
    color: colors.neutral[800],
  },
  rowSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.neutral[500],
    marginTop: 1,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[100],
    marginTop: spacing[2],
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressFillInternal: {
    backgroundColor: colors.primary[500],
  },
  progressFillExternal: {
    backgroundColor: colors.warning[500],
  },
  rowQtyWrap: {
    alignItems: 'flex-end',
    minWidth: 72,
  },
  rowQty: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.neutral[800],
  },
  rowPercent: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.neutral[500],
    marginTop: 1,
  },
  rowValidated: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success[500],
    marginTop: 2,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
  },
  centeredStateText: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: spacing[3],
    fontWeight: '600',
  },
  errorIcon: {
    fontSize: 36,
    marginBottom: spacing[2],
  },
  errorText: {
    fontSize: 13,
    color: colors.danger[500],
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing[2],
  },
  emptyText: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
    fontWeight: '600',
  },
});
