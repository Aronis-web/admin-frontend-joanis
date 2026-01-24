import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { TransmisionProduct } from '@/types/transmisiones';

interface ProductDisplayModalProps {
  visible: boolean;
  product: TransmisionProduct | null;
  onClose: () => void;
}

export const ProductDisplayModal: React.FC<ProductDisplayModalProps> = ({
  visible,
  product,
  onClose,
}) => {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;

  if (!product) {
    return null;
  }

  // Calcular precios
  const cost = product.costCents ? product.costCents / 100 : 0;
  const precioSocia = cost * 1.3;
  const precioFranquicia = cost * 1.13;

  // Determinar stock a mostrar
  const stock =
    product.productStatus === 'preliminary'
      ? product.product?.preliminaryStock || 0
      : product.product?.stock || 0;

  const stockLabel = product.productStatus === 'preliminary' ? 'Stock Preliminar' : 'Stock';

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header con botón cerrar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeButtonText}>✕ Cerrar</Text>
          </TouchableOpacity>
        </View>

        {/* Contenido del banner */}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* SKU */}
          <View style={styles.section}>
            <Text style={styles.label}>SKU</Text>
            <Text style={[styles.value, styles.sku]}>{product.product?.sku || 'N/A'}</Text>
          </View>

          {/* Nombre del Producto */}
          <View style={styles.section}>
            <Text style={styles.label}>Producto</Text>
            <Text style={[styles.value, styles.productName]}>
              {product.product?.title || product.product?.name || 'Sin nombre'}
            </Text>
          </View>

          {/* Stock */}
          <View style={styles.section}>
            <Text style={styles.label}>{stockLabel}</Text>
            <Text style={[styles.value, styles.stock]}>
              {stock} {stock === 1 ? 'unidad' : 'unidades'}
            </Text>
          </View>

          {/* Costo */}
          <View style={styles.section}>
            <Text style={styles.label}>Costo</Text>
            <Text style={[styles.value, styles.cost]}>S/ {cost.toFixed(2)}</Text>
          </View>

          {/* Precio Socia */}
          <View style={[styles.section, styles.priceSection]}>
            <Text style={styles.priceLabel}>Precio Socia</Text>
            <Text style={[styles.value, styles.priceSocia]}>S/ {precioSocia.toFixed(2)}</Text>
            <Text style={styles.priceFormula}>(Costo × 1.30)</Text>
          </View>

          {/* Precio Franquicia */}
          <View style={[styles.section, styles.priceSection]}>
            <Text style={styles.priceLabel}>Precio Franquicia</Text>
            <Text style={[styles.value, styles.priceFranquicia]}>
              S/ {precioFranquicia.toFixed(2)}
            </Text>
            <Text style={styles.priceFormula}>(Costo × 1.13)</Text>
          </View>

          {/* Estado del producto */}
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {product.productStatus === 'preliminary' ? '🔄 Preliminar' : '✅ Activo'}
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1F2937',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    alignItems: 'flex-end',
  },
  closeButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  section: {
    width: '100%',
    marginBottom: 40,
    alignItems: 'center',
  },
  label: {
    fontSize: 24,
    color: '#9CA3AF',
    marginBottom: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  value: {
    fontSize: 72,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  sku: {
    color: '#60A5FA',
    fontFamily: 'monospace',
  },
  productName: {
    fontSize: 56,
    lineHeight: 68,
    paddingHorizontal: 20,
  },
  stock: {
    color: '#34D399',
  },
  cost: {
    color: '#FBBF24',
  },
  priceSection: {
    backgroundColor: '#374151',
    borderRadius: 16,
    padding: 32,
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#4B5563',
  },
  priceLabel: {
    fontSize: 28,
    color: '#D1D5DB',
    marginBottom: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  priceSocia: {
    color: '#A78BFA',
    fontSize: 80,
  },
  priceFranquicia: {
    color: '#F472B6',
    fontSize: 80,
  },
  priceFormula: {
    fontSize: 20,
    color: '#9CA3AF',
    marginTop: 8,
    fontStyle: 'italic',
  },
  statusBadge: {
    marginTop: 40,
    backgroundColor: '#374151',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 24,
    color: '#D1D5DB',
    fontWeight: '600',
  },
});
