/**
 * EditPurchaseProductScreen - Editar Producto de Compra
 * Migrado al Design System unificado
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { purchasesService } from '@/services/api';
import { presentationsApi } from '@/services/api/presentations';
import type { Presentation } from '@/services/api/presentations';
import type { ProductPresentationConfig } from '@/types/purchases';
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

interface EditPurchaseProductScreenProps {
  navigation: any;
  route: {
    params: {
      purchaseId: string;
      productId: string;
    };
  };
}

interface ProductPresentationWithQuantity extends ProductPresentationConfig {
  quantityOfPresentations: number;
}

export const EditPurchaseProductScreen: React.FC<EditPurchaseProductScreenProps> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { purchaseId, productId } = route.params;
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [looseUnits, setLooseUnits] = useState('0');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingPresentations, setLoadingPresentations] = useState(false);

  // Presentations
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [productPresentations, setProductPresentations] = useState<ProductPresentationWithQuantity[]>([]);
  const [showAddPresentation, setShowAddPresentation] = useState(false);
  const [selectedPresentationForQuantity, setSelectedPresentationForQuantity] = useState<string | null>(null);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  useEffect(() => {
    loadProductData();
    loadPresentations();
  }, []);

  const loadPresentations = async () => {
    setLoadingPresentations(true);
    try {
      const data = await presentationsApi.getPresentations();
      setPresentations(data);
    } catch (error: any) {
      console.error('Error loading presentations:', error);
    } finally {
      setLoadingPresentations(false);
    }
  };

  const loadProductData = async () => {
    try {
      setInitialLoading(true);
      const products = await purchasesService.getPurchaseProducts(purchaseId);
      const product = products.find((p) => p.id === productId);

      if (product) {
        setSku(product.sku);
        setName(product.name);
        setCost((product.costCents / 100).toFixed(2));
        setNotes('');

        if (product.preliminaryLooseUnits !== undefined && product.preliminaryLooseUnits !== null) {
          setLooseUnits(product.preliminaryLooseUnits.toString());
        } else {
          setLooseUnits('0');
        }

        // Load existing presentations from presentation history
        if (product.presentationHistory && product.presentationHistory.length > 0) {
          const preliminaryPresentations = product.presentationHistory
            .filter((ph: any) => ph.type === 'PRELIMINARY')
            .map((p: any) => {
              const factor = Number(p.factorToBase);
              if (!isFinite(factor) || isNaN(factor) || factor < 1) {
                console.error('❌ Invalid factorToBase in presentation history:', p);
                return {
                  presentationId: p.presentationId,
                  factorToBase: 1,
                  notes: p.notes || '',
                  quantityOfPresentations: 0,
                };
              }
              return {
                presentationId: p.presentationId,
                factorToBase: factor,
                notes: p.notes || '',
                quantityOfPresentations: 0,
              };
            });
          setProductPresentations(preliminaryPresentations);

          if (
            product.preliminaryPresentationQuantity !== undefined &&
            product.preliminaryPresentationQuantity !== null &&
            product.preliminaryPresentationQuantity > 0
          ) {
            if (preliminaryPresentations.length > 0) {
              const firstPresentationId = preliminaryPresentations[0].presentationId;
              setSelectedPresentationForQuantity(firstPresentationId);
              const updatedPresentations = preliminaryPresentations.map((p: any, i: number) => ({
                ...p,
                quantityOfPresentations: i === 0 ? product.preliminaryPresentationQuantity : 0,
              }));
              setProductPresentations(updatedPresentations);
            }
          }
        }
      } else {
        Alert.alert('Error', 'Producto no encontrado');
        navigation.goBack();
      }
    } catch (error: any) {
      console.error('Error loading product:', error);
      Alert.alert('Error', 'No se pudo cargar el producto');
      navigation.goBack();
    } finally {
      setInitialLoading(false);
    }
  };

  const handleAddPresentation = (
    presentationId: string,
    factorToBase: string,
    presentationNotes: string
  ) => {
    const factor = parseFloat(factorToBase);
    if (isNaN(factor) || !isFinite(factor) || factor < 1) {
      Alert.alert('Error', 'El factor de conversión debe ser un número válido mayor o igual a 1');
      return;
    }

    const presentation = presentations.find((p) => p.id === presentationId);
    if (!presentation) {
      Alert.alert('Error', 'Presentación no encontrada');
      return;
    }

    if (productPresentations.some((p) => p.presentationId === presentationId)) {
      Alert.alert('Error', 'Esta presentación ya fue agregada');
      return;
    }

    setProductPresentations([
      ...productPresentations,
      {
        presentationId,
        factorToBase: factor,
        notes: presentationNotes.trim() || undefined,
        quantityOfPresentations: 0,
      },
    ]);
    setShowAddPresentation(false);
  };

  const handleRemovePresentation = (presentationId: string) => {
    setProductPresentations(
      productPresentations.filter((p) => p.presentationId !== presentationId)
    );
    if (selectedPresentationForQuantity === presentationId) {
      setSelectedPresentationForQuantity(null);
    }
  };

  const calculateTotalStock = (): number => {
    const loose = parseInt(looseUnits) || 0;
    let presentationUnits = 0;

    if (selectedPresentationForQuantity) {
      const selectedPres = productPresentations.find(
        (p) => p.presentationId === selectedPresentationForQuantity
      );
      if (selectedPres) {
        presentationUnits = selectedPres.quantityOfPresentations * selectedPres.factorToBase;
      }
    }

    return loose + presentationUnits;
  };

  const handleUpdate = async () => {
    if (!sku.trim()) {
      Alert.alert('Error', 'Debe ingresar el SKU');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'Debe ingresar el nombre del producto');
      return;
    }

    const costValue = parseFloat(cost);
    if (isNaN(costValue) || costValue <= 0) {
      Alert.alert('Error', 'Debe ingresar un costo válido');
      return;
    }

    const looseUnitsValue = parseInt(looseUnits);
    if (isNaN(looseUnitsValue) || looseUnitsValue < 0) {
      Alert.alert('Error', 'Debe ingresar unidades sueltas válidas');
      return;
    }

    if (productPresentations.length === 0) {
      Alert.alert('Error', 'Debe agregar al menos una presentación');
      return;
    }

    const totalStock = calculateTotalStock();

    let preliminaryPresentationQuantity = 0;
    if (selectedPresentationForQuantity) {
      const selectedPres = productPresentations.find(
        (p) => p.presentationId === selectedPresentationForQuantity
      );
      if (selectedPres) {
        preliminaryPresentationQuantity = selectedPres.quantityOfPresentations;
      }
    }

    const validPresentations = productPresentations.map((p) => {
      const factor = Number(p.factorToBase);
      if (!isFinite(factor) || isNaN(factor) || factor < 1) {
        throw new Error(
          `Presentación inválida: el factor de conversión debe ser >= 1 (valor actual: ${p.factorToBase})`
        );
      }
      return {
        presentationId: p.presentationId,
        factorToBase: factor,
        notes: p.notes,
      };
    });

    setLoading(true);
    try {
      await purchasesService.updateProduct(purchaseId, productId, {
        sku: sku.trim(),
        name: name.trim(),
        costCents: Math.round(costValue * 100),
        preliminaryStock: totalStock,
        preliminaryLooseUnits: looseUnitsValue,
        preliminaryPresentationQuantity: preliminaryPresentationQuantity,
        presentations: validPresentations,
        notes: notes.trim() || undefined,
      });

      Alert.alert('Éxito', 'Producto actualizado correctamente', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      console.error('Error updating product:', error);
      Alert.alert('Error', error.message || 'No se pudo actualizar el producto');
    } finally {
      setLoading(false);
    }
  };

  const renderPresentationCard = (pp: ProductPresentationWithQuantity, index: number) => {
    const presentation = presentations.find((p) => p.id === pp.presentationId);
    const isSelected = selectedPresentationForQuantity === pp.presentationId;

    return (
      <Card key={pp.presentationId} variant="outlined" padding="medium" style={styles.presentationCard}>
        <View style={styles.presentationHeader}>
          <Title size="small">{presentation?.name || 'Presentación'}</Title>
          <IconButton
            icon="close-circle"
            onPress={() => handleRemovePresentation(pp.presentationId)}
            variant="ghost"
            size="small"
          />
        </View>

        <View style={styles.presentationDetails}>
          <Label color={theme.color.brand.accent}>Factor: {pp.factorToBase}x</Label>
          {pp.notes && (
            <Caption color="secondary" style={styles.presentationNotes}>
              {pp.notes}
            </Caption>
          )}
        </View>

        {/* Quantity Section */}
        <View style={styles.quantitySection}>
          <View style={styles.quantityHeaderRow}>
            <Label color="secondary">Cantidad de Presentaciones:</Label>
            <TouchableOpacity
              style={[
                styles.selectForQuantityButton,
                isSelected && styles.selectForQuantityButtonActive,
              ]}
              onPress={() => {
                if (isSelected) {
                  setSelectedPresentationForQuantity(null);
                  const newPresentations = [...productPresentations];
                  newPresentations[index].quantityOfPresentations = 0;
                  setProductPresentations(newPresentations);
                } else {
                  setSelectedPresentationForQuantity(pp.presentationId);
                  const newPresentations = productPresentations.map((p, i) => ({
                    ...p,
                    quantityOfPresentations: i === index ? p.quantityOfPresentations : 0,
                  }));
                  setProductPresentations(newPresentations);
                }
              }}
            >
              <Caption color={isSelected ? theme.color.text.inverse : theme.color.brand.accent}>
                {isSelected ? '✓ Seleccionada' : 'Seleccionar'}
              </Caption>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[
              styles.quantityInput,
              !isSelected && styles.quantityInputDisabled,
            ]}
            value={pp.quantityOfPresentations.toString()}
            onChangeText={(text) => {
              if (isSelected) {
                const newPresentations = [...productPresentations];
                const parsedValue = parseInt(text);
                newPresentations[index].quantityOfPresentations = isNaN(parsedValue) ? 0 : parsedValue;
                setProductPresentations(newPresentations);
              }
            }}
            placeholder={isSelected ? 'Ej: 5' : 'Seleccione esta presentación primero'}
            placeholderTextColor={theme.color.text.placeholder}
            keyboardType="number-pad"
            editable={isSelected}
          />
          {isSelected && pp.quantityOfPresentations > 0 && (
            <Caption color={theme.color.text.success} style={styles.calculationHint}>
              = {pp.quantityOfPresentations} × {pp.factorToBase} = {pp.quantityOfPresentations * pp.factorToBase} unidades
            </Caption>
          )}
        </View>
      </Card>
    );
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.primary} />
          <Body color="secondary" style={styles.loadingText}>Cargando producto...</Body>
        </View>
      </SafeAreaView>
    );
  }

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
          <Title size="large">Editar Producto</Title>
          <Body color="secondary">Datos preliminares del producto</Body>
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
        {/* SKU */}
        <Input
          label="SKU"
          value={sku}
          onChangeText={setSku}
          placeholder="Ej: PROD-001"
          required
          autoCapitalize="characters"
        />

        {/* Name */}
        <Input
          label="Nombre del Producto"
          value={name}
          onChangeText={setName}
          placeholder="Ej: Aceite de Oliva 500ml"
          required
        />

        {/* Cost */}
        <Input
          label="Costo Unitario (S/)"
          value={cost}
          onChangeText={setCost}
          placeholder="Ej: 15.50"
          keyboardType="decimal-pad"
          required
        />

        {/* Notes */}
        <Input
          label="Notas"
          value={notes}
          onChangeText={setNotes}
          placeholder="Notas adicionales sobre el producto"
          multiline
          numberOfLines={3}
        />

        {/* Presentations Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Label color="primary">
              Presentaciones <Label color={theme.color.text.danger}>*</Label>
            </Label>
            <Button
              title="+ Agregar"
              onPress={() => setShowAddPresentation(true)}
              variant="primary"
              size="small"
            />
          </View>

          {productPresentations.length === 0 ? (
            <Card variant="filled" padding="medium" style={styles.emptyPresentations}>
              <Body color="secondary" align="center">
                No hay presentaciones agregadas
              </Body>
              <Caption color="tertiary" align="center">
                Agrega al menos una presentación con su factor de conversión
              </Caption>
            </Card>
          ) : (
            <View style={styles.presentationsList}>
              {productPresentations.map((pp, index) => renderPresentationCard(pp, index))}
            </View>
          )}
        </View>

        {/* Loose Units */}
        <Input
          label="Unidades Sueltas"
          value={looseUnits}
          onChangeText={setLooseUnits}
          placeholder="Ej: 5"
          keyboardType="number-pad"
          required
          helperText="Cantidad de unidades individuales sueltas"
        />

        {/* Total Stock (Calculated) */}
        <View style={styles.section}>
          <Label color="secondary">Stock Total Preliminar (Calculado)</Label>
          <View style={styles.calculatedField}>
            <Title size="medium" color={theme.color.text.muted}>
              {calculateTotalStock()} unidades
            </Title>
          </View>
          <Caption color="tertiary">
            Unidades sueltas + (Cantidad de presentaciones × Factor de conversión)
          </Caption>
        </View>

        {/* Info Box */}
        <Card variant="filled" padding="medium" style={styles.infoBox}>
          <View style={styles.infoBoxContent}>
            <Ionicons name="information-circle" size={24} color={theme.color.icon.accent} />
            <Body color={theme.color.state.info.text} style={styles.infoBoxText}>
              Estos datos son preliminares. Podrás validar y completar la información del producto en la siguiente etapa.
            </Body>
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
          title="Actualizar Producto"
          onPress={handleUpdate}
          variant="primary"
          loading={loading}
          disabled={loading}
          style={styles.footerButton}
        />
      </View>

      {/* Add Presentation Modal */}
      <AddPresentationModal
        visible={showAddPresentation}
        presentations={presentations}
        onAdd={handleAddPresentation}
        onCancel={() => setShowAddPresentation(false)}
      />
    </SafeAreaView>
  );
};

