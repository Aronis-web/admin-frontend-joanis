import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    color: '#111827',
    marginBottom: 4,
  },
  positionCode: {
    fontSize: 14,
    color: '#6B7280',
  },
  closeButton: {
    fontSize: 24,
    color: '#6B7280',
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#D1FAE5',
  },
  statusInactive: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#059669',
  },
  statusTextInactive: {
    color: '#DC2626',
  },
  scopeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
  },
  scopeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  hierarchyInfo: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  hierarchyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  hierarchyLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  hierarchyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  assignmentsInfo: {
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 8,
  },
  assignmentsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  infoBox: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  editButton: {
    backgroundColor: '#6366F1',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default PositionDetailModal;
