import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import {
  TransmisionProduct,
  formatCentsToCurrency,
  isProductPreliminary,
} from '@/types/transmisiones';
import { inventoryApi } from '@/services/api/inventory';
import { purchasesService } from '@/services/api/purchases';

interface ProductBannerModalProps {
  visible: boolean;
  product: TransmisionProduct | null;
  onClose: () => void;
}

export const ProductBannerModal: React.FC<ProductBannerModalProps> = ({
  visible,
  product,
  onClose,
}) => {
  const styles = useThemedStyles(createStyles);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const [loadingStock, setLoadingStock] = useState(false);
  const [stockData, setStockData] = useState<{
    stock?: number;
    preliminaryStock?: number;
  }>({});

  // Fetch stock data when modal opens
  useEffect(() => {
    if (visible && product?.productId) {
      fetchStockData();
    }
  }, [visible, product?.productId]);

  const fetchStockData = async () => {
    if (!product?.productId) {
      return;
    }

    const isPrelim = isProductPreliminary(product.productStatus);

    try {
      setLoadingStock(true);

      if (isPrelim) {
        // For preliminary products, search in all purchases to find the preliminary stock
        console.log('🔍 Searching preliminary stock in purchases for product:', product.productId);

        // Get recent purchases (not closed or cancelled)
        const purchasesResponse = await purchasesService.getPurchases({
          page: 1,
          limit: 50,
        });

        let prelimStock = 0;

        // Search through all purchases for this product
        if (purchasesResponse.data && purchasesResponse.data.length > 0) {
          for (const purchase of purchasesResponse.data) {
            // Skip closed and cancelled purchases
            if (purchase.status === 'CLOSED' || purchase.status === 'CANCELLED') {
              continue;
            }

            try {
              const products = await purchasesService.getPurchaseProducts(purchase.id, {
                includeProductStatus: 'preliminary',
              });

              // Find the product in this purchase
              const foundProduct = products.find((p) => p.productId === product.productId);
              if (foundProduct && foundProduct.preliminaryStock) {
                prelimStock = foundProduct.preliminaryStock;
                console.log(
                  '✅ Found preliminary stock:',
                  prelimStock,
                  'in purchase:',
                  purchase.id
                );
                break; // Found it, stop searching
              }
            } catch (err) {
              // Continue searching in other purchases
              console.log('⚠️ Could not get products from purchase:', purchase.id);
            }
          }
        }

        setStockData({
          stock: prelimStock,
          preliminaryStock: prelimStock,
        });
      } else {
        // For active products, use inventory API
        const stockData = await inventoryApi.getStockByProduct(product.productId);
        console.log('📦 Fetched inventory stock data:', stockData);

        const totalStock = stockData.totalQuantityBase || 0;

        setStockData({
          stock: totalStock,
          preliminaryStock: totalStock,
        });
      }
    } catch (error) {
      console.error('Error fetching stock data:', error);
      // If error, set stock to 0 instead of undefined
      setStockData({
        stock: 0,
        preliminaryStock: 0,
      });
    } finally {
      setLoadingStock(false);
    }
  };

  if (!product) {
    return null;
  }

  const isPreliminary = isProductPreliminary(product.productStatus);
  const costCents = product.costCents || 0;
  const precioSocia = Math.round(costCents * 1.3);
  const precioFranquicia = Math.round(costCents * 1.13);

  // Determine which stock to show
  const stockValue = isPreliminary ? stockData.preliminaryStock : stockData.stock;
  const stockLabel = isPreliminary ? 'Stock Preliminar' : 'Stock';

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, isTablet && styles.containerTablet]}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* SKU Banner */}
            <View style={styles.bannerSection}>
              <Text style={styles.bannerLabel}>SKU</Text>
              <Text style={[styles.bannerValue, isTablet && styles.bannerValueTablet]}>
                {product.product?.sku || 'N/A'}
              </Text>
            </View>

            {/* Product Name Banner */}
            <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
              <Text style={styles.bannerLabel}>PRODUCTO</Text>
              <Text
                style={[
                  styles.bannerValue,
                  styles.bannerValueName,
                  isTablet && styles.bannerValueTablet,
                ]}
              >
                {product.product?.title || 'Sin nombre'}
              </Text>
            </View>

            {/* Stock Banner */}
            <View style={styles.bannerSection}>
              <Text style={styles.bannerLabel}>{stockLabel.toUpperCase()}</Text>
              {loadingStock ? (
                <View style={styles.loadingStockContainer}>
                  <ActivityIndicator size="large" color={PRESENTATION_ACCENT} />
                  <Text style={styles.loadingStockText}>Cargando stock...</Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.bannerValue,
                    styles.stockValue,
                    isTablet && styles.bannerValueTablet,
                  ]}
                >
                  {stockValue !== undefined && stockValue !== null ? stockValue : 'N/A'}
                </Text>
              )}
              {isPreliminary && <Text style={styles.preliminaryNote}>⚠️ Producto Preliminar</Text>}
            </View>

            {/* Cost Banner */}
            <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
              <Text style={styles.bannerLabel}>COSTO</Text>
              <Text
                style={[styles.bannerValue, styles.costValue, isTablet && styles.bannerValueTablet]}
              >
                {formatCentsToCurrency(costCents)}
              </Text>
            </View>

            {/* Precio Socia Banner - SUPER DESTACADO */}
            <View style={[styles.bannerSection, styles.bannerSectionHighlight]}>
              <View style={styles.highlightBadge}>
                <Text style={styles.highlightBadgeText}>⭐ PRECIO DESTACADO ⭐</Text>
              </View>
              <Text style={[styles.bannerLabel, styles.bannerLabelHighlight]}>PRECIO SOCIA</Text>
              <View style={styles.priceHighlightContainer}>
                <Text
                  style={[
                    styles.bannerValue,
                    styles.priceSociaValue,
                    styles.priceSociaValueHighlight,
                    isTablet && styles.bannerValueTabletHighlight,
                  ]}
                >
                  {formatCentsToCurrency(precioSocia)}
                </Text>
              </View>
              <Text style={styles.calculationNoteHighlight}>💰 Costo × 1.30 💰</Text>
            </View>

            {/* Precio Franquicia Banner */}
            <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
              <Text style={styles.bannerLabel}>PRECIO FRANQUICIA</Text>
              <Text
                style={[
                  styles.bannerValue,
                  styles.priceFranquiciaValue,
                  isTablet && styles.bannerValueTablet,
                ]}
              >
                {formatCentsToCurrency(precioFranquicia)}
              </Text>
              <Text style={styles.calculationNote}>Costo × 1.13</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Modo presentación: paleta oscura fija independiente del theme para máxima visibilidad.
