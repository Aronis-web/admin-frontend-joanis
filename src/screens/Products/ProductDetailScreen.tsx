import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Header } from '@/components/common/Header';
import { Loader } from '@/components/common/Loader';
import { Button } from '@/components/ui/Button';
import { theme } from '@/theme';
import { productsApi, ProductDetail, ProductPresentationDetail } from '@/services/api';
import { useCartStore } from '@/store/cart';

interface ProductDetailScreenProps {
  navigation: any;
  route: any;
}

export const ProductDetailScreen: React.FC<ProductDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { productId } = route.params;
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPresentation, setSelectedPresentation] = useState<ProductPresentationDetail | null>(null);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCartStore();

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      setIsLoading(true);
      const data = await productsApi.getProduct(productId);
      setProduct(data);
      // Select the first presentation by default
      if (data.presentations.length > 0) {
        setSelectedPresentation(data.presentations[0]);
      }
    } catch (error) {
      console.error('Error loading product:', error);
      Alert.alert('Error', 'No se pudo cargar el producto');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!product || !selectedPresentation) return;

    if (quantity > selectedPresentation.available) {
      Alert.alert('Error', 'No hay suficiente stock disponible');
      return;
    }

    await addItem({
      id: `${product.id}-${selectedPresentation.code}`,
      productId: product.id,
      name: `${product.title} (${selectedPresentation.name})`,
      price: selectedPresentation.priceCents / 100,
      image: 'https://via.placeholder.com/200',
      quantity: quantity,
      presentation: selectedPresentation,
    });

    Alert.alert('Éxito', `${quantity} ${selectedPresentation.name}(s) agregado(s) al carrito`, [
      { text: 'Continuar comprando', style: 'cancel' },
      { text: 'Ver carrito', onPress: () => navigation.navigate('Cart') },
    ]);
  };

  const updateQuantity = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && selectedPresentation && newQuantity <= selectedPresentation.available) {
      setQuantity(newQuantity);
    }
  };

  if (isLoading) {
    return <Loader fullScreen text="Cargando producto..." />;
  }

  if (!product) {
    return null;
  }

  const basePrice = product.priceCentsBase / 100;
  const selectedPrice = selectedPresentation ? selectedPresentation.priceCents / 100 : basePrice;

  return (
    <View style={styles.container}>
      <Header
        title="Detalle"
        leftIcon={<Text style={styles.backIcon}>←</Text>}
        onLeftPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.scrollView}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: 'https://via.placeholder.com/400' }}
            style={styles.mainImage}
            resizeMode="cover"
          />
        </View>

        <View style={styles.contentContainer}>
          <Text style={styles.productName}>{product.title}</Text>
          <Text style={styles.sku}>SKU: {product.sku}</Text>
          <Text style={styles.category}>{product.category.name}</Text>

          <View style={styles.priceContainer}>
            <Text style={styles.price}>${selectedPrice.toFixed(2)} {product.currency}</Text>
            {selectedPresentation && selectedPresentation.factor > 1 && (
              <Text style={styles.unitPrice}>
                ${(selectedPrice / selectedPresentation.factor).toFixed(2)} por unidad
              </Text>
            )}
          </View>

          {/* Presentations Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Presentaciones</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.presentationsContainer}>
                {product.presentations.map((presentation) => (
                  <TouchableOpacity
                    key={presentation.code}
                    style={[
                      styles.presentationCard,
                      selectedPresentation?.code === presentation.code && styles.selectedPresentation,
                    ]}
                    onPress={() => {
                      setSelectedPresentation(presentation);
                      setQuantity(1);
                    }}
                  >
                    <Text style={styles.presentationName}>{presentation.name}</Text>
                    <Text style={styles.presentationPrice}>
                      ${(presentation.priceCents / 100).toFixed(2)}
                    </Text>
                    <Text style={[
                      styles.presentationStock,
                      presentation.available === 0 && styles.outOfStock
                    ]}>
                      {presentation.available > 0
                        ? `${presentation.available} disponibles`
                        : 'Agotado'
                      }
                    </Text>
                    {presentation.factor > 1 && (
                      <Text style={styles.presentationFactor}>
                        {presentation.factor} unidades
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Quantity Selector */}
          {selectedPresentation && selectedPresentation.available > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cantidad</Text>
              <View style={styles.quantityContainer}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(-1)}
                  disabled={quantity <= 1}
                >
                  <Text style={styles.quantityButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.quantityText}>{quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(1)}
                  disabled={quantity >= selectedPresentation.available}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.totalPrice}>
                Total: ${(selectedPrice * quantity).toFixed(2)} {product.currency}
              </Text>
            </View>
          )}

          {/* Stock Information */}
          {selectedPresentation && (
            <View style={styles.stockContainer}>
              <Text
                style={[
                  styles.stockText,
                  selectedPresentation.available > 0 ? styles.inStock : styles.outOfStock,
                ]}
              >
                {selectedPresentation.available > 0
                  ? `${selectedPresentation.available} ${selectedPresentation.name}(s) disponible(s)`
                  : 'Agotado'
                }
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Agregar al Carrito"
          onPress={handleAddToCart}
          disabled={!selectedPresentation || selectedPresentation.available === 0}
          fullWidth
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 400,
    backgroundColor: theme.colors.grey[100],
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: theme.colors.error,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  discountText: {
    color: theme.colors.text.white,
    fontWeight: '700',
    fontSize: theme.fontSize.md,
  },
  thumbnailContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  thumbnail: {
    width: 80,
    height: 80,
    marginRight: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  thumbnailActive: {
    borderColor: theme.colors.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    padding: theme.spacing.md,
  },
  productName: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  sku: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  category: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.md,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  price: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.primary,
    marginRight: theme.spacing.md,
  },
  unitPrice: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    textDecorationLine: 'line-through',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  rating: {
    fontSize: theme.fontSize.md,
    marginRight: theme.spacing.sm,
  },
  reviewCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
  },
  stockContainer: {
    marginBottom: theme.spacing.lg,
  },
  stockText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  inStock: {
    color: theme.colors.success,
  },
  outOfStock: {
    color: theme.colors.error,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  description: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    lineHeight: 24,
  },
  specRow: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  specKey: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  specValue: {
    flex: 2,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
  },
  footer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.md,
  },
  backIcon: {
    fontSize: 24,
  },
  presentationsContainer: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.sm,
  },
  presentationCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginRight: theme.spacing.md,
    minWidth: 120,
    alignItems: 'center',
  },
  selectedPresentation: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10',
  },
  presentationName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  presentationPrice: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  presentationStock: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.success,
    marginBottom: theme.spacing.xs,
  },
  presentationFactor: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.secondary,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  quantityButton: {
    backgroundColor: theme.colors.primary,
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: theme.spacing.md,
  },
  quantityButtonText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text.white,
  },
  quantityText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text.primary,
    minWidth: 40,
    textAlign: 'center',
  },
  totalPrice: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.primary,
    textAlign: 'center',
  },
});

export default ProductDetailScreen;