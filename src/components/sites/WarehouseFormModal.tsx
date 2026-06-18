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
import { Picker } from '@react-native-picker/picker';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Site } from '@/types/sites';
import { Warehouse } from '@/types/warehouses';
import { WarehouseType, WarehouseTypeLabels, WarehouseTypeDescriptions } from '@/types/enums';
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { currentSite, currentCompany } = useAuthStore();
  const { selectedSite, selectedCompany } = useTenantStore();

  const [name, setName] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [warehouseType, setWarehouseType] = useState<WarehouseType>(WarehouseType.GENERAL);
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
        setWarehouseType(warehouse.warehouseType || WarehouseType.GENERAL);
      } else if (site) {
        // Create mode
        setName('');
        setSiteCode(site.code);
        setWarehouseType(WarehouseType.GENERAL);
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
          warehouseType: warehouseType,
        });
        Alert.alert('Éxito', 'Almacén actualizado correctamente');
        if (onWarehouseUpdated) {
          onWarehouseUpdated();
        }
      } else {
        // Create warehouse
        // Use site prop data if available, otherwise fall back to effective site/company
        const companyId = site?.companyId || effectiveCompany?.id;
        const siteId = site?.id || effectiveSite?.id;

        if (!companyId || !siteId) {
          Alert.alert('Error', 'No se pudo determinar la compañía o sede actual');
          return;
        }

        const newWarehouse = await warehousesApi.createWarehouse({
          companyId: companyId,
          siteId: siteId,
          code: siteCode.trim().toUpperCase(),
          siteCode: siteCode.trim().toUpperCase(),
          name: name.trim(),
          warehouseType: warehouseType,
        });
        Alert.alert('Éxito', 'Almacén creado correctamente');

        // Reset form
        setName('');
        setSiteCode('');
        setWarehouseType(WarehouseType.GENERAL);

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
      setWarehouseType(WarehouseType.GENERAL);
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
                placeholderTextColor={theme.color.text.placeholder}
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
                placeholderTextColor={theme.color.text.placeholder}
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

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Tipo de Almacén <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={warehouseType}
                  onValueChange={(value) => setWarehouseType(value as WarehouseType)}
                  enabled={!loading}
                  style={styles.picker}
                >
                  {Object.values(WarehouseType).map((type) => (
                    <Picker.Item
                      key={type}
                      label={WarehouseTypeLabels[type]}
                      value={type}
                    />
                  ))}
                </Picker>
              </View>
              <Text style={styles.hint}>
                {WarehouseTypeDescriptions[warehouseType]}
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderTopLeftRadius: theme.radii['2xl'],
      borderTopRightRadius: theme.radii['2xl'],
      maxHeight: '80%',
      paddingBottom: theme.space[5],
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    warehouseIcon: {
      width: 48,
      height: 48,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.state.warning.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    iconText: {
      fontSize: 24,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: 18,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    scrollContent: {
      paddingHorizontal: theme.space[6],
      paddingTop: theme.space[5],
    },
    formGroup: {
      marginBottom: theme.space[5],
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
    },
    required: {
      color: theme.color.text.danger,
    },
    input: {
      backgroundColor: theme.color.background.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.xl,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      fontSize: 16,
      color: theme.color.text.heading,
    },
    hint: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: theme.space[1],
    },
    pickerContainer: {
      backgroundColor: theme.color.background.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
    },
    picker: {
      height: 50,
      color: theme.color.text.heading,
    },
    infoBox: {
      backgroundColor: theme.color.brand.accentSoft,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginTop: theme.space[2],
    },
    infoBoxTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.brand.primary,
      marginBottom: theme.space[2],
    },
    infoBoxText: {
      fontSize: 14,
      color: theme.color.text.heading,
      lineHeight: 20,
    },
    bold: {
      fontWeight: '600',
    },
    modalActions: {
      flexDirection: 'row',
      paddingHorizontal: theme.space[6],
      paddingTop: theme.space[5],
      gap: theme.space[3],
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    submitButton: {
      backgroundColor: theme.color.brand.primary,
    },
    submitButtonDisabled: {
      backgroundColor: theme.color.text.placeholder,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
  });

export default WarehouseFormModal;
