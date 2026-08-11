import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Input, Text } from '@/design-system/components';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface Props {
  visible: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export const NewFolderModal: React.FC<Props> = ({ visible, loading, onClose, onSubmit }) => {
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!visible) setName('');
  }, [visible]);

  const canSubmit = name.trim().length > 0 && !loading;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.card}
        >
          <Text variant="titleMedium" style={styles.title}>
            Nueva carpeta
          </Text>
          <Input placeholder="Nombre de la carpeta" value={name} onChangeText={setName} autoFocus />
          <View style={styles.actions}>
            <Button title="Cancelar" variant="ghost" onPress={onClose} disabled={loading} />
            <Button
              title="Crear"
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
    title: {
      marginBottom: theme.space[1],
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: theme.space[2],
      marginTop: theme.space[2],
    },
  });

export default NewFolderModal;
