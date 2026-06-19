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
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

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
  const styles = useThemedStyles(createStyles);
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[5],
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      padding: theme.space[6],
      width: '100%',
      maxWidth: 700,
      maxHeight: '90%',
    },
    modalContentTablet: {
      padding: theme.space[8],
      maxWidth: 900,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[5],
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
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
      fontWeight: 'bold',
    },
    emptyState: {
      paddingVertical: theme.space[10],
      alignItems: 'center',
    },
    emptyStateText: {
      fontSize: 14,
      color: theme.color.text.placeholder,
    },
    validationCard: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    validationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
      paddingBottom: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.default,
    },
    validationNumber: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.brand.accent,
    },
    validationDate: {
      fontSize: 13,
      color: theme.color.text.muted,
    },
    validationInfo: {
      marginBottom: theme.space[3],
    },
    infoRow: {
      marginBottom: theme.space[2],
    },
    infoLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: 2,
    },
    infoValue: {
      fontSize: 14,
      color: theme.color.text.heading,
    },
    mediaSection: {
      marginTop: theme.space[3],
      paddingTop: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
    },
    mediaSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: theme.space[3],
    },
    mediaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[3],
    },
    mediaItem: {
      flex: 1,
      minWidth: 250,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    mediaLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: theme.space[2],
    },
    photoImage: {
      width: '100%',
      height: 200,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
    },
    signatureImage: {
      width: '100%',
      height: 150,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    viewFullButton: {
      marginTop: theme.space[2],
      paddingVertical: 6,
      alignItems: 'center',
    },
    viewFullButtonText: {
      fontSize: 12,
      color: theme.color.brand.accent,
      fontWeight: '600',
    },
    changesSection: {
      marginTop: theme.space[3],
      paddingTop: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
    },
    changesSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: theme.space[2],
    },
    changeRow: {
      flexDirection: 'row',
      marginBottom: theme.space[1],
    },
    changeKey: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.color.text.muted,
      marginRight: theme.space[2],
    },
    changeValue: {
      fontSize: 13,
      color: theme.color.text.heading,
      flex: 1,
    },
    closeModalButton: {
      marginTop: theme.space[4],
      backgroundColor: theme.color.brand.primary,
      paddingVertical: 14,
      borderRadius: theme.radii.lg,
      alignItems: 'center',
    },
    closeModalButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
  });
