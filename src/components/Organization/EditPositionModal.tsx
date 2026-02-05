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
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Descripción del puesto"
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
                trackColor={{ false: '#D1D5DB', true: '#6366F1' }}
                thumbColor={formData.isActive ? '#FFFFFF' : '#F3F4F6'}
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
                <ActivityIndicator color="#FFFFFF" />
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    fontSize: 24,
    color: '#6B7280',
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  positionInfo: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  positionCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  positionLevel: {
    fontSize: 12,
    color: '#6B7280',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#DC2626',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
  },
  switchLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  switchDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    backgroundColor: '#6366F1',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});

export default EditPositionModal;
