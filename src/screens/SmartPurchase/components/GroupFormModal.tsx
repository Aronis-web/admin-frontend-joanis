/**
 * GroupFormModal
 *
 * Modal para crear/editar un grupo de compra inteligente.
 * En creación permite seleccionar proveedores iniciales via SupplierPickerModal.
 */
import React, { useEffect, useMemo, useState } from 'react';
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
import {
  useCreateSmartPurchaseGroup,
  useUpdateSmartPurchaseGroup,
} from '@/hooks/api/useSmartPurchase';
import type {
  CreateGroupDto,
  SmartPurchaseGroupWithSuppliers,
  UpdateGroupDto,
} from '@/types/smartPurchase';
import { SupplierPickerModal } from './SupplierPickerModal';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Cuando existe → modo edición; sin este valor → modo creación. */
  group?: SmartPurchaseGroupWithSuppliers;
  onSaved?: (group: SmartPurchaseGroupWithSuppliers) => void;
}

interface FormState {
  name: string;
  coverageDays: string;
  leadTimeDays: string;
  safetyDays: string;
  analysisWindowDays: string;
  notes: string;
  isEnabled: boolean;
  supplierIds: string[];
}

const DEFAULT_FORM: FormState = {
  name: '',
  coverageDays: '14',
  leadTimeDays: '7',
  safetyDays: '3',
  analysisWindowDays: '90',
  notes: '',
  isEnabled: true,
  supplierIds: [],
};

