/**
 * FamilyDetailModal
 *
 * Modal para inspeccionar y gestionar una familia:
 *   - editar título / marcar producto canónico,
 *   - bloquear con % descuento requerido (o desbloquear),
 *   - ver miembros y removerlos.
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

import { ProtectedView } from '@/components/ui/ProtectedView';
import {
  Badge,
  Body,
  Button,
  Caption,
  Divider,
  Input,
  Title,
  useTheme,
  useThemedStyles,
} from '@/design-system';
import type { Theme } from '@/design-system/themes';
import { borderRadius, spacing } from '@/design-system/tokens';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import {
  useBlockFamily,
  useFamily,
  useRemoveFamilyMember,
  useUnblockFamily,
  useUpdateFamily,
} from '@/hooks/api/useSmartPurchase';
import type { FamilyMember } from '@/types/smartPurchase';
import { FAMILY_STATUS_COLOR, FAMILY_STATUS_LABEL, formatDateTime } from '../helpers';

interface Props {
  visible: boolean;
  familyId: string | undefined;
  groupId: string;
  onClose: () => void;
}

export const FamilyDetailModal: React.FC<Props> = ({ visible, familyId, onClose }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const { data: family, isLoading, isError, refetch } = useFamily(visible ? familyId : undefined);
  const updateFamily = useUpdateFamily();
  const blockFamily = useBlockFamily();
  const unblockFamily = useUnblockFamily();
  const removeMember = useRemoveFamilyMember();

  const [title, setTitle] = useState('');
  const [canonicalProductId, setCanonicalProductId] = useState<string | undefined>();
  const [discountText, setDiscountText] = useState('20');
  const [reason, setReason] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);

  useEffect(() => {
    if (family) {
      setTitle(family.title);
      setCanonicalProductId(family.canonicalProductId ?? undefined);
      setDiscountText(String(family.requiredDiscountPct ?? 20));
      setReason(family.blockedReason ?? '');
      setShowBlockForm(false);
    }
  }, [family]);

  const isDirty = useMemo(() => {
    if (!family) return false;
    return (
      title.trim() !== family.title ||
      (canonicalProductId ?? null) !== (family.canonicalProductId ?? null)
    );
  }, [family, title, canonicalProductId]);

  const handleSave = async () => {
    if (!family) return;
    try {
      await updateFamily.mutateAsync({
        id: family.id,
        data: {
          title: title.trim(),
          canonicalProductId,
        },
      });
    } catch (err: any) {
      logger.error('FamilyDetailModal save error', err);
      Alert.alert('Error', err?.message ?? 'No se pudo guardar la familia.');
    }
  };

  const handleBlock = async () => {
    if (!family) return;
    const pct = Number(discountText);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      Alert.alert('Descuento inválido', 'Ingresa un valor entre 0 y 100.');
      return;
    }
    try {
      await blockFamily.mutateAsync({
        id: family.id,
        data: { requiredDiscountPct: pct, reason: reason.trim() || undefined },
      });
      setShowBlockForm(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo bloquear la familia.');
    }
  };

  const handleUnblock = async () => {
    if (!family) return;
    try {
      await unblockFamily.mutateAsync(family.id);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'No se pudo desbloquear la familia.');
    }
  };

  const handleRemoveMember = (member: FamilyMember) => {
    if (!family) return;
    if (member.isCanonical) {
      Alert.alert(
        'No permitido',
        'No puedes quitar el producto canónico. Marca otro como canónico primero.'
      );
      return;
    }
    Alert.alert('Quitar producto', `¿Quitar "${member.title}" de la familia?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember.mutateAsync({ id: family.id, productId: member.productId });
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'No se pudo quitar el producto.');
          }
        },
      },
    ]);
  };

  const handleMarkCanonical = (member: FamilyMember) => {
    setCanonicalProductId(member.productId);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Title>Familia</Title>
              {family && (
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: FAMILY_STATUS_COLOR[family.status] },
                    ]}
                  />
                  <Caption color="muted">
                    {FAMILY_STATUS_LABEL[family.status]} · Score {family.score.toFixed(1)}
                  </Caption>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={theme.color.text.body} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.color.brand.primary} />
            </View>
          ) : isError || !family ? (
            <View style={styles.centered}>
              <Body color="danger">No se pudo cargar la familia.</Body>
              <TouchableOpacity onPress={() => refetch()} style={{ marginTop: spacing[2] }}>
                <Body color="link">Reintentar</Body>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              <Input
                label="Título canónico"
                value={title}
                onChangeText={setTitle}
                placeholder="Título de la familia"
              />
              <Caption color="muted">SKU normalizado: {family.normalizedSku}</Caption>

              {family.status === 'BLOCKED' && (
                <View style={styles.blockedBox}>
                  <Ionicons name="lock-closed" size={18} color={theme.color.text.warning} />
                  <View style={{ flex: 1 }}>
                    <Body size="small" style={{ fontWeight: '600' }}>
                      Bloqueada · requiere {family.requiredDiscountPct ?? 0}% de descuento
                    </Body>
                    {family.blockedReason ? (
                      <Caption color="muted">{family.blockedReason}</Caption>
                    ) : null}
                  </View>
                </View>
              )}

              <ProtectedView requiredPermissions={['smart_purchase.products.manage']}>
                <View style={styles.actionsRow}>
                  <Button
                    title="Guardar"
                    variant="primary"
                    onPress={handleSave}
                    loading={updateFamily.isPending}
                    disabled={!isDirty || updateFamily.isPending}
                    leftIcon="save-outline"
                    size="small"
                  />
                  {family.status === 'BLOCKED' ? (
                    <Button
                      title="Desbloquear"
                      variant="outline"
                      onPress={handleUnblock}
                      loading={unblockFamily.isPending}
                      leftIcon="lock-open-outline"
                      size="small"
                    />
                  ) : (
                    <Button
                      title={showBlockForm ? 'Cancelar' : 'Bloquear'}
                      variant="outline"
                      onPress={() => setShowBlockForm((v) => !v)}
                      leftIcon="lock-closed-outline"
                      size="small"
                    />
                  )}
                </View>
              </ProtectedView>

              {showBlockForm && family.status !== 'BLOCKED' && (
                <View style={styles.blockForm}>
                  <Input
                    label="Descuento requerido (%)"
                    keyboardType="decimal-pad"
                    value={discountText}
                    onChangeText={setDiscountText}
                    helperText="Entre 0 y 100"
                  />
                  <Input
                    label="Motivo (opcional)"
                    value={reason}
                    onChangeText={setReason}
                    multiline
                    placeholder="Ej. Sobrestock, solo con descuento"
                  />
                  <Button
                    title="Confirmar bloqueo"
                    variant="danger"
                    onPress={handleBlock}
                    loading={blockFamily.isPending}
                    leftIcon="lock-closed"
                  />
                </View>
              )}

              <Divider />

              <Body style={{ fontWeight: '600' }}>Miembros ({family.members.length})</Body>
              {family.members.length === 0 ? (
                <Caption color="muted">Sin productos vinculados.</Caption>
              ) : (
                family.members.map((m) => {
                  const isCanonical =
                    m.isCanonical ||
                    (canonicalProductId !== undefined && canonicalProductId === m.productId);
                  return (
                    <View key={m.productId} style={styles.memberRow}>
                      <View style={{ flex: 1 }}>
                        <Body size="small" style={{ fontWeight: '600' }} numberOfLines={2}>
                          {m.title}
                        </Body>
                        <Caption color="muted">
                          {m.sku ? `SKU ${m.sku} · ` : ''}
                          {m.source === 'MANUAL' ? 'Manual' : 'Auto'} ·{' '}
                          {formatDateTime(m.createdAt)}
                        </Caption>
                      </View>
                      {isCanonical ? (
                        <Badge variant="success" label="Canónico" />
                      ) : (
                        <ProtectedView requiredPermissions={['smart_purchase.products.manage']}>
                          <TouchableOpacity
                            onPress={() => handleMarkCanonical(m)}
                            hitSlop={8}
                            style={styles.iconBtn}
                          >
                            <Ionicons
                              name="star-outline"
                              size={18}
                              color={theme.color.icon.muted}
                            />
                          </TouchableOpacity>
                        </ProtectedView>
                      )}
                      <ProtectedView requiredPermissions={['smart_purchase.products.manage']}>
                        <TouchableOpacity
                          onPress={() => handleRemoveMember(m)}
                          hitSlop={8}
                          style={styles.iconBtn}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color={theme.color.icon.danger}
                          />
                        </TouchableOpacity>
                      </ProtectedView>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
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
      maxHeight: '92%',
      minHeight: '60%',
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
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      marginTop: 2,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    content: {
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[8],
      gap: spacing[3],
    },
    actionsRow: {
      flexDirection: 'row',
      gap: spacing[2],
      flexWrap: 'wrap',
    },
    blockForm: {
      padding: spacing[4],
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.subtle,
      gap: spacing[3],
    },
    blockedBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      padding: spacing[3],
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.state.warning.background,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      paddingVertical: spacing[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border.subtle,
    },
    iconBtn: {
      padding: spacing[1],
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 180,
    },
  });
