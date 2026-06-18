/**
 * ValidacionSalidaModal - Modal de validación de salida
 * Migrado al Design System unificado
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  useWindowDimensions,
} from 'react-native';
import { PhotoCapture } from './PhotoCapture';
import { SignatureCapture } from './SignatureCapture';
import { filesApi } from '@/services/api/files';
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
  Input,
} from '@/design-system';

interface PresentationInfo {
  hasPresentations: boolean;
  largestFactor: number;
  largestPresentation: {
    id: string;
    name: string;
    factorToBase: number;
    description?: string;
  } | null;
  totalPresentations: number;
  roundingApplied: boolean;
  roundingMethod: string;
}

interface ValidacionSalidaModalProps {
  visible: boolean;
  producto: {
    id: string;
    repartoId: string; // ✅ Necesario para subir archivos al servidor
    presentationId?: string;
    factorToBase?: number;
    presentationInfo?: PresentationInfo;
    product?: {
      id: string; // ✅ ID del producto para subir foto al catálogo
      title: string;
      sku: string;
      photos?: string[]; // ✅ NUEVO: Fotos del producto
      presentations?: Array<{
        id: string;
        presentationId: string;
        factorToBase: number;
        isBase: boolean;
        presentation: {
          id: string;
          code: string;
          name: string;
        };
      }>;
    };
    quantityBase: string;
    quantityAssigned?: number;
  } | null;
  onClose: () => void;
  onValidate: (data: {
    validatedQuantityBase: string; // ✅ Backend espera string, no number
    photoUrl: string;
    signatureUrl: string;
    notes?: string;
    // ✅ NUEVO: Información de presentaciones
    presentations?: Array<{
      presentationId: string;
      factorToBase: number;
      notes?: string;
    }>;
    validatedPresentationQuantity?: number;
    validatedLooseUnits?: number;
  }) => Promise<void>;
}

type Step = 'form' | 'photo' | 'signature';

export const ValidacionSalidaModal: React.FC<ValidacionSalidaModalProps> = ({
  visible,
  producto,
  onClose,
  onValidate,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [step, setStep] = useState<Step>('form');
  const [validatedQuantity, setValidatedQuantity] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [signatureUri, setSignatureUri] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Presentation states
  const [usePresentation, setUsePresentation] = useState(false);
  const [selectedPresentationId, setSelectedPresentationId] = useState<string | null>(null);
  const [selectedPresentation, setSelectedPresentation] = useState<any | null>(null);

  // Image viewer states
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const hasPresentations =
    producto?.product?.presentations && producto.product.presentations.length > 0;

  React.useEffect(() => {
    if (visible && producto) {
      const assignedQty = producto.quantityAssigned || parseFloat(producto.quantityBase) || 0;

      console.log('🔍 ValidacionSalidaModal - Producto recibido:', {
        presentationInfo: producto.presentationInfo,
        presentationId: producto.presentationId,
        factorToBase: producto.factorToBase,
        hasPresentations,
        presentations: producto.product?.presentations,
      });

      setPhotoUri(undefined);
      setSignatureUri(undefined);
      setNotes('');
      setStep('form');

      // Detectar si el producto fue distribuido por presentación usando presentationInfo
      const wasDistributedByPresentation =
        producto.presentationInfo?.roundingApplied ||
        (!!producto.presentationId && !!producto.factorToBase);

      console.log(
        '🔍 ValidacionSalidaModal - wasDistributedByPresentation:',
        wasDistributedByPresentation
      );

      if (wasDistributedByPresentation && hasPresentations) {
        // Producto distribuido por presentación - iniciar en modo presentación
        let distributedPresentation = null;

        // Intentar usar presentationInfo primero
        if (producto.presentationInfo?.largestPresentation) {
          distributedPresentation = producto.product!.presentations!.find(
            (p) =>
              p.presentation.name === producto.presentationInfo!.largestPresentation!.name ||
              p.factorToBase === producto.presentationInfo!.largestFactor
          );
        }

        // Fallback a presentationId si existe
        if (!distributedPresentation && producto.presentationId) {
          distributedPresentation = producto.product!.presentations!.find(
            (p) => p.presentationId === producto.presentationId
          );
        }

        if (distributedPresentation) {
          setUsePresentation(true);
          setSelectedPresentationId(distributedPresentation.presentationId);
          setSelectedPresentation(distributedPresentation);

          // Convertir cantidad asignada a presentación
          const quantityInPresentation = assignedQty / distributedPresentation.factorToBase;
          setValidatedQuantity(quantityInPresentation.toFixed(2));
        } else {
          // Fallback a unidades si no se encuentra la presentación
          setUsePresentation(false);
          setSelectedPresentationId(null);
          setSelectedPresentation(null);
          setValidatedQuantity(assignedQty.toString());
        }
      } else {
        // Producto distribuido por unidad - iniciar en modo unidad
        setUsePresentation(false);
        setValidatedQuantity(assignedQty.toString());

        // Set default presentation to base if available (para permitir cambio a presentación)
        if (hasPresentations) {
          const basePresentation = producto.product!.presentations!.find((p) => p.isBase);
          if (basePresentation) {
            setSelectedPresentationId(basePresentation.presentationId);
            setSelectedPresentation(basePresentation);
          }
        } else {
          setSelectedPresentationId(null);
          setSelectedPresentation(null);
        }
      }
    }
  }, [visible, producto, hasPresentations]);

  const handlePhotoCapture = (uri: string) => {
    console.log('📸 Photo captured in modal:', uri);
    setPhotoUri(uri);
    setStep('form');
    console.log('✅ Photo URI set, returning to form');
  };

  const handleSignatureCapture = (signature: string) => {
    setSignatureUri(signature);
    setStep('form');
  };

  // Helper functions for presentation conversion
  const calculateQuantityInPresentation = (quantityBase: number): number => {
    if (!selectedPresentation || selectedPresentation.factorToBase <= 0) {
      return quantityBase;
    }
    return quantityBase / selectedPresentation.factorToBase;
  };

  const calculateQuantityInBase = (quantityPresentation: number): number => {
    if (!selectedPresentation || selectedPresentation.factorToBase <= 0) {
      return quantityPresentation;
    }
    return quantityPresentation * selectedPresentation.factorToBase;
  };

  const handlePresentationChange = (presentationId: string) => {
    const presentation = producto?.product?.presentations?.find(
      (p) => p.presentationId === presentationId
    );
    if (presentation) {
      const previousPresentation = selectedPresentation;
      setSelectedPresentationId(presentationId);
      setSelectedPresentation(presentation);

      // Convert current quantity to new presentation
      if (usePresentation && validatedQuantity) {
        const currentQty = parseFloat(validatedQuantity) || 0;
        // La cantidad actual está expresada en la presentación anterior:
        // primero convertir a unidades base y luego a la nueva presentación.
        const previousFactor =
          previousPresentation && previousPresentation.factorToBase > 0
            ? previousPresentation.factorToBase
            : 1;
        const currentBase = currentQty * previousFactor;
        const newPresentationQty =
          presentation.factorToBase > 0 ? currentBase / presentation.factorToBase : currentBase;
        setValidatedQuantity(newPresentationQty.toFixed(2));
      }
    }
  };

  const handleQuantityChange = (text: string) => {
    setValidatedQuantity(text);
  };

  const getQuantityInBase = (): number => {
    const qty = parseFloat(validatedQuantity) || 0;
    if (usePresentation && selectedPresentation) {
      return calculateQuantityInBase(qty);
    }
    return qty;
  };

  const handleValidate = async () => {
    if (!producto) {
      Alert.alert('Error', 'No se encontró información del producto');
      return;
    }

    const quantityInBase = getQuantityInBase();
    const assignedQuantity = producto.quantityAssigned || parseFloat(producto.quantityBase || '0');

    if (isNaN(quantityInBase) || quantityInBase < 0) {
      Alert.alert('Error', 'Por favor ingresa una cantidad válida');
      return;
    }

    // ✅ PERMITIDO: La cantidad validada puede ser mayor a la asignada
    // if (quantityInBase > assignedQuantity) {
    //   Alert.alert('Error', 'La cantidad validada no puede ser mayor a la asignada');
    //   return;
    // }

    if (usePresentation && !selectedPresentationId) {
      Alert.alert('Error', 'Por favor selecciona una presentación');
      return;
    }

    if (!photoUri) {
      Alert.alert('Error', 'Por favor toma una foto del producto');
      return;
    }

    if (!signatureUri) {
      Alert.alert('Error', 'Por favor captura la firma del supervisor');
      return;
    }

    setLoading(true);
    try {
      // ✅ PASO 1: Subir foto de validación al servidor
      logger.info('📸 Subiendo foto de validación al servidor...');
      const photoFilename = `photo_${producto.id}_${Date.now()}.jpg`;
      const photoUploadResult = await filesApi.uploadByCategory(
        photoUri,
        photoFilename,
        'CAMPAIGNS_REPARTOS_VALIDACIONES_FOTOS',
        producto.repartoId || undefined, // ✅ repartoId es opcional
        'image/jpeg'
      );
      logger.info('✅ Foto de validación subida:', photoUploadResult.url);

      // ✅ PASO 2: Subir firma al servidor
      logger.info('✍️ Subiendo firma de validación al servidor...');
      const signatureFilename = `signature_${producto.id}_${Date.now()}.png`;
      const signatureUploadResult = await filesApi.uploadByCategory(
        signatureUri,
        signatureFilename,
        'CAMPAIGNS_REPARTOS_VALIDACIONES_FIRMAS',
        producto.repartoId || undefined, // ✅ repartoId es opcional
        'image/png'
      );
      logger.info('✅ Firma subida:', signatureUploadResult.url);

      // ✅ PASO 3: Construir datos de validación con URLs del servidor
      const validationData: any = {
        validatedQuantityBase: String(quantityInBase), // ✅ Backend espera validatedQuantityBase como string
        photoUrl: photoUploadResult.url, // ✅ URL del servidor, no URI local
        signatureUrl: signatureUploadResult.url, // ✅ URL del servidor, no URI local
        notes: notes || undefined,
      };

      // ✅ Solo incluir presentaciones si se validó por presentación
      if (usePresentation && selectedPresentation) {
        const presentationQty = parseFloat(validatedQuantity) || 0;
        const fullPresentations = Math.floor(presentationQty);
        const looseUnits = Math.round(
          (presentationQty - fullPresentations) * selectedPresentation.factorToBase
        );

        validationData.presentations = [
          {
            presentationId: selectedPresentation.presentationId,
            factorToBase: selectedPresentation.factorToBase,
            notes: `Validado en ${selectedPresentation.presentation.name}`,
          },
        ];
        validationData.validatedPresentationQuantity = fullPresentations;
        validationData.validatedLooseUnits = looseUnits;
      }

      // ✅ PASO 4: Enviar validación con URLs del servidor
      await onValidate(validationData);
      onClose();
    } catch (error: any) {
      logger.error('❌ Error en validación:', error);
      Alert.alert('Error', error.message || 'No se pudo completar la validación');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (step !== 'form') {
      setStep('form');
    } else {
      onClose();
    }
  };

  if (!producto) {
    return null;
  }

  if (step === 'photo') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
        <PhotoCapture
          onPhotoCapture={handlePhotoCapture}
          onCancel={handleCancel}
          currentPhoto={photoUri}
        />
      </Modal>
    );
  }

  if (step === 'signature') {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleCancel}>
        <SignatureCapture onSignatureCapture={handleSignatureCapture} onCancel={handleCancel} />
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Title style={styles.modalTitle}>Validar Salida de Producto</Title>

            {/* Product Info */}
            <View style={styles.productInfo}>
              <Body style={{ marginBottom: theme.space[1], fontWeight: '600' }}>
                {producto.product?.title}
              </Body>
              <Caption color="secondary" style={{ marginBottom: theme.space[1] }}>
                {producto.product?.sku}
              </Caption>
              <Body color="secondary" size="small">
                Cantidad asignada: {producto.quantityAssigned || producto.quantityBase} unidades
              </Body>
            </View>

            {/* Product Photo */}
            {producto.product?.photos && producto.product.photos.length > 0 && (
              <View style={styles.inputGroup}>
                <Label style={{ marginBottom: theme.space[2] }}>Foto del Producto</Label>
                <TouchableOpacity
                  style={styles.productPhotoContainer}
                  onPress={() => {
                    if (producto.product?.photos?.[0]) {
                      setSelectedImageUrl(producto.product.photos[0]);
                      setImageViewerVisible(true);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{ uri: producto.product.photos[0] }}
                    style={styles.productPhoto}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Presentation Toggle */}
            {hasPresentations && (
              <View style={styles.inputGroup}>
                <Label style={{ marginBottom: theme.space[2] }}>Modo de Validación</Label>
                <View style={styles.presentationToggle}>
                  <TouchableOpacity
                    style={[styles.toggleOption, !usePresentation && styles.toggleOptionActive]}
                    onPress={() => {
                      setUsePresentation(false);
                      const assignedQty =
                        producto.quantityAssigned || parseFloat(producto.quantityBase) || 0;
                      setValidatedQuantity(assignedQty.toString());
                    }}
                  >
                    <Body
                      size="small"
                      style={{
                        color: !usePresentation ? theme.color.brand.primary : theme.color.text.muted,
                        fontWeight: !usePresentation ? '600' : '500',
                      }}
                    >
                      Por Unidad
                    </Body>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleOption, usePresentation && styles.toggleOptionActive]}
                    onPress={() => {
                      setUsePresentation(true);
                      if (selectedPresentation) {
                        const assignedQty =
                          producto.quantityAssigned || parseFloat(producto.quantityBase) || 0;
                        const presentationQty = calculateQuantityInPresentation(assignedQty);
                        setValidatedQuantity(presentationQty.toFixed(2));
                      }
                    }}
                  >
                    <Body
                      size="small"
                      style={{
                        color: usePresentation ? theme.color.brand.primary : theme.color.text.muted,
                        fontWeight: usePresentation ? '600' : '500',
                      }}
                    >
                      Por Presentación
                    </Body>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Presentation Selector */}
            {hasPresentations && usePresentation && (
              <View style={styles.inputGroup}>
                <Label style={{ marginBottom: theme.space[2] }}>Selecciona Presentación *</Label>
                <View style={styles.presentationOptions}>
                  {producto.product!.presentations!.map((pres) => (
                    <TouchableOpacity
                      key={pres.presentationId}
                      style={[
                        styles.presentationOption,
                        selectedPresentationId === pres.presentationId &&
                          styles.presentationOptionSelected,
                      ]}
                      onPress={() => handlePresentationChange(pres.presentationId)}
                    >
                      <View style={styles.presentationOptionContent}>
                        <Body
                          size="small"
                          style={{
                            color:
                              selectedPresentationId === pres.presentationId
                                ? theme.color.brand.primary
                                : theme.color.text.muted,
                            fontWeight: '600',
                          }}
                        >
                          {pres.presentation.code} - {pres.presentation.name}
                        </Body>
                        <Caption color="tertiary">
                          1 {pres.presentation.name} = {pres.factorToBase} unidades
                        </Caption>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Validated Quantity */}
            <View style={styles.inputGroup}>
              <Label style={{ marginBottom: theme.space[2] }}>
                Cantidad Validada{' '}
                {usePresentation && selectedPresentation
                  ? `(en ${selectedPresentation.presentation.name})`
                  : '(en unidades)'}{' '}
                *
              </Label>
              <Input
                value={validatedQuantity}
                onChangeText={handleQuantityChange}
                keyboardType="numeric"
                placeholder="Cantidad entregada"
              />
              {usePresentation && selectedPresentation && validatedQuantity && (
                <Caption style={{ color: theme.color.brand.primary, marginTop: theme.space[1] }}>
                  ≈ {getQuantityInBase().toFixed(2)} unidades base
                </Caption>
              )}
              <Caption color="tertiary" style={{ marginTop: theme.space[1] }}>
                Ingresa la cantidad real entregada
              </Caption>
            </View>

            {/* Photo */}
            <View style={styles.inputGroup}>
              <Label style={{ marginBottom: theme.space[2] }}>Foto de Validación *</Label>
              {photoUri ? (
                <View style={styles.capturedContainer}>
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.capturedPhoto}
                    onLoad={() => console.log('✅ Photo image loaded successfully')}
                    onError={(error) => console.error('❌ Photo image load error:', error)}
                  />
                  <TouchableOpacity
                    style={styles.recaptureButton}
                    onPress={() => {
                      console.log('🔄 Retaking photo...');
                      setStep('photo');
                    }}
                  >
                    <Body size="small" style={{ color: theme.color.text.inverse, fontWeight: '600' }}>
                      📷 Cambiar Foto
                    </Body>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={() => {
                    console.log('📸 Opening photo capture...');
                    setStep('photo');
                  }}
                >
                  <Body style={styles.captureButtonIcon}>📷</Body>
                  <Body size="small" style={{ color: theme.color.brand.primary, fontWeight: '600' }}>
                    Tomar Foto de Validación
                  </Body>
                </TouchableOpacity>
              )}
              {/* Debug info */}
              {__DEV__ && (
                <Caption color="tertiary" style={{ marginTop: theme.space[1] }}>
                  Photo URI: {photoUri ? 'Set ✓' : 'Not set ✗'}
                </Caption>
              )}
            </View>

            {/* ✅ Product Photo - REMOVED: Not needed for repartos, only for purchases */}

            {/* Signature */}
            <View style={styles.inputGroup}>
              <Label style={{ marginBottom: theme.space[2] }}>Firma del Supervisor *</Label>
              {signatureUri ? (
                <View style={styles.capturedContainer}>
                  <Image source={{ uri: signatureUri }} style={styles.capturedSignature} />
                  <TouchableOpacity
                    style={styles.recaptureButton}
                    onPress={() => setStep('signature')}
                  >
                    <Body size="small" style={{ color: theme.color.text.inverse, fontWeight: '600' }}>
                      ✍️ Cambiar Firma
                    </Body>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.captureButton} onPress={() => setStep('signature')}>
                  <Body style={styles.captureButtonIcon}>✍️</Body>
                  <Body size="small" style={{ color: theme.color.brand.primary, fontWeight: '600' }}>
                    Capturar Firma
                  </Body>
                </TouchableOpacity>
              )}
            </View>

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Label style={{ marginBottom: theme.space[2] }}>Notas (opcional)</Label>
              <Input
                value={notes}
                onChangeText={setNotes}
                placeholder="Observaciones sobre la entrega"
                multiline
                numberOfLines={3}
                inputStyle={styles.textArea}
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <Button
                title="Cancelar"
                variant="outline"
                onPress={onClose}
                disabled={loading}
                style={{ flex: 1 }}
              />
              <Button
                title={loading ? 'Validando...' : 'Validar Salida'}
                variant="primary"
                onPress={handleValidate}
                disabled={loading}
                loading={loading}
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
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
      padding: theme.space[5],
    },
    modalContent: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[6],
      width: '100%',
      maxWidth: 600,
      maxHeight: '90%',
    },
    modalContentTablet: {
      padding: theme.space[8],
    },
    modalTitle: {
      marginBottom: theme.space[5],
      textAlign: 'center',
    },
    productInfo: {
      backgroundColor: theme.color.background.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      marginBottom: theme.space[5],
    },
    inputGroup: {
      marginBottom: theme.space[5],
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    inputHint: {
      fontSize: 12,
      color: theme.color.text.subtle,
      marginTop: theme.space[1],
    },
    captureButton: {
      borderWidth: 2,
      borderColor: theme.color.border.subtle,
      borderStyle: 'dashed',
      borderRadius: theme.radii.lg,
      paddingVertical: theme.space[8],
      alignItems: 'center',
      backgroundColor: theme.color.background.subtle,
    },
    captureButtonIcon: {
      fontSize: 48,
      marginBottom: theme.space[2],
    },
    captureButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.brand.primary,
    },
    capturedContainer: {
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.lg,
      overflow: 'hidden',
      backgroundColor: theme.color.background.subtle,
    },
    capturedPhoto: {
      width: '100%',
      height: 200,
      resizeMode: 'contain',
    },
    capturedSignature: {
      width: '100%',
      height: 150,
      resizeMode: 'contain',
      backgroundColor: theme.color.surface.base,
    },
    recaptureButton: {
      backgroundColor: theme.color.brand.primary,
      paddingVertical: theme.space[3],
      alignItems: 'center',
    },
    recaptureButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    modalActions: {
      flexDirection: 'row',
      gap: theme.space[3],
      marginTop: theme.space[2],
    },
    modalButton: {
      flex: 1,
      paddingVertical: theme.space[3.5],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
    },
    modalButtonCancel: {
      backgroundColor: theme.color.background.subtle,
    },
    modalButtonConfirm: {
      backgroundColor: theme.color.brand.primary,
    },
    modalButtonTextCancel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    modalButtonTextConfirm: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    // Presentation Toggle Styles
    presentationToggle: {
      flexDirection: 'row',
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.background.subtle,
      padding: theme.space[1],
    },
    toggleOption: {
      flex: 1,
      paddingVertical: theme.space[2.5],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    toggleOptionActive: {
      backgroundColor: theme.color.surface.base,
      ...theme.shadow.sm,
    },
    toggleText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.color.text.muted,
    },
    toggleTextActive: {
      color: theme.color.brand.primary,
      fontWeight: '600',
    },
    // Presentation Options Styles
    presentationOptions: {
      gap: theme.space[2],
    },
    presentationOption: {
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[3],
      backgroundColor: theme.color.surface.base,
    },
    presentationOptionSelected: {
      borderColor: theme.color.brand.primary,
      borderWidth: 2,
      backgroundColor: theme.color.brand.primarySoft,
    },
    presentationOptionContent: {
      gap: theme.space[1],
    },
    presentationOptionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    presentationOptionLabelSelected: {
      color: theme.color.brand.primary,
    },
    presentationOptionFactor: {
      fontSize: 12,
      color: theme.color.text.subtle,
    },
    conversionHint: {
      fontSize: 13,
      color: theme.color.brand.primary,
      marginTop: theme.space[1],
      fontWeight: '500',
    },
    // Product Photo Styles
    productPhotoContainer: {
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.lg,
      overflow: 'hidden',
      backgroundColor: theme.color.background.subtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    productPhoto: {
      width: '100%',
      height: 150,
    },
  });
