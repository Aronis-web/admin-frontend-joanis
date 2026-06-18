/**
 * Distribution Form Modal V2
 *
 * Reemplazo del modal de generación de repartos. Más dinámico y profesional:
 *  - Stock restringido a la sede actual del tenant (sin fallback).
 *  - Edición en cajas / medias cajas (si el factor es par) / unidades sueltas.
 *  - Recalculo automático del remanente entre las sedes internas de la
 *    empresa actual, proporcional al monto esperado.
 *  - Precios por participante = precio de venta del perfil asignado.
 *  - Panel de validación visual venta vs esperado y métricas de costo/utilidad.
 *
 * Mantiene la misma firma pública que `DistributionFormModal` para poder ser
 * empalmado en `CampaignProductBannerModal` sin cambios adicionales.
 */
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import {
  CampaignProduct,
  DistributionType,
  DistributionTypeDescriptions,
  DistributionTypeLabels,
  StockDetailByWarehouse,
} from '@/types/campaigns';
import { useDistributionFormV2 } from './distribution-form-v2/useDistributionFormV2';
import { StockAllocationPicker } from './distribution-form-v2/StockAllocationPicker';
import { ParticipantDistributionTable } from './distribution-form-v2/ParticipantDistributionTable';
import { DistributionSummaryPanel } from './distribution-form-v2/DistributionSummaryPanel';

interface DistributionFormModalV2Props {
  visible: boolean;
  campaignId: string;
  product: CampaignProduct | null;
  localStockData?: StockDetailByWarehouse[];
  onClose: () => void;
  onSuccess: () => void;
  asContent?: boolean;
}

