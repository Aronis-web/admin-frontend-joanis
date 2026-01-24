import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import { PurchaseProductValidation } from '@/types/purchases';

interface ValidationHistoryModalProps {
  visible: boolean;
  validations: PurchaseProductValidation[];
  onClose: () => void;
}

export const ValidationHistoryModal: React.FC<ValidationHistoryModalProps> = ({
  visible,
  validations,
  onClose,
}) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
          <View style={styles.header}>
            <Text style={styles.title}>Historial de Validaciones</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {validations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No hay validaciones registradas</Text>
              </View>
            ) : (
              validations.map((validation, index) => (
                <View key={validation.id} style={styles.validationCard}>
                  <View style={styles.validationHeader}>
                    <Text style={styles.validationNumber}>
                      Validación #{validations.length - index}
                    </Text>
                    <Text style={styles.validationDate}>
                      {new Date(validation.validatedAt).toLocaleString('es-PE', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>

                  <View style={styles.validationInfo}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Validado por:</Text>
                      <Text style={styles.infoValue}>
                        {validation.validatedByUser?.name ||
                          validation.validatedByUser?.email ||
                          'N/A'}
                      </Text>
                    </View>

                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Stock validado:</Text>
                      <Text style={styles.infoValue}>{validation.validatedStock} unidades</Text>
                    </View>

                    {validation.notes && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Notas:</Text>
                        <Text style={styles.infoValue}>{validation.notes}</Text>
                      </View>
                    )}
                  </View>

                  {/* Photo and Signature Section */}
                  {(validation.photoUrl || validation.signatureUrl) && (
                    <View style={styles.mediaSection}>
                      <Text style={styles.mediaSectionTitle}>Evidencias</Text>

                      <View style={styles.mediaGrid}>
                        {validation.photoUrl && (
                          <View style={styles.mediaItem}>
                            <Text style={styles.mediaLabel}>Foto de Validación</Text>
                            <Image
                              source={{ uri: validation.photoUrl }}
                              style={styles.photoImage}
                              resizeMode="contain"
                            />
                            <TouchableOpacity
                              style={styles.viewFullButton}
                              onPress={() => {
                                // TODO: Open full screen image viewer
                              }}
                            >
                              <Text style={styles.viewFullButtonText}>Ver en tamaño completo</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {validation.signatureUrl && (
                          <View style={styles.mediaItem}>
                            <Text style={styles.mediaLabel}>Firma de Validación</Text>
                            <Image
                              source={{ uri: validation.signatureUrl }}
                              style={styles.signatureImage}
                              resizeMode="contain"
                            />
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Changes Section */}
                  {validation.changes && Object.keys(validation.changes).length > 0 && (
                    <View style={styles.changesSection}>
                      <Text style={styles.changesSectionTitle}>Cambios realizados</Text>
                      {Object.entries(validation.changes).map(([key, value]) => (
                        <View key={key} style={styles.changeRow}>
                          <Text style={styles.changeKey}>{key}:</Text>
                          <Text style={styles.changeValue}>
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeModalButton} onPress={onClose}>
            <Text style={styles.closeModalButtonText}>Cerrar</Text>
          </TouchableOpacity>
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
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 700,
    maxHeight: '90%',
  },
  modalContentTablet: {
    padding: 32,
    maxWidth: 900,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
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
    fontWeight: 'bold',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  validationCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  validationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  validationNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
  },
  validationDate: {
    fontSize: 13,
    color: '#64748B',
  },
  validationInfo: {
    marginBottom: 12,
  },
  infoRow: {
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
  },
  mediaSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  mediaSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mediaItem: {
    flex: 1,
    minWidth: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mediaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  photoImage: {
    width: '100%',
    height: 200,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
  },
  signatureImage: {
    width: '100%',
    height: 150,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  viewFullButton: {
    marginTop: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  viewFullButtonText: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
  },
  changesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  changesSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  changeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  changeKey: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginRight: 8,
  },
  changeValue: {
    fontSize: 13,
    color: '#1E293B',
    flex: 1,
  },
  closeModalButton: {
    marginTop: 16,
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
