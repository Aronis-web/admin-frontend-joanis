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
import { colors, spacing, borderRadius } from '@/design-system/tokens';

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
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    padding: spacing[6],
    width: '100%',
    maxWidth: 700,
    maxHeight: '90%',
  },
  modalContentTablet: {
    padding: spacing[8],
    maxWidth: 900,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
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
    fontWeight: 'bold',
  },
  emptyState: {
    paddingVertical: spacing[10],
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.neutral[400],
  },
  validationCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  validationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  validationNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary[500],
  },
  validationDate: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  validationInfo: {
    marginBottom: spacing[3],
  },
  infoRow: {
    marginBottom: spacing[2],
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[600],
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    color: colors.neutral[800],
  },
  mediaSection: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  mediaSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[600],
    marginBottom: spacing[3],
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  mediaItem: {
    flex: 1,
    minWidth: 250,
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  mediaLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.neutral[600],
    marginBottom: spacing[2],
  },
  photoImage: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.secondary,
  },
  signatureImage: {
    width: '100%',
    height: 150,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  viewFullButton: {
    marginTop: spacing[2],
    paddingVertical: spacing[1.5],
    alignItems: 'center',
  },
  viewFullButtonText: {
    fontSize: 12,
    color: colors.primary[500],
    fontWeight: '600',
  },
  changesSection: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  changesSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[600],
    marginBottom: spacing[2],
  },
  changeRow: {
    flexDirection: 'row',
    marginBottom: spacing[1],
  },
  changeKey: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.neutral[500],
    marginRight: spacing[2],
  },
  changeValue: {
    fontSize: 13,
    color: colors.neutral[800],
    flex: 1,
  },
  closeModalButton: {
    marginTop: spacing[4],
    backgroundColor: colors.primary[500],
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
});
