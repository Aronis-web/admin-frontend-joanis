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
  Image,
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
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

interface ValidatePurchaseProductScreenProps {
  navigation: any;
  route: {
    params: {
      purchaseId: string;
      productId: string;
    };
  };
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
  const [looseUnits, setLooseUnits] = useState(''); // Unidades sueltas
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [selectedArea, setSelectedArea] = useState<WarehouseArea | null>(null);
  const [barcode, setBarcode] = useState('');
  const [validationNotes, setValidationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Photo and Signature
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [signatureUri, setSignatureUri] = useState<string | undefined>();
  const [productPhotoUri, setProductPhotoUri] = useState<string | undefined>(); // ✅ Foto del producto
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  const [showProductPhotoCapture, setShowProductPhotoCapture] = useState(false); // ✅ Modal para foto del producto

  // Recurrence state
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [recurrentCandidates, setRecurrentCandidates] = useState<RecurrentProductCandidate[]>([]);
  const [recurrenceMessage, setRecurrenceMessage] = useState<string>('');
  const [recurrenceAction, setRecurrenceAction] = useState<'MERGE' | 'CREATE_NEW' | null>(null);
  const [selectedExistingProductId, setSelectedExistingProductId] = useState<string | null>(null);

  // Presentations from product (preliminary presentations)
  interface ValidatedPresentation {
    presentationId: string;
    presentationName: string;
    factorToBase: number;
    notes: string;
    quantityOfPresentations: number; // Cantidad de presentaciones (ej: 5 cajas)
  }
  const [validatedPresentations, setValidatedPresentations] = useState<ValidatedPresentation[]>([]);
  const [showAddPresentation, setShowAddPresentation] = useState(false);
  const [newPresentationId, setNewPresentationId] = useState('');
  const [selectedPresentationForQuantity, setSelectedPresentationForQuantity] = useState<
    string | null
  >(null); // Solo una presentación puede tener cantidad

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

      // Get effective site (selected site or current site)
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

      // Filter warehouses by current site
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

      // Initialize loose units from DB fields
      if (
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

          // Load areas for this warehouse
          console.log('🔍 [INIT] Loading areas for warehouse:', warehouse.id, warehouse.name);
          try {
            const areasData = await inventoryApi.getWarehouseAreas(warehouse.id);
            console.log('✅ [INIT] Areas loaded:', areasData.length, areasData);
            setAreas(areasData);

            // Set selected area if exists
            if (productData.areaId) {
              const area = areasData.find((a) => a.id === productData.areaId);
              console.log('🔍 [INIT] Looking for area:', productData.areaId, 'Found:', area);
              if (area) {
                setSelectedArea(area);
              }
            }
          } catch (error: any) {
            console.error('❌ [INIT] Error loading warehouse areas:', error);
            console.error('Error details:', error.message, error.response?.data);
            setAreas([]);
          }
        }
      }

      // Load presentations from presentationHistory (PRELIMINARY type)
      if (productData.presentationHistory && productData.presentationHistory.length > 0) {
        const preliminaryPresentations: ValidatedPresentation[] = productData.presentationHistory
          .filter((ph) => ph.type === 'PRELIMINARY')
          .map((ph) => ({
            presentationId: ph.presentationId,
            presentationName: ph.presentation?.name || 'Presentación',
            factorToBase: ph.factorToBase,
            notes: ph.notes || '',
            quantityOfPresentations: 0 as number, // Inicializar en 0
          }));
        setValidatedPresentations(preliminaryPresentations);

        // If there's a saved presentation quantity, restore it
        if (
          productData.validatedPresentationQuantity !== undefined &&
          productData.validatedPresentationQuantity !== null &&
          productData.validatedPresentationQuantity > 0
        ) {
          // Find the first presentation and set its quantity (assuming only one has quantity)
          if (preliminaryPresentations.length > 0) {
            const firstPresentationId = preliminaryPresentations[0].presentationId;
            setSelectedPresentationForQuantity(firstPresentationId);
            const validatedQty: number = productData.validatedPresentationQuantity ?? 0;
            const updatedPresentations = preliminaryPresentations.map((p, i) => ({
              presentationId: p.presentationId,
              presentationName: p.presentationName,
              factorToBase: p.factorToBase,
              notes: p.notes,
              quantityOfPresentations: (i === 0 ? validatedQty : 0) as number,
            })) as ValidatedPresentation[];
            // @ts-ignore - TypeScript incorrectly infers quantityOfPresentations as number | undefined
            setValidatedPresentations(updatedPresentations);
          }
        } else if (
          productData.preliminaryPresentationQuantity !== undefined &&
          productData.preliminaryPresentationQuantity !== null &&
          productData.preliminaryPresentationQuantity > 0
        ) {
          // Load from preliminary data
          if (preliminaryPresentations.length > 0) {
            const firstPresentationId = preliminaryPresentations[0].presentationId;
            setSelectedPresentationForQuantity(firstPresentationId);
            const preliminaryQty: number = productData.preliminaryPresentationQuantity ?? 0;
            const updatedPresentations = preliminaryPresentations.map((p, i) => ({
              presentationId: p.presentationId,
              presentationName: p.presentationName,
              factorToBase: p.factorToBase,
              notes: p.notes,
              quantityOfPresentations: (i === 0 ? preliminaryQty : 0) as number,
            })) as ValidatedPresentation[];
            // @ts-ignore - TypeScript incorrectly infers quantityOfPresentations as number | undefined
            setValidatedPresentations(updatedPresentations);
          }
        }
      }

      if (productData.barcode) {
        setBarcode(productData.barcode);
      }

      if (productData.validationNotes) {
        setValidationNotes(productData.validationNotes);
      }

