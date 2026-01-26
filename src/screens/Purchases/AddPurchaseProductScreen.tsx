import React, { useState, useEffect } from 'react';
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
import { presentationsApi } from '@/services/api/presentations';
import type { Presentation } from '@/services/api/presentations';
import type { ProductPresentationConfig } from '@/types/purchases';

interface AddPurchaseProductScreenProps {
  navigation: any;
  route: {
    params: {
      purchaseId: string;
    };
  };
}

export const AddPurchaseProductScreen: React.FC<AddPurchaseProductScreenProps> = ({
  navigation,
  route,
}) => {
  const { purchaseId } = route.params;
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [looseUnits, setLooseUnits] = useState('0'); // Unidades sueltas
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState(''); // ✅ Campo guía/referencia
  const [loading, setLoading] = useState(false);
  const [loadingPresentations, setLoadingPresentations] = useState(false);

  // Presentations
  interface ProductPresentationWithQuantity extends ProductPresentationConfig {
    quantityOfPresentations: number;
  }
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [productPresentations, setProductPresentations] = useState<
    ProductPresentationWithQuantity[]
  >([]);
  const [showAddPresentation, setShowAddPresentation] = useState(false);
  const [selectedPresentationForQuantity, setSelectedPresentationForQuantity] = useState<
    string | null
  >(null);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  useEffect(() => {
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

  const handleAddPresentation = (
    presentationId: string,
    factorToBase: string,
    presentationNotes: string
  ) => {
    const factor = parseFloat(factorToBase);
    if (isNaN(factor) || factor <= 0) {
      Alert.alert('Error', 'El factor de conversión debe ser un número válido mayor a 0');
      return;
    }

    const presentation = presentations.find((p) => p.id === presentationId);
    if (!presentation) {
      Alert.alert('Error', 'Presentación no encontrada');
      return;
    }

    // Check if presentation already exists
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
    // If this was the selected presentation for quantity, clear it
    if (selectedPresentationForQuantity === presentationId) {
      setSelectedPresentationForQuantity(null);
    }
  };

  // Calculate total stock automatically
  const calculateTotalStock = (): number => {
    const loose = parseInt(looseUnits) || 0;
    let presentationUnits = 0;

    // Only calculate from the selected presentation for quantity
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

  const handleAdd = async () => {
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

    // Validación de presentaciones - ahora es opcional
    // if (productPresentations.length === 0) {
    //   Alert.alert('Error', 'Debe agregar al menos una presentación');
    //   return;
    // }

    const totalStock = calculateTotalStock();

    // Get the quantity of presentations from the selected presentation
    let preliminaryPresentationQuantity = 0;
    if (selectedPresentationForQuantity) {
      const selectedPres = productPresentations.find(
        (p) => p.presentationId === selectedPresentationForQuantity
      );
      if (selectedPres) {
        preliminaryPresentationQuantity = selectedPres.quantityOfPresentations;
      }
    }

    setLoading(true);
    try {
      await purchasesService.addProduct(purchaseId, {
        sku: sku.trim(),
        name: name.trim(),
        costCents: Math.round(costValue * 100),
        preliminaryStock: totalStock,
        preliminaryLooseUnits: looseUnitsValue,
        preliminaryPresentationQuantity: preliminaryPresentationQuantity,
        presentations: productPresentations.length > 0 ? productPresentations.map((p) => ({
          presentationId: p.presentationId,
          factorToBase: p.factorToBase,
          notes: p.notes,
        })) : undefined,
        notes: notes.trim() || undefined,
        reference: reference.trim() || undefined, // ✅ Agregar referencia/guía
      });

      Alert.alert('Éxito', 'Producto agregado correctamente', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      console.error('Error adding product:', error);
      Alert.alert('Error', error.message || 'No se pudo agregar el producto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>Agregar Producto</Text>
          <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
            Datos preliminares del producto
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
      >
        {/* SKU */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>
            SKU <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={sku}
            onChangeText={setSku}
            placeholder="Ej: PROD-001"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
          />
        </View>

        {/* Name */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>
            Nombre del Producto <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={name}
            onChangeText={setName}
            placeholder="Ej: Aceite de Oliva 500ml"
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* Cost */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>
            Costo Unitario (S/) <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={cost}
            onChangeText={setCost}
            placeholder="Ej: 15.50"
            placeholderTextColor="#94A3B8"
            keyboardType="decimal-pad"
          />
        </View>

        {/* Reference/Guide */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>Guía/Referencia</Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={reference}
            onChangeText={setReference}
            placeholder="Ej: Guía de remisión, número de lote, etc."
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
            placeholder="Notas adicionales sobre el producto"
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Presentations Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.label, isTablet && styles.labelTablet]}>
              Presentaciones (Opcional)
            </Text>
            <TouchableOpacity
              style={[styles.addPresentationButton, isTablet && styles.addPresentationButtonTablet]}
              onPress={() => setShowAddPresentation(true)}
            >
              <Text style={styles.addPresentationButtonText}>+ Agregar</Text>
            </TouchableOpacity>
          </View>

          {productPresentations.length === 0 ? (
            <View style={styles.emptyPresentations}>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No hay presentaciones agregadas
              </Text>
              <Text style={[styles.hint, isTablet && styles.hintTablet]}>
                Puedes agregar presentaciones con su factor de conversión (opcional)
              </Text>
            </View>
          ) : (
            <View style={styles.presentationsList}>
              {productPresentations.map((pp, index) => {
                const presentation = presentations.find((p) => p.id === pp.presentationId);
                return (
                  <View
                    key={pp.presentationId}
                    style={[styles.presentationCard, isTablet && styles.presentationCardTablet]}
                  >
                    <View style={styles.presentationHeader}>
                      <Text
                        style={[styles.presentationName, isTablet && styles.presentationNameTablet]}
                      >
                        {presentation?.name || 'Presentación'}
                      </Text>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemovePresentation(pp.presentationId)}
                      >
                        <Text style={styles.removeButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.presentationDetails}>
                      <Text
                        style={[
                          styles.presentationFactor,
                          isTablet && styles.presentationFactorTablet,
                        ]}
                      >
                        Factor: {pp.factorToBase}x
                      </Text>
                      {pp.notes && (
                        <Text
                          style={[
                            styles.presentationNotes,
                            isTablet && styles.presentationNotesTablet,
                          ]}
                        >
                          {pp.notes}
                        </Text>
                      )}
                    </View>

                    {/* Quantity of Presentations - Only for selected presentation */}
                    <View style={styles.quantitySection}>
                      <View style={styles.quantityHeaderRow}>
                        <Text
                          style={[styles.quantityLabel, isTablet && styles.quantityLabelTablet]}
                        >
                          Cantidad de Presentaciones:
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.selectForQuantityButton,
                            selectedPresentationForQuantity === pp.presentationId &&
                              styles.selectForQuantityButtonActive,
                          ]}
                          onPress={() => {
                            if (selectedPresentationForQuantity === pp.presentationId) {
                              // Deselect
                              setSelectedPresentationForQuantity(null);
                              const newPresentations = [...productPresentations];
                              newPresentations[index].quantityOfPresentations = 0;
                              setProductPresentations(newPresentations);
                            } else {
                              // Select this presentation and clear others
                              setSelectedPresentationForQuantity(pp.presentationId);
                              const newPresentations = productPresentations.map((p, i) => ({
                                ...p,
                                quantityOfPresentations:
                                  i === index ? p.quantityOfPresentations : 0,
                              }));
                              setProductPresentations(newPresentations);
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.selectForQuantityButtonText,
                              selectedPresentationForQuantity === pp.presentationId &&
                                styles.selectForQuantityButtonTextActive,
                            ]}
                          >
                            {selectedPresentationForQuantity === pp.presentationId
                              ? '✓ Seleccionada'
                              : 'Seleccionar'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={[
                          styles.quantityInput,
                          isTablet && styles.quantityInputTablet,
                          selectedPresentationForQuantity !== pp.presentationId &&
                            styles.quantityInputDisabled,
                        ]}
                        value={pp.quantityOfPresentations.toString()}
                        onChangeText={(text) => {
                          if (selectedPresentationForQuantity === pp.presentationId) {
                            const newPresentations = [...productPresentations];
                            const parsedValue = parseInt(text);
                            newPresentations[index].quantityOfPresentations = isNaN(parsedValue)
                              ? 0
                              : parsedValue;
                            setProductPresentations(newPresentations);
                          }
                        }}
                        placeholder={
                          selectedPresentationForQuantity === pp.presentationId
                            ? 'Ej: 5'
                            : 'Seleccione esta presentación primero'
                        }
                        placeholderTextColor="#94A3B8"
                        keyboardType="number-pad"
                        editable={selectedPresentationForQuantity === pp.presentationId}
                      />
                      {selectedPresentationForQuantity === pp.presentationId &&
                        pp.quantityOfPresentations > 0 && (
                          <Text
                            style={[
                              styles.hint,
                              isTablet && styles.hintTablet,
                              styles.calculationHint,
                            ]}
                          >
                            = {pp.quantityOfPresentations} × {pp.factorToBase} ={' '}
                            {pp.quantityOfPresentations * pp.factorToBase} unidades
                          </Text>
                        )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Add Presentation Modal */}
        {showAddPresentation && (
          <AddPresentationModal
            presentations={presentations}
            onAdd={handleAddPresentation}
            onCancel={() => setShowAddPresentation(false)}
            isTablet={isTablet}
          />
        )}

        {/* Loose Units */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>
            Unidades Sueltas
          </Text>
          <TextInput
            style={[styles.input, isTablet && styles.inputTablet]}
            value={looseUnits}
            onChangeText={setLooseUnits}
            placeholder="Ej: 5"
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
          />
          <Text style={[styles.hint, isTablet && styles.hintTablet]}>
            Cantidad de unidades individuales sueltas
          </Text>
        </View>

        {/* Total Stock (Calculated - Read Only) */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.labelTablet]}>
            Stock Total Preliminar (Calculado)
          </Text>
          <View style={[styles.input, isTablet && styles.inputTablet, styles.calculatedField]}>
            <Text style={[styles.calculatedText, isTablet && styles.calculatedTextTablet]}>
              {calculateTotalStock()} unidades
            </Text>
          </View>
          <Text style={[styles.hint, isTablet && styles.hintTablet]}>
            Unidades sueltas + (Cantidad de presentaciones × Factor de conversión)
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={[styles.infoIcon, isTablet && styles.infoIconTablet]}>ℹ️</Text>
          <Text style={[styles.infoText, isTablet && styles.infoTextTablet]}>
            Estos datos son preliminares. Podrás validar y completar la información del producto en
            la siguiente etapa.
          </Text>
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
            styles.addButton,
            isTablet && styles.addButtonTablet,
            loading && styles.addButtonDisabled,
          ]}
          onPress={handleAdd}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.addButtonText, isTablet && styles.addButtonTextTablet]}>
              Agregar Producto
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
  hint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  hintTablet: {
    fontSize: 14,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 24,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoIconTablet: {
    fontSize: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  infoTextTablet: {
    fontSize: 15,
    lineHeight: 22,
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
  addButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  addButtonTablet: {
    paddingVertical: 16,
    borderRadius: 14,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonTextTablet: {
    fontSize: 17,
  },
  selector: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorTablet: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  selectorText: {
    fontSize: 15,
    color: '#1E293B',
    flex: 1,
  },
  selectorTextTablet: {
    fontSize: 17,
  },
  selectorPlaceholder: {
    color: '#94A3B8',
  },
  selectorIcon: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
  },
  optionsList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 200,
  },
  optionsListTablet: {
    borderRadius: 14,
    maxHeight: 300,
  },
  optionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionItemTablet: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionItemSelected: {
    backgroundColor: '#EEF2FF',
  },
  optionText: {
    fontSize: 15,
    color: '#1E293B',
  },
  optionTextTablet: {
    fontSize: 17,
  },
  optionTextSelected: {
    color: '#6366F1',
    fontWeight: '600',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addPresentationButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addPresentationButtonTablet: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addPresentationButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyPresentations: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  emptyTextTablet: {
    fontSize: 16,
  },
  presentationsList: {
    gap: 12,
  },
  presentationItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presentationItemTablet: {
    padding: 20,
    borderRadius: 14,
  },
  presentationInfo: {
    flex: 1,
  },
  presentationName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  presentationNameTablet: {
    fontSize: 17,
  },
  presentationFactor: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '500',
  },
  presentationFactorTablet: {
    fontSize: 15,
  },
  presentationNotes: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    fontStyle: 'italic',
  },
  presentationNotesTablet: {
    fontSize: 14,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  removeButtonText: {
    fontSize: 18,
    color: '#EF4444',
    fontWeight: '600',
  },
  calculatedField: {
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
  },
  calculatedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  calculatedTextTablet: {
    fontSize: 17,
  },
  presentationCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  presentationCardTablet: {
    padding: 20,
    borderRadius: 14,
  },
  presentationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  presentationDetails: {
    marginBottom: 12,
  },
  quantitySection: {
    marginTop: 8,
  },
  quantityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  quantityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  quantityLabelTablet: {
    fontSize: 15,
  },
  selectForQuantityButton: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  selectForQuantityButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  selectForQuantityButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  selectForQuantityButtonTextActive: {
    color: '#FFFFFF',
  },
  quantityInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1E293B',
  },
  quantityInputTablet: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
  quantityInputDisabled: {
    backgroundColor: '#F8FAFC',
    opacity: 0.6,
  },
  calculationHint: {
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
  },
});

// Add Presentation Modal Component
interface AddPresentationModalProps {
  presentations: Presentation[];
  onAdd: (presentationId: string, factorToBase: string, notes: string) => void;
  onCancel: () => void;
  isTablet: boolean;
}

const AddPresentationModal: React.FC<AddPresentationModalProps> = ({
  presentations,
  onAdd,
  onCancel,
  isTablet,
}) => {
  const [selectedPresentationId, setSelectedPresentationId] = useState('');
  const [factorToBase, setFactorToBase] = useState('');
  const [presentationNotes, setPresentationNotes] = useState('');
  const [showPresentationSelector, setShowPresentationSelector] = useState(false);

  const selectedPresentation = presentations.find((p) => p.id === selectedPresentationId);

  const handleAdd = () => {
    if (!selectedPresentationId) {
      Alert.alert('Error', 'Debe seleccionar una presentación');
      return;
    }
    if (!factorToBase.trim()) {
      Alert.alert('Error', 'Debe ingresar el factor de conversión');
      return;
    }
    onAdd(selectedPresentationId, factorToBase, presentationNotes);
    // Reset form
    setSelectedPresentationId('');
    setFactorToBase('');
    setPresentationNotes('');
  };

  return (
    <View style={modalStyles.overlay}>
      <View style={[modalStyles.modal, isTablet && modalStyles.modalTablet]}>
        <View style={modalStyles.header}>
          <Text style={[modalStyles.title, isTablet && modalStyles.titleTablet]}>
            Agregar Presentación
          </Text>
          <TouchableOpacity onPress={onCancel} style={modalStyles.closeButton}>
            <Text style={modalStyles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={modalStyles.content}>
          {/* Presentation Selector */}
          <View style={modalStyles.section}>
            <Text style={[modalStyles.label, isTablet && modalStyles.labelTablet]}>
              Presentación <Text style={modalStyles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[modalStyles.selector, isTablet && modalStyles.selectorTablet]}
              onPress={() => setShowPresentationSelector(!showPresentationSelector)}
            >
              <Text
                style={[
                  modalStyles.selectorText,
                  isTablet && modalStyles.selectorTextTablet,
                  !selectedPresentation && modalStyles.selectorPlaceholder,
                ]}
              >
                {selectedPresentation ? selectedPresentation.name : 'Seleccionar presentación'}
              </Text>
              <Text style={modalStyles.selectorIcon}>{showPresentationSelector ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showPresentationSelector && (
              <View style={[modalStyles.optionsList, isTablet && modalStyles.optionsListTablet]}>
                {presentations.map((presentation) => (
                  <TouchableOpacity
                    key={presentation.id}
                    style={[
                      modalStyles.optionItem,
                      isTablet && modalStyles.optionItemTablet,
                      selectedPresentationId === presentation.id && modalStyles.optionItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedPresentationId(presentation.id);
                      setShowPresentationSelector(false);
                    }}
                  >
                    <Text
                      style={[
                        modalStyles.optionText,
                        isTablet && modalStyles.optionTextTablet,
                        selectedPresentationId === presentation.id &&
                          modalStyles.optionTextSelected,
                      ]}
                    >
                      {presentation.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Factor to Base */}
          <View style={modalStyles.section}>
            <Text style={[modalStyles.label, isTablet && modalStyles.labelTablet]}>
              Factor de Conversión <Text style={modalStyles.required}>*</Text>
            </Text>
            <TextInput
              style={[modalStyles.input, isTablet && modalStyles.inputTablet]}
              value={factorToBase}
              onChangeText={setFactorToBase}
              placeholder="Ej: 24 (1 caja = 24 unidades)"
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
            />
            <Text style={[modalStyles.hint, isTablet && modalStyles.hintTablet]}>
              Cuántas unidades base equivalen a esta presentación
            </Text>
          </View>

          {/* Notes */}
          <View style={modalStyles.section}>
            <Text style={[modalStyles.label, isTablet && modalStyles.labelTablet]}>Notas</Text>
            <TextInput
              style={[modalStyles.input, modalStyles.textArea, isTablet && modalStyles.inputTablet]}
              value={presentationNotes}
              onChangeText={setPresentationNotes}
              placeholder="Notas sobre esta presentación (opcional)"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={2}
            />
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[modalStyles.footer, isTablet && modalStyles.footerTablet]}>
          <TouchableOpacity
            style={[modalStyles.cancelButton, isTablet && modalStyles.cancelButtonTablet]}
            onPress={onCancel}
          >
            <Text
              style={[modalStyles.cancelButtonText, isTablet && modalStyles.cancelButtonTextTablet]}
            >
              Cancelar
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[modalStyles.addButton, isTablet && modalStyles.addButtonTablet]}
            onPress={handleAdd}
          >
            <Text style={[modalStyles.addButtonText, isTablet && modalStyles.addButtonTextTablet]}>
              Agregar
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
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
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalTablet: {
    borderRadius: 20,
    maxWidth: 600,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  titleTablet: {
    fontSize: 20,
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
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 20,
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
    backgroundColor: '#F8FAFC',
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
  textArea: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
  },
  hintTablet: {
    fontSize: 14,
  },
  selector: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorTablet: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  selectorText: {
    fontSize: 15,
    color: '#1E293B',
    flex: 1,
  },
  selectorTextTablet: {
    fontSize: 17,
  },
  selectorPlaceholder: {
    color: '#94A3B8',
  },
  selectorIcon: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
  },
  optionsList: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 200,
  },
  optionsListTablet: {
    borderRadius: 14,
    maxHeight: 250,
  },
  optionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionItemTablet: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionItemSelected: {
    backgroundColor: '#EEF2FF',
  },
  optionText: {
    fontSize: 15,
    color: '#1E293B',
  },
  optionTextTablet: {
    fontSize: 17,
  },
  optionTextSelected: {
    color: '#6366F1',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  footerTablet: {
    padding: 24,
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelButtonTablet: {
    paddingVertical: 14,
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
  addButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  addButtonTablet: {
    paddingVertical: 14,
    borderRadius: 14,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addButtonTextTablet: {
    fontSize: 17,
  },
});

export default AddPurchaseProductScreen;
