/**
 * CreatePurchaseScreen - Crear Nueva Compra
 * Migrado al Design System unificado
 */
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { purchasesService } from '@/services/api';
import { GuideType, GuideTypeLabels } from '@/types/purchases';
import { Supplier } from '@/types/expenses';
import { SupplierType } from '@/types/suppliers';
import { getTodayString } from '@/utils/dateHelpers';
import { SupplierSearchInput } from '@/components/Suppliers/SupplierSearchInput';
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  Title,
  Body,
  Label,
  Caption,
  Button,
  Card,
  Input,
  IconButton,
} from '@/design-system';

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
            <Title size="medium">Tipo de Guía</Title>
            <IconButton
              icon="close"
              onPress={() => setShowGuideTypePicker(false)}
              variant="ghost"
              size="small"
            />
          </View>
          <ScrollView style={styles.pickerList}>
            {guideTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.pickerItem,
                  guideType === type && styles.pickerItemSelected,
                ]}
                onPress={() => {
                  setGuideType(type);
                  setShowGuideTypePicker(false);
                }}
              >
                <Body
                  color={guideType === type ? colors.primary[900] : 'primary'}
                  style={guideType === type && { fontWeight: '600' }}
                >
                  {GuideTypeLabels[type]}
                </Body>
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
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color={colors.icon.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Title size="large">Nueva Compra</Title>
          <Body color="secondary">Ingreso de guía de compra</Body>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          isTablet && styles.contentContainerTablet,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Supplier Search */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <SupplierSearchInput
            selectedSupplier={selectedSupplier || undefined}
            onSelect={(supplier) => setSelectedSupplier(supplier)}
            label="Proveedor de Mercadería"
            placeholder="Buscar proveedor de mercadería..."
            required
            filterByType={SupplierType.MERCHANDISE}
          />
          <View style={styles.infoNote}>
            <Ionicons name="information-circle" size={16} color={colors.info[500]} />
            <Caption color="secondary" style={styles.infoNoteText}>
              Solo se muestran proveedores de tipo Mercadería
            </Caption>
          </View>
        </Card>

        {/* Guide Number */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <Input
            label="Número de Guía"
            value={guideNumber}
            onChangeText={setGuideNumber}
            placeholder="Ej: F001-00123"
            required
          />
        </Card>

        {/* Guide Type */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <Label color="secondary" style={styles.fieldLabel}>
            Tipo de Guía <Label color={colors.danger[500]}>*</Label>
          </Label>
          <TouchableOpacity
            style={styles.selectInput}
            onPress={() => setShowGuideTypePicker(true)}
          >
            <Body>{GuideTypeLabels[guideType]}</Body>
            <Ionicons name="chevron-down" size={20} color={colors.icon.tertiary} />
          </TouchableOpacity>
        </Card>

        {/* Guide Date */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <Input
            label="Fecha de Guía"
            value={guideDate}
            onChangeText={setGuideDate}
            placeholder="YYYY-MM-DD"
            required
          />
        </Card>

        {/* Notes */}
        <Card variant="outlined" padding="medium" style={styles.section}>
          <Label color="secondary" style={styles.fieldLabel}>Notas</Label>
          <View style={styles.textAreaContainer}>
            <Input
              value={notes}
              onChangeText={setNotes}
              placeholder="Notas adicionales (opcional)"
              multiline
              numberOfLines={4}
              inputStyle={styles.textArea}
            />
          </View>
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <Button
          title="Cancelar"
          onPress={() => navigation.goBack()}
          variant="secondary"
          disabled={loading}
          style={styles.footerButton}
        />
        <Button
          title="Crear Compra"
          onPress={handleCreate}
          variant="primary"
          loading={loading}
          disabled={loading}
          style={styles.footerButton}
        />
      </View>

      {renderGuideTypePicker()}
    </SafeAreaView>
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
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    gap: spacing[3],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[4],
    gap: spacing[4],
  },
  contentContainerTablet: {
    padding: spacing[6],
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    marginBottom: spacing[2],
  },
  fieldLabel: {
    marginBottom: spacing[2],
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  infoNoteText: {
    flex: 1,
  },
  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 48,
  },
  textAreaContainer: {
    marginTop: spacing[2],
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: spacing[3],
  },
  bottomSpacer: {
    height: spacing[10],
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    gap: spacing[3],
  },
  footerButton: {
    flex: 1,
  },
  // Picker Modal
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  pickerContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    width: '90%',
    maxHeight: '70%',
    overflow: 'hidden',
    ...shadows.xl,
  },
  pickerContainerTablet: {
    width: '60%',
    maxWidth: 600,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  pickerItemSelected: {
    backgroundColor: colors.primary[50],
  },
});

export default CreatePurchaseScreen;
