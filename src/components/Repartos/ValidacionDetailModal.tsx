/**
 * ValidacionDetailModal - Modal de detalles de validación
 * Migrado al Design System unificado
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { ValidacionSalida } from '@/types/repartos';
import { repartosService, productsApi } from '@/services/api';
import { Product } from '@/services/api/products';
import logger from '@/utils/logger';
import { ImageViewerModal } from '@/components/Expenses/ImageViewerModal';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import {
  Title,
  Body,
  Label,
  Caption,
  Button,
  IconButton,
} from '@/design-system';

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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;
  const [validacion, setValidacion] = useState<ValidacionSalida | null>(validacionProp || null);
  const [loading, setLoading] = useState(false);
  const [productPhotos, setProductPhotos] = useState<string[]>([]);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

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
            <Title>Detalles de Validación</Title>
            <IconButton
              icon="close"
              variant="ghost"
              size="small"
              onPress={onClose}
            />
          </View>

          {/* Loading State */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.color.brand.accent} />
              <Body color="secondary" style={{ marginTop: theme.space[3] }}>
                Cargando validación...
              </Body>
            </View>
          ) : validacion ? (
            <>
              {/* Content */}
              <ScrollView style={styles.modalBody}>
                {/* Validation Info */}
                <View style={styles.section}>
                  <Label style={{ marginBottom: theme.space[3] }}>
                    Información de Validación
                  </Label>

                  {/* Si fue validado por presentación, mostrar presentaciones primero */}
                  {validacion.validatedPresentationQuantity !== undefined &&
                   validacion.validatedPresentationQuantity > 0 && (
                    <>
                      <View style={styles.infoRow}>
                        <Caption style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                          Cantidad en Presentación:
                        </Caption>
                        <Body style={{ flex: 1, color: theme.color.text.success }}>
                          {validacion.validatedPresentationQuantity}{' '}
                          {validacion.presentationInfo?.largestPresentation?.name || 'presentaciones'}
                        </Body>
                      </View>

                      {validacion.validatedLooseUnits !== undefined &&
                       validacion.validatedLooseUnits > 0 && (
                        <View style={styles.infoRow}>
                          <Caption style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                            Unidades Sueltas:
                          </Caption>
                          <Body style={{ flex: 1 }}>
                            {validacion.validatedLooseUnits} unidades
                          </Body>
                        </View>
                      )}

                      <View style={styles.infoRow}>
                        <Caption style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                          Total en Unidades:
                        </Caption>
                        <Body color="secondary" style={{ flex: 1 }}>
                          {validacion.validatedQuantity || validacion.validatedQuantityBase} unidades
                        </Body>
                      </View>

                      {validacion.presentationInfo?.largestPresentation && (
                        <View style={styles.infoRow}>
                          <Caption style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                            Factor de Conversión:
                          </Caption>
                          <Body style={{ flex: 1 }}>
                            1 {validacion.presentationInfo.largestPresentation.name} ={' '}
                            {validacion.presentationInfo.largestPresentation.factorToBase} unidades
                          </Body>
                        </View>
                      )}
                    </>
                  )}

                  {/* Si fue validado solo por unidades */}
                  {(!validacion.validatedPresentationQuantity ||
                    validacion.validatedPresentationQuantity === 0) && (
                    <View style={styles.infoRow}>
                      <Caption style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                        Cantidad Validada:
                      </Caption>
                      <Body style={{ flex: 1, color: theme.color.text.success }}>
                        {validacion.validatedQuantity || validacion.validatedQuantityBase} unidades
                      </Body>
                    </View>
                  )}

                  <View style={styles.infoRow}>
                    <Caption style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                      Validado por:
                    </Caption>
                    <Body style={{ flex: 1 }}>
                      {validacion.validator?.name ||
                        validacion.validatedByName ||
                        validacion.validator?.email ||
                        'N/A'}
                    </Body>
                  </View>

                  <View style={styles.infoRow}>
                    <Caption style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                      Fecha de Validación:
                    </Caption>
                    <Body style={{ flex: 1 }}>
                      {formatDate(validacion.validatedAt)}
                    </Body>
                  </View>

                  {validacion.notes && (
                    <View style={styles.infoRow}>
                      <Caption style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                        Notas:
                      </Caption>
                      <Body style={{ flex: 1 }}>
                        {validacion.notes}
                      </Body>
                    </View>
                  )}
                </View>

                {/* Product Photo */}
                {productPhotos.length > 0 && (
                  <View style={styles.section}>
                    <Label style={{ marginBottom: theme.space[3] }}>
                      Foto del Producto
                    </Label>
                    <TouchableOpacity
                      style={styles.imageContainer}
                      onPress={() => {
                        setSelectedImageUrl(productPhotos[0]);
                        setImageViewerVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{ uri: productPhotos[0] }}
                        style={styles.image}
                        resizeMode="contain"
                        onLoadStart={() => console.log('📸 Product photo loading started')}
                        onLoad={() => console.log('📸 Product photo loaded successfully')}
                        onError={(error) => console.error('📸 Product photo load error:', error.nativeEvent)}
                      />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Photo */}
                {validacion.photoUrl && (
                  <View style={styles.section}>
                    <Label style={{ marginBottom: theme.space[3] }}>
                      Foto de Validación
                    </Label>
                    <TouchableOpacity
                      style={styles.imageContainer}
                      onPress={() => {
                        setSelectedImageUrl(validacion.photoUrl!);
                        setImageViewerVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{ uri: validacion.photoUrl }}
                        style={styles.image}
                        resizeMode="contain"
                        onLoadStart={() => console.log('📸 Photo loading started')}
                        onLoad={() => console.log('📸 Photo loaded successfully')}
                        onError={(error) => console.error('📸 Photo load error:', error.nativeEvent)}
                      />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Signature */}
                {validacion.signatureUrl && (
                  <View style={styles.section}>
                    <Label style={{ marginBottom: theme.space[3] }}>
                      Firma de Validación
                    </Label>
                    <TouchableOpacity
                      style={styles.imageContainer}
                      onPress={() => {
                        setSelectedImageUrl(validacion.signatureUrl!);
                        setImageViewerVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{ uri: validacion.signatureUrl }}
                        style={styles.signatureImage}
                        resizeMode="contain"
                        onLoadStart={() => console.log('✍️ Signature loading started')}
                        onLoad={() => console.log('✍️ Signature loaded successfully')}
                        onError={(error) => console.error('✍️ Signature load error:', error.nativeEvent)}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={styles.modalFooter}>
                <Button
                  title="Cerrar"
                  variant="primary"
                  onPress={onClose}
                  fullWidth
                />
              </View>
            </>
          ) : null}
        </View>
      </View>

      {/* Image Viewer Modal */}
      <ImageViewerModal
        visible={imageViewerVisible}
        imageUrl={selectedImageUrl}
        onClose={() => {
          setImageViewerVisible(false);
          setSelectedImageUrl(null);
        }}
      />
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[10],
    },
    loadingText: {
      marginTop: theme.space[3],
      fontSize: 16,
      color: theme.color.text.muted,
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      width: '90%',
      maxHeight: '85%',
      ...theme.shadow.lg,
    },
    modalContentTablet: {
      width: '70%',
      maxWidth: 800,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    modalBody: {
      padding: theme.space[5],
    },
    section: {
      marginBottom: theme.space[6],
    },
    infoRow: {
      flexDirection: 'row',
      paddingVertical: theme.space[2.5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.background.subtle,
    },
    infoLabel: {
      width: 150,
    },
    infoLabelTablet: {
      width: 180,
    },
    imageContainer: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    image: {
      width: '100%',
      height: 300,
      borderRadius: theme.radii.lg,
    },
    signatureImage: {
      width: '100%',
      height: 200,
      borderRadius: theme.radii.lg,
    },
    modalFooter: {
      padding: theme.space[5],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
  });
