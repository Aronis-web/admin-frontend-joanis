import React, { useState, useMemo, useCallback } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { purchasesService } from '@/services/api';
import logger from '@/utils/logger';

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
    product.sku?.trim() &&
    product.nombre?.trim() &&
    isValidNumber(product.cantidad_total) &&
    product.cantidad_total > 0
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
  // Consolidated state for better performance
  const [ocrState, setOcrState] = useState({
    loading: false,
    scanning: false,
    scannedFiles: [] as Array<{ uri: string; name: string; mimeType: string }>,
    observaciones: '',
    products: [] as EditableProduct[],
    scanResponse: null as OcrScanResponse | null,
    editingProductId: null as string | null,
    scanningProgress: null as { current: number; total: number; filename: string } | null,
  });

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  // Helper to update state
  const updateOcrState = useCallback((updates: Partial<typeof ocrState>) => {
    setOcrState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetModal = useCallback(() => {
    setOcrState({
      loading: false,
      scanning: false,
      scannedFiles: [],
      observaciones: '',
      products: [],
      scanResponse: null,
      editingProductId: null,
      scanningProgress: null,
    });
  }, []);

  // Memoized calculations for better performance
  const canConfirm = useMemo(() => {
    return ocrState.products.length > 0 &&
           ocrState.products.some(p => isValidProduct(p));
  }, [ocrState.products]);

  const totalProducts = useMemo(() => ocrState.products.length, [ocrState.products]);

  const totalCost = useMemo(() => {
    return ocrState.products.reduce((sum, p) => {
      const subtotal = p.subtotal_fila;
      return sum + (isValidNumber(subtotal) ? subtotal : 0);
    }, 0);
  }, [ocrState.products]);

  const invalidProductsCount = useMemo(() => {
    return ocrState.products.filter(p => !isValidProduct(p)).length;
  }, [ocrState.products]);

  const handleClose = useCallback(() => {
    if (ocrState.products.length > 0) {
      Alert.alert(
        'Confirmar',
        '¿Deseas cerrar? Se perderán los productos escaneados.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Cerrar',
            style: 'destructive',
            onPress: () => {
              resetModal();
              onClose();
            },
          },
        ]
      );
    } else {
      resetModal();
      onClose();
    }
  }, [ocrState.products.length, resetModal, onClose]);

  const scanDocuments = useCallback(async () => {
    if (ocrState.scannedFiles.length === 0) {
      Alert.alert('Error', 'No hay archivos seleccionados para escanear');
      return;
    }

    const startTime = Date.now();
    updateOcrState({ scanning: true, scanningProgress: null });

    try {
      logger.debug('📄 Scanning documents:', {
        count: ocrState.scannedFiles.length,
        files: ocrState.scannedFiles.map(f => ({
          name: f.name,
          mimeType: f.mimeType,
          uri: f.uri.substring(0, 50) + '...',
        })),
        observaciones: ocrState.observaciones,
      });

      // Use new batch OCR endpoint (60-80% faster for multiple files)
      const files = ocrState.scannedFiles.map(file => ({
        uri: file.uri,
        filename: file.name,
        mimeType: file.mimeType,
      }));

      logger.debug('📤 Sending to OCR service:', {
        filesCount: files.length,
        hasObservaciones: !!ocrState.observaciones,
      });

      let data: any;
      let usedFallback = false;

      try {
        // Try batch processing first
        data = await purchasesService.scanDocuments(
          files,
          ocrState.observaciones || undefined
        );
      } catch (batchError: any) {
        logger.error('❌ Batch processing failed:', {
          error: batchError.message,
          isTimeout: batchError.isTimeout,
          status: batchError.status,
        });

        // If timeout error (524 or AbortError), fallback to sequential processing
        if (batchError.isTimeout || batchError.status === 524) {
          logger.debug('🔄 Falling back to sequential processing...');

          Alert.alert(
            'Procesamiento Lento',
            'El procesamiento por lotes tardó demasiado. Se procesarán los archivos uno por uno. Esto puede tomar más tiempo.',
            [{ text: 'Continuar' }]
          );

          usedFallback = true;

          // Use sequential processing with progress callback
          data = await purchasesService.scanDocumentsSequentially(
            files,
            ocrState.observaciones || undefined,
            (current, total, filename) => {
              updateOcrState({
                scanningProgress: { current, total, filename },
              });
            }
          );
        } else {
          // Re-throw non-timeout errors
          throw batchError;
        }
      }

      logger.debug('📥 OCR Response received:', {
        hasItems: !!data?.items,
        itemsCount: data?.items?.length || 0,
        archivos_procesados: data?.archivos_procesados,
        total_estimado: data?.total_estimado,
        observaciones: data?.observaciones,
        usedFallback,
      });

      // Validate response structure
      if (!data) {
        throw new Error('No se recibió respuesta del servidor');
      }

      if (!data.items || !Array.isArray(data.items)) {
        logger.error('Invalid response structure:', data);
        throw new Error('Respuesta inválida del servidor - formato incorrecto');
      }

      // Normalize scanned items using pure function
      const editableProducts = data.items.map(normalizeScannedProduct);

      logger.debug('📦 Products normalized:', {
        count: editableProducts.length,
        sample: editableProducts[0],
      });

      if (editableProducts.length === 0) {
        Alert.alert(
          'Sin productos',
          'No se detectaron productos en los documentos. Intenta con otras imágenes.'
        );
      }

      updateOcrState({
        products: editableProducts,
        scanResponse: data,
        scanning: false,
        scanningProgress: null,
      });

      logger.perf('Documents scanned successfully', startTime);
      logger.debug(`✅ Detected ${editableProducts.length} products from ${data.archivos_procesados} files`);

      // Show success message
      const processingMethod = usedFallback ? 'procesamiento secuencial' : 'procesamiento por lotes';
      Alert.alert(
        'Escaneo Exitoso',
        `Se detectaron ${editableProducts.length} productos de ${data.archivos_procesados} archivo(s) usando ${processingMethod}.\n\nTotal estimado: S/ ${data.total_estimado.toFixed(2)}`
      );

    } catch (error: any) {
      logger.error('❌ Error scanning documents:', {
        error: error.message,
        errorStack: error.stack,
        responseData: error?.response?.data,
        fileCount: ocrState.scannedFiles.length,
      });

      let errorMessage = 'No se pudo escanear los documentos';

      if (error?.response?.data?.error) {
        errorMessage = `Error OCR: ${error.response.data.error}`;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
      updateOcrState({
        scanning: false,
        scanningProgress: null,
      });
    }
  }, [ocrState.scannedFiles, ocrState.observaciones, updateOcrState]);

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permisos requeridos',
          'Se necesitan permisos para acceder a la galería de fotos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: true, // Enable multiple selection
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newFiles = result.assets.map((asset, index) => ({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}_${index}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
        }));

        // Add to existing files (max 10 total)
        const updatedFiles = [...ocrState.scannedFiles, ...newFiles].slice(0, 10);

        if (updatedFiles.length > ocrState.scannedFiles.length + newFiles.length) {
          Alert.alert('Límite alcanzado', 'Solo se pueden seleccionar hasta 10 archivos');
        }

        updateOcrState({ scannedFiles: updatedFiles });
        logger.debug(`📁 Added ${newFiles.length} files. Total: ${updatedFiles.length}`);
      }
    } catch (error) {
      logger.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  }, [ocrState.scannedFiles, updateOcrState]);

  const takePhoto = useCallback(async () => {
    try {
      if (ocrState.scannedFiles.length >= 10) {
        Alert.alert('Límite alcanzado', 'Ya tienes 10 archivos seleccionados');
        return;
      }

      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Permisos requeridos',
          'Se necesitan permisos para acceder a la cámara.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
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

        updateOcrState({
          scannedFiles: [...ocrState.scannedFiles, fileData]
        });
        logger.debug(`📸 Photo added. Total files: ${ocrState.scannedFiles.length + 1}`);
      }
    } catch (error) {
      logger.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  }, [ocrState.scannedFiles, updateOcrState]);

  const pickDocument = useCallback(async () => {
    try {
      if (ocrState.scannedFiles.length >= 10) {
        Alert.alert('Límite alcanzado', 'Ya tienes 10 archivos seleccionados');
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
        multiple: true, // Allow multiple selection
      });

      if (result.canceled) {
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const newFiles = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || 'application/pdf',
        }));

        // Add to existing files (max 10 total)
        const updatedFiles = [...ocrState.scannedFiles, ...newFiles].slice(0, 10);

        if (updatedFiles.length < ocrState.scannedFiles.length + newFiles.length) {
          Alert.alert('Límite alcanzado', 'Solo se pueden seleccionar hasta 10 archivos');
        }

        updateOcrState({ scannedFiles: updatedFiles });
        logger.debug(`📄 Added ${newFiles.length} documents. Total: ${updatedFiles.length}`);
      }
    } catch (error) {
      logger.error('Error picking document:', error);
      Alert.alert('Error', 'No se pudo seleccionar el documento');
    }
  }, [ocrState.scannedFiles, updateOcrState]);

  const removeFile = useCallback((index: number) => {
    const updatedFiles = ocrState.scannedFiles.filter((_, i) => i !== index);
    updateOcrState({ scannedFiles: updatedFiles });
    logger.debug(`🗑️ File removed. Total: ${updatedFiles.length}`);
  }, [ocrState.scannedFiles, updateOcrState]);

  const handleAddNewRow = useCallback(() => {
    const newProduct: EditableProduct = {
      id: `temp-${Date.now()}`,
      sku: '',
      nombre: '',
      cajas: 1,
      unidades_por_caja: 1,
      cantidad_total: 1,
      precio_unitario: 0,
      subtotal_fila: 0,
    };
    updateOcrState({
      products: [...ocrState.products, newProduct],
      editingProductId: newProduct.id,
    });
  }, [ocrState.products, updateOcrState]);

  const handleDeleteProduct = useCallback((productId: string) => {
    Alert.alert(
      'Confirmar',
      '¿Deseas eliminar este producto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            updateOcrState({
              products: ocrState.products.filter(p => p.id !== productId),
            });
          },
        },
      ]
    );
  }, [ocrState.products, updateOcrState]);

  const handleUpdateProduct = useCallback((productId: string, field: keyof EditableProduct, value: any) => {
    updateOcrState({
      products: ocrState.products.map(p => {
        if (p.id !== productId) return p;

        const updated = { ...p, [field]: value };

        // Validate and normalize numeric values
        if (['cajas', 'unidades_por_caja', 'cantidad_total', 'precio_unitario'].includes(field)) {
          const numValue = safeNumber(value, p[field as keyof EditableProduct] as number);
          updated[field as keyof EditableProduct] = Math.max(0, numValue) as any;
        }

        // Recalculate dependencies based on field changed
        if (field === 'cajas' || field === 'unidades_por_caja') {
          updated.cantidad_total = updated.cajas * updated.unidades_por_caja;
        }

        // Always recalculate subtotal when relevant fields change
        if (['cajas', 'unidades_por_caja', 'cantidad_total', 'precio_unitario'].includes(field)) {
          updated.subtotal_fila = calculateSubtotal(updated.cantidad_total, updated.precio_unitario);
        }

        return updated;
      }),
    });
  }, [ocrState.products, updateOcrState]);

  const handleConfirm = useCallback(() => {
    // Validate products using pure function
    const invalidProducts = ocrState.products.filter(p => !isValidProduct(p));

    if (invalidProducts.length > 0) {
      Alert.alert(
        'Validación',
        `${invalidProducts.length} producto(s) tienen datos inválidos. Todos los productos deben tener SKU, nombre, cantidad y precio válidos.`
      );
      return;
    }

    if (ocrState.products.length === 0) {
      Alert.alert('Validación', 'No hay productos para confirmar.');
      return;
    }

    logger.debug(`✅ Confirming ${ocrState.products.length} products`);
    onProductsConfirmed(ocrState.products);
    resetModal();
    onClose();
  }, [ocrState.products, onProductsConfirmed, resetModal, onClose]);

  const renderProductRow = useCallback((product: EditableProduct, index: number) => {
    const isEditing = ocrState.editingProductId === product.id;

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
              onChangeText={(value) => handleUpdateProduct(product.id, 'cajas', safeParseInt(value, 0))}
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
              onChangeText={(value) => handleUpdateProduct(product.id, 'unidades_por_caja', safeParseInt(value, 0))}
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
              onChangeText={(value) => handleUpdateProduct(product.id, 'cantidad_total', safeParseInt(value, 0))}
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
            <View style={[styles.fieldInput, isTablet && styles.fieldInputTablet, styles.fieldInputReadonly]}>
              <Text style={styles.fieldInputReadonlyText}>
                S/ {product.subtotal_fila !== null && product.subtotal_fila !== undefined && isFinite(product.subtotal_fila) && !isNaN(product.subtotal_fila) ? product.subtotal_fila.toFixed(2) : '0.00'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }, [ocrState.editingProductId, isTablet, handleUpdateProduct, handleDeleteProduct]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
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
                disabled={ocrState.scanning || ocrState.scannedFiles.length >= 10}
              >
                <Text style={styles.uploadButtonIcon}>📷</Text>
                <Text style={[styles.uploadButtonText, isTablet && styles.uploadButtonTextTablet]}>
                  Tomar Foto
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.uploadButton, isTablet && styles.uploadButtonTablet]}
                onPress={pickImage}
                disabled={ocrState.scanning || ocrState.scannedFiles.length >= 10}
              >
                <Text style={styles.uploadButtonIcon}>🖼️</Text>
                <Text style={[styles.uploadButtonText, isTablet && styles.uploadButtonTextTablet]}>
                  Galería
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.uploadButton, isTablet && styles.uploadButtonTablet]}
                onPress={pickDocument}
                disabled={ocrState.scanning || ocrState.scannedFiles.length >= 10}
              >
                <Text style={styles.uploadButtonIcon}>📄</Text>
                <Text style={[styles.uploadButtonText, isTablet && styles.uploadButtonTextTablet]}>
                  PDF/Excel
                </Text>
              </TouchableOpacity>
            </View>

            {/* Observaciones */}
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.fieldLabel, isTablet && styles.fieldLabelTablet]}>
                Observaciones (opcional)
              </Text>
              <TextInput
                style={[styles.fieldInput, isTablet && styles.fieldInputTablet, { minHeight: 60 }]}
                value={ocrState.observaciones}
                onChangeText={(value) => updateOcrState({ observaciones: value })}
                placeholder="Notas sobre los documentos..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Selected Files List */}
          {ocrState.scannedFiles.length > 0 && (
            <View style={styles.filesSection}>
              <View style={styles.filesSectionHeader}>
                <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                  Archivos Seleccionados ({ocrState.scannedFiles.length}/10)
                </Text>
                <TouchableOpacity
                  style={[styles.scanButton, ocrState.scanning && styles.scanButtonDisabled]}
                  onPress={scanDocuments}
                  disabled={ocrState.scanning}
                >
                  <Text style={styles.scanButtonText}>
                    {ocrState.scanning ? '⏳ Escaneando...' : '🚀 Escanear Documentos'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.filesList}>
                {ocrState.scannedFiles.map((file, index) => (
                  <View key={index} style={styles.fileItem}>
                    <View style={styles.fileInfo}>
                      <Text style={styles.fileIcon}>
                        {file.mimeType.startsWith('image/') ? '🖼️' :
                         file.mimeType === 'application/pdf' ? '📄' : '📊'}
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
                      disabled={ocrState.scanning}
                    >
                      <Text style={styles.removeFileButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Scanning Indicator */}
          {ocrState.scanning && (
            <View style={styles.scanningSection}>
              <ActivityIndicator size="large" color="#6366F1" />
              {ocrState.scanningProgress ? (
                <>
                  <Text style={[styles.scanningText, isTablet && styles.scanningTextTablet]}>
                    Procesando archivo {ocrState.scanningProgress.current} de {ocrState.scanningProgress.total}
                  </Text>
                  <Text style={[styles.scanningSubtext, isTablet && styles.scanningTextTablet]}>
                    {ocrState.scanningProgress.filename}
                  </Text>
                  <View style={styles.progressBarContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        { width: `${(ocrState.scanningProgress.current / ocrState.scanningProgress.total) * 100}%` }
                      ]}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.scanningText, isTablet && styles.scanningTextTablet]}>
                    Escaneando {ocrState.scannedFiles.length} documento(s)...
                  </Text>
                  <Text style={[styles.scanningSubtext, isTablet && styles.scanningTextTablet]}>
                    Esto puede tomar unos segundos
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Products List */}
          {ocrState.products.length > 0 && (
            <View style={styles.productsSection}>
              <View style={styles.productsSectionHeader}>
                <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                  Productos Detectados ({ocrState.products.length})
                </Text>
                <TouchableOpacity
                  style={styles.addRowButton}
                  onPress={handleAddNewRow}
                >
                  <Text style={styles.addRowButtonText}>+ Agregar Fila</Text>
                </TouchableOpacity>
              </View>

              {ocrState.scanResponse && (
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Archivos Procesados:</Text>
                    <Text style={styles.summaryValue}>
                      {ocrState.scanResponse.archivos_procesados}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Estimado:</Text>
                    <Text style={[styles.summaryValue, styles.summaryValueBold]}>
                      S/ {ocrState.scanResponse.total_estimado.toFixed(2)}
                    </Text>
                  </View>
                  {ocrState.scanResponse.observaciones && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Observaciones:</Text>
                      <Text style={styles.summaryValue}>
                        {ocrState.scanResponse.observaciones}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.productsList}>
                {ocrState.products.map((product, index) => renderProductRow(product, index))}
              </View>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Footer Actions */}
        {ocrState.products.length > 0 && (
          <View style={[styles.footer, isTablet && styles.footerTablet]}>
            <TouchableOpacity
              style={[styles.cancelButton, isTablet && styles.cancelButtonTablet]}
              onPress={handleClose}
              disabled={ocrState.loading}
            >
              <Text style={[styles.cancelButtonText, isTablet && styles.cancelButtonTextTablet]}>
                Cancelar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                isTablet && styles.confirmButtonTablet,
                ocrState.loading && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={ocrState.loading}
            >
              {ocrState.loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.confirmButtonText, isTablet && styles.confirmButtonTextTablet]}>
                  Confirmar {ocrState.products.length} Producto{ocrState.products.length !== 1 ? 's' : ''}
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
    backgroundColor: '#F8FAFC',
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
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  titleTablet: {
    fontSize: 24,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  subtitleTablet: {
    fontSize: 15,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  contentContainerTablet: {
    padding: 32,
  },
  uploadSection: {
    marginBottom: 24,
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
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  uploadButton: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  uploadButtonTablet: {
    padding: 32,
    borderRadius: 16,
  },
  uploadButtonIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366F1',
  },
  uploadButtonTextTablet: {
    fontSize: 17,
  },
  scanningSection: {
    alignItems: 'center',
    padding: 48,
  },
  scanningText: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 16,
    fontWeight: '600',
  },
  scanningTextTablet: {
    fontSize: 17,
  },
  scanningSubtext: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 8,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  filesSection: {
    marginBottom: 24,
  },
  filesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  scanButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#6366F1',
    borderRadius: 8,
  },
  scanButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  scanButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  filesList: {
    gap: 12,
  },
  fileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
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
    color: '#1E293B',
    marginBottom: 2,
  },
  fileType: {
    fontSize: 11,
    color: '#64748B',
    textTransform: 'uppercase',
  },
  removeFileButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeFileButtonText: {
    fontSize: 16,
    color: '#DC2626',
    fontWeight: '600',
  },
  productsSection: {
    marginBottom: 24,
  },
  productsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addRowButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#6366F1',
    borderRadius: 8,
  },
  addRowButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  summaryBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  summaryLabelWarning: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  summaryValueBold: {
    fontWeight: '700',
    fontSize: 16,
  },
  summaryValueWarning: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  productsList: {
    gap: 16,
  },
  productRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productRowTablet: {
    padding: 20,
  },
  productRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  productRowNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366F1',
  },
  productRowNumberTablet: {
    fontSize: 16,
  },
  deleteButton: {
    padding: 4,
  },
  deleteButtonText: {
    fontSize: 20,
  },
  productFields: {
    gap: 12,
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
    color: '#64748B',
    marginBottom: 6,
  },
  fieldLabelTablet: {
    fontSize: 14,
  },
  fieldInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1E293B',
  },
  fieldInputTablet: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  fieldInputReadonly: {
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
  },
  fieldInputReadonlyText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
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
  confirmButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  confirmButtonTablet: {
    paddingVertical: 16,
    borderRadius: 14,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  confirmButtonTextTablet: {
    fontSize: 17,
  },
});

export default OcrScannerModal;
