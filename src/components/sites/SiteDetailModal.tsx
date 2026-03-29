import React, { useState } from 'react';
import Alert from '@/utils/alert';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { Site } from '@/types/sites';
import { Warehouse, WarehouseArea } from '@/types/warehouses';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import { sitesApi, warehousesApi } from '@/services/api';
import { ManageAdminsModal } from './ManageAdminsModal';
import { WarehousesModal } from './WarehousesModal';
import { WarehouseFormModal } from './WarehouseFormModal';
import { WarehouseDetailModal } from './WarehouseDetailModal';
import { WarehouseAreaFormModal } from './WarehouseAreaFormModal';
import { SiteContactsModal } from './SiteContactsModal';

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
  const [showContactsModal, setShowContactsModal] = useState(false);
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
    return isActive ? colors.success[500] : colors.danger[500];
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

            {/* Warehouses and Contacts - Always visible */}
            {renderSection(
              'Gestión de Sede',
              <>
                <TouchableOpacity
                  style={styles.manageButton}
                  onPress={() => setShowWarehousesModal(true)}
                >
                  <Text style={styles.manageButtonIcon}>📦</Text>
                  <Text style={styles.manageButtonText}>Gestionar Almacenes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.manageButton, styles.contactsButton]}
                  onPress={() => setShowContactsModal(true)}
                >
                  <Text style={styles.manageButtonIcon}>📞</Text>
                  <Text style={styles.manageButtonText}>Gestionar Contactos</Text>
                </TouchableOpacity>
                <Text style={styles.sectionHint}>
                  Administra los almacenes, contactos y notificaciones de esta sede
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
      onWarehouseUpdated={async () => {
        setShowWarehouseFormModal(false);
        // Reload the warehouse to get updated data
        if (selectedWarehouse) {
          try {
            const updatedWarehouse = await warehousesApi.getWarehouseById(selectedWarehouse.id);
            setSelectedWarehouse(updatedWarehouse);
          } catch (error) {
            console.error('Error reloading warehouse:', error);
          }
        }
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

    {/* Site Contacts Modal - Outside main modal */}
    <SiteContactsModal
      visible={showContactsModal}
      site={site}
      onClose={() => setShowContactsModal(false)}
    />
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
    maxHeight: '90%',
    paddingBottom: spacing[5],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  siteIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
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
    color: colors.neutral[800],
    marginBottom: 6,
  },
  codeContainer: {
    backgroundColor: colors.accent[50],
    paddingHorizontal: 10,
    paddingVertical: spacing[1],
    borderRadius: borderRadius.lg,
    alignSelf: 'flex-start',
    marginBottom: spacing[2],
  },
  codeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary[500],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 10,
    paddingVertical: spacing[1],
    borderRadius: borderRadius.lg,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
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
  },
  section: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[3],
  },
  sectionContent: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  infoLabel: {
    fontSize: 14,
    color: colors.neutral[500],
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: colors.neutral[800],
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  adminItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  adminAvatar: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  adminAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  adminEmail: {
    fontSize: 12,
    color: colors.neutral[500],
  },
  noAdminsText: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
    paddingVertical: spacing[3],
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[2],
  },
  contactsButton: {
    backgroundColor: colors.success[500],
  },
  manageButtonIcon: {
    fontSize: 18,
    marginRight: spacing[2],
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  sectionHint: {
    fontSize: 12,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  manageAdminsButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: borderRadius.lg,
    marginTop: spacing[3],
    alignItems: 'center',
  },
  manageAdminsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
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
  deleteButton: {
    backgroundColor: colors.danger[500],
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  editButton: {
    backgroundColor: colors.primary[500],
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
});

export default SiteDetailModal;
