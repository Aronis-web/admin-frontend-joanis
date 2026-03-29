import React, { useState, useEffect } from 'react';
import Alert from '@/utils/alert';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { Site } from '@/types/sites';
import { Warehouse } from '@/types/warehouses';
import { warehousesApi } from '@/services/api';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';

interface WarehousesModalProps {
  visible: boolean;
  site: Site | null;
  onClose: () => void;
  onWarehousePress: (warehouse: Warehouse) => void;
  onCreateWarehouse: () => void;
}

export const WarehousesModal: React.FC<WarehousesModalProps> = ({
  visible,
  site,
  onClose,
  onWarehousePress,
  onCreateWarehouse,
}) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && site) {
      loadWarehouses();
    }
  }, [visible, site]);

  const loadWarehouses = async () => {
    if (!site) {
      return;
    }

    try {
      setLoading(true);
      const data = await warehousesApi.getWarehousesBySiteCode(site.code);
      setWarehouses(data);
    } catch (error: any) {
      console.error('Error loading warehouses:', error);
      const errorMessage = error.response?.data?.message || 'No se pudieron cargar los almacenes';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWarehouse = (warehouse: Warehouse) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de que deseas eliminar el almacén "${warehouse.name}"? Esto eliminará también todas sus áreas asociadas.`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await warehousesApi.deleteWarehouse(warehouse.id);
              Alert.alert('Éxito', 'Almacén eliminado correctamente');
              loadWarehouses();
            } catch (error: any) {
              console.error('Error deleting warehouse:', error);
              const errorMessage = error.response?.data?.message || 'Error al eliminar el almacén';
              Alert.alert('Error', errorMessage);
            }
          },
        },
      ]
    );
  };

  if (!site) {
    return null;
  }

  return (
    <>
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.warehouseIcon}>
                <Text style={styles.iconText}>📦</Text>
              </View>
              <View>
                <Text style={styles.modalTitle}>Almacenes</Text>
                <Text style={styles.modalSubtitle}>{site.name}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Cargando almacenes...</Text>
              </View>
            ) : warehouses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📦</Text>
                <Text style={styles.emptyText}>No hay almacenes registrados</Text>
                <Text style={styles.emptySubtext}>
                  Crea un almacén para comenzar a gestionar el inventario
                </Text>
              </View>
            ) : (
              warehouses.map((warehouse) => (
                <TouchableOpacity
                  key={warehouse.id}
                  style={styles.warehouseItem}
                  onPress={() => onWarehousePress(warehouse)}
                  activeOpacity={0.7}
                >
                  <View style={styles.warehouseInfo}>
                    <View style={styles.warehouseIconSmall}>
                      <Text style={styles.iconTextSmall}>📦</Text>
                    </View>
                    <View style={styles.warehouseDetails}>
                      <Text style={styles.warehouseName}>{warehouse.name}</Text>
                      <Text style={styles.warehouseCode}>Código: {warehouse.siteCode}</Text>
                      {warehouse.areas && warehouse.areas.length > 0 && (
                        <Text style={styles.areasCount}>
                          {warehouse.areas.length} área{warehouse.areas.length !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                  <ProtectedElement
                    requiredPermissions={['inventory.warehouses.delete']}
                    fallback={null}
                  >
                    <TouchableOpacity
                      style={styles.deleteIconButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteWarehouse(warehouse);
                      }}
                    >
                      <Text style={styles.deleteIconText}>🗑️</Text>
                    </TouchableOpacity>
                  </ProtectedElement>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.button, styles.closeActionButton]} onPress={onClose}>
              <Text style={styles.closeActionButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>

    {/* Floating Action Button - Completely outside Modal */}
    {visible && (
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => {
          console.log('🔵 Floating button pressed - Creating warehouse');
          onCreateWarehouse();
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.floatingButtonIcon}>+</Text>
      </TouchableOpacity>
    )}
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '80%',
    paddingBottom: spacing[5],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  warehouseIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.warning[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  iconText: {
    fontSize: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
    maxHeight: 400,
  },
  loadingContainer: {
    paddingVertical: spacing[10],
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.neutral[500],
  },
  emptyContainer: {
    paddingVertical: spacing[10],
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[2],
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
    paddingHorizontal: spacing[5],
  },
  warehouseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  warehouseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  warehouseIconSmall: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.warning[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  iconTextSmall: {
    fontSize: 20,
  },
  warehouseDetails: {
    flex: 1,
  },
  warehouseName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  warehouseCode: {
    fontSize: 13,
    color: colors.neutral[500],
    marginBottom: 2,
  },
  areasCount: {
    fontSize: 12,
    color: colors.primary[500],
    fontWeight: '500',
  },
  deleteIconButton: {
    padding: spacing[2],
  },
  deleteIconText: {
    fontSize: 20,
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing[6],
    paddingTop: spacing[5],
    gap: spacing[3],
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeActionButton: {
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  closeActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  createButton: {
    backgroundColor: colors.primary[500],
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    right: spacing[6],
    width: 60,
    height: 60,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: colors.neutral[950],
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 1000,
  },
  floatingButtonIcon: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.neutral[0],
    lineHeight: 32,
  },
});

export default WarehousesModal;
