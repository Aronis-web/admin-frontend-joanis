import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { PositionTreeNode } from '@/types/organization';

interface PositionDetailModalProps {
  visible: boolean;
  onClose: () => void;
  position: PositionTreeNode;
  onEdit: () => void;
  onDelete: () => void;
}

export const PositionDetailModal: React.FC<PositionDetailModalProps> = ({
  visible,
  onClose,
  position,
  onEdit,
  onDelete,
}) => {
  const styles = useThemedStyles(createStyles);
  const isActive = position.isActive !== false;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.headerContent}>
              <Text style={styles.positionIcon}>
                {position.scopeLevel === 'COMPANY' ? '🏢' : '🏪'}
              </Text>
              <View style={styles.headerText}>
                <Text style={styles.modalTitle}>{position.name}</Text>
                <Text style={styles.positionCode}>{position.code}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Status Badge */}
            <View style={styles.statusContainer}>
              <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
                <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextInactive]}>
                  {isActive ? '✓ Activo' : '✕ Inactivo'}
                </Text>
              </View>
              <View style={styles.scopeBadge}>
                <Text style={styles.scopeText}>
                  {position.scopeLevel === 'COMPANY' ? '🏢 Empresa' : '🏪 Sede'}
                </Text>
              </View>
            </View>

            {/* Description */}
            {position.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Descripción</Text>
                <Text style={styles.description}>{position.description}</Text>
              </View>
            )}

            {/* Details Grid */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Detalles</Text>
              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Nivel jerárquico</Text>
                  <Text style={styles.detailValue}>{position.level}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Orden de visualización</Text>
                  <Text style={styles.detailValue}>{position.displayOrder || 1}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Mínimo de ocupantes</Text>
                  <Text style={styles.detailValue}>{position.minOccupants}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Máximo de ocupantes</Text>
                  <Text style={styles.detailValue}>
                    {position.maxOccupants !== null ? position.maxOccupants : 'Ilimitado'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Hierarchy Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Jerarquía</Text>
              <View style={styles.hierarchyInfo}>
                <View style={styles.hierarchyItem}>
                  <Text style={styles.hierarchyLabel}>Puesto padre:</Text>
                  <Text style={styles.hierarchyValue}>
                    {position.parentPositionId ? 'Sí (tiene superior)' : 'No (es raíz)'}
                  </Text>
                </View>
                <View style={styles.hierarchyItem}>
                  <Text style={styles.hierarchyLabel}>Puestos hijos:</Text>
                  <Text style={styles.hierarchyValue}>
                    {position.children?.length || 0} subordinado(s)
                  </Text>
                </View>
              </View>
            </View>

            {/* Assignments Info */}
            {position.assignments && position.assignments.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Asignaciones</Text>
                <View style={styles.assignmentsInfo}>
                  <Text style={styles.assignmentsText}>
                    👥 {position.assignments.length} persona(s) asignada(s)
                  </Text>
                </View>
              </View>
            )}

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                ℹ️ Para gestionar asignaciones, presupuestos y salarios, edita el puesto desde la
                vista principal.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={onDelete}>
              <Text style={styles.deleteButtonText}>🗑️ Eliminar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.editButton]} onPress={onEdit}>
              <Text style={styles.editButtonText}>✏️ Editar</Text>
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
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      width: '90%',
      maxWidth: 500,
      maxHeight: '80%',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    positionIcon: {
      fontSize: 32,
      marginRight: 12,
    },
    headerText: {
      flex: 1,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    positionCode: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    closeButton: {
      fontSize: 24,
      color: theme.color.text.muted,
      padding: 4,
    },
    modalContent: {
      padding: 20,
    },
    statusContainer: {
      flexDirection: 'row',
      gap: theme.space[2],
      marginBottom: theme.space[5],
    },
    statusBadge: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.md,
    },
    statusActive: {
      backgroundColor: theme.color.state.success.background,
    },
    statusInactive: {
      backgroundColor: theme.color.state.danger.background,
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
    scopeBadge: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
    },
    scopeText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    section: {
      marginBottom: theme.space[5],
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
    },
    description: {
      fontSize: 14,
      color: theme.color.text.body,
      lineHeight: 20,
    },
    detailsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[3],
    },
    detailItem: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: theme.color.surface.subtle,
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
    },
    detailLabel: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: theme.space[1],
    },
    detailValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    hierarchyInfo: {
      backgroundColor: theme.color.surface.subtle,
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
    },
    hierarchyItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: theme.space[2],
    },
    hierarchyLabel: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    hierarchyValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    assignmentsInfo: {
      backgroundColor: theme.color.surface.subtle,
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
    },
    assignmentsText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    infoBox: {
      backgroundColor: theme.color.state.warning.background,
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      marginTop: theme.space[2],
    },
    infoText: {
      fontSize: 12,
      color: theme.color.state.warning.text,
      lineHeight: 18,
    },
    modalFooter: {
      flexDirection: 'row',
      padding: theme.space[5],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      gap: theme.space[3],
    },
    button: {
      flex: 1,
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
    },
    deleteButton: {
      backgroundColor: theme.color.state.danger.background,
    },
    deleteButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.state.danger.text,
    },
    editButton: {
      backgroundColor: theme.color.brand.accent,
    },
    editButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
  });

export default PositionDetailModal;