export const DistributionFormModalV2: React.FC<DistributionFormModalV2Props> = ({
  visible,
  campaignId,
  product,
  localStockData,
  onClose,
  onSuccess,
  asContent = false,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  const form = useDistributionFormV2({
    visible,
    campaignId,
    product,
    localStockData,
    onSuccess,
    onClose,
  });

  if (!product) {
    return null;
  }

  const Body = (
    <View style={asContent ? styles.contentContainer : styles.overlay}>
      <View
        style={
          asContent
            ? styles.contentInner
            : [styles.modalContent, isTablet && styles.modalContentTablet]
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Generar reparto · {product.product?.title ?? ''}</Text>
            <Text style={styles.subtitle}>
              Sede actual: <Text style={styles.strong}>{form.currentSite?.name ?? 'sin sede'}</Text>{' '}
              · Empresa:{' '}
              <Text style={styles.strong}>{form.currentCompany?.name ?? 'sin empresa'}</Text>
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {form.loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.color.brand.primary} />
            <Text style={styles.loadingText}>Cargando datos del reparto…</Text>
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* Tipo de reparto */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Tipo de reparto</Text>
              <View style={styles.typeRow}>
                {Object.values(DistributionType).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeOption,
                      form.distributionType === t && styles.typeOptionSelected,
                    ]}
                    onPress={() => form.setDistributionType(t)}
                  >
                    <Text
                      style={[
                        styles.typeLabel,
                        form.distributionType === t && styles.typeLabelSelected,
                      ]}
                    >
                      {DistributionTypeLabels[t]}
                    </Text>
                    <Text style={styles.typeHint}>{DistributionTypeDescriptions[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Modo */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Modo de distribución</Text>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeButton, form.mode === 'units' && styles.modeButtonSelected]}
                  onPress={() => form.setMode('units')}
                >
                  <Text style={[styles.modeText, form.mode === 'units' && styles.modeTextSelected]}>
                    Por unidades
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    form.mode === 'presentation' && styles.modeButtonSelected,
                  ]}
                  onPress={() => {
                    form.setMode('presentation');
                    if (!form.presentationId && form.presentations.length > 0) {
                      const firstNonBase = form.presentations.find((p) => !p.isBase);
                      const target = firstNonBase ?? form.presentations[0];
                      form.setPresentationId(target.presentationId);
                    }
                  }}
                  disabled={form.presentations.length === 0}
                >
                  <Text
                    style={[
                      styles.modeText,
                      form.mode === 'presentation' && styles.modeTextSelected,
                    ]}
                  >
                    Por cajas
                  </Text>
                </TouchableOpacity>
              </View>

              {form.mode === 'presentation' && form.presentations.length > 0 && (
                <View style={styles.presentationRow}>
                  {form.presentations
                    .filter((p) => !p.isBase)
                    .map((p) => (
                      <TouchableOpacity
                        key={p.presentationId}
                        style={[
                          styles.presentationChip,
                          form.presentationId === p.presentationId &&
                            styles.presentationChipSelected,
                        ]}
                        onPress={() => form.setPresentationId(p.presentationId)}
                      >
                        <Text
                          style={[
                            styles.presentationChipText,
                            form.presentationId === p.presentationId &&
                              styles.presentationChipTextSelected,
                          ]}
                        >
                          {p.presentation?.name ?? p.presentationId} · ×{p.factorToBase}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              )}

              {form.mode === 'presentation' && form.isEvenFactor && (
                <View style={styles.halfBoxRow}>
                  <Text style={styles.halfBoxLabel}>
                    Permitir media caja ({form.presentationFactor / 2} u.)
                  </Text>
                  <Switch value={form.allowHalfBox} onValueChange={form.setAllowHalfBox} />
                </View>
              )}
              {form.mode === 'presentation' &&
                !form.isEvenFactor &&
                form.presentationFactor > 1 && (
                  <Text style={styles.halfBoxHint}>
                    El factor de la presentación ({form.presentationFactor}) es impar; la opción de
                    media caja queda deshabilitada.
                  </Text>
                )}

              {form.mode === 'presentation' && form.presentationFactor > 1 && (
                <View style={styles.halfBoxRow}>
                  <Text style={styles.halfBoxLabel}>Permitir unidades sueltas</Text>
                  <Switch value={form.allowLoose} onValueChange={form.setAllowLoose} />
                </View>
              )}
              {form.mode === 'presentation' && form.presentationFactor > 1 && !form.allowLoose && (
                <>
                  <Text style={styles.halfBoxHint}>
                    Reparto en{' '}
                    {form.allowHalfBox && form.isEvenFactor
                      ? 'cajas y medias cajas'
                      : 'cajas completas'}
                    . El excedente que no completa una{' '}
                    {form.allowHalfBox && form.isEvenFactor ? 'media caja' : 'caja'} se asigna en
                    bloque a la sede receptora (sueltas).
                  </Text>
                  <View style={styles.remainderBox}>
                    <Text style={styles.remainderLabel}>Sede que absorbe el resto</Text>
                    <View style={styles.remainderChips}>
                      <TouchableOpacity
                        style={[
                          styles.remainderChip,
                          form.remainderRecipientId === null && styles.remainderChipActive,
                        ]}
                        onPress={() => form.setRemainderRecipientId(null)}
                      >
                        <Text
                          style={[
                            styles.remainderChipText,
                            form.remainderRecipientId === null && styles.remainderChipTextActive,
                          ]}
                        >
                          Automático (mayor brecha)
                        </Text>
                      </TouchableOpacity>
                      {form.internalRows.map((r) => (
                        <TouchableOpacity
                          key={r.participantId}
                          style={[
                            styles.remainderChip,
                            form.remainderRecipientId === r.participantId &&
                              styles.remainderChipActive,
                          ]}
                          onPress={() => form.setRemainderRecipientId(r.participantId)}
                        >
                          <Text
                            style={[
                              styles.remainderChipText,
                              form.remainderRecipientId === r.participantId &&
                                styles.remainderChipTextActive,
                            ]}
                          >
                            {r.participantName}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Stock */}
            <StockAllocationPicker
              buckets={form.stockBuckets}
              allocations={form.stockAllocations}
              onToggle={form.toggleStockBucket}
              onAllocate={form.setStockAllocation}
              total={form.totalFromAllocations}
              siteName={form.currentSite?.name}
            />

            {/* Tabla de participantes */}
            <ParticipantDistributionTable
              internalRows={form.internalRows}
              externalRows={form.externalRows}
              factor={form.presentationFactor}
              allowHalfBox={form.allowHalfBox}
              allowLoose={form.allowLoose}
              mode={form.mode}
              onChange={form.updateRowQuantities}
              onToggleLock={form.toggleRowLock}
            />

            {/* Summary */}
            <DistributionSummaryPanel
              totals={form.totals}
              stockTotal={form.totalFromAllocations}
              onRecalculate={form.recalculateRest}
              onReset={form.resetRows}
            />

            {form.error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{form.error}</Text>
              </View>
            )}
          </ScrollView>
        )}

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.generateButton,
              (form.submitting || form.loading) && styles.generateButtonDisabled,
            ]}
            disabled={form.submitting || form.loading}
            onPress={form.submit}
          >
            {form.submitting ? (
              <ActivityIndicator color={theme.color.text.inverse} />
            ) : (
              <Text style={styles.generateButtonText}>Generar reparto</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (asContent) {
    return Body;
  }

  return (
    <Modal
      visible={visible}
      animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
      transparent
      onRequestClose={onClose}
    >
      {Body}
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[3],
    },
    contentContainer: {
      flex: 1,
      padding: 0,
    },
    contentInner: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
    },
    modalContent: {
      width: '100%',
      maxWidth: 1200,
      maxHeight: '95%',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
    },
    modalContentTablet: {
      width: '95%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      gap: theme.space[2],
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.color.text.heading,
    },
    subtitle: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: 4,
    },
    strong: {
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    closeBtn: {
      padding: theme.space[1],
    },
    closeText: {
      fontSize: 20,
      color: theme.color.text.muted,
    },
    scroll: {
      flexGrow: 0,
      flexShrink: 1,
    },
    scrollContent: {
      padding: theme.space[3],
      gap: theme.space[3],
    },
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: theme.space[2],
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    typeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[2],
    },
    typeOption: {
      flex: 1,
      minWidth: 200,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[2],
      backgroundColor: theme.color.surface.subtle,
      gap: 4,
    },
    typeOptionSelected: {
      borderColor: theme.color.brand.primary,
      backgroundColor: theme.color.brand.primarySoft,
    },
    typeLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    typeLabelSelected: {
      color: theme.color.brand.primary,
    },
    typeHint: {
      fontSize: 11,
      color: theme.color.text.subtle,
    },
    modeRow: {
      flexDirection: 'row',
      gap: theme.space[2],
    },
    modeButton: {
      flex: 1,
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.subtle,
      alignItems: 'center',
    },
    modeButtonSelected: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    modeText: {
      color: theme.color.text.heading,
      fontWeight: '600',
    },
    modeTextSelected: {
      color: theme.color.text.inverse,
    },
    presentationRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[1],
    },
    presentationChip: {
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.full,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.subtle,
    },
    presentationChipSelected: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    presentationChipText: {
      fontSize: 12,
      color: theme.color.text.heading,
      fontWeight: '600',
    },
    presentationChipTextSelected: {
      color: theme.color.text.inverse,
    },
    halfBoxRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: theme.space[1],
    },
    halfBoxLabel: {
      fontSize: 13,
      color: theme.color.text.heading,
    },
    halfBoxHint: {
      fontSize: 12,
      color: theme.color.text.warning,
    },
    remainderBox: {
      marginTop: theme.space[1],
      gap: theme.space[1],
    },
    remainderLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    remainderChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[1],
    },
    remainderChip: {
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.full,
      borderWidth: 1,
      borderColor: theme.color.border.default,
      backgroundColor: theme.color.surface.subtle,
    },
    remainderChipActive: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },
    remainderChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    remainderChipTextActive: {
      color: theme.color.text.inverse,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      padding: theme.space[3],
      gap: theme.space[2],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    cancelButton: {
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    cancelButtonText: {
      color: theme.color.text.heading,
      fontWeight: '600',
    },
    generateButton: {
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.brand.primary,
      minWidth: 180,
      alignItems: 'center',
    },
    generateButtonDisabled: {
      opacity: 0.6,
    },
    generateButtonText: {
      color: theme.color.text.inverse,
      fontWeight: '700',
    },
    loadingBox: {
      padding: theme.space[7],
      alignItems: 'center',
      gap: theme.space[2],
    },
    loadingText: {
      color: theme.color.text.muted,
    },
    errorBox: {
      backgroundColor: theme.color.state.danger.background,
      borderColor: theme.color.state.danger.border,
      borderWidth: 1,
      borderRadius: theme.radii.md,
      padding: theme.space[2],
    },
    errorText: {
      color: theme.color.state.danger.text,
      fontSize: 13,
    },
  });

export default DistributionFormModalV2;
