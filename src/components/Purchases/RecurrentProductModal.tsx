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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  containerTablet: {
    maxWidth: 700,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  headerIconTablet: {
    fontSize: 40,
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  titleTablet: {
    fontSize: 22,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
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
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  questionContainer: {
    padding: 20,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 6,
  },
  questionTextTablet: {
    fontSize: 18,
  },
  questionHint: {
    fontSize: 13,
    color: '#B45309',
  },
  questionHintTablet: {
    fontSize: 15,
  },
  candidatesList: {
    flex: 1,
    padding: 16,
  },
  candidateCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 12,
  },
  candidateCardTablet: {
    padding: 16,
    marginBottom: 16,
  },
  candidateCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  selectionIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  selectionIndicatorSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#6366F1',
  },
  selectionCheckmark: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  photoContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#F1F5F9',
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
    color: '#1E293B',
    marginBottom: 8,
  },
  productTitleTablet: {
    fontSize: 17,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 6,
    minWidth: 100,
  },
  infoLabelTablet: {
    fontSize: 14,
    minWidth: 120,
  },
  infoValue: {
    fontSize: 12,
    color: '#1E293B',
    flex: 1,
  },
  infoValueTablet: {
    fontSize: 14,
  },
  stockValue: {
    fontWeight: '600',
    color: '#059669',
  },
  warehouseSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  warehouseSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
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
    color: '#475569',
    flex: 1,
  },
  warehouseNameTablet: {
    fontSize: 13,
  },
  warehouseQuantity: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  warehouseQuantityTablet: {
    fontSize: 13,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  footerTablet: {
    padding: 20,
  },
  confirmButton: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmButtonTablet: {
    paddingVertical: 16,
    marginBottom: 12,
  },
  confirmButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confirmButtonTextTablet: {
    fontSize: 17,
  },
  confirmButtonTextDisabled: {
    color: '#94A3B8',
  },
  createNewButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#6366F1',
    paddingVertical: 14,
    alignItems: 'center',
  },
  createNewButtonTablet: {
    paddingVertical: 16,
  },
  createNewButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6366F1',
  },
  createNewButtonTextTablet: {
    fontSize: 17,
  },
});
