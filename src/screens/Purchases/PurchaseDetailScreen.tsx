import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { purchasesService } from '@/services/api';
import {
  Purchase,
  PurchaseProduct,
  PurchaseStatus,
  PurchaseProductStatus,
  PurchaseStatusLabels,
  PurchaseStatusColors,
  PurchaseProductStatusLabels,
  PurchaseProductStatusColors,
  GuideTypeLabels,
  PurchaseTotalSumResponse,
} from '@/types/purchases';
import { OcrScannerModal } from '@/components/Purchases/OcrScannerModal';
import { usePermissions } from '@/hooks/usePermissions';
import { ScreenProps } from '@/types/navigation';
import { MAIN_ROUTES } from '@/constants/routes';

type PurchaseDetailScreenProps = ScreenProps<'PurchaseDetail'>;

interface LegacyPurchaseDetailScreenProps {
  navigation: any;
  route: {
    params: {
      purchaseId: string;
    };
  };
}

export const PurchaseDetailScreen: React.FC<PurchaseDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { purchaseId } = route.params;
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [products, setProducts] = useState<PurchaseProduct[]>([]);
  const [totalSum, setTotalSum] = useState<PurchaseTotalSumResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedProductForInfo, setSelectedProductForInfo] = useState<PurchaseProduct | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const { hasPermission } = usePermissions();

  const loadPurchase = useCallback(async () => {
    try {
      const [purchaseData, productsData, totalSumData] = await Promise.all([
        purchasesService.getPurchase(purchaseId),
        purchasesService.getPurchaseProducts(purchaseId),
        purchasesService.getPurchaseTotalSum(purchaseId).catch(() => null), // Don't fail if endpoint not available yet
      ]);
      setPurchase(purchaseData);
      setProducts(productsData);
      setTotalSum(totalSumData);
    } catch (error: any) {
      console.error('Error loading purchase:', error);
      Alert.alert('Error', 'No se pudo cargar la compra');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [purchaseId, navigation]);

  useEffect(() => {
    loadPurchase();
  }, [loadPurchase]);

  // Reload data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadPurchase();
    }, [loadPurchase])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadPurchase();
  };

  const handleAddProduct = () => {
    navigation.navigate('AddPurchaseProduct', { purchaseId });
  };

  const handleOpenOcrScanner = () => {
    setShowOcrModal(true);
  };

  const handleOpenInfoModal = (product: PurchaseProduct) => {
    setSelectedProductForInfo(product);
    setShowInfoModal(true);
  };

  const handleCloseInfoModal = () => {
    setShowInfoModal(false);
    setSelectedProductForInfo(null);
  };

  const handleOcrProductsConfirmed = async (ocrProducts: any[]) => {
    setActionLoading(true);
    try {
      // Import presentations API to get available presentations
      const { presentationsApi } = await import('@/services/api/presentations');

      // Get all available presentations
      const presentations = await presentationsApi.getPresentations();

      if (!presentations || presentations.length === 0) {
        throw new Error('No hay presentaciones disponibles en el sistema');
      }

      // Use the first available presentation (same as manual form does)
      const defaultPresentation = presentations[0];

      // Process products in batches to handle large quantities
      const BATCH_SIZE = 5; // Reduced batch size for better stability on tablets
      const totalProducts = ocrProducts.length;
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      console.log(`📦 Procesando ${totalProducts} productos del OCR en lotes de ${BATCH_SIZE}...`);

      // Process in batches
      for (let i = 0; i < totalProducts; i += BATCH_SIZE) {
        const batch = ocrProducts.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalProducts / BATCH_SIZE);

        console.log(`📦 Procesando lote ${batchNumber}/${totalBatches} (${batch.length} productos)...`);

        // Process batch in parallel
        const batchPromises = batch.map(async (product, index) => {
          try {
            // Validate product data to prevent NaN crashes
            if (!product.sku || !product.nombre) {
              throw new Error('Producto sin SKU o nombre');
            }

            // Ensure all numeric values are valid and safe
            const cajas = (isFinite(product.cajas) && !isNaN(product.cajas) && product.cajas > 0) ? Math.max(1, Math.floor(product.cajas)) : 1;
            const unidadesPorCaja = (isFinite(product.unidades_por_caja) && !isNaN(product.unidades_por_caja) && product.unidades_por_caja > 0) ? Math.max(1, Math.floor(product.unidades_por_caja)) : 1;
            const cantidadTotal = (isFinite(product.cantidad_total) && !isNaN(product.cantidad_total) && product.cantidad_total > 0) ? Math.max(1, Math.floor(product.cantidad_total)) : 0;
            const precioUnitario = (isFinite(product.precio_unitario) && !isNaN(product.precio_unitario) && product.precio_unitario > 0) ? Math.max(0.01, product.precio_unitario) : 0;

            if (cantidadTotal <= 0) {
              throw new Error('Cantidad inválida o cero');
            }

            if (precioUnitario <= 0) {
              throw new Error('Precio inválido o cero');
            }

            // Build presentations array from OCR data
            const productPresentations = [];

            // If product has boxes/packages (cajas > 1 or unidades_por_caja > 1)
            if (cajas > 1 || unidadesPorCaja > 1) {
              // Add the presentation with the factor from OCR
              productPresentations.push({
                presentationId: defaultPresentation.id,
                factorToBase: unidadesPorCaja,
                notes: `${cajas} caja(s) x ${unidadesPorCaja} unidades (OCR)`,
              });
            } else {
              // Single unit presentation
              productPresentations.push({
                presentationId: defaultPresentation.id,
                factorToBase: 1,
                notes: 'Unidad individual (OCR)',
              });
            }

            // Calculate loose units (remainder after dividing by factor)
            const looseUnits = cantidadTotal % unidadesPorCaja;

            // Ensure costCents is a valid integer (safe conversion)
            const costCents = Math.max(1, Math.round(precioUnitario * 100));
            if (!isFinite(costCents) || isNaN(costCents) || costCents <= 0) {
              throw new Error('Precio inválido al convertir a centavos');
            }

            // Validate all values one more time before sending
            if (!isFinite(cantidadTotal) || !isFinite(cajas) || !isFinite(looseUnits) || !isFinite(costCents)) {
              throw new Error('Valores numéricos inválidos detectados');
            }

            await purchasesService.addProduct(purchaseId, {
              sku: product.sku,
              name: product.nombre,
              costCents: costCents,
              preliminaryStock: cantidadTotal,
              preliminaryPresentationQuantity: cajas,
              preliminaryLooseUnits: looseUnits,
              presentations: productPresentations,
            });

            return { success: true, product };
          } catch (error: any) {
            console.error(`❌ Error agregando producto ${product.sku}:`, error);
            return {
              success: false,
              product,
              error: error.message || 'Error desconocido'
            };
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);

        // Count successes and errors
        batchResults.forEach(result => {
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`${result.product.sku}: ${result.error}`);
          }
        });

        console.log(`✅ Lote ${batchNumber}/${totalBatches} completado. Éxitos: ${successCount}, Errores: ${errorCount}`);

        // Add a small delay between batches to prevent overwhelming the system on tablets
        if (i + BATCH_SIZE < totalProducts) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Show results
      if (errorCount === 0) {
        Alert.alert(
          'Éxito',
          `Se agregaron ${successCount} producto${successCount !== 1 ? 's' : ''} correctamente`
        );
      } else if (successCount > 0) {
        Alert.alert(
          'Completado con errores',
          `Se agregaron ${successCount} producto${successCount !== 1 ? 's' : ''} correctamente.\n\n` +
          `${errorCount} producto${errorCount !== 1 ? 's' : ''} no se pudieron agregar:\n` +
          errors.slice(0, 5).join('\n') +
          (errors.length > 5 ? `\n... y ${errors.length - 5} más` : '')
        );
      } else {
        Alert.alert(
          'Error',
          `No se pudo agregar ningún producto.\n\nErrores:\n` +
          errors.slice(0, 5).join('\n') +
          (errors.length > 5 ? `\n... y ${errors.length - 5} más` : '')
        );
      }

      // Reload purchase data if at least one product was added
      if (successCount > 0) {
        await loadPurchase();
      }
    } catch (error: any) {
      console.error('Error adding OCR products:', error);
      Alert.alert('Error', error.message || 'No se pudieron agregar los productos');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartProductValidation = async (product: PurchaseProduct) => {
    setActionLoading(true);
    try {
      await purchasesService.startValidation(purchaseId, product.id);
      Alert.alert('Éxito', 'Validación iniciada. Ahora puede validar el producto.');
      // Navigate to validation screen
      navigation.navigate('ValidatePurchaseProduct', { purchaseId, productId: product.id });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo iniciar la validación');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProductPress = (product: PurchaseProduct) => {
    // Allow editing for PRELIMINARY and IN_VALIDATION statuses
    if (
      product.status === PurchaseProductStatus.PRELIMINARY ||
      product.status === PurchaseProductStatus.IN_VALIDATION
    ) {
      navigation.navigate('EditPurchaseProduct', { purchaseId, productId: product.id });
    } else if (
      product.status === PurchaseProductStatus.VALIDATED ||
      product.status === PurchaseProductStatus.REJECTED
    ) {
      navigation.navigate('ValidatePurchaseProduct', { purchaseId, productId: product.id });
    }
  };

  const handleDeleteProduct = (product: PurchaseProduct) => {
    Alert.alert(
      'Eliminar Producto',
      `¿Está seguro de eliminar "${product.name}" de esta compra?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await purchasesService.deleteProduct(purchaseId, product.id);
              Alert.alert('Éxito', 'Producto eliminado correctamente');
              loadPurchase();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar el producto');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAssignDebts = () => {
    navigation.navigate('AssignDebt', { purchaseId });
  };

  const handleClosePurchase = async () => {
    Alert.alert(
      'Cerrar Compra',
      '¿Está seguro de cerrar esta compra? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await purchasesService.closePurchase(purchaseId);
              Alert.alert('Éxito', 'Compra cerrada correctamente');
              loadPurchase();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo cerrar la compra');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCancelPurchase = async () => {
    Alert.alert(
      'Cancelar Compra',
      '¿Está seguro de cancelar esta compra?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await purchasesService.cancelPurchase(purchaseId);
              Alert.alert('Éxito', 'Compra cancelada correctamente', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo cancelar la compra');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  const getProductStats = () => {
    const total = products.length;
    const preliminary = products.filter(
      (p) => p.status === PurchaseProductStatus.PRELIMINARY
    ).length;
    const inValidation = products.filter(
      (p) => p.status === PurchaseProductStatus.IN_VALIDATION
    ).length;
    const validated = products.filter(
      (p) => p.status === PurchaseProductStatus.VALIDATED
    ).length;
    const rejected = products.filter(
      (p) => p.status === PurchaseProductStatus.REJECTED
    ).length;

    return { total, preliminary, inValidation, validated, rejected };
  };

  const canAddProducts = () => {
    return (
      purchase?.status !== PurchaseStatus.CLOSED &&
      purchase?.status !== PurchaseStatus.CANCELLED
    );
  };

  // Filter products based on search query (minimum 2 characters)
  const filteredProducts = products.filter((product) => {
    const trimmedQuery = searchQuery.trim();

    // Show all products if search query is empty or less than 2 characters
    if (trimmedQuery.length < 2) {
      return true;
    }

    const query = trimmedQuery.toLowerCase();
    const matchesSku = product.sku.toLowerCase().includes(query);
    const matchesName = product.name.toLowerCase().includes(query);
    const matchesCorrelative = product.correlativeNumber?.toString().includes(query);

    return matchesSku || matchesName || matchesCorrelative;
  });

  const canAssignDebts = () => {
    return purchase?.status === PurchaseStatus.VALIDATED;
  };

  const canClosePurchase = () => {
    return purchase?.status === PurchaseStatus.VALIDATED;
  };

  const canCancelPurchase = () => {
    return (
      purchase?.status !== PurchaseStatus.CLOSED &&
      purchase?.status !== PurchaseStatus.CANCELLED
    );
  };

  const renderProductCard = (product: PurchaseProduct) => {
    const canDelete = product.status === PurchaseProductStatus.PRELIMINARY ||
                      product.status === PurchaseProductStatus.IN_VALIDATION;
    const canValidate = product.status !== PurchaseProductStatus.VALIDATED &&
                        purchase?.status !== PurchaseStatus.CLOSED &&
                        purchase?.status !== PurchaseStatus.CANCELLED;

    return (
      <View
        key={product.id}
        style={[styles.productCard, isTablet && styles.productCardTablet]}
      >
        <TouchableOpacity
          onPress={() => handleProductPress(product)}
          activeOpacity={0.7}
          style={styles.productCardContent}
        >
          <View style={styles.productHeader}>
            <View style={styles.productHeaderLeft}>
              <Text style={[styles.productName, isTablet && styles.productNameTablet]}>
                {product.name}
              </Text>
              <Text style={[styles.productSku, isTablet && styles.productSkuTablet]}>
                {product.correlativeNumber && `#${product.correlativeNumber} | `}SKU: {product.sku}
              </Text>
            </View>
            <View style={styles.productHeaderRight}>
              <View
                style={[
                  styles.productStatusBadge,
                  isTablet && styles.productStatusBadgeTablet,
                  {
                    backgroundColor: PurchaseProductStatusColors[product.status] + '20',
                    borderColor: PurchaseProductStatusColors[product.status],
                  },
                ]}
              >
                <Text
                  style={[
                    styles.productStatusText,
                    isTablet && styles.productStatusTextTablet,
                    { color: PurchaseProductStatusColors[product.status] },
                  ]}
                >
                  {PurchaseProductStatusLabels[product.status]}
                </Text>
              </View>
              {canDelete && (
                <TouchableOpacity
                  style={[styles.deleteButton, isTablet && styles.deleteButtonTablet]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteProduct(product);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.deleteButtonText, isTablet && styles.deleteButtonTextTablet]}>
                    🗑️
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

        <View style={styles.productBody}>
          <View style={styles.productRow}>
            <Text style={[styles.productLabel, isTablet && styles.productLabelTablet]}>
              Costo:
            </Text>
            <Text style={[styles.productValue, isTablet && styles.productValueTablet]}>
              {formatCurrency(product.costCents)}
            </Text>
          </View>

          <View style={styles.productRow}>
            <Text style={[styles.productLabel, isTablet && styles.productLabelTablet]}>
              Stock Preliminar:
            </Text>
            <Text style={[styles.productValue, isTablet && styles.productValueTablet]}>
              {product.preliminaryStock}
            </Text>
          </View>

          {product.validatedStock !== undefined && (
            <View style={styles.productRow}>
              <Text style={[styles.productLabel, isTablet && styles.productLabelTablet]}>
                Stock Validado:
              </Text>
              <Text
                style={[
                  styles.productValue,
                  isTablet && styles.productValueTablet,
                  styles.productValueHighlight,
                ]}
              >
                {product.validatedStock}
              </Text>
            </View>
          )}

          {product.warehouse && (
            <View style={styles.productRow}>
              <Text style={[styles.productLabel, isTablet && styles.productLabelTablet]}>
                Almacén:
              </Text>
              <Text style={[styles.productValue, isTablet && styles.productValueTablet]}>
                {product.warehouse.name}
              </Text>
            </View>
          )}
        </View>

        {product.rejectionReason && (
          <View style={styles.rejectionContainer}>
            <Text style={styles.rejectionLabel}>Razón de Rechazo:</Text>
            <Text style={styles.rejectionText}>{product.rejectionReason}</Text>
          </View>
        )}

        {/* Action hint */}
        {product.status === PurchaseProductStatus.PRELIMINARY && (
          <View style={styles.productActionHint}>
            <Text style={styles.productActionHintText}>✏️ Toca para editar</Text>
          </View>
        )}
        {product.status === PurchaseProductStatus.IN_VALIDATION && (
          <View style={styles.productActionHint}>
            <Text style={styles.productActionHintText}>✏️ Toca para editar</Text>
          </View>
        )}
        {product.status === PurchaseProductStatus.VALIDATED && (
          <View style={styles.productActionHint}>
            <Text style={styles.productActionHintText}>👁️ Toca para ver detalles</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Validate button for PRELIMINARY products */}
      {canValidate && (
        <TouchableOpacity
          style={[styles.validateProductButton, isTablet && styles.validateProductButtonTablet]}
          onPress={() => handleStartProductValidation(product)}
          disabled={actionLoading}
          activeOpacity={0.7}
        >
          <Text style={[styles.validateProductButtonText, isTablet && styles.validateProductButtonTextTablet]}>
            ✓ Validar Producto
          </Text>
        </TouchableOpacity>
      )}

      {/* Info button for VALIDATED or CLOSED products */}
      {(product.status === PurchaseProductStatus.VALIDATED ||
        product.status === PurchaseProductStatus.CLOSED) && (
        <TouchableOpacity
          style={[styles.infoProductButton, isTablet && styles.infoProductButtonTablet]}
          onPress={() => handleOpenInfoModal(product)}
          activeOpacity={0.7}
        >
          <Text style={[styles.infoProductButtonText, isTablet && styles.infoProductButtonTextTablet]}>
            📋 Información Registrada
          </Text>
        </TouchableOpacity>
      )}
    </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando compra...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!purchase) {
    return null;
  }

  const stats = getProductStats();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>{purchase.code}</Text>
          <View
            style={[
              styles.statusBadge,
              isTablet && styles.statusBadgeTablet,
              {
                backgroundColor: PurchaseStatusColors[purchase.status] + '20',
                borderColor: PurchaseStatusColors[purchase.status],
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isTablet && styles.statusTextTablet,
                { color: PurchaseStatusColors[purchase.status] },
              ]}
            >
              {PurchaseStatusLabels[purchase.status]}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          isTablet && styles.contentContainerTablet,
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Purchase Info */}
        <View style={[styles.infoCard, isTablet && styles.infoCardTablet]}>
          <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
            Información de la Compra
          </Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Proveedor:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {purchase.supplier?.commercialName || 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Tipo de Guía:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {GuideTypeLabels[purchase.guideType]}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Número de Guía:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {purchase.guideNumber}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Fecha de Guía:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {formatDate(purchase.guideDate)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Creado:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {formatDate(purchase.createdAt)}
            </Text>
          </View>

          {purchase.notes && (
            <View style={styles.notesContainer}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Notas:</Text>
              <Text style={[styles.notesText, isTablet && styles.notesTextTablet]}>
                {purchase.notes}
              </Text>
            </View>
          )}
        </View>

        {/* Product Stats */}
        <View style={[styles.statsCard, isTablet && styles.statsCardTablet]}>
          <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
            Resumen de Productos
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, isTablet && styles.statNumberTablet]}>
                {stats.total}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statNumber,
                  isTablet && styles.statNumberTablet,
                  { color: '#94A3B8' },
                ]}
              >
                {stats.preliminary}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                Preliminar
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statNumber,
                  isTablet && styles.statNumberTablet,
                  { color: '#F59E0B' },
                ]}
              >
                {stats.inValidation}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                En Validación
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statNumber,
                  isTablet && styles.statNumberTablet,
                  { color: '#10B981' },
                ]}
              >
                {stats.validated}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                Validados
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text
                style={[
                  styles.statNumber,
                  isTablet && styles.statNumberTablet,
                  { color: '#EF4444' },
                ]}
              >
                {stats.rejected}
              </Text>
              <Text style={[styles.statLabel, isTablet && styles.statLabelTablet]}>
                Rechazados
              </Text>
            </View>
          </View>
        </View>

        {/* Total Sum Card */}
        {totalSum && (
          <View style={[styles.totalSumCard, isTablet && styles.totalSumCardTablet]}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              💰 Totales de la Compra
            </Text>

            <View style={styles.totalSumGrid}>
              <View style={styles.totalSumRow}>
                <View style={styles.totalSumItem}>
                  <Text style={[styles.totalSumLabel, isTablet && styles.totalSumLabelTablet]}>
                    Total Sin Validar
                  </Text>
                  <Text style={[styles.totalSumValue, isTablet && styles.totalSumValueTablet, styles.totalSumUnvalidated]}>
                    {formatCurrency(totalSum.totalUnvalidatedCents)}
                  </Text>
                  <Text style={[styles.totalSumSubtext, isTablet && styles.totalSumSubtextTablet]}>
                    {totalSum.totalProducts} producto{totalSum.totalProducts !== 1 ? 's' : ''}
                  </Text>
                </View>

                <View style={styles.totalSumItem}>
                  <Text style={[styles.totalSumLabel, isTablet && styles.totalSumLabelTablet]}>
                    Total Validado
                  </Text>
                  <Text style={[styles.totalSumValue, isTablet && styles.totalSumValueTablet, styles.totalSumValidated]}>
                    {formatCurrency(totalSum.totalValidatedCents)}
                  </Text>
                  <Text style={[styles.totalSumSubtext, isTablet && styles.totalSumSubtextTablet]}>
                    {totalSum.validatedProducts} validado{totalSum.validatedProducts !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              {totalSum.differenceCents !== 0 && (
                <View style={[styles.totalSumDifference, totalSum.differenceCents > 0 ? styles.totalSumDifferencePositive : styles.totalSumDifferenceNegative]}>
                  <Text style={[styles.totalSumDifferenceLabel, isTablet && styles.totalSumDifferenceLabelTablet]}>
                    Diferencia:
                  </Text>
                  <Text style={[styles.totalSumDifferenceValue, isTablet && styles.totalSumDifferenceValueTablet]}>
                    {totalSum.differenceCents > 0 ? '+' : ''}{formatCurrency(totalSum.differenceCents)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Products List */}
        <View style={styles.productsSection}>
          <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
            Productos ({products.length})
          </Text>

          {/* Search Bar */}
          {products.length > 0 && (
            <View style={[styles.searchContainer, isTablet && styles.searchContainerTablet]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={[styles.searchInput, isTablet && styles.searchInputTablet]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar por SKU, nombre o #correlativo (mín. 2 letras)..."
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  onPress={() => setSearchQuery('')}
                >
                  <Text style={styles.clearSearchText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {canAddProducts() && (
            <View style={[styles.headerActionsContainer, isTablet && styles.headerActionsContainerTablet]}>
              <View style={styles.headerActions}>
                {hasPermission('purchases.ocr.scan') && (
                  <TouchableOpacity
                    style={[styles.ocrButton, isTablet && styles.ocrButtonTablet]}
                    onPress={handleOpenOcrScanner}
                    disabled={actionLoading}
                  >
                    <Text style={[styles.ocrButtonText, isTablet && styles.ocrButtonTextTablet]}>
                      📷 Escáner OCR
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.addButton, isTablet && styles.addButtonTablet]}
                  onPress={handleAddProduct}
                >
                  <Text style={[styles.addButtonText, isTablet && styles.addButtonTextTablet]}>
                    + Agregar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {products.length === 0 ? (
            <View style={styles.emptyProducts}>
              <Text style={[styles.emptyIcon, isTablet && styles.emptyIconTablet]}>📦</Text>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No hay productos agregados
              </Text>
            </View>
          ) : filteredProducts.length === 0 && searchQuery.trim().length >= 2 ? (
            <View style={styles.emptyProducts}>
              <Text style={[styles.emptyIcon, isTablet && styles.emptyIconTablet]}>🔍</Text>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No se encontraron productos que coincidan con "{searchQuery}"
              </Text>
              <TouchableOpacity
                style={[styles.clearSearchButtonLarge, isTablet && styles.clearSearchButtonLargeTablet]}
                onPress={() => setSearchQuery('')}
              >
                <Text style={[styles.clearSearchButtonLargeText, isTablet && styles.clearSearchButtonLargeTextTablet]}>
                  Limpiar búsqueda
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredProducts.map(renderProductCard)
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Buttons */}
      {(canAssignDebts() || canClosePurchase() || canCancelPurchase()) && (
        <View style={[styles.footer, isTablet && styles.footerTablet]}>
          {canCancelPurchase() && (
            <TouchableOpacity
              style={[styles.cancelButton, isTablet && styles.cancelButtonTablet]}
              onPress={handleCancelPurchase}
              disabled={actionLoading}
            >
              <Text style={[styles.cancelButtonText, isTablet && styles.cancelButtonTextTablet]}>
                Cancelar Compra
              </Text>
            </TouchableOpacity>
          )}
          {canAssignDebts() && (
            <TouchableOpacity
              style={[styles.assignButton, isTablet && styles.assignButtonTablet]}
              onPress={handleAssignDebts}
              disabled={actionLoading}
            >
              <Text style={[styles.assignButtonText, isTablet && styles.assignButtonTextTablet]}>
                Asignar Deudas
              </Text>
            </TouchableOpacity>
          )}
          {canClosePurchase() && (
            <TouchableOpacity
              style={[styles.closeButton, isTablet && styles.closeButtonTablet]}
              onPress={handleClosePurchase}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.closeButtonText, isTablet && styles.closeButtonTextTablet]}>
                  Cerrar Compra
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* OCR Scanner Modal */}
      <OcrScannerModal
        visible={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        onProductsConfirmed={handleOcrProductsConfirmed}
        purchaseId={purchaseId}
      />

      {/* Product Info Modal */}
      {selectedProductForInfo && (
        <ProductInfoModal
          visible={showInfoModal}
          product={selectedProductForInfo}
          onClose={handleCloseInfoModal}
          isTablet={isTablet}
        />
      )}
    </SafeAreaView>
  );
};

// Product Info Modal Component
interface ProductInfoModalProps {
  visible: boolean;
  product: PurchaseProduct;
  onClose: () => void;
  isTablet: boolean;
}

const ProductInfoModal: React.FC<ProductInfoModalProps> = ({
  visible,
  product,
  onClose,
  isTablet,
}) => {
  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get preliminary presentation from history
  const preliminaryPresentation = product.presentationHistory?.find(
    (ph) => ph.type === 'PRELIMINARY'
  );

  // Get validated presentation from history
  const validatedPresentation = product.presentationHistory?.find(
    (ph) => ph.type === 'VALIDATED'
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.container, isTablet && modalStyles.containerTablet]}>
          {/* Header */}
          <View style={modalStyles.header}>
            <View style={modalStyles.headerContent}>
              <Text style={[modalStyles.title, isTablet && modalStyles.titleTablet]}>
                📋 Información Registrada
              </Text>
              <Text style={[modalStyles.subtitle, isTablet && modalStyles.subtitleTablet]}>
                {product.name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
              <Text style={modalStyles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={modalStyles.content}>
            {/* Datos Preliminares Section */}
            <View style={modalStyles.section}>
              <Text style={[modalStyles.sectionTitle, isTablet && modalStyles.sectionTitleTablet]}>
                📝 Datos Preliminares (Registro Inicial)
              </Text>
              <View style={modalStyles.card}>
                <InfoRow label="SKU" value={`${product.correlativeNumber ? `#${product.correlativeNumber} | ` : ''}${product.sku}`} isTablet={isTablet} />
                <InfoRow label="Nombre" value={product.name} isTablet={isTablet} />
                <InfoRow
                  label="Costo Unitario"
                  value={formatCurrency(product.costCents)}
                  isTablet={isTablet}
                />
                <InfoRow
                  label="Stock Preliminar"
                  value={`${product.preliminaryStock} unidades`}
                  isTablet={isTablet}
                />
                {product.preliminaryPresentationQuantity !== undefined && (
                  <InfoRow
                    label="Cantidad de Presentaciones"
                    value={`${product.preliminaryPresentationQuantity}`}
                    isTablet={isTablet}
                  />
                )}
                {product.preliminaryLooseUnits !== undefined && (
                  <InfoRow
                    label="Unidades Sueltas"
                    value={`${product.preliminaryLooseUnits}`}
                    isTablet={isTablet}
                  />
                )}
                {preliminaryPresentation && (
                  <>
                    <InfoRow
                      label="Presentación Preliminar"
                      value={preliminaryPresentation.presentation?.name || 'N/A'}
                      isTablet={isTablet}
                    />
                    <InfoRow
                      label="Factor de Conversión"
                      value={`${preliminaryPresentation.factorToBase}x`}
                      isTablet={isTablet}
                    />
                    {preliminaryPresentation.notes && (
                      <InfoRow
                        label="Notas"
                        value={preliminaryPresentation.notes}
                        isTablet={isTablet}
                      />
                    )}
                  </>
                )}
                <InfoRow
                  label="Fecha de Registro"
                  value={formatDate(product.createdAt)}
                  isTablet={isTablet}
                />
              </View>
            </View>

            {/* Datos Validados Section */}
            {(product.status === PurchaseProductStatus.VALIDATED ||
              product.status === PurchaseProductStatus.CLOSED) && (
              <View style={modalStyles.section}>
                <Text style={[modalStyles.sectionTitle, isTablet && modalStyles.sectionTitleTablet]}>
                  ✅ Datos Validados
                </Text>
                <View style={[modalStyles.card, modalStyles.cardValidated]}>
                  {product.validatedStock !== undefined && (
                    <InfoRow
                      label="Stock Validado"
                      value={`${product.validatedStock} unidades`}
                      isTablet={isTablet}
                      highlight
                    />
                  )}
                  {product.validatedPresentationQuantity !== undefined && (
                    <InfoRow
                      label="Cantidad de Presentaciones Validadas"
                      value={`${product.validatedPresentationQuantity}`}
                      isTablet={isTablet}
                      highlight
                    />
                  )}
                  {product.validatedLooseUnits !== undefined && (
                    <InfoRow
                      label="Unidades Sueltas Validadas"
                      value={`${product.validatedLooseUnits}`}
                      isTablet={isTablet}
                      highlight
                    />
                  )}
                  {validatedPresentation && (
                    <>
                      <InfoRow
                        label="Presentación Validada"
                        value={validatedPresentation.presentation?.name || 'N/A'}
                        isTablet={isTablet}
                        highlight
                      />
                      <InfoRow
                        label="Factor de Conversión"
                        value={`${validatedPresentation.factorToBase}x`}
                        isTablet={isTablet}
                        highlight
                      />
                      {validatedPresentation.notes && (
                        <InfoRow
                          label="Notas"
                          value={validatedPresentation.notes}
                          isTablet={isTablet}
                          highlight
                        />
                      )}
                    </>
                  )}
                  {product.warehouse && (
                    <InfoRow
                      label="Almacén"
                      value={product.warehouse.name}
                      isTablet={isTablet}
                      highlight
                    />
                  )}
                  {product.area && (
                    <InfoRow
                      label="Área"
                      value={product.area.name || product.area.code}
                      isTablet={isTablet}
                      highlight
                    />
                  )}
                  {product.barcode && (
                    <InfoRow
                      label="Código de Barras"
                      value={product.barcode}
                      isTablet={isTablet}
                      highlight
                    />
                  )}
                  {product.validationNotes && (
                    <InfoRow
                      label="Notas de Validación"
                      value={product.validationNotes}
                      isTablet={isTablet}
                      highlight
                    />
                  )}
                  {product.validatedAt && (
                    <InfoRow
                      label="Fecha de Validación"
                      value={formatDate(product.validatedAt)}
                      isTablet={isTablet}
                      highlight
                    />
                  )}
                  {product.validatedByUser && (
                    <InfoRow
                      label="Validado Por"
                      value={product.validatedByUser.name || product.validatedByUser.email}
                      isTablet={isTablet}
                      highlight
                    />
                  )}
                </View>
              </View>
            )}

            {/* Comparación Section */}
            {product.validatedStock !== undefined && product.validatedStock !== product.preliminaryStock && (
              <View style={modalStyles.section}>
                <Text style={[modalStyles.sectionTitle, isTablet && modalStyles.sectionTitleTablet]}>
                  📊 Diferencias
                </Text>
                <View style={modalStyles.card}>
                  <View style={modalStyles.comparisonRow}>
                    <Text style={[modalStyles.comparisonLabel, isTablet && modalStyles.comparisonLabelTablet]}>
                      Stock:
                    </Text>
                    <View style={modalStyles.comparisonValues}>
                      <Text style={[modalStyles.comparisonValue, isTablet && modalStyles.comparisonValueTablet]}>
                        {product.preliminaryStock} → {product.validatedStock}
                      </Text>
                      <Text
                        style={[
                          modalStyles.comparisonDiff,
                          isTablet && modalStyles.comparisonDiffTablet,
                          product.validatedStock > product.preliminaryStock
                            ? modalStyles.comparisonDiffPositive
                            : modalStyles.comparisonDiffNegative,
                        ]}
                      >
                        {product.validatedStock > product.preliminaryStock ? '+' : ''}
                        {product.validatedStock - product.preliminaryStock}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Deuda Asignada Section */}
            {product.supplierLegalEntity && product.assignedDebtCents !== undefined && (
              <View style={modalStyles.section}>
                <Text style={[modalStyles.sectionTitle, isTablet && modalStyles.sectionTitleTablet]}>
                  💰 Deuda Asignada
                </Text>
                <View style={modalStyles.card}>
                  <InfoRow
                    label="Entidad Legal"
                    value={product.supplierLegalEntity.legalName}
                    isTablet={isTablet}
                  />
                  <InfoRow
                    label="RUC"
                    value={product.supplierLegalEntity.ruc}
                    isTablet={isTablet}
                  />
                  <InfoRow
                    label="Monto"
                    value={formatCurrency(product.assignedDebtCents)}
                    isTablet={isTablet}
                  />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={modalStyles.footer}>
            <TouchableOpacity
              style={[modalStyles.closeFooterButton, isTablet && modalStyles.closeFooterButtonTablet]}
              onPress={onClose}
            >
              <Text style={[modalStyles.closeFooterButtonText, isTablet && modalStyles.closeFooterButtonTextTablet]}>
                Cerrar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Info Row Component
interface InfoRowProps {
  label: string;
  value: string;
  isTablet: boolean;
  highlight?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, isTablet, highlight }) => (
  <View style={modalStyles.infoRow}>
    <Text style={[modalStyles.infoLabel, isTablet && modalStyles.infoLabelTablet]}>
      {label}:
    </Text>
    <Text
      style={[
        modalStyles.infoValue,
        isTablet && modalStyles.infoValueTablet,
        highlight && modalStyles.infoValueHighlight,
      ]}
    >
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 28,
    color: '#64748B',
    fontWeight: '300',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  titleTablet: {
    fontSize: 24,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeTablet: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextTablet: {
    fontSize: 13,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  contentContainerTablet: {
    padding: 32,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoCardTablet: {
    padding: 24,
    borderRadius: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  sectionTitleTablet: {
    fontSize: 18,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    width: 120,
  },
  infoLabelTablet: {
    fontSize: 16,
    width: 140,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  infoValueTablet: {
    fontSize: 16,
  },
  notesContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  notesText: {
    fontSize: 14,
    color: '#475569',
    marginTop: 8,
    lineHeight: 20,
  },
  notesTextTablet: {
    fontSize: 16,
    lineHeight: 24,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statsCardTablet: {
    padding: 24,
    borderRadius: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    flex: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  statNumberTablet: {
    fontSize: 28,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  statLabelTablet: {
    fontSize: 13,
  },
  totalSumCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  totalSumCardTablet: {
    padding: 24,
    borderRadius: 18,
  },
  totalSumGrid: {
    gap: 16,
  },
  totalSumRow: {
    flexDirection: 'row',
    gap: 16,
  },
  totalSumItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  totalSumLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalSumLabelTablet: {
    fontSize: 14,
  },
  totalSumValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  totalSumValueTablet: {
    fontSize: 28,
  },
  totalSumUnvalidated: {
    color: '#F59E0B',
  },
  totalSumValidated: {
    color: '#10B981',
  },
  totalSumSubtext: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  totalSumSubtextTablet: {
    fontSize: 13,
  },
  totalSumDifference: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  totalSumDifferencePositive: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  totalSumDifferenceNegative: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  totalSumDifferenceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  totalSumDifferenceLabelTablet: {
    fontSize: 15,
  },
  totalSumDifferenceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  totalSumDifferenceValueTablet: {
    fontSize: 20,
  },
  productsSection: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  searchContainerTablet: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    padding: 0,
  },
  searchInputTablet: {
    fontSize: 17,
  },
  clearSearchButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  clearSearchText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  clearSearchButtonLarge: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#6366F1',
    borderRadius: 12,
  },
  clearSearchButtonLargeTablet: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  clearSearchButtonLargeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clearSearchButtonLargeTextTablet: {
    fontSize: 16,
  },
  headerActionsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  headerActionsContainerTablet: {
    borderRadius: 16,
    padding: 14,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 14,
    marginBottom: 24,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validateButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  validateButtonTablet: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  validateButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  validateButtonTextTablet: {
    fontSize: 15,
  },
  ocrButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrButtonTablet: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 160,
  },
  ocrButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ocrButtonTextTablet: {
    fontSize: 16,
  },
  addButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonTablet: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 140,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonTextTablet: {
    fontSize: 16,
  },
  emptyProducts: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyIconTablet: {
    fontSize: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  emptyTextTablet: {
    fontSize: 18,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productCardTablet: {
    padding: 20,
    borderRadius: 18,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  productHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  productNameTablet: {
    fontSize: 17,
  },
  productSku: {
    fontSize: 12,
    color: '#64748B',
  },
  productSkuTablet: {
    fontSize: 14,
  },
  productStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  productStatusBadgeTablet: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  productStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  productStatusTextTablet: {
    fontSize: 12,
  },
  productBody: {
    gap: 8,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  productLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  productLabelTablet: {
    fontSize: 15,
  },
  productValue: {
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  productValueTablet: {
    fontSize: 15,
  },
  productValueHighlight: {
    color: '#10B981',
  },
  rejectionContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
  },
  rejectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 4,
  },
  rejectionText: {
    fontSize: 13,
    color: '#DC2626',
  },
  productActionHint: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
  },
  productActionHintValidate: {
    backgroundColor: '#ECFDF5',
  },
  productActionHintText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  productActionHintTextValidate: {
    color: '#059669',
  },
  bottomSpacer: {
    height: 40,
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  footerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 20,
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelButtonTablet: {
    paddingVertical: 16,
    borderRadius: 14,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  cancelButtonTextTablet: {
    fontSize: 17,
  },
  closeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  closeButtonTablet: {
    paddingVertical: 16,
    borderRadius: 14,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButtonTextTablet: {
    fontSize: 17,
  },
  assignButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
  },
  assignButtonTablet: {
    paddingVertical: 16,
    borderRadius: 14,
  },
  assignButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  assignButtonTextTablet: {
    fontSize: 17,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteButtonTablet: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  deleteButtonTextTablet: {
    fontSize: 18,
  },
  productCardContent: {
    flex: 1,
  },
  validateProductButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  validateProductButtonTablet: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  validateProductButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  validateProductButtonTextTablet: {
    fontSize: 16,
  },
  infoProductButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  infoProductButtonTablet: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  infoProductButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoProductButtonTextTablet: {
    fontSize: 16,
  },
});

// Modal Styles
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '95%',
    height: '90%',
    overflow: 'hidden',
  },
  containerTablet: {
    width: '85%',
    maxWidth: 1000,
    height: '92%',
    borderRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  headerContent: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  titleTablet: {
    fontSize: 24,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  subtitleTablet: {
    fontSize: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  sectionTitleTablet: {
    fontSize: 19,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardValidated: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  infoLabelTablet: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  infoValueTablet: {
    fontSize: 16,
  },
  infoValueHighlight: {
    color: '#10B981',
  },
  comparisonRow: {
    paddingVertical: 8,
  },
  comparisonLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
  },
  comparisonLabelTablet: {
    fontSize: 16,
  },
  comparisonValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comparisonValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  comparisonValueTablet: {
    fontSize: 16,
  },
  comparisonDiff: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  comparisonDiffTablet: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  comparisonDiffPositive: {
    color: '#10B981',
    backgroundColor: '#D1FAE5',
  },
  comparisonDiffNegative: {
    color: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  closeFooterButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeFooterButtonTablet: {
    paddingVertical: 16,
    borderRadius: 14,
  },
  closeFooterButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  closeFooterButtonTextTablet: {
    fontSize: 17,
  },
});

export default PurchaseDetailScreen;