export const GroupFormModal: React.FC<Props> = ({ visible, onClose, group, onSaved }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const isEdit = !!group;

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [supplierPickerVisible, setSupplierPickerVisible] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const createGroup = useCreateSmartPurchaseGroup();
  const updateGroup = useUpdateSmartPurchaseGroup();
  const saving = createGroup.isPending || updateGroup.isPending;

  useEffect(() => {
    if (!visible) return;
    if (group) {
      setForm({
        name: group.name,
        coverageDays: String(group.coverageDays),
        leadTimeDays: String(group.leadTimeDays),
        safetyDays: String(group.safetyDays),
        analysisWindowDays: String(group.analysisWindowDays),
        notes: group.notes ?? '',
        isEnabled: group.isEnabled,
        supplierIds: group.suppliers.map((s) => s.supplierId),
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setErrors({});
  }, [visible, group]);

  const parseInt = (s: string): number | null => {
    if (!s.trim()) return null;
    const n = Number(s);
    return Number.isFinite(n) && Number.isInteger(n) ? n : null;
  };

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) nextErrors.name = 'Requerido';
    if (form.name.length > 255) nextErrors.name = 'Máximo 255 caracteres';
    const cov = parseInt(form.coverageDays);
    if (cov === null || cov < 1) nextErrors.coverageDays = 'Entero ≥ 1';
    const lead = parseInt(form.leadTimeDays);
    if (lead === null || lead < 0) nextErrors.leadTimeDays = 'Entero ≥ 0';
    const safety = parseInt(form.safetyDays);
    if (safety === null || safety < 0) nextErrors.safetyDays = 'Entero ≥ 0';
    const win = parseInt(form.analysisWindowDays);
    if (win === null || win < 1) nextErrors.analysisWindowDays = 'Entero ≥ 1';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      if (isEdit && group) {
        const dto: UpdateGroupDto = {
          name: form.name.trim(),
          coverageDays: Number(form.coverageDays),
          leadTimeDays: Number(form.leadTimeDays),
          safetyDays: Number(form.safetyDays),
          analysisWindowDays: Number(form.analysisWindowDays),
          notes: form.notes.trim() || undefined,
          isEnabled: form.isEnabled,
        };
        const updated = await updateGroup.mutateAsync({ id: group.id, data: dto });
        onSaved?.(updated);
      } else {
        const dto: CreateGroupDto = {
          name: form.name.trim(),
          coverageDays: Number(form.coverageDays),
          leadTimeDays: Number(form.leadTimeDays),
          safetyDays: Number(form.safetyDays),
          analysisWindowDays: Number(form.analysisWindowDays),
          notes: form.notes.trim() || undefined,
          supplierIds: form.supplierIds.length > 0 ? form.supplierIds : undefined,
        };
        const created = await createGroup.mutateAsync(dto);
        onSaved?.(created);
      }
      onClose();
    } catch (err: any) {
      logger.error('GroupFormModal save error', err);
      Alert.alert(
        'Error',
        err?.response?.data?.message ?? err?.message ?? 'No se pudo guardar el grupo.'
      );
    }
  };

  const supplierCountLabel = useMemo(() => {
    if (isEdit) return `${group?.suppliers.length ?? 0} en el grupo (gestionar desde el detalle)`;
    if (form.supplierIds.length === 0) return 'Sin proveedores iniciales';
    return `${form.supplierIds.length} proveedor(es) seleccionado(s)`;
  }, [isEdit, group, form.supplierIds]);

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Title>{isEdit ? 'Editar grupo' : 'Nuevo grupo'}</Title>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={theme.color.text.body} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
              <Input
                label="Nombre"
                required
                placeholder="Ej. Importadores mochilas"
                value={form.name}
                onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
                error={errors.name}
                maxLength={255}
              />

              <View style={styles.row3}>
                <View style={styles.rowItem}>
                  <Input
                    label="Cobertura (días)"
                    keyboardType="number-pad"
                    value={form.coverageDays}
                    onChangeText={(v) => setForm((p) => ({ ...p, coverageDays: v }))}
                    error={errors.coverageDays}
                  />
                </View>
                <View style={styles.rowItem}>
                  <Input
                    label="Lead time"
                    keyboardType="number-pad"
                    value={form.leadTimeDays}
                    onChangeText={(v) => setForm((p) => ({ ...p, leadTimeDays: v }))}
                    error={errors.leadTimeDays}
                  />
                </View>
                <View style={styles.rowItem}>
                  <Input
                    label="Seguridad"
                    keyboardType="number-pad"
                    value={form.safetyDays}
                    onChangeText={(v) => setForm((p) => ({ ...p, safetyDays: v }))}
                    error={errors.safetyDays}
                  />
                </View>
              </View>

              <Input
                label="Ventana de análisis (días)"
                keyboardType="number-pad"
                helperText="Ventana usada para métricas de venta/compra (default 90)."
                value={form.analysisWindowDays}
                onChangeText={(v) => setForm((p) => ({ ...p, analysisWindowDays: v }))}
                error={errors.analysisWindowDays}
              />

              <Input
                label="Notas"
                placeholder="Opcional"
                value={form.notes}
                onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))}
                multiline
              />

              {isEdit ? (
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setForm((p) => ({ ...p, isEnabled: !p.isEnabled }))}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: '600' }}>Grupo habilitado</Body>
                    <Caption color="muted">
                      Si está deshabilitado no se generarán órdenes automáticas.
                    </Caption>
                  </View>
                  <Ionicons
                    name={form.isEnabled ? 'toggle' : 'toggle-outline'}
                    size={32}
                    color={form.isEnabled ? theme.color.brand.primary : theme.color.text.muted}
                  />
                </TouchableOpacity>
              ) : (
                <View style={styles.suppliersBlock}>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: '600' }}>Proveedores iniciales</Body>
                    <Caption color="muted">{supplierCountLabel}</Caption>
                  </View>
                  <Button
                    title={form.supplierIds.length > 0 ? 'Editar' : 'Elegir'}
                    variant="outline"
                    onPress={() => setSupplierPickerVisible(true)}
                    leftIcon="people-outline"
                  />
                </View>
              )}

              {isEdit && (
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={18} color={theme.color.text.muted} />
                  <Caption color="muted" style={{ flex: 1 }}>
                    Los proveedores se agregan y quitan desde el detalle del grupo.
                  </Caption>
                </View>
              )}
            </ScrollView>

            <View style={styles.footer}>
              {!isEdit && form.supplierIds.length > 0 && (
                <Badge variant="info" label={`${form.supplierIds.length} proveedor(es)`} />
              )}
              <View style={{ flex: 1 }} />
              <Button title="Cancelar" variant="ghost" onPress={onClose} disabled={saving} />
              <Button
                title={isEdit ? 'Guardar cambios' : 'Crear grupo'}
                variant="primary"
                onPress={handleSave}
                loading={saving}
                disabled={saving}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {!isEdit && (
        <SupplierPickerModal
          visible={supplierPickerVisible}
          onClose={() => setSupplierPickerVisible(false)}
          onConfirm={(ids) => {
            setForm((p) => ({ ...p, supplierIds: ids }));
            setSupplierPickerVisible(false);
          }}
          initialSelectedIds={form.supplierIds}
          title="Proveedores iniciales"
          confirmLabel="Confirmar selección"
        />
      )}
    </>
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
      paddingTop: spacing[4],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[6],
      paddingBottom: spacing[2],
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
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing[4],
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.subtle,
      gap: spacing[4],
    },
    suppliersBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing[4],
      borderRadius: borderRadius.md,
      backgroundColor: theme.color.surface.subtle,
      gap: spacing[4],
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing[2],
      padding: spacing[2],
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing[6],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border.subtle,
      gap: spacing[2],
    },
  });
