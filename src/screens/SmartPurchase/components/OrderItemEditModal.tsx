/**
 * OrderItemEditModal
 *
 * Modal para editar una línea de orden en DRAFT:
 *  - finalPresentations (recalcula finalUnits en backend usando factorToBase),
 *  - excluded (excluir del pedido sin borrar la línea),
 *  - notes.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  Badge,
  Body,
  Button,
  Caption,
  Input,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import { useUpdateOrderItem } from '@/hooks/api/useSmartPurchase';
import type { SmartPurchaseOrderItem } from '@/types/smartPurchase';
import { formatCents, formatNumber } from '../helpers';

interface Props {
  visible: boolean;
  orderId: string;
  item: SmartPurchaseOrderItem | null;
  onClose: () => void;
  onSaved?: () => void;
}

export const OrderItemEditModal: React.FC<Props> = ({
  visible,
  orderId,
  item,
  onClose,
  onSaved,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [finalPresentations, setFinalPresentations] = useState('');
  const [excluded, setExcluded] = useState(false);
  const [notes, setNotes] = useState('');

  const updateItem = useUpdateOrderItem();

  useEffect(() => {
    if (item) {
      setFinalPresentations(String(item.finalPresentations ?? 0));
      setExcluded(item.excluded);
      setNotes(item.notes ?? '');
    }
  }, [item]);

  if (!item) return null;

  const parseFP = (): number | null => {
    if (!finalPresentations.trim()) return null;
    const n = Number(finalPresentations);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const previewUnits = () => {
    const n = parseFP();
    if (n === null) return '—';
    return formatNumber(n * item.factorToBase, 0);
  };

  const handleSave = async () => {
    const fp = parseFP();
    if (fp === null) {
      Alert.alert('Cantidad inválida', 'Ingresa un número ≥ 0.');
      return;
    }
    try {
      await updateItem.mutateAsync({
        orderId,
        itemId: item.id,
        data: {
          finalPresentations: fp,
          excluded,
          notes: notes.trim() || undefined,
        },
      });
      onSaved?.();
      onClose();
    } catch (err: any) {
      logger.error('OrderItemEditModal save error', err);
      const msg = err?.response?.data?.message ?? err?.message ?? 'No se pudo actualizar el item.';
      Alert.alert('Error', String(msg));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Title>Editar item</Title>
              <Caption color="muted" numberOfLines={2}>
                {item.title}
              </Caption>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={theme.color.text.body} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.metricsRow}>
              <Metric label="Sugerido" value={formatNumber(item.suggestedUnits)} />
              <Metric label="Stock sede" value={formatNumber(item.stockSiteUnits)} />
              <Metric label="Venta 30d" value={formatNumber(item.sales30d)} />
              <Metric label="Costo unit." value={formatCents(item.unitCostCents)} />
            </View>

            <Input
              label={`Presentaciones (factor ×${item.factorToBase})`}
              keyboardType="decimal-pad"
              value={finalPresentations}
              onChangeText={setFinalPresentations}
              helperText={`Total unidades: ${previewUnits()}`}
            />

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setExcluded((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '600' }}>Excluir del pedido</Body>
                <Caption color="muted">
                  El item se conserva en la orden pero no cuenta para totales.
                </Caption>
              </View>
              <Ionicons
                name={excluded ? 'toggle' : 'toggle-outline'}
                size={32}
                color={excluded ? theme.color.text.warning : theme.color.text.muted}
              />
            </TouchableOpacity>

            <Input
              label="Notas"
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Opcional"
            />

            {item.isManualOverride && (
              <View style={styles.badgeRow}>
                <Badge variant="info" label="Ajuste manual" />
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={onClose}
              disabled={updateItem.isPending}
            />
            <Button
              title="Guardar"
              variant="primary"
              onPress={handleSave}
              loading={updateItem.isPending}
              leftIcon="save-outline"
            />
          </View>
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
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[6],
      gap: spacing[4],
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
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing[4],
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.subtle,
      gap: spacing[4],
    },
    badgeRow: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: spacing[6],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.subtle,
      gap: spacing[2],
    },
  });
