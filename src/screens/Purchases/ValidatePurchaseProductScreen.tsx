/**
 * ValidatePurchaseProductScreen - Validar Producto de Compra
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
  Image,
  Modal,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { purchasesService } from '@/services/api';
import { inventoryApi } from '@/services/api/inventory';
import { presentationsApi } from '@/services/api/presentations';
import { filesApi } from '@/services/api/files';
import { PurchaseProduct, PurchaseProductStatus } from '@/types/purchases';
import type { Warehouse, WarehouseArea } from '@/services/api/inventory';
import type { Presentation } from '@/services/api/presentations';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { PhotoCapture } from '@/components/Purchases/PhotoCapture';
import { SignatureCapture } from '@/components/Purchases/SignatureCapture';
import {
  RecurrentProductModal,
  RecurrentProductCandidate,
} from '@/components/Purchases/RecurrentProductModal';
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
  Badge,
} from '@/design-system';

interface ValidatePurchaseProductScreenProps {
  navigation: any;
  route: {
    params: {
      purchaseId: string;
      productId: string;
    };
  };
}

// Helper function to copy text to clipboard
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (Platform.OS === 'web') {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      }
    } else {
      await Clipboard.setStringAsync(text);
      return true;
    }
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return false;
  }
};

interface ValidatedPresentation {
  presentationId: string;
  presentationName: string;
  factorToBase: number;
  notes: string;
  quantityOfPresentations: number;
}

export const ValidatePurchaseProductScreen: React.FC<ValidatePurchaseProductScreenProps> = ({
  navigation,
  route,
}) => {
  const { purchaseId, productId } = route.params;
  const { currentSite } = useAuthStore();
  const { selectedSite } = useTenantStore();
  const [product, setProduct] = useState<PurchaseProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Validation data - Editable fields
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [costCents, setCostCents] = useState('');
  const [looseUnits, setLooseUnits] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [selectedArea, setSelectedArea] = useState<WarehouseArea | null>(null);
  const [barcode, setBarcode] = useState('');
  const [validationNotes, setValidationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [weightValue, setWeightValue] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'g'>('kg');

  // Photo and Signature
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [signatureUri, setSignatureUri] = useState<string | undefined>();
  const [productPhotoUri, setProductPhotoUri] = useState<string | undefined>();
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  const [showProductPhotoCapture, setShowProductPhotoCapture] = useState(false);

  // Recurrence state
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [recurrentCandidates, setRecurrentCandidates] = useState<RecurrentProductCandidate[]>([]);
  const [recurrenceMessage, setRecurrenceMessage] = useState<string>('');
  const [recurrenceAction, setRecurrenceAction] = useState<'MERGE' | 'CREATE_NEW' | null>(null);
  const [selectedExistingProductId, setSelectedExistingProductId] = useState<string | null>(null);

  // Presentations
  const [validatedPresentations, setValidatedPresentations] = useState<ValidatedPresentation[]>([]);
  const [showAddPresentation, setShowAddPresentation] = useState(false);
  const [newPresentationId, setNewPresentationId] = useState('');
  const [selectedPresentationForQuantity, setSelectedPresentationForQuantity] = useState<string | null>(null);

  // Lists
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [areas, setAreas] = useState<WarehouseArea[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);

  // UI State
  const [showWarehouseSelector, setShowWarehouseSelector] = useState(false);
  const [showAreaSelector, setShowAreaSelector] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const effectiveSite = selectedSite || currentSite;

      if (!effectiveSite) {
        Alert.alert('Error', 'No hay una sede seleccionada');
        navigation.goBack();
        return;
      }

      const [productsData, warehousesData, presentationsData] = await Promise.all([
        purchasesService.getPurchaseProducts(purchaseId),
        inventoryApi.getWarehouses(),
        presentationsApi.getPresentations(),
      ]);

      const productData = productsData.find((p) => p.id === productId);
      if (!productData) {
        Alert.alert('Error', 'Producto no encontrado');
        navigation.goBack();
        return;
      }

      const filteredWarehouses = warehousesData.filter(
        (warehouse) => warehouse.siteId === effectiveSite.id
      );

      setProduct(productData);
      setWarehouses(filteredWarehouses);
      setPresentations(presentationsData);

      // Load editable fields
      setSku(productData.sku || '');
      setName(productData.name || '');
      setCostCents(productData.costCents ? (productData.costCents / 100).toFixed(2) : '');

      if (productData.validatedLooseUnits !== undefined && productData.validatedLooseUnits !== null) {
        setLooseUnits(productData.validatedLooseUnits.toString());
      } else if (productData.preliminaryLooseUnits !== undefined && productData.preliminaryLooseUnits !== null) {
        setLooseUnits(productData.preliminaryLooseUnits.toString());
      } else {
        setLooseUnits('0');
      }

      if (productData.warehouseId) {
        const warehouse = warehousesData.find((w) => w.id === productData.warehouseId);
        if (warehouse) {
          setSelectedWarehouse(warehouse);
          try {
            const areasData = await inventoryApi.getWarehouseAreas(warehouse.id);
            setAreas(areasData);
            if (productData.areaId) {
              const area = areasData.find((a) => a.id === productData.areaId);
              if (area) setSelectedArea(area);
            }
          } catch (error: any) {
            setAreas([]);
          }
        }
      }

      // Load presentations from presentationHistory
      if (productData.presentationHistory && productData.presentationHistory.length > 0) {
        const preliminaryPresentations: ValidatedPresentation[] = productData.presentationHistory
          .filter((ph) => ph.type === 'PRELIMINARY')
          .map((ph) => ({
            presentationId: ph.presentationId,
            presentationName: ph.presentation?.name || 'Presentación',
            factorToBase: ph.factorToBase,
            notes: ph.notes || '',
            quantityOfPresentations: 0,
          }));
        setValidatedPresentations(preliminaryPresentations);

        if (productData.validatedPresentationQuantity !== undefined && productData.validatedPresentationQuantity > 0) {
          if (preliminaryPresentations.length > 0) {
            const firstPresentationId = preliminaryPresentations[0].presentationId;
            setSelectedPresentationForQuantity(firstPresentationId);
            const updatedPresentations = preliminaryPresentations.map((p, i) => ({
              ...p,
              quantityOfPresentations: i === 0 ? (productData.validatedPresentationQuantity ?? 0) : 0,
            }));
            setValidatedPresentations(updatedPresentations);
          }
        } else if (productData.preliminaryPresentationQuantity !== undefined && productData.preliminaryPresentationQuantity > 0) {
          if (preliminaryPresentations.length > 0) {
            const firstPresentationId = preliminaryPresentations[0].presentationId;
            setSelectedPresentationForQuantity(firstPresentationId);
            const updatedPresentations = preliminaryPresentations.map((p, i) => ({
              ...p,
              quantityOfPresentations: i === 0 ? (productData.preliminaryPresentationQuantity ?? 0) : 0,
            }));
            setValidatedPresentations(updatedPresentations);
          }
        }
      }

      if (productData.barcode) setBarcode(productData.barcode);
      if (productData.validationNotes) setValidationNotes(productData.validationNotes);
      // Cargar peso siempre en gramos
      if (productData.weightKg !== undefined && productData.weightKg !== null) {
        setWeightValue((productData.weightKg * 1000).toString());
        setWeightUnit('g');
      }

      setPhotoUri(undefined);
      setSignatureUri(undefined);
      setProductPhotoUri(undefined);
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudo cargar los datos');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleStartValidation = async () => {
    if (product?.status !== PurchaseProductStatus.PRELIMINARY) return;

    setActionLoading(true);
    try {
      await purchasesService.startValidation(purchaseId, productId);
      await loadData();
      Alert.alert('Éxito', 'Validación iniciada');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo iniciar la validación');
    } finally {
      setActionLoading(false);
    }
  };

  const getWeightInKg = (): number | undefined => {
    if (!weightValue) return undefined;
    const value = parseFloat(weightValue);
    if (isNaN(value) || value < 0) return undefined;
    if (weightUnit === 'g') return Math.round((value / 1000) * 1000) / 1000;
    return Math.round(value * 1000) / 1000;
  };

  const calculateTotalStock = (): number => {
    const loose = parseInt(looseUnits) || 0;
    let presentationUnits = 0;

    if (selectedPresentationForQuantity) {
      const selectedPres = validatedPresentations.find(
        (p) => p.presentationId === selectedPresentationForQuantity
      );
      if (selectedPres) {
        presentationUnits = selectedPres.quantityOfPresentations * selectedPres.factorToBase;
      }
    }

    return loose + presentationUnits;
  };

  const uploadValidationFiles = async (): Promise<{
    photoUrl?: string;
    signatureUrl?: string;
    productPhotoUrl?: string;
  }> => {
    const result: { photoUrl?: string; signatureUrl?: string; productPhotoUrl?: string } = {};

    try {
      if (photoUri) {
        const photoFilename = `validacion-${Date.now()}.jpg`;
        const photoResponse = await filesApi.uploadByCategory(
          photoUri, photoFilename, 'PURCHASES_VALIDACIONES_FOTOS', purchaseId, 'image/jpeg'
        );
        result.photoUrl = photoResponse.url;
      }

      if (signatureUri) {
        const signatureFilename = `firma-${Date.now()}.png`;
        const signatureResponse = await filesApi.uploadByCategory(
          signatureUri, signatureFilename, 'PURCHASES_VALIDACIONES_FIRMAS', purchaseId, 'image/png'
        );
        result.signatureUrl = signatureResponse.url;
      }

      if (productPhotoUri && product?.productId) {
        const productPhotoFilename = `producto-${Date.now()}.jpg`;
        const productPhotoResponse = await filesApi.uploadProductImage(
          productPhotoUri, product.productId, productPhotoFilename, 'image/jpeg'
        );
        result.productPhotoUrl = productPhotoResponse.url;
      }

      return result;
    } catch (error: any) {
      throw new Error(error.message || 'No se pudieron subir las fotos de validación');
    }
  };

  const checkRecurrentProducts = async () => {
    if (!product || !sku.trim()) return false;

    try {
      const response = await purchasesService.checkRecurrence(purchaseId, productId, {
        sku: sku.trim(),
        barcode: barcode.trim() || undefined,
      });

      if (response.hasRecurrentProducts && response.candidates.length > 0) {
        setRecurrentCandidates(response.candidates);
        setRecurrenceMessage(response.message || 'Se encontraron productos similares');
        setShowRecurrenceModal(true);
        return true;
      } else {
        setRecurrenceAction('CREATE_NEW');
        setSelectedExistingProductId(null);
        return false;
      }
    } catch (error: any) {
      setRecurrenceAction('CREATE_NEW');
      setSelectedExistingProductId(null);
      return false;
    }
  };

  const handleCloseValidation = async () => {
    if (!product) return;

    // Validations
    if (!sku.trim()) { Alert.alert('Error', 'El SKU es obligatorio'); return; }
    if (!name.trim()) { Alert.alert('Error', 'El nombre es obligatorio'); return; }
    if (!barcode.trim()) { Alert.alert('Error', 'El código de barras es obligatorio'); return; }

    const costValue = parseFloat(costCents);
    if (isNaN(costValue) || costValue <= 0) { Alert.alert('Error', 'Debe ingresar un costo válido'); return; }

    const looseUnitsValue = parseInt(looseUnits);
    if (isNaN(looseUnitsValue) || looseUnitsValue < 0) { Alert.alert('Error', 'Debe ingresar unidades sueltas válidas'); return; }

    const weightKg = getWeightInKg();
    if (weightKg === undefined || weightKg <= 0) { Alert.alert('Error', 'El peso es obligatorio y debe ser mayor a 0'); return; }

    if (!selectedWarehouse) { Alert.alert('Error', 'Debe seleccionar un almacén'); return; }
    if (!photoUri) { Alert.alert('Error', 'La foto de validación es obligatoria'); return; }
    if (!productPhotoUri) { Alert.alert('Error', 'La foto del producto es obligatoria'); return; }
    if (!signatureUri) { Alert.alert('Error', 'La firma de validación es obligatoria'); return; }

    if (validatedPresentations.length > 0) {
      for (const pres of validatedPresentations) {
        if (!pres.presentationId || pres.factorToBase <= 0) {
          Alert.alert('Error', 'Todas las presentaciones deben tener un factor válido');
          return;
        }
      }
    }

    setActionLoading(true);
    try {
      const hasRecurrent = await checkRecurrentProducts();
      if (hasRecurrent) {
        setActionLoading(false);
        return;
      }
    } catch (error: any) {
      setActionLoading(false);
      return;
    }
    setActionLoading(false);

    Alert.alert(
      'Cerrar Validación',
      '¿Está seguro de cerrar la validación? El producto se activará y se agregará al inventario.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar Validación', style: 'destructive', onPress: performCloseValidation },
      ]
    );
  };

  const performCloseValidation = async () => {
    if (!product || !selectedWarehouse) return;

    const costValue = parseFloat(costCents);
    const looseUnitsValue = parseInt(looseUnits);
    const totalStock = calculateTotalStock();

    let validatedPresentationQuantity = 0;
    if (selectedPresentationForQuantity) {
      const selectedPres = validatedPresentations.find(
        (p) => p.presentationId === selectedPresentationForQuantity
      );
      if (selectedPres) validatedPresentationQuantity = selectedPres.quantityOfPresentations;
    }

    const warehouseId = selectedWarehouse.id;

    setActionLoading(true);
    try {
      const uploadedFiles = await uploadValidationFiles();

      const validationData = {
        sku: sku.trim(),
        name: name.trim(),
        costCents: Math.round(costValue * 100),
        preliminaryStock: product.preliminaryStock,
        validatedStock: totalStock,
        validatedLooseUnits: looseUnitsValue,
        validatedPresentationQuantity: validatedPresentationQuantity,
        warehouseId: warehouseId,
        areaId: selectedArea?.id,
        presentations: validatedPresentations.length > 0 ? validatedPresentations.map((p) => ({
          presentationId: p.presentationId,
          factorToBase: Number(p.factorToBase),
          notes: p.notes.trim() || undefined,
        })) : undefined,
        barcode: barcode.trim() || undefined,
        weightKg: getWeightInKg(),
        photoUrl: uploadedFiles.photoUrl,
        signatureUrl: uploadedFiles.signatureUrl,
        validationNotes: validationNotes.trim() || undefined,
        recurrenceAction: recurrenceAction || 'CREATE_NEW',
        existingProductId: selectedExistingProductId || undefined,
        recurrenceMetadata: recurrentCandidates.length > 0 ? {
          candidatesReviewed: recurrentCandidates.length,
          userDecision: recurrenceAction === 'MERGE' ? 'Usuario confirmó producto existente' : 'Usuario creó producto nuevo',
          matchConfidence: 95,
        } : undefined,
      };

      const response = await purchasesService.validateProductV2(purchaseId, productId, validationData);
      await purchasesService.closeValidation(purchaseId, productId);

      const successMessage = response.action === 'MERGED'
        ? `Stock agregado al producto existente: ${response.product.title}. Validación cerrada.`
        : 'Validación cerrada. Producto nuevo creado y activado.';

      Alert.alert('Éxito', successMessage, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);

      setRecurrenceAction(null);
      setSelectedExistingProductId(null);
      setRecurrentCandidates([]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo cerrar la validación');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Error', 'Debe ingresar la razón de rechazo');
      return;
    }

    setActionLoading(true);
    try {
      await purchasesService.rejectProduct(purchaseId, productId, {
        rejectionReason: rejectionReason.trim(),
      });
      Alert.alert('Éxito', 'Producto rechazado', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo rechazar el producto');
    } finally {
      setActionLoading(false);
      setShowRejectDialog(false);
    }
  };

  const handleRecurrenceConfirm = (productId: string) => {
    setRecurrenceAction('MERGE');
    setSelectedExistingProductId(productId);
    setShowRecurrenceModal(false);

    Alert.alert(
      'Cerrar Validación',
      '¿Está seguro? El stock se sumará al producto existente.',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => { setRecurrenceAction(null); setSelectedExistingProductId(null); } },
        { text: 'Cerrar Validación', style: 'destructive', onPress: performCloseValidation },
      ]
    );
  };

  const handleRecurrenceCreateNew = () => {
    setRecurrenceAction('CREATE_NEW');
    setSelectedExistingProductId(null);
    setShowRecurrenceModal(false);

    Alert.alert(
      'Cerrar Validación',
      '¿Está seguro? Se creará un nuevo producto.',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => { setRecurrenceAction(null); } },
        { text: 'Cerrar Validación', style: 'destructive', onPress: performCloseValidation },
      ]
    );
  };

  const handleRecurrenceCancel = () => {
    setShowRecurrenceModal(false);
    setRecurrentCandidates([]);
    setRecurrenceMessage('');
  };

  const handleAddPresentation = () => {
    if (!newPresentationId) {
      Alert.alert('Error', 'Debe seleccionar una presentación');
      return;
    }

    if (validatedPresentations.some((p) => p.presentationId === newPresentationId)) {
      Alert.alert('Error', 'Esta presentación ya está agregada');
      return;
    }

    const presentation = presentations.find((p) => p.id === newPresentationId);
    if (!presentation) {
      Alert.alert('Error', 'Presentación no encontrada');
      return;
    }

    setValidatedPresentations([
      ...validatedPresentations,
      {
        presentationId: presentation.id,
        presentationName: presentation.name,
        factorToBase: 1,
        notes: '',
        quantityOfPresentations: 0,
      },
    ]);

    setNewPresentationId('');
    setShowAddPresentation(false);
  };

  const handleRemovePresentation = (index: number) => {
    Alert.alert('Eliminar Presentación', '¿Está seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          const presentationToRemove = validatedPresentations[index];
          const newPresentations = validatedPresentations.filter((_, i) => i !== index);
          setValidatedPresentations(newPresentations);
          if (selectedPresentationForQuantity === presentationToRemove.presentationId) {
            setSelectedPresentationForQuantity(null);
          }
        },
      },
    ]);
  };

  const canEdit = () => product?.status === PurchaseProductStatus.PRELIMINARY || product?.status === PurchaseProductStatus.IN_VALIDATION;
  const canStartValidation = () => product?.status === PurchaseProductStatus.PRELIMINARY;
  const canCloseValidation = () => product?.status === PurchaseProductStatus.IN_VALIDATION;
  const canReject = () => product?.status === PurchaseProductStatus.PRELIMINARY || product?.status === PurchaseProductStatus.IN_VALIDATION;

  const getStatusVariant = (status: PurchaseProductStatus): 'active' | 'pending' | 'draft' | 'completed' | 'cancelled' => {
    switch (status) {
      case PurchaseProductStatus.PRELIMINARY: return 'draft';
      case PurchaseProductStatus.IN_VALIDATION: return 'pending';
      case PurchaseProductStatus.VALIDATED: return 'completed';
      case PurchaseProductStatus.REJECTED: return 'cancelled';
      default: return 'draft';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[900]} />
          <Body color="secondary" style={styles.loadingText}>Cargando producto...</Body>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.icon.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Title size="large">Validar Producto</Title>
          <Body color="secondary" numberOfLines={1}>{product.name}</Body>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Product Info Card */}
        <Card variant="elevated" padding="medium" style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Title size="small">Información del Producto</Title>
            <Badge
              label={PurchaseProductStatusLabels[product.status]}
              variant={getStatusVariant(product.status)}
              size="small"
            />
          </View>
          <View style={styles.infoRow}>
            <Label color="secondary" style={styles.infoLabel}>Stock Preliminar:</Label>
            <Body style={styles.infoValue}>{product.preliminaryStock} unidades</Body>
          </View>
          <View style={styles.infoRow}>
            <Label color="secondary" style={styles.infoLabel}>Costo Original:</Label>
            <Body style={styles.infoValue}>S/ {(product.costCents / 100).toFixed(2)}</Body>
          </View>
        </Card>

        {/* Editable Fields */}
        {canEdit() && (
          <>
            <Input
              label="SKU"
              value={sku}
              onChangeText={setSku}
              placeholder="Ej: PROD-001"
              required
              disabled={!canEdit()}
            />

            <Input
              label="Nombre"
              value={name}
              onChangeText={setName}
              placeholder="Ej: Producto de ejemplo"
              required
              disabled={!canEdit()}
            />

            <Input
              label="Costo (S/)"
              value={costCents}
              onChangeText={setCostCents}
              placeholder="Ej: 15.50"
              keyboardType="decimal-pad"
              required
              helperText="Costo unitario en soles"
              disabled={!canEdit()}
            />

            {/* Weight */}
            <View style={styles.section}>
              <Label color="secondary">Peso <Label color={colors.danger[500]}>*</Label></Label>
              <View style={styles.weightRow}>
                <TextInput
                  style={styles.weightInput}
                  value={weightValue}
                  onChangeText={setWeightValue}
                  placeholder={weightUnit === 'kg' ? '0.500' : '500'}
                  placeholderTextColor={colors.text.placeholder}
                  keyboardType="decimal-pad"
                  editable={canEdit()}
                />
                <View style={styles.weightUnitContainer}>
                  <TouchableOpacity
                    style={[styles.weightUnitButton, weightUnit === 'kg' && styles.weightUnitButtonActive]}
                    onPress={() => {
                      // Convertir de gramos a kilos al cambiar
                      if (weightUnit === 'g' && weightValue) {
                        const grams = parseFloat(weightValue);
                        if (!isNaN(grams)) {
                          const kg = grams / 1000;
                          setWeightValue(kg.toString());
                        }
                      }
                      setWeightUnit('kg');
                    }}
                  >
                    <Caption color={weightUnit === 'kg' ? colors.text.inverse : 'secondary'}>kg</Caption>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.weightUnitButton, weightUnit === 'g' && styles.weightUnitButtonActive]}
                    onPress={() => {
                      // Convertir de kilos a gramos al cambiar
                      if (weightUnit === 'kg' && weightValue) {
                        const kg = parseFloat(weightValue);
                        if (!isNaN(kg)) {
                          const grams = kg * 1000;
                          setWeightValue(grams.toString());
                        }
                      }
                      setWeightUnit('g');
                    }}
                  >
                    <Caption color={weightUnit === 'g' ? colors.text.inverse : 'secondary'}>g</Caption>
                  </TouchableOpacity>
                </View>
              </View>
              <Caption color="tertiary">
                {weightValue && !isNaN(parseFloat(weightValue))
                  ? weightUnit === 'g'
                    ? `= ${(parseFloat(weightValue) / 1000).toFixed(3)} kg`
                    : `${parseFloat(weightValue).toFixed(3)} kg`
                  : 'Peso del producto para guías de remisión'}
              </Caption>
            </View>

            {/* Warehouse Selector */}
            <View style={styles.section}>
              <Label color="secondary">Almacén <Label color={colors.danger[500]}>*</Label></Label>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowWarehouseSelector(!showWarehouseSelector)}
              >
                <Body color={selectedWarehouse ? 'primary' : 'placeholder'}>
                  {selectedWarehouse ? selectedWarehouse.name : 'Seleccionar almacén'}
                </Body>
                <Ionicons name={showWarehouseSelector ? 'chevron-up' : 'chevron-down'} size={20} color={colors.icon.tertiary} />
              </TouchableOpacity>

              {showWarehouseSelector && (
                <Card variant="outlined" padding="none" style={styles.selectorList}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                    {warehouses.map((warehouse) => (
                      <TouchableOpacity
                        key={warehouse.id}
                        style={[styles.selectorItem, selectedWarehouse?.id === warehouse.id && styles.selectorItemSelected]}
                        onPress={async () => {
                          setSelectedWarehouse(warehouse);
                          setSelectedArea(null);
                          setShowWarehouseSelector(false);
                          setLoadingAreas(true);
                          try {
                            const areasData = await inventoryApi.getWarehouseAreas(warehouse.id);
                            setAreas(areasData);
                          } catch (error) {
                            setAreas([]);
                          } finally {
                            setLoadingAreas(false);
                          }
                        }}
                      >
                        <Body color={selectedWarehouse?.id === warehouse.id ? colors.primary[600] : 'primary'}>
                          {warehouse.name}
                        </Body>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </Card>
              )}
            </View>

            {/* Area Selector */}
            {selectedWarehouse && (
              <View style={styles.section}>
                <Label color="secondary">Área</Label>
                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setShowAreaSelector(!showAreaSelector)}
                  disabled={loadingAreas}
                >
                  <Body color={selectedArea ? 'primary' : 'placeholder'}>
                    {loadingAreas ? 'Cargando áreas...' : selectedArea ? selectedArea.code : areas.length > 0 ? 'Seleccionar área (opcional)' : 'Sin áreas disponibles'}
                  </Body>
                  <Ionicons name={showAreaSelector ? 'chevron-up' : 'chevron-down'} size={20} color={colors.icon.tertiary} />
                </TouchableOpacity>

                {showAreaSelector && !loadingAreas && (
                  <Card variant="outlined" padding="none" style={styles.selectorList}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                      <TouchableOpacity
                        style={styles.selectorItem}
                        onPress={() => { setSelectedArea(null); setShowAreaSelector(false); }}
                      >
                        <Body color="secondary">Sin área específica</Body>
                      </TouchableOpacity>
                      {areas.map((area) => (
                        <TouchableOpacity
                          key={area.id}
                          style={[styles.selectorItem, selectedArea?.id === area.id && styles.selectorItemSelected]}
                          onPress={() => { setSelectedArea(area); setShowAreaSelector(false); }}
                        >
                          <Body color={selectedArea?.id === area.id ? colors.primary[600] : 'primary'}>{area.code}</Body>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </Card>
                )}
              </View>
            )}

            {/* Presentations */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Label color="secondary">Presentaciones Validadas (Opcional)</Label>
                <Button title="+ Agregar" onPress={() => setShowAddPresentation(true)} variant="primary" size="small" />
              </View>
              <Caption color="tertiary">Confirme o edite los factores de conversión.</Caption>

              {validatedPresentations.map((pres, index) => (
                <Card key={index} variant="outlined" padding="medium" style={styles.presentationCard}>
                  <View style={styles.presentationHeader}>
                    <Title size="small">{pres.presentationName}</Title>
                    <IconButton icon="trash-outline" onPress={() => handleRemovePresentation(index)} variant="ghost" size="small" />
                  </View>

                  <View style={styles.presentationField}>
                    <Label color="secondary">Factor a Base:</Label>
                    <TextInput
                      style={styles.presentationInput}
                      value={pres.factorToBase.toString()}
                      onChangeText={(text) => {
                        const newPresentations = [...validatedPresentations];
                        newPresentations[index].factorToBase = parseFloat(text) || 0;
                        setValidatedPresentations(newPresentations);
                      }}
                      placeholder="Ej: 24"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.presentationField}>
                    <View style={styles.quantityHeaderRow}>
                      <Label color="secondary">Cantidad:</Label>
                      <TouchableOpacity
                        style={[styles.selectForQuantityButton, selectedPresentationForQuantity === pres.presentationId && styles.selectForQuantityButtonActive]}
                        onPress={() => {
                          if (selectedPresentationForQuantity === pres.presentationId) {
                            setSelectedPresentationForQuantity(null);
                            const newPresentations = [...validatedPresentations];
                            newPresentations[index].quantityOfPresentations = 0;
                            setValidatedPresentations(newPresentations);
                          } else {
                            setSelectedPresentationForQuantity(pres.presentationId);
                            const newPresentations = validatedPresentations.map((p, i) => ({
                              ...p,
                              quantityOfPresentations: i === index ? p.quantityOfPresentations : 0,
                            }));
                            setValidatedPresentations(newPresentations);
                          }
                        }}
                      >
                        <Caption color={selectedPresentationForQuantity === pres.presentationId ? colors.text.inverse : colors.primary[600]}>
                          {selectedPresentationForQuantity === pres.presentationId ? '✓ Seleccionada' : 'Seleccionar'}
                        </Caption>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.presentationInput, selectedPresentationForQuantity !== pres.presentationId && styles.inputDisabled]}
                      value={pres.quantityOfPresentations.toString()}
                      onChangeText={(text) => {
                        if (selectedPresentationForQuantity === pres.presentationId) {
                          const newPresentations = [...validatedPresentations];
                          newPresentations[index].quantityOfPresentations = parseInt(text) || 0;
                          setValidatedPresentations(newPresentations);
                        }
                      }}
                      placeholder={selectedPresentationForQuantity === pres.presentationId ? 'Ej: 5' : 'Seleccione primero'}
                      keyboardType="number-pad"
                      editable={selectedPresentationForQuantity === pres.presentationId}
                    />
                    {selectedPresentationForQuantity === pres.presentationId && pres.quantityOfPresentations > 0 && (
                      <Caption color={colors.success[600]}>
                        = {pres.quantityOfPresentations} × {pres.factorToBase} = {pres.quantityOfPresentations * pres.factorToBase} unidades
                      </Caption>
                    )}
                  </View>
                </Card>
              ))}

              {validatedPresentations.length === 0 && (
                <Card variant="filled" padding="medium">
                  <Body color="secondary" align="center">No hay presentaciones agregadas</Body>
                </Card>
              )}
            </View>

            {/* Barcode */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Label color="secondary">Código de Barras <Label color={colors.danger[500]}>*</Label></Label>
                <TouchableOpacity style={styles.copyButton} onPress={() => { if (sku.trim()) { setBarcode(sku.trim()); Alert.alert('Copiado', 'SKU copiado'); } }}>
                  <Caption color={colors.primary[600]}>📋 Copiar SKU</Caption>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Ej: ABC123XYZ"
                placeholderTextColor={colors.text.placeholder}
              />
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
              <Label color="secondary">Stock Total Validado (Calculado)</Label>
              <View style={styles.calculatedField}>
                <Title size="medium" color={colors.text.secondary}>{calculateTotalStock()} unidades</Title>
              </View>
              <Caption color="tertiary">Unidades sueltas + (Cantidad de presentaciones × Factor)</Caption>
            </View>

            {/* Photo Capture */}
            <View style={styles.section}>
              <Label color="secondary">Foto de Validación <Label color={colors.danger[500]}>*</Label></Label>
              {photoUri ? (
                <View style={styles.capturedContainer}>
                  <Image source={{ uri: photoUri }} style={styles.capturedPhoto} />
                  <Button title="📷 Cambiar Foto" onPress={() => setShowPhotoCapture(true)} variant="secondary" size="small" />
                </View>
              ) : (
                <TouchableOpacity style={styles.captureButton} onPress={() => setShowPhotoCapture(true)}>
                  <Ionicons name="camera" size={32} color={colors.primary[600]} />
                  <Body color={colors.primary[600]}>Tomar Foto</Body>
                </TouchableOpacity>
              )}
            </View>

            {/* Product Photo */}
            <View style={styles.section}>
              <Label color="secondary">Foto del Producto (Catálogo) <Label color={colors.danger[500]}>*</Label></Label>
              {productPhotoUri ? (
                <View style={styles.capturedContainer}>
                  <Image source={{ uri: productPhotoUri }} style={styles.capturedPhoto} />
                  <Button title="🖼️ Cambiar Foto" onPress={() => setShowProductPhotoCapture(true)} variant="secondary" size="small" />
                </View>
              ) : (
                <TouchableOpacity style={styles.captureButton} onPress={() => setShowProductPhotoCapture(true)}>
                  <Ionicons name="image" size={32} color={colors.primary[600]} />
                  <Body color={colors.primary[600]}>Tomar Foto del Producto</Body>
                </TouchableOpacity>
              )}
            </View>

            {/* Signature */}
            <View style={styles.section}>
              <Label color="secondary">Firma de Validación <Label color={colors.danger[500]}>*</Label></Label>
              {signatureUri ? (
                <View style={styles.capturedContainer}>
                  <Image source={{ uri: signatureUri }} style={styles.capturedSignature} />
                  <Button title="✍️ Cambiar Firma" onPress={() => setShowSignatureCapture(true)} variant="secondary" size="small" />
                </View>
              ) : (
                <TouchableOpacity style={styles.captureButton} onPress={() => setShowSignatureCapture(true)}>
                  <Ionicons name="pencil" size={32} color={colors.primary[600]} />
                  <Body color={colors.primary[600]}>Capturar Firma</Body>
                </TouchableOpacity>
              )}
            </View>

            {/* Validation Notes */}
            <Input
              label="Notas de Validación"
              value={validationNotes}
              onChangeText={setValidationNotes}
              placeholder="Observaciones sobre la validación..."
              multiline
              numberOfLines={4}
            />
          </>
        )}

        {/* Validated Product Info */}
        {product.status === PurchaseProductStatus.VALIDATED && (
          <Card variant="filled" padding="large" style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success[500]} />
            <Title size="medium" color={colors.success[700]} align="center">Producto Validado</Title>
            <Body color="secondary" align="center">Este producto ha sido validado y activado en el catálogo.</Body>
            {product.validatedAt && (
              <Caption color="tertiary" align="center">
                Validado el {new Date(product.validatedAt).toLocaleDateString('es-PE')}
              </Caption>
            )}
          </Card>
        )}

        {/* Rejected Product Info */}
        {product.status === PurchaseProductStatus.REJECTED && product.rejectionReason && (
          <Card variant="filled" padding="large" style={styles.rejectionCard}>
            <Ionicons name="close-circle" size={48} color={colors.danger[500]} />
            <Title size="medium" color={colors.danger[700]} align="center">Producto Rechazado</Title>
            <Label color={colors.danger[600]}>Razón:</Label>
            <Body color={colors.danger[700]}>{product.rejectionReason}</Body>
          </Card>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Buttons */}
      {(canStartValidation() || canEdit() || canCloseValidation() || canReject()) && (
        <View style={styles.footer}>
          {canStartValidation() && (
            <Button title="Iniciar Validación" onPress={handleStartValidation} variant="primary" loading={actionLoading} fullWidth />
          )}
          {canEdit() && product.status === PurchaseProductStatus.IN_VALIDATION && (
            <Button title="Cerrar Validación" onPress={handleCloseValidation} variant="primary" loading={actionLoading} style={styles.footerButton} />
          )}
          {canReject() && (
            <Button title="Rechazar" onPress={() => setShowRejectDialog(true)} variant="danger" disabled={actionLoading} style={styles.footerButton} />
          )}
        </View>
      )}

      {/* Reject Dialog */}
      <Modal visible={showRejectDialog} animationType="fade" transparent onRequestClose={() => setShowRejectDialog(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialog}>
            <Title size="medium">Rechazar Producto</Title>
            <Body color="secondary">Ingrese la razón del rechazo:</Body>
            <TextInput
              style={styles.dialogInput}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Ej: Producto dañado, no cumple especificaciones"
              placeholderTextColor={colors.text.placeholder}
              multiline
              numberOfLines={3}
              autoFocus
            />
            <View style={styles.dialogButtons}>
              <Button title="Cancelar" onPress={() => { setShowRejectDialog(false); setRejectionReason(''); }} variant="secondary" style={styles.dialogButton} />
              <Button title="Rechazar" onPress={handleReject} variant="danger" loading={actionLoading} style={styles.dialogButton} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Presentation Dialog */}
      <Modal visible={showAddPresentation} animationType="fade" transparent onRequestClose={() => setShowAddPresentation(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialog}>
            <Title size="medium">Agregar Presentación</Title>
            <Body color="secondary">Seleccione una presentación:</Body>
            <ScrollView style={styles.presentationList}>
              {presentations.map((presentation) => (
                <TouchableOpacity
                  key={presentation.id}
                  style={[styles.presentationOption, newPresentationId === presentation.id && styles.presentationOptionSelected]}
                  onPress={() => setNewPresentationId(presentation.id)}
                >
                  <Body color={newPresentationId === presentation.id ? colors.primary[600] : 'primary'}>{presentation.name}</Body>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.dialogButtons}>
              <Button title="Cancelar" onPress={() => { setShowAddPresentation(false); setNewPresentationId(''); }} variant="secondary" style={styles.dialogButton} />
              <Button title="Agregar" onPress={handleAddPresentation} variant="primary" style={styles.dialogButton} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo Capture Modal */}
      <Modal visible={showPhotoCapture} animationType="slide" onRequestClose={() => setShowPhotoCapture(false)}>
        <PhotoCapture onPhotoCapture={(uri) => { setPhotoUri(uri); setShowPhotoCapture(false); }} onCancel={() => setShowPhotoCapture(false)} currentPhoto={photoUri} />
      </Modal>

      {/* Product Photo Capture Modal */}
      <Modal visible={showProductPhotoCapture} animationType="slide" onRequestClose={() => setShowProductPhotoCapture(false)}>
        <PhotoCapture onPhotoCapture={(uri) => { setProductPhotoUri(uri); setShowProductPhotoCapture(false); }} onCancel={() => setShowProductPhotoCapture(false)} currentPhoto={productPhotoUri} />
      </Modal>

      {/* Signature Capture Modal */}
      <Modal visible={showSignatureCapture} animationType="slide" onRequestClose={() => setShowSignatureCapture(false)}>
        <SignatureCapture onSignatureCapture={(signature) => { setSignatureUri(signature); setShowSignatureCapture(false); }} onCancel={() => setShowSignatureCapture(false)} />
      </Modal>

      {/* Recurrent Product Modal */}
      <RecurrentProductModal
        visible={showRecurrenceModal}
        candidates={recurrentCandidates}
        message={recurrenceMessage}
        onConfirm={handleRecurrenceConfirm}
        onCreateNew={handleRecurrenceCreateNew}
        onCancel={handleRecurrenceCancel}
      />
    </SafeAreaView>
  );
};

// Import status labels
const PurchaseProductStatusLabels: Record<PurchaseProductStatus, string> = {
  [PurchaseProductStatus.PRELIMINARY]: 'Preliminar',
  [PurchaseProductStatus.IN_VALIDATION]: 'En Validación',
  [PurchaseProductStatus.VALIDATED]: 'Validado',
  [PurchaseProductStatus.REJECTED]: 'Rechazado',
  [PurchaseProductStatus.CLOSED]: 'Cerrado',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[4],
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
  },
  contentContainerTablet: {
    padding: spacing[6],
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  infoCard: {
    marginBottom: spacing[4],
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: spacing[2],
  },
  infoLabel: {
    width: 140,
  },
  infoValue: {
    flex: 1,
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[2],
  },
  weightInput: {
    flex: 1,
    backgroundColor: colors.surface.primary,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.text.primary,
  },
  weightUnitContainer: {
    flexDirection: 'row',
    gap: spacing[1],
  },
  weightUnitButton: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
  },
  weightUnitButtonActive: {
    backgroundColor: colors.primary[900],
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    marginTop: spacing[2],
  },
  selectorList: {
    marginTop: spacing[2],
  },
  selectorItem: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  selectorItemSelected: {
    backgroundColor: colors.primary[50],
  },
  presentationCard: {
    marginTop: spacing[3],
  },
  presentationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  presentationField: {
    marginBottom: spacing[3],
  },
  presentationInput: {
    backgroundColor: colors.surface.primary,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2.5],
    fontSize: 15,
    color: colors.text.primary,
    marginTop: spacing[2],
  },
  quantityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectForQuantityButton: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.sm,
  },
  selectForQuantityButtonActive: {
    backgroundColor: colors.primary[900],
  },
  inputDisabled: {
    backgroundColor: colors.surface.secondary,
    opacity: 0.6,
  },
  copyButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
  },
  input: {
    backgroundColor: colors.surface.primary,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.text.primary,
    marginTop: spacing[2],
  },
  calculatedField: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    padding: spacing[4],
    marginTop: spacing[2],
    alignItems: 'center',
  },
  captureButton: {
    backgroundColor: colors.surface.primary,
    borderWidth: 2,
    borderColor: colors.primary[200],
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    padding: spacing[6],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[2],
    gap: spacing[2],
  },
  capturedContainer: {
    marginTop: spacing[2],
    gap: spacing[3],
  },
  capturedPhoto: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.secondary,
  },
  capturedSignature: {
    width: '100%',
    height: 120,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  successCard: {
    backgroundColor: colors.success[50],
    alignItems: 'center',
    gap: spacing[3],
  },
  rejectionCard: {
    backgroundColor: colors.danger[50],
    alignItems: 'center',
    gap: spacing[3],
  },
  bottomSpacer: {
    height: spacing[20],
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
  dialogOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[5],
  },
  dialog: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    padding: spacing[6],
    width: '100%',
    maxWidth: 400,
    gap: spacing[4],
    ...shadows.xl,
  },
  dialogInput: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    padding: spacing[4],
    fontSize: 15,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  dialogButton: {
    flex: 1,
  },
  presentationList: {
    maxHeight: 300,
  },
  presentationOption: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
    marginBottom: spacing[2],
  },
  presentationOptionSelected: {
    backgroundColor: colors.primary[50],
    borderWidth: 1.5,
    borderColor: colors.primary[500],
  },
});

export default ValidatePurchaseProductScreen;