// Add Presentation Modal Component
interface AddPresentationModalProps {
  visible: boolean;
  presentations: Presentation[];
  onAdd: (presentationId: string, factorToBase: string, notes: string) => void;
  onCancel: () => void;
}

const AddPresentationModal: React.FC<AddPresentationModalProps> = ({
  visible,
  presentations,
  onAdd,
  onCancel,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [selectedPresentationId, setSelectedPresentationId] = useState('');
  const [factorToBase, setFactorToBase] = useState('1');
  const [notes, setNotes] = useState('');

  const handleAdd = () => {
    if (!selectedPresentationId) {
      Alert.alert('Error', 'Debe seleccionar una presentación');
      return;
    }
    onAdd(selectedPresentationId, factorToBase, notes);
    setSelectedPresentationId('');
    setFactorToBase('1');
    setNotes('');
  };

  const handleCancel = () => {
    setSelectedPresentationId('');
    setFactorToBase('1');
    setNotes('');
    onCancel();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Title size="medium">Agregar Presentación</Title>
            <IconButton icon="close" onPress={handleCancel} variant="ghost" size="small" />
          </View>

          <ScrollView style={styles.modalBody}>
            <Label color="secondary" style={styles.modalLabel}>
              Seleccionar Presentación <Label color={theme.color.text.danger}>*</Label>
            </Label>
            <View style={styles.presentationOptions}>
              {presentations.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.presentationOption,
                    selectedPresentationId === p.id && styles.presentationOptionSelected,
                  ]}
                  onPress={() => setSelectedPresentationId(p.id)}
                >
                  <Body color={selectedPresentationId === p.id ? theme.color.brand.primary : 'primary'}>
                    {p.name}
                  </Body>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Factor de Conversión"
              value={factorToBase}
              onChangeText={setFactorToBase}
              placeholder="Ej: 12"
              keyboardType="number-pad"
              required
              helperText="Cuántas unidades base hay en esta presentación"
            />

            <Input
              label="Notas (Opcional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Ej: Caja de 12 unidades"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              title="Cancelar"
              onPress={handleCancel}
              variant="secondary"
              style={styles.modalButton}
            />
            <Button
              title="Agregar"
              onPress={handleAdd}
              variant="primary"
              style={styles.modalButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.space[4],
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
  },
  contentContainerTablet: {
    padding: theme.space[6],
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    marginBottom: theme.space[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space[3],
  },
  emptyPresentations: {
    alignItems: 'center',
    gap: theme.space[2],
  },
  presentationsList: {
    gap: theme.space[3],
  },
  presentationCard: {
    marginBottom: theme.space[2],
  },
  presentationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space[2],
  },
  presentationDetails: {
    marginBottom: theme.space[3],
  },
  presentationNotes: {
    marginTop: theme.space[1],
    fontStyle: 'italic',
  },
  quantitySection: {
    paddingTop: theme.space[3],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  quantityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space[2],
  },
  selectForQuantityButton: {
    backgroundColor: theme.color.brand.primarySoft,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1],
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.color.border.default,
  },
  selectForQuantityButtonActive: {
    backgroundColor: theme.color.brand.primary,
    borderColor: theme.color.brand.primary,
  },
  quantityInput: {
    backgroundColor: theme.color.surface.base,
    borderWidth: 1.5,
    borderColor: theme.color.border.subtle,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[2.5],
    fontSize: 15,
    color: theme.color.text.body,
  },
  quantityInputDisabled: {
    backgroundColor: theme.color.surface.subtle,
    opacity: 0.6,
  },
  calculationHint: {
    marginTop: theme.space[2],
    fontWeight: '600',
  },
  calculatedField: {
    backgroundColor: theme.color.surface.subtle,
    borderRadius: theme.radii.md,
    padding: theme.space[4],
    marginTop: theme.space[2],
    marginBottom: theme.space[2],
  },
  infoBox: {
    backgroundColor: theme.color.state.info.background,
    borderWidth: 1,
    borderColor: theme.color.state.info.border,
  },
  infoBoxContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space[3],
  },
  infoBoxText: {
    flex: 1,
    lineHeight: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.space[5],
  },
  modalContent: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii['2xl'],
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    ...theme.shadow.xl,
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
  modalLabel: {
    marginBottom: theme.space[2],
  },
  presentationOptions: {
    gap: theme.space[2],
    marginBottom: theme.space[4],
  },
  presentationOption: {
    backgroundColor: theme.color.surface.subtle,
    padding: theme.space[3],
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: theme.color.border.subtle,
  },
  presentationOptionSelected: {
    backgroundColor: theme.color.brand.primarySoft,
    borderColor: theme.color.brand.accent,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: theme.space[5],
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
    gap: theme.space[3],
  },
  modalButton: {
    flex: 1,
  },
});

export default EditPurchaseProductScreen;
