/**
 * ValidatePurchaseProductScreen - Validar Producto de Compra
 * Migrado al Design System unificado
 */

import Alert from '@/utils/alert';
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Image,
  Modal,
  Platform,
  Switch,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { purchasesService } from '@/services/api';
import { inventoryApi } from '@/services/api/inventory';
import { presentationsApi } from '@/services/api/presentations';
import { filesApi } from '@/services/api/files';
import {
  PurchaseProduct,
  PurchaseProductStatus,
  PurchaseValidatedVariantInput,
} from '@/types/purchases';
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
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface ValidatePurchaseProductScreenProps {
  navigation: any;
  route: {
    params: {
      purchaseId: string;
      productId: string;
      returnToEntriesModal?: boolean;
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

const isProductIdentityResolved = (purchaseProduct: PurchaseProduct): boolean => {
  return (
    !!purchaseProduct.resolutionAction &&
    !!purchaseProduct.resolvedAt &&
    !!purchaseProduct.productId
  );
};

const isFirstPhysicalEntry = (purchaseProduct: PurchaseProduct): boolean => {
  return !isProductIdentityResolved(purchaseProduct);
};

export const ValidatePurchaseProductScreen: React.FC<ValidatePurchaseProductScreenProps> = ({
  navigation,
  route,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { purchaseId, productId, returnToEntriesModal } = route.params;
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
  const [variantName, setVariantName] = useState('');
  // Modo multi-variante (Mode B): permite validar varias variantes en un solo submit
  const [multiVariantMode, setMultiVariantMode] = useState(false);
  const [variantRows, setVariantRows] = useState<PurchaseValidatedVariantInput[]>([]);
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
  const [selectedPresentationForQuantity, setSelectedPresentationForQuantity] = useState<
    string | null
  >(null);

  // Lists
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [areas, setAreas] = useState<WarehouseArea[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);

  // UI State
  const [showWarehouseSelector, setShowWarehouseSelector] = useState(false);
  const [showAreaSelector, setShowAreaSelector] = useState(false);
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

      const isResolvedProduct = isProductIdentityResolved(productData);

      // Load editable fields
      setSku(productData.sku || '');
      setName(productData.name || '');
      setCostCents(productData.costCents ? (productData.costCents / 100).toFixed(2) : '');

      if (isResolvedProduct) {
        setLooseUnits('0');
      } else if (
        productData.validatedLooseUnits !== undefined &&
        productData.validatedLooseUnits !== null
      ) {
        setLooseUnits(productData.validatedLooseUnits.toString());
      } else if (
        productData.preliminaryLooseUnits !== undefined &&
        productData.preliminaryLooseUnits !== null
      ) {
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

        if (isResolvedProduct) {
          setValidatedPresentations(
            preliminaryPresentations.map((p) => ({ ...p, quantityOfPresentations: 0 }))
          );
          setSelectedPresentationForQuantity(null);
        } else if (
          productData.validatedPresentationQuantity !== undefined &&
          productData.validatedPresentationQuantity > 0
        ) {
          if (preliminaryPresentations.length > 0) {
            const firstPresentationId = preliminaryPresentations[0].presentationId;
            setSelectedPresentationForQuantity(firstPresentationId);
            const updatedPresentations = preliminaryPresentations.map((p, i) => ({
              ...p,
              quantityOfPresentations:
                i === 0 ? (productData.validatedPresentationQuantity ?? 0) : 0,
            }));
            setValidatedPresentations(updatedPresentations);
          }
        } else if (
          productData.preliminaryPresentationQuantity !== undefined &&
          productData.preliminaryPresentationQuantity > 0
        ) {
          if (preliminaryPresentations.length > 0) {
            const firstPresentationId = preliminaryPresentations[0].presentationId;
            setSelectedPresentationForQuantity(firstPresentationId);
            const updatedPresentations = preliminaryPresentations.map((p, i) => ({
              ...p,
              quantityOfPresentations:
                i === 0 ? (productData.preliminaryPresentationQuantity ?? 0) : 0,
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
          photoUri,
          photoFilename,
          'PURCHASES_VALIDACIONES_FOTOS',
          purchaseId,
          'image/jpeg'
        );
        result.photoUrl = photoResponse.url;
      }

      if (signatureUri) {
        const signatureFilename = `firma-${Date.now()}.png`;
        const signatureResponse = await filesApi.uploadByCategory(
          signatureUri,
          signatureFilename,
          'PURCHASES_VALIDACIONES_FIRMAS',
          purchaseId,
          'image/png'
        );
        result.signatureUrl = signatureResponse.url;
      }

      if (product && isFirstPhysicalEntry(product) && productPhotoUri) {
        const productPhotoFilename = `producto-${Date.now()}.jpg`;
        const productPhotoResponse = await filesApi.uploadByCategory(
          productPhotoUri,
          productPhotoFilename,
          'PURCHASES_VALIDACIONES_FOTOS',
          purchaseId,
          'image/jpeg'
        );
        result.productPhotoUrl = productPhotoResponse.url;
      }

      return result;
    } catch (error: any) {
      throw new Error(error.message || 'No se pudieron subir las fotos de validación');
    }
  };

  const openRecurrenceReviewModal = async () => {
    if (!product || !sku.trim()) return;

    setRecurrenceAction(null);
    setSelectedExistingProductId(null);
    setRecurrentCandidates([]);

    try {
      const response = await purchasesService.checkRecurrence(purchaseId, productId, {
        sku: sku.trim(),
        barcode: barcode.trim() || undefined,
      });

      setRecurrentCandidates(response.candidates || []);
      setRecurrenceMessage(
        response.hasRecurrentProducts && response.candidates.length > 0
          ? response.message ||
              'Se encontraron productos similares. Confirme si desea fusionar o crear uno nuevo.'
          : response.message ||
              'No se encontraron productos recurrentes. Confirme si desea crear un producto nuevo.'
      );
    } catch (error: any) {
      setRecurrentCandidates([]);
      setRecurrenceMessage(
        'No se pudo verificar recurrencia. Revise la decisión y confirme si desea crear un producto nuevo.'
      );
    } finally {
      setShowRecurrenceModal(true);
    }
  };

  const validateEntryForm = (isFirstEntry: boolean): boolean => {
    if (isFirstEntry && !sku.trim()) {
      Alert.alert('Error', 'El SKU es obligatorio');
      return false;
    }
    if (isFirstEntry && !name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return false;
    }
    if (isFirstEntry && !barcode.trim()) {
      Alert.alert('Error', 'El código de barras es obligatorio');
      return false;
    }

    const costValue = parseFloat(costCents);
    if (isNaN(costValue) || costValue <= 0) {
      Alert.alert('Error', 'Debe ingresar un costo válido');
      return false;
    }

    const looseUnitsValue = parseInt(looseUnits);
    if (isNaN(looseUnitsValue) || looseUnitsValue < 0) {
      Alert.alert('Error', 'Debe ingresar unidades sueltas válidas');
      return false;
    }

    if (calculateTotalStock() < 1) {
      Alert.alert('Error', 'Debe validar al menos 1 unidad');
      return false;
    }

    const weightKg = getWeightInKg();
    if (isFirstEntry && (weightKg === undefined || weightKg <= 0)) {
      Alert.alert('Error', 'El peso es obligatorio y debe ser mayor a 0');
      return false;
    }

    if (!selectedWarehouse) {
      Alert.alert('Error', 'Debe seleccionar un almacén');
      return false;
    }
    if (!selectedArea) {
      Alert.alert('Error', 'Debe seleccionar un área');
      return false;
    }
    if (!photoUri) {
      Alert.alert('Error', 'La foto de validación es obligatoria');
      return false;
    }
    if (isFirstEntry && !productPhotoUri) {
      Alert.alert('Error', 'La foto del producto es obligatoria');
      return false;
    }
    if (!signatureUri) {
      Alert.alert('Error', 'La firma de validación es obligatoria');
      return false;
    }

    if (validatedPresentations.length > 0) {
      for (const pres of validatedPresentations) {
        if (!pres.presentationId || pres.factorToBase <= 0) {
          Alert.alert('Error', 'Todas las presentaciones deben tener un factor válido');
          return false;
        }
      }
    }

    return true;
  };

  const buildEntryPayload = async () => {
    if (!product || !selectedWarehouse || !selectedArea) return null;

    const costValue = parseFloat(costCents);
    const looseUnitsValue = parseInt(looseUnits) || 0;
    const totalStock = calculateTotalStock();

    let validatedPresentationQuantity = 0;
    if (selectedPresentationForQuantity) {
      const selectedPres = validatedPresentations.find(
        (p) => p.presentationId === selectedPresentationForQuantity
      );
      if (selectedPres) validatedPresentationQuantity = selectedPres.quantityOfPresentations;
    }

    const uploadedFiles = await uploadValidationFiles();

    return {
      sku: sku.trim(),
      name: name.trim(),
      costCents: Math.round(costValue * 100),
      preliminaryStock: product.preliminaryStock,
      validatedStock: totalStock,
      validatedLooseUnits: looseUnitsValue,
      validatedPresentationQuantity,
      warehouseId: selectedWarehouse.id,
      areaId: selectedArea.id,
      presentations:
        validatedPresentations.length > 0
          ? validatedPresentations.map((p) => ({
              presentationId: p.presentationId,
              factorToBase: Number(p.factorToBase),
              notes: p.notes.trim() || undefined,
            }))
          : undefined,
      productPhotos: uploadedFiles.productPhotoUrl ? [uploadedFiles.productPhotoUrl] : undefined,
      barcode: barcode.trim() || undefined,
      weightKg: getWeightInKg(),
      photoUrl: uploadedFiles.photoUrl,
      signatureUrl: uploadedFiles.signatureUrl,
      validationNotes: validationNotes.trim() || undefined,
      // MODO A (single) vs MODO B (multi-variante): son mutuamente excluyentes
      variantName: !multiVariantMode && variantName.trim() ? variantName.trim() : undefined,
      variants:
        multiVariantMode && variantRows.length > 0 ? sanitizeVariantRows(variantRows) : undefined,
    };
  };

  /**
   * Limpia y valida las filas del modo multi-variante antes de enviar.
   * - validatedStock debe ser entero >= 1 (regla del backend).
   * - Debe traer variantId o variantName no vacio.
   */
  const sanitizeVariantRows = (
    rows: PurchaseValidatedVariantInput[]
  ): PurchaseValidatedVariantInput[] => {
    return rows.map((row, index) => {
      const name = row.variantName?.trim();
      const hasId = !!row.variantId;
      const stock = Math.floor(Number(row.validatedStock));
      if (!hasId && !name) {
        throw new Error(`La variante #${index + 1} debe tener nombre o ID`);
      }
      if (!Number.isFinite(stock) || stock < 1) {
        throw new Error(`El stock de la variante #${index + 1} debe ser entero >= 1`);
      }
      return {
        variantId: row.variantId,
        variantName: name || undefined,
        variantSku: row.variantSku?.trim() || undefined,
        variantBarcode: row.variantBarcode?.trim() || undefined,
        validatedStock: stock,
        // Default true. Solo enviar false si el usuario lo desmarca explicitamente.
        tracksStock: row.tracksStock === false ? false : undefined,
        photoUrl: row.photoUrl?.trim() || undefined,
        photos:
          Array.isArray(row.photos) && row.photos.length > 0
            ? row.photos.filter((p) => !!p?.trim())
            : undefined,
      };
    });
  };

  const handleSubmitEntry = async () => {
    if (!product) return;

    const isFirstEntry = isFirstPhysicalEntry(product);
    if (!validateEntryForm(isFirstEntry)) return;

    if (isFirstEntry) {
      setActionLoading(true);
      try {
        await openRecurrenceReviewModal();
      } finally {
        setActionLoading(false);
      }
      return;
    }

    Alert.alert(
      'Agregar Ingreso',
      'Se agregará un nuevo ingreso de stock al producto ya resuelto.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', style: 'destructive', onPress: () => performSubmitEntry() },
      ]
    );
  };

  const performSubmitEntry = async (forcedResolution?: {
    action: 'MERGE' | 'CREATE_NEW';
    existingProductId?: string;
  }) => {
    if (!product) return;

    setActionLoading(true);
    try {
      const entryPayload = await buildEntryPayload();
      if (!entryPayload) return;

      const isFirstEntry = isFirstPhysicalEntry(product);
      const resolvedAction = forcedResolution?.action || recurrenceAction || 'CREATE_NEW';
      const resolvedExistingProductId =
        resolvedAction === 'MERGE'
          ? forcedResolution?.existingProductId || selectedExistingProductId || undefined
          : undefined;

      if (isFirstEntry && resolvedAction === 'MERGE' && !resolvedExistingProductId) {
        Alert.alert('Error', 'Debe seleccionar un producto existente para fusionar');
        return;
      }

      const response = isFirstEntry
        ? await purchasesService.resolveAndAddEntry(purchaseId, productId, {
            ...entryPayload,
            recurrenceAction: resolvedAction,
            ...(resolvedExistingProductId ? { existingProductId: resolvedExistingProductId } : {}),
            recurrenceMetadata:
              recurrentCandidates.length > 0
                ? {
                    candidatesReviewed: recurrentCandidates.length,
                    userDecision:
                      resolvedAction === 'MERGE'
                        ? 'Usuario confirmó producto existente'
                        : 'Usuario creó producto nuevo',
                    matchConfidence: 95,
                  }
                : undefined,
          })
        : await purchasesService.addPurchaseProductEntry(purchaseId, productId, {
            validatedStock: entryPayload.validatedStock,
            warehouseId: entryPayload.warehouseId,
            areaId: entryPayload.areaId,
            costCents: entryPayload.costCents,
            validatedPresentationQuantity: entryPayload.validatedPresentationQuantity,
            validatedLooseUnits: entryPayload.validatedLooseUnits,
            presentations: entryPayload.presentations,
            productPhotos: entryPayload.productPhotos,
            photoUrl: entryPayload.photoUrl,
            signatureUrl: entryPayload.signatureUrl,
            validationNotes: entryPayload.validationNotes,
            variantName: entryPayload.variantName,
            variants: entryPayload.variants,
          });

      setRecurrenceAction(null);
      setSelectedExistingProductId(null);
      setRecurrentCandidates([]);
      setPhotoUri(undefined);
      setSignatureUri(undefined);
      setProductPhotoUri(undefined);
      setValidationNotes('');
      setVariantName('');
      setVariantRows([]);
      setMultiVariantMode(false);
      setLooseUnits('0');
      setValidatedPresentations((current) =>
        current.map((presentation) => ({ ...presentation, quantityOfPresentations: 0 }))
      );

      const navigateBackToPurchase = () => {
        // En web/electron `goBack()` puede fallar si el usuario recargo la
        // pantalla directamente por URL (stack vacio). Usamos navigate a
        // PurchaseDetail para garantizar el retorno.
        if (returnToEntriesModal) {
          navigation.navigate('PurchaseDetail', {
            purchaseId,
            reopenEntriesProductId: productId,
          });
          return;
        }
        if (Platform.OS === 'web' || !navigation.canGoBack?.()) {
          navigation.navigate('PurchaseDetail', { purchaseId });
        } else {
          navigation.goBack();
        }
      };

      Alert.alert('Éxito', response.message || 'Ingreso registrado correctamente', [
        {
          text: 'OK',
          onPress: navigateBackToPurchase,
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo registrar el ingreso');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelEntry = () => {
    setPhotoUri(undefined);
    setSignatureUri(undefined);
    setProductPhotoUri(undefined);
    setValidationNotes('');
    setLooseUnits('0');
    setSelectedPresentationForQuantity(null);
    setValidatedPresentations((current) =>
      current.map((presentation) => ({ ...presentation, quantityOfPresentations: 0 }))
    );
    setRecurrenceAction(null);
    setSelectedExistingProductId(null);
    setRecurrentCandidates([]);
    setRecurrenceMessage('');
    setShowRecurrenceModal(false);
    if (returnToEntriesModal) {
      navigation.navigate('PurchaseDetail', { purchaseId, reopenEntriesProductId: productId });
    } else {
      navigation.goBack();
    }
  };

  const handleRecurrenceConfirm = (productId: string) => {
    setRecurrenceAction('MERGE');
    setSelectedExistingProductId(productId);
    setShowRecurrenceModal(false);
    void performSubmitEntry({ action: 'MERGE', existingProductId: productId });
  };

  const handleRecurrenceCreateNew = () => {
    setRecurrenceAction('CREATE_NEW');
    setSelectedExistingProductId(null);
    setShowRecurrenceModal(false);
    void performSubmitEntry({ action: 'CREATE_NEW' });
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

  const canEdit = () =>
    product?.status === PurchaseProductStatus.PRELIMINARY ||
    product?.status === PurchaseProductStatus.IN_VALIDATION;
  const canEditIdentity = () => canEdit() && !!product && isFirstPhysicalEntry(product);
  const canAddEntry = () => product?.status === PurchaseProductStatus.IN_VALIDATION;

  const getStatusVariant = (
    status: PurchaseProductStatus
  ): 'active' | 'pending' | 'draft' | 'completed' | 'cancelled' => {
    switch (status) {
      case PurchaseProductStatus.PRELIMINARY:
        return 'draft';
      case PurchaseProductStatus.IN_VALIDATION:
        return 'pending';
      case PurchaseProductStatus.VALIDATED:
        return 'completed';
      case PurchaseProductStatus.REJECTED:
        return 'cancelled';
      default:
        return 'draft';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.primary} />
          <Body color="secondary" style={styles.loadingText}>
            Cargando producto...
          </Body>
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
          <Ionicons name="chevron-back" size={24} color={theme.color.icon.default} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Title size="large">Validar Producto</Title>
          <Body color="secondary" numberOfLines={1}>
            {product.name}
          </Body>
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
            <Label color="secondary" style={styles.infoLabel}>
              Stock Preliminar:
            </Label>
            <Body style={styles.infoValue}>{product.preliminaryStock} unidades</Body>
          </View>
          <View style={styles.infoRow}>
            <Label color="secondary" style={styles.infoLabel}>
              Costo Original:
            </Label>
            <Body style={styles.infoValue}>S/ {(product.costCents / 100).toFixed(2)}</Body>
          </View>
          <View style={styles.infoRow}>
            <Label color="secondary" style={styles.infoLabel}>
              Stock Validado:
            </Label>
            <Body style={styles.infoValue}>{product.validatedStock || 0} unidades</Body>
          </View>
          <View style={styles.infoRow}>
            <Label color="secondary" style={styles.infoLabel}>
              Resolución:
            </Label>
            <Body style={styles.infoValue}>
              {product.resolutionAction
                ? product.resolutionAction === 'MERGE'
                  ? 'Fusionado con producto existente'
                  : 'Producto nuevo'
                : 'Pendiente de resolver'}
            </Body>
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
              disabled={!canEditIdentity()}
            />

            <Input
              label="Nombre"
              value={name}
              onChangeText={setName}
              placeholder="Ej: Producto de ejemplo"
              required
              disabled={!canEditIdentity()}
            />

            <Input
              label="Costo (S/)"
              value={costCents}
              onChangeText={setCostCents}
              placeholder="Ej: 15.50"
              keyboardType="decimal-pad"
              required
              helperText="Costo unitario en soles"
              disabled={!canEditIdentity()}
            />

            {/* Weight */}
            <View style={styles.section}>
              <Label color="secondary">
                Peso <Label color={theme.color.icon.danger}>*</Label>
              </Label>
              <View style={styles.weightRow}>
                <TextInput
                  style={styles.weightInput}
                  value={weightValue}
                  onChangeText={setWeightValue}
                  placeholder={weightUnit === 'kg' ? '0.500' : '500'}
                  placeholderTextColor={theme.color.text.placeholder}
                  keyboardType="decimal-pad"
                  editable={canEditIdentity()}
                />
                <View style={styles.weightUnitContainer}>
                  <TouchableOpacity
                    style={[
                      styles.weightUnitButton,
                      weightUnit === 'kg' && styles.weightUnitButtonActive,
                    ]}
                    disabled={!canEditIdentity()}
                    onPress={() => {
                      if (!canEditIdentity()) return;
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
                    <Caption color={weightUnit === 'kg' ? theme.color.text.inverse : 'secondary'}>
                      kg
                    </Caption>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.weightUnitButton,
                      weightUnit === 'g' && styles.weightUnitButtonActive,
                    ]}
                    disabled={!canEditIdentity()}
                    onPress={() => {
                      if (!canEditIdentity()) return;
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
                    <Caption color={weightUnit === 'g' ? theme.color.text.inverse : 'secondary'}>
                      g
                    </Caption>
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
              <Label color="secondary">
                Almacén <Label color={theme.color.icon.danger}>*</Label>
              </Label>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowWarehouseSelector(!showWarehouseSelector)}
              >
                <Body color={selectedWarehouse ? 'primary' : 'placeholder'}>
                  {selectedWarehouse ? selectedWarehouse.name : 'Seleccionar almacén'}
                </Body>
                <Ionicons
                  name={showWarehouseSelector ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={theme.color.icon.subtle}
                />
              </TouchableOpacity>

              {showWarehouseSelector && (
                <Card variant="outlined" padding="none" style={styles.selectorList}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                    {warehouses.map((warehouse) => (
                      <TouchableOpacity
                        key={warehouse.id}
                        style={[
                          styles.selectorItem,
                          selectedWarehouse?.id === warehouse.id && styles.selectorItemSelected,
                        ]}
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
                        <Body
                          color={
                            selectedWarehouse?.id === warehouse.id
                              ? theme.color.brand.accent
                              : 'primary'
                          }
                        >
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
                    {loadingAreas
                      ? 'Cargando áreas...'
                      : selectedArea
                        ? selectedArea.code
                        : areas.length > 0
                          ? 'Seleccionar área (opcional)'
                          : 'Sin áreas disponibles'}
                  </Body>
                  <Ionicons
                    name={showAreaSelector ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.color.icon.subtle}
                  />
                </TouchableOpacity>

                {showAreaSelector && !loadingAreas && (
                  <Card variant="outlined" padding="none" style={styles.selectorList}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }}>
                      <TouchableOpacity
                        style={styles.selectorItem}
                        onPress={() => {
                          setSelectedArea(null);
                          setShowAreaSelector(false);
                        }}
                      >
                        <Body color="secondary">Sin área específica</Body>
                      </TouchableOpacity>
                      {areas.map((area) => (
                        <TouchableOpacity
                          key={area.id}
                          style={[
                            styles.selectorItem,
                            selectedArea?.id === area.id && styles.selectorItemSelected,
                          ]}
                          onPress={() => {
                            setSelectedArea(area);
                            setShowAreaSelector(false);
                          }}
                        >
                          <Body
                            color={
                              selectedArea?.id === area.id ? theme.color.brand.accent : 'primary'
                            }
                          >
                            {area.code}
                          </Body>
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
                {canEditIdentity() && (
                  <Button
                    title="+ Agregar"
                    onPress={() => setShowAddPresentation(true)}
                    variant="primary"
                    size="small"
                  />
                )}
              </View>
              <Caption color="tertiary">
                {isProductIdentityResolved(product)
                  ? 'Las presentaciones ya fueron definidas en el primer ingreso. Solo ingrese cantidades para este ingreso.'
                  : 'Confirme o edite los factores de conversión.'}
              </Caption>

              {validatedPresentations.map((pres, index) => (
                <Card
                  key={index}
                  variant="outlined"
                  padding="medium"
                  style={styles.presentationCard}
                >
                  <View style={styles.presentationHeader}>
                    <Title size="small">{pres.presentationName}</Title>
                    {canEditIdentity() && (
                      <IconButton
                        icon="trash-outline"
                        onPress={() => handleRemovePresentation(index)}
                        variant="ghost"
                        size="small"
                      />
                    )}
                  </View>

                  <View style={styles.presentationField}>
                    <Label color="secondary">Factor a Base:</Label>
                    <TextInput
                      style={styles.presentationInput}
                      value={pres.factorToBase.toString()}
                      onChangeText={(text) => {
                        if (!canEditIdentity()) return;
                        const newPresentations = [...validatedPresentations];
                        newPresentations[index].factorToBase = parseFloat(text) || 0;
                        setValidatedPresentations(newPresentations);
                      }}
                      placeholder="Ej: 24"
                      keyboardType="numeric"
                      editable={canEditIdentity()}
                    />
                  </View>

                  <View style={styles.presentationField}>
                    <View style={styles.quantityHeaderRow}>
                      <Label color="secondary">Cantidad:</Label>
                      <TouchableOpacity
                        style={[
                          styles.selectForQuantityButton,
                          selectedPresentationForQuantity === pres.presentationId &&
                            styles.selectForQuantityButtonActive,
                        ]}
                        disabled={!canEdit()}
                        onPress={() => {
                          if (!canEdit()) return;
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
                        <Caption
                          color={
                            selectedPresentationForQuantity === pres.presentationId
                              ? theme.color.text.inverse
                              : theme.color.brand.accent
                          }
                        >
                          {selectedPresentationForQuantity === pres.presentationId
                            ? '✓ Seleccionada'
                            : 'Seleccionar'}
                        </Caption>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[
                        styles.presentationInput,
                        selectedPresentationForQuantity !== pres.presentationId &&
                          styles.inputDisabled,
                      ]}
                      value={pres.quantityOfPresentations.toString()}
                      onChangeText={(text) => {
                        if (selectedPresentationForQuantity === pres.presentationId) {
                          const newPresentations = [...validatedPresentations];
                          newPresentations[index].quantityOfPresentations = parseInt(text) || 0;
                          setValidatedPresentations(newPresentations);
                        }
                      }}
                      placeholder={
                        selectedPresentationForQuantity === pres.presentationId
                          ? 'Ej: 5'
                          : 'Seleccione primero'
                      }
                      keyboardType="number-pad"
                      editable={selectedPresentationForQuantity === pres.presentationId}
                    />
                    {selectedPresentationForQuantity === pres.presentationId &&
                      pres.quantityOfPresentations > 0 && (
                        <Caption color={theme.color.text.success}>
                          = {pres.quantityOfPresentations} × {pres.factorToBase} ={' '}
                          {pres.quantityOfPresentations * pres.factorToBase} unidades
                        </Caption>
                      )}
                  </View>
                </Card>
              ))}

              {validatedPresentations.length === 0 && (
                <Card variant="filled" padding="medium">
                  <Body color="secondary" align="center">
                    No hay presentaciones agregadas
                  </Body>
                </Card>
              )}
            </View>

            {/* Barcode */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Label color="secondary">
                  Código de Barras <Label color={theme.color.icon.danger}>*</Label>
                </Label>
                {canEditIdentity() && (
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => {
                      if (sku.trim()) {
                        setBarcode(sku.trim());
                        Alert.alert('Copiado', 'SKU copiado');
                      }
                    }}
                  >
                    <Caption color={theme.color.brand.accent}>📋 Copiar SKU</Caption>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={styles.input}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Ej: ABC123XYZ"
                placeholderTextColor={theme.color.text.placeholder}
                editable={canEditIdentity()}
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
                <Title size="medium" color={theme.color.text.muted}>
                  {calculateTotalStock()} unidades
                </Title>
              </View>
              <Caption color="tertiary">
                Unidades sueltas + (Cantidad de presentaciones × Factor)
              </Caption>
            </View>

            {/* Photo Capture */}
            <View style={styles.section}>
              <Label color="secondary">
                Foto de Validación <Label color={theme.color.icon.danger}>*</Label>
              </Label>
              {photoUri ? (
                <View style={styles.capturedContainer}>
                  <Image source={{ uri: photoUri }} style={styles.capturedPhoto} />
                  <Button
                    title="📷 Cambiar Foto"
                    onPress={() => setShowPhotoCapture(true)}
                    variant="secondary"
                    size="small"
                  />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={() => setShowPhotoCapture(true)}
                >
                  <Ionicons name="camera" size={32} color={theme.color.brand.accent} />
                  <Body color={theme.color.brand.accent}>Tomar Foto</Body>
                </TouchableOpacity>
              )}
            </View>

            {/* Product Photo */}
            {isFirstPhysicalEntry(product) && (
              <View style={styles.section}>
                <Label color="secondary">
                  Foto del Producto (Catálogo) <Label color={theme.color.icon.danger}>*</Label>
                </Label>
                {productPhotoUri ? (
                  <View style={styles.capturedContainer}>
                    <Image source={{ uri: productPhotoUri }} style={styles.capturedPhoto} />
                    <Button
                      title="🖼️ Cambiar Foto"
                      onPress={() => setShowProductPhotoCapture(true)}
                      variant="secondary"
                      size="small"
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.captureButton}
                    onPress={() => setShowProductPhotoCapture(true)}
                  >
                    <Ionicons name="image" size={32} color={theme.color.brand.accent} />
                    <Body color={theme.color.brand.accent}>Tomar Foto del Producto</Body>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Signature */}
            <View style={styles.section}>
              <Label color="secondary">
                Firma de Validación <Label color={theme.color.icon.danger}>*</Label>
              </Label>
              {signatureUri ? (
                <View style={styles.capturedContainer}>
                  <Image source={{ uri: signatureUri }} style={styles.capturedSignature} />
                  <Button
                    title="✍️ Cambiar Firma"
                    onPress={() => setShowSignatureCapture(true)}
                    variant="secondary"
                    size="small"
                  />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={() => setShowSignatureCapture(true)}
                >
                  <Ionicons name="pencil" size={32} color={theme.color.brand.accent} />
                  <Body color={theme.color.brand.accent}>Capturar Firma</Body>
                </TouchableOpacity>
              )}
            </View>

            {/* Variantes (color) - Modo A (single) o Modo B (multi) */}
            <View style={styles.variantsSection}>
              <View style={styles.variantsHeader}>
                <Label>Variantes / Colores</Label>
                <View style={styles.multiToggle}>
                  <Caption color="tertiary">Multiples variantes</Caption>
                  <Switch
                    value={multiVariantMode}
                    onValueChange={(value) => {
                      setMultiVariantMode(value);
                      if (value) {
                        setVariantName('');
                        if (variantRows.length === 0) {
                          setVariantRows([{ variantName: '', validatedStock: 1 }]);
                        }
                      } else {
                        setVariantRows([]);
                      }
                    }}
                  />
                </View>
              </View>

              {!multiVariantMode ? (
                <Input
                  label="Variante / Color (opcional)"
                  value={variantName}
                  onChangeText={setVariantName}
                  placeholder="Ej: rojo, azul, amarillo..."
                />
              ) : (
                <View style={styles.variantRowsContainer}>
                  <Caption color="tertiary">
                    El stock a nivel general se ignora. Cada variante define su propio stock, SKU,
                    codigo alterno y ubicacion. Si se omite el almacen se usa el general.
                  </Caption>
                  {variantRows.map((row, index) => (
                    <Card
                      key={`variant-row-${index}`}
                      variant="outlined"
                      padding="medium"
                      style={styles.variantRow}
                    >
                      <View style={styles.variantRowHeader}>
                        <Body>Variante #{index + 1}</Body>
                        <IconButton
                          icon="trash-outline"
                          variant="ghost"
                          size="small"
                          onPress={() =>
                            setVariantRows((rows) => rows.filter((_, i) => i !== index))
                          }
                        />
                      </View>
                      <Input
                        label="Nombre (color)"
                        value={row.variantName || ''}
                        onChangeText={(text) =>
                          setVariantRows((rows) =>
                            rows.map((r, i) => (i === index ? { ...r, variantName: text } : r))
                          )
                        }
                        placeholder="rojo, azul, verde..."
                      />
                      <Input
                        label="Stock (unidad base, entero >= 1)"
                        value={row.validatedStock ? String(row.validatedStock) : ''}
                        onChangeText={(text) => {
                          const parsed = parseInt(text, 10);
                          setVariantRows((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    validatedStock:
                                      Number.isFinite(parsed) && parsed > 0 ? parsed : 0,
                                  }
                                : r
                            )
                          );
                        }}
                        placeholder="1"
                        keyboardType="numeric"
                      />
                      <Input
                        label="SKU (opcional)"
                        value={row.variantSku || ''}
                        onChangeText={(text) =>
                          setVariantRows((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, variantSku: text || undefined } : r
                            )
                          )
                        }
                        placeholder="SKU exclusivo de esta variante"
                      />
                      <Input
                        label="Codigo alterno / barcode (opcional)"
                        value={row.variantBarcode || ''}
                        onChangeText={(text) =>
                          setVariantRows((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, variantBarcode: text || undefined } : r
                            )
                          )
                        }
                        placeholder="Codigo de barras"
                      />
                      <Input
                        label="Foto principal (URL, opcional)"
                        value={row.photoUrl || ''}
                        onChangeText={(text) =>
                          setVariantRows((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, photoUrl: text || undefined } : r
                            )
                          )
                        }
                        placeholder="purchases/rojo.jpg"
                      />
                      <View style={styles.multiToggle}>
                        <Body>Descuenta stock (tracksStock)</Body>
                        <Switch
                          value={row.tracksStock !== false}
                          onValueChange={(value) =>
                            setVariantRows((rows) =>
                              rows.map((r, i) => (i === index ? { ...r, tracksStock: value } : r))
                            )
                          }
                        />
                      </View>
                      {row.tracksStock === false && (
                        <Caption color="tertiary">
                          ⚠ Advertencia: con stock recibido y tracksStock=false el saldo queda
                          "fantasma" (el POS no puede vender). Solo usar cuando NO se necesita saldo
                          por color.
                        </Caption>
                      )}
                    </Card>
                  ))}
                  <Button
                    variant="secondary"
                    title="+ Agregar variante"
                    onPress={() =>
                      setVariantRows((rows) => [...rows, { variantName: '', validatedStock: 1 }])
                    }
                  />
                </View>
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

        {/* Validation Entries History */}
        {product.validations && product.validations.length > 0 && (
          <Card variant="elevated" padding="medium" style={styles.infoCard}>
            <Title size="small">Historial de Ingresos</Title>
            <Caption color="tertiary" style={styles.historySubtitle}>
              Cada ingreso genera una validación, lote y movimiento de stock.
            </Caption>
            {product.validations.map((validation, index) => {
              const isReversed = !!validation.isReversed;
              return (
                <View
                  key={validation.id}
                  style={[styles.validationEntry, isReversed && styles.validationEntryReversed]}
                >
                  <View style={styles.validationEntryHeader}>
                    <Body color={isReversed ? theme.color.text.danger : 'primary'}>
                      Ingreso #{index + 1}
                    </Body>
                    <Badge
                      label={isReversed ? 'Anulado' : 'Activo'}
                      variant={isReversed ? 'cancelled' : 'completed'}
                      size="small"
                    />
                  </View>
                  <View style={styles.infoRow}>
                    <Label color="secondary" style={styles.infoLabel}>
                      Stock:
                    </Label>
                    <Body style={styles.infoValue}>{validation.validatedStock} unidades</Body>
                  </View>
                  <View style={styles.infoRow}>
                    <Label color="secondary" style={styles.infoLabel}>
                      Fecha:
                    </Label>
                    <Body style={styles.infoValue}>
                      {new Date(validation.validatedAt).toLocaleString('es-PE')}
                    </Body>
                  </View>
                  {(validation.warehouse || validation.warehouseId) && (
                    <View style={styles.infoRow}>
                      <Label color="secondary" style={styles.infoLabel}>
                        Almacén:
                      </Label>
                      <Body style={styles.infoValue}>
                        {validation.warehouse?.name || validation.warehouseId}
                      </Body>
                    </View>
                  )}
                  {(validation.area || validation.areaId) && (
                    <View style={styles.infoRow}>
                      <Label color="secondary" style={styles.infoLabel}>
                        Área:
                      </Label>
                      <Body style={styles.infoValue}>
                        {validation.area?.name || validation.area?.code || validation.areaId}
                      </Body>
                    </View>
                  )}
                  {(validation.notes || validation.validationNotes) && (
                    <View style={styles.infoRow}>
                      <Label color="secondary" style={styles.infoLabel}>
                        Notas:
                      </Label>
                      <Body style={styles.infoValue}>
                        {validation.validationNotes || validation.notes}
                      </Body>
                    </View>
                  )}
                  {isReversed && validation.reversalReason && (
                    <View style={styles.infoRow}>
                      <Label color={theme.color.text.danger} style={styles.infoLabel}>
                        Motivo:
                      </Label>
                      <Body color={theme.color.text.danger} style={styles.infoValue}>
                        {validation.reversalReason}
                      </Body>
                    </View>
                  )}
                </View>
              );
            })}
          </Card>
        )}

        {/* Validated Product Info */}
        {product.status === PurchaseProductStatus.VALIDATED && (
          <Card variant="filled" padding="large" style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={48} color={theme.color.icon.success} />
            <Title size="medium" color={theme.color.state.success.text} align="center">
              Producto Validado
            </Title>
            <Body color="secondary" align="center">
              Este producto ha sido validado y activado en el catálogo.
            </Body>
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
            <Ionicons name="close-circle" size={48} color={theme.color.icon.danger} />
            <Title size="medium" color={theme.color.state.danger.text} align="center">
              Producto Rechazado
            </Title>
            <Label color={theme.color.text.danger}>Razón:</Label>
            <Body color={theme.color.state.danger.text}>{product.rejectionReason}</Body>
          </Card>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Buttons */}
      {canAddEntry() && (
        <View style={styles.footer}>
          <Button
            title="Cancelar"
            onPress={handleCancelEntry}
            variant="secondary"
            disabled={actionLoading}
            style={styles.footerButton}
          />
          <Button
            title={
              isProductIdentityResolved(product) ? 'Agregar Ingreso' : 'Registrar Primer Ingreso'
            }
            onPress={handleSubmitEntry}
            variant="primary"
            loading={actionLoading}
            style={styles.footerButton}
          />
        </View>
      )}

      {/* Add Presentation Dialog */}
      <Modal
        visible={showAddPresentation}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAddPresentation(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialog}>
            <Title size="medium">Agregar Presentación</Title>
            <Body color="secondary">Seleccione una presentación:</Body>
            <ScrollView style={styles.presentationList}>
              {presentations.map((presentation) => (
                <TouchableOpacity
                  key={presentation.id}
                  style={[
                    styles.presentationOption,
                    newPresentationId === presentation.id && styles.presentationOptionSelected,
                  ]}
                  onPress={() => setNewPresentationId(presentation.id)}
                >
                  <Body
                    color={
                      newPresentationId === presentation.id ? theme.color.brand.accent : 'primary'
                    }
                  >
                    {presentation.name}
                  </Body>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.dialogButtons}>
              <Button
                title="Cancelar"
                onPress={() => {
                  setShowAddPresentation(false);
                  setNewPresentationId('');
                }}
                variant="secondary"
                style={styles.dialogButton}
              />
              <Button
                title="Agregar"
                onPress={handleAddPresentation}
                variant="primary"
                style={styles.dialogButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo Capture Modal */}
      <Modal
        visible={showPhotoCapture}
        animationType="slide"
        onRequestClose={() => setShowPhotoCapture(false)}
      >
        <PhotoCapture
          onPhotoCapture={(uri) => {
            setPhotoUri(uri);
            setShowPhotoCapture(false);
          }}
          onCancel={() => setShowPhotoCapture(false)}
          currentPhoto={photoUri}
        />
      </Modal>

      {/* Product Photo Capture Modal */}
      <Modal
        visible={showProductPhotoCapture}
        animationType="slide"
        onRequestClose={() => setShowProductPhotoCapture(false)}
      >
        <PhotoCapture
          onPhotoCapture={(uri) => {
            setProductPhotoUri(uri);
            setShowProductPhotoCapture(false);
          }}
          onCancel={() => setShowProductPhotoCapture(false)}
          currentPhoto={productPhotoUri}
        />
      </Modal>

      {/* Signature Capture Modal */}
      <Modal
        visible={showSignatureCapture}
        animationType="slide"
        onRequestClose={() => setShowSignatureCapture(false)}
      >
        <SignatureCapture
          onSignatureCapture={(signature) => {
            setSignatureUri(signature);
            setShowSignatureCapture(false);
          }}
          onCancel={() => setShowSignatureCapture(false)}
        />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    variantsSection: {
      gap: theme.space[3],
      marginTop: theme.space[2],
    },
    variantsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    multiToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    variantRowsContainer: {
      gap: theme.space[3],
    },
    variantRow: {
      gap: theme.space[2],
    },
    variantRowHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
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
    infoCard: {
      marginBottom: theme.space[4],
    },
    infoHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    infoRow: {
      flexDirection: 'row',
      marginBottom: theme.space[2],
    },
    infoLabel: {
      width: 140,
    },
    infoValue: {
      flex: 1,
    },
    section: {
      marginBottom: theme.space[5],
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[2],
    },
    weightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      marginTop: theme.space[2],
    },
    weightInput: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1.5,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      fontSize: 16,
      color: theme.color.text.body,
    },
    weightUnitContainer: {
      flexDirection: 'row',
      gap: theme.space[1],
    },
    weightUnitButton: {
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2.5],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
    },
    weightUnitButtonActive: {
      backgroundColor: theme.color.brand.primary,
    },
    selector: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderWidth: 1.5,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      marginTop: theme.space[2],
    },
    selectorList: {
      marginTop: theme.space[2],
    },
    selectorItem: {
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    selectorItemSelected: {
      backgroundColor: theme.color.brand.accentSoft,
    },
    presentationCard: {
      marginTop: theme.space[3],
    },
    presentationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    presentationField: {
      marginBottom: theme.space[3],
    },
    presentationInput: {
      backgroundColor: theme.color.surface.base,
      borderWidth: 1.5,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2.5],
      fontSize: 15,
      color: theme.color.text.body,
      marginTop: theme.space[2],
    },
    quantityHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    selectForQuantityButton: {
      backgroundColor: theme.color.brand.accentSoft,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.sm,
    },
    selectForQuantityButtonActive: {
      backgroundColor: theme.color.brand.primary,
    },
    inputDisabled: {
      backgroundColor: theme.color.surface.subtle,
      opacity: 0.6,
    },
    copyButton: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1],
    },
    input: {
      backgroundColor: theme.color.surface.base,
      borderWidth: 1.5,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      fontSize: 16,
      color: theme.color.text.body,
      marginTop: theme.space[2],
    },
    calculatedField: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[4],
      marginTop: theme.space[2],
      alignItems: 'center',
    },
    captureButton: {
      backgroundColor: theme.color.surface.base,
      borderWidth: 2,
      borderColor: theme.color.brand.accent,
      borderStyle: 'dashed',
      borderRadius: theme.radii.lg,
      padding: theme.space[6],
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.space[2],
      gap: theme.space[2],
    },
    capturedContainer: {
      marginTop: theme.space[2],
      gap: theme.space[3],
    },
    capturedPhoto: {
      width: '100%',
      height: 200,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.subtle,
    },
    capturedSignature: {
      width: '100%',
      height: 120,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    successCard: {
      backgroundColor: theme.color.state.success.background,
      alignItems: 'center',
      gap: theme.space[3],
    },
    rejectionCard: {
      backgroundColor: theme.color.state.danger.background,
      alignItems: 'center',
      gap: theme.space[3],
    },
    historySubtitle: {
      marginTop: theme.space[1],
      marginBottom: theme.space[3],
    },
    validationEntry: {
      paddingVertical: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      gap: theme.space[1],
    },
    validationEntryReversed: {
      backgroundColor: theme.color.state.danger.background,
      paddingHorizontal: theme.space[3],
      borderRadius: theme.radii.md,
      marginTop: theme.space[2],
    },
    validationEntryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[2],
    },
    bottomSpacer: {
      height: theme.space[20],
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
    dialogOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[5],
    },
    dialog: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii['2xl'],
      padding: theme.space[6],
      width: '100%',
      maxWidth: 400,
      gap: theme.space[4],
      ...theme.shadow.xl,
    },
    dialogInput: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[4],
      fontSize: 15,
      color: theme.color.text.body,
      minHeight: 100,
      textAlignVertical: 'top',
    },
    dialogButtons: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    dialogButton: {
      flex: 1,
    },
    presentationList: {
      maxHeight: 300,
    },
    presentationOption: {
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
      marginBottom: theme.space[2],
    },
    presentationOptionSelected: {
      backgroundColor: theme.color.brand.accentSoft,
      borderWidth: 1.5,
      borderColor: theme.color.brand.accent,
    },
  });

export default ValidatePurchaseProductScreen;
