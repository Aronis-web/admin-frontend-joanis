import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
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
    color: colors.neutral[900],
    marginBottom: spacing[1],
  },
  positionCode: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  closeButton: {
    fontSize: 24,
    color: colors.neutral[500],
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[5],
  },
  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.md,
  },
  statusActive: {
    backgroundColor: colors.success[100],
  },
  statusInactive: {
    backgroundColor: colors.danger[100],
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusTextActive: {
    color: colors.success[600],
  },
  statusTextInactive: {
    color: colors.danger[600],
  },
  scopeBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  scopeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[600],
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.neutral[900],
    marginBottom: spacing[3],
  },
  description: {
    fontSize: 14,
    color: colors.neutral[700],
    lineHeight: 20,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  detailItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.neutral[50],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: spacing[1],
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  hierarchyInfo: {
    backgroundColor: colors.neutral[50],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
  },
  hierarchyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  hierarchyLabel: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  hierarchyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[900],
  },
  assignmentsInfo: {
    backgroundColor: colors.primary[50],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
  },
  assignmentsText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary[600],
  },
  infoBox: {
    backgroundColor: colors.warning[100],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginTop: spacing[2],
  },
  infoText: {
    fontSize: 12,
    color: colors.warning[800],
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
    gap: spacing[3],
  },
  button: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: colors.danger[100],
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.danger[600],
  },
  editButton: {
    backgroundColor: colors.accent[500],
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
});

export default PositionDetailModal;
