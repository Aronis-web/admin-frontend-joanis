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
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const styles = useThemedStyles(createStyles);
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

// Pantalla de presentación: mantiene paleta oscura fija en ambos modos para máxima visibilidad.
const PRESENTATION_BG = '#262626';
const PRESENTATION_SURFACE = '#404040';
const PRESENTATION_BORDER = '#525252';
const PRESENTATION_TEXT = '#FFFFFF';
const PRESENTATION_TEXT_MUTED = '#A3A3A3';
const PRESENTATION_TEXT_SUBTLE = '#D4D4D4';
const PRESENTATION_ACCENT = '#A1A1A1';
const PRESENTATION_SUCCESS = '#4ADE80';
const PRESENTATION_WARNING = '#FBBF24';

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: PRESENTATION_BG,
    },
    header: {
      padding: 20,
      paddingTop: 40,
      alignItems: 'flex-end',
    },
    closeButton: {
      backgroundColor: PRESENTATION_SURFACE,
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
    },
    closeButtonText: {
      color: PRESENTATION_TEXT,
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
      color: PRESENTATION_TEXT_MUTED,
      marginBottom: theme.space[3],
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
    value: {
      fontSize: 72,
      fontWeight: '700',
      color: PRESENTATION_TEXT,
      textAlign: 'center',
    },
    sku: {
      color: PRESENTATION_ACCENT,
      fontFamily: 'monospace',
    },
    productName: {
      fontSize: 56,
      lineHeight: 68,
      paddingHorizontal: 20,
    },
    stock: {
      color: PRESENTATION_SUCCESS,
    },
    cost: {
      color: PRESENTATION_WARNING,
    },
    priceSection: {
      backgroundColor: PRESENTATION_SURFACE,
      borderRadius: theme.radii.xl,
      padding: theme.space[8],
      marginBottom: theme.space[6],
      borderWidth: 3,
      borderColor: PRESENTATION_BORDER,
    },
    priceLabel: {
      fontSize: 28,
      color: PRESENTATION_TEXT_SUBTLE,
      marginBottom: theme.space[4],
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
      color: PRESENTATION_TEXT_MUTED,
      marginTop: theme.space[2],
      fontStyle: 'italic',
    },
    statusBadge: {
      marginTop: theme.space[10],
      backgroundColor: PRESENTATION_SURFACE,
      paddingHorizontal: theme.space[8],
      paddingVertical: theme.space[4],
      borderRadius: theme.radii.xl,
    },
    statusText: {
      fontSize: 24,
      color: PRESENTATION_TEXT_SUBTLE,
      fontWeight: '600',
    },
  });
