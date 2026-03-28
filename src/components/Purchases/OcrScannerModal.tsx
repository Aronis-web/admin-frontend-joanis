import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
  Image,
  Platform,
} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import logger from '@/utils/logger';
import { useOcrScannerStore, OcrScannedProduct, ScanJob, OcrProvider } from '@/store/ocrScanner';
import { ocrScanQueue } from '@/services/ocrScanQueue';
import {
  launchImageLibraryAsync,
  launchCameraAsync,
  requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync,
  getDocumentAsync,
  MediaTypeOptions
} from '@/utils/filePicker';

interface OcrScannedItem {
  sku: string;
  nombre: string;
  cajas: number;
  unidades_por_caja: number;
  cantidad_total: number;
  precio_unitario: number;
  origen_precio_unitario: string;
  subtotal_fila: number;
}

interface OcrScanResponse {
  items: OcrScannedItem[];
  incluye_igv_en_precios: boolean;
  subtotal_documento_impreso: number | null;
  igv_impreso: number | null;
  total_documento_impreso: number | null;
  subtotal_documento_calculado: number;
  diferencia_subtotal: number | null;
}

interface EditableProduct {
  id: string; // Temporary ID for editing
  sku: string;
  nombre: string;
  cajas: number;
  unidades_por_caja: number;
  cantidad_total: number;
  precio_unitario: number;
  subtotal_fila: number;
}

interface OcrScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onProductsConfirmed: (products: EditableProduct[]) => void;
  purchaseId: string;
}

// ============================================================================
// PURE UTILITY FUNCTIONS (outside component for better performance)
// ============================================================================

/**
 * Validates if a value is a valid finite number
 */
const isValidNumber = (value: any): boolean => {
  const num = Number(value);
  return isFinite(num) && !isNaN(num);
};

/**
 * Safely converts a value to a number with a default fallback
 */
const safeNumber = (value: any, defaultValue: number = 0): number => {
  const num = Number(value);
  return isFinite(num) && !isNaN(num) ? num : defaultValue;
};

/**
 * Safe integer parsing to prevent NaN crashes
 */
const safeParseInt = (value: string, defaultValue: number = 0): number => {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) || !isFinite(parsed) ? defaultValue : parsed;
};

/**
 * Safe float parsing to prevent NaN crashes
 */
const safeParseFloat = (value: string, defaultValue: number = 0): number => {
  const parsed = parseFloat(value);
  return isNaN(parsed) || !isFinite(parsed) ? defaultValue : parsed;
};

/**
 * Calculates subtotal ensuring valid result
 */
const calculateSubtotal = (cantidad: number, precio: number): number => {
  const result = cantidad * precio;
  return isFinite(result) && !isNaN(result) ? result : 0;
};

/**
 * Validates if a product has all required fields
 * Note: precio_unitario and subtotal_fila can be 0 or null (for guías de remisión)
 */
const isValidProduct = (product: EditableProduct): boolean => {
  return !!(
    (
      product.sku?.trim() &&
      product.nombre?.trim() &&
      isValidNumber(product.cantidad_total) &&
      product.cantidad_total > 0
    )
    // precio_unitario and subtotal_fila are optional (can be 0 or null)
  );
};

/**
 * Normalizes a scanned product from OCR response
 * Inspired by OCR2ComprasV2Modal normalization
 */
const normalizeScannedProduct = (raw: OcrScannedItem, index: number): EditableProduct => {
  const product: EditableProduct = {
    id: `temp-${Date.now()}-${index}`,
    sku: raw?.sku?.trim() || '',
    nombre: raw?.nombre?.trim() || '',
    cajas: Math.max(0, safeNumber(raw?.cajas, 0)),
    unidades_por_caja: Math.max(1, safeNumber(raw?.unidades_por_caja, 1)),
    cantidad_total: 0, // Will be calculated
    precio_unitario: 0, // Will be calculated
    subtotal_fila: 0, // Will be calculated
  };

  // Calculate cantidad_total
  product.cantidad_total = product.cajas * product.unidades_por_caja;

  // Normalize precio_unitario
  const rawPrecio = safeNumber(raw?.precio_unitario, 0);
  product.precio_unitario = rawPrecio >= 0 ? rawPrecio : 0;

  // Calculate subtotal or derive precio if missing
  const rawSubtotal = safeNumber(raw?.subtotal_fila, 0);
  if (rawSubtotal > 0) {
    product.subtotal_fila = rawSubtotal;
    // If no precio but has subtotal, calculate it
    if (product.precio_unitario === 0 && product.cantidad_total > 0) {
      product.precio_unitario = rawSubtotal / product.cantidad_total;
    }
  } else {
    product.subtotal_fila = calculateSubtotal(product.cantidad_total, product.precio_unitario);
  }

  return product;
};

