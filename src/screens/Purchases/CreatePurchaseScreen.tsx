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
  Title,
  Body,
  Label,
  Caption,
  Button,
  Card,
  Input,
  IconButton,
} from '@/design-system';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface CreatePurchaseScreenProps {
  navigation: any;
}

export const CreatePurchaseScreen: React.FC<CreatePurchaseScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
                  color={guideType === type ? theme.color.brand.primary : 'primary'}
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
          <Ionicons name="chevron-back" size={24} color={theme.color.icon.default} />
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
            <Ionicons name="information-circle" size={16} color={theme.color.icon.accent} />
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
            Tipo de Guía <Label color={theme.color.text.danger}>*</Label>
          </Label>
          <TouchableOpacity
            style={styles.selectInput}
            onPress={() => setShowGuideTypePicker(true)}
          >
            <Body>{GuideTypeLabels[guideType]}</Body>
            <Ionicons name="chevron-down" size={20} color={theme.color.icon.subtle} />
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

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
    gap: theme.space[3],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.surface.subtle,
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
    padding: theme.space[4],
    gap: theme.space[4],
  },
  contentContainerTablet: {
    padding: theme.space[6],
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    marginBottom: theme.space[2],
  },
  fieldLabel: {
    marginBottom: theme.space[2],
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.space[3],
    gap: theme.space[2],
  },
  infoNoteText: {
    flex: 1,
  },
  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    borderWidth: 1.5,
    borderColor: theme.color.border.subtle,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    minHeight: 48,
  },
  textAreaContainer: {
    marginTop: theme.space[2],
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: theme.space[3],
  },
  bottomSpacer: {
    height: theme.space[10],
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: theme.color.surface.base,
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[4],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
    gap: theme.space[3],
  },
  footerButton: {
    flex: 1,
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.color.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  pickerContainer: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii['2xl'],
    width: '90%',
    maxHeight: '70%',
    overflow: 'hidden',
    ...theme.shadow.xl,
  },
  pickerContainerTablet: {
    width: '60%',
    maxWidth: 600,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.space[5],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  pickerItemSelected: {
    backgroundColor: theme.color.brand.primarySoft,
  },
});

export default CreatePurchaseScreen;
