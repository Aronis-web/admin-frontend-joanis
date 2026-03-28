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
import { colors, spacing, borderRadius } from '@/design-system/tokens';
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
                trackColor={{ false: colors.neutral[300], true: colors.accent[500] }}
                thumbColor={formData.isActive ? colors.neutral[0] : colors.neutral[100]}
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
                <ActivityIndicator color={colors.neutral[0]} />
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.neutral[900],
  },
  closeButton: {
    fontSize: 24,
    color: colors.neutral[500],
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  positionInfo: {
    backgroundColor: colors.neutral[100],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
  },
  positionCode: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
    marginBottom: spacing[1],
  },
  positionLevel: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  formGroup: {
    marginBottom: spacing[4],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
    marginBottom: spacing[2],
  },
  required: {
    color: colors.danger[600],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    fontSize: 16,
    color: colors.neutral[900],
    backgroundColor: colors.neutral[0],
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  halfWidth: {
    flex: 1,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    marginTop: spacing[2],
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: spacing[3],
  },
  switchDescription: {
    fontSize: 12,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  modalFooter: {
    flexDirection: 'row',
    padding: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    gap: spacing[3],
  },
  button: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.neutral[100],
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  submitButton: {
    backgroundColor: colors.accent[500],
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default EditPositionModal;
