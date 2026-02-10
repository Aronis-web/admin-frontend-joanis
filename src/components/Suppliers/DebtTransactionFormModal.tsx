import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { suppliersService } from '@/services/api/suppliers';
import { companiesApi } from '@/services/api/companies';
import filesApi from '@/services/api/files';
import { useAuthStore } from '@/store/auth';
import {
  SupplierDebtTransaction,
  TransactionType,
  SupplierLegalEntity,
  CreateDebtTransactionRequest,
  UpdateDebtTransactionRequest,
} from '@/types/suppliers';

interface DebtTransactionFormModalProps {
  visible: boolean;
  supplierId: string;
  transaction?: SupplierDebtTransaction | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DebtTransactionFormModal: React.FC<DebtTransactionFormModalProps> = ({
  visible,
  supplierId,
  transaction,
  onClose,
  onSuccess,
}) => {
  const isEditMode = !!transaction;
  const { currentCompany } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [legalEntities, setLegalEntities] = useState<SupplierLegalEntity[]>([]);

  // Date picker states
  const [showTransactionDatePicker, setShowTransactionDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);

  // Form state
  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.PURCHASE);
  const [supplierLegalEntityId, setSupplierLegalEntityId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('');
  const [attachmentFileId, setAttachmentFileId] = useState<string>('');
  const [attachmentFileName, setAttachmentFileName] = useState<string>('');

  // Lista de bancos
  const banks = ['BBVA', 'BCP', 'INTERBANK', 'EFECTIVO'];

  useEffect(() => {
    if (visible) {
      loadData();
      if (transaction) {
        populateForm(transaction);
      } else {
        resetForm();
      }
    }
  }, [visible, transaction]);

  const loadData = async () => {
    try {
      const supplier = await suppliersService.getSupplier(supplierId);
      setLegalEntities(supplier.legalEntities || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const populateForm = (txn: SupplierDebtTransaction) => {
    setTransactionType(txn.transactionType);
    setSupplierLegalEntityId(txn.supplierLegalEntityId || '');
    setAmount(Math.abs(txn.amountCents / 100).toString());
    setReferenceNumber(txn.referenceNumber || '');
    setTransactionDate(new Date(txn.transactionDate));
    setDueDate(txn.dueDate ? new Date(txn.dueDate) : null);
    setNotes(txn.notes || '');
    setBankName(txn.bankName || '');
    setBankAccountNumber(txn.bankAccountNumber || '');
    setAttachmentFileId(txn.attachmentFileId || '');
    setAttachmentFileName(txn.attachmentFileId ? 'Archivo adjunto' : '');
  };

  const resetForm = () => {
    setTransactionType(TransactionType.PURCHASE);
    setSupplierLegalEntityId('');
    setAmount('');
    setReferenceNumber('');
    setTransactionDate(new Date());
    setDueDate(null);
    setNotes('');
    setBankName('');
    setBankAccountNumber('');
    setAttachmentFileId('');
    setAttachmentFileName('');
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      await uploadFile(file.uri, file.name, file.mimeType || 'application/octet-stream');
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se necesita permiso para acceder a las fotos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      await uploadFile(asset.uri, `image_${Date.now()}.jpg`, 'image/jpeg');
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Se necesita permiso para usar la cámara');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      await uploadFile(asset.uri, `photo_${Date.now()}.jpg`, 'image/jpeg');
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const uploadFile = async (uri: string, filename: string, mimeType: string) => {
    try {
      setUploading(true);

      const response = await filesApi.uploadSupplierDebtFile(
        uri,
        filename,
        supplierId,
        mimeType
      );

      // El backend retorna { success, url, path, category }
      // Convertir barras invertidas a barras normales para compatibilidad
      const normalizedPath = response.path.replace(/\\/g, '/');
      setAttachmentFileId(normalizedPath);
      setAttachmentFileName(filename);
      Alert.alert('Éxito', 'Archivo subido correctamente');
    } catch (error: any) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', 'No se pudo subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const showAttachmentOptions = () => {
    Alert.alert(
      'Adjuntar archivo',
      'Seleccione una opción',
      [
        { text: 'Tomar foto', onPress: handleTakePhoto },
        { text: 'Seleccionar imagen', onPress: handlePickImage },
        { text: 'Seleccionar archivo', onPress: handlePickFile },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!amount || parseFloat(amount) <= 0) {
      errors.push('El monto debe ser mayor a 0');
    }

    if (!transactionDate) {
      errors.push('Debe seleccionar una fecha');
    }

    if (!supplierLegalEntityId) {
      errors.push('La razón social del proveedor es requerida');
    }

    if (['CREDIT_NOTE', 'DEBIT_NOTE'].includes(transactionType) && !referenceNumber) {
      errors.push('Las notas de crédito/débito requieren número de referencia');
    }

    if (transactionType === 'PAYMENT' && !bankName) {
      errors.push('Los pagos deben especificar el banco');
    }

    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      Alert.alert('Errores de validación', errors.join('\n'));
      return;
    }

    try {
      setLoading(true);

      // Convert amount to cents
      const amountCents = Math.round(parseFloat(amount) * 100);

      // Determine sign based on transaction type
      let finalAmount: number;
      if (['PAYMENT', 'CREDIT_NOTE'].includes(transactionType)) {
        finalAmount = -Math.abs(amountCents);
      } else {
        finalAmount = Math.abs(amountCents);
      }

      console.log('💰 Amount calculation:', {
        amount,
        amountCents,
        finalAmount,
        type: typeof finalAmount,
        transactionType,
      });

      // Build data object, only including defined fields
      const data: any = {
        transactionType,
        amountCents: finalAmount,
        transactionDate: transactionDate.toISOString().split('T')[0],
      };

      // Add companyId from current context
      if (currentCompany?.id) {
        data.companyId = currentCompany.id;
      }

      // Only add optional fields if they have values
      if (supplierLegalEntityId) data.supplierLegalEntityId = supplierLegalEntityId;
      if (referenceNumber) data.referenceNumber = referenceNumber;
      if (dueDate) data.dueDate = dueDate.toISOString().split('T')[0];
      if (notes) data.notes = notes;
      if (bankName) data.bankName = bankName;
      if (bankAccountNumber) data.bankAccountNumber = bankAccountNumber;
      if (attachmentFileId) data.attachmentFilePath = attachmentFileId;

      console.log('📤 Sending transaction data:', data);

      if (isEditMode) {
        await suppliersService.updateTransaction(supplierId, transaction!.id, data as UpdateDebtTransactionRequest);
        Alert.alert('Éxito', 'Transacción actualizada correctamente');
      } else {
        await suppliersService.createTransaction(supplierId, data as CreateDebtTransactionRequest);
        Alert.alert('Éxito', 'Transacción creada correctamente');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving transaction:', error);
      Alert.alert('Error', error.message || 'No se pudo guardar la transacción');
    } finally {
      setLoading(false);
    }
  };

  const transactionTypes: { value: TransactionType; label: string; icon: string }[] = [
    { value: TransactionType.PURCHASE, label: 'Compra', icon: 'cart' },
    { value: TransactionType.PAYMENT, label: 'Pago', icon: 'cash' },
    { value: TransactionType.ADJUSTMENT, label: 'Ajuste', icon: 'swap-horizontal' },
    { value: TransactionType.CREDIT_NOTE, label: 'Nota de Crédito', icon: 'arrow-down-circle' },
    { value: TransactionType.DEBIT_NOTE, label: 'Nota de Débito', icon: 'arrow-up-circle' },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode ? 'Editar Transacción' : 'Nueva Transacción'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Transaction Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tipo de Transacción</Text>
            <View style={styles.typeGrid}>
              {transactionTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeButton,
                    transactionType === type.value && styles.typeButtonActive,
                  ]}
                  onPress={() => setTransactionType(type.value)}
                >
                  <Ionicons
                    name={type.icon as any}
                    size={24}
                    color={transactionType === type.value ? '#fff' : '#3498db'}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      transactionType === type.value && styles.typeButtonTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Amount */}
          <View style={styles.section}>
            <Text style={styles.label}>Monto (S/)*</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Legal Entity */}
          <View style={styles.section}>
            <Text style={styles.label}>Razón Social del Proveedor*</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={supplierLegalEntityId}
                onValueChange={(value) => setSupplierLegalEntityId(value)}
                style={styles.picker}
              >
                <Picker.Item label="Seleccionar..." value="" />
                {legalEntities.map((entity) => (
                  <Picker.Item
                    key={entity.id}
                    label={`${entity.legalName} - ${entity.ruc}`}
                    value={entity.id}
                  />
                ))}
              </Picker>
            </View>
          </View>

          {/* Reference Number */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Número de Referencia
              {['CREDIT_NOTE', 'DEBIT_NOTE'].includes(transactionType) && '*'}
            </Text>
            <TextInput
              style={styles.input}
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              placeholder="F001-00123, NC-001-00045, etc."
            />
          </View>

          {/* Transaction Date */}
          <View style={styles.section}>
            <Text style={styles.label}>Fecha de Transacción*</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowTransactionDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#3498db" />
              <Text style={styles.dateButtonText}>
                {transactionDate.toLocaleDateString('es-PE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
            {showTransactionDatePicker && (
              <DateTimePicker
                value={transactionDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowTransactionDatePicker(false);
                  if (selectedDate) {
                    setTransactionDate(selectedDate);
                  }
                }}
              />
            )}
          </View>

          {/* Due Date */}
          <View style={styles.section}>
            <Text style={styles.label}>Fecha de Vencimiento (Opcional)</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDueDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={20} color="#3498db" />
              <Text style={styles.dateButtonText}>
                {dueDate
                  ? dueDate.toLocaleDateString('es-PE', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'Seleccionar fecha'}
              </Text>
            </TouchableOpacity>
            {dueDate && (
              <TouchableOpacity
                style={styles.clearDateButton}
                onPress={() => setDueDate(null)}
              >
                <Text style={styles.clearDateButtonText}>Limpiar fecha</Text>
              </TouchableOpacity>
            )}
            {showDueDatePicker && (
              <DateTimePicker
                value={dueDate || new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDueDatePicker(false);
                  if (selectedDate) {
                    setDueDate(selectedDate);
                  }
                }}
              />
            )}
          </View>

          {/* Bank Info (for payments) */}
          {transactionType === 'PAYMENT' && (
            <>
              <View style={styles.section}>
                <Text style={styles.label}>Banco*</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={bankName}
                    onValueChange={(value) => setBankName(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Seleccionar banco..." value="" />
                    {banks.map((bank) => (
                      <Picker.Item key={bank} label={bank} value={bank} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Número de Cuenta (Opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={bankAccountNumber}
                  onChangeText={setBankAccountNumber}
                  placeholder="19312345678"
                  keyboardType="number-pad"
                />
              </View>
            </>
          )}

          {/* Attachment */}
          <View style={styles.section}>
            <Text style={styles.label}>Archivo Adjunto (Opcional)</Text>
            <TouchableOpacity
              style={styles.attachmentButton}
              onPress={showAttachmentOptions}
              disabled={uploading}
            >
              <Ionicons name="attach" size={20} color="#3498db" />
              <Text style={styles.attachmentButtonText}>
                {uploading
                  ? 'Subiendo...'
                  : attachmentFileName || 'Adjuntar factura, voucher o foto'}
              </Text>
            </TouchableOpacity>
            {attachmentFileName && (
              <View style={styles.attachmentInfo}>
                <Ionicons name="checkmark-circle" size={16} color="#27ae60" />
                <Text style={styles.attachmentInfoText}>{attachmentFileName}</Text>
              </View>
            )}
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.label}>Notas (Opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Información adicional..."
              multiline
              numberOfLines={4}
            />
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isEditMode ? 'Actualizar' : 'Crear'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const SafeAreaView = ({ children, style }: any) => <View style={style}>{children}</View>;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#2c3e50',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: 50,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#3498db',
    borderRadius: 8,
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3498db',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#3498db',
    borderRadius: 8,
    borderStyle: 'dashed',
    gap: 8,
  },
  attachmentButtonText: {
    fontSize: 14,
    color: '#3498db',
    fontWeight: '500',
  },
  attachmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  attachmentInfoText: {
    fontSize: 12,
    color: '#27ae60',
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#ecf0f1',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7f8c8d',
  },
  submitButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#3498db',
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 14,
    color: '#2c3e50',
    flex: 1,
  },
  clearDateButton: {
    marginTop: 8,
    padding: 8,
    alignItems: 'center',
  },
  clearDateButtonText: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: '500',
  },
});

export default DebtTransactionFormModal;
