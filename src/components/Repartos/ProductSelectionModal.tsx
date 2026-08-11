/**
 * ProductSelectionModal - Rediseñado con Design System
 *
 * Modal de selección de productos para exportar hojas de reparto.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { RepartoProducto } from '@/types/repartos';

// Design System
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import {
  Text,
  Title,
  Body,
  Caption,
  Button,
  Divider,
  EmptyState,
} from '@/design-system/components';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showOnlyNotDownloaded, setShowOnlyNotDownloaded] = useState(false);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  // Initialize with all products selected by default
  useEffect(() => {
    if (visible && products.length > 0) {
      const allProductIds = new Set(products.map((p) => p.productId).filter(Boolean));
      setSelectedProducts(allProductIds);
      setShowOnlyNotDownloaded(false);
    }
  }, [visible, products]);

  // When filter changes, adjust selection
  useEffect(() => {
    if (showOnlyNotDownloaded) {
      setSelectedProducts((prev) => {
        const newSet = new Set(prev);
        products.forEach((p) => {
          if (p.downloadCount && p.downloadCount > 0 && p.productId) {
            newSet.delete(p.productId);
          }
        });
        return newSet;
      });
    }
  }, [showOnlyNotDownloaded, products]);

  // Filter products based on download status
  const filteredProducts = showOnlyNotDownloaded
    ? products.filter((p) => !p.downloadCount || p.downloadCount === 0)
    : products;

  // Count products by download status
  const notDownloadedCount = products.filter((p) => !p.downloadCount || p.downloadCount === 0).length;
  const downloadedCount = products.length - notDownloadedCount;

  const toggleProduct = (productId: string) => {
    setSelectedProducts((prev) => {
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
    const visibleProductIds = filteredProducts.map((p) => p.productId).filter(Boolean);
    const allVisibleSelected = visibleProductIds.every((id) => selectedProducts.has(id));

    if (allVisibleSelected) {
      setSelectedProducts((prev) => {
        const newSet = new Set(prev);
        visibleProductIds.forEach((id) => newSet.delete(id));
        return newSet;
      });
    } else {
      setSelectedProducts((prev) => {
        const newSet = new Set(prev);
        visibleProductIds.forEach((id) => newSet.add(id));
        return newSet;
      });
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

  const visibleProductIds = filteredProducts.map((p) => p.productId).filter(Boolean);
  const allSelected = visibleProductIds.length > 0 && visibleProductIds.every((id) => selectedProducts.has(id));
  const someSelected = selectedProducts.size > 0 && !allSelected;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, isTablet && styles.modalContainerTablet]}>
          {/* Header */}
          <View style={styles.header}>
            <Title size="medium" align="center">
              Seleccionar Productos para Imprimir
            </Title>
            <Body size="small" color="secondary" align="center" style={styles.subtitle}>
              Selecciona los productos que deseas incluir en el PDF
            </Body>
          </View>

          {/* Download Statistics */}
          {(downloadedCount > 0 || notDownloadedCount > 0) && (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>📥</Text>
                <Caption color="secondary">Descargados:</Caption>
                <Text variant="labelLarge" color="primary" style={styles.statValue}>{downloadedCount}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statIcon}>⏳</Text>
                <Caption color="secondary">Pendientes:</Caption>
                <Text variant="labelLarge" color="primary" style={styles.statValue}>{notDownloadedCount}</Text>
              </View>
            </View>
          )}

          {/* Filter Toggle */}
          {notDownloadedCount > 0 && (
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[styles.filterButton, showOnlyNotDownloaded && styles.filterButtonActive]}
                onPress={() => setShowOnlyNotDownloaded(!showOnlyNotDownloaded)}
                activeOpacity={0.7}
              >
                <Text
                  variant="labelMedium"
                  color={showOnlyNotDownloaded ? theme.color.text.inverse : theme.color.text.muted}
                >
                  {showOnlyNotDownloaded ? '✓ ' : ''}Mostrar solo pendientes de descarga
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Select All Toggle */}
          <View style={styles.selectAllContainer}>
            <TouchableOpacity style={styles.selectAllButton} onPress={toggleAll} activeOpacity={0.7}>
              <View style={[
                styles.checkbox,
                allSelected && styles.checkboxChecked,
                someSelected && styles.checkboxIndeterminate,
              ]}>
                {allSelected && <Text style={styles.checkmark}>✓</Text>}
                {someSelected && <Text style={styles.checkmark}>−</Text>}
              </View>
              <Text variant="labelLarge" color={theme.color.brand.primary}>
                {showOnlyNotDownloaded
                  ? (allSelected ? 'Deseleccionar pendientes' : 'Seleccionar pendientes')
                  : (allSelected ? 'Deseleccionar todos' : 'Seleccionar todos')}
              </Text>
            </TouchableOpacity>
            <Caption color="tertiary">
              {selectedProducts.size} de {products.length} seleccionados
            </Caption>
          </View>

          <Divider spacing="none" />

          {/* Products List */}
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {filteredProducts.length === 0 ? (
              <EmptyState
                icon="cube-outline"
                title={showOnlyNotDownloaded ? 'Todo descargado' : 'Sin productos'}
                description={
                  showOnlyNotDownloaded
                    ? 'Todos los productos ya han sido descargados'
                    : 'No hay productos disponibles'
                }
                size="small"
              />
            ) : (
              filteredProducts
                .slice()
                .sort((a, b) => {
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
                  const downloadCount = product.downloadCount || 0;
                  const lastDownloadedAt = product.lastDownloadedAt;

                  return (
                    <TouchableOpacity
                      key={productKey}
                      style={[styles.productItem, isSelected && styles.productItemSelected]}
                      onPress={() => toggleProduct(productKey)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>

                      <View style={styles.productInfo}>
                        <View style={styles.productHeader}>
                          <Text variant="titleSmall" color="primary" style={styles.productName} numberOfLines={2}>
                            {productName}
                          </Text>
                          {downloadCount > 0 && (
                            <View style={styles.downloadBadge}>
                              <Text variant="labelSmall" color={theme.color.text.inverse}>
                                📥 {downloadCount}x
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.productDetails}>
                          <Caption color="tertiary">SKU: {productSKU}</Caption>
                          <Caption color="tertiary">
                            Cantidad: {product.quantityAssigned || product.quantityBase || 0}
                          </Caption>
                        </View>

                        {lastDownloadedAt && (
                          <Caption color={theme.color.text.success} style={styles.lastDownloadText}>
                            Última descarga: {new Date(lastDownloadedAt).toLocaleString('es-PE', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Caption>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <Button
              title="Cancelar"
              onPress={onClose}
              variant="outline"
              style={styles.footerButton}
            />
            <Button
              title={loading ? 'Generando...' : `Descargar PDF (${selectedProducts.size})`}
              onPress={handleConfirm}
              variant="primary"
              disabled={selectedProducts.size === 0 || loading}
              loading={loading}
              style={styles.footerButton}
            />
          </View>
        </View>
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
      padding: theme.space[5],
    },

    modalContainer: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      width: '100%',
      maxWidth: 600,
      maxHeight: '90%',
      ...theme.shadow.xl,
    },

    modalContainerTablet: {
      maxWidth: 800,
      maxHeight: '85%',
    },

    header: {
      padding: theme.space[5],
      paddingBottom: theme.space[3],
    },

    subtitle: {
      marginTop: theme.space[2],
    },

    // Stats
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
      backgroundColor: theme.color.state.info.background,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.color.state.info.border,
    },

    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1.5],
    },

    statIcon: {
      fontSize: 16,
    },

    statValue: {
      marginLeft: theme.space[1],
    },

    // Filter
    filterContainer: {
      padding: theme.space[3],
      paddingHorizontal: theme.space[4],
    },

    filterButton: {
      paddingVertical: theme.space[2.5],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      alignItems: 'center',
    },

    filterButtonActive: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },

    // Select All
    selectAllContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
      backgroundColor: theme.color.surface.subtle,
    },

    selectAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },

    // Checkbox
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: theme.radii.sm,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
    },

    checkboxChecked: {
      backgroundColor: theme.color.brand.primary,
      borderColor: theme.color.brand.primary,
    },

    checkboxIndeterminate: {
      backgroundColor: theme.color.text.subtle,
      borderColor: theme.color.text.subtle,
    },

    checkmark: {
      color: theme.color.text.inverse,
      fontSize: 14,
      fontWeight: 'bold',
    },

    // Products List
    scrollView: {
      flex: 1,
      maxHeight: 400,
    },

    scrollContent: {
      padding: theme.space[4],
    },

    productItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: theme.space[4],
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      borderWidth: 1.5,
      borderColor: theme.color.border.subtle,
      marginBottom: theme.space[2],
      gap: theme.space[3],
    },

    productItemSelected: {
      backgroundColor: theme.color.brand.primarySoft,
      borderColor: theme.color.brand.primary,
    },

    productInfo: {
      flex: 1,
    },

    productHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: theme.space[2],
      gap: theme.space[2],
    },

    productName: {
      flex: 1,
    },

    downloadBadge: {
      backgroundColor: theme.color.icon.success,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.full,
      flexShrink: 0,
    },

    productDetails: {
      flexDirection: 'row',
      gap: theme.space[4],
      flexWrap: 'wrap',
    },

    lastDownloadText: {
      marginTop: theme.space[1],
      fontStyle: 'italic',
    },

    // Footer
    footer: {
      flexDirection: 'row',
      padding: theme.space[4],
      gap: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.subtle,
      borderBottomLeftRadius: theme.radii.xl,
      borderBottomRightRadius: theme.radii.xl,
    },

    footerButton: {
      flex: 1,
    },
  });

export default ProductSelectionModal;
