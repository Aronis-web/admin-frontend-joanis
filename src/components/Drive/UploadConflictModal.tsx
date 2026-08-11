/**
 * UploadConflictModal
 *
 * Modal que se abre cuando el usuario intenta subir un archivo cuyo nombre
 * ya existe en la carpeta/espacio actual. Ofrece tres opciones:
 *  - Reemplazar (sube como nueva versión del archivo existente).
 *  - Renombrar (usa el nombre editable, pre-sugerido con " (n)").
 *  - Cancelar.
 */

import React, { useEffect, useState } from 'react';
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

export type UploadConflictChoice =
  | { action: 'replace' }
  | { action: 'rename'; name: string }
  | { action: 'cancel' };

interface Props {
  visible: boolean;
  originalName: string;
  suggestedName: string;
  /** Si el archivo existente es una carpeta (raro pero posible) → sin "Reemplazar". */
  existingIsFolder?: boolean;
  onResolve: (choice: UploadConflictChoice) => void;
}

export const UploadConflictModal: React.FC<Props> = ({
  visible,
  originalName,
  suggestedName,
  existingIsFolder = false,
  onResolve,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState(suggestedName);

  useEffect(() => {
    if (visible) setName(suggestedName);
  }, [visible, suggestedName]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => onResolve({ action: 'cancel' })}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Ionicons
              name="alert-circle-outline"
              size={iconSizes.md}
              color={theme.color.state.warning.text}
            />
            <Text variant="titleSmall" style={styles.titleFlex}>
              Archivo con el mismo nombre
            </Text>
            <TouchableOpacity
              onPress={() => onResolve({ action: 'cancel' })}
              activeOpacity={activeOpacity.medium}
            >
              <Ionicons name="close" size={iconSizes.md} color={theme.color.icon.default} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text variant="bodyMedium">
              Ya existe un elemento llamado{' '}
              <Text variant="bodyMedium" style={styles.bold}>
                {originalName}
              </Text>{' '}
              en esta ubicación. ¿Qué quieres hacer?
            </Text>

            <View>
              <Text variant="caption" color="secondary" style={styles.fieldLabel}>
                Nuevo nombre (si eliges renombrar)
              </Text>
              <Input
                value={name}
                onChangeText={setName}
                placeholder="Nombre del archivo"
                autoFocus
              />
            </View>
          </View>

          <View style={styles.actions}>
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => onResolve({ action: 'cancel' })}
            />
            <Button
              title="Renombrar"
              variant="secondary"
              onPress={() => {
                const trimmed = name.trim();
                if (trimmed.length === 0) return;
                onResolve({ action: 'rename', name: trimmed });
              }}
              disabled={name.trim().length === 0}
            />
            {!existingIsFolder && (
              <Button
                title="Reemplazar"
                variant="primary"
                onPress={() => onResolve({ action: 'replace' })}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.space[4],
    },
    card: {
      width: '100%',
      maxWidth: 480,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
      ...theme.shadow.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      paddingHorizontal: theme.space[4],
      paddingTop: theme.space[4],
      paddingBottom: theme.space[2],
    },
    titleFlex: { flex: 1 },
    body: {
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      gap: theme.space[3],
    },
    bold: { fontWeight: '700' },
    fieldLabel: { marginBottom: 4 },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.space[2],
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      flexWrap: 'wrap',
    },
  });

export default UploadConflictModal;
