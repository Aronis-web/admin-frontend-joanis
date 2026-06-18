import React, { useState, useEffect } from 'react';
import Alert from '@/utils/alert';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView} from 'react-native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const styles = useThemedStyles(createStyles);
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
    modalSubtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginTop: 2,
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
      maxHeight: 400,
    },
    loadingContainer: {
      paddingVertical: theme.space[10],
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: theme.color.text.muted,
    },
    emptyContainer: {
      paddingVertical: theme.space[10],
      alignItems: 'center',
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: theme.space[4],
    },
    emptyText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
      paddingHorizontal: theme.space[5],
    },
    warehouseItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    warehouseInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    warehouseIconSmall: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.state.warning.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
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
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    warehouseCode: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginBottom: 2,
    },
    areasCount: {
      fontSize: 12,
      color: theme.color.brand.primary,
      fontWeight: '500',
    },
    deleteIconButton: {
      padding: theme.space[2],
    },
    deleteIconText: {
      fontSize: 20,
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
    closeActionButton: {
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    closeActionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    createButton: {
      backgroundColor: theme.color.brand.primary,
    },
    createButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    floatingButton: {
      position: 'absolute',
      bottom: 100,
      right: theme.space[6],
      width: 60,
      height: 60,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.brand.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 8,
      shadowColor: theme.color.shadow,
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
      color: theme.color.text.onAction,
      lineHeight: 32,
    },
  });

export default WarehousesModal;
