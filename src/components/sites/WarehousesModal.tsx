import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
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

          {/* Floating Action Button */}
          <ProtectedElement requiredPermissions={['inventory.warehouses.create']} fallback={null}>
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
          </ProtectedElement>
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
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
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
    maxHeight: 400,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  warehouseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  warehouseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  warehouseIconSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    color: '#1E293B',
    marginBottom: 4,
  },
  warehouseCode: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2,
  },
  areasCount: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  deleteIconButton: {
    padding: 8,
  },
  deleteIconText: {
    fontSize: 20,
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
  closeActionButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closeActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  createButton: {
    backgroundColor: '#3B82F6',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 90,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  floatingButtonIcon: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 32,
  },
});

export default WarehousesModal;
