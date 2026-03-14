import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ValidacionSalida } from '@/types/repartos';
import { repartosService, productsApi } from '@/services/api';
import { Product } from '@/services/api/products';
import logger from '@/utils/logger';

interface ValidacionDetailModalProps {
  visible: boolean;
  repartoProductoId?: string;
  validacion?: ValidacionSalida | null;
  onClose: () => void;
}

export const ValidacionDetailModal: React.FC<ValidacionDetailModalProps> = ({
  visible,
  repartoProductoId,
  validacion: validacionProp,
  onClose,
}) => {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const [validacion, setValidacion] = useState<ValidacionSalida | null>(validacionProp || null);
  const [loading, setLoading] = useState(false);
  const [productPhotos, setProductPhotos] = useState<string[]>([]);

  // Fetch validation data when modal opens with repartoProductoId
  useEffect(() => {
    if (visible && repartoProductoId && !validacionProp) {
      loadValidacion();
    } else if (validacionProp) {
      // ✅ Normalizar URLs también cuando se pasa validacionProp
      // Las fotos están en /files/private/ y las firmas en /public/
      const normalizedData = {
        ...validacionProp,
        photoUrl: validacionProp.photoUrl?.startsWith('http')
          ? validacionProp.photoUrl
          : validacionProp.photoUrl
          ? `https://api.app-joanis-backend.com/files/private/CAMPAIGNS_REPARTOS_VALIDACIONES_FOTOS/${validacionProp.photoUrl.split('/').slice(-3).join('/')}`
          : validacionProp.photoUrl,
        signatureUrl: validacionProp.signatureUrl?.startsWith('http')
          ? validacionProp.signatureUrl
          : validacionProp.signatureUrl
          ? `https://api.app-joanis-backend.com/public/${validacionProp.signatureUrl}`
          : validacionProp.signatureUrl,
      } as ValidacionSalida;
      setValidacion(normalizedData);
    }
  }, [visible, repartoProductoId, validacionProp]);

  const loadValidacion = async () => {
    if (!repartoProductoId) {
      return;
    }

    setLoading(true);
    try {
      const data = await repartosService.getValidacion(repartoProductoId);
      console.log('📸 Validacion data loaded:', {
        hasData: !!data,
        hasPhotoUrl: !!data?.photoUrl,
        hasSignatureUrl: !!data?.signatureUrl,
        photoUrl: data?.photoUrl,
        signatureUrl: data?.signatureUrl,
      });
      if (data) {
        // ✅ Normalizar URLs: Si photoUrl es relativa, construir URL completa
        // Las fotos están en /files/private/ y las firmas en /public/
        const normalizedData = {
          ...data,
          photoUrl: data.photoUrl?.startsWith('http')
            ? data.photoUrl
            : data.photoUrl
            ? `https://api.app-joanis-backend.com/files/private/CAMPAIGNS_REPARTOS_VALIDACIONES_FOTOS/${data.photoUrl.split('/').slice(-3).join('/')}`
            : data.photoUrl,
          signatureUrl: data.signatureUrl?.startsWith('http')
            ? data.signatureUrl
            : data.signatureUrl
            ? `https://api.app-joanis-backend.com/public/${data.signatureUrl}`
            : data.signatureUrl,
        } as ValidacionSalida;
        console.log('📸 Normalized URLs:', {
          photoUrl: normalizedData.photoUrl,
          signatureUrl: normalizedData.signatureUrl,
        });
        setValidacion(normalizedData);

        // ✅ Cargar fotos del producto
        if (data.repartoProducto?.productId) {
          try {
            console.log(`📸 Cargando fotos del producto ${data.repartoProducto.productId}...`);
            const batchResponse = await productsApi.getProductsByIds([data.repartoProducto.productId], true);
            console.log(`📸 Batch response:`, batchResponse);
            if (batchResponse.products.length > 0) {
              const product = batchResponse.products[0];
              // ✅ El backend puede devolver 'photos' o 'photoUrls'
              const productPhotos = (product as any).photos || (product as any).photoUrls || [];
              console.log(`📸   - product.photos:`, (product as any).photos);
              console.log(`📸   - product.photoUrls:`, (product as any).photoUrls);
              console.log(`📸 Fotos encontradas:`, productPhotos);
              if (productPhotos.length > 0) {
                setProductPhotos(productPhotos);
                console.log(`✅ Fotos del producto cargadas: ${productPhotos.length}`);
              } else {
                console.log('⚠️ No se encontraron fotos para el producto');
              }
            } else {
              console.log('⚠️ No se encontró el producto en la respuesta');
            }
          } catch (photoError: any) {
            console.error('❌ Error cargando fotos del producto:', photoError);
            console.error('❌ Error stack:', photoError.stack);
            // No bloquear si falla la carga de fotos
          }
        }
      } else {
        Alert.alert('Error', 'No se encontró información de validación');
        onClose();
      }
    } catch (error: any) {
      console.error('Error loading validacion:', error);
      Alert.alert('Error', 'No se pudo cargar la información de validación');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!validacion && !loading) {
    return null;
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return 'N/A';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, isTablet && styles.modalTitleTablet]}>
              Detalles de Validación
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Loading State */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.loadingText}>Cargando validación...</Text>
            </View>
          ) : validacion ? (
            <>
              {/* Content */}
              <ScrollView style={styles.modalBody}>
                {/* Validation Info */}
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                    Información de Validación
                  </Text>

                  {/* Si fue validado por presentación, mostrar presentaciones primero */}
                  {validacion.validatedPresentationQuantity !== undefined &&
                   validacion.validatedPresentationQuantity > 0 && (
                    <>
                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                          Cantidad en Presentación:
                        </Text>
                        <Text
                          style={[
                            styles.infoValue,
                            styles.highlightValue,
                            isTablet && styles.infoValueTablet,
                          ]}
                        >
                          {validacion.validatedPresentationQuantity}{' '}
                          {validacion.presentationInfo?.largestPresentation?.name || 'presentaciones'}
                        </Text>
                      </View>

                      {validacion.validatedLooseUnits !== undefined &&
                       validacion.validatedLooseUnits > 0 && (
                        <View style={styles.infoRow}>
                          <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                            Unidades Sueltas:
                          </Text>
                          <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                            {validacion.validatedLooseUnits} unidades
                          </Text>
                        </View>
                      )}

                      <View style={styles.infoRow}>
                        <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                          Total en Unidades:
                        </Text>
                        <Text
                          style={[
                            styles.infoValue,
                            styles.secondaryValue,
                            isTablet && styles.infoValueTablet,
                          ]}
                        >
                          {validacion.validatedQuantity || validacion.validatedQuantityBase} unidades
                        </Text>
                      </View>

                      {validacion.presentationInfo?.largestPresentation && (
                        <View style={styles.infoRow}>
                          <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                            Factor de Conversión:
                          </Text>
                          <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                            1 {validacion.presentationInfo.largestPresentation.name} ={' '}
                            {validacion.presentationInfo.largestPresentation.factorToBase} unidades
                          </Text>
                        </View>
                      )}
                    </>
                  )}

                  {/* Si fue validado solo por unidades */}
                  {(!validacion.validatedPresentationQuantity ||
                    validacion.validatedPresentationQuantity === 0) && (
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                        Cantidad Validada:
                      </Text>
                      <Text
                        style={[
                          styles.infoValue,
                          styles.highlightValue,
                          isTablet && styles.infoValueTablet,
                        ]}
                      >
                        {validacion.validatedQuantity || validacion.validatedQuantityBase} unidades
                      </Text>
                    </View>
                  )}

                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                      Validado por:
                    </Text>
                    <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                      {validacion.validator?.name ||
                        validacion.validatedByName ||
                        validacion.validator?.email ||
                        'N/A'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                      Fecha de Validación:
                    </Text>
                    <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                      {formatDate(validacion.validatedAt)}
                    </Text>
                  </View>

                  {validacion.notes && (
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                        Notas:
                      </Text>
                      <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                        {validacion.notes}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Product Photo */}
                {productPhotos.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                      Foto del Producto
                    </Text>
                    <View style={styles.imageContainer}>
                      <Image
                        source={{ uri: productPhotos[0] }}
                        style={styles.image}
                        resizeMode="contain"
                        onLoadStart={() => console.log('📸 Product photo loading started')}
                        onLoad={() => console.log('📸 Product photo loaded successfully')}
                        onError={(error) => console.error('📸 Product photo load error:', error.nativeEvent)}
                      />
                    </View>
                  </View>
                )}

                {/* Photo */}
                {validacion.photoUrl && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                      Foto de Validación
                    </Text>
                    <View style={styles.imageContainer}>
                      <Image
                        source={{ uri: validacion.photoUrl }}
                        style={styles.image}
                        resizeMode="contain"
                        onLoadStart={() => console.log('📸 Photo loading started')}
                        onLoad={() => console.log('📸 Photo loaded successfully')}
                        onError={(error) => console.error('📸 Photo load error:', error.nativeEvent)}
                      />
                    </View>
                  </View>
                )}

                {/* Signature */}
                {validacion.signatureUrl && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
                      Firma de Validación
                    </Text>
                    <View style={styles.imageContainer}>
                      <Image
                        source={{ uri: validacion.signatureUrl }}
                        style={styles.signatureImage}
                        resizeMode="contain"
                        onLoadStart={() => console.log('✍️ Signature loading started')}
                        onLoad={() => console.log('✍️ Signature loaded successfully')}
                        onError={(error) => console.error('✍️ Signature load error:', error.nativeEvent)}
                      />
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[styles.closeFooterButton, isTablet && styles.closeFooterButtonTablet]}
                  onPress={onClose}
                >
                  <Text
                    style={[
                      styles.closeFooterButtonText,
                      isTablet && styles.closeFooterButtonTextTablet,
                    ]}
                  >
                    Cerrar
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContentTablet: {
    width: '70%',
    maxWidth: 800,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalTitleTablet: {
    fontSize: 24,
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
  modalBody: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
  },
  sectionTitleTablet: {
    fontSize: 18,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    width: 150,
  },
  infoLabelTablet: {
    fontSize: 16,
    width: 180,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
  },
  infoValueTablet: {
    fontSize: 16,
  },
  highlightValue: {
    color: '#10B981',
    fontWeight: '600',
  },
  secondaryValue: {
    color: '#64748B',
    fontWeight: '500',
  },
  imageContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  image: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },
  signatureImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  closeFooterButton: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeFooterButtonTablet: {
    paddingVertical: 16,
  },
  closeFooterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeFooterButtonTextTablet: {
    fontSize: 18,
  },
});
