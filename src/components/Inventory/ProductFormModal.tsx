import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { productsApi, CreateProductDto, UpdateProductDto, Product } from '@/services/api/products';

// Design System
import {
  colors,
  spacing,
  borderRadius,
  shadows,
} from '@/design-system/tokens';
import {
  Text,
  Title,
  Body,
  Caption,
  Label,
  Button,
  Card,
  IconButton,
  Divider,
} from '@/design-system/components';
import { presentationsApi, Presentation } from '@/services/api/presentations';
import { inventoryApi } from '@/services/api/inventory';
import { warehousesApi, warehouseAreasApi } from '@/services/api/warehouses';
import { Warehouse, WarehouseArea } from '@/types/warehouses';
import { priceProfilesApi } from '@/services/api/price-profiles';
import { PriceProfile } from '@/types/price-profiles';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';

interface ProductFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
  mode: 'create' | 'edit';
}

interface PresentationForm {
  presentationIdOrCode: string;
  isBase: boolean;
  factorToBase: number;
  minOrderQty: number;
  orderStep: number;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  visible,
  onClose,
  onSuccess,
  product,
  mode,
}) => {
  const { currentSite, currentCompany } = useAuthStore();
  const { selectedSite, selectedCompany } = useTenantStore();

  // Get effective site and company (prefer tenant store, fallback to auth store)
  const effectiveSite = selectedSite || currentSite;
  const effectiveCompany = selectedCompany || currentCompany;

  const [loading, setLoading] = useState(false);
  const [loadingPresentations, setLoadingPresentations] = useState(false);
  const [loadingPriceProfiles, setLoadingPriceProfiles] = useState(false);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [availablePresentations, setAvailablePresentations] = useState<Presentation[]>([]);
  const [availablePriceProfiles, setAvailablePriceProfiles] = useState<PriceProfile[]>([]);
  const [availableWarehouses, setAvailableWarehouses] = useState<Warehouse[]>([]);
  const [availableAreas, setAvailableAreas] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    sku: '',
    barcode: '',
    categoryId: '',
    status: 'draft' as 'draft' | 'active' | 'archived',
    taxType: 'GRAVADO' as 'GRAVADO' | 'EXONERADO' | 'INAFECTO' | 'GRATUITO',
    costCents: '', // Changed from priceCents to costCents
    currency: 'PEN',
    minStockAlert: '',
    // Peso del producto
    weightValue: '',
    weightUnit: 'kg' as 'kg' | 'g',
    // Stock inicial
    warehouseId: '',
    areaId: '',
    initialStock: '',
  });

  // Presentaciones del producto
  // IMPORTANTE: Las presentaciones son GLOBALES (catálogo compartido: UN, PK, CJ, BX)
  // pero se CONFIGURAN POR PRODUCTO (cada producto elige cuáles usar y define sus factores)
  const [presentations, setPresentations] = useState<PresentationForm[]>([]);

  // Cargar presentaciones, perfiles de precio y almacenes disponibles
  useEffect(() => {
    if (visible) {
      loadAvailablePresentations();
      loadAvailablePriceProfiles();
      loadAvailableWarehouses();
    }
  }, [visible, effectiveSite?.id, effectiveCompany?.id]);

  const loadAvailablePresentations = async () => {
    try {
      setLoadingPresentations(true);
      const presentations = await presentationsApi.getPresentations({ page: 1, limit: 100 });
      setAvailablePresentations(presentations);
      console.log('📦 Available presentations loaded:', presentations.length);
    } catch (error: any) {
      console.error('❌ Error loading presentations:', error);
      Alert.alert('Error', 'No se pudieron cargar las presentaciones disponibles');
      setAvailablePresentations([]);
    } finally {
      setLoadingPresentations(false);
    }
  };

  const loadAvailablePriceProfiles = async () => {
    try {
      setLoadingPriceProfiles(true);
      const response = await priceProfilesApi.getPriceProfiles({
        isActive: true,
        page: 1,
        limit: 100,
      });
      setAvailablePriceProfiles(response.data || []);
      console.log('💰 Available price profiles loaded:', response.data?.length || 0);
    } catch (error: any) {
      console.error('❌ Error loading price profiles:', error);
      Alert.alert('Error', 'No se pudieron cargar los perfiles de precio disponibles');
      setAvailablePriceProfiles([]);
    } finally {
      setLoadingPriceProfiles(false);
    }
  };

  const loadAvailableWarehouses = async () => {
    try {
      setLoadingWarehouses(true);
      console.log('🔄 Loading warehouses...');
      console.log('📋 Company ID:', effectiveCompany?.id);
      console.log('📋 Site ID:', effectiveSite?.id);
      console.log('📋 Site Name:', effectiveSite?.name);

      // Use warehousesApi with proper parameters
      const warehouses = await warehousesApi.getWarehouses(effectiveCompany?.id, effectiveSite?.id);

      console.log('✅ Warehouses received from API:', warehouses?.length || 0);
      console.log('📦 Raw warehouses data:', JSON.stringify(warehouses, null, 2));

      // Filter active warehouses (if isActive is undefined, include the warehouse)
      const filteredWarehouses = (warehouses || []).filter((w) => w.isActive !== false);

      setAvailableWarehouses(filteredWarehouses);
      console.log('🏢 Available warehouses loaded:', filteredWarehouses.length);
      console.log(
        '🏢 Filtered warehouses:',
        filteredWarehouses.map((w) => ({ id: w.id, name: w.name, isActive: w.isActive }))
      );

      if (effectiveSite?.name) {
        console.log(`📍 Warehouses for site ${effectiveSite.name}:`, filteredWarehouses.length);
      }
    } catch (error: any) {
      console.error('❌ Error loading warehouses:', error);
      console.error('❌ Error details:', error?.message);
      console.error('❌ Error response:', error?.response?.data);
      console.error('❌ Error status:', error?.response?.status);
      Alert.alert('Error', 'No se pudieron cargar los almacenes');
      setAvailableWarehouses([]);
    } finally {
      setLoadingWarehouses(false);
      console.log('✅ Finished loading warehouses');
    }
  };

  const loadAreasForWarehouse = async (warehouseId: string) => {
    if (!warehouseId) {
      console.log('⚠️ No warehouse ID provided, clearing areas');
      setAvailableAreas([]);
      return;
    }

    try {
      setLoadingAreas(true);
      console.log('🔄 Loading areas for warehouse:', warehouseId);

      // Find the warehouse in the availableWarehouses array
      const selectedWarehouse = availableWarehouses.find((w) => w.id === warehouseId);

      if (selectedWarehouse) {
        console.log('✅ Warehouse found in cache:', selectedWarehouse.name);
        console.log('📦 Warehouse has areas:', selectedWarehouse.areas?.length || 0);

        const areas = selectedWarehouse.areas || [];
        setAvailableAreas(areas);
        console.log('📍 Available areas loaded from warehouse:', areas.length);

        if (areas.length > 0) {
          console.log(
            '📍 Areas list:',
            areas.map((a) => ({
              id: a.id,
              name: a.name,
              code: a.code,
              displayName: a.name || a.code,
            }))
          );
        } else {
          console.log('⚠️ No areas found for this warehouse');
        }
      } else {
        console.log('⚠️ Warehouse not found in cache, fetching from API...');

        // Fallback: fetch from API if warehouse not in cache
        const areas = await warehouseAreasApi.getWarehouseAreas(warehouseId);

        console.log('✅ Areas received from API:', areas?.length || 0);
        console.log('📦 Raw areas data:', JSON.stringify(areas, null, 2));

        setAvailableAreas(areas || []);
        console.log('📍 Available areas loaded from API:', areas?.length || 0);

        if (areas && areas.length > 0) {
          console.log(
            '📍 Areas list:',
            areas.map((a) => ({
              id: a.id,
              name: a.name,
              code: a.code,
              displayName: a.name || a.code,
            }))
          );
        }
      }
    } catch (error: any) {
      console.error('❌ Error loading areas:', error);
      console.error('❌ Error details:', error?.message);
      console.error('❌ Error response:', error?.response?.data);
      console.error('❌ Error status:', error?.response?.status);
      setAvailableAreas([]);
    } finally {
      setLoadingAreas(false);
      console.log('✅ Finished loading areas');
    }
  };

  // Cargar áreas cuando cambia el almacén seleccionado
  useEffect(() => {
    if (formData.warehouseId) {
      loadAreasForWarehouse(formData.warehouseId);
    } else {
      setAvailableAreas([]);
      setFormData((prev) => ({ ...prev, areaId: '' }));
    }
  }, [formData.warehouseId]);

  useEffect(() => {
    if (product && mode === 'edit') {
      console.log('📦 Loading product for edit:', {
        id: product.id,
        title: product.title,
        presentations: product.presentations
      });

      const productStatus: 'draft' | 'active' | 'archived' =
        product.status === 'inactive' || product.status === 'discontinued'
          ? 'archived'
          : product.status === 'draft' ||
              product.status === 'active' ||
              product.status === 'archived'
            ? product.status
            : 'draft';
      setFormData({
        title: product.title || '',
        description: product.description || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        categoryId: product.categoryId || '',
        status: productStatus,
        taxType: product.taxType || 'GRAVADO',
        costCents: (product.costCents || product.priceCents)?.toString() || '', // Support both costCents and legacy priceCents
        currency: product.currency || 'PEN',
        minStockAlert: product.minStockAlert?.toString() || '',
        // Cargar peso: si es menor a 1 kg, mostrar en gramos para mejor UX
        weightValue: product.weightKg !== undefined && product.weightKg !== null
          ? (product.weightKg < 1 ? (product.weightKg * 1000).toString() : product.weightKg.toString())
          : '',
        weightUnit: product.weightKg !== undefined && product.weightKg !== null && product.weightKg < 1 ? 'g' : 'kg',
        warehouseId: '',
        areaId: '',
        initialStock: '',
      });

      if (product.presentations && product.presentations.length > 0) {
        console.log('📦 Loading presentations from product:', product.presentations);
        const loadedPresentations = product.presentations.map((p) => {
          // Usar presentationId (ID de BD) en lugar de code para edición
          const presentationIdOrCode = p.presentationId || p.presentation?.id || p.presentation?.code || '';
          console.log('📦 Presentation mapping:', {
            presentationId: p.presentationId,
            presentationCode: p.presentation?.code,
            presentationObjectId: p.presentation?.id,
            finalValue: presentationIdOrCode
          });
          return {
            presentationIdOrCode,
            isBase: p.isBase,
            factorToBase: p.factorToBase,
            minOrderQty: p.minOrderQty,
            orderStep: p.orderStep,
          };
        });
        console.log('📦 Final loaded presentations:', loadedPresentations);
        setPresentations(loadedPresentations);
      }
    } else {
      resetForm();
    }
  }, [product, mode, visible]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      sku: '',
      barcode: '',
      categoryId: '',
      status: 'draft',
      taxType: 'GRAVADO',
      costCents: '',
      currency: 'PEN',
      minStockAlert: '',
      weightValue: '',
      weightUnit: 'kg',
      warehouseId: '',
      areaId: '',
      initialStock: '',
    });
    setPresentations([]);
  };

  // Convertir peso a kilogramos (siempre se envía en kg al backend)
  const getWeightInKg = (): number | undefined => {
    if (!formData.weightValue) return undefined;
    const value = parseFloat(formData.weightValue);
    if (isNaN(value) || value < 0) return undefined;
    if (formData.weightUnit === 'g') {
      return Math.round((value / 1000) * 1000) / 1000; // Convertir gramos a kg con 3 decimales
    }
    return Math.round(value * 1000) / 1000; // Redondear a 3 decimales
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'El título es obligatorio');
      return false;
    }

    if (!formData.sku.trim()) {
      Alert.alert('Error', 'El SKU es obligatorio');
      return false;
    }

    if (!formData.costCents || parseFloat(formData.costCents) <= 0) {
      Alert.alert('Error', 'El costo debe ser mayor a 0');
      return false;
    }

    // Validación de peso (obligatorio)
    const weightKg = getWeightInKg();
    if (weightKg === undefined || weightKg <= 0) {
      Alert.alert('Error', 'El peso es obligatorio y debe ser mayor a 0');
      return false;
    }

    // Validaciones de presentaciones (aplican tanto en creación como en edición)
    if (presentations.length > 0) {
      // Validación: Todas las presentaciones deben tener código y factor válido
      for (const p of presentations) {
        if (!p.presentationIdOrCode.trim()) {
          Alert.alert(
            'Error',
            'Todas las presentaciones deben seleccionar una presentación del catálogo'
          );
          return false;
        }
        if (p.factorToBase <= 0) {
          Alert.alert('Error', 'El factor de conversión debe ser mayor a 0');
          return false;
        }
      }

      // Validación: No puede haber presentaciones duplicadas
      const codes = presentations.map((p) => p.presentationIdOrCode);
      const uniqueCodes = new Set(codes);
      if (codes.length !== uniqueCodes.size) {
        Alert.alert('Error', 'No puede haber presentaciones duplicadas');
        return false;
      }
    }

    // Validaciones de stock inicial SOLO en modo creación
    if (mode === 'create') {
      // Validación: Almacén es obligatorio
      if (!formData.warehouseId) {
        Alert.alert('Error', 'Debe seleccionar un almacén');
        return false;
      }

      // Validación: Área es obligatoria
      if (!formData.areaId) {
        Alert.alert('Error', 'Debe seleccionar un área del almacén');
        return false;
      }

      // Validación: Stock inicial es obligatorio
      if (!formData.initialStock || parseFloat(formData.initialStock) <= 0) {
        Alert.alert('Error', 'El stock inicial es obligatorio y debe ser mayor a 0');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      if (mode === 'create') {
        // Generar precios de venta automáticamente si no se especificaron
        const salePrices = generateSalePrices();

        const createData: CreateProductDto = {
          title: formData.title,
          description: formData.description || undefined,
          sku: formData.sku,
          barcode: formData.barcode || undefined,
          categoryId: formData.categoryId || undefined,
          status: formData.status,
          taxType: formData.taxType,
          costCents: parseFloat(formData.costCents),
          currency: formData.currency,
          minStockAlert: formData.minStockAlert ? parseFloat(formData.minStockAlert) : undefined,
          weightKg: getWeightInKg(),
          presentations: presentations,
          salePrices: salePrices.length > 0 ? salePrices : undefined,
        };

        console.log('📦 Creating product with data:', JSON.stringify(createData, null, 2));

        const createdProduct = await productsApi.createProduct(createData);

        console.log('✅ Product created successfully:', createdProduct.id);

        // Si se especificó stock inicial, crearlo automáticamente
        if (
          formData.warehouseId &&
          formData.initialStock &&
          parseFloat(formData.initialStock) > 0
        ) {
          try {
            await inventoryApi.adjustStock({
              productId: createdProduct.id,
              warehouseId: formData.warehouseId,
              areaId: formData.areaId || undefined,
              deltaBase: parseFloat(formData.initialStock),
              reason: 'ADJUST',
              clientOperationId: `initial-stock-${createdProduct.id}-${Date.now()}`,
            });

            const warehouseName =
              availableWarehouses.find((w) => w.id === formData.warehouseId)?.name || 'almacén';
            const selectedArea = formData.areaId
              ? availableAreas.find((a) => a.id === formData.areaId)
              : null;
            const areaName = selectedArea ? selectedArea.name || selectedArea.code : null;
            const locationText = areaName ? `${warehouseName} - ${areaName}` : warehouseName;

            Alert.alert(
              'Producto Creado',
              `Producto creado correctamente con stock inicial de ${formData.initialStock} unidades en ${locationText}.\n\nLos precios de venta se generaron automáticamente.`
            );
          } catch (stockError: any) {
            console.error('❌ Error creating initial stock:', stockError);
            Alert.alert(
              'Producto Creado',
              `Producto creado correctamente, pero hubo un error al crear el stock inicial: ${stockError.message}\n\nPuedes crear el stock manualmente desde el módulo de Stock.`
            );
          }
        } else {
          Alert.alert(
            'Producto Creado',
            'Producto creado correctamente. Los precios de venta se generaron automáticamente.'
          );
        }

        onSuccess();
        onClose();
      } else {
        console.log('📦 Presentations before sending to backend:', presentations);

        const updateData: UpdateProductDto = {
          title: formData.title,
          description: formData.description || undefined,
          sku: formData.sku,
          barcode: formData.barcode || undefined,
          categoryId: formData.categoryId || undefined,
          status: formData.status,
          taxType: formData.taxType,
          costCents: parseFloat(formData.costCents),
          currency: formData.currency,
          minStockAlert: formData.minStockAlert ? parseFloat(formData.minStockAlert) : undefined,
          weightKg: getWeightInKg(),
          presentations: presentations, // Incluir presentaciones actualizadas
        };

        console.log('📦 Update data being sent:', JSON.stringify(updateData, null, 2));
        await productsApi.updateProduct(product!.id, updateData);

        Alert.alert(
          'Éxito',
          'Producto actualizado correctamente. Las presentaciones y precios de venta se recalcularon automáticamente.'
        );
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      console.error('Error saving product:', error);
      Alert.alert('Error', error.message || 'No se pudo guardar el producto');
    } finally {
      setLoading(false);
    }
  };

  // Generar precios de venta automáticamente basados en perfiles de precio activos
  const generateSalePrices = () => {
    if (availablePriceProfiles.length === 0 || presentations.length === 0) {
      return [];
    }

    const salePrices: {
      presentationIdOrCode: string;
      profileIdOrCode: string;
      priceCents: number;
    }[] = [];
    const costCents = parseFloat(formData.costCents);

    if (isNaN(costCents) || costCents <= 0) {
      return [];
    }

    // Para cada presentación, generar precios para todos los perfiles activos
    presentations.forEach((presentation) => {
      availablePriceProfiles.forEach((profile) => {
        // Calcular precio: costCents * factorToBase * factorToCost
        const factorToCost =
          typeof profile.factorToCost === 'string'
            ? parseFloat(profile.factorToCost)
            : profile.factorToCost;

        const priceCents = Math.round(costCents * presentation.factorToBase * factorToCost);

        salePrices.push({
          presentationIdOrCode: presentation.presentationIdOrCode,
          profileIdOrCode: profile.code,
          priceCents: priceCents,
        });
      });
    });

    console.log('💰 Generated sale prices:', salePrices.length, 'prices');
    return salePrices;
  };

  const handleCreateInitialStock = async (createdProduct: Product) => {
    try {
      // Load available warehouses
      const warehouses = await inventoryApi.getWarehouses();

      if (!warehouses || warehouses.length === 0) {
        Alert.alert(
          'Sin Almacenes',
          'No hay almacenes disponibles. Debes crear un almacén primero para poder gestionar stock.',
          [
            {
              text: 'Entendido',
              onPress: () => {
                onSuccess();
                onClose();
              },
            },
          ]
        );
        return;
      }

      // Show warehouse selection dialog
      const warehouseOptions = warehouses.map((w) => ({
        text: `${w.name} (${w.code})`,
        onPress: () => promptForInitialQuantity(createdProduct, w),
      }));

      Alert.alert('Seleccionar Almacén', 'Elige el almacén donde deseas crear el stock inicial:', [
        ...warehouseOptions,
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => {
            onSuccess();
            onClose();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error loading warehouses:', error);
      Alert.alert(
        'Error',
        'No se pudieron cargar los almacenes. Puedes crear el stock manualmente desde la pantalla de inventario.',
        [
          {
            text: 'Entendido',
            onPress: () => {
              onSuccess();
              onClose();
            },
          },
        ]
      );
    }
  };

  const promptForInitialQuantity = (createdProduct: Product, warehouse: any) => {
    Alert.prompt(
      'Cantidad Inicial',
      `¿Cuántas unidades de "${createdProduct.title}" deseas agregar al almacén "${warehouse.name}"?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => {
            onSuccess();
            onClose();
          },
        },
        {
          text: 'Crear',
          onPress: async (quantity: string | undefined) => {
            if (!quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
              Alert.alert('Error', 'Debes ingresar una cantidad válida mayor a 0');
              return;
            }

            try {
              setLoading(true);
              await inventoryApi.adjustStock({
                productId: createdProduct.id,
                warehouseId: warehouse.id,
                areaId: undefined,
                deltaBase: parseFloat(quantity),
                reason: 'ADJUST',
                clientOperationId: `initial-stock-${createdProduct.id}-${Date.now()}`,
              });

              Alert.alert(
                'Stock Creado',
                `Se creó el stock inicial de ${quantity} unidades en el almacén "${warehouse.name}".`
              );
              onSuccess();
              onClose();
            } catch (error: any) {
              console.error('Error creating initial stock:', error);
              Alert.alert(
                'Error',
                error.message ||
                  'No se pudo crear el stock inicial. Puedes crearlo manualmente desde la pantalla de inventario.'
              );
              onSuccess();
              onClose();
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      'plain-text',
      '',
      'numeric'
    );
  };

  const addPresentation = () => {
    setPresentations([
      ...presentations,
      {
        presentationIdOrCode: '',
        isBase: false,
        factorToBase: 1,
        minOrderQty: 1,
        orderStep: 1,
      },
    ]);
  };

  const removePresentation = (index: number) => {
    setPresentations(presentations.filter((_, i) => i !== index));
  };

  const updatePresentation = (index: number, field: keyof PresentationForm, value: any) => {
    const updated = [...presentations];
    updated[index] = { ...updated[index], [field]: value };
    setPresentations(updated);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="close"
            onPress={onClose}
            variant="ghost"
            size="medium"
          />
          <Title size="medium">
            {mode === 'create' ? 'Nuevo Producto' : 'Editar Producto'}
          </Title>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.content}>
          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información Básica</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                Título <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                placeholder="Nombre del producto"
                placeholderTextColor="#94A3B8"
                keyboardType="default"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Descripción del producto"
                placeholderTextColor="#94A3B8"
                keyboardType="default"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Mostrar correlativo en modo edición */}
            {mode === 'edit' && product?.correlativeNumber && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>#Correlativo (Auto-generado)</Text>
                <View style={styles.correlativeDisplay}>
                  <Text style={styles.correlativeText}>#{product.correlativeNumber}</Text>
                  <Text style={styles.correlativeHint}>Número único e inmutable del producto</Text>
                </View>
              </View>
            )}

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.label}>
                  SKU <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.sku}
                  onChangeText={(text) => setFormData({ ...formData, sku: text })}
                  placeholder="SKU-001"
                  placeholderTextColor="#94A3B8"
                  keyboardType="default"
                  editable={mode === 'create'}
                />
                {mode === 'create' && (
                  <Text style={styles.hint}>ℹ️ Los SKUs duplicados están permitidos</Text>
                )}
              </View>

              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.label}>Código de Barras</Text>
                <TextInput
                  style={styles.input}
                  value={formData.barcode}
                  onChangeText={(text) => setFormData({ ...formData, barcode: text })}
                  placeholder="ABC123XYZ"
                  placeholderTextColor="#94A3B8"
                  keyboardType="default"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.label}>Estado</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => {
                      Alert.alert('Seleccionar Estado', '', [
                        {
                          text: 'Borrador',
                          onPress: () => setFormData({ ...formData, status: 'draft' }),
                        },
                        {
                          text: 'Activo',
                          onPress: () => setFormData({ ...formData, status: 'active' }),
                        },
                        {
                          text: 'Archivado',
                          onPress: () => setFormData({ ...formData, status: 'archived' }),
                        },
                        { text: 'Cancelar', style: 'cancel' },
                      ]);
                    }}
                  >
                    <Text style={styles.pickerText}>
                      {formData.status === 'draft'
                        ? 'Borrador'
                        : formData.status === 'active'
                          ? 'Activo'
                          : 'Archivado'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.label}>Tipo de Impuesto</Text>
                <View style={styles.pickerContainer}>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => {
                      Alert.alert('Seleccionar Tipo de Impuesto', '', [
                        {
                          text: 'GRAVADO',
                          onPress: () => setFormData({ ...formData, taxType: 'GRAVADO' }),
                        },
                        {
                          text: 'EXONERADO',
                          onPress: () => setFormData({ ...formData, taxType: 'EXONERADO' }),
                        },
                        {
                          text: 'INAFECTO',
                          onPress: () => setFormData({ ...formData, taxType: 'INAFECTO' }),
                        },
                        {
                          text: 'GRATUITO',
                          onPress: () => setFormData({ ...formData, taxType: 'GRATUITO' }),
                        },
                        { text: 'Cancelar', style: 'cancel' },
                      ]);
                    }}
                  >
                    <Text style={styles.pickerText}>{formData.taxType}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.label}>
                  Costo (centavos) <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.costCents}
                  onChangeText={(text) => setFormData({ ...formData, costCents: text })}
                  placeholder="1000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
                <Text style={styles.helpText}>
                  {formData.costCents
                    ? `S/ ${(parseFloat(formData.costCents) / 100).toFixed(2)}`
                    : 'Costo en centavos (ej: 1000 = S/ 10.00)'}
                </Text>
                <Text style={styles.infoText}>
                  💡 Los precios de venta se calcularán automáticamente según los perfiles de precio
                  configurados
                </Text>
              </View>

              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.label}>Alerta de Stock Mínimo</Text>
                <TextInput
                  style={styles.input}
                  value={formData.minStockAlert}
                  onChangeText={(text) => setFormData({ ...formData, minStockAlert: text })}
                  placeholder="20"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Peso del producto */}
            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.label}>
                  Peso <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.weightValue}
                  onChangeText={(text) => setFormData({ ...formData, weightValue: text })}
                  placeholder={formData.weightUnit === 'kg' ? '0.500' : '500'}
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.helpText}>
                  {formData.weightValue && !isNaN(parseFloat(formData.weightValue))
                    ? formData.weightUnit === 'g'
                      ? `= ${(parseFloat(formData.weightValue) / 1000).toFixed(3)} kg`
                      : `${parseFloat(formData.weightValue).toFixed(3)} kg`
                    : 'Peso para guías de remisión'}
                </Text>
              </View>

              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.label}>Unidad</Text>
                <View style={styles.weightUnitContainer}>
                  <TouchableOpacity
                    style={[
                      styles.weightUnitButton,
                      formData.weightUnit === 'kg' && styles.weightUnitButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, weightUnit: 'kg' })}
                  >
                    <Text
                      style={[
                        styles.weightUnitButtonText,
                        formData.weightUnit === 'kg' && styles.weightUnitButtonTextActive,
                      ]}
                    >
                      Kilos (kg)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.weightUnitButton,
                      formData.weightUnit === 'g' && styles.weightUnitButtonActive,
                    ]}
                    onPress={() => setFormData({ ...formData, weightUnit: 'g' })}
                  >
                    <Text
                      style={[
                        styles.weightUnitButtonText,
                        formData.weightUnit === 'g' && styles.weightUnitButtonTextActive,
                      ]}
                    >
                      Gramos (g)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* Info about images */}
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>📸 Gestión de Imágenes</Text>
            <Text style={styles.infoText}>
              Las imágenes del producto se gestionan por separado. Después de crear o editar el
              producto, puedes usar el botón "📸 Fotos" en la lista de productos para agregar, ver o
              eliminar imágenes.
            </Text>
          </View>

          {/* Stock Inicial (solo en modo crear) */}
          {mode === 'create' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Stock Inicial <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.infoText}>
                📊 Debes crear stock inicial para este producto al momento de crearlo.
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Almacén <Text style={styles.required}>*</Text>
                </Text>
                {loadingWarehouses ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#3B82F6" />
                    <Text style={styles.loadingText}>Cargando almacenes...</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.pickerContainer}>
                      <TouchableOpacity
                        style={styles.picker}
                        onPress={() => {
                          if (availableWarehouses.length === 0) {
                            Alert.alert(
                              'Sin almacenes',
                              'No hay almacenes disponibles. Por favor, crea uno primero.'
                            );
                            return;
                          }

                          const options = availableWarehouses.map((w) => ({
                            text: `${w.name} (${w.code})`,
                            onPress: () => setFormData({ ...formData, warehouseId: w.id }),
                          }));

                          Alert.alert('Seleccionar Almacén', '', [
                            ...options,
                            {
                              text: 'Ninguno',
                              onPress: () =>
                                setFormData({ ...formData, warehouseId: '', areaId: '' }),
                            },
                            { text: 'Cancelar', style: 'cancel' },
                          ]);
                        }}
                      >
                        <Text style={styles.pickerText}>
                          {formData.warehouseId
                            ? (() => {
                                const selected = availableWarehouses.find(
                                  (w) => w.id === formData.warehouseId
                                );
                                return selected
                                  ? `${selected.name} (${selected.code})`
                                  : 'Seleccionar almacén...';
                              })()
                            : 'Seleccionar almacén...'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.helpText}>
                      {availableWarehouses.length > 0
                        ? `${availableWarehouses.length} almacén(es) disponible(s)`
                        : 'No hay almacenes disponibles'}
                    </Text>
                  </>
                )}
              </View>

              {formData.warehouseId && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Área <Text style={styles.required}>*</Text>
                  </Text>
                  {loadingAreas ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#3B82F6" />
                      <Text style={styles.loadingText}>Cargando áreas...</Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.pickerContainer}>
                        <TouchableOpacity
                          style={styles.picker}
                          onPress={() => {
                            if (availableAreas.length === 0) {
                              Alert.alert('Sin áreas', 'Este almacén no tiene áreas configuradas.');
                              return;
                            }

                            const options = availableAreas.map((a) => ({
                              text: a.name || a.code || `Área ${a.id.substring(0, 8)}`,
                              onPress: () => setFormData({ ...formData, areaId: a.id }),
                            }));

                            Alert.alert('Seleccionar Área', '', [
                              ...options,
                              {
                                text: 'Ninguna',
                                onPress: () => setFormData({ ...formData, areaId: '' }),
                              },
                              { text: 'Cancelar', style: 'cancel' },
                            ]);
                          }}
                        >
                          <Text style={styles.pickerText}>
                            {formData.areaId
                              ? (() => {
                                  const selected = availableAreas.find(
                                    (a) => a.id === formData.areaId
                                  );
                                  return selected
                                    ? selected.name ||
                                        selected.code ||
                                        `Área ${selected.id.substring(0, 8)}`
                                    : 'Seleccionar área...';
                                })()
                              : 'Seleccionar área...'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.helpText}>
                        {availableAreas.length > 0
                          ? `${availableAreas.length} área(s) disponible(s)`
                          : 'Este almacén no tiene áreas'}
                      </Text>
                    </>
                  )}
                </View>
              )}

              {formData.warehouseId && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>
                    Cantidad Inicial (en unidades base) <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={formData.initialStock}
                    onChangeText={(text) => setFormData({ ...formData, initialStock: text })}
                    placeholder="100"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                  <Text style={styles.helpText}>
                    Cantidad en unidades base que se agregará al almacén seleccionado
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Presentations */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Title size="small">Presentaciones</Title>
              <Button
                title="+ Agregar"
                variant="primary"
                size="small"
                onPress={addPresentation}
              />
            </View>

            <Text style={styles.infoText}>
              📦 Las presentaciones son del catálogo global, pero cada producto define sus propios
              factores de conversión.
              {'\n'}
              {'\n'}💡 Ejemplo: Leche Gloria 1L
              {'\n'}• 1 Unidad (UN) = 1 unidad (factor: 1)
              {'\n'}• 1 Paquete (PK) = 6 unidades (factor: 6)
              {'\n'}• 1 Caja (CJ) = 24 unidades (factor: 24)
              {'\n'}
              {'\n'}⚠️ El stock base es independiente de las presentaciones. Los precios de venta se calculan
              automáticamente según los perfiles de precio configurados.
            </Text>

            {mode === 'edit' && (
              <View style={styles.warningBox}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>
                  Puedes agregar, editar o eliminar presentaciones. Los cambios afectarán los precios de venta asociados.
                </Text>
              </View>
            )}

              {presentations.map((presentation, index) => (
                <View key={index} style={styles.presentationCard}>
                  <View style={styles.presentationHeader}>
                    <Text style={styles.presentationTitle}>Presentación {index + 1}</Text>
                    <TouchableOpacity onPress={() => removePresentation(index)}>
                      <Text style={styles.removeButton}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Presentación</Text>
                    {loadingPresentations ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#3B82F6" />
                        <Text style={styles.loadingText}>Cargando presentaciones...</Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.pickerContainer}>
                          <TouchableOpacity
                            style={styles.picker}
                            onPress={() => {
                              if (availablePresentations.length === 0) {
                                Alert.alert(
                                  'Sin presentaciones',
                                  'No hay presentaciones disponibles. Por favor, crea una primero.'
                                );
                                return;
                              }

                              const options = availablePresentations.map((p) => ({
                                text: `${p.code} - ${p.name}`,
                                onPress: () =>
                                  updatePresentation(index, 'presentationIdOrCode', p.id),
                              }));

                              Alert.alert('Seleccionar Presentación', '', [
                                ...options,
                                { text: 'Cancelar', style: 'cancel' },
                              ]);
                            }}
                          >
                            <Text style={styles.pickerText}>
                              {presentation.presentationIdOrCode
                                ? (() => {
                                    // Buscar por ID o por código
                                    const selected = availablePresentations.find(
                                      (p) => p.id === presentation.presentationIdOrCode || p.code === presentation.presentationIdOrCode
                                    );
                                    return selected
                                      ? `${selected.code} - ${selected.name}`
                                      : presentation.presentationIdOrCode;
                                  })()
                                : 'Seleccionar presentación...'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.helpText}>
                          {availablePresentations.length > 0
                            ? `${availablePresentations.length} presentaciones disponibles en el catálogo`
                            : 'No hay presentaciones disponibles. Crea una en el módulo de Presentaciones.'}
                        </Text>
                      </>
                    )}
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>
                      Factor de Conversión <Text style={styles.required}>*</Text>
                    </Text>
                    <TextInput
                      style={styles.input}
                      value={presentation.factorToBase.toString()}
                      onChangeText={(text) => {
                        const value = text.trim() === '' ? '' : parseFloat(text);
                        if (
                          text.trim() === '' ||
                          (!isNaN(value as number) && (value as number) > 0)
                        ) {
                          updatePresentation(
                            index,
                            'factorToBase',
                            value === '' ? 1 : (value as number)
                          );
                        }
                      }}
                      placeholder="Ej: 1, 6, 12, 24"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                    />
                    <Text style={styles.helpText}>
                      {presentation.presentationIdOrCode
                        ? `Cuántas unidades base contiene 1 ${presentation.presentationIdOrCode}`
                        : 'Cuántas unidades base contiene esta presentación'}
                    </Text>
                    {presentation.factorToBase > 0 && formData.costCents && (
                      <Text style={styles.calculationText}>
                        💰 Costo por {presentation.presentationIdOrCode || 'presentación'}: S/{' '}
                        {((parseFloat(formData.costCents) * presentation.factorToBase) / 100).toFixed(2)}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
          </View>

          {/* Preview de Precios de Venta (solo en modo crear) */}
          {mode === 'create' &&
            formData.costCents &&
            parseFloat(formData.costCents) > 0 &&
            availablePriceProfiles.length > 0 &&
            presentations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Vista Previa de Precios de Venta</Text>
                <Text style={styles.infoText}>
                  💰 Los siguientes precios se generarán automáticamente al crear el producto:
                </Text>

                {presentations.map((presentation, presIndex) => {
                  const presentationData = availablePresentations.find(
                    (p) => p.code === presentation.presentationIdOrCode
                  );
                  const presentationName = presentationData
                    ? `${presentationData.code} - ${presentationData.name}`
                    : presentation.presentationIdOrCode;

                  return (
                    <View key={presIndex} style={styles.pricePreviewCard}>
                      <Text style={styles.pricePreviewTitle}>
                        📦 {presentationName} (Factor: {presentation.factorToBase})
                      </Text>

                      {availablePriceProfiles.map((profile, profIndex) => {
                        const factorToCost =
                          typeof profile.factorToCost === 'string'
                            ? parseFloat(profile.factorToCost)
                            : profile.factorToCost;
                        const costCents = parseFloat(formData.costCents);
                        const priceCents = Math.round(
                          costCents * presentation.factorToBase * factorToCost
                        );
                        const priceInSoles = (priceCents / 100).toFixed(2);

                        return (
                          <View key={profIndex} style={styles.pricePreviewItem}>
                            <Text style={styles.pricePreviewLabel}>
                              {profile.name} (x{factorToCost}):
                            </Text>
                            <Text style={styles.pricePreviewValue}>S/ {priceInSoles}</Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}

                <Text style={styles.helpText}>
                  ℹ️ Estos precios se pueden modificar posteriormente desde la gestión de precios de
                  venta
                </Text>
              </View>
            )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="Cancelar"
            variant="outline"
            onPress={onClose}
            disabled={loading}
            style={{ flex: 1 }}
          />
          <Button
            title={loading ? 'Guardando...' : mode === 'create' ? 'Crear Producto' : 'Actualizar'}
            variant="primary"
            onPress={handleSubmit}
            disabled={loading}
            loading={loading}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  content: {
    flex: 1,
    padding: spacing[4],
  },
  section: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing[4],
  },
  infoSection: {
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.warning[300],
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.warning[800],
    marginBottom: spacing[2],
  },
  infoText: {
    fontSize: 13,
    color: colors.warning[700],
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: spacing[4],
  },
  formGroupHalf: {
    flex: 1,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: spacing[2],
  },
  required: {
    color: colors.danger[500],
  },
  input: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    fontSize: 15,
    color: colors.text.primary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: colors.surface.secondary,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
  },
  picker: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
  },
  pickerText: {
    fontSize: 15,
    color: colors.text.primary,
  },
  helpText: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: spacing[1],
  },
  hint: {
    fontSize: 11,
    color: colors.accent[600],
    marginTop: spacing[1],
    fontStyle: 'italic',
  },
  correlativeDisplay: {
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[200],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
  },
  correlativeText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent[600],
    fontFamily: 'monospace',
    marginBottom: spacing[1],
  },
  correlativeHint: {
    fontSize: 11,
    color: colors.accent[600],
    fontStyle: 'italic',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  presentationCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  presentationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  presentationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  removeButton: {
    fontSize: 18,
    color: colors.danger[500],
    paddingHorizontal: spacing[2],
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    backgroundColor: colors.surface.tertiary,
    borderRadius: borderRadius.md,
    gap: spacing[2],
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  inputDisabled: {
    backgroundColor: colors.surface.tertiary,
    color: colors.text.disabled,
  },
  calculationText: {
    fontSize: 12,
    color: colors.success[600],
    fontWeight: '600',
    marginTop: spacing[1],
  },
  footer: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[4],
    backgroundColor: colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  pricePreviewCard: {
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  pricePreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing[2],
  },
  pricePreviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1.5],
    paddingHorizontal: spacing[2],
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.sm,
    marginBottom: spacing[1],
  },
  pricePreviewLabel: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  pricePreviewValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.success[600],
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginTop: spacing[3],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.warning[300],
    alignItems: 'center',
  },
  warningIcon: {
    fontSize: 18,
    marginRight: spacing[2],
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: colors.warning[700],
    lineHeight: 18,
  },
  weightUnitContainer: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  weightUnitButton: {
    flex: 1,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightUnitButtonActive: {
    backgroundColor: colors.accent[500],
    borderColor: colors.accent[500],
  },
  weightUnitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  weightUnitButtonTextActive: {
    color: colors.text.inverse,
  },
});

export default ProductFormModal;
