import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { RepartoProducto } from '@/types/repartos';

interface ProductSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (selectedProductIds: string[]) => void;
  products: RepartoProducto[];
  loading?: boolean;
}

export const ProductSelectionModal: React.FC<ProductSelectionModalProps> = ({
  visible,
  onClose,
  onConfirm,
  products,
  loading = false,
}) => {
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  // Initialize with all products selected by default
  useEffect(() => {
    if (visible && products.length > 0) {
      const allProductIds = new Set(products.map(p => p.productId).filter(Boolean));
      setSelectedProducts(allProductIds);
    }
  }, [visible, products]);

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedProducts.size === products.length) {
      // Deselect all
      setSelectedProducts(new Set());
    } else {
      // Select all
      const allProductIds = new Set(products.map(p => p.productId).filter(Boolean));
      setSelectedProducts(allProductIds);
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedProducts));
  };

  const getProductName = (product: RepartoProducto) => {
    return product.product?.title || product.product?.name || 'Producto sin nombre';
  };

  const getProductSKU = (product: RepartoProducto) => {
    const correlative = (product.product as any)?.correlativeNumber;
    return `${correlative ? `#${correlative} | ` : ''}${product.product?.sku || 'N/A'}`;
  };

  const allSelected = selectedProducts.size === products.length;
  const someSelected = selectedProducts.size > 0 && selectedProducts.size < products.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, isTablet && styles.modalContainerTablet]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>
              Seleccionar Productos para Imprimir
            </Text>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
              Selecciona los productos que deseas incluir en el PDF
            </Text>
          </View>

          {/* Select All Toggle */}
          <View style={styles.selectAllContainer}>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={toggleAll}
              activeOpacity={0.7}
            >
              <View style={[
                styles.checkbox,
                isTablet && styles.checkboxTablet,
                allSelected && styles.checkboxChecked,
                someSelected && styles.checkboxIndeterminate,
              ]}>
                {allSelected && <Text style={styles.checkmark}>✓</Text>}
                {someSelected && <Text style={styles.checkmark}>−</Text>}
              </View>
              <Text style={[styles.selectAllText, isTablet && styles.selectAllTextTablet]}>
                {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.countText, isTablet && styles.countTextTablet]}>
              {selectedProducts.size} de {products.length} seleccionados
            </Text>
          </View>

          {/* Products List */}
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {products
              .slice()
              .sort((a, b) => {
                // Ordenar por correlativo
                const correlativeA = (a.product as any)?.correlativeNumber || 0;
                const correlativeB = (b.product as any)?.correlativeNumber || 0;
                return correlativeA - correlativeB;
              })
              .map((product) => {
              const productKey = product.productId;
              if (!productKey) return null;

              const isSelected = selectedProducts.has(productKey);
              const productName = getProductName(product);
              const productSKU = getProductSKU(product);

              return (
                <TouchableOpacity
                  key={productKey}
                  style={[
                    styles.productItem,
                    isTablet && styles.productItemTablet,
                    isSelected && styles.productItemSelected,
                  ]}
                  onPress={() => toggleProduct(productKey)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    isTablet && styles.checkboxTablet,
                    isSelected && styles.checkboxChecked,
                  ]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={[styles.productName, isTablet && styles.productNameTablet]}>
                      {productName}
                    </Text>
                    <View style={styles.productDetails}>
                      <Text style={[styles.productSKU, isTablet && styles.productSKUTablet]}>
                        SKU: {productSKU}
                      </Text>
                      <Text style={[styles.productQuantity, isTablet && styles.productQuantityTablet]}>
                        Cantidad: {product.quantityAssigned || product.quantityBase || 0}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.cancelButton, isTablet && styles.cancelButtonTablet]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelButtonText, isTablet && styles.cancelButtonTextTablet]}>
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                isTablet && styles.confirmButtonTablet,
                selectedProducts.size === 0 && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={selectedProducts.size === 0 || loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[styles.confirmButtonText, isTablet && styles.confirmButtonTextTablet]}>
                  Descargar PDF ({selectedProducts.size})
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
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
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 900,
    height: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainerTablet: {
    maxWidth: 1200,
    height: '85%',
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  titleTablet: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
  },
  subtitleTablet: {
    fontSize: 18,
  },
  selectAllContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  selectAllTextTablet: {
    fontSize: 16,
  },
  countText: {
    fontSize: 12,
    color: '#64748B',
  },
  countTextTablet: {
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 24,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    gap: 14,
  },
  productItemTablet: {
    padding: 20,
    marginBottom: 14,
  },
  productItemSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxTablet: {
    width: 28,
    height: 28,
  },
  checkboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  checkboxIndeterminate: {
    backgroundColor: '#94A3B8',
    borderColor: '#94A3B8',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
    lineHeight: 20,
  },
  productNameTablet: {
    fontSize: 18,
    lineHeight: 24,
  },
  productDetails: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  productSKU: {
    fontSize: 13,
    color: '#64748B',
  },
  productSKUTablet: {
    fontSize: 16,
  },
  productQuantity: {
    fontSize: 13,
    color: '#64748B',
  },
  productQuantityTablet: {
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonTablet: {
    paddingVertical: 16,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  cancelButtonTextTablet: {
    fontSize: 18,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  confirmButtonTablet: {
    paddingVertical: 16,
  },
  confirmButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmButtonTextTablet: {
    fontSize: 18,
  },
});
