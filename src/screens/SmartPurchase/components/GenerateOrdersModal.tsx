/**
 * GenerateOrdersModal
 *
 * Modal para generar órdenes sugeridas de un grupo, con:
 *   - selector multi-sede (opcional; vacío = todas las sedes con ventas),
 *   - overrides de coverageDays / leadTimeDays / safetyDays.
 */
import React, { useEffect, useMemo, useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';

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
import { sitesApi } from '@/services/api';
import { useGenerateOrders } from '@/hooks/api/useSmartPurchase';
import type { GenerateOrdersDto, SmartPurchaseGroup } from '@/types/smartPurchase';
import type { Site } from '@/types/sites';

interface Props {
  visible: boolean;
  onClose: () => void;
  group: SmartPurchaseGroup;
  onGenerated?: (orderCount: number) => void;
}

export const GenerateOrdersModal: React.FC<Props> = ({ visible, onClose, group, onGenerated }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<string>>(new Set());
  const [coverage, setCoverage] = useState(String(group.coverageDays));
  const [lead, setLead] = useState(String(group.leadTimeDays));
  const [safety, setSafety] = useState(String(group.safetyDays));

  const generateOrders = useGenerateOrders();

  useEffect(() => {
    if (!visible) return;
    setSelectedSiteIds(new Set());
    setCoverage(String(group.coverageDays));
    setLead(String(group.leadTimeDays));
    setSafety(String(group.safetyDays));
  }, [visible, group]);

  const { data: sitesRes, isLoading: sitesLoading } = useQuery({
    queryKey: ['smart-purchase', 'sites-picker'],
    queryFn: () => sitesApi.getSites({ isActive: true, limit: 200 }),
    enabled: visible,
    staleTime: 5 * 60 * 1000,
  });

  const sites: Site[] = useMemo(() => sitesRes?.data ?? [], [sitesRes]);

  const toggleSite = (id: string) => {
    setSelectedSiteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const parseIntOrNull = (s: string): number | null => {
    if (!s.trim()) return null;
    const n = Number(s);
    return Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? n : null;
  };

  const handleGenerate = async () => {
    const cov = parseIntOrNull(coverage);
    const l = parseIntOrNull(lead);
    const s = parseIntOrNull(safety);
    if (cov === null || cov < 1 || l === null || s === null) {
      Alert.alert(
        'Parámetros inválidos',
        'Revisa cobertura (≥1), lead time (≥0) y seguridad (≥0).'
      );
      return;
    }
    const dto: GenerateOrdersDto = {
      groupId: group.id,
      coverageDays: cov,
      leadTimeDays: l,
      safetyDays: s,
    };
    if (selectedSiteIds.size > 0) {
      dto.siteIds = Array.from(selectedSiteIds);
    }
    try {
      const orders = await generateOrders.mutateAsync(dto);
      onGenerated?.(orders.length);
      onClose();
      Alert.alert(
        'Órdenes generadas',
        `Se generaron ${orders.length} orden(es) en estado borrador.`
      );
    } catch (err: any) {
      logger.error('GenerateOrdersModal error', err);
      const msg = err?.response?.data?.message ?? err?.message ?? 'No se pudieron generar órdenes.';
      Alert.alert('Error', String(msg));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Title>Generar órdenes</Title>
              <Caption color="muted">{group.name}</Caption>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={theme.color.text.body} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.row3}>
              <View style={styles.rowItem}>
                <Input
                  label="Cobertura (días)"
                  keyboardType="number-pad"
                  value={coverage}
                  onChangeText={setCoverage}
                />
              </View>
              <View style={styles.rowItem}>
                <Input
                  label="Lead time"
                  keyboardType="number-pad"
                  value={lead}
                  onChangeText={setLead}
                />
              </View>
              <View style={styles.rowItem}>
                <Input
                  label="Seguridad"
                  keyboardType="number-pad"
                  value={safety}
                  onChangeText={setSafety}
                />
              </View>
            </View>

            <View style={styles.sitesHeader}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '600' }}>Sedes</Body>
                <Caption color="muted">
                  Si no seleccionas ninguna, se generará una orden por cada sede con ventas.
                </Caption>
              </View>
              {selectedSiteIds.size > 0 && (
                <Badge variant="info" label={`${selectedSiteIds.size} sede(s)`} />
              )}
            </View>

            {sitesLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator color={theme.color.brand.primary} />
              </View>
            ) : sites.length === 0 ? (
              <Caption color="muted">No hay sedes activas.</Caption>
            ) : (
              <View style={styles.siteList}>
                {sites.map((s) => {
                  const isSelected = selectedSiteIds.has(s.id);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => toggleSite(s.id)}
                      style={[styles.siteRow, isSelected && styles.siteRowSelected]}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Body size="small" style={{ fontWeight: '600' }} numberOfLines={1}>
                          {s.name}
                        </Body>
                        <Caption color="muted">
                          {s.code}
                          {s.district ? ` · ${s.district}` : ''}
                        </Caption>
                      </View>
                      <View
                        style={[
                          styles.check,
                          {
                            borderColor: isSelected
                              ? theme.color.brand.primary
                              : theme.color.border.default,
                            backgroundColor: isSelected ? theme.color.brand.primary : 'transparent',
                          },
                        ]}
                      >
                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={onClose}
              disabled={generateOrders.isPending}
            />
            <Button
              title="Generar"
              variant="primary"
              onPress={handleGenerate}
              loading={generateOrders.isPending}
              leftIcon="clipboard-outline"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
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
    row3: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    rowItem: {
      flex: 1,
    },
    sitesHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[2],
    },
    siteList: {
      gap: spacing[1],
    },
    siteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingVertical: spacing[3],
      paddingHorizontal: spacing[3],
      borderRadius: borderRadius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border.subtle,
    },
    siteRowSelected: {
      backgroundColor: theme.color.surface.subtle,
      borderColor: theme.color.brand.primary,
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centered: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 120,
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
