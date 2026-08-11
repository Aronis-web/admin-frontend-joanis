import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
      [AppType.SALES]: theme.color.icon.success,
      [AppType.POS]: theme.color.icon.warning,
      [AppType.ADMIN]: theme.color.brand.accent,
      [AppType.INTERNAL]: theme.color.text.muted,
    };
    return typeColors[type] || theme.color.text.muted;
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
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    title: {
      fontSize: 22,
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
    content: {
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[5],
    },
    card: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    cardHeader: {
      marginBottom: theme.space[4],
      paddingBottom: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.surface.muted,
    },
    infoLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
      flex: 1,
    },
    infoValue: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.color.text.heading,
      flex: 2,
      textAlign: 'right',
    },
    infoValueSmall: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.color.text.muted,
      flex: 2,
      textAlign: 'right',
    },
    codeContainer: {
      backgroundColor: theme.color.surface.inverse,
      paddingHorizontal: theme.space[3],
      paddingVertical: 6,
      borderRadius: theme.radii.lg,
    },
    codeText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.inverse,
      fontFamily: 'monospace',
    },
    typeBadge: {
      paddingHorizontal: theme.space[3],
      paddingVertical: 6,
      borderRadius: theme.radii.lg,
    },
    typeBadgeText: {
      fontSize: 14,
      fontWeight: '600',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.space[3],
      paddingVertical: 6,
      borderRadius: theme.radii.lg,
      gap: 6,
    },
    statusBadgeActive: {
      backgroundColor: theme.color.state.success.background,
    },
    statusBadgeInactive: {
      backgroundColor: theme.color.state.danger.background,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusDotActive: {
      backgroundColor: theme.color.icon.success,
    },
    statusDotInactive: {
      backgroundColor: theme.color.icon.danger,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
    },
    statusTextActive: {
      color: theme.color.state.success.text,
    },
    statusTextInactive: {
      color: theme.color.state.danger.text,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[5],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      gap: theme.space[3],
    },
    deleteButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.radii.xl,
      borderWidth: 1.5,
      borderColor: theme.color.state.danger.background,
      backgroundColor: theme.color.state.danger.background,
      alignItems: 'center',
    },
    deleteButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.state.danger.text,
    },
    editButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.color.brand.accent,
      alignItems: 'center',
      shadowColor: theme.color.brand.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    editButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    actionButton: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    actionButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionButtonIcon: {
      fontSize: 24,
      marginRight: theme.space[3],
    },
    actionButtonInfo: {
      flex: 1,
    },
    actionButtonTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: 2,
    },
    actionButtonSubtitle: {
      fontSize: 13,
      color: theme.color.text.muted,
    },
    actionButtonArrow: {
      fontSize: 20,
      color: theme.color.text.placeholder,
      fontWeight: '600',
    },
  });

export default AppDetailModal;
