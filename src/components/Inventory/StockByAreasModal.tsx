import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { inventoryApi, StockItemResponse } from '@/services/api/inventory';
import { productsApi } from '@/services/api/products';

import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import {
  Text,
  Title,
  Body,
  Caption,
  Label,
  Numeric,
  Button,
  Card,
  IconButton,
  EmptyState,
} from '@/design-system/components';

interface StockByAreasModalProps {
  visible: boolean;
  onClose: () => void;
  productId: string;
  productTitle?: string;
  productSku?: string;
}

export const StockByAreasModal: React.FC<StockByAreasModalProps> = ({
  visible,
  onClose,
  productId,
  productTitle,
  productSku,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(false);
  const [stockItems, setStockItems] = useState<StockItemResponse[]>([]);
  const [productImages, setProductImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loadingImages, setLoadingImages] = useState(false);

  useEffect(() => {
    if (visible && productId) {
      loadStockByAreas();
      loadProductImages();
    }
  }, [visible, productId]);

  const loadStockByAreas = async () => {
    try {
      setLoading(true);
      console.log('📦 Loading stock by areas for product:', productId);

      const data = await inventoryApi.getStockByProductWithAreas(productId);
      console.log('✅ Stock by areas loaded:', data);
      console.log('✅ Number of stock items:', data?.length || 0);

      // Log each item to debug
      data?.forEach((item, index) => {
        console.log(`Item ${index}:`, {
          warehouseId: item.warehouseId,
          warehouseName: item.warehouse?.name,
          areaId: item.areaId,
          areaName: item.area?.name,
          quantity: item.quantityBase,
        });
      });

      setStockItems(data || []);
    } catch (error: any) {
      console.error('❌ Error loading stock by areas:', error);
      Alert.alert('Error', error.response?.data?.message || 'No se pudo cargar el stock por áreas');
    } finally {
      setLoading(false);
    }
  };

  const loadProductImages = async () => {
    try {
      setLoadingImages(true);
      console.log('🖼️ Loading product images for product:', productId);

      const response = await productsApi.getProductImages(productId);
      console.log('✅ Product images loaded:', response);

      if (response.images && response.images.length > 0) {
        const imageUrls = response.images.map((img) => img.url);
        setProductImages(imageUrls);
        setCurrentImageIndex(0);
      } else {
        setProductImages([]);
      }
    } catch (error: any) {
      console.error('❌ Error loading product images:', error);
      setProductImages([]);
    } finally {
      setLoadingImages(false);
    }
  };

  const handleNextImage = () => {
    if (productImages.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % productImages.length);
    }
  };

  const handlePrevImage = () => {
    if (productImages.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + productImages.length) % productImages.length);
    }
  };

  const getTotalStock = () => {
    return stockItems.reduce((sum, item) => {
      // Use availableQuantityBase (stock disponible) instead of quantityBase (stock total)
      const quantity =
        typeof item.availableQuantityBase === 'number'
          ? item.availableQuantityBase
          : typeof item.quantityBase === 'string'
            ? parseFloat(item.quantityBase)
            : item.quantityBase || 0;
      return sum + quantity;
    }, 0);
  };

  const groupByWarehouse = () => {
    const grouped: { [key: string]: StockItemResponse[] } = {};

    stockItems.forEach((item) => {
      const warehouseId = item.warehouseId;
      if (!grouped[warehouseId]) {
        grouped[warehouseId] = [];
      }
      grouped[warehouseId].push(item);
    });

    console.log('📊 Grouped warehouses:', Object.keys(grouped).length);
    Object.entries(grouped).forEach(([warehouseId, items]) => {
      console.log(`  Warehouse ${warehouseId}: ${items.length} items`);
      items.forEach((item, idx) => {
        console.log(`    Item ${idx}:`, {
          areaCode: item.area?.code,
          areaName: item.area?.name,
          quantity: item.quantityBase,
        });
      });
    });

    return grouped;
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Title size="large">Stock por Áreas</Title>
              {productTitle && <Body size="medium" color="secondary" style={styles.headerSubtitle}>{productTitle}</Body>}
              {productSku && <Caption color="tertiary">SKU: {productSku}</Caption>}
            </View>
            <IconButton
              icon="close"
              onPress={onClose}
              variant="ghost"
              size="medium"
            />
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {/* Product Images Slider */}
            {productImages.length > 0 && (
              <View style={styles.imageSliderContainer}>
                <View style={styles.imageSlider}>
                  <Image
                    source={{ uri: productImages[currentImageIndex] }}
                    style={styles.productImage}
                    resizeMode="contain"
                  />
                  {productImages.length > 1 && (
                    <>
                      <TouchableOpacity
                        style={[styles.imageNavButton, styles.imageNavButtonLeft]}
                        onPress={handlePrevImage}
                      >
                        <Text style={styles.imageNavButtonText}>‹</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.imageNavButton, styles.imageNavButtonRight]}
                        onPress={handleNextImage}
                      >
                        <Text style={styles.imageNavButtonText}>›</Text>
                      </TouchableOpacity>
                      <View style={styles.imageIndicatorContainer}>
                        {productImages.map((_, index) => (
                          <View
                            key={index}
                            style={[
                              styles.imageIndicator,
                              index === currentImageIndex && styles.imageIndicatorActive,
                            ]}
                          />
                        ))}
                      </View>
                      <View style={styles.imageCounter}>
                        <Text style={styles.imageCounterText}>
                          {currentImageIndex + 1} / {productImages.length}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>
            )}

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.color.brand.primary} />
                <Body color="secondary" style={styles.loadingText}>Cargando stock...</Body>
              </View>
            ) : stockItems.length === 0 ? (
              <EmptyState
                icon="cube-outline"
                title="Sin Stock"
                description="Este producto no tiene stock en ningún almacén o área"
              />
            ) : (
              <>
                {/* Total Stock Summary */}
                <View style={styles.summaryCard}>
                  <Label size="medium" color={theme.color.text.inverse} style={styles.summaryLabel}>Stock Disponible</Label>
                  <Numeric size="large" color={theme.color.text.inverse}>{getTotalStock().toFixed(2)} unidades</Numeric>
                  <Caption color={theme.color.text.inverse}>En {stockItems.length} ubicación(es)</Caption>
                </View>

                {/* Warehouse Sections */}
                {Object.entries(groupByWarehouse()).map(([warehouseId, items]) => {
                  const warehouseName = items[0].warehouse?.name || 'Almacén desconocido';
                  const warehouseCode = items[0].warehouse?.code || 'N/A';
                  const warehouseTotal = items.reduce((sum, item) => {
                    const quantity =
                      typeof item.availableQuantityBase === 'number'
                        ? item.availableQuantityBase
                        : typeof item.quantityBase === 'string'
                          ? parseFloat(item.quantityBase)
                          : item.quantityBase || 0;
                    return sum + quantity;
                  }, 0);

                  return (
                    <Card key={warehouseId} variant="outlined" padding="none" style={styles.warehouseSection}>
                      {/* Warehouse Header */}
                      <View style={styles.warehouseHeader}>
                        <View style={styles.warehouseHeaderLeft}>
                          <Text variant="headingSmall">🏢</Text>
                          <View style={styles.warehouseHeaderInfo}>
                            <Title size="small">{warehouseName}</Title>
                            <Caption color={theme.color.brand.accent}>Código: {warehouseCode}</Caption>
                          </View>
                        </View>
                        <View style={styles.warehouseTotalBadge}>
                          <Numeric size="medium" color={theme.color.text.inverse}>
                            {warehouseTotal.toFixed(2)}
                          </Numeric>
                          <Caption color={theme.color.text.inverse}>unidades</Caption>
                        </View>
                      </View>

                      {/* Areas within this warehouse */}
                      {items.map((item, index) => {
                        const quantity =
                          typeof item.availableQuantityBase === 'number'
                            ? item.availableQuantityBase
                            : typeof item.quantityBase === 'string'
                              ? parseFloat(item.quantityBase)
                              : item.quantityBase || 0;

                        return (
                          <View key={index} style={styles.areaCard}>
                            <View style={styles.areaCardContent}>
                              <View style={styles.areaCardLeft}>
                                <Text variant="bodyLarge">📍</Text>
                                <View style={styles.areaCardInfo}>
                                  <Body size="medium" color="primary">
                                    {item.area
                                      ? item.area.name || `Área ${item.area.code}` || 'Sin nombre'
                                      : 'Sin área específica'}
                                  </Body>
                                  {item.area?.code && item.area?.name && (
                                    <Caption color="tertiary">Código: {item.area.code}</Caption>
                                  )}
                                </View>
                              </View>
                              <View style={styles.areaQuantityBadge}>
                                <Numeric size="small" color={theme.color.text.inverse}>{quantity.toFixed(2)}</Numeric>
                              </View>
                            </View>
                            <View style={styles.areaCardFooter}>
                              <Caption color="tertiary">
                                Actualizado:{' '}
                                {new Date(item.updatedAt).toLocaleDateString('es-ES', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Caption>
                            </View>
                          </View>
                        );
                      })}
                    </Card>
                  );
                })}
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button
              title="Cerrar"
              variant="primary"
              onPress={onClose}
              fullWidth
            />
          </View>
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
    },
    modalContainer: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      width: '90%',
      maxWidth: 600,
      height: '85%',
      ...theme.shadow.xl,
      flexDirection: 'column',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    headerContent: {
      flex: 1,
      marginRight: theme.space[3],
    },
    headerSubtitle: {
      marginTop: theme.space[1],
      marginBottom: theme.space[0.5],
    },
    summaryCard: {
      backgroundColor: theme.color.brand.primary,
      marginHorizontal: theme.space[5],
      marginTop: theme.space[4],
      marginBottom: theme.space[4],
      padding: theme.space[6],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      ...theme.shadow.lg,
    },
    summaryLabel: {
      marginBottom: theme.space[2],
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    content: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.space[16],
    },
    loadingText: {
      marginTop: theme.space[3],
    },
    warehouseSection: {
      marginBottom: theme.space[4],
      marginHorizontal: theme.space[5],
    },
    warehouseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.space[4],
      backgroundColor: theme.color.state.info.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.state.info.border,
    },
    warehouseHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: theme.space[3],
      gap: theme.space[3],
    },
    warehouseHeaderInfo: {
      flex: 1,
    },
    warehouseTotalBadge: {
      backgroundColor: theme.color.brand.primary,
      paddingHorizontal: theme.space[3.5],
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      minWidth: 90,
    },
    areaCard: {
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      backgroundColor: theme.color.surface.base,
    },
    areaCardContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.space[4],
      paddingLeft: theme.space[6],
    },
    areaCardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: theme.space[3],
      gap: theme.space[3],
    },
    areaCardInfo: {
      flex: 1,
    },
    areaQuantityBadge: {
      backgroundColor: theme.color.action.success.background,
      paddingHorizontal: theme.space[3.5],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.md,
      minWidth: 80,
      alignItems: 'center',
    },
    areaCardFooter: {
      paddingHorizontal: theme.space[4],
      paddingBottom: theme.space[3],
      paddingLeft: theme.space[14],
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      padding: theme.space[4],
    },
    imageSliderContainer: {
      marginHorizontal: theme.space[5],
      marginTop: theme.space[4],
      marginBottom: theme.space[2],
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.state.info.border,
    },
    imageSlider: {
      position: 'relative',
      width: '100%',
      height: 250,
      backgroundColor: theme.color.surface.base,
    },
    productImage: {
      width: '100%',
      height: '100%',
    },
    imageNavButton: {
      position: 'absolute',
      top: '50%',
      transform: [{ translateY: -25 }],
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.color.action.primary.backgroundHover,
      justifyContent: 'center',
      alignItems: 'center',
      ...theme.shadow.md,
    },
    imageNavButtonLeft: {
      left: 10,
    },
    imageNavButtonRight: {
      right: 10,
    },
    imageNavButtonText: {
      fontSize: 32,
      fontWeight: 'bold',
      color: theme.color.text.inverse,
      lineHeight: 32,
    },
    imageIndicatorContainer: {
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: theme.space[1.5],
    },
    imageIndicator: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    imageIndicatorActive: {
      backgroundColor: theme.color.text.inverse,
      width: 24,
    },
    imageCounter: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: theme.color.overlay.medium,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.lg,
    },
    imageCounterText: {
      color: theme.color.text.inverse,
      fontSize: 12,
      fontWeight: '600',
    },
  });

export default StockByAreasModal;