      // Reset photo and signature when loading
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
    if (product?.status !== PurchaseProductStatus.PRELIMINARY) {
      return;
    }

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

  // Calculate total stock automatically
  const calculateTotalStock = (): number => {
    const loose = parseInt(looseUnits) || 0;
    let presentationUnits = 0;

    // Only calculate from the selected presentation for quantity
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

  /**
   * Upload photo and signature to server before validation
   * Returns the URLs of uploaded files
   */
  const uploadValidationFiles = async (): Promise<{
    photoUrl?: string;
    signatureUrl?: string;
    productPhotoUrl?: string;
  }> => {
    const result: { photoUrl?: string; signatureUrl?: string; productPhotoUrl?: string } = {};

    try {
      // Upload validation photo if exists
      if (photoUri) {
        console.log('📸 Uploading validation photo...');
        const photoFilename = `validacion-${Date.now()}.jpg`;
        const photoResponse = await filesApi.uploadByCategory(
          photoUri,
          photoFilename,
          'PURCHASES_VALIDACIONES_FOTOS',
          purchaseId,
          'image/jpeg'
        );
        result.photoUrl = photoResponse.url;
        console.log('✅ Validation photo uploaded:', result.photoUrl);
      }

      // Upload signature if exists
      if (signatureUri) {
        console.log('✍️ Uploading validation signature...');
        const signatureFilename = `firma-${Date.now()}.png`;
        const signatureResponse = await filesApi.uploadByCategory(
          signatureUri,
          signatureFilename,
          'PURCHASES_VALIDACIONES_FIRMAS',
          purchaseId,
          'image/png'
        );
        result.signatureUrl = signatureResponse.url;
        console.log('✅ Signature uploaded:', result.signatureUrl);
      }

      // ✅ Upload product photo if exists (goes to product catalog)
      if (productPhotoUri && product?.productId) {
        console.log('🖼️ Uploading product photo to catalog...');
        const productPhotoFilename = `producto-${Date.now()}.jpg`;
        const productPhotoResponse = await filesApi.uploadProductImage(
          productPhotoUri,
          product.productId,
          productPhotoFilename,
          'image/jpeg'
        );
        result.productPhotoUrl = productPhotoResponse.url;
        console.log('✅ Product photo uploaded to catalog:', result.productPhotoUrl);
      }

      return result;
    } catch (error: any) {
      console.error('❌ Error uploading validation files:', error);
      throw new Error(
        error.message || 'No se pudieron subir las fotos de validación al servidor'
      );
    }
  };

  /**
   * Check for recurrent products before closing validation
   */
  const checkRecurrentProducts = async () => {
    if (!product || !sku.trim()) {
      return false;
    }

    try {
      console.log('🔍 Checking for recurrent products...', { sku, barcode });
      const response = await purchasesService.checkRecurrence(purchaseId, productId, {
        sku: sku.trim(),
        barcode: barcode.trim() || undefined,
      });

      console.log('✅ Recurrence check response:', response);

      if (response.hasRecurrentProducts && response.candidates.length > 0) {
        // Show modal with candidates
        setRecurrentCandidates(response.candidates);
        setRecurrenceMessage(response.message || 'Se encontraron productos similares');
        setShowRecurrenceModal(true);
        return true; // Has recurrent products
      } else {
        // No recurrent products, proceed with CREATE_NEW
        setRecurrenceAction('CREATE_NEW');
        setSelectedExistingProductId(null);
        return false; // No recurrent products
      }
    } catch (error: any) {
      console.error('❌ Error checking recurrence:', error);
      // If check fails, continue with normal flow (CREATE_NEW)
      setRecurrenceAction('CREATE_NEW');
      setSelectedExistingProductId(null);
      return false;
    }
  };

  const handleCloseValidation = async () => {
    if (!product) {
      return;
    }

    // Validate SKU
    if (!sku.trim()) {
      Alert.alert('Error', 'El SKU es obligatorio');
      return;
    }

    // Validate name
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }

    // Validate barcode
    if (!barcode.trim()) {
      Alert.alert('Error', 'El código de barras es obligatorio');
      return;
    }

    // Validate cost
    const costValue = parseFloat(costCents);
    if (isNaN(costValue) || costValue <= 0) {
      Alert.alert('Error', 'Debe ingresar un costo válido');
      return;
    }

    const looseUnitsValue = parseInt(looseUnits);
    if (isNaN(looseUnitsValue) || looseUnitsValue < 0) {
      Alert.alert('Error', 'Debe ingresar unidades sueltas válidas');
      return;
    }

    if (!selectedWarehouse) {
      Alert.alert('Error', 'Debe seleccionar un almacén');
      return;
    }

    // Validar que todas las fotos sean obligatorias
    if (!photoUri) {
      Alert.alert('Error', 'La foto de validación es obligatoria');
      return;
    }

    if (!productPhotoUri) {
      Alert.alert('Error', 'La foto del producto es obligatoria');
      return;
    }

    if (!signatureUri) {
      Alert.alert('Error', 'La firma de validación es obligatoria');
      return;
    }

    // Presentaciones ahora son opcionales
    // if (validatedPresentations.length === 0) {
    //   Alert.alert('Error', 'Debe tener al menos una presentación validada');
    //   return;
    // }

    // Validate all presentations have valid data (only if there are presentations)
    if (validatedPresentations.length > 0) {
      for (const pres of validatedPresentations) {
        if (!pres.presentationId || pres.factorToBase <= 0) {
          Alert.alert('Error', 'Todas las presentaciones deben tener un factor válido');
          return;
        }
      }
    }

    // ========== NEW: Check for recurrent products BEFORE closing ==========
    setActionLoading(true);
    try {
      const hasRecurrent = await checkRecurrentProducts();
      if (hasRecurrent) {
        // Modal will be shown, wait for user decision
        setActionLoading(false);
        return;
      }
      // No recurrent products, continue with close validation
    } catch (error: any) {
      console.error('❌ Error in recurrence check:', error);
      setActionLoading(false);
      return;
    }
    setActionLoading(false);

    // Continue with confirmation dialog
    Alert.alert(
      'Cerrar Validación',
      '¿Está seguro de cerrar la validación? El producto se activará y se agregará al inventario. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Validación',
          style: 'destructive',
          onPress: async () => {
            await performCloseValidation();
          },
        },
      ]
    );
  };

  /**
   * Perform the actual close validation (called after recurrence check and confirmation)
   */
  const performCloseValidation = async () => {
    if (!product) {
      return;
    }

    const costValue = parseFloat(costCents);
    const looseUnitsValue = parseInt(looseUnits);
    const totalStock = calculateTotalStock();

    // Get the quantity of presentations from the selected presentation
    let validatedPresentationQuantity = 0;
    if (selectedPresentationForQuantity) {
      const selectedPres = validatedPresentations.find(
        (p) => p.presentationId === selectedPresentationForQuantity
      );
      if (selectedPres) {
        validatedPresentationQuantity = selectedPres.quantityOfPresentations;
      }
    }

    setActionLoading(true);
    try {
      // Upload photos and signature first
      console.log('📤 Uploading validation files before closing...');
      const uploadedFiles = await uploadValidationFiles();
      console.log('✅ Files uploaded successfully:', uploadedFiles);

      // Prepare validation data
      const validationData = {
        sku: sku.trim(),
        name: name.trim(),
        costCents: Math.round(costValue * 100),
        preliminaryStock: product.preliminaryStock,
        validatedStock: totalStock,
        validatedLooseUnits: looseUnitsValue,
        validatedPresentationQuantity: validatedPresentationQuantity,
        warehouseId: selectedWarehouse.id,
        areaId: selectedArea?.id,
        presentations: validatedPresentations.length > 0 ? validatedPresentations.map((p) => ({
          presentationId: p.presentationId,
          factorToBase: Number(p.factorToBase),
          notes: p.notes.trim() || undefined,
        })) : undefined,
        barcode: barcode.trim() || undefined,
        photoUrl: uploadedFiles.photoUrl,
        signatureUrl: uploadedFiles.signatureUrl,
        validationNotes: validationNotes.trim() || undefined,
        // ========== NEW: Recurrence fields ==========
        recurrenceAction: recurrenceAction || 'CREATE_NEW',
        existingProductId: selectedExistingProductId || undefined,
        recurrenceMetadata: recurrentCandidates.length > 0 ? {
          candidatesReviewed: recurrentCandidates.length,
          userDecision: recurrenceAction === 'MERGE' ? 'Usuario confirmó producto existente' : 'Usuario creó producto nuevo',
          matchConfidence: 95,
        } : undefined,
      };

      console.log('📝 Validation data:', validationData);

      // Use V2 endpoint with recurrence support
      const response = await purchasesService.validateProductV2(purchaseId, productId, validationData);

      console.log('✅ Validation V2 response:', response);

      // Then close validation
      await purchasesService.closeValidation(purchaseId, productId);

      // Show success message based on action
      const successMessage = response.action === 'MERGED'
        ? `Stock agregado al producto existente: ${response.product.title}. Validación cerrada.`
        : 'Validación cerrada. Producto nuevo creado y activado.';

      Alert.alert('Éxito', successMessage, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);

      // Reset recurrence state
      setRecurrenceAction(null);
      setSelectedExistingProductId(null);
      setRecurrentCandidates([]);
    } catch (error: any) {
      console.error('❌ Error in performCloseValidation:', error);
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

  /**
   * Handle recurrence modal - User confirms existing product (MERGE)
   */
  const handleRecurrenceConfirm = (productId: string) => {
    console.log('✅ User confirmed existing product:', productId);
    setRecurrenceAction('MERGE');
    setSelectedExistingProductId(productId);
    setShowRecurrenceModal(false);

    // Show confirmation dialog before closing
    Alert.alert(
      'Cerrar Validación',
      '¿Está seguro de cerrar la validación? El stock se sumará al producto existente. Esta acción no se puede deshacer.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => {
            // Reset recurrence state if user cancels
            setRecurrenceAction(null);
            setSelectedExistingProductId(null);
          }
        },
        {
          text: 'Cerrar Validación',
          style: 'destructive',
          onPress: async () => {
            await performCloseValidation();
          },
        },
      ]
    );
  };

  /**
   * Handle recurrence modal - User creates new product (CREATE_NEW)
   */
  const handleRecurrenceCreateNew = () => {
    console.log('➕ User chose to create new product');
    setRecurrenceAction('CREATE_NEW');
    setSelectedExistingProductId(null);
    setShowRecurrenceModal(false);

    // Show confirmation dialog before closing
    Alert.alert(
      'Cerrar Validación',
      '¿Está seguro de cerrar la validación? Se creará un nuevo producto. Esta acción no se puede deshacer.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => {
            // Reset recurrence state if user cancels
            setRecurrenceAction(null);
          }
        },
        {
          text: 'Cerrar Validación',
          style: 'destructive',
          onPress: async () => {
            await performCloseValidation();
          },
        },
      ]
    );
  };

  /**
   * Handle recurrence modal - User cancels
   */
  const handleRecurrenceCancel = () => {
    console.log('❌ User cancelled recurrence modal');
    setShowRecurrenceModal(false);
    setRecurrentCandidates([]);
    setRecurrenceMessage('');
    // Don't reset recurrenceAction here, let user try again
  };

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  const handleAddPresentation = () => {
    if (!newPresentationId) {
      Alert.alert('Error', 'Debe seleccionar una presentación');
      return;
    }

    // Check if presentation already exists
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
    Alert.alert('Eliminar Presentación', '¿Está seguro de eliminar esta presentación?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          const presentationToRemove = validatedPresentations[index];
          const newPresentations = validatedPresentations.filter((_, i) => i !== index);
          setValidatedPresentations(newPresentations);

          // If this was the selected presentation for quantity, clear it
          if (selectedPresentationForQuantity === presentationToRemove.presentationId) {
            setSelectedPresentationForQuantity(null);
          }
        },
      },
    ]);
  };

  const canEdit = () => {
    return (
      product?.status === PurchaseProductStatus.PRELIMINARY ||
      product?.status === PurchaseProductStatus.IN_VALIDATION
    );
  };

  const canStartValidation = () => {
    return product?.status === PurchaseProductStatus.PRELIMINARY;
  };

  const canCloseValidation = () => {
    return product?.status === PurchaseProductStatus.IN_VALIDATION;
  };

  const canReject = () => {
    return (
      product?.status === PurchaseProductStatus.PRELIMINARY ||
      product?.status === PurchaseProductStatus.IN_VALIDATION
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando producto...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, isTablet && styles.headerTablet]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>Validar Producto</Text>
          <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>{product.name}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, isTablet && styles.contentContainerTablet]}
      >
        {/* Product Info - Editable */}
        {canEdit() && (
          <>
            {/* SKU */}
            <View style={styles.section}>
              <View style={styles.labelWithButton}>
                <Text style={[styles.label, isTablet && styles.labelTablet]}>
                  SKU <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={async () => {
                    if (sku.trim()) {
                      await Clipboard.setStringAsync(sku);
                      Alert.alert('Copiado', 'SKU copiado al portapapeles');
                    }
                  }}
                  disabled={!sku.trim()}
                >
                  <Text style={styles.copyButtonText}>📋 Copiar</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={sku}
                onChangeText={setSku}
                placeholder="Ej: PROD-001"
                placeholderTextColor="#94A3B8"
                editable={canEdit()}
              />
            </View>

            {/* Name */}
            <View style={styles.section}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Nombre <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={name}
                onChangeText={setName}
                placeholder="Ej: Producto de ejemplo"
                placeholderTextColor="#94A3B8"
                editable={canEdit()}
              />
            </View>

            {/* Cost */}
            <View style={styles.section}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Costo (S/) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={costCents}
                onChangeText={setCostCents}
                placeholder="Ej: 15.50"
                placeholderTextColor="#94A3B8"
                keyboardType="decimal-pad"
                editable={canEdit()}
              />
              <Text style={[styles.hint, isTablet && styles.hintTablet]}>
                Costo unitario en soles
              </Text>
            </View>

            {/* Warehouse Selector */}
            <View style={styles.section}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Almacén <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[styles.selector, isTablet && styles.selectorTablet]}
                onPress={() => setShowWarehouseSelector(!showWarehouseSelector)}
                disabled={!canEdit()}
              >
                <Text
                  style={[
                    styles.selectorText,
                    isTablet && styles.selectorTextTablet,
                    !selectedWarehouse && styles.selectorPlaceholder,
                  ]}
                >
                  {selectedWarehouse ? selectedWarehouse.name : 'Seleccionar almacén'}
                </Text>
                <Text style={styles.selectorIcon}>{showWarehouseSelector ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showWarehouseSelector && (
                <ScrollView
                  style={[styles.optionsList, isTablet && styles.optionsListTablet]}
                  nestedScrollEnabled={true}
                >
                  {warehouses.map((warehouse) => (
                    <TouchableOpacity
                      key={warehouse.id}
                      style={[
                        styles.optionItem,
                        isTablet && styles.optionItemTablet,
                        selectedWarehouse?.id === warehouse.id && styles.optionItemSelected,
                      ]}
                      onPress={async () => {
                        setSelectedWarehouse(warehouse);
                        setSelectedArea(null);
                        setShowWarehouseSelector(false);

                        // Load areas for the selected warehouse
                        setLoadingAreas(true);
                        console.log(
                          '🔍 Loading areas for warehouse:',
                          warehouse.id,
                          warehouse.name
                        );
                        try {
                          const areasData = await inventoryApi.getWarehouseAreas(warehouse.id);
                          console.log('✅ Areas loaded:', areasData.length, areasData);
                          setAreas(areasData);
                        } catch (error: any) {
                          console.error('❌ Error loading warehouse areas:', error);
                          console.error('Error details:', error.message, error.response?.data);
                          setAreas([]);
                          Alert.alert(
                            'Advertencia',
                            `No se pudieron cargar las áreas del almacén: ${error.message || 'Error desconocido'}`
                          );
                        } finally {
                          setLoadingAreas(false);
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          isTablet && styles.optionTextTablet,
                          selectedWarehouse?.id === warehouse.id && styles.optionTextSelected,
                        ]}
                      >
                        {warehouse.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Area Selector */}
            {selectedWarehouse && (
              <View style={styles.section}>
                <Text style={[styles.label, isTablet && styles.labelTablet]}>Área</Text>
                <TouchableOpacity
                  style={[styles.selector, isTablet && styles.selectorTablet]}
                  onPress={() => setShowAreaSelector(!showAreaSelector)}
                  disabled={!canEdit() || loadingAreas}
                >
                  <Text
                    style={[
                      styles.selectorText,
                      isTablet && styles.selectorTextTablet,
                      !selectedArea && styles.selectorPlaceholder,
                    ]}
                  >
                    {loadingAreas
                      ? 'Cargando áreas...'
                      : selectedArea
                        ? selectedArea.code
                        : areas.length > 0
                          ? 'Seleccionar área (opcional)'
                          : 'Sin áreas disponibles'}
                  </Text>
                  <Text style={styles.selectorIcon}>{showAreaSelector ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {showAreaSelector && !loadingAreas && (
                  <ScrollView
                    style={[styles.optionsList, isTablet && styles.optionsListTablet]}
                    nestedScrollEnabled={true}
                  >
                    <TouchableOpacity
                      style={[styles.optionItem, isTablet && styles.optionItemTablet]}
                      onPress={() => {
                        setSelectedArea(null);
                        setShowAreaSelector(false);
                      }}
                    >
                      <Text style={[styles.optionText, isTablet && styles.optionTextTablet]}>
                        Sin área específica
                      </Text>
                    </TouchableOpacity>
                    {areas.map((area) => (
                      <TouchableOpacity
                        key={area.id}
                        style={[
                          styles.optionItem,
                          isTablet && styles.optionItemTablet,
                          selectedArea?.id === area.id && styles.optionItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedArea(area);
                          setShowAreaSelector(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            isTablet && styles.optionTextTablet,
                            selectedArea?.id === area.id && styles.optionTextSelected,
                          ]}
                        >
                          {area.code}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Presentations List */}
            <View style={styles.section}>
              <View style={styles.presentationHeaderRow}>
                <Text style={[styles.label, isTablet && styles.labelTablet]}>
                  Presentaciones Validadas (Opcional)
                </Text>
                {canEdit() && (
                  <TouchableOpacity
                    style={[
                      styles.addPresentationButton,
                      isTablet && styles.addPresentationButtonTablet,
                    ]}
                    onPress={() => setShowAddPresentation(true)}
                  >
                    <Text
                      style={[
                        styles.addPresentationButtonText,
                        isTablet && styles.addPresentationButtonTextTablet,
                      ]}
                    >
                      + Agregar
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.hint, isTablet && styles.hintTablet]}>
                Presentaciones del producto (opcional). Confirme o edite los factores de conversión.
              </Text>

              {validatedPresentations.map((pres, index) => (
                <View
                  key={index}
                  style={[styles.presentationCard, isTablet && styles.presentationCardTablet]}
                >
                  <View style={styles.presentationHeader}>
                    <Text
                      style={[styles.presentationName, isTablet && styles.presentationNameTablet]}
                    >
                      {pres.presentationName}
                    </Text>
                    {canEdit() && (
                      <TouchableOpacity
                        style={[
                          styles.removePresentationButton,
                          isTablet && styles.removePresentationButtonTablet,
                        ]}
                        onPress={() => handleRemovePresentation(index)}
                      >
                        <Text
                          style={[
                            styles.removePresentationButtonText,
                            isTablet && styles.removePresentationButtonTextTablet,
                          ]}
                        >
                          🗑️
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.presentationRow}>
                    <View style={styles.presentationField}>
                      <Text
                        style={[
                          styles.presentationLabel,
                          isTablet && styles.presentationLabelTablet,
                        ]}
                      >
                        Factor a Base:
                      </Text>
                      <TextInput
                        style={[
                          styles.presentationInput,
                          isTablet && styles.presentationInputTablet,
                        ]}
                        value={pres.factorToBase.toString()}
                        onChangeText={(text) => {
                          const newPresentations = [...validatedPresentations];
                          const parsedValue = parseFloat(text);
                          newPresentations[index].factorToBase = isNaN(parsedValue)
                            ? 0
                            : parsedValue;
                          setValidatedPresentations(newPresentations);
                        }}
                        placeholder="Ej: 24"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        editable={canEdit()}
                      />
                    </View>
                  </View>

                  {/* Quantity of Presentations - Only for selected presentation */}
                  <View style={styles.presentationRow}>
                    <View style={styles.presentationFieldFull}>
                      <View style={styles.quantityHeaderRow}>
                        <Text
                          style={[
                            styles.presentationLabel,
                            isTablet && styles.presentationLabelTablet,
                          ]}
                        >
                          Cantidad de Presentaciones:
                        </Text>
                        {canEdit() && (
                          <TouchableOpacity
                            style={[
                              styles.selectForQuantityButton,
                              selectedPresentationForQuantity === pres.presentationId &&
                                styles.selectForQuantityButtonActive,
                            ]}
                            onPress={() => {
                              if (selectedPresentationForQuantity === pres.presentationId) {
                                // Deselect
                                setSelectedPresentationForQuantity(null);
                                const newPresentations = [...validatedPresentations];
                                newPresentations[index].quantityOfPresentations = 0;
                                setValidatedPresentations(newPresentations);
                              } else {
                                // Select this presentation and clear others
                                setSelectedPresentationForQuantity(pres.presentationId);
                                const newPresentations = validatedPresentations.map((p, i) => ({
                                  ...p,
                                  quantityOfPresentations:
                                    i === index ? p.quantityOfPresentations : 0,
                                }));
                                setValidatedPresentations(newPresentations);
                              }
                            }}
                          >
                            <Text
                              style={[
                                styles.selectForQuantityButtonText,
                                selectedPresentationForQuantity === pres.presentationId &&
                                  styles.selectForQuantityButtonTextActive,
                              ]}
                            >
                              {selectedPresentationForQuantity === pres.presentationId
                                ? '✓ Seleccionada'
                                : 'Seleccionar'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <TextInput
                        style={[
                          styles.presentationInput,
                          isTablet && styles.presentationInputTablet,
                          selectedPresentationForQuantity !== pres.presentationId &&
                            styles.presentationInputDisabled,
                        ]}
                        value={pres.quantityOfPresentations.toString()}
                        onChangeText={(text) => {
                          if (selectedPresentationForQuantity === pres.presentationId) {
                            const newPresentations = [...validatedPresentations];
                            const parsedValue = parseInt(text);
                            newPresentations[index].quantityOfPresentations = isNaN(parsedValue)
                              ? 0
                              : parsedValue;
                            setValidatedPresentations(newPresentations);
                          }
                        }}
                        placeholder={
                          selectedPresentationForQuantity === pres.presentationId
                            ? 'Ej: 5'
                            : 'Seleccione esta presentación primero'
                        }
                        placeholderTextColor="#94A3B8"
                        keyboardType="number-pad"
                        editable={
                          canEdit() && selectedPresentationForQuantity === pres.presentationId
                        }
                      />
                      {selectedPresentationForQuantity === pres.presentationId &&
                        pres.quantityOfPresentations > 0 && (
                          <Text
                            style={[
                              styles.hint,
                              isTablet && styles.hintTablet,
                              styles.calculationHint,
                            ]}
                          >
                            = {pres.quantityOfPresentations} × {pres.factorToBase} ={' '}
                            {pres.quantityOfPresentations * pres.factorToBase} unidades
                          </Text>
                        )}
                    </View>
                  </View>

                  <View style={styles.presentationRow}>
                    <View style={styles.presentationFieldFull}>
                      <Text
                        style={[
                          styles.presentationLabel,
                          isTablet && styles.presentationLabelTablet,
                        ]}
                      >
                        Notas:
                      </Text>
                      <TextInput
                        style={[
                          styles.presentationInput,
                          isTablet && styles.presentationInputTablet,
                        ]}
                        value={pres.notes}
                        onChangeText={(text) => {
                          const newPresentations = [...validatedPresentations];
                          newPresentations[index].notes = text;
                          setValidatedPresentations(newPresentations);
                        }}
                        placeholder="Ej: Caja de 24 unidades confirmada"
                        placeholderTextColor="#94A3B8"
                        editable={canEdit()}
                      />
                    </View>
                  </View>
                </View>
              ))}

              {validatedPresentations.length === 0 && (
                <View style={styles.emptyPresentations}>
                  <Text style={styles.emptyPresentationsText}>
                    No hay presentaciones. Use el botón "+ Agregar" para agregar presentaciones.
                  </Text>
                </View>
              )}
            </View>

            {/* Barcode */}
            <View style={styles.section}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Código de Barras <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Ej: ABC123XYZ"
                placeholderTextColor="#94A3B8"
                keyboardType="default"
                editable={canEdit()}
              />
            </View>

            {/* Loose Units */}
            <View style={styles.section}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Unidades Sueltas <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, isTablet && styles.inputTablet]}
                value={looseUnits}
                onChangeText={setLooseUnits}
                placeholder="Ej: 5"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                editable={canEdit()}
              />
              <Text style={[styles.hint, isTablet && styles.hintTablet]}>
                Cantidad de unidades individuales sueltas
              </Text>
            </View>

            {/* Total Stock (Calculated - Read Only) */}
            <View style={styles.section}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Stock Total Validado (Calculado)
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

            {/* Photo Capture */}
            <View style={styles.section}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Foto de Validación</Text>
              {photoUri ? (
                <View style={styles.capturedContainer}>
                  <Image source={{ uri: photoUri }} style={styles.capturedPhoto} />
                  <TouchableOpacity
                    style={styles.recaptureButton}
                    onPress={() => setShowPhotoCapture(true)}
                    disabled={!canEdit()}
                  >
                    <Text style={styles.recaptureButtonText}>📷 Cambiar Foto</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={() => setShowPhotoCapture(true)}
                  disabled={!canEdit()}
                >
                  <Text style={styles.captureButtonIcon}>📷</Text>
                  <Text style={styles.captureButtonText}>Tomar Foto</Text>
                </TouchableOpacity>
              )}
              <Text style={[styles.hint, isTablet && styles.hintTablet]}>
                Foto del producto durante la validación *
              </Text>
            </View>

            {/* ✅ Product Photo Capture */}
            <View style={styles.section}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>Foto del Producto (Catálogo)</Text>
              {productPhotoUri ? (
                <View style={styles.capturedContainer}>
                  <Image source={{ uri: productPhotoUri }} style={styles.capturedPhoto} />
                  <TouchableOpacity
                    style={styles.recaptureButton}
                    onPress={() => setShowProductPhotoCapture(true)}
                    disabled={!canEdit()}
                  >
                    <Text style={styles.recaptureButtonText}>🖼️ Cambiar Foto</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={() => setShowProductPhotoCapture(true)}
                  disabled={!canEdit()}
                >
                  <Text style={styles.captureButtonIcon}>🖼️</Text>
                  <Text style={styles.captureButtonText}>Tomar Foto del Producto</Text>
                </TouchableOpacity>
              )}
              <Text style={[styles.hint, isTablet && styles.hintTablet]}>
                Foto del producto para el catálogo *
              </Text>
            </View>

            {/* Signature Capture */}
            <View style={styles.section}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Firma de Validación
              </Text>
              {signatureUri ? (
                <View style={styles.capturedContainer}>
                  <Image source={{ uri: signatureUri }} style={styles.capturedSignature} />
                  <TouchableOpacity
                    style={styles.recaptureButton}
                    onPress={() => setShowSignatureCapture(true)}
                    disabled={!canEdit()}
                  >
                    <Text style={styles.recaptureButtonText}>✍️ Cambiar Firma</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={() => setShowSignatureCapture(true)}
                  disabled={!canEdit()}
                >
                  <Text style={styles.captureButtonIcon}>✍️</Text>
                  <Text style={styles.captureButtonText}>Capturar Firma</Text>
                </TouchableOpacity>
              )}
              <Text style={[styles.hint, isTablet && styles.hintTablet]}>
                Firma del responsable de la validación *
              </Text>
            </View>

            {/* Validation Notes */}
            <View style={styles.section}>
              <Text style={[styles.label, isTablet && styles.labelTablet]}>
                Notas de Validación
              </Text>
              <TextInput
                style={[styles.textArea, isTablet && styles.textAreaTablet]}
                value={validationNotes}
                onChangeText={setValidationNotes}
                placeholder="Observaciones sobre la validación..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={canEdit()}
              />
            </View>
          </>
        )}

        {/* Validated Product Info */}
        {product.status === PurchaseProductStatus.VALIDATED && (
          <View style={[styles.successCard, isTablet && styles.successCardTablet]}>
            <Text style={[styles.successIcon, isTablet && styles.successIconTablet]}>✅</Text>
            <Text style={[styles.successTitle, isTablet && styles.successTitleTablet]}>
              Producto Validado
            </Text>
            <Text style={[styles.successText, isTablet && styles.successTextTablet]}>
              Este producto ha sido validado y activado en el catálogo.
            </Text>
            {product.validatedAt && (
              <Text style={[styles.successDate, isTablet && styles.successDateTablet]}>
                Validado el {new Date(product.validatedAt).toLocaleDateString('es-PE')}
              </Text>
            )}
          </View>
        )}

        {/* Rejected Product Info */}
        {product.status === PurchaseProductStatus.REJECTED && product.rejectionReason && (
          <View style={[styles.rejectionCard, isTablet && styles.rejectionCardTablet]}>
            <Text style={[styles.rejectionIcon, isTablet && styles.rejectionIconTablet]}>❌</Text>
            <Text style={[styles.rejectionTitle, isTablet && styles.rejectionTitleTablet]}>
              Producto Rechazado
            </Text>
            <Text style={[styles.rejectionLabel, isTablet && styles.rejectionLabelTablet]}>
              Razón:
            </Text>
            <Text style={[styles.rejectionText, isTablet && styles.rejectionTextTablet]}>
              {product.rejectionReason}
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Action Buttons */}
      {(canStartValidation() || canEdit() || canCloseValidation() || canReject()) && (
        <View style={[styles.footer, isTablet && styles.footerTablet]}>
          {canStartValidation() && (
            <TouchableOpacity
              style={[styles.primaryButton, isTablet && styles.primaryButtonTablet]}
              onPress={handleStartValidation}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={[styles.primaryButtonText, isTablet && styles.primaryButtonTextTablet]}
                >
                  Iniciar Validación
                </Text>
              )}
            </TouchableOpacity>
          )}

          {canEdit() && product.status === PurchaseProductStatus.IN_VALIDATION && (
            <TouchableOpacity
              style={[styles.primaryButton, isTablet && styles.primaryButtonTablet]}
              onPress={handleCloseValidation}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={[styles.primaryButtonText, isTablet && styles.primaryButtonTextTablet]}
                >
                  Cerrar Validación
                </Text>
              )}
            </TouchableOpacity>
          )}

          {canReject() && (
            <TouchableOpacity
              style={[styles.rejectButton, isTablet && styles.rejectButtonTablet]}
              onPress={() => setShowRejectDialog(true)}
              disabled={actionLoading}
            >
              <Text style={[styles.rejectButtonText, isTablet && styles.rejectButtonTextTablet]}>
                Rechazar
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <View style={styles.overlay}>
          <View style={[styles.dialog, isTablet && styles.dialogTablet]}>
            <Text style={[styles.dialogTitle, isTablet && styles.dialogTitleTablet]}>
              Rechazar Producto
            </Text>
            <Text style={[styles.dialogText, isTablet && styles.dialogTextTablet]}>
              Ingrese la razón del rechazo:
            </Text>
            <TextInput
              style={[styles.dialogInput, isTablet && styles.dialogInputTablet]}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Ej: Producto dañado, no cumple especificaciones"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogCancelButton, isTablet && styles.dialogCancelButtonTablet]}
                onPress={() => {
                  setShowRejectDialog(false);
                  setRejectionReason('');
                }}
              >
                <Text
                  style={[
                    styles.dialogCancelButtonText,
                    isTablet && styles.dialogCancelButtonTextTablet,
                  ]}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogConfirmButton, isTablet && styles.dialogConfirmButtonTablet]}
                onPress={handleReject}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={[
                      styles.dialogConfirmButtonText,
                      isTablet && styles.dialogConfirmButtonTextTablet,
                    ]}
                  >
                    Rechazar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Add Presentation Dialog */}
      {showAddPresentation && (
        <View style={styles.overlay}>
          <View style={[styles.dialog, isTablet && styles.dialogTablet]}>
            <Text style={[styles.dialogTitle, isTablet && styles.dialogTitleTablet]}>
              Agregar Presentación
            </Text>
            <Text style={[styles.dialogText, isTablet && styles.dialogTextTablet]}>
              Seleccione una presentación:
            </Text>

            <View style={[styles.dialogSelector, isTablet && styles.dialogSelectorTablet]}>
              {presentations.map((presentation) => (
                <TouchableOpacity
                  key={presentation.id}
                  style={[
                    styles.dialogOptionItem,
                    isTablet && styles.dialogOptionItemTablet,
                    newPresentationId === presentation.id && styles.dialogOptionItemSelected,
                  ]}
                  onPress={() => setNewPresentationId(presentation.id)}
                >
                  <Text
                    style={[
                      styles.dialogOptionText,
                      isTablet && styles.dialogOptionTextTablet,
                      newPresentationId === presentation.id && styles.dialogOptionTextSelected,
                    ]}
                  >
                    {presentation.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogCancelButton, isTablet && styles.dialogCancelButtonTablet]}
                onPress={() => {
                  setShowAddPresentation(false);
                  setNewPresentationId('');
                }}
              >
                <Text
                  style={[
                    styles.dialogCancelButtonText,
                    isTablet && styles.dialogCancelButtonTextTablet,
                  ]}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogConfirmButton, isTablet && styles.dialogConfirmButtonTablet]}
                onPress={handleAddPresentation}
              >
                <Text
                  style={[
                    styles.dialogConfirmButtonText,
                    isTablet && styles.dialogConfirmButtonTextTablet,
                  ]}
                >
                  Agregar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Photo Capture Modal */}
      {showPhotoCapture && (
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
      )}

      {/* ✅ Product Photo Capture Modal */}
      {showProductPhotoCapture && (
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
      )}

      {/* Signature Capture Modal */}
      {showSignatureCapture && (
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
      )}

      {/* ========== NEW: Recurrent Product Modal ========== */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
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
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoCardTablet: {
    padding: 24,
    borderRadius: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  sectionTitleTablet: {
    fontSize: 18,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    width: 140,
  },
  infoLabelTablet: {
    fontSize: 16,
    width: 160,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  infoValueTablet: {
    fontSize: 16,
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
  labelWithButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  copyButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
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
  textArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
    minHeight: 100,
  },
  textAreaTablet: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 17,
    borderRadius: 14,
    minHeight: 120,
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
  successCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 24,
  },
  successCardTablet: {
    padding: 32,
    borderRadius: 18,
  },
  successIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  successIconTablet: {
    fontSize: 64,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 8,
  },
  successTitleTablet: {
    fontSize: 22,
  },
  successText: {
    fontSize: 14,
    color: '#15803D',
    textAlign: 'center',
    marginBottom: 8,
  },
  successTextTablet: {
    fontSize: 16,
  },
  successDate: {
    fontSize: 12,
    color: '#16A34A',
  },
  successDateTablet: {
    fontSize: 14,
  },
  rejectionCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 24,
  },
  rejectionCardTablet: {
    padding: 32,
    borderRadius: 18,
  },
  rejectionIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  rejectionIconTablet: {
    fontSize: 64,
  },
  rejectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 12,
  },
  rejectionTitleTablet: {
    fontSize: 22,
  },
  rejectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 4,
  },
  rejectionLabelTablet: {
    fontSize: 15,
  },
  rejectionText: {
    fontSize: 14,
    color: '#B91C1C',
    textAlign: 'center',
  },
  rejectionTextTablet: {
    fontSize: 16,
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
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    alignItems: 'center',
  },
  primaryButtonTablet: {
    paddingVertical: 16,
    borderRadius: 14,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  primaryButtonTextTablet: {
    fontSize: 17,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  secondaryButtonTablet: {
    paddingVertical: 16,
    borderRadius: 14,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  secondaryButtonTextTablet: {
    fontSize: 17,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  rejectButtonTablet: {
    paddingVertical: 16,
    borderRadius: 14,
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
  rejectButtonTextTablet: {
    fontSize: 17,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  dialogTablet: {
    padding: 32,
    borderRadius: 18,
    maxWidth: 500,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  dialogTitleTablet: {
    fontSize: 22,
  },
  dialogText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
  },
  dialogTextTablet: {
    fontSize: 16,
  },
  dialogInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
    minHeight: 80,
    marginBottom: 20,
  },
  dialogInputTablet: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 17,
    borderRadius: 14,
    minHeight: 100,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  dialogCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  dialogCancelButtonTablet: {
    paddingVertical: 14,
    borderRadius: 14,
  },
  dialogCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  dialogCancelButtonTextTablet: {
    fontSize: 17,
  },
  dialogConfirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
  },
  dialogConfirmButtonTablet: {
    paddingVertical: 14,
    borderRadius: 14,
  },
  dialogConfirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dialogConfirmButtonTextTablet: {
    fontSize: 17,
  },
  captureButton: {
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 12,
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
    borderRadius: 12,
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
  presentationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  addPresentationButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addPresentationButtonTablet: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addPresentationButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  addPresentationButtonTextTablet: {
    fontSize: 15,
  },
  presentationCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  presentationName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  presentationNameTablet: {
    fontSize: 17,
  },
  removePresentationButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  removePresentationButtonTablet: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  removePresentationButtonText: {
    fontSize: 16,
  },
  removePresentationButtonTextTablet: {
    fontSize: 18,
  },
  presentationRow: {
    marginBottom: 12,
  },
  presentationField: {
    flex: 1,
  },
  presentationFieldFull: {
    width: '100%',
  },
  presentationLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 6,
  },
  presentationLabelTablet: {
    fontSize: 15,
  },
  presentationInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
  },
  presentationInputTablet: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderRadius: 10,
  },
  emptyPresentations: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  emptyPresentationsText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
  },
  dialogSelector: {
    maxHeight: 300,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
  },
  dialogSelectorTablet: {
    maxHeight: 400,
    borderRadius: 14,
  },
  dialogOptionItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dialogOptionItemTablet: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  dialogOptionItemSelected: {
    backgroundColor: '#EEF2FF',
  },
  dialogOptionText: {
    fontSize: 14,
    color: '#1E293B',
  },
  dialogOptionTextTablet: {
    fontSize: 16,
  },
  dialogOptionTextSelected: {
    color: '#6366F1',
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
  quantityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
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
  presentationInputDisabled: {
    backgroundColor: '#F8FAFC',
    opacity: 0.6,
  },
  calculationHint: {
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
  },
});

export default ValidatePurchaseProductScreen;
