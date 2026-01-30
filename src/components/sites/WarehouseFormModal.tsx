import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { Site } from '@/types/sites';
import { Warehouse } from '@/types/warehouses';
import { warehousesApi } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';

interface WarehouseFormModalProps {
  visible: boolean;
  site: Site | null;
  warehouse?: Warehouse | null;
  onClose: () => void;
  onWarehouseCreated?: () => void;
  onWarehouseUpdated?: () => void;
}

export const WarehouseFormModal: React.FC<WarehouseFormModalProps> = ({
  visible,
  site,
  warehouse,
  onClose,
  onWarehouseCreated,
  onWarehouseUpdated,
}) => {
  const { currentSite, currentCompany } = useAuthStore();
  const { selectedSite, selectedCompany } = useTenantStore();

  const [name, setName] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const isEditMode = !!warehouse;

  const effectiveSite = selectedSite || currentSite;
  const effectiveCompany = selectedCompany || currentCompany;

  useEffect(() => {
    if (visible) {
      if (warehouse) {
        // Edit mode
        setName(warehouse.name);
        setSiteCode(warehouse.siteCode);
      } else if (site) {
        // Create mode
        setName('');
        setSiteCode(site.code);
      }
    }
  }, [visible, warehouse, site]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre del almacén es requerido');
      return;
    }

    if (!siteCode.trim()) {
      Alert.alert('Error', 'El código de sede es requerido');
      return;
    }

    try {
      setLoading(true);

      if (isEditMode && warehouse) {
        // Update warehouse
        await warehousesApi.updateWarehouse(warehouse.id, {
          name: name.trim(),
          siteCode: siteCode.trim().toUpperCase(),
        });
        Alert.alert('Éxito', 'Almacén actualizado correctamente');
        if (onWarehouseUpdated) {
          onWarehouseUpdated();
        }
      } else {
        // Create warehouse
        if (!effectiveCompany?.id || !effectiveSite?.id) {
          Alert.alert('Error', 'No se pudo determinar la compañía o sede actual');
          return;
        }

        const newWarehouse = await warehousesApi.createWarehouse({
          companyId: effectiveCompany.id,
          siteId: effectiveSite.id,
          code: siteCode.trim().toUpperCase(),
          siteCode: siteCode.trim().toUpperCase(),
          name: name.trim(),
        });
        Alert.alert('Éxito', 'Almacén creado correctamente');

        // Reset form
        setName('');
        setSiteCode('');

        if (onWarehouseCreated) {
          onWarehouseCreated();
        }
      }

      // Don't call onClose() here, let the callback handle it
    } catch (error: any) {
      console.error('Error saving warehouse:', error);
      const errorMessage =
        error.response?.data?.message ||
        `Error al ${isEditMode ? 'actualizar' : 'crear'} el almacén`;
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setSiteCode('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.warehouseIcon}>
                <Text style={styles.iconText}>📦</Text>
              </View>
              <Text style={styles.modalTitle}>
                {isEditMode ? 'Editar Almacén' : 'Crear Almacén'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Nombre del Almacén <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Almacén Central"
                value={name}
                onChangeText={setName}
                maxLength={200}
                editable={!loading}
              />
              <Text style={styles.hint}>Máximo 200 caracteres</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Código de Sede <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: HQ"
                value={siteCode}
                onChangeText={setSiteCode}
                maxLength={50}
                autoCapitalize="characters"
                editable={!loading}
              />
              <Text style={styles.hint}>
                Máximo 50 caracteres. Se convertirá a mayúsculas automáticamente.
              </Text>
            </View>

            {site && (
              <View style={styles.infoBox}>
                <Text style={styles.infoBoxTitle}>ℹ️ Información</Text>
                <Text style={styles.infoBoxText}>
                  Este almacén se asociará a la sede: <Text style={styles.bold}>{site.name}</Text>
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Guardando...' : isEditMode ? 'Actualizar' : 'Crear'}
              </Text>
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  warehouseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  hint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoBoxTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 8,
  },
  infoBoxText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
  },
  submitButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default WarehouseFormModal;
