/**
 * CreateSpaceModal
 *
 * Modal para crear un espacio compartido de Drive. Pide nombre y una cuota
 * (con selector de unidad MB/GB) y llama a `driveApi.createSpace`.
 * Requiere permiso `drive.manage`.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Text } from '@/design-system/components';
import { activeOpacity, iconSizes } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface Props {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (dto: { name: string; quotaBytes: number }) => void;
}

type QuotaUnit = 'MB' | 'GB' | 'TB';

const UNIT_MULT: Record<QuotaUnit, number> = {
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

const UNITS: QuotaUnit[] = ['MB', 'GB', 'TB'];

export const CreateSpaceModal: React.FC<Props> = ({ visible, loading, onClose, onSubmit }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState('');
  const [quotaText, setQuotaText] = useState('10');
  const [unit, setUnit] = useState<QuotaUnit>('GB');

  useEffect(() => {
    if (visible) {
      setName('');
      setQuotaText('10');
      setUnit('GB');
    }
  }, [visible]);

  const quotaBytes = useMemo(() => {
    const parsed = Number(quotaText.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.floor(parsed * UNIT_MULT[unit]);
  }, [quotaText, unit]);

  const canSubmit = name.trim().length > 0 && quotaBytes > 0 && !loading;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.card}
        >
          <View style={styles.headerRow}>
            <Ionicons name="people" size={iconSizes.md} color={theme.color.brand.primary} />
            <Text variant="titleMedium" style={styles.titleFlex}>
              Nuevo espacio compartido
            </Text>
            <TouchableOpacity onPress={onClose} activeOpacity={activeOpacity.medium}>
              <Ionicons name="close" size={iconSizes.md} color={theme.color.icon.default} />
            </TouchableOpacity>
          </View>

          <View>
            <Text variant="caption" color="secondary" style={styles.fieldLabel}>
              Nombre
            </Text>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Ej. Documentación de compras"
              autoFocus
            />
          </View>

          <View>
            <Text variant="caption" color="secondary" style={styles.fieldLabel}>
              Cuota de almacenamiento
            </Text>
            <View style={styles.quotaRow}>
              <View style={styles.quotaInput}>
                <Input
                  value={quotaText}
                  onChangeText={setQuotaText}
                  keyboardType="numeric"
                  placeholder="10"
                />
              </View>
              <View style={styles.unitSwitcher}>
                {UNITS.map((u) => {
                  const active = u === unit;
                  return (
                    <TouchableOpacity
                      key={u}
                      onPress={() => setUnit(u)}
                      activeOpacity={activeOpacity.medium}
                      style={[
                        styles.unitChip,
                        active && {
                          backgroundColor: `${theme.color.brand.primary}18`,
                          borderColor: theme.color.brand.primary,
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={{
                          color: active ? theme.color.brand.primary : theme.color.text.body,
                          fontWeight: '600',
                        }}
                      >
                        {u}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <Text variant="caption" color="secondary" style={styles.help}>
              Los usuarios que compartas podrán subir hasta este límite en total.
            </Text>
          </View>

          <View style={styles.actions}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} disabled={loading} />
            <Button
              title="Crear"
              onPress={() => onSubmit({ name: name.trim(), quotaBytes })}
              disabled={!canSubmit}
              loading={loading}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[4],
    },
    card: {
      width: '100%',
      maxWidth: 460,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[5],
      gap: theme.space[3],
      ...theme.shadow.xl,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    titleFlex: { flex: 1 },
    fieldLabel: { marginBottom: 4 },
    quotaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    quotaInput: { flex: 1 },
    unitSwitcher: {
      flexDirection: 'row',
      gap: 4,
    },
    unitChip: {
      paddingHorizontal: theme.space[3],
      paddingVertical: 8,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    help: {
      marginTop: 4,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.space[2],
      marginTop: theme.space[2],
    },
  });

export default CreateSpaceModal;
