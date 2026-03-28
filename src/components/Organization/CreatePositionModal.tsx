import React, { useState } from 'react';
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
} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { organizationApi } from '@/services/api/organization';
import { PositionTreeNode, ScopeLevel } from '@/types/organization';

interface CreatePositionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parentPosition: PositionTreeNode | null;
  scopeLevel: ScopeLevel;
  companyId?: string;
  siteId?: string;
}

export const CreatePositionModal: React.FC<CreatePositionModalProps> = ({
  visible,
  onClose,
  onSuccess,
  parentPosition,
  scopeLevel,
  companyId,
  siteId,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    maxOccupants: '',
    minOccupants: '1',
    displayOrder: '1',
  });

  const handleSubmit = async () => {
    // Validation
    if (!formData.code.trim()) {
      Alert.alert('Error', 'El código es requerido');
      return;
    }
    if (!formData.name.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    if (!companyId) {
      Alert.alert('Error', 'No hay empresa seleccionada');
      return;
    }

    if (scopeLevel === 'SITE' && !siteId) {
      Alert.alert('Error', 'No hay sede seleccionada');
      return;
    }

    try {
      setLoading(true);

      const requestData = {
        scopeLevel,
        code: formData.code.trim(),
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        parentPositionId: parentPosition?.id || null,
        level: parentPosition ? parentPosition.level + 1 : 1,
        maxOccupants: formData.maxOccupants ? parseInt(formData.maxOccupants) : null,
        minOccupants: parseInt(formData.minOccupants) || 1,
        displayOrder: parseInt(formData.displayOrder) || 1,
      };

      if (scopeLevel === 'COMPANY') {
        await organizationApi.createCompanyPosition(companyId, requestData);
      } else {
        await organizationApi.createSitePosition(siteId!, requestData);
      }

      Alert.alert('Éxito', 'Puesto creado correctamente');

      // Reset form
      setFormData({
        code: '',
        name: '',
        description: '',
        maxOccupants: '',
        minOccupants: '1',
        displayOrder: '1',
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error creating position:', error);
      Alert.alert('Error', error.response?.data?.message || 'Error al crear el puesto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Crear Nuevo Puesto</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {parentPosition && (
              <View style={styles.parentInfo}>
                <Text style={styles.parentLabel}>Puesto padre:</Text>
                <Text style={styles.parentName}>{parentPosition.name}</Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Código <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={formData.code}
                onChangeText={(text) => setFormData({ ...formData, code: text.toUpperCase() })}
                placeholder="Ej: GERENTE_TIENDA"
                editable={!loading}
                autoCapitalize="characters"
                keyboardType="default"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Nombre <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Ej: Gerente de Tienda"
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

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ℹ️ Nivel: {parentPosition ? parentPosition.level + 1 : 1}
              </Text>
              <Text style={styles.infoText}>
                📍 Alcance: {scopeLevel === 'COMPANY' ? 'Empresa' : 'Sede'}
              </Text>
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
                <Text style={styles.submitButtonText}>Crear Puesto</Text>
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
  parentInfo: {
    backgroundColor: colors.neutral[100],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[4],
  },
  parentLabel: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  parentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[900],
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
  infoBox: {
    backgroundColor: colors.primary[50],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginTop: spacing[2],
  },
  infoText: {
    fontSize: 14,
    color: colors.primary[600],
    marginBottom: spacing[1],
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

export default CreatePositionModal;
