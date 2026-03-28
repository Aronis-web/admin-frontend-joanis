import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { App, AppType } from '@/services/api/apps';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';

interface AppDetailModalProps {
  visible: boolean;
  app: App | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onManageScopes: () => void;
  onManagePermissions: () => void;
  onManageUsers: () => void;
}

export const AppDetailModal: React.FC<AppDetailModalProps> = ({
  visible,
  app,
  onClose,
  onEdit,
  onDelete,
  onManageScopes,
  onManagePermissions,
  onManageUsers,
}) => {
  if (!app) {
    return null;
  }

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

  const getAppTypeLabel = (type: AppType): string => {
    const labels: Record<AppType, string> = {
      [AppType.SALES]: '💰 Ventas',
      [AppType.POS]: '🏪 Punto de Venta',
      [AppType.ADMIN]: '⚙️ Administración',
      [AppType.INTERNAL]: '🔧 Interno',
    };
    return labels[type] || type;
  };

  const getAppTypeColor = (type: AppType): string => {
    const typeColors: Record<AppType, string> = {
      [AppType.SALES]: colors.success[500],
      [AppType.POS]: colors.warning[500],
      [AppType.ADMIN]: colors.accent[500],
      [AppType.INTERNAL]: colors.neutral[500],
    };
    return typeColors[type] || colors.neutral[500];
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>📱 Detalles de la App</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* App Info Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Información General</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Código</Text>
                <View style={styles.codeContainer}>
                  <Text style={styles.codeText}>{app.code}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nombre</Text>
                <Text style={styles.infoValue}>{app.name}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tipo</Text>
                <View
                  style={[
                    styles.typeBadge,
                    { backgroundColor: `${getAppTypeColor(app.appType)}15` },
                  ]}
                >
                  <Text style={[styles.typeBadgeText, { color: getAppTypeColor(app.appType) }]}>
                    {getAppTypeLabel(app.appType)}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Estado</Text>
                <View
                  style={[
                    styles.statusBadge,
                    app.isActive ? styles.statusBadgeActive : styles.statusBadgeInactive,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      app.isActive ? styles.statusDotActive : styles.statusDotInactive,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      app.isActive ? styles.statusTextActive : styles.statusTextInactive,
                    ]}
                  >
                    {app.isActive ? 'Activa' : 'Inactiva'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Metadata Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Metadatos</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ID</Text>
                <Text style={styles.infoValueSmall}>{app.id}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Creada</Text>
                <Text style={styles.infoValue}>{formatDate(app.createdAt)}</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Actualizada</Text>
                <Text style={styles.infoValue}>{formatDate(app.updatedAt)}</Text>
              </View>
            </View>

            {/* Management Actions */}
            <ProtectedElement requiredPermissions={['apps.manage']}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Gestión Avanzada</Text>
                </View>

                <TouchableOpacity style={styles.actionButton} onPress={onManageScopes}>
                  <View style={styles.actionButtonContent}>
                    <Text style={styles.actionButtonIcon}>🎯</Text>
                    <View style={styles.actionButtonInfo}>
                      <Text style={styles.actionButtonTitle}>Gestionar Scopes</Text>
                      <Text style={styles.actionButtonSubtitle}>
                        Define a qué datos puede acceder esta app
                      </Text>
                    </View>
                    <Text style={styles.actionButtonArrow}>→</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={onManagePermissions}>
                  <View style={styles.actionButtonContent}>
                    <Text style={styles.actionButtonIcon}>🔐</Text>
                    <View style={styles.actionButtonInfo}>
                      <Text style={styles.actionButtonTitle}>Gestionar Permisos</Text>
                      <Text style={styles.actionButtonSubtitle}>
                        Configura qué acciones están disponibles
                      </Text>
                    </View>
                    <Text style={styles.actionButtonArrow}>→</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={onManageUsers}>
                  <View style={styles.actionButtonContent}>
                    <Text style={styles.actionButtonIcon}>👥</Text>
                    <View style={styles.actionButtonInfo}>
                      <Text style={styles.actionButtonTitle}>Gestionar Usuarios</Text>
                      <Text style={styles.actionButtonSubtitle}>
                        Asigna usuarios y roles a esta app
                      </Text>
                    </View>
                    <Text style={styles.actionButtonArrow}>→</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </ProtectedElement>
          </ScrollView>

          {/* Footer Actions */}
          <ProtectedElement requiredPermissions={['apps.manage']}>
            <View style={styles.footer}>
              <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
                <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.editButton} onPress={onEdit}>
                <Text style={styles.editButtonText}>✏️ Editar</Text>
              </TouchableOpacity>
            </View>
          </ProtectedElement>
        </View>
      </View>
    </Modal>
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
    shadowColor: colors.neutral[900],
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.neutral[800],
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
  content: {
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
  },
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cardHeader: {
    marginBottom: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.neutral[800],
    flex: 2,
    textAlign: 'right',
  },
  infoValueSmall: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.neutral[500],
    flex: 2,
    textAlign: 'right',
  },
  codeContainer: {
    backgroundColor: colors.neutral[800],
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: borderRadius.lg,
  },
  codeText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.neutral[0],
    fontFamily: 'monospace',
  },
  typeBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: borderRadius.lg,
  },
  typeBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: borderRadius.lg,
    gap: 6,
  },
  statusBadgeActive: {
    backgroundColor: colors.success[100],
  },
  statusBadgeInactive: {
    backgroundColor: colors.danger[100],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: colors.success[500],
  },
  statusDotInactive: {
    backgroundColor: colors.danger[500],
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusTextActive: {
    color: colors.success[500],
  },
  statusTextInactive: {
    color: colors.danger[500],
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    gap: spacing[3],
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    borderWidth: 1.5,
    borderColor: colors.danger[100],
    backgroundColor: colors.danger[50],
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.danger[500],
  },
  editButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.accent[500],
    alignItems: 'center',
    shadowColor: colors.accent[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  actionButton: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonIcon: {
    fontSize: 24,
    marginRight: spacing[3],
  },
  actionButtonInfo: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  actionButtonSubtitle: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  actionButtonArrow: {
    fontSize: 20,
    color: colors.neutral[400],
    fontWeight: '600',
  },
});

export default AppDetailModal;
