import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

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
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

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
                    Producto Recurrente Detectado
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
                ¿Es alguno de estos productos?
              </Text>
              <Text style={[styles.questionHint, isTablet && styles.questionHintTablet]}>
                Seleccione el producto existente para sumar stock, o cree uno nuevo si es diferente.
              </Text>
            </View>

            {/* Candidates List */}
            <ScrollView style={styles.candidatesList} showsVerticalScrollIndicator={true}>
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
                  ✓ Confirmar y Sumar Stock
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createNewButton, isTablet && styles.createNewButtonTablet]}
                onPress={onCreateNew}
              >
                <Text
                  style={[styles.createNewButtonText, isTablet && styles.createNewButtonTextTablet]}
                >
                  + Crear Producto Nuevo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
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
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
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
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    backgroundColor: colors.background.secondary,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 32,
    marginRight: spacing[3],
  },
  headerIconTablet: {
    fontSize: 40,
    marginRight: spacing[4],
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  titleTablet: {
    fontSize: 22,
  },
  subtitle: {
    fontSize: 13,
    color: colors.neutral[500],
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
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  questionContainer: {
    padding: spacing[5],
    backgroundColor: colors.warning[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.warning[200],
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.warning[800],
    marginBottom: spacing[1.5],
  },
  questionTextTablet: {
    fontSize: 18,
  },
  questionHint: {
    fontSize: 13,
    color: colors.warning[700],
  },
  questionHintTablet: {
    fontSize: 15,
  },
  candidatesList: {
    flex: 1,
    padding: spacing[4],
  },
  candidateCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.border.default,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  candidateCardTablet: {
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  candidateCardSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  selectionIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.neutral[300],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
    backgroundColor: colors.surface.primary,
  },
  selectionIndicatorSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[500],
  },
  selectionCheckmark: {
    fontSize: 16,
    color: colors.neutral[0],
    fontWeight: '700',
  },
  photoContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginRight: spacing[3],
    backgroundColor: colors.neutral[100],
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
    backgroundColor: colors.neutral[100],
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
    color: colors.neutral[800],
    marginBottom: spacing[2],
  },
  productTitleTablet: {
    fontSize: 17,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: spacing[1],
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    marginRight: spacing[1.5],
    minWidth: 100,
  },
  infoLabelTablet: {
    fontSize: 14,
    minWidth: 120,
  },
  infoValue: {
    fontSize: 12,
    color: colors.neutral[800],
    flex: 1,
  },
  infoValueTablet: {
    fontSize: 14,
  },
  stockValue: {
    fontWeight: '600',
    color: colors.success[600],
  },
  warehouseSection: {
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  warehouseSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: spacing[1],
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
    color: colors.neutral[600],
    flex: 1,
  },
  warehouseNameTablet: {
    fontSize: 13,
  },
  warehouseQuantity: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success[600],
  },
  warehouseQuantityTablet: {
    fontSize: 13,
  },
  footer: {
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    backgroundColor: colors.background.secondary,
  },
  footerTablet: {
    padding: spacing[5],
  },
  confirmButton: {
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.lg,
    paddingVertical: spacing[3.5],
    alignItems: 'center',
    marginBottom: spacing[2.5],
  },
  confirmButtonTablet: {
    paddingVertical: spacing[4],
    marginBottom: spacing[3],
  },
  confirmButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  confirmButtonTextTablet: {
    fontSize: 17,
  },
  confirmButtonTextDisabled: {
    color: colors.neutral[400],
  },
  createNewButton: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary[500],
    paddingVertical: spacing[3.5],
    alignItems: 'center',
  },
  createNewButtonTablet: {
    paddingVertical: spacing[4],
  },
  createNewButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary[500],
  },
  createNewButtonTextTablet: {
    fontSize: 17,
  },
});
