import React, { useState } from 'react';
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

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

export const OcrScannerModal: React.FC<OcrScannerModalProps> = ({
  visible,
  onClose,
  onProductsConfirmed,
  purchaseId,
}) => {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [products, setProducts] = useState<EditableProduct[]>([]);
  const [scanResponse, setScanResponse] = useState<OcrScanResponse | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  const resetModal = () => {
    setScannedImage(null);
    setProducts([]);
    setScanResponse(null);
    setEditingProductId(null);
    setLoading(false);
    setScanning(false);
  };

  const handleClose = () => {
    if (products.length > 0) {
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
  };

  const pickImage = async () => {
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
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setScannedImage(asset.uri);
        if (asset.base64) {
          await scanDocument(asset.base64);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const takePhoto = async () => {
    try {
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
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setScannedImage(asset.uri);
        if (asset.base64) {
          await scanDocument(asset.base64);
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const scanDocument = async (base64Image: string) => {
    setScanning(true);
    try {
      const imageBase64 = `data:image/jpeg;base64,${base64Image}`;

      // Import purchasesService dynamically to avoid circular dependencies
      const { purchasesService } = await import('@/services/api');
      const data = await purchasesService.scanDocument(imageBase64);
      setScanResponse(data);

      // Convert scanned items to editable products
      const editableProducts: EditableProduct[] = data.items.map((item, index) => ({
        id: `temp-${Date.now()}-${index}`,
        sku: item.sku,
        nombre: item.nombre,
        cajas: item.cajas,
        unidades_por_caja: item.unidades_por_caja,
        cantidad_total: item.cantidad_total,
        precio_unitario: item.precio_unitario,
        subtotal_fila: item.subtotal_fila,
      }));

      setProducts(editableProducts);
    } catch (error: any) {
      console.error('Error scanning document:', error);
      Alert.alert('Error', error.message || 'No se pudo escanear el documento');
      setScannedImage(null);
    } finally {
      setScanning(false);
    }
  };

  const handleAddNewRow = () => {
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
    setProducts([...products, newProduct]);
    setEditingProductId(newProduct.id);
  };

  const handleDeleteProduct = (productId: string) => {
    Alert.alert(
      'Confirmar',
      '¿Deseas eliminar este producto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setProducts(products.filter(p => p.id !== productId));
          },
        },
      ]
    );
  };

  const handleUpdateProduct = (productId: string, field: keyof EditableProduct, value: any) => {
    setProducts(products.map(p => {
      if (p.id === productId) {
        const updated = { ...p, [field]: value };

        // Recalculate cantidad_total and subtotal_fila
        if (field === 'cajas' || field === 'unidades_por_caja') {
          updated.cantidad_total = updated.cajas * updated.unidades_por_caja;
          updated.subtotal_fila = updated.cantidad_total * updated.precio_unitario;
        } else if (field === 'precio_unitario') {
          updated.subtotal_fila = updated.cantidad_total * updated.precio_unitario;
        } else if (field === 'cantidad_total') {
          updated.subtotal_fila = updated.cantidad_total * updated.precio_unitario;
        }

        return updated;
      }
      return p;
    }));
  };

  const handleConfirm = () => {
    // Validate products
    const invalidProducts = products.filter(p =>
      !p.sku.trim() || !p.nombre.trim() || p.cantidad_total <= 0 || p.precio_unitario <= 0
    );

    if (invalidProducts.length > 0) {
      Alert.alert(
        'Validación',
        'Todos los productos deben tener SKU, nombre, cantidad y precio válidos.'
      );
      return;
    }

    onProductsConfirmed(products);
    resetModal();
    onClose();
  };

  const renderProductRow = (product: EditableProduct, index: number) => {
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
              onChangeText={(value) => handleUpdateProduct(product.id, 'cajas', parseInt(value) || 0)}
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
              onChangeText={(value) => handleUpdateProduct(product.id, 'unidades_por_caja', parseInt(value) || 0)}
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
              onChangeText={(value) => handleUpdateProduct(product.id, 'cantidad_total', parseInt(value) || 0)}
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
              onChangeText={(value) => handleUpdateProduct(product.id, 'precio_unitario', parseFloat(value) || 0)}
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
                S/ {product.subtotal_fila.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

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
          {/* Image Upload Section */}
          {!scannedImage && (
            <View style={styles.uploadSection}>
              <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                Subir Documento
              </Text>
              <View style={styles.uploadButtons}>
                <TouchableOpacity
                  style={[styles.uploadButton, isTablet && styles.uploadButtonTablet]}
                  onPress={takePhoto}
                  disabled={scanning}
                >
                  <Text style={styles.uploadButtonIcon}>📷</Text>
                  <Text style={[styles.uploadButtonText, isTablet && styles.uploadButtonTextTablet]}>
                    Tomar Foto
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.uploadButton, isTablet && styles.uploadButtonTablet]}
                  onPress={pickImage}
                  disabled={scanning}
                >
                  <Text style={styles.uploadButtonIcon}>🖼️</Text>
                  <Text style={[styles.uploadButtonText, isTablet && styles.uploadButtonTextTablet]}>
                    Galería
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Scanning Indicator */}
          {scanning && (
            <View style={styles.scanningSection}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={[styles.scanningText, isTablet && styles.scanningTextTablet]}>
                Escaneando documento...
              </Text>
            </View>
          )}

          {/* Scanned Image Preview */}
          {scannedImage && !scanning && (
            <View style={styles.imagePreviewSection}>
              <View style={styles.imagePreviewHeader}>
                <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                  Documento Escaneado
                </Text>
                <TouchableOpacity
                  style={styles.rescanButton}
                  onPress={() => {
                    setScannedImage(null);
                    setProducts([]);
                    setScanResponse(null);
                  }}
                >
                  <Text style={styles.rescanButtonText}>🔄 Reescanear</Text>
                </TouchableOpacity>
              </View>
              <Image
                source={{ uri: scannedImage }}
                style={styles.imagePreview}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Products List */}
          {products.length > 0 && (
            <View style={styles.productsSection}>
              <View style={styles.productsSectionHeader}>
                <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                  Productos Detectados ({products.length})
                </Text>
                <TouchableOpacity
                  style={styles.addRowButton}
                  onPress={handleAddNewRow}
                >
                  <Text style={styles.addRowButtonText}>+ Agregar Fila</Text>
                </TouchableOpacity>
              </View>

              {scanResponse && (
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal Calculado:</Text>
                    <Text style={styles.summaryValue}>
                      S/ {scanResponse.subtotal_documento_calculado.toFixed(2)}
                    </Text>
                  </View>
                  {scanResponse.subtotal_documento_impreso !== null && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Subtotal Documento:</Text>
                      <Text style={styles.summaryValue}>
                        S/ {scanResponse.subtotal_documento_impreso.toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {scanResponse.igv_impreso !== null && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>IGV:</Text>
                      <Text style={styles.summaryValue}>
                        S/ {scanResponse.igv_impreso.toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {scanResponse.total_documento_impreso !== null && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Total:</Text>
                      <Text style={[styles.summaryValue, styles.summaryValueBold]}>
                        S/ {scanResponse.total_documento_impreso.toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {scanResponse.diferencia_subtotal !== null && scanResponse.diferencia_subtotal !== 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, styles.summaryLabelWarning]}>
                        Diferencia:
                      </Text>
                      <Text style={[styles.summaryValue, styles.summaryValueWarning]}>
                        S/ {scanResponse.diferencia_subtotal.toFixed(2)}
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
                Cancelar
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
                <Text style={[styles.confirmButtonText, isTablet && styles.confirmButtonTextTablet]}>
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
  },
  uploadButton: {
    flex: 1,
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
  },
  scanningTextTablet: {
    fontSize: 17,
  },
  imagePreviewSection: {
    marginBottom: 24,
  },
  imagePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rescanButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  rescanButtonText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
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