const PRESENTATION_BG = '#262626';
const PRESENTATION_SURFACE = '#404040';
const PRESENTATION_BORDER = '#525252';
const PRESENTATION_TEXT = '#FFFFFF';
const PRESENTATION_TEXT_MUTED = '#A3A3A3';
const PRESENTATION_ACCENT = '#A1A1A1';
const PRESENTATION_SUCCESS_STRONG = '#22C55E';
const PRESENTATION_SUCCESS_LIGHT = '#4ADE80';
const PRESENTATION_WARNING_STRONG = '#F59E0B';
const PRESENTATION_WARNING_LIGHT = '#FBBF24';
const PRESENTATION_FRANQUICIA = '#F472B6';
const PRESENTATION_OVERLAY_LIGHT = 'rgba(0,0,0,0.3)';
const PRESENTATION_OVERLAY_MEDIUM = 'rgba(0,0,0,0.5)';
const PRESENTATION_OVERLAY_DARK = 'rgba(0,0,0,0.7)';
const PRESENTATION_HIGHLIGHT_BG = '#000000';

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: PRESENTATION_OVERLAY_DARK,
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      width: '100%',
      height: '100%',
      backgroundColor: PRESENTATION_BG,
      position: 'relative',
    },
    containerTablet: {
      width: '90%',
      height: '90%',
      borderRadius: theme.radii['2xl'],
    },
    closeButton: {
      position: 'absolute',
      top: 40,
      right: theme.space[5],
      zIndex: 10,
      backgroundColor: PRESENTATION_OVERLAY_LIGHT,
      width: 50,
      height: 50,
      borderRadius: theme.radii.full,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: PRESENTATION_OVERLAY_MEDIUM,
    },
    closeButtonText: {
      fontSize: 28,
      color: PRESENTATION_TEXT,
      fontWeight: '700',
    },
    scrollContent: {
      paddingTop: 80,
      paddingBottom: 30,
      paddingHorizontal: theme.space[4],
    },
    bannerSection: {
      backgroundColor: PRESENTATION_SURFACE,
      paddingVertical: theme.space[5],
      paddingHorizontal: theme.space[5],
      marginBottom: theme.space[3],
      borderRadius: theme.radii.xl,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: PRESENTATION_BORDER,
    },
    bannerSectionAlt: {
      backgroundColor: PRESENTATION_BG,
      borderColor: PRESENTATION_BORDER,
    },
    bannerSectionHighlight: {
      backgroundColor: PRESENTATION_HIGHLIGHT_BG,
      borderColor: PRESENTATION_SUCCESS_STRONG,
      borderWidth: 4,
      shadowColor: PRESENTATION_SUCCESS_STRONG,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 20,
      elevation: 12,
      marginVertical: theme.space[4],
      paddingVertical: theme.space[7],
    },
    highlightBadge: {
      position: 'absolute',
      top: -15,
      alignSelf: 'center',
      backgroundColor: PRESENTATION_SUCCESS_STRONG,
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii['2xl'],
      borderWidth: 2,
      borderColor: PRESENTATION_TEXT,
    },
    highlightBadgeText: {
      fontSize: 14,
      fontWeight: '900',
      color: PRESENTATION_TEXT,
      letterSpacing: 1,
    },
    priceHighlightContainer: {
      backgroundColor: PRESENTATION_SUCCESS_STRONG + '26',
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[5],
      borderRadius: theme.radii.xl,
      marginVertical: theme.space[2],
      borderWidth: 2,
      borderColor: PRESENTATION_SUCCESS_STRONG + '4D',
    },
    bannerLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: PRESENTATION_TEXT_MUTED,
      letterSpacing: 1.5,
      marginBottom: theme.space[2],
    },
    bannerLabelHighlight: {
      fontSize: 18,
      color: PRESENTATION_SUCCESS_STRONG,
      letterSpacing: 3,
      fontWeight: '900',
    },
    bannerValue: {
      fontSize: 36,
      fontWeight: '900',
      color: PRESENTATION_TEXT,
      textAlign: 'center',
      lineHeight: 42,
    },
    bannerValueTablet: {
      fontSize: 48,
      lineHeight: 56,
    },
    bannerValueTabletHighlight: {
      fontSize: 60,
      lineHeight: 68,
    },
    bannerValueName: {
      fontSize: 28,
      lineHeight: 34,
    },
    stockValue: {
      color: PRESENTATION_ACCENT,
    },
    costValue: {
      color: PRESENTATION_WARNING_LIGHT,
    },
    priceSociaValue: {
      color: PRESENTATION_SUCCESS_LIGHT,
    },
    priceSociaValueHighlight: {
      fontSize: 52,
      fontWeight: '900',
      color: PRESENTATION_SUCCESS_STRONG,
      textShadowColor: PRESENTATION_SUCCESS_STRONG + 'CC',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 20,
      letterSpacing: 1,
    },
    priceFranquiciaValue: {
      color: PRESENTATION_FRANQUICIA,
    },
    preliminaryNote: {
      fontSize: 14,
      color: PRESENTATION_WARNING_STRONG,
      marginTop: theme.space[3],
      fontWeight: '600',
    },
    calculationNote: {
      fontSize: 14,
      color: PRESENTATION_TEXT_MUTED,
      marginTop: theme.space[2],
      fontStyle: 'italic',
    },
    calculationNoteHighlight: {
      fontSize: 18,
      color: PRESENTATION_SUCCESS_STRONG,
      marginTop: theme.space[3],
      fontStyle: 'italic',
      fontWeight: '700',
    },
    loadingStockContainer: {
      paddingVertical: theme.space[5],
      alignItems: 'center',
    },
    loadingStockText: {
      fontSize: 14,
      color: PRESENTATION_TEXT_MUTED,
      marginTop: theme.space[3],
    },
  });
