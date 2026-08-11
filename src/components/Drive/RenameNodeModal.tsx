/**
 * RenameNodeModal
 *
 * Modal simple para renombrar una carpeta o archivo.
 */

import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, View } from 'react-native';
import { Button, Input, Text } from '@/design-system/components';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface Props {
  visible: boolean;
  initialName: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export const RenameNodeModal: React.FC<Props> = ({
  visible,
  initialName,
  loading,
  onClose,
  onSubmit,
}) => {
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (visible) setName(initialName);
  }, [visible, initialName]);

  const canSubmit = name.trim().length > 0 && !loading && name.trim() !== initialName;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.card}
        >
          <Text variant="titleMedium">Renombrar</Text>
          <Input value={name} onChangeText={setName} placeholder="Nuevo nombre" autoFocus />
          <View style={styles.actions}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} disabled={loading} />
            <Button
              title="Guardar"
              onPress={() => canSubmit && onSubmit(name.trim())}
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
      maxWidth: 420,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[5],
      gap: theme.space[3],
      ...theme.shadow.xl,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.space[2],
      marginTop: theme.space[2],
    },
  });

export default RenameNodeModal;
