import React, { useEffect, useMemo, useState } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import Alert from '@/utils/alert';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { launchCameraAsync, launchImageLibraryAsync, MediaTypeOptions } from '@/utils/filePicker';
import { treasuryApi } from '@/services/api/treasury';
import { PhotoCapture as RepartoPhotoCapture } from '@/components/Repartos/PhotoCapture';
import { SignatureCapture as RepartoSignatureCapture } from '@/components/Repartos/SignatureCapture';
import { CashCollectionScanResponse, CashClosureScanResponse } from '@/types/treasury';

type Props = NativeStackScreenProps<any, 'RecaudoEfectivo'>;

type CaptureMode = 'photo' | 'cashier-signature' | 'supervisor-signature' | null;
type CollectionFlowMode = 'collection' | 'closure';

type ScannedBarCodeEvent = {
  data: string;
};

export const RecaudoEfectivoScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [showForm, setShowForm] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScannedQr, setHasScannedQr] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [notes, setNotes] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [closingCashInput, setClosingCashInput] = useState('');

  const [flowMode, setFlowMode] = useState<CollectionFlowMode>('collection');
  const [scanInfo, setScanInfo] = useState<CashCollectionScanResponse | null>(null);
  const [closureScanInfo, setClosureScanInfo] = useState<CashClosureScanResponse | null>(null);

  useEffect(() => {
    if (flowMode === 'closure') {
      setClosingCashInput(amountInput || '0');
    }
  }, [amountInput, flowMode]);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cashierSignatureUri, setCashierSignatureUri] = useState<string | null>(null);
  const [supervisorSignatureUri, setSupervisorSignatureUri] = useState<string | null>(null);

  const [captureMode, setCaptureMode] = useState<CaptureMode>(null);

  const activeScanInfo = flowMode === 'closure' ? closureScanInfo : scanInfo;

  const currentCashDisplay = useMemo(() => {
    const amount = activeScanInfo?.cashInfo?.currentCashCents ? activeScanInfo.cashInfo.currentCashCents / 100 : 0;
    return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [activeScanInfo]);

  const extractTokenFromQrData = (rawData: string): string => {
    const trimmed = (rawData || '').trim();

    if (!trimmed) return '';

    if (trimmed.includes('/admin/collections/scan/')) {
      const parts = trimmed.split('/admin/collections/scan/');
      return decodeURIComponent(parts[1] || '').trim();
    }

    return trimmed;
  };

  const startFlowWithToken = async (rawData: string) => {
    const token = extractTokenFromQrData(rawData);

    if (!token) {
      Alert.alert('QR inválido', 'No se encontró un token válido en el QR escaneado.');
      return;
    }

    try {
      setIsScanning(true);

      // 1) Intentar flujo normal de recaudo
      try {
        const response = await treasuryApi.scanCollectionToken(token);
        setFlowMode('collection');
        setScanInfo(response);
        setClosureScanInfo(null);

        const suggestedCents = response?.cashInfo?.suggestedCollectionCents || 0;
        setAmountInput('');
        setClosingCashInput('');

        // START debe ocurrir al momento de escanear QR de recaudo
        try {
          await treasuryApi.startCollection(response.request.id, {
            amountCents: suggestedCents,
            notes: 'Recaudación iniciada al escanear QR',
          });
        } catch (startError: any) {
          const startMsg = String(startError?.response?.data?.message || startError?.message || '');
          const alreadyProcessing =
            startError?.response?.status === 400 &&
            (startMsg.toLowerCase().includes('no puede ser procesada') ||
              startMsg.toLowerCase().includes('processing') ||
              startMsg.toLowerCase().includes('proces'));

          if (!alreadyProcessing) {
            Alert.alert('Error', startMsg || 'No se pudo tomar la solicitud de recaudo.');
            return;
          }
        }

        setShowQrScanner(false);
        setShowForm(true);
        return;
      } catch (collectionError: any) {
        // 2) Fallback: intentar flujo de cierre
        try {
          const closureResponse = await treasuryApi.scanClosureToken(token);
          setFlowMode('closure');
          setClosureScanInfo(closureResponse);
          setScanInfo(null);

          setAmountInput('');
          setClosingCashInput('0');

          setShowQrScanner(false);
          setShowForm(true);
          return;
        } catch (closureError: any) {
          console.error('Error scanning collection/closure token:', collectionError, closureError);
          const backendMessage = String(
            closureError?.response?.data?.message ||
            collectionError?.response?.data?.message ||
            closureError?.message ||
            collectionError?.message ||
            ''
          );
          Alert.alert('Error', backendMessage || 'No se pudo iniciar el flujo desde el QR.');
        }
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleOpenForm = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Escaneo QR', 'En web no hay scanner nativo. Usa la app móvil para escanear QR directamente.');
      return;
    }

    try {
      const permission = cameraPermission?.status === 'granted' ? cameraPermission : await requestCameraPermission();
      if (permission?.status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos permiso de cámara para escanear el QR.');
        return;
      }

      setHasScannedQr(false);
      setShowQrScanner(true);
    } catch (error) {
      console.error('Error opening QR scanner:', error);
      Alert.alert('Error', 'No se pudo abrir la cámara para escanear QR.');
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setCaptureMode(null);
    setFlowMode('collection');
    setClosureScanInfo(null);
    setScanInfo(null);
  };

  const handleQrScanned = async ({ data }: ScannedBarCodeEvent) => {
    if (hasScannedQr || isScanning) return;

    setHasScannedQr(true);
    await startFlowWithToken(data);
  };

  const formatCurrencyFromInput = (value: string): number => {
    const normalized = value.replace(',', '.').trim();
    const parsed = Number(normalized);
    if (Number.isNaN(parsed) || parsed < 0) return Number.NaN;
    return Math.round(parsed * 100);
  };

  const uriToBase64 = async (uri: string): Promise<string> => {
    if (!uri) return '';

    if (uri.startsWith('data:')) {
      return uri.split(',')[1] || '';
    }

    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  };

  const handleSubmitCollection = async () => {
    const activeRequestId = flowMode === 'closure' ? closureScanInfo?.request?.id : scanInfo?.request?.id;

    if (!activeRequestId) {
      Alert.alert('Falta escaneo', 'Primero escanea un token QR válido.');
      return;
    }

    const amountCents = formatCurrencyFromInput(amountInput);
    if (Number.isNaN(amountCents)) {
      Alert.alert('Monto inválido', 'Ingresa un monto válido para recaudar.');
      return;
    }

    const closingCashCountedCents = formatCurrencyFromInput(closingCashInput);
    if (flowMode === 'closure' && Number.isNaN(closingCashCountedCents)) {
      Alert.alert('Monto inválido', 'Ingresa un monto válido de efectivo contado final.');
      return;
    }

    if (!photoUri) {
      Alert.alert('Falta foto', 'Debes capturar una foto del recaudo.');
      return;
    }

    if (!cashierSignatureUri) {
      Alert.alert('Falta firma cajera', 'Debes registrar la firma de la cajera.');
      return;
    }

    if (!supervisorSignatureUri) {
      Alert.alert('Falta firma supervisora', 'Debes registrar tu firma de supervisora.');
      return;
    }

    try {
      setIsSubmitting(true);

      const [photoBase64, cashierSignatureBase64, supervisorSignatureBase64] = await Promise.all([
        uriToBase64(photoUri),
        uriToBase64(cashierSignatureUri),
        uriToBase64(supervisorSignatureUri),
      ]);

      if (flowMode === 'closure') {
        const result = await treasuryApi.collectAndClose(activeRequestId, {
          collectedAmountCents: amountCents,
          closingCashCountedCents,
          photo: photoBase64,
          cashierSignature: cashierSignatureBase64,
          supervisorSignature: supervisorSignatureBase64,
          notes: notes || 'Recaudación final y cierre completados desde admin frontend',
        });

        Alert.alert(
          'Recaudo y cierre completados',
          `N° ${result.collection?.collectionNumber || '-'}\nHolding: ${result.holding?.holdingNumber || '-'}\nMotivo: ${result.closure?.closureReasonStatus || '-'}`
        );
      } else {
        const completed = await treasuryApi.completeCollection(activeRequestId, {
          amountCents,
          photo: photoBase64,
          cashierSignature: cashierSignatureBase64,
          supervisorSignature: supervisorSignatureBase64,
          notes: notes || 'Recaudación completada desde admin frontend',
        });

        Alert.alert(
          'Recaudo completado',
          `N° ${completed.collectionNumber}\nHolding: ${completed.holding?.holdingNumber || '-'}\nMonto: S/ ${(amountCents / 100).toFixed(2)}`
        );
      }

      setShowForm(false);
      setNotes('');
      setAmountInput('');
      setClosingCashInput('');
      setScanInfo(null);
      setClosureScanInfo(null);
      setPhotoUri(null);
      setCashierSignatureUri(null);
      setSupervisorSignatureUri(null);
      setCaptureMode(null);
      setFlowMode('collection');
    } catch (error: any) {
      console.error('Error submitting collection/closure:', error);
      const backendMessage = String(error?.response?.data?.message || error?.message || '');

      if (backendMessage.toLowerCase().includes('solo quien inicio la recaudacion puede completarla')) {
        Alert.alert(
          'No autorizado para completar',
          'Esta solicitud ya fue iniciada por otra supervisora. Debes completarla con el mismo usuario que hizo el inicio.'
        );
      } else {
        Alert.alert('Error', backendMessage || 'No se pudo enviar el formulario.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTakePhotoQuick = async () => {
    try {
      const result = await launchCameraAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking quick photo:', error);
      Alert.alert('Error', 'No se pudo capturar la foto.');
    }
  };

  const handlePickPhotoQuick = async () => {
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking quick photo:', error);
      Alert.alert('Error', 'No se pudo seleccionar la foto.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recaudo Efectivo</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.mainButton} activeOpacity={0.85} onPress={handleOpenForm}>
          <Text style={styles.mainButtonText}>Generar Recaudo</Text>
        </TouchableOpacity>

        <View style={styles.cashInfoCard}>
          <Text style={styles.cashInfoLabel}>Efectivo actual</Text>
          <Text style={styles.cashInfoValue}>{currentCashDisplay}</Text>
        </View>
      </View>

      <Modal visible={showQrScanner} animationType="slide" onRequestClose={() => setShowQrScanner(false)}>
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={handleQrScanned}
          />
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerTitle}>Escanea el QR de la caja</Text>
            <Text style={styles.scannerSubtitle}>Apunta al código para cargar la solicitud pendiente</Text>
            {isScanning && <ActivityIndicator color="#fff" style={styles.scannerLoading} />}
            <TouchableOpacity
              style={styles.scannerCancelButton}
              onPress={() => {
                setShowQrScanner(false);
                setHasScannedQr(false);
              }}
            >
              <Text style={styles.scannerCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showForm} animationType="slide" onRequestClose={handleCloseForm}>
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Formulario de Recaudo</Text>
            <TouchableOpacity onPress={handleCloseForm}>
              <Text style={styles.formClose}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.formBody}>
            {(scanInfo || closureScanInfo) && (
              <View style={styles.scanInfoCard}>
                <Text style={styles.scanInfoTitle}>
                  {flowMode === 'closure' ? 'Solicitud de cierre pendiente' : 'Solicitud pendiente'}
                </Text>
                <Text style={styles.scanInfoText}>
                  Caja: {(activeScanInfo?.cashRegister as any)?.code} - {activeScanInfo?.cashRegister?.name}
                </Text>
                <Text style={styles.scanInfoText}>Sede: {activeScanInfo?.site?.name}</Text>
                <Text style={styles.scanInfoText}>Cajera: {activeScanInfo?.cashier?.name}</Text>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setShowForm(false);
                    setHasScannedQr(false);
                    setShowQrScanner(true);
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Escanear otro QR</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.fieldLabel}>
              {flowMode === 'closure' ? 'Monto de recaudación final' : 'Monto a recaudar'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder=""
              keyboardType="decimal-pad"
              value={amountInput}
              onChangeText={setAmountInput}
            />

            {flowMode === 'closure' && (
              <>
                <Text style={styles.fieldLabel}>Efectivo contado final</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={closingCashInput}
                  editable={false}
                  selectTextOnFocus={false}
                />
              </>
            )}

            <Text style={styles.fieldLabel}>Foto del recaudo</Text>
            <View style={styles.evidenceCard}>
              {photoUri ? <Image source={{ uri: photoUri }} style={styles.evidencePreview} /> : <Text style={styles.evidencePlaceholder}>Sin foto</Text>}
              <View style={styles.evidenceActions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleTakePhotoQuick}>
                  <Text style={styles.secondaryButtonText}>Cámara rápida</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={handlePickPhotoQuick}>
                  <Text style={styles.secondaryButtonText}>Galería</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.fieldLabel}>Firma cajera</Text>
            <View style={styles.evidenceCard}>
              {cashierSignatureUri ? <Image source={{ uri: cashierSignatureUri }} style={styles.signaturePreview} /> : <Text style={styles.evidencePlaceholder}>Sin firma cajera</Text>}
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setCaptureMode('cashier-signature')}>
                <Text style={styles.secondaryButtonText}>Firmar cajera</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Firma supervisora</Text>
            <View style={styles.evidenceCard}>
              {supervisorSignatureUri ? <Image source={{ uri: supervisorSignatureUri }} style={styles.signaturePreview} /> : <Text style={styles.evidencePlaceholder}>Sin firma supervisora</Text>}
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setCaptureMode('supervisor-signature')}>
                <Text style={styles.secondaryButtonText}>Firmar supervisora</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Notas</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Observaciones del recaudo"
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <TouchableOpacity style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} onPress={handleSubmitCollection} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {flowMode === 'closure' ? 'Enviar recaudación final y cierre' : 'Enviar formulario de recaudo'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={captureMode !== null} animationType="slide" onRequestClose={() => setCaptureMode(null)}>
        {captureMode === 'photo' && (
          <RepartoPhotoCapture
            currentPhoto={photoUri || undefined}
            onCancel={() => setCaptureMode(null)}
            onPhotoCapture={(uri) => {
              setPhotoUri(uri);
              setCaptureMode(null);
            }}
          />
        )}

        {captureMode === 'cashier-signature' && (
          <RepartoSignatureCapture
            onCancel={() => setCaptureMode(null)}
            onSignatureCapture={(uri) => {
              setCashierSignatureUri(uri);
              setCaptureMode(null);
            }}
          />
        )}

        {captureMode === 'supervisor-signature' && (
          <RepartoSignatureCapture
            onCancel={() => setCaptureMode(null)}
            onSignatureCapture={(uri) => {
              setSupervisorSignatureUri(uri);
              setCaptureMode(null);
            }}
          />
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#374151',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 24,
  },
  mainButton: {
    width: '100%',
    minHeight: 140,
    borderRadius: 20,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
  },
  mainButtonText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cashInfoCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  cashInfoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  cashInfoValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
  },

  formContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  formHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  formClose: {
    color: '#2563EB',
    fontWeight: '600',
  },
  formBody: {
    padding: 16,
    gap: 12,
    paddingBottom: 30,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 2,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  scanInfoCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    gap: 3,
  },
  scanInfoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
    marginBottom: 4,
  },
  scanInfoText: {
    fontSize: 13,
    color: '#065F46',
  },
  evidenceCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  evidencePlaceholder: {
    fontSize: 13,
    color: '#6B7280',
  },
  evidencePreview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  signaturePreview: {
    width: '100%',
    height: 120,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
  },
  evidenceActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#3730A3',
    fontWeight: '600',
    fontSize: 12,
  },
  notesInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  submitButton: {
    marginTop: 12,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },

  scannerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 8,
  },
  scannerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  scannerSubtitle: {
    color: '#E5E7EB',
    fontSize: 14,
  },
  scannerLoading: {
    marginTop: 8,
    marginBottom: 4,
  },
  scannerCancelButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  scannerCancelText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default RecaudoEfectivoScreen;
