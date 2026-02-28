import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { purchasesService } from '@/services/api';
import { GuideType, GuideTypeLabels } from '@/types/purchases';
import { Supplier } from '@/types/expenses';
import { getTodayString } from '@/utils/dateHelpers';
import { SupplierSearchInput } from '@/components/Suppliers/SupplierSearchInput';

interface CreatePurchaseScreenProps {
  navigation: any;
}

export const CreatePurchaseScreen: React.FC<CreatePurchaseScreenProps> = ({ navigation }) => {
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [guideNumber, setGuideNumber] = useState('');
  const [guideType, setGuideType] = useState<GuideType>(GuideType.FACTURA);
  const [guideDate, setGuideDate] = useState(getTodayString());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showGuideTypePicker, setShowGuideTypePicker] = useState(false);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  const handleCreate = async () => {
    if (!selectedSupplier) {
      Alert.alert('Error', 'Debe seleccionar un proveedor');
      return;
    }

    if (!guideNumber.trim()) {
      Alert.alert('Error', 'Debe ingresar el número de guía');
      return;
    }

    setLoading(true);
    try {
      const purchase = await purchasesService.createPurchase({
        supplierId: selectedSupplier.id,
        guideNumber: guideNumber.trim(),
        guideType,
        guideDate,
        notes: notes.trim() || undefined,
      });

      Alert.alert('Éxito', 'Compra creada correctamente', [
        {
          text: 'OK',
          onPress: () => {
            navigation.replace('PurchaseDetail', { purchaseId: purchase.id });
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error creating purchase:', error);
      Alert.alert('Error', error.message || 'No se pudo crear la compra');
    } finally {
      setLoading(false);
    }
  };



  const renderGuideTypePicker = () => {
    if (!showGuideTypePicker) {
      return null;
    }

    const guideTypes = Object.values(GuideType);

    return (
      <View style={styles.pickerOverlay}>
        <View style={[styles.pickerContainer, isTablet && styles.pickerContainerTablet]}>
          <View style={styles.pickerHeader}>
            <Text style={[styles.pickerTitle, isTablet && styles.pickerTitleTablet]}>
              Tipo de Guía
            </Text>
            <TouchableOpacity onPress={() => setShowGuideTypePicker(false)}>
              <Text style={styles.pickerClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickerList}>
            {guideTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.pickerItem, guideType === type && styles.pickerItemSelected]}
                onPress={() => {
                  setGuideType(type);
                  setShowGuideTypePicker(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    isTablet && styles.pickerItemTextTablet,
                    guideType === type && styles.pickerItemTextSelected,
                  ]}
                >
                  {GuideTypeLabels[type]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>Nueva Compra</Text>
          <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
            Ingreso de guía de compra
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
      >
        {/* Supplier Search - Smart Search with MERCHANDISE filter */}
        <View style={styles.section}>
          <SupplierSearchInput
            selectedSupplier={selectedSupplier || undefined}
            onSelect={(supplier) => setSelectedSupplier(supplier)}
            label="Proveedor de Mercadería"
            placeholder="Buscar proveedor de mercadería..."
            required
            filterByType="MERCHANDISE"
          />
          <Text style={[styles.infoText, isTablet && styles.infoTextTablet]}>
            💡 Solo se muestran proveedores de tipo Mercadería
          </Text>
        </View>

        {/* Guide Number */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>
            Número de Guía <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={guideNumber}
            onChangeText={setGuideNumber}
            placeholder="Ej: F001-00123"
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* Guide Type */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>
            Tipo de Guía <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.input, styles.selectInput, isTablet && styles.inputTablet]}
            onPress={() => setShowGuideTypePicker(true)}
          >
            <Text style={[styles.selectText, isTablet && styles.selectTextTablet]}>
              {GuideTypeLabels[guideType]}
            </Text>
            <Text style={styles.selectArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Guide Date */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>
            Fecha de Guía <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={guideDate}
            onChangeText={setGuideDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>Notas</Text>
          <TextInput
            style={[styles.input, styles.textArea, isTablet && styles.inputTablet]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notas adicionales (opcional)"
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.footer, isTablet && styles.footerTablet]}>
        <TouchableOpacity
          style={[styles.cancelButton, isTablet && styles.cancelButtonTablet]}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={[styles.cancelButtonText, isTablet && styles.cancelButtonTextTablet]}>
            Cancelar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.createButton,
            isTablet && styles.createButtonTablet,
            loading && styles.createButtonDisabled,
          ]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.createButtonText, isTablet && styles.createButtonTextTablet]}>
              Crear Compra
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {renderGuideTypePicker()}
    </SafeAreaView>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 28,
    color: '#64748B',
    fontWeight: '300',
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
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  labelTablet: {
    fontSize: 16,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  inputTablet: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 17,
    borderRadius: 14,
  },
  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectText: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
  },
  selectTextTablet: {
    fontSize: 17,
  },
  selectPlaceholder: {
    color: '#94A3B8',
  },
  selectArrow: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 8,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
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
  createButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  createButtonTablet: {
    paddingVertical: 16,
    borderRadius: 14,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createButtonTextTablet: {
    fontSize: 17,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  pickerContainerTablet: {
    width: '60%',
    maxWidth: 600,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  pickerTitleTablet: {
    fontSize: 20,
  },
  pickerClose: {
    fontSize: 24,
    color: '#64748B',
    fontWeight: '300',
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerItemSelected: {
    backgroundColor: '#EEF2FF',
  },
  pickerItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  pickerItemTextTablet: {
    fontSize: 17,
  },
  pickerItemTextSelected: {
    color: '#6366F1',
  },
  pickerItemSubtext: {
    fontSize: 13,
    color: '#64748B',
  },
  pickerItemSubtextTablet: {
    fontSize: 15,
  },
  infoText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    fontStyle: 'italic',
  },
  infoTextTablet: {
    fontSize: 14,
  },
});

export default CreatePurchaseScreen;
