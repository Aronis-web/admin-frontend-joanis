import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Site } from '@/types/sites';
import { Warehouse, WarehouseArea } from '@/types/warehouses';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { sitesApi } from '@/services/api';
import { ManageAdminsModal } from './ManageAdminsModal';
import { WarehousesModal } from './WarehousesModal';
import { WarehouseFormModal } from './WarehouseFormModal';
import { WarehouseDetailModal } from './WarehouseDetailModal';
import { WarehouseAreaFormModal } from './WarehouseAreaFormModal';

interface SiteDetailModalProps {
  visible: boolean;
  site: Site | null;
  onClose: () => void;
  onEdit: (site: Site) => void;
  onSiteDeleted?: () => void;
  onSiteUpdated?: () => void;
}

export const SiteDetailModal: React.FC<SiteDetailModalProps> = ({
  visible,
  site,
  onClose,
  onEdit,
  onSiteDeleted,
  onSiteUpdated,
}) => {
  const [showManageAdminsModal, setShowManageAdminsModal] = useState(false);
  const [showWarehousesModal, setShowWarehousesModal] = useState(false);
  const [showWarehouseFormModal, setShowWarehouseFormModal] = useState(false);
  const [showWarehouseDetailModal, setShowWarehouseDetailModal] = useState(false);
  const [showAreaFormModal, setShowAreaFormModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [selectedArea, setSelectedArea] = useState<WarehouseArea | null>(null);

  if (!site) {
    return null;
  }

  const handleDelete = () => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Estás seguro de que deseas eliminar la sede "${site.name}"? Esta acción no se puede deshacer.`,
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
              await sitesApi.deleteSite(site.id);
              Alert.alert('Éxito', 'Sede eliminada correctamente');
              onClose();
              if (onSiteDeleted) {
                onSiteDeleted();
              }
            } catch (error: any) {
              console.error('Error deleting site:', error);
              const errorMessage = error.response?.data?.message || 'Error al eliminar la sede';
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

  const getStatusColor = (isActive: boolean) => {
    return isActive ? '#10B981' : '#EF4444';
  };

  const getStatusText = (isActive: boolean) => {
    return isActive ? 'Activo' : 'Inactivo';
  };

  const renderInfoRow = (label: string, value: string | number | undefined, icon?: string) => {
    if (!value && value !== 0) {
      return null;
    }

    return (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{icon ? `${icon} ${label}` : label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    );
  };

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );

  return (
    <>
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.siteIcon}>
                <Text style={styles.iconText}>🏢</Text>
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.modalTitle}>{site.name}</Text>
                <View style={styles.codeContainer}>
                  <Text style={styles.codeText}>{site.code}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <View
                    style={[styles.statusDot, { backgroundColor: getStatusColor(site.isActive) }]}
                  />
                  <Text style={[styles.statusText, { color: getStatusColor(site.isActive) }]}>
                    {getStatusText(site.isActive)}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Basic Information */}
            {renderSection(
              'Información Básica',
              <>
                {renderInfoRow('Código', site.code)}
                {renderInfoRow('Nombre', site.name)}
                {renderInfoRow('Teléfono', site.phone, '📞')}
              </>
            )}

            {/* Address Information */}
            {(site.fullAddress || site.addressLine1 || site.district) &&
              renderSection(
                'Dirección',
                <>
                  {renderInfoRow('Dirección Completa', site.fullAddress, '📍')}
                  {renderInfoRow('Dirección Línea 1', site.addressLine1)}
                  {renderInfoRow('Dirección Línea 2', site.addressLine2)}
                  {renderInfoRow('Número Exterior', site.numberExt)}
                  {renderInfoRow('Distrito', site.district)}
                  {renderInfoRow('Provincia', site.province)}
                  {renderInfoRow('Departamento', site.department)}
                  {renderInfoRow('País', site.country)}
                  {renderInfoRow('Código Postal', site.postalCode)}
                  {renderInfoRow('Ubigeo SUNAT', site.ubigeo, '🔢')}
                </>
              )}

            {/* GPS Coordinates */}
            {(site.latitude || site.longitude) &&
              renderSection(
                'Coordenadas GPS',
                <>
                  {renderInfoRow('Latitud', site.latitude?.toString())}
                  {renderInfoRow('Longitud', site.longitude?.toString())}
                </>
              )}

            {/* Warehouses - Always visible */}
            {renderSection(
              'Almacenes',
              <>
                <TouchableOpacity
                  style={styles.manageButton}
                  onPress={() => setShowWarehousesModal(true)}
                >
                  <Text style={styles.manageButtonIcon}>📦</Text>
                  <Text style={styles.manageButtonText}>Gestionar Almacenes</Text>
                </TouchableOpacity>
                <Text style={styles.sectionHint}>
                  Administra los almacenes y áreas de esta sede
                </Text>
              </>
            )}

            {/* Administrators */}
            <ProtectedElement requiredPermissions={['sites.admins.list']} fallback={null}>
              {renderSection(
                'Administradores',
                <>
                  {site.admins && site.admins.length > 0 ? (
                    <>
                      {site.admins.map((admin, index) => {
                        const userName =
                          admin.user?.name ||
                          admin.user?.username ||
                          admin.user?.email ||
                          'Usuario';
                        const userEmail = admin.user?.email || '';
                        const avatarLetter = userName.charAt(0).toUpperCase();

                        return (
                          <View key={admin.id} style={styles.adminItem}>
                            <View style={styles.adminAvatar}>
                              <Text style={styles.adminAvatarText}>{avatarLetter}</Text>
                            </View>
                            <View style={styles.adminInfo}>
                              <Text style={styles.adminName}>{userName}</Text>
                              {userEmail && <Text style={styles.adminEmail}>{userEmail}</Text>}
                            </View>
                          </View>
                        );
                      })}
                      <ProtectedElement
                        requiredPermissions={['sites.admins.add', 'sites.admins.remove']}
                        fallback={null}
                      >
                        <TouchableOpacity
                          style={styles.manageAdminsButton}
                          onPress={() => setShowManageAdminsModal(true)}
                        >
                          <Text style={styles.manageAdminsButtonText}>
                            Gestionar Administradores
                          </Text>
                        </TouchableOpacity>
                      </ProtectedElement>
                    </>
                  ) : (
                    <>
                      <Text style={styles.noAdminsText}>No hay administradores asignados</Text>
                      <ProtectedElement requiredPermissions={['sites.admins.add']} fallback={null}>
                        <TouchableOpacity
                          style={styles.manageAdminsButton}
                          onPress={() => setShowManageAdminsModal(true)}
                        >
                          <Text style={styles.manageAdminsButtonText}>Agregar Administradores</Text>
                        </TouchableOpacity>
                      </ProtectedElement>
                    </>
                  )}
                </>
              )}
            </ProtectedElement>

            {/* Metadata */}
            {renderSection(
              'Información del Sistema',
              <>
                {renderInfoRow('Creado', formatDate(site.createdAt))}
                {renderInfoRow('Actualizado', formatDate(site.updatedAt))}
                {renderInfoRow('ID', site.id)}
              </>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.button, styles.closeActionButton]} onPress={onClose}>
              <Text style={styles.closeActionButtonText}>Cerrar</Text>
            </TouchableOpacity>

            <ProtectedElement requiredPermissions={['sites.delete']} fallback={null}>
              <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Eliminar</Text>
              </TouchableOpacity>
            </ProtectedElement>

            <ProtectedElement requiredPermissions={['sites.update']} fallback={null}>
              <TouchableOpacity
                style={[styles.button, styles.editButton]}
                onPress={() => onEdit(site)}
              >
                <Text style={styles.editButtonText}>Editar</Text>
              </TouchableOpacity>
            </ProtectedElement>
          </View>
        </View>
      </View>

    </Modal>

    {/* Manage Admins Modal - Outside main modal */}
    <ManageAdminsModal
      visible={showManageAdminsModal}
      site={site}
      onClose={() => setShowManageAdminsModal(false)}
      onAdminsUpdated={() => {
        setShowManageAdminsModal(false);
        if (onSiteUpdated) {
          onSiteUpdated();
        }
      }}
    />

    {/* Warehouses Modal - Outside main modal */}
    <WarehousesModal
      visible={showWarehousesModal}
      site={site}
      onClose={() => setShowWarehousesModal(false)}
      onWarehousePress={(warehouse) => {
        setSelectedWarehouse(warehouse);
        setShowWarehousesModal(false);
        setShowWarehouseDetailModal(true);
      }}
      onCreateWarehouse={() => {
        setSelectedWarehouse(null);
        setShowWarehousesModal(false);
        setShowWarehouseFormModal(true);
      }}
    />

    {/* Warehouse Form Modal - Outside main modal */}
    <WarehouseFormModal
      visible={showWarehouseFormModal}
      site={site}
      warehouse={selectedWarehouse}
      onClose={() => {
        setShowWarehouseFormModal(false);
        setSelectedWarehouse(null);
      }}
      onWarehouseCreated={() => {
        setShowWarehouseFormModal(false);
        setShowWarehousesModal(true);
      }}
      onWarehouseUpdated={() => {
        setShowWarehouseFormModal(false);
        setShowWarehouseDetailModal(true);
      }}
    />

    {/* Warehouse Detail Modal - Outside main modal */}
    <WarehouseDetailModal
      visible={showWarehouseDetailModal}
      warehouse={selectedWarehouse}
      onClose={() => {
        setShowWarehouseDetailModal(false);
        setSelectedWarehouse(null);
        setShowWarehousesModal(true);
      }}
      onEdit={(warehouse) => {
        setSelectedWarehouse(warehouse);
        setShowWarehouseDetailModal(false);
        setShowWarehouseFormModal(true);
      }}
      onWarehouseDeleted={() => {
        setShowWarehouseDetailModal(false);
        setSelectedWarehouse(null);
        setShowWarehousesModal(true);
      }}
      onWarehouseUpdated={() => {
        // Reload warehouse details if needed
      }}
      onCreateArea={(warehouse) => {
        setSelectedWarehouse(warehouse);
        setSelectedArea(null);
        setShowWarehouseDetailModal(false);
        setShowAreaFormModal(true);
      }}
      onEditArea={(area) => {
        setSelectedArea(area);
        setShowWarehouseDetailModal(false);
        setShowAreaFormModal(true);
      }}
    />

    {/* Warehouse Area Form Modal - Outside main modal */}
    <WarehouseAreaFormModal
      visible={showAreaFormModal}
      warehouse={selectedWarehouse}
      area={selectedArea}
      onClose={() => {
        setShowAreaFormModal(false);
        setSelectedArea(null);
      }}
      onAreaCreated={() => {
        setShowAreaFormModal(false);
        setSelectedArea(null);
        setShowWarehouseDetailModal(true);
      }}
      onAreaUpdated={() => {
        setShowAreaFormModal(false);
        setSelectedArea(null);
        setShowWarehouseDetailModal(true);
      }}
    />
  </>
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
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  siteIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
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
    color: '#1E293B',
    marginBottom: 6,
  },
  codeContainer: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  codeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  adminItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  adminAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  adminAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  adminEmail: {
    fontSize: 12,
    color: '#64748B',
  },
  noAdminsText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 12,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  manageButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionHint: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  manageAdminsButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  manageAdminsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editButton: {
    backgroundColor: '#3B82F6',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SiteDetailModal;
