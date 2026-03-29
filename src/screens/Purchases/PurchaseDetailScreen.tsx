/**
 * PurchaseDetailScreen - Detalle de Compra
 * Migrado al Design System unificado
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { purchasesService, suppliersService } from '@/services/api';
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
import { Supplier as FullSupplier, SupplierType } from '@/types/suppliers';
import { Supplier as ExpenseSupplier } from '@/types/expenses';
import { OcrScannerModal } from '@/components/Purchases/OcrScannerModal';
import { SupplierSearchInput } from '@/components/Suppliers/SupplierSearchInput';
import { usePermissions } from '@/hooks/usePermissions';
import { ScreenProps } from '@/types/navigation';
import { MAIN_ROUTES } from '@/constants/routes';
import { ProtectedTouchableOpacity } from '@/components/ui/ProtectedTouchableOpacity';
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  Title,
  Body,
  Label,
  Caption,
  Badge,
  Card,
  Button,
  IconButton,
  EmptyState,
  SearchBar,
} from '@/design-system';

type PurchaseDetailScreenProps = ScreenProps<'PurchaseDetail'>;

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
  const [productPhotos, setProductPhotos] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEditSupplierModal, setShowEditSupplierModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<ExpenseSupplier | null>(null);
  const [updatingSupplier, setUpdatingSupplier] = useState(false);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const { hasPermission } = usePermissions();

  const loadPurchase = useCallback(async () => {
    try {
      const [purchaseData, productsData, totalSumData] = await Promise.all([
        purchasesService.getPurchase(purchaseId),
        purchasesService.getPurchaseProducts(purchaseId),
        purchasesService.getPurchaseTotalSum(purchaseId).catch(() => null),
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

  const handleOpenInfoModal = async (product: PurchaseProduct) => {
    setSelectedProductForInfo(product);
    setShowInfoModal(true);

    if (product.productPhotos && product.productPhotos.length > 0) {
      setProductPhotos(product.productPhotos);
    } else {
      setProductPhotos([]);
    }
  };

  const handleCloseInfoModal = () => {
    setShowInfoModal(false);
    setSelectedProductForInfo(null);
    setProductPhotos([]);
  };

  const handleOpenEditSupplierModal = () => {
    if (purchase?.supplier) {
      setSelectedSupplier(purchase.supplier as ExpenseSupplier);
    }
    setShowEditSupplierModal(true);
  };

  const handleCloseEditSupplierModal = () => {
    setShowEditSupplierModal(false);
    setSelectedSupplier(null);
  };

  const handleSupplierSelect = (supplier: ExpenseSupplier | null) => {
    setSelectedSupplier(supplier);
  };

  const handleUpdateSupplier = async () => {
    if (!selectedSupplier) {
      Alert.alert('Error', 'Debe seleccionar un proveedor');
      return;
    }

    if (selectedSupplier.id === purchase?.supplier?.id) {
      Alert.alert('Información', 'El proveedor seleccionado es el mismo que el actual');
      return;
    }

    setUpdatingSupplier(true);
    try {
      await purchasesService.updatePurchase(purchaseId, {
        supplierId: selectedSupplier.id,
      });

      await loadPurchase();
      handleCloseEditSupplierModal();
      Alert.alert('Éxito', 'Proveedor actualizado correctamente');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar el proveedor');
    } finally {
      setUpdatingSupplier(false);
    }
  };

  const handleOcrProductsConfirmed = async (ocrProducts: any[]) => {
    setActionLoading(true);
    try {
      const { presentationsApi } = await import('@/services/api/presentations');
      const presentations = await presentationsApi.getPresentations();

      if (!presentations || presentations.length === 0) {
        throw new Error('No hay presentaciones disponibles en el sistema');
      }

      const defaultPresentation = presentations[0];
      const BATCH_SIZE = 5;
      const totalProducts = ocrProducts.length;
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < totalProducts; i += BATCH_SIZE) {
        const batch = ocrProducts.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(async (product) => {
          try {
            if (!product.sku || !product.nombre) {
              throw new Error('Producto sin SKU o nombre');
            }

            const cajas = isFinite(product.cajas) && !isNaN(product.cajas) && product.cajas > 0
              ? Math.max(1, Math.floor(product.cajas)) : 1;
            const unidadesPorCaja = isFinite(product.unidades_por_caja) && !isNaN(product.unidades_por_caja) && product.unidades_por_caja > 0
              ? Math.max(1, Math.floor(product.unidades_por_caja)) : 1;
            const cantidadTotal = isFinite(product.cantidad_total) && !isNaN(product.cantidad_total) && product.cantidad_total > 0
              ? Math.max(1, Math.floor(product.cantidad_total)) : 0;
            const precioUnitario = isFinite(product.precio_unitario) && !isNaN(product.precio_unitario) && product.precio_unitario > 0
              ? Math.max(0.01, product.precio_unitario) : 0;

            if (cantidadTotal <= 0 || precioUnitario <= 0) {
              throw new Error('Cantidad o precio inválido');
            }

            const productPresentations = [];
            if (cajas > 1 || unidadesPorCaja > 1) {
              productPresentations.push({
                presentationId: defaultPresentation.id,
                factorToBase: unidadesPorCaja,
                notes: `${cajas} caja(s) x ${unidadesPorCaja} unidades (OCR)`,
              });
            } else {
              productPresentations.push({
                presentationId: defaultPresentation.id,
                factorToBase: 1,
                notes: 'Unidad individual (OCR)',
              });
            }

            const looseUnits = cantidadTotal % unidadesPorCaja;
            const costCents = Math.max(1, Math.round(precioUnitario * 100));

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
            return { success: false, product, error: error.message || 'Error desconocido' };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach((result) => {
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`${result.product.sku}: ${result.error}`);
          }
        });

        if (i + BATCH_SIZE < totalProducts) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (errorCount === 0) {
        Alert.alert('Éxito', `Se agregaron ${successCount} producto${successCount !== 1 ? 's' : ''} correctamente`);
      } else if (successCount > 0) {
        Alert.alert('Completado con errores',
          `Se agregaron ${successCount} producto${successCount !== 1 ? 's' : ''} correctamente.\n\n` +
          `${errorCount} producto${errorCount !== 1 ? 's' : ''} no se pudieron agregar:\n` +
          errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n... y ${errors.length - 5} más` : '')
        );
      } else {
        Alert.alert('Error', `No se pudo agregar ningún producto.\n\nErrores:\n` + errors.slice(0, 5).join('\n'));
      }

      if (successCount > 0) {
        await loadPurchase();
      }
    } catch (error: any) {
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
      navigation.navigate('ValidatePurchaseProduct', { purchaseId, productId: product.id });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo iniciar la validación');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProductPress = (product: PurchaseProduct) => {
    if (product.status === PurchaseProductStatus.PRELIMINARY || product.status === PurchaseProductStatus.IN_VALIDATION) {
      navigation.navigate('EditPurchaseProduct', { purchaseId, productId: product.id });
    } else if (product.status === PurchaseProductStatus.VALIDATED || product.status === PurchaseProductStatus.REJECTED) {
      navigation.navigate('ValidatePurchaseProduct', { purchaseId, productId: product.id });
    }
  };

  const handleDeleteProduct = (product: PurchaseProduct) => {
    Alert.alert('Eliminar Producto', `¿Está seguro de eliminar "${product.name}" de esta compra?`, [
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
    ]);
  };

  const handleAssignDebts = () => {
    navigation.navigate('AssignDebt', { purchaseId });
  };

  const handleClosePurchase = async () => {
    Alert.alert('Cerrar Compra', '¿Está seguro de cerrar esta compra? Esta acción no se puede deshacer.', [
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
    ]);
  };

  const handleCancelPurchase = async () => {
    Alert.alert('Cancelar Compra', '¿Está seguro de cancelar esta compra?', [
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
    ]);
  };

  const handleDeleteProductValidations = async (product: PurchaseProduct) => {
    Alert.alert('Eliminar Validaciones', `¿Está seguro de eliminar las validaciones del producto "${product.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          try {
            const result = await purchasesService.deleteProductValidations(purchaseId, product.id);
            Alert.alert('Éxito', `Se eliminaron ${result.deletedCount} validación(es)`);
            loadPurchase();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'No se pudieron eliminar las validaciones');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  const getProductStats = () => {
    const total = products.length;
    const preliminary = products.filter((p) => p.status === PurchaseProductStatus.PRELIMINARY).length;
    const inValidation = products.filter((p) => p.status === PurchaseProductStatus.IN_VALIDATION).length;
    const validated = products.filter((p) => p.status === PurchaseProductStatus.VALIDATED).length;
    const rejected = products.filter((p) => p.status === PurchaseProductStatus.REJECTED).length;
    return { total, preliminary, inValidation, validated, rejected };
  };

  const canAddProducts = () => {
    return purchase?.status !== PurchaseStatus.CLOSED && purchase?.status !== PurchaseStatus.CANCELLED;
  };

  const filteredProducts = products.filter((product) => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2) return true;
    const query = trimmedQuery.toLowerCase();
    return product.sku.toLowerCase().includes(query) ||
      product.name.toLowerCase().includes(query) ||
      product.correlativeNumber?.toString().includes(query);
  });

  const canAssignDebts = () => purchase?.status === PurchaseStatus.VALIDATED;
  const canClosePurchase = () => purchase?.status === PurchaseStatus.VALIDATED;
  const canCancelPurchase = () => purchase?.status !== PurchaseStatus.CLOSED && purchase?.status !== PurchaseStatus.CANCELLED;

  const getStatusVariant = (status: PurchaseStatus): 'active' | 'pending' | 'draft' | 'completed' | 'cancelled' => {
    switch (status) {
      case PurchaseStatus.DRAFT: return 'draft';
      case PurchaseStatus.IN_CAPTURE:
      case PurchaseStatus.IN_VALIDATION: return 'pending';
      case PurchaseStatus.VALIDATED: return 'completed';
      case PurchaseStatus.CLOSED: return 'active';
      case PurchaseStatus.CANCELLED: return 'cancelled';
      default: return 'draft';
    }
  };

  const getProductStatusVariant = (status: PurchaseProductStatus): 'active' | 'pending' | 'draft' | 'completed' | 'cancelled' => {
    switch (status) {
      case PurchaseProductStatus.PRELIMINARY: return 'draft';
      case PurchaseProductStatus.IN_VALIDATION: return 'pending';
      case PurchaseProductStatus.VALIDATED: return 'completed';
      case PurchaseProductStatus.REJECTED: return 'cancelled';
      case PurchaseProductStatus.CLOSED: return 'active';
      default: return 'draft';
    }
  };

  const renderProductCard = (product: PurchaseProduct) => {
    const canDelete = product.status === PurchaseProductStatus.PRELIMINARY || product.status === PurchaseProductStatus.IN_VALIDATION;
    const canValidate = product.status !== PurchaseProductStatus.VALIDATED &&
      product.status !== PurchaseProductStatus.CLOSED &&
      product.status !== PurchaseProductStatus.REJECTED &&
      purchase?.status !== PurchaseStatus.CLOSED &&
      purchase?.status !== PurchaseStatus.CANCELLED;

    return (
      <Card key={product.id} variant="outlined" padding="medium" style={styles.productCard}>
        <TouchableOpacity onPress={() => handleProductPress(product)} activeOpacity={0.7}>
          {/* Product Header */}
          <View style={styles.productHeader}>
            <View style={styles.productHeaderLeft}>
              <Title size="small" numberOfLines={1}>{product.name}</Title>
              <Caption color="secondary">
                {product.correlativeNumber && `#${product.correlativeNumber} | `}SKU: {product.sku}
              </Caption>
            </View>
            <View style={styles.productHeaderRight}>
              <Badge
                label={PurchaseProductStatusLabels[product.status]}
                variant={getProductStatusVariant(product.status)}
                size="small"
              />
              {canDelete && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={(e) => { e.stopPropagation(); handleDeleteProduct(product); }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.danger[500]} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Product Body */}
          <View style={styles.productBody}>
            <View style={styles.productRow}>
              <Label color="secondary">Costo:</Label>
              <Body>{formatCurrency(product.costCents)}</Body>
            </View>
            <View style={styles.productRow}>
              <Label color="secondary">Stock Preliminar:</Label>
              <Body>{product.preliminaryStock}</Body>
            </View>
            {product.validatedStock !== undefined && (
              <View style={styles.productRow}>
                <Label color="secondary">Stock Validado:</Label>
                <Body color={colors.success[600]}>{product.validatedStock}</Body>
              </View>
            )}
            {product.warehouse && (
              <View style={styles.productRow}>
                <Label color="secondary">Almacén:</Label>
                <Body>{product.warehouse.name}</Body>
              </View>
            )}
          </View>

          {product.rejectionReason && (
            <View style={styles.rejectionContainer}>
              <Label color={colors.danger[600]}>Razón de Rechazo:</Label>
              <Caption color={colors.danger[600]}>{product.rejectionReason}</Caption>
            </View>
          )}

          {/* Action hints */}
          {(product.status === PurchaseProductStatus.PRELIMINARY || product.status === PurchaseProductStatus.IN_VALIDATION) && (
            <Caption color="tertiary" style={styles.actionHint}>✏️ Toca para editar</Caption>
          )}
          {product.status === PurchaseProductStatus.VALIDATED && (
            <Caption color="tertiary" style={styles.actionHint}>👁️ Toca para ver detalles</Caption>
          )}
        </TouchableOpacity>

        {/* Action Buttons */}
        {canValidate && (
          <Button
            title="✓ Validar Producto"
            onPress={() => handleStartProductValidation(product)}
            variant="success"
            size="small"
            fullWidth
            disabled={actionLoading}
            style={styles.productActionButton}
          />
        )}

        {(product.status === PurchaseProductStatus.VALIDATED || product.status === PurchaseProductStatus.CLOSED) && (
          <Button
            title="📋 Información Registrada"
            onPress={() => handleOpenInfoModal(product)}
            variant="outline"
            size="small"
            fullWidth
            style={styles.productActionButton}
          />
        )}

        {product.status === PurchaseProductStatus.VALIDATED && (
          <Button
            title="🗑️ Eliminar Validaciones"
            onPress={() => handleDeleteProductValidations(product)}
            variant="danger"
            size="small"
            fullWidth
            disabled={actionLoading}
            style={styles.productActionButton}
          />
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[900]} />
          <Body color="secondary" style={styles.loadingText}>Cargando compra...</Body>
        </View>
      </SafeAreaView>
    );
  }

  if (!purchase) return null;

  const stats = getProductStats();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.icon.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            <Title size="large">{purchase.code}</Title>
            <Badge
              label={PurchaseStatusLabels[purchase.status]}
              variant={getStatusVariant(purchase.status)}
              size="small"
            />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary[900]]} />}
      >
        {/* Purchase Info Card */}
        <Card variant="elevated" padding="medium" style={styles.infoCard}>
          <Title size="small" style={styles.sectionTitle}>Información de la Compra</Title>

          <View style={styles.infoRow}>
            <Label color="secondary" style={styles.infoLabel}>Proveedor:</Label>
            <View style={styles.infoValueWithButton}>
              <Body style={styles.infoValue}>{purchase.supplier?.commercialName || 'N/A'}</Body>
              {canAddProducts() && (
                <TouchableOpacity style={styles.editSupplierButton} onPress={handleOpenEditSupplierModal}>
                  <Caption color={colors.primary[600]}>✏️ Editar</Caption>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.infoRow}>
            <Label color="secondary" style={styles.infoLabel}>Tipo de Guía:</Label>
            <Body style={styles.infoValue}>{GuideTypeLabels[purchase.guideType]}</Body>
          </View>

          <View style={styles.infoRow}>
            <Label color="secondary" style={styles.infoLabel}>Número de Guía:</Label>
            <Body style={styles.infoValue}>{purchase.guideNumber}</Body>
          </View>

          <View style={styles.infoRow}>
            <Label color="secondary" style={styles.infoLabel}>Fecha de Guía:</Label>
            <Body style={styles.infoValue}>{formatDate(purchase.guideDate)}</Body>
          </View>

          <View style={styles.infoRow}>
            <Label color="secondary" style={styles.infoLabel}>Creado:</Label>
            <Body style={styles.infoValue}>{formatDate(purchase.createdAt)}</Body>
          </View>

          {purchase.notes && (
            <View style={styles.notesContainer}>
              <Label color="secondary">Notas:</Label>
              <Body color="secondary">{purchase.notes}</Body>
            </View>
          )}
        </Card>

        {/* Product Stats Card */}
        <Card variant="elevated" padding="medium" style={styles.statsCard}>
          <Title size="small" style={styles.sectionTitle}>Resumen de Productos</Title>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Title size="medium" color={colors.text.primary}>{stats.total}</Title>
              <Caption color="secondary">Total</Caption>
            </View>
            <View style={styles.statItem}>
              <Title size="medium" color={colors.neutral[500]}>{stats.preliminary}</Title>
              <Caption color="secondary">Preliminar</Caption>
            </View>
            <View style={styles.statItem}>
              <Title size="medium" color={colors.warning[500]}>{stats.inValidation}</Title>
              <Caption color="secondary">En Validación</Caption>
            </View>
            <View style={styles.statItem}>
              <Title size="medium" color={colors.success[500]}>{stats.validated}</Title>
              <Caption color="secondary">Validados</Caption>
            </View>
            <View style={styles.statItem}>
              <Title size="medium" color={colors.danger[500]}>{stats.rejected}</Title>
              <Caption color="secondary">Rechazados</Caption>
            </View>
          </View>
        </Card>

        {/* Total Sum Card */}
        {totalSum && (
          <Card variant="elevated" padding="medium" style={styles.totalSumCard}>
            <Title size="small" style={styles.sectionTitle}>💰 Totales de la Compra</Title>
            <View style={styles.totalSumGrid}>
              <View style={styles.totalSumRow}>
                <View style={styles.totalSumItem}>
                  <Caption color="secondary">Total Sin Validar</Caption>
                  <Title size="medium" color={colors.neutral[600]}>{formatCurrency(totalSum.totalUnvalidatedCents)}</Title>
                  <Caption color="tertiary">{totalSum.totalProducts} producto{totalSum.totalProducts !== 1 ? 's' : ''}</Caption>
                </View>
                <View style={styles.totalSumItem}>
                  <Caption color="secondary">Total Validado</Caption>
                  <Title size="medium" color={colors.success[600]}>{formatCurrency(totalSum.totalValidatedCents)}</Title>
                  <Caption color="tertiary">{totalSum.validatedProducts} validado{totalSum.validatedProducts !== 1 ? 's' : ''}</Caption>
                </View>
              </View>
              {totalSum.differenceCents !== 0 && (
                <View style={[styles.totalSumDifference, totalSum.differenceCents > 0 ? styles.differencePositive : styles.differenceNegative]}>
                  <Caption color={totalSum.differenceCents > 0 ? colors.success[700] : colors.danger[700]}>Diferencia:</Caption>
                  <Body color={totalSum.differenceCents > 0 ? colors.success[700] : colors.danger[700]}>
                    {totalSum.differenceCents > 0 ? '+' : ''}{formatCurrency(totalSum.differenceCents)}
                  </Body>
                </View>
              )}
            </View>
          </Card>
        )}

        {/* Products Section */}
        <View style={styles.productsSection}>
          <Title size="small" style={styles.sectionTitle}>Productos ({products.length})</Title>

          {/* Search Bar */}
          {products.length > 0 && (
            <SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar por SKU, nombre o #correlativo..."
              onClear={() => setSearchQuery('')}
              style={styles.searchBar}
            />
          )}

          {/* Action Buttons */}
          {canAddProducts() && (
            <View style={styles.headerActions}>
              <ProtectedTouchableOpacity
                style={styles.ocrButton}
                onPress={handleOpenOcrScanner}
                disabled={actionLoading}
                requiredPermissions={['purchases.ocr.scan']}
                hideIfNoPermission={true}
              >
                <Ionicons name="camera" size={16} color={colors.text.inverse} />
                <Caption color={colors.text.inverse}>Escáner OCR</Caption>
              </ProtectedTouchableOpacity>
              <Button
                title="+ Agregar"
                onPress={handleAddProduct}
                variant="primary"
                size="small"
              />
            </View>
          )}

          {/* Products List */}
          {products.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="No hay productos agregados"
              description="Agrega productos a esta compra"
              size="small"
            />
          ) : filteredProducts.length === 0 && searchQuery.trim().length >= 2 ? (
            <EmptyState
              icon="search-outline"
              title="Sin resultados"
              description={`No se encontraron productos que coincidan con "${searchQuery}"`}
              actionLabel="Limpiar búsqueda"
              onAction={() => setSearchQuery('')}
              size="small"
            />
          ) : (
            filteredProducts.map(renderProductCard)
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Footer Action Buttons */}
      {(canAssignDebts() || canClosePurchase() || canCancelPurchase()) && (
        <View style={styles.footer}>
          {canCancelPurchase() && (
            <Button
              title="Cancelar Compra"
              onPress={handleCancelPurchase}
              variant="secondary"
              disabled={actionLoading}
              style={styles.footerButton}
            />
          )}
          {canAssignDebts() && (
            <Button
              title="Asignar Deudas"
              onPress={handleAssignDebts}
              variant="outline"
              disabled={actionLoading}
              style={styles.footerButton}
            />
          )}
          {canClosePurchase() && (
            <Button
              title="Cerrar Compra"
              onPress={handleClosePurchase}
              variant="primary"
              loading={actionLoading}
              disabled={actionLoading}
              style={styles.footerButton}
            />
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
          productPhotos={productPhotos}
        />
      )}

      {/* Edit Supplier Modal */}
      <EditSupplierModal
        visible={showEditSupplierModal}
        onClose={handleCloseEditSupplierModal}
        onSupplierSelect={handleSupplierSelect}
        selectedSupplier={selectedSupplier}
        onUpdate={handleUpdateSupplier}
        updating={updatingSupplier}
      />
    </SafeAreaView>
  );
};

// ============================================
// Product Info Modal Component
// ============================================
interface ProductInfoModalProps {
  visible: boolean;
  product: PurchaseProduct;
  onClose: () => void;
  productPhotos: string[];
}

const ProductInfoModal: React.FC<ProductInfoModalProps> = ({ visible, product, onClose, productPhotos }) => {
  const formatCurrency = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-PE', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const preliminaryPresentation = product.presentationHistory?.find((ph) => ph.type === 'PRELIMINARY');
  const validatedPresentation = product.presentationHistory?.find((ph) => ph.type === 'VALIDATED');

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <View>
              <Title size="medium">📋 Información Registrada</Title>
              <Body color="secondary" numberOfLines={1}>{product.name}</Body>
            </View>
            <IconButton icon="close" onPress={onClose} variant="ghost" size="small" />
          </View>

          <ScrollView style={modalStyles.content}>
            {/* Preliminary Data */}
            <Card variant="outlined" padding="medium" style={modalStyles.section}>
              <Label color="primary" style={modalStyles.sectionTitle}>📝 Datos Preliminares</Label>
              <InfoRow label="SKU" value={`${product.correlativeNumber ? `#${product.correlativeNumber} | ` : ''}${product.sku}`} />
              <InfoRow label="Nombre" value={product.name} />
              <InfoRow label="Costo Unitario" value={formatCurrency(product.costCents)} />
              <InfoRow label="Stock Preliminar" value={`${product.preliminaryStock} unidades`} />
              {product.preliminaryPresentationQuantity !== undefined && (
                <InfoRow label="Cant. Presentaciones" value={`${product.preliminaryPresentationQuantity}`} />
              )}
              {product.preliminaryLooseUnits !== undefined && (
                <InfoRow label="Unidades Sueltas" value={`${product.preliminaryLooseUnits}`} />
              )}
              {preliminaryPresentation && (
                <>
                  <InfoRow label="Presentación" value={preliminaryPresentation.presentation?.name || 'N/A'} />
                  <InfoRow label="Factor" value={`${preliminaryPresentation.factorToBase}x`} />
                </>
              )}
              <InfoRow label="Fecha de Registro" value={formatDate(product.createdAt)} />

              {productPhotos.length > 0 && (
                <View style={modalStyles.photoSection}>
                  <Label color="secondary">📷 Fotos del Producto ({productPhotos.length}):</Label>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modalStyles.photosScroll}>
                    {productPhotos.map((photoUrl, index) => (
                      <Image key={index} source={{ uri: photoUrl }} style={modalStyles.photo} resizeMode="cover" />
                    ))}
                  </ScrollView>
                </View>
              )}
            </Card>

            {/* Validated Data */}
            {(product.status === PurchaseProductStatus.VALIDATED || product.status === PurchaseProductStatus.CLOSED) && (
              <Card variant="outlined" padding="medium" style={{...modalStyles.section, ...modalStyles.validatedCard}}>
                <Label color={colors.success[700]} style={modalStyles.sectionTitle}>✅ Datos Validados</Label>
                {product.validatedStock !== undefined && (
                  <InfoRow label="Stock Validado" value={`${product.validatedStock} unidades`} highlight />
                )}
                {product.validatedPresentationQuantity !== undefined && (
                  <InfoRow label="Cant. Presentaciones" value={`${product.validatedPresentationQuantity}`} highlight />
                )}
                {product.warehouse && (
                  <InfoRow label="Almacén" value={product.warehouse.name} highlight />
                )}
                {product.barcode && (
                  <InfoRow label="Código de Barras" value={product.barcode} highlight />
                )}
                {product.weightKg !== undefined && product.weightKg !== null && typeof product.weightKg === 'number' && !isNaN(product.weightKg) && (
                  <InfoRow
                    label="Peso"
                    value={`${(product.weightKg * 1000).toFixed(0)} g (${product.weightKg.toFixed(3)} kg)`}
                    highlight
                  />
                )}
                {product.validatedAt && (
                  <InfoRow label="Fecha de Validación" value={formatDate(product.validatedAt)} highlight />
                )}
                {product.validatedByUser && (
                  <InfoRow label="Validado Por" value={product.validatedByUser.name || product.validatedByUser.email} highlight />
                )}
              </Card>
            )}

            {/* Validation History */}
            {product.validations && product.validations.length > 0 && (
              <Card variant="outlined" padding="medium" style={modalStyles.section}>
                <Label color="primary" style={modalStyles.sectionTitle}>📸 Historial de Validaciones</Label>
                {product.validations.map((validation, index) => (
                  <View key={validation.id} style={modalStyles.validationItem}>
                    <Body>Validación #{index + 1}</Body>
                    <InfoRow label="Fecha" value={formatDate(validation.validatedAt)} />
                    <InfoRow label="Stock" value={`${validation.validatedStock} unidades`} />
                    {validation.photoUrl && (
                      <Image source={{ uri: validation.photoUrl }} style={modalStyles.validationPhoto} resizeMode="cover" />
                    )}
                    {validation.signatureUrl && (
                      <Image source={{ uri: validation.signatureUrl }} style={modalStyles.signaturePhoto} resizeMode="contain" />
                    )}
                  </View>
                ))}
              </Card>
            )}
          </ScrollView>

          <View style={modalStyles.footer}>
            <Button title="Cerrar" onPress={onClose} variant="primary" fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Info Row Component
const InfoRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <View style={modalStyles.infoRow}>
    <Label color="secondary" style={modalStyles.infoLabel}>{label}:</Label>
    <Body color={highlight ? colors.success[700] : 'primary'} style={modalStyles.infoValue}>{value}</Body>
  </View>
);

// ============================================
// Edit Supplier Modal Component
// ============================================
interface EditSupplierModalProps {
  visible: boolean;
  onClose: () => void;
  onSupplierSelect: (supplier: ExpenseSupplier | null) => void;
  selectedSupplier: ExpenseSupplier | null;
  onUpdate: () => void;
  updating: boolean;
}

const EditSupplierModal: React.FC<EditSupplierModalProps> = ({
  visible, onClose, onSupplierSelect, selectedSupplier, onUpdate, updating,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          <View style={modalStyles.header}>
            <View>
              <Title size="medium">✏️ Editar Proveedor</Title>
              <Body color="secondary">Seleccione un nuevo proveedor</Body>
            </View>
            <IconButton icon="close" onPress={onClose} variant="ghost" size="small" />
          </View>

          <View style={modalStyles.content}>
            <SupplierSearchInput
              selectedSupplier={selectedSupplier || undefined}
              onSelect={onSupplierSelect}
              label="Proveedor de Mercadería"
              placeholder="Buscar proveedor..."
              required
              filterByType={SupplierType.MERCHANDISE}
            />
            <Caption color="secondary" style={modalStyles.infoText}>
              💡 Solo se muestran proveedores de tipo Mercadería
            </Caption>
          </View>

          <View style={modalStyles.footer}>
            <Button title="Cancelar" onPress={onClose} variant="secondary" disabled={updating} style={modalStyles.modalButton} />
            <Button title="Actualizar" onPress={onUpdate} variant="primary" loading={updating} disabled={updating || !selectedSupplier} style={modalStyles.modalButton} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing[3],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[4],
  },
  contentContainerTablet: {
    padding: spacing[6],
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  infoCard: {
    marginBottom: spacing[4],
  },
  sectionTitle: {
    marginBottom: spacing[4],
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: spacing[3],
  },
  infoLabel: {
    width: 120,
  },
  infoValue: {
    flex: 1,
  },
  infoValueWithButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  editSupplierButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  notesContainer: {
    marginTop: spacing[2],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing[1],
  },
  statsCard: {
    marginBottom: spacing[4],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  statItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  totalSumCard: {
    marginBottom: spacing[4],
  },
  totalSumGrid: {
    gap: spacing[3],
  },
  totalSumRow: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  totalSumItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing[1],
  },
  totalSumDifference: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: borderRadius.md,
    marginTop: spacing[2],
  },
  differencePositive: {
    backgroundColor: colors.success[50],
  },
  differenceNegative: {
    backgroundColor: colors.danger[50],
  },
  productsSection: {
    marginBottom: spacing[4],
  },
  searchBar: {
    marginBottom: spacing[3],
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  ocrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent[600],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    gap: spacing[2],
  },
  productCard: {
    marginBottom: spacing[3],
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  productHeaderLeft: {
    flex: 1,
    gap: spacing[1],
  },
  productHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  deleteButton: {
    padding: spacing[2],
  },
  productBody: {
    gap: spacing[2],
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rejectionContainer: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.danger[50],
    borderRadius: borderRadius.md,
    gap: spacing[1],
  },
  actionHint: {
    marginTop: spacing[3],
    textAlign: 'center',
  },
  productActionButton: {
    marginTop: spacing[3],
  },
  bottomSpacer: {
    height: spacing[20],
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing[3],
  },
  footerButton: {
    flex: 1,
  },
});

// Modal Styles
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  container: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    width: '100%',
    maxWidth: 700,
    maxHeight: '90%',
    ...shadows.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  content: {
    padding: spacing[5],
    maxHeight: 500,
  },
  section: {
    marginBottom: spacing[4],
  },
  sectionTitle: {
    marginBottom: spacing[3],
  },
  validatedCard: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[200],
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: spacing[2],
  },
  infoLabel: {
    width: 140,
  },
  infoValue: {
    flex: 1,
  },
  photoSection: {
    marginTop: spacing[4],
    gap: spacing[2],
  },
  photosScroll: {
    marginTop: spacing[2],
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.md,
    marginRight: spacing[3],
  },
  validationItem: {
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing[2],
  },
  validationPhoto: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    marginTop: spacing[2],
  },
  signaturePhoto: {
    width: '100%',
    height: 100,
    borderRadius: borderRadius.md,
    marginTop: spacing[2],
    backgroundColor: colors.surface.secondary,
  },
  infoText: {
    marginTop: spacing[3],
  },
  footer: {
    flexDirection: 'row',
    padding: spacing[5],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing[3],
  },
  modalButton: {
    flex: 1,
  },
});

export default PurchaseDetailScreen;
