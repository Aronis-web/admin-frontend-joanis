import React, { useState, useEffect } from 'react';
import Alert from '@/utils/alert';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView} from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { Warehouse, WarehouseArea } from '@/types/warehouses';
import { warehousesApi, warehouseAreasApi } from '@/services/api';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';

interface WarehouseDetailModalProps {
  visible: boolean;
  warehouse: Warehouse | null;
  onClose: () => void;
  onEdit: (warehouse: Warehouse) => void;
  onWarehouseDeleted?: () => void;
  onWarehouseUpdated?: () => void;
  onCreateArea: (warehouse: Warehouse) => void;
  onEditArea: (area: WarehouseArea) => void;
}

export const WarehouseDetailModal: React.FC<WarehouseDetailModalProps> = ({
  visible,
  warehouse,
  onClose,
  onEdit,
  onWarehouseDeleted,
  onWarehouseUpdated,
  onCreateArea,
  onEditArea,
}) => {
  const styles = useThemedStyles(createStyles);
  const [areas, setAreas] = useState<WarehouseArea[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && warehouse) {
      loadAreas();
    }
  }, [visible, warehouse]);

  const loadAreas = async () => {
    if (!warehouse) {
      return;
    }

    try {
      setLoading(true);
      const data = await warehouseAreasApi.getWarehouseAreas(warehouse.id);
      setAreas(data);
    } catch (error: any) {
      console.error('Error loading areas:', error);
      const errorMessage = error.response?.data?.message || 'No se pudieron cargar las áreas';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWarehouse = () => {
    if (!warehouse) {
      return;
    }

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
              onClose();
              if (onWarehouseDeleted) {
                onWarehouseDeleted();
              }
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

  const handleDeleteArea = (area: WarehouseArea) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de que deseas eliminar el área "${area.code}"? Los items de stock asociados tendrán su área establecida a NULL.`,
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
              await warehouseAreasApi.deleteWarehouseArea(area.id);
              Alert.alert('Éxito', 'Área eliminada correctamente');
              loadAreas();
            } catch (error: any) {
              console.error('Error deleting area:', error);
              const errorMessage = error.response?.data?.message || 'Error al eliminar el área';
              Alert.alert('Error', errorMessage);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!warehouse) {
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
              <View style={styles.headerInfo}>
                <Text style={styles.modalTitle}>{warehouse.name}</Text>
                <Text style={styles.modalSubtitle}>Código: {warehouse.siteCode}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Basic Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Información Básica</Text>
              <View style={styles.sectionContent}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Nombre</Text>
                  <Text style={styles.infoValue}>{warehouse.name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Código de Sede</Text>
                  <Text style={styles.infoValue}>{warehouse.siteCode}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Creado</Text>
                  <Text style={styles.infoValue}>{formatDate(warehouse.createdAt)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>ID</Text>
                  <Text style={styles.infoValue}>{warehouse.id}</Text>
                </View>
              </View>
            </View>

            {/* Areas Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Áreas del Almacén</Text>
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Cargando áreas...</Text>
                </View>
              ) : areas.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No hay áreas registradas</Text>
                  <Text style={styles.emptySubtext}>Crea un área para organizar el inventario</Text>
                </View>
              ) : (
                <View style={styles.areasContainer}>
                  {areas.map((area) => (
                    <View key={area.id} style={styles.areaItem}>
                      <TouchableOpacity
                        style={styles.areaInfo}
                        onPress={() => onEditArea(area)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.areaIconSmall}>
                          <Text style={styles.iconTextSmall}>📍</Text>
                        </View>
                        <View style={styles.areaDetails}>
                          <Text style={styles.areaCode}>{area.code}</Text>
                          {area.name && <Text style={styles.areaName}>{area.name}</Text>}
                        </View>
                      </TouchableOpacity>
                      <ProtectedElement
                        requiredPermissions={['inventory.areas.delete']}
                        fallback={null}
                      >
                        <TouchableOpacity
                          style={styles.deleteIconButton}
                          onPress={() => handleDeleteArea(area)}
                        >
                          <Text style={styles.deleteIconText}>🗑️</Text>
                        </TouchableOpacity>
                      </ProtectedElement>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.button, styles.closeActionButton]} onPress={onClose}>
              <Text style={styles.closeActionButtonText}>Cerrar</Text>
            </TouchableOpacity>

            <ProtectedElement requiredPermissions={['inventory.warehouses.delete']} fallback={null}>
              <TouchableOpacity
                style={[styles.button, styles.deleteButton]}
                onPress={handleDeleteWarehouse}
              >
                <Text style={styles.deleteButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </ProtectedElement>

            <ProtectedElement requiredPermissions={['inventory.warehouses.update']} fallback={null}>
              <TouchableOpacity
                style={[styles.button, styles.editButton]}
                onPress={() => onEdit(warehouse)}
              >
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
            </ProtectedElement>
          </View>
        </View>
      </View>
    </Modal>

    {/* Floating Action Button - Completely outside Modal */}
    {visible && warehouse && (
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => {
          console.log('🔵 Floating button pressed - Creating area');
          onCreateArea(warehouse);
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
      maxHeight: '90%',
      paddingBottom: theme.space[5],
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flex: 1,
    },
    warehouseIcon: {
      width: 56,
      height: 56,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.state.warning.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[4],
    },
    iconText: {
      fontSize: 28,
    },
    headerInfo: {
      flex: 1,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    modalSubtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
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
    section: {
      marginBottom: theme.space[6],
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    sectionContent: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: theme.space[2],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    infoLabel: {
      fontSize: 14,
      color: theme.color.text.muted,
      fontWeight: '500',
      flex: 1,
    },
    infoValue: {
      fontSize: 14,
      color: theme.color.text.heading,
      fontWeight: '600',
      flex: 1,
      textAlign: 'right',
    },
    loadingContainer: {
      paddingVertical: theme.space[5],
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    emptyContainer: {
      paddingVertical: theme.space[5],
      alignItems: 'center',
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
    },
    emptyText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    emptySubtext: {
      fontSize: 13,
      color: theme.color.text.muted,
    },
    areasContainer: {
      gap: theme.space[2],
    },
    areaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    areaInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    areaIconSmall: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
    },
    iconTextSmall: {
      fontSize: 18,
    },
    areaDetails: {
      flex: 1,
    },
    areaCode: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    areaName: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    deleteIconButton: {
      padding: theme.space[2],
    },
    deleteIconText: {
      fontSize: 18,
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
    deleteButton: {
      backgroundColor: theme.color.action.danger.background,
    },
    deleteButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    editButton: {
      backgroundColor: theme.color.brand.primary,
    },
    editButtonText: {
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

export default WarehouseDetailModal;
