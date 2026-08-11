import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

export interface RecurrentProductCandidate {
  productId: string;
  correlativeNumber: number;
  title: string;
  sku: string;
  barcode?: string;
  photos: string[];
  currentStock: number;
  stockByWarehouse: Array<{
    warehouseId: string;
    warehouseName: string;
    areaId?: string;
    areaName?: string;
    quantity: number;
  }>;
  lastPurchaseDate?: string;
  purchaseCount: number;
  supplierId: string;
  supplierName: string;
  costCents: number;
}

export interface RecurrentProductModalProps {
  visible: boolean;
  candidates: RecurrentProductCandidate[];
  message?: string;
  onConfirm: (productId: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

export const RecurrentProductModal: React.FC<RecurrentProductModalProps> = ({
  visible,
  candidates,
  message,
  onConfirm,
  onCreateNew,
  onCancel,
}) => {
  const styles = useThemedStyles(createStyles);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const hasCandidates = candidates.length > 0;

  useEffect(() => {
    if (visible) {
      setSelectedProductId(null);
    }
  }, [visible, candidates.length]);

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleConfirm = () => {
    if (selectedProductId) {
      onConfirm(selectedProductId);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={[styles.container, isTablet && styles.containerTablet]}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerContent}>
                <Text style={[styles.headerIcon, isTablet && styles.headerIconTablet]}>🔄</Text>
                <View style={styles.headerTextContainer}>
                  <Text style={[styles.title, isTablet && styles.titleTablet]}>
                    Validación de Recurrencia
                  </Text>
                  {message && (
                    <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
                      {message}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Question */}
            <View style={styles.questionContainer}>
              <Text style={[styles.questionText, isTablet && styles.questionTextTablet]}>
                {hasCandidates ? '¿Es alguno de estos productos?' : 'No se encontraron coincidencias'}
              </Text>
              <Text style={[styles.questionHint, isTablet && styles.questionHintTablet]}>
                {hasCandidates
                  ? 'Seleccione el producto existente para hacer MERGE y sumar stock, o cree uno nuevo si es diferente.'
                  : 'Revise la información ingresada. Si todo es correcto, confirme la creación de un producto nuevo.'}
              </Text>
            </View>

            {/* Candidates List */}
            <ScrollView style={styles.candidatesList} showsVerticalScrollIndicator={true}>
              {!hasCandidates && (
                <View style={styles.emptyStateCard}>
                  <Text style={styles.emptyStateIcon}>🔎</Text>
                  <Text style={[styles.emptyStateTitle, isTablet && styles.emptyStateTitleTablet]}>
                    Sin productos recurrentes
                  </Text>
                  <Text style={[styles.emptyStateText, isTablet && styles.emptyStateTextTablet]}>
                    No hay candidatos disponibles para MERGE. Esta revisión funciona como segunda validación antes de crear el producto nuevo y registrar el primer ingreso.
                  </Text>
                </View>
              )}

              {candidates.map((candidate) => (
                <TouchableOpacity
                  key={candidate.productId}
                  style={[
                    styles.candidateCard,
                    isTablet && styles.candidateCardTablet,
                    selectedProductId === candidate.productId && styles.candidateCardSelected,
                  ]}
                  onPress={() => setSelectedProductId(candidate.productId)}
                  activeOpacity={0.7}
                >
                  {/* Selection Indicator */}
                  <View
                    style={[
                      styles.selectionIndicator,
                      selectedProductId === candidate.productId &&
                        styles.selectionIndicatorSelected,
                    ]}
                  >
                    {selectedProductId === candidate.productId && (
                      <Text style={styles.selectionCheckmark}>✓</Text>
                    )}
                  </View>

                  {/* Product Photo */}
                  <View style={styles.photoContainer}>
                    {candidate.photos && candidate.photos.length > 0 ? (
                      <Image
                        source={{ uri: candidate.photos[0] }}
                        style={styles.productPhoto}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.noPhotoPlaceholder}>
                        <Text style={styles.noPhotoText}>📦</Text>
                      </View>
                    )}
                  </View>

                  {/* Product Info */}
                  <View style={styles.productInfo}>
                    <Text style={[styles.productTitle, isTablet && styles.productTitleTablet]}>
                      {candidate.title}
                    </Text>

                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                        SKU:
                      </Text>
                      <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                        {candidate.sku}
                      </Text>
                    </View>

                    {candidate.barcode && (
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                          Código de Barras:
                        </Text>
                        <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                          {candidate.barcode}
                        </Text>
                      </View>
                    )}

                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                        Stock Actual:
                      </Text>
                      <Text
                        style={[
                          styles.infoValue,
                          isTablet && styles.infoValueTablet,
                          styles.stockValue,
                        ]}
                      >
                        {candidate.currentStock} unidades
                      </Text>
                    </View>

                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                        Costo:
                      </Text>
                      <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                        {formatCurrency(candidate.costCents)}
                      </Text>
                    </View>

                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                        Proveedor:
                      </Text>
                      <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                        {candidate.supplierName}
                      </Text>
                    </View>

                    {candidate.lastPurchaseDate && (
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                          Última Compra:
                        </Text>
                        <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                          {formatDate(candidate.lastPurchaseDate)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                        Compras Totales:
                      </Text>
                      <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                        {candidate.purchaseCount}
                      </Text>
                    </View>

                    {/* Stock by Warehouse */}
                    {candidate.stockByWarehouse && candidate.stockByWarehouse.length > 0 && (
                      <View style={styles.warehouseSection}>
                        <Text
                          style={[
                            styles.warehouseSectionTitle,
                            isTablet && styles.warehouseSectionTitleTablet,
                          ]}
                        >
                          Stock por Almacén:
                        </Text>
                        {candidate.stockByWarehouse.map((warehouse, index) => (
                          <View key={index} style={styles.warehouseRow}>
                            <Text
                              style={[styles.warehouseName, isTablet && styles.warehouseNameTablet]}
                            >
                              • {warehouse.warehouseName}
                              {warehouse.areaName ? ` - ${warehouse.areaName}` : ''}:
                            </Text>
                            <Text
                              style={[
                                styles.warehouseQuantity,
                                isTablet && styles.warehouseQuantityTablet,
                              ]}
                            >
                              {warehouse.quantity} unidades
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Action Buttons */}
            <View style={[styles.footer, isTablet && styles.footerTablet]}>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  isTablet && styles.confirmButtonTablet,
                  !selectedProductId && styles.confirmButtonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={!selectedProductId}
              >
                <Text
                  style={[
                    styles.confirmButtonText,
                    isTablet && styles.confirmButtonTextTablet,
                    !selectedProductId && styles.confirmButtonTextDisabled,
                  ]}
                >
                  ✓ Confirmar MERGE y Sumar Stock
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createNewButton, isTablet && styles.createNewButtonTablet]}
                onPress={onCreateNew}
              >
                <Text
                  style={[styles.createNewButtonText, isTablet && styles.createNewButtonTextTablet]}
                >
                  {hasCandidates ? '+ Crear Producto Nuevo' : 'Confirmar Producto Nuevo'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    safeArea: {
      flex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      width: '90%',
      maxWidth: 500,
      height: '90%',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      overflow: 'hidden',
    },
    containerTablet: {
      maxWidth: 700,
      height: '95%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.default,
      backgroundColor: theme.color.surface.subtle,
    },
    headerContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerIcon: {
      fontSize: 32,
      marginRight: theme.space[3],
    },
    headerIconTablet: {
      fontSize: 40,
      marginRight: theme.space[4],
    },
    headerTextContainer: {
      flex: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    titleTablet: {
      fontSize: 22,
    },
    subtitle: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    subtitleTablet: {
      fontSize: 15,
    },
    closeButton: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.muted,
    },
    closeButtonText: {
      fontSize: 20,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    questionContainer: {
      padding: theme.space[5],
      backgroundColor: theme.color.state.warning.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.state.warning.border,
    },
    questionText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.state.warning.text,
      marginBottom: 6,
    },
    questionTextTablet: {
      fontSize: 18,
    },
    questionHint: {
      fontSize: 13,
      color: theme.color.state.warning.text,
    },
    questionHintTablet: {
      fontSize: 15,
    },
    candidatesList: {
      flex: 1,
      padding: theme.space[4],
    },
    emptyStateCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      borderStyle: 'dashed',
      padding: theme.space[6],
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    emptyStateIcon: {
      fontSize: 36,
      marginBottom: theme.space[3],
    },
    emptyStateTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
      textAlign: 'center',
    },
    emptyStateTitleTablet: {
      fontSize: 18,
    },
    emptyStateText: {
      fontSize: 13,
      color: theme.color.text.body,
      textAlign: 'center',
      lineHeight: 20,
    },
    emptyStateTextTablet: {
      fontSize: 15,
      lineHeight: 22,
    },
    candidateCard: {
      flexDirection: 'row',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      padding: theme.space[3],
      marginBottom: theme.space[3],
    },
    candidateCardTablet: {
      padding: theme.space[4],
      marginBottom: theme.space[4],
    },
    candidateCardSelected: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.state.info.background,
    },
    selectionIndicator: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[3],
      backgroundColor: theme.color.surface.base,
    },
    selectionIndicatorSelected: {
      borderColor: theme.color.brand.accent,
      backgroundColor: theme.color.brand.accent,
    },
    selectionCheckmark: {
      fontSize: 16,
      color: theme.color.text.inverse,
      fontWeight: '700',
    },
    photoContainer: {
      width: 80,
      height: 80,
      borderRadius: theme.radii.lg,
      overflow: 'hidden',
      marginRight: theme.space[3],
      backgroundColor: theme.color.surface.muted,
    },
    productPhoto: {
      width: '100%',
      height: '100%',
    },
    noPhotoPlaceholder: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.color.surface.muted,
    },
    noPhotoText: {
      fontSize: 32,
    },
    productInfo: {
      flex: 1,
    },
    productTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
    },
    productTitleTablet: {
      fontSize: 17,
    },
    infoRow: {
      flexDirection: 'row',
      marginBottom: theme.space[1],
    },
    infoLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginRight: 6,
      minWidth: 100,
    },
    infoLabelTablet: {
      fontSize: 14,
      minWidth: 120,
    },
    infoValue: {
      fontSize: 12,
      color: theme.color.text.heading,
      flex: 1,
    },
    infoValueTablet: {
      fontSize: 14,
    },
    stockValue: {
      fontWeight: '600',
      color: theme.color.text.success,
    },
    warehouseSection: {
      marginTop: theme.space[2],
      paddingTop: theme.space[2],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
    },
    warehouseSectionTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: theme.space[1],
    },
    warehouseSectionTitleTablet: {
      fontSize: 14,
    },
    warehouseRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    warehouseName: {
      fontSize: 11,
      color: theme.color.text.body,
      flex: 1,
    },
    warehouseNameTablet: {
      fontSize: 13,
    },
    warehouseQuantity: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.success,
    },
    warehouseQuantityTablet: {
      fontSize: 13,
    },
    footer: {
      padding: theme.space[4],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.default,
      backgroundColor: theme.color.surface.subtle,
    },
    footerTablet: {
      padding: theme.space[5],
    },
    confirmButton: {
      backgroundColor: theme.color.brand.primary,
      borderRadius: theme.radii.lg,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 10,
    },
    confirmButtonTablet: {
      paddingVertical: theme.space[4],
      marginBottom: theme.space[3],
    },
    confirmButtonDisabled: {
      backgroundColor: theme.color.border.default,
    },
    confirmButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.inverse,
    },
    confirmButtonTextTablet: {
      fontSize: 17,
    },
    confirmButtonTextDisabled: {
      color: theme.color.text.placeholder,
    },
    createNewButton: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      borderWidth: 2,
      borderColor: theme.color.brand.accent,
      paddingVertical: 14,
      alignItems: 'center',
    },
    createNewButtonTablet: {
      paddingVertical: theme.space[4],
    },
    createNewButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.brand.accent,
    },
    createNewButtonTextTablet: {
      fontSize: 17,
    },
  });
