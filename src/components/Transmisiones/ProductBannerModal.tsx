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
    if (!product?.productId) return;

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
              const foundProduct = products.find(p => p.productId === product.productId);
              if (foundProduct && foundProduct.preliminaryStock) {
                prelimStock = foundProduct.preliminaryStock;
                console.log('✅ Found preliminary stock:', prelimStock, 'in purchase:', purchase.id);
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

  if (!product) return null;

  const isPreliminary = isProductPreliminary(product.productStatus);
  const costCents = product.costCents || 0;
  const precioSocia = Math.round(costCents * 1.3);
  const precioFranquicia = Math.round(costCents * 1.13);

  // Determine which stock to show
  const stockValue = isPreliminary
    ? stockData.preliminaryStock
    : stockData.stock;
  const stockLabel = isPreliminary ? 'Stock Preliminar' : 'Stock';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
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
              <Text style={[styles.bannerValue, styles.bannerValueName, isTablet && styles.bannerValueTablet]}>
                {product.product?.title || 'Sin nombre'}
              </Text>
            </View>

            {/* Stock Banner */}
            <View style={styles.bannerSection}>
              <Text style={styles.bannerLabel}>{stockLabel.toUpperCase()}</Text>
              {loadingStock ? (
                <View style={styles.loadingStockContainer}>
                  <ActivityIndicator size="large" color="#60A5FA" />
                  <Text style={styles.loadingStockText}>Cargando stock...</Text>
                </View>
              ) : (
                <Text style={[styles.bannerValue, styles.stockValue, isTablet && styles.bannerValueTablet]}>
                  {stockValue !== undefined && stockValue !== null ? stockValue : 'N/A'}
                </Text>
              )}
              {isPreliminary && (
                <Text style={styles.preliminaryNote}>
                  ⚠️ Producto Preliminar
                </Text>
              )}
            </View>

            {/* Cost Banner */}
            <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
              <Text style={styles.bannerLabel}>COSTO</Text>
              <Text style={[styles.bannerValue, styles.costValue, isTablet && styles.bannerValueTablet]}>
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
                <Text style={[styles.bannerValue, styles.priceSociaValue, styles.priceSociaValueHighlight, isTablet && styles.bannerValueTabletHighlight]}>
                  {formatCentsToCurrency(precioSocia)}
                </Text>
              </View>
              <Text style={styles.calculationNoteHighlight}>
                💰 Costo × 1.30 💰
              </Text>
            </View>

            {/* Precio Franquicia Banner */}
            <View style={[styles.bannerSection, styles.bannerSectionAlt]}>
              <Text style={styles.bannerLabel}>PRECIO FRANQUICIA</Text>
              <Text style={[styles.bannerValue, styles.priceFranquiciaValue, isTablet && styles.bannerValueTablet]}>
                {formatCentsToCurrency(precioFranquicia)}
              </Text>
              <Text style={styles.calculationNote}>
                Costo × 1.13
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1F2937',
    position: 'relative',
  },
  containerTablet: {
    width: '90%',
    height: '90%',
    borderRadius: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  closeButtonText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    paddingTop: 80,
    paddingBottom: 30,
    paddingHorizontal: 16,
  },
  bannerSection: {
    backgroundColor: '#374151',
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4B5563',
  },
  bannerSectionAlt: {
    backgroundColor: '#2D3748',
    borderColor: '#3F4A5C',
  },
  bannerSectionHighlight: {
    backgroundColor: '#0F2A3F',
    borderColor: '#10B981',
    borderWidth: 4,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 12,
    marginVertical: 16,
    paddingVertical: 28,
  },
  highlightBadge: {
    position: 'absolute',
    top: -15,
    alignSelf: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  highlightBadgeText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  priceHighlightContainer: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  bannerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  bannerLabelHighlight: {
    fontSize: 18,
    color: '#10B981',
    letterSpacing: 3,
    fontWeight: '900',
  },
  bannerValue: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
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
    color: '#60A5FA',
  },
  costValue: {
    color: '#FBBF24',
  },
  priceSociaValue: {
    color: '#34D399',
  },
  priceSociaValueHighlight: {
    fontSize: 52,
    fontWeight: '900',
    color: '#10B981',
    textShadowColor: 'rgba(16, 185, 129, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    letterSpacing: 1,
  },
  priceFranquiciaValue: {
    color: '#A78BFA',
  },
  preliminaryNote: {
    fontSize: 14,
    color: '#F59E0B',
    marginTop: 12,
    fontWeight: '600',
  },
  calculationNote: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    fontStyle: 'italic',
  },
  calculationNoteHighlight: {
    fontSize: 18,
    color: '#10B981',
    marginTop: 12,
    fontStyle: 'italic',
    fontWeight: '700',
  },
  loadingStockContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingStockText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
});
