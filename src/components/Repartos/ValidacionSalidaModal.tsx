import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Image,
  useWindowDimensions,
} from 'react-native';
import { PhotoCapture } from './PhotoCapture';
import { SignatureCapture } from './SignatureCapture';
import { filesApi } from '@/services/api/files';
import logger from '@/utils/logger';

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
      setSelectedPresentationId(presentationId);
      setSelectedPresentation(presentation);

      // Convert current quantity to new presentation
      if (usePresentation && validatedQuantity) {
        const currentBase = parseFloat(validatedQuantity);
        const newPresentationQty = currentBase / presentation.factorToBase;
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
    const assignedQuantity =
      producto.quantityAssigned || parseFloat(producto.quantityBase || '0');

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
            <Text style={styles.modalTitle}>Validar Salida de Producto</Text>

            {/* Product Info */}
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{producto.product?.title}</Text>
              <Text style={styles.productSku}>{producto.product?.sku}</Text>
              <Text style={styles.productQuantity}>
                Cantidad asignada: {producto.quantityAssigned || producto.quantityBase} unidades
              </Text>
            </View>

            {/* Presentation Toggle */}
            {hasPresentations && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Modo de Validación</Text>
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
                    <Text style={[styles.toggleText, !usePresentation && styles.toggleTextActive]}>
                      Por Unidad
                    </Text>
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
                    <Text style={[styles.toggleText, usePresentation && styles.toggleTextActive]}>
                      Por Presentación
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Presentation Selector */}
            {hasPresentations && usePresentation && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Selecciona Presentación *</Text>
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
                        <Text
                          style={[
                            styles.presentationOptionLabel,
                            selectedPresentationId === pres.presentationId &&
                              styles.presentationOptionLabelSelected,
                          ]}
                        >
                          {pres.presentation.code} - {pres.presentation.name}
                        </Text>
                        <Text style={styles.presentationOptionFactor}>
                          1 {pres.presentation.name} = {pres.factorToBase} unidades
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Validated Quantity */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                Cantidad Validada{' '}
                {usePresentation && selectedPresentation
                  ? `(en ${selectedPresentation.presentation.name})`
                  : '(en unidades)'}{' '}
                *
              </Text>
              <TextInput
                style={styles.input}
                value={validatedQuantity}
                onChangeText={handleQuantityChange}
                keyboardType="numeric"
                placeholder="Cantidad entregada"
              />
              {usePresentation && selectedPresentation && validatedQuantity && (
                <Text style={styles.conversionHint}>
                  ≈ {getQuantityInBase().toFixed(2)} unidades base
                </Text>
              )}
              <Text style={styles.inputHint}>
                Ingresa la cantidad real entregada
              </Text>
            </View>

            {/* Photo */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Foto de Validación *</Text>
              {photoUri ? (
                <View style={styles.capturedContainer}>
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.capturedPhoto}
                    onLoad={() => console.log('✅ Photo image loaded successfully')}
                    onError={(error) => console.error('❌ Photo image load error:', error)}
                  />
                  <TouchableOpacity style={styles.recaptureButton} onPress={() => {
                    console.log('🔄 Retaking photo...');
                    setStep('photo');
                  }}>
                    <Text style={styles.recaptureButtonText}>📷 Cambiar Foto</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.captureButton} onPress={() => {
                  console.log('📸 Opening photo capture...');
                  setStep('photo');
                }}>
                  <Text style={styles.captureButtonIcon}>📷</Text>
                  <Text style={styles.captureButtonText}>Tomar Foto de Validación</Text>
                </TouchableOpacity>
              )}
              {/* Debug info */}
              {__DEV__ && (
                <Text style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
                  Photo URI: {photoUri ? 'Set ✓' : 'Not set ✗'}
                </Text>
              )}
            </View>

            {/* ✅ Product Photo - REMOVED: Not needed for repartos, only for purchases */}

            {/* Signature */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Firma del Supervisor *</Text>
              {signatureUri ? (
                <View style={styles.capturedContainer}>
                  <Image source={{ uri: signatureUri }} style={styles.capturedSignature} />
                  <TouchableOpacity
                    style={styles.recaptureButton}
                    onPress={() => setStep('signature')}
                  >
                    <Text style={styles.recaptureButtonText}>✍️ Cambiar Firma</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.captureButton} onPress={() => setStep('signature')}>
                  <Text style={styles.captureButtonIcon}>✍️</Text>
                  <Text style={styles.captureButtonText}>Capturar Firma</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notas (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Observaciones sobre la entrega"
                keyboardType="default"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.modalButtonTextCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonConfirm,
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleValidate}
                disabled={loading}
              >
                <Text style={styles.modalButtonTextConfirm}>
                  {loading ? 'Validando...' : 'Validar Salida'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
  },
  modalContentTablet: {
    padding: 32,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
    textAlign: 'center',
  },
  productInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  productSku: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  productQuantity: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  captureButton: {
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 32,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  captureButtonIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  captureButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  capturedContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#FFFFFF',
  },
  recaptureButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    alignItems: 'center',
  },
  recaptureButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F1F5F9',
  },
  modalButtonConfirm: {
    backgroundColor: '#6366F1',
  },
  modalButtonTextCancel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalButtonTextConfirm: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Presentation Toggle Styles
  presentationToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    padding: 4,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  toggleTextActive: {
    color: '#6366F1',
    fontWeight: '600',
  },
  // Presentation Options Styles
  presentationOptions: {
    gap: 8,
  },
  presentationOption: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  presentationOptionSelected: {
    borderColor: '#6366F1',
    borderWidth: 2,
    backgroundColor: '#EEF2FF',
  },
  presentationOptionContent: {
    gap: 4,
  },
  presentationOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  presentationOptionLabelSelected: {
    color: '#6366F1',
  },
  presentationOptionFactor: {
    fontSize: 12,
    color: '#94A3B8',
  },
  conversionHint: {
    fontSize: 13,
    color: '#6366F1',
    marginTop: 4,
    fontWeight: '500',
  },
});
