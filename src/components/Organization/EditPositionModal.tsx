import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { organizationApi } from '@/services/api/organization';
import { PositionTreeNode } from '@/types/organization';

interface EditPositionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  position: PositionTreeNode;
}

export const EditPositionModal: React.FC<EditPositionModalProps> = ({
  visible,
  onClose,
  onSuccess,
  position,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    maxOccupants: '',
    minOccupants: '',
    isActive: true,
    displayOrder: '',
  });

  useEffect(() => {
    if (visible && position) {
      setFormData({
        name: position.name || '',
        description: position.description || '',
        maxOccupants: position.maxOccupants?.toString() || '',
        minOccupants: position.minOccupants?.toString() || '1',
        isActive: position.isActive !== false,
        displayOrder: position.displayOrder?.toString() || '1',
      });
    }
  }, [visible, position]);

  const handleSubmit = async () => {
    // Validation
    if (!formData.name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    try {
      setLoading(true);

      const requestData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        maxOccupants: formData.maxOccupants ? parseInt(formData.maxOccupants) : null,
        minOccupants: parseInt(formData.minOccupants) || 1,
        isActive: formData.isActive,
        displayOrder: parseInt(formData.displayOrder) || 1,
      };

      await organizationApi.updatePosition(position.id, requestData);

      Alert.alert('Éxito', 'Puesto actualizado correctamente');
      onSuccess();
    } catch (error: any) {
      console.error('Error updating position:', error);
      Alert.alert('Error', error.response?.data?.message || 'Error al actualizar el puesto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Editar Puesto</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.positionInfo}>
              <Text style={styles.positionCode}>Código: {position.code}</Text>
              <Text style={styles.positionLevel}>Nivel: {position.level}</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Nombre <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Nombre del puesto"
                placeholderTextColor={theme.color.text.placeholder}
                editable={!loading}
                keyboardType="default"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Descripción del puesto"
                placeholderTextColor={theme.color.text.placeholder}
                keyboardType="default"
                multiline
                numberOfLines={3}
                editable={!loading}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>Mínimo de ocupantes</Text>
                <TextInput
                  style={styles.input}
                  value={formData.minOccupants}
                  onChangeText={(text) => setFormData({ ...formData, minOccupants: text })}
                  placeholder="1"
                  placeholderTextColor={theme.color.text.placeholder}
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>

              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>Máximo de ocupantes</Text>
                <TextInput
                  style={styles.input}
                  value={formData.maxOccupants}
                  onChangeText={(text) => setFormData({ ...formData, maxOccupants: text })}
                  placeholder="Ilimitado"
                  placeholderTextColor={theme.color.text.placeholder}
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Orden de visualización</Text>
              <TextInput
                style={styles.input}
                value={formData.displayOrder}
                onChangeText={(text) => setFormData({ ...formData, displayOrder: text })}
                placeholder="1"
                placeholderTextColor={theme.color.text.placeholder}
                keyboardType="numeric"
                editable={!loading}
              />
            </View>

            <View style={styles.switchGroup}>
              <View style={styles.switchLabelContainer}>
                <Text style={styles.label}>Estado activo</Text>
                <Text style={styles.switchDescription}>
                  {formData.isActive
                    ? 'El puesto está activo y visible'
                    : 'El puesto está inactivo'}
                </Text>
              </View>
              <Switch
                value={formData.isActive}
                onValueChange={(value) => setFormData({ ...formData, isActive: value })}
                disabled={loading}
                trackColor={{
                  false: theme.color.border.default,
                  true: theme.color.brand.accent,
                }}
                thumbColor={
                  formData.isActive ? theme.color.text.onAction : theme.color.surface.muted
                }
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.color.text.onAction} />
              ) : (
                <Text style={styles.submitButtonText}>Guardar Cambios</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      width: '90%',
      maxWidth: 500,
      maxHeight: '80%',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    closeButton: {
      fontSize: 24,
      color: theme.color.text.muted,
      padding: 4,
    },
    modalContent: {
      padding: 20,
    },
    positionInfo: {
      backgroundColor: theme.color.surface.muted,
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      marginBottom: theme.space[4],
    },
    positionCode: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.body,
      marginBottom: theme.space[1],
    },
    positionLevel: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    formGroup: {
      marginBottom: theme.space[4],
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.body,
      marginBottom: theme.space[2],
    },
    required: {
      color: theme.color.text.danger,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      fontSize: 16,
      color: theme.color.text.heading,
      backgroundColor: theme.color.surface.base,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    row: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    halfWidth: {
      flex: 1,
    },
    switchGroup: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      marginTop: theme.space[2],
    },
    switchLabelContainer: {
      flex: 1,
      marginRight: theme.space[3],
    },
    switchDescription: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: theme.space[1],
    },
    modalFooter: {
      flexDirection: 'row',
      padding: theme.space[5],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      gap: theme.space[3],
    },
    button: {
      flex: 1,
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: theme.color.surface.muted,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    submitButton: {
      backgroundColor: theme.color.brand.accent,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
  });

export default EditPositionModal;