// ============================================================================
// COMPONENT
// ============================================================================

export const OcrScannerModal: React.FC<OcrScannerModalProps> = ({
  visible,
  onClose,
  onProductsConfirmed,
  purchaseId,
}) => {
  // Use Zustand store for persistent state
  const {
    scanJobs,
    scannedProducts,
    purchaseFiles,
    editingProductIds,
    addScannedFiles: addFilesToStore,
    removeScannedFile: removeFileFromStore,
    clearScannedFiles: clearFilesFromStore,
    setObservaciones: setObservacionesInStore,
    setOcrProvider: setOcrProviderInStore,
    updateScannedProduct,
    removeScannedProduct,
    setEditingProductId: setEditingProductIdInStore,
    getScanJobsByPurchase,
  } = useOcrScannerStore();

  // Local state only for loading
  const [loading, setLoading] = useState(false);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  // Get data for current purchase - subscribe directly to purchaseFiles
  const scannedFiles = useMemo(
    () => purchaseFiles[purchaseId]?.files || [],
    [purchaseFiles, purchaseId]
  );
  const observaciones = useMemo(
    () => purchaseFiles[purchaseId]?.observaciones || '',
    [purchaseFiles, purchaseId]
  );
  const ocrProvider = useMemo(
    () => purchaseFiles[purchaseId]?.provider || 'openai',
    [purchaseFiles, purchaseId]
  );
  const editingProductId = useMemo(
    () => editingProductIds[purchaseId] || null,
    [editingProductIds, purchaseId]
  );

  // Filter products for current purchase
  const products = useMemo(() => {
    return scannedProducts.filter((p) => p.purchaseId === purchaseId);
  }, [scannedProducts, purchaseId]);

  // Get scan jobs for current purchase
  const purchaseJobs = useMemo(
    () => getScanJobsByPurchase(purchaseId),
    [purchaseId, getScanJobsByPurchase, scanJobs]
  );
  const activeJob = useMemo(
    () => purchaseJobs.find((j) => j.status === 'scanning'),
    [purchaseJobs]
  );
  const isScanning = !!activeJob;
  const scanningProgress = activeJob?.progress || null;

  // Get last completed job for this purchase
  const lastCompletedJob = useMemo(() => {
    const completed = purchaseJobs
      .filter((j) => j.status === 'completed')
      .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    return completed[0];
  }, [purchaseJobs]);

  // Load products when modal opens
  useEffect(() => {
    if (visible) {
      logger.debug(
        `📂 Modal opened for purchase ${purchaseId}. Found ${products.length} scanned products and ${purchaseJobs.length} jobs.`
      );
    }
  }, [visible, purchaseId, products.length, purchaseJobs.length]);

  // Memoized calculations for better performance
  const canConfirm = useMemo(() => {
    return products.length > 0 && products.some((p) => isValidProduct(p));
  }, [products]);

  const totalProducts = useMemo(() => products.length, [products]);

  const totalCost = useMemo(() => {
    return products.reduce((sum, p) => {
      const subtotal = p.subtotal_fila;
      return sum + (isValidNumber(subtotal) ? subtotal : 0);
    }, 0);
  }, [products]);

  const invalidProductsCount = useMemo(() => {
    return products.filter((p) => !isValidProduct(p)).length;
  }, [products]);

  const handleClose = useCallback(() => {
    // Solo limpiar archivos y observaciones, NO los productos escaneados
    clearFilesFromStore(purchaseId);
    setObservacionesInStore(purchaseId, '');
    setEditingProductIdInStore(purchaseId, null);
    onClose();
  }, [
    clearFilesFromStore,
    setObservacionesInStore,
    setEditingProductIdInStore,
    purchaseId,
    onClose,
  ]);

  const scanDocuments = useCallback(async () => {
    if (scannedFiles.length === 0) {
      Alert.alert('Error', 'No hay archivos seleccionados para escanear');
      return;
    }

    // Prevenir múltiples escaneos simultáneos para la misma compra
    if (isScanning) {
      Alert.alert('Aviso', 'Ya hay un escaneo en proceso para esta compra');
      return;
    }

    // Crear un nuevo trabajo de escaneo
    const job: ScanJob = {
      id: `job-${purchaseId}-${Date.now()}`,
      purchaseId,
      files: scannedFiles,
      observaciones: observaciones || undefined,
      provider: ocrProvider,
      status: 'pending',
      progress: null,
    };

    logger.debug('📄 Creating scan job:', {
      jobId: job.id,
      purchaseId,
      filesCount: scannedFiles.length,
      hasObservaciones: !!observaciones,
      provider: ocrProvider,
    });

    // Agregar trabajo a la cola
    await ocrScanQueue.addJob(job);

    // Limpiar archivos después de agregar a la cola
    clearFilesFromStore(purchaseId);
    setObservacionesInStore(purchaseId, '');

    // Mostrar mensaje de confirmación
    const providerName = ocrProvider === 'gemini' ? 'Gemini' : 'OpenAI';
    Alert.alert(
      '🚀 Escaneo Iniciado',
      `Se ha iniciado el escaneo de ${scannedFiles.length} archivo(s) para esta compra usando ${providerName}.\n\nEl proceso continuará en segundo plano. Puedes cerrar este modal y revisar otras compras.\n\nRecibirás una notificación cuando el escaneo termine.`,
      [{ text: 'Entendido' }]
    );

    logger.debug(`✅ Scan job ${job.id} added to queue`);
  }, [
    scannedFiles,
    observaciones,
    purchaseId,
    clearFilesFromStore,
    setObservacionesInStore,
    isScanning,
  ]);

  const pickImage = useCallback(async () => {
    try {
      const { status } = await requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permisos requeridos',
          'Se necesitan permisos para acceder a la galería de fotos.'
        );
        return;
      }

      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: true, // Enable multiple selection
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newFiles = result.assets.map((asset: any, index: number) => ({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}_${index}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
        }));

        // Check if we would exceed the limit
        if (scannedFiles.length + newFiles.length > 10) {
          Alert.alert('Límite alcanzado', 'Solo se pueden seleccionar hasta 10 archivos');
          // Add only what fits
          const filesToAdd = newFiles.slice(0, 10 - scannedFiles.length);
          addFilesToStore(purchaseId, filesToAdd);
        } else {
          addFilesToStore(purchaseId, newFiles);
        }

        logger.debug(
          `📁 Added ${newFiles.length} files. Total: ${scannedFiles.length + newFiles.length}`
        );
      }
    } catch (error) {
      logger.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  }, [scannedFiles, addFilesToStore, purchaseId]);

  const takePhoto = useCallback(async () => {
    try {
      if (scannedFiles.length >= 10) {
        Alert.alert('Límite alcanzado', 'Ya tienes 10 archivos seleccionados');
        return;
      }

      const { status } = await requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permisos requeridos', 'Se necesitan permisos para acceder a la cámara.');
        return;
      }

      const result = await launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileData = {
          uri: asset.uri,
          name: `photo_${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
        };

        addFilesToStore(purchaseId, [fileData]);
        logger.debug(`📸 Photo added. Total files: ${scannedFiles.length + 1}`);
      }
    } catch (error) {
      logger.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  }, [scannedFiles, addFilesToStore, purchaseId]);

  const pickDocument = useCallback(async () => {
    try {
      if (scannedFiles.length >= 10) {
        Alert.alert('Límite alcanzado', 'Ya tienes 10 archivos seleccionados');
        return;
      }

      const result = await getDocumentAsync({
        type: [
          'image/*',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        copyToCacheDirectory: true,
        multiple: true, // Allow multiple selection
      });

      if (result.canceled) {
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const newFiles = result.assets.map((asset: any) => ({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || 'application/pdf',
        }));

        // Check if we would exceed the limit
        if (scannedFiles.length + newFiles.length > 10) {
          Alert.alert('Límite alcanzado', 'Solo se pueden seleccionar hasta 10 archivos');
          // Add only what fits
          const filesToAdd = newFiles.slice(0, 10 - scannedFiles.length);
          addFilesToStore(purchaseId, filesToAdd);
        } else {
          addFilesToStore(purchaseId, newFiles);
        }

        logger.debug(
          `📄 Added ${newFiles.length} documents. Total: ${scannedFiles.length + newFiles.length}`
        );
      }
    } catch (error) {
      logger.error('Error picking document:', error);
      Alert.alert('Error', 'No se pudo seleccionar el documento');
    }
  }, [scannedFiles, addFilesToStore, purchaseId]);

  const removeFile = useCallback(
    (index: number) => {
      removeFileFromStore(purchaseId, index);
      logger.debug(`🗑️ File removed. Total: ${scannedFiles.length - 1}`);
    },
    [removeFileFromStore, purchaseId, scannedFiles.length]
  );

  const handleAddNewRow = useCallback(() => {
    const newProduct: OcrScannedProduct = {
      id: `temp-${Date.now()}`,
      sku: '',
      nombre: '',
      cajas: 1,
      unidades_por_caja: 1,
      cantidad_total: 1,
      precio_unitario: 0,
      subtotal_fila: 0,
      purchaseId,
      scannedAt: Date.now(),
    };
    const store = useOcrScannerStore.getState();
    store.addScannedProducts([newProduct], purchaseId);
    setEditingProductIdInStore(purchaseId, newProduct.id);
  }, [purchaseId, setEditingProductIdInStore]);

  const handleDeleteProduct = useCallback(
    (productId: string) => {
      Alert.alert('Confirmar', '¿Deseas eliminar este producto?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            removeScannedProduct(productId);
          },
        },
      ]);
    },
    [removeScannedProduct]
  );

  const handleUpdateProduct = useCallback(
    (productId: string, field: keyof OcrScannedProduct, value: any) => {
      const product = scannedProducts.find((p) => p.id === productId);
      if (!product) {
        return;
      }

      const updated: Partial<OcrScannedProduct> = { [field]: value };

      // Validate and normalize numeric values
      if (['cajas', 'unidades_por_caja', 'cantidad_total', 'precio_unitario'].includes(field)) {
        const currentValue = product[field as keyof OcrScannedProduct];
        const numValue = safeNumber(value, typeof currentValue === 'number' ? currentValue : 0);
        updated[field as keyof OcrScannedProduct] = Math.max(0, numValue) as any;
      }

      // Recalculate dependencies based on field changed
      if (field === 'cajas' || field === 'unidades_por_caja') {
        const cajas = field === 'cajas' ? (updated.cajas ?? product.cajas) : product.cajas;
        const unidadesPorCaja =
          field === 'unidades_por_caja'
            ? (updated.unidades_por_caja ?? product.unidades_por_caja)
            : product.unidades_por_caja;
        updated.cantidad_total = cajas * unidadesPorCaja;
      }

      // Always recalculate subtotal when relevant fields change
      if (['cajas', 'unidades_por_caja', 'cantidad_total', 'precio_unitario'].includes(field)) {
        const cantidadTotal = updated.cantidad_total ?? product.cantidad_total;
        const precioUnitario = updated.precio_unitario ?? product.precio_unitario;
        updated.subtotal_fila = calculateSubtotal(cantidadTotal, precioUnitario);
      }

      updateScannedProduct(productId, updated);
    },
    [scannedProducts, updateScannedProduct]
  );

  const handleConfirm = useCallback(() => {
    // Validate products using pure function
    const invalidProducts = products.filter((p) => !isValidProduct(p));

    if (invalidProducts.length > 0) {
      Alert.alert(
        'Validación',
        `${invalidProducts.length} producto(s) tienen datos inválidos. Todos los productos deben tener SKU, nombre, cantidad y precio válidos.`
      );
      return;
    }

    if (products.length === 0) {
      Alert.alert('Validación', 'No hay productos para confirmar.');
      return;
    }

    logger.debug(`✅ Confirming ${products.length} products`);

    // Convert to EditableProduct format for backward compatibility
    const editableProducts: EditableProduct[] = products.map((p) => ({
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      cajas: p.cajas,
      unidades_por_caja: p.unidades_por_caja,
      cantidad_total: p.cantidad_total,
      precio_unitario: p.precio_unitario,
      subtotal_fila: p.subtotal_fila,
    }));

    onProductsConfirmed(editableProducts);

    // Clear products for this purchase after confirmation
    const productIds = products.map((p) => p.id);
    productIds.forEach((id) => removeScannedProduct(id));

    // Clear files and observaciones
    clearFilesFromStore(purchaseId);
    setObservacionesInStore(purchaseId, '');
    setEditingProductIdInStore(purchaseId, null);

    onClose();
  }, [
    products,
    onProductsConfirmed,
    removeScannedProduct,
    clearFilesFromStore,
    setObservacionesInStore,
    setEditingProductIdInStore,
    purchaseId,
    onClose,
  ]);

  // Handler to clear all scanned products for this purchase
  const handleClearAllProducts = useCallback(() => {
    Alert.alert(
      'Confirmar',
      '¿Deseas borrar todos los productos escaneados? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar Todo',
          style: 'destructive',
          onPress: () => {
            const productIds = products.map((p) => p.id);
            productIds.forEach((id) => removeScannedProduct(id));
            logger.debug(
              `🗑️ Cleared all ${productIds.length} scanned products for purchase ${purchaseId}`
            );
            Alert.alert('Éxito', 'Todos los productos escaneados han sido eliminados.');
          },
        },
      ]
    );
  }, [products, removeScannedProduct, purchaseId]);

  const renderProductRow = useCallback(
    (product: OcrScannedProduct, index: number) => {
      const isEditing = editingProductId === product.id;

      return (
        <View key={product.id} style={[styles.productRow, isTablet && styles.productRowTablet]}>
          <View style={styles.productRowHeader}>
            <Text style={[styles.productRowNumber, isTablet && styles.productRowNumberTablet]}>
              #{index + 1}
            </Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteProduct(product.id)}
            >
              <Text style={styles.deleteButtonText}>🗑️</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.productFields}>
            {/* SKU */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isTablet && styles.fieldLabelTablet]}>SKU</Text>
              <TextInput
                style={[styles.fieldInput, isTablet && styles.fieldInputTablet]}
                value={product.sku}
                onChangeText={(value) => handleUpdateProduct(product.id, 'sku', value)}
                placeholder="SKU"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Nombre */}
            <View style={[styles.fieldGroup, styles.fieldGroupWide]}>
              <Text style={[styles.fieldLabel, isTablet && styles.fieldLabelTablet]}>Nombre</Text>
              <TextInput
                style={[styles.fieldInput, isTablet && styles.fieldInputTablet]}
                value={product.nombre}
                onChangeText={(value) => handleUpdateProduct(product.id, 'nombre', value)}
                placeholder="Nombre del producto"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Cajas */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isTablet && styles.fieldLabelTablet]}>Cajas</Text>
              <TextInput
                style={[styles.fieldInput, isTablet && styles.fieldInputTablet]}
                value={String(product.cajas)}
                onChangeText={(value) =>
                  handleUpdateProduct(product.id, 'cajas', safeParseInt(value, 0))
                }
                placeholder="0"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
              />
            </View>

            {/* Unidades por caja */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isTablet && styles.fieldLabelTablet]}>Und/Caja</Text>
              <TextInput
                style={[styles.fieldInput, isTablet && styles.fieldInputTablet]}
                value={String(product.unidades_por_caja)}
                onChangeText={(value) =>
                  handleUpdateProduct(product.id, 'unidades_por_caja', safeParseInt(value, 0))
                }
                placeholder="0"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
              />
            </View>

            {/* Cantidad total */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isTablet && styles.fieldLabelTablet]}>Total</Text>
              <TextInput
                style={[styles.fieldInput, isTablet && styles.fieldInputTablet]}
                value={String(product.cantidad_total)}
                onChangeText={(value) =>
                  handleUpdateProduct(product.id, 'cantidad_total', safeParseInt(value, 0))
                }
                placeholder="0"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
              />
            </View>

            {/* Precio unitario */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isTablet && styles.fieldLabelTablet]}>Precio</Text>
              <TextInput
                style={[styles.fieldInput, isTablet && styles.fieldInputTablet]}
                value={String(product.precio_unitario)}
                onChangeText={(value) => {
                  // Allow empty string for editing, otherwise parse the value
                  if (value === '' || value === '.') {
                    handleUpdateProduct(product.id, 'precio_unitario', 0);
                  } else {
                    const parsed = safeParseFloat(value, product.precio_unitario);
                    handleUpdateProduct(product.id, 'precio_unitario', parsed);
                  }
                }}
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
              />
            </View>

            {/* Subtotal */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, isTablet && styles.fieldLabelTablet]}>Subtotal</Text>
              <View
                style={[
                  styles.fieldInput,
                  isTablet && styles.fieldInputTablet,
                  styles.fieldInputReadonly,
                ]}
              >
                <Text style={styles.fieldInputReadonlyText}>
                  S/{' '}
                  {product.subtotal_fila !== null &&
                  product.subtotal_fila !== undefined &&
                  isFinite(product.subtotal_fila) &&
                  !isNaN(product.subtotal_fila)
                    ? product.subtotal_fila.toFixed(2)
                    : '0.00'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      );
    },
    [editingProductId, isTablet, handleUpdateProduct, handleDeleteProduct]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>Escáner OCR</Text>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
              Escanea documentos para agregar productos
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            isTablet && styles.contentContainerTablet,
          ]}
        >
          {/* File Upload Section */}
          <View style={styles.uploadSection}>
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              Subir Documentos (hasta 10 archivos)
            </Text>
            <View style={styles.uploadButtons}>
              <TouchableOpacity
                style={[styles.uploadButton, isTablet && styles.uploadButtonTablet]}
                onPress={takePhoto}
                disabled={isScanning || scannedFiles.length >= 10}
              >
                <Text style={styles.uploadButtonIcon}>📷</Text>
                <Text style={[styles.uploadButtonText, isTablet && styles.uploadButtonTextTablet]}>
                  Tomar Foto
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.uploadButton, isTablet && styles.uploadButtonTablet]}
                onPress={pickImage}
                disabled={isScanning || scannedFiles.length >= 10}
              >
                <Text style={styles.uploadButtonIcon}>🖼️</Text>
                <Text style={[styles.uploadButtonText, isTablet && styles.uploadButtonTextTablet]}>
                  Galería
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.uploadButton, isTablet && styles.uploadButtonTablet]}
                onPress={pickDocument}
                disabled={isScanning || scannedFiles.length >= 10}
              >
                <Text style={styles.uploadButtonIcon}>📄</Text>
                <Text style={[styles.uploadButtonText, isTablet && styles.uploadButtonTextTablet]}>
                  PDF/Excel
                </Text>
              </TouchableOpacity>
            </View>

            {/* OCR Provider Selector */}
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.fieldLabel, isTablet && styles.fieldLabelTablet]}>
                Proveedor de OCR
              </Text>
              <View style={styles.providerSelector}>
                <TouchableOpacity
                  style={[
                    styles.providerButton,
                    ocrProvider === 'openai' && styles.providerButtonActive,
                    isTablet && styles.providerButtonTablet,
                  ]}
                  onPress={() => setOcrProviderInStore(purchaseId, 'openai')}
                  disabled={isScanning}
                >
                  <Text
                    style={[
                      styles.providerButtonText,
                      ocrProvider === 'openai' && styles.providerButtonTextActive,
                      isTablet && styles.providerButtonTextTablet,
                    ]}
                  >
                    🤖 OpenAI
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.providerButton,
                    ocrProvider === 'gemini' && styles.providerButtonActive,
                    isTablet && styles.providerButtonTablet,
                  ]}
                  onPress={() => setOcrProviderInStore(purchaseId, 'gemini')}
                  disabled={isScanning}
                >
                  <Text
                    style={[
                      styles.providerButtonText,
                      ocrProvider === 'gemini' && styles.providerButtonTextActive,
                      isTablet && styles.providerButtonTextTablet,
                    ]}
                  >
                    ✨ Gemini
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Observaciones */}
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.fieldLabel, isTablet && styles.fieldLabelTablet]}>
                Observaciones (opcional)
              </Text>
              <TextInput
                style={[styles.fieldInput, isTablet && styles.fieldInputTablet, { minHeight: 60 }]}
                value={observaciones}
                onChangeText={(text) => setObservacionesInStore(purchaseId, text)}
                placeholder="Notas sobre los documentos..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Selected Files List */}
          {scannedFiles.length > 0 && (
            <View style={styles.filesSection}>
              <View style={styles.filesSectionHeader}>
                <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                  Archivos Seleccionados ({scannedFiles.length}/10)
                </Text>
                <TouchableOpacity
                  style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
                  onPress={scanDocuments}
                  disabled={isScanning}
                >
                  <Text style={styles.scanButtonText}>
                    {isScanning ? '⏳ Escaneando...' : '🚀 Escanear Documentos'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.filesList}>
                {scannedFiles.map((file, index) => (
                  <View key={index} style={styles.fileItem}>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileIcon}>
                        {file.mimeType.startsWith('image/')
                          ? '🖼️'
                          : file.mimeType === 'application/pdf'
                            ? '📄'
                            : '📊'}
                      </Text>
                      <View style={styles.fileDetails}>
                        <Text style={styles.fileName} numberOfLines={1}>
                          {file.name}
                        </Text>
                        <Text style={styles.fileType}>
                          {file.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.removeFileButton}
                      onPress={() => removeFile(index)}
                      disabled={isScanning}
                    >
                      <Text style={styles.removeFileButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Scanning Indicator */}
          {isScanning && (
            <View style={styles.scanningSection}>
              <ActivityIndicator size="large" color="#6366F1" />
              {scanningProgress ? (
                <>
                  <Text style={[styles.scanningText, isTablet && styles.scanningTextTablet]}>
                    Procesando archivo {scanningProgress.current} de {scanningProgress.total}
                  </Text>
                  <Text style={[styles.scanningSubtext, isTablet && styles.scanningTextTablet]}>
                    {scanningProgress.filename}
                  </Text>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        { width: `${(scanningProgress.current / scanningProgress.total) * 100}%` },
                      ]}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.scanningText, isTablet && styles.scanningTextTablet]}>
                    Escaneando {scannedFiles.length} documento(s)...
                  </Text>
                  <Text style={[styles.scanningSubtext, isTablet && styles.scanningTextTablet]}>
                    Esto puede tomar unos segundos. Puedes cerrar el modal y el escaneo continuará
                    en segundo plano.
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Products List */}
          {products.length > 0 && (
            <View style={styles.productsSection}>
              <View style={styles.productsSectionHeader}>
                <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                  Productos Detectados ({products.length})
                </Text>
                <View style={styles.productsSectionActions}>
                  <TouchableOpacity style={styles.addRowButton} onPress={handleAddNewRow}>
                    <Text style={styles.addRowButtonText}>+ Agregar Fila</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.clearAllButton} onPress={handleClearAllProducts}>
                    <Text style={styles.clearAllButtonText}>🗑️ Borrar Todo</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {lastCompletedJob?.result && (
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Archivos Procesados:</Text>
                    <Text style={styles.summaryValue}>
                      {lastCompletedJob.result.archivos_procesados}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Estimado:</Text>
                    <Text style={[styles.summaryValue, styles.summaryValueBold]}>
                      S/ {lastCompletedJob.result.total_estimado?.toFixed(2) || '0.00'}
                    </Text>
                  </View>
                  {lastCompletedJob.result.observaciones && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Observaciones:</Text>
                      <Text style={styles.summaryValue}>
                        {lastCompletedJob.result.observaciones}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.productsList}>
                {products.map((product, index) => renderProductRow(product, index))}
              </View>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Footer Actions */}
        {products.length > 0 && (
          <View style={[styles.footer, isTablet && styles.footerTablet]}>
            <TouchableOpacity
              style={[styles.cancelButton, isTablet && styles.cancelButtonTablet]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={[styles.cancelButtonText, isTablet && styles.cancelButtonTextTablet]}>
                Cerrar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                isTablet && styles.confirmButtonTablet,
                loading && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={[styles.confirmButtonText, isTablet && styles.confirmButtonTextTablet]}
                >
                  Confirmar {products.length} Producto{products.length !== 1 ? 's' : ''}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTablet: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[5],
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  titleTablet: {
    fontSize: 24,
  },
  subtitle: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  subtitleTablet: {
    fontSize: 15,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[6],
  },
  contentContainerTablet: {
    padding: spacing[8],
  },
  uploadSection: {
    marginBottom: spacing[6],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[4],
  },
  sectionTitleTablet: {
    fontSize: 18,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: spacing[3],
    flexWrap: 'wrap',
  },
  uploadButton: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.surface.primary,
    borderWidth: 2,
    borderColor: colors.primary[500],
    borderRadius: borderRadius.xl,
    padding: spacing[6],
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  uploadButtonTablet: {
    padding: spacing[8],
    borderRadius: borderRadius['2xl'],
  },
  uploadButtonIcon: {
    fontSize: 48,
    marginBottom: spacing[3],
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary[500],
  },
  uploadButtonTextTablet: {
    fontSize: 17,
  },
  providerSelector: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  providerButton: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerButtonActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  providerButtonTablet: {
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[6],
    borderRadius: borderRadius.xl,
  },
  providerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  providerButtonTextActive: {
    color: colors.primary[500],
  },
  providerButtonTextTablet: {
    fontSize: 17,
  },
  scanningSection: {
    alignItems: 'center',
    padding: spacing[12],
  },
  scanningText: {
    fontSize: 15,
    color: colors.neutral[500],
    marginTop: spacing[4],
    fontWeight: '600',
  },
  scanningTextTablet: {
    fontSize: 17,
  },
  scanningSubtext: {
    fontSize: 13,
    color: colors.neutral[400],
    marginTop: spacing[2],
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: colors.border.default,
    borderRadius: borderRadius.xs,
    marginTop: spacing[4],
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.xs,
  },
  filesSection: {
    marginBottom: spacing[6],
  },
  filesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  scanButton: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.lg,
  },
  scanButtonDisabled: {
    backgroundColor: colors.neutral[400],
  },
  scanButtonText: {
    fontSize: 14,
    color: colors.neutral[0],
    fontWeight: '600',
  },
  filesList: {
    gap: spacing[3],
  },
  fileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing[3],
  },
  fileIcon: {
    fontSize: 24,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: 2,
  },
  fileType: {
    fontSize: 11,
    color: colors.neutral[500],
    textTransform: 'uppercase',
  },
  removeFileButton: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: colors.danger[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeFileButtonText: {
    fontSize: 16,
    color: colors.danger[600],
    fontWeight: '600',
  },
  productsSection: {
    marginBottom: spacing[6],
  },
  productsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  productsSectionActions: {
    flexDirection: 'row',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
  addRowButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.lg,
  },
  addRowButtonText: {
    fontSize: 13,
    color: colors.neutral[0],
    fontWeight: '600',
  },
  clearAllButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    backgroundColor: colors.danger[600],
    borderRadius: borderRadius.lg,
  },
  clearAllButtonText: {
    fontSize: 13,
    color: colors.neutral[0],
    fontWeight: '600',
  },
  summaryBox: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  summaryLabelWarning: {
    color: colors.warning[500],
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
    color: colors.neutral[800],
    fontWeight: '500',
  },
  summaryValueBold: {
    fontWeight: '700',
    fontSize: 16,
  },
  summaryValueWarning: {
    color: colors.warning[500],
    fontWeight: '700',
  },
  productsList: {
    gap: spacing[4],
  },
  productRow: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  productRowTablet: {
    padding: spacing[5],
  },
  productRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  productRowNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary[500],
  },
  productRowNumberTablet: {
    fontSize: 16,
  },
  deleteButton: {
    padding: spacing[1],
  },
  deleteButtonText: {
    fontSize: 20,
  },
  productFields: {
    gap: spacing[3],
  },
  fieldGroup: {
    flex: 1,
  },
  fieldGroupWide: {
    flex: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
    marginBottom: spacing[1.5],
  },
  fieldLabelTablet: {
    fontSize: 14,
  },
  fieldInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: 14,
    color: colors.neutral[800],
  },
  fieldInputTablet: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[2.5],
    fontSize: 16,
  },
  fieldInputReadonly: {
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
  },
  fieldInputReadonlyText: {
    fontSize: 14,
    color: colors.neutral[800],
    fontWeight: '600',
  },
  bottomSpacer: {
    height: spacing[10],
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: spacing[3],
  },
  footerTablet: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[5],
    gap: spacing[4],
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  cancelButtonTablet: {
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  cancelButtonTextTablet: {
    fontSize: 17,
  },
  confirmButton: {
    flex: 2,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
  },
  confirmButtonTablet: {
    paddingVertical: spacing[4],
    borderRadius: borderRadius.xl,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  confirmButtonTextTablet: {
    fontSize: 17,
  },
});

export default OcrScannerModal;
