import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { productsApi, CreateProductDto, UpdateProductDto, Product } from '@/services/api/products';
import { presentationsApi, Presentation } from '@/services/api/presentations';
import { inventoryApi } from '@/services/api/inventory';
import { warehousesApi, warehouseAreasApi } from '@/services/api/warehouses';
import { Warehouse, WarehouseArea } from '@/types/warehouses';
import { priceProfilesApi } from '@/services/api/price-profiles';
import { PriceProfile } from '@/types/price-profiles';
import { filesApi } from '@/services/api/files';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { fileToBase64, validateImageFile, validateFileSize, formatFileSize, getFileSizeInMB } from '@/utils/fileHelpers';

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
    // Stock inicial
    warehouseId: '',
    areaId: '',
    initialStock: '',
  });

  // Product images state
  const [productImages, setProductImages] = useState<Array<{ uri: string; base64?: string; filename: string }>>([]);

  // Presentaciones del producto
  // IMPORTANTE: Las presentaciones son GLOBALES (catálogo compartido: UN, PK, CJ, BX)
  // pero se CONFIGURAN POR PRODUCTO (cada producto elige cuáles usar y define sus factores)
  const [presentations, setPresentations] = useState<PresentationForm[]>([
    {
      presentationIdOrCode: 'UN', // Unidad por defecto
      isBase: true, // Exactamente UNA debe ser base
      factorToBase: 1, // La base siempre tiene factor 1
      minOrderQty: 1,
      orderStep: 1,
    },
  ]);

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
      const response = await priceProfilesApi.getPriceProfiles({ isActive: true, page: 1, limit: 100 });
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
      const warehouses = await warehousesApi.getWarehouses(
        effectiveCompany?.id,
        effectiveSite?.id
      );

      console.log('✅ Warehouses received from API:', warehouses?.length || 0);
      console.log('📦 Raw warehouses data:', JSON.stringify(warehouses, null, 2));

      // Filter active warehouses (if isActive is undefined, include the warehouse)
      const filteredWarehouses = (warehouses || []).filter((w) => w.isActive !== false);

      setAvailableWarehouses(filteredWarehouses);
      console.log('🏢 Available warehouses loaded:', filteredWarehouses.length);
      console.log('🏢 Filtered warehouses:', filteredWarehouses.map(w => ({ id: w.id, name: w.name, isActive: w.isActive })));

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
      const selectedWarehouse = availableWarehouses.find(w => w.id === warehouseId);

      if (selectedWarehouse) {
        console.log('✅ Warehouse found in cache:', selectedWarehouse.name);
        console.log('📦 Warehouse has areas:', selectedWarehouse.areas?.length || 0);

        const areas = selectedWarehouse.areas || [];
        setAvailableAreas(areas);
        console.log('📍 Available areas loaded from warehouse:', areas.length);

        if (areas.length > 0) {
          console.log('📍 Areas list:', areas.map(a => ({ id: a.id, name: a.name, code: a.code, displayName: a.name || a.code })));
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
          console.log('📍 Areas list:', areas.map(a => ({ id: a.id, name: a.name, code: a.code, displayName: a.name || a.code })));
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
      setFormData(prev => ({ ...prev, areaId: '' }));
    }
  }, [formData.warehouseId]);

  useEffect(() => {
    if (product && mode === 'edit') {
      const productStatus: 'draft' | 'active' | 'archived' =
        product.status === 'inactive' || product.status === 'discontinued'
          ? 'archived'
          : (product.status === 'draft' || product.status === 'active' || product.status === 'archived')
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
        warehouseId: '',
        areaId: '',
        initialStock: '',
      });

      if (product.presentations && product.presentations.length > 0) {
        setPresentations(
          product.presentations.map((p) => ({
            presentationIdOrCode: p.presentation?.code || p.presentationId,
            isBase: p.isBase,
            factorToBase: p.factorToBase,
            minOrderQty: p.minOrderQty,
            orderStep: p.orderStep,
          }))
        );
      }

      // Load existing images
      const existingImages: Array<{ uri: string; base64?: string; filename: string }> = [];
      if (product.imageUrl) {
        existingImages.push({
          uri: product.imageUrl,
          filename: product.imageUrl.split('/').pop() || 'image.jpg',
        });
      }
      if (product.imageUrls && product.imageUrls.length > 0) {
        product.imageUrls.forEach((url) => {
          // Avoid duplicates if imageUrl is also in imageUrls
          if (url !== product.imageUrl) {
            existingImages.push({
              uri: url,
              filename: url.split('/').pop() || 'image.jpg',
            });
          }
        });
      }
      setProductImages(existingImages);
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
      warehouseId: '',
      areaId: '',
      initialStock: '',
    });
    setPresentations([
      {
        presentationIdOrCode: 'UN',
        isBase: true,
        factorToBase: 1,
        minOrderQty: 1,
        orderStep: 1,
      },
    ]);
    setProductImages([]);
  };

  // Request camera roll permissions
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Requerido', 'Se necesita permiso para acceder a las fotos.');
      return false;
    }
    return true;
  };

  // Pick images from gallery
  const handlePickImages = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map((asset) => ({
          uri: asset.uri,
          base64: asset.base64,
          filename: asset.uri.split('/').pop() || `image_${Date.now()}.jpg`,
        }));

        // Validate images
        for (const img of newImages) {
          if (!validateImageFile(img.filename)) {
            Alert.alert('Error', `El archivo ${img.filename} no es una imagen válida`);
            return;
          }
          if (img.base64 && !validateFileSize(img.base64, 5)) {
            Alert.alert('Error', `La imagen ${img.filename} excede el tamaño máximo de 5MB`);
            return;
          }
        }

        setProductImages([...productImages, ...newImages]);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'No se pudieron seleccionar las imágenes');
    }
  };

  // Take photo with camera
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Requerido', 'Se necesita permiso para usar la cámara.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const newImage = {
          uri: asset.uri,
          base64: asset.base64,
          filename: `photo_${Date.now()}.jpg`,
        };

        if (newImage.base64 && !validateFileSize(newImage.base64, 5)) {
          Alert.alert('Error', 'La foto excede el tamaño máximo de 5MB');
          return;
        }

        setProductImages([...productImages, newImage]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  // Remove image
  const handleRemoveImage = (index: number) => {
    Alert.alert(
      'Eliminar Imagen',
      '¿Estás seguro de que deseas eliminar esta imagen?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            const newImages = productImages.filter((_, i) => i !== index);
            setProductImages(newImages);
          },
        },
      ]
    );
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

    // Validaciones de presentaciones y stock inicial SOLO en modo creación
    if (mode === 'create') {
      // Validación: Exactamente UNA presentación debe ser base
      const basePresentation = presentations.filter((p) => p.isBase);
      if (basePresentation.length !== 1) {
        Alert.alert('Error', 'Debe haber exactamente una presentación base');
        return false;
      }

      // Validación: La presentación base SIEMPRE debe tener factor 1
      if (basePresentation[0].factorToBase !== 1) {
        Alert.alert('Error', 'La presentación base debe tener factor 1');
        return false;
      }

      // Validación: Todas las presentaciones deben tener código y factor válido
      for (const p of presentations) {
        if (!p.presentationIdOrCode.trim()) {
          Alert.alert('Error', 'Todas las presentaciones deben seleccionar una presentación del catálogo');
          return false;
        }
        if (p.factorToBase <= 0) {
          Alert.alert('Error', 'El factor de conversión debe ser mayor a 0');
          return false;
        }
        // Validación: Factores no base deben ser > 1
        if (!p.isBase && p.factorToBase <= 1) {
          Alert.alert('Error', 'Las presentaciones no base deben tener un factor mayor a 1');
          return false;
        }
      }

      // Validación: No puede haber presentaciones duplicadas
      const codes = presentations.map(p => p.presentationIdOrCode);
      const uniqueCodes = new Set(codes);
      if (codes.length !== uniqueCodes.size) {
        Alert.alert('Error', 'No puede haber presentaciones duplicadas');
        return false;
      }

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
    if (!validateForm()) return;

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
          presentations: presentations,
          salePrices: salePrices.length > 0 ? salePrices : undefined,
        };

        console.log('📦 Creating product with data:', JSON.stringify(createData, null, 2));

        const createdProduct = await productsApi.createProduct(createData);

        console.log('✅ Product created successfully:', createdProduct.id);

        // Upload product images if any
        if (productImages.length > 0) {
          try {
            console.log('📸 Uploading product images...');
            const imagesToUpload = productImages.filter(img => img.base64);

            if (imagesToUpload.length > 0) {
              // Upload each image individually using the specific endpoint
              const uploadPromises = imagesToUpload.map(img =>
                filesApi.uploadProductImage(
                  img.base64!,
                  createdProduct.id,
                  img.filename
                )
              );
              await Promise.all(uploadPromises);
              console.log(`✅ Uploaded ${imagesToUpload.length} product images to productos/imagenes/${createdProduct.id}`);
            }
          } catch (imageError: any) {
            console.error('❌ Error uploading images:', imageError);
            // Don't fail the whole operation if images fail
            Alert.alert(
              'Advertencia',
              'El producto se creó correctamente, pero hubo un error al subir las imágenes. Puedes agregarlas después editando el producto.'
            );
          }
        }

        // Si se especificó stock inicial, crearlo automáticamente
        if (formData.warehouseId && formData.initialStock && parseFloat(formData.initialStock) > 0) {
          try {
            await inventoryApi.adjustStock({
              productId: createdProduct.id,
              warehouseId: formData.warehouseId,
              areaId: formData.areaId || undefined,
              deltaBase: parseFloat(formData.initialStock),
              reason: 'ADJUST',
              clientOperationId: `initial-stock-${createdProduct.id}-${Date.now()}`,
            });

            const warehouseName = availableWarehouses.find(w => w.id === formData.warehouseId)?.name || 'almacén';
            const selectedArea = formData.areaId ? availableAreas.find(a => a.id === formData.areaId) : null;
            const areaName = selectedArea ? (selectedArea.name || selectedArea.code) : null;
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
        };

        await productsApi.updateProduct(product!.id, updateData);

        // Upload new product images if any
        const newImages = productImages.filter(img => img.base64);
        if (newImages.length > 0) {
          try {
            console.log('📸 Uploading new product images...');
            // Upload each image individually using the specific endpoint
            const uploadPromises = newImages.map(img =>
              filesApi.uploadProductImage(
                img.base64!,
                product!.id,
                img.filename
              )
            );
            await Promise.all(uploadPromises);
            console.log(`✅ Uploaded ${newImages.length} new product images to productos/imagenes/${product!.id}`);
          } catch (imageError: any) {
            console.error('❌ Error uploading images:', imageError);
            Alert.alert(
              'Advertencia',
              'El producto se actualizó correctamente, pero hubo un error al subir las nuevas imágenes.'
            );
          }
        }

        Alert.alert('Éxito', 'Producto actualizado correctamente. Los precios de venta se recalcularon automáticamente.');
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

    const salePrices: { presentationIdOrCode: string; profileIdOrCode: string; priceCents: number }[] = [];
    const costCents = parseFloat(formData.costCents);

    if (isNaN(costCents) || costCents <= 0) {
      return [];
    }

    // Para cada presentación, generar precios para todos los perfiles activos
    presentations.forEach((presentation) => {
      availablePriceProfiles.forEach((profile) => {
        // Calcular precio: costCents * factorToBase * factorToCost
        const factorToCost = typeof profile.factorToCost === 'string'
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

      Alert.alert(
        'Seleccionar Almacén',
        'Elige el almacén donde deseas crear el stock inicial:',
        [
          ...warehouseOptions,
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => {
              onSuccess();
              onClose();
            },
          },
        ]
      );
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

  const promptForInitialQuantity = (createdProduct: Product, warehouse: Warehouse) => {
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
                error.message || 'No se pudo crear el stock inicial. Puedes crearlo manualmente desde la pantalla de inventario.'
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
        factorToBase: 2, // Valor inicial sugerido para presentaciones no base
        minOrderQty: 1,
        orderStep: 1,
      },
    ]);
  };

  const removePresentation = (index: number) => {
    if (presentations[index].isBase) {
      Alert.alert('Error', 'No se puede eliminar la presentación base');
      return;
    }
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
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {mode === 'create' ? 'Nuevo Producto' : 'Editar Producto'}
          </Text>
          <View style={styles.closeButton} />
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
                multiline
                numberOfLines={3}
              />
            </View>

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
                  editable={mode === 'create'}
                />
              </View>

              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Text style={styles.label}>Código de Barras</Text>
                <TextInput
                  style={styles.input}
                  value={formData.barcode}
                  onChangeText={(text) => setFormData({ ...formData, barcode: text })}
                  placeholder="7750182000123"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
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
                  💡 Los precios de venta se calcularán automáticamente según los perfiles de precio configurados
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
          </View>

          {/* Product Images Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📸 Imágenes del Producto</Text>
              <View style={styles.imageButtonsContainer}>
                <TouchableOpacity onPress={handlePickImages} style={styles.imageButton}>
                  <Text style={styles.imageButtonText}>📁 Galería</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleTakePhoto} style={styles.imageButton}>
                  <Text style={styles.imageButtonText}>📷 Cámara</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.infoText}>
              🖼️ {mode === 'edit'
                ? 'Puedes agregar o eliminar imágenes del producto. La primera imagen será la principal.'
                : 'Puedes agregar múltiples imágenes del producto. La primera imagen será la principal.'}
            </Text>

            {productImages.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScrollView}>
                <View style={styles.imagesContainer}>
                  {productImages.map((image, index) => (
                    <View key={index} style={styles.imagePreviewContainer}>
                      <Image source={{ uri: image.uri }} style={styles.imagePreview} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => handleRemoveImage(index)}
                      >
                        <Text style={styles.removeImageButtonText}>✕</Text>
                      </TouchableOpacity>
                      {index === 0 && (
                        <View style={styles.mainImageBadge}>
                          <Text style={styles.mainImageBadgeText}>Principal</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            {productImages.length === 0 && (
              <View style={styles.noImagesContainer}>
                <Text style={styles.noImagesText}>📦 No hay imágenes agregadas</Text>
                <Text style={styles.noImagesSubtext}>Toca los botones de arriba para agregar fotos</Text>
              </View>
            )}
          </View>

          {/* Stock Inicial (solo en modo crear) */}
          {mode === 'create' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Stock Inicial <Text style={styles.required}>*</Text></Text>
              <Text style={styles.infoText}>
                📊 Debes crear stock inicial para este producto al momento de crearlo.
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Almacén <Text style={styles.required}>*</Text></Text>
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
                            Alert.alert('Sin almacenes', 'No hay almacenes disponibles. Por favor, crea uno primero.');
                            return;
                          }

                          const options = availableWarehouses.map((w) => ({
                            text: `${w.name} (${w.code})`,
                            onPress: () => setFormData({ ...formData, warehouseId: w.id }),
                          }));

                          Alert.alert('Seleccionar Almacén', '', [
                            ...options,
                            { text: 'Ninguno', onPress: () => setFormData({ ...formData, warehouseId: '', areaId: '' }) },
                            { text: 'Cancelar', style: 'cancel' },
                          ]);
                        }}
                      >
                        <Text style={styles.pickerText}>
                          {formData.warehouseId
                            ? (() => {
                                const selected = availableWarehouses.find((w) => w.id === formData.warehouseId);
                                return selected ? `${selected.name} (${selected.code})` : 'Seleccionar almacén...';
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
                  <Text style={styles.label}>Área <Text style={styles.required}>*</Text></Text>
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
                              { text: 'Ninguna', onPress: () => setFormData({ ...formData, areaId: '' }) },
                              { text: 'Cancelar', style: 'cancel' },
                            ]);
                          }}
                        >
                          <Text style={styles.pickerText}>
                            {formData.areaId
                              ? (() => {
                                  const selected = availableAreas.find((a) => a.id === formData.areaId);
                                  return selected ? (selected.name || selected.code || `Área ${selected.id.substring(0, 8)}`) : 'Seleccionar área...';
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
                  <Text style={styles.label}>Cantidad Inicial (en unidades base) <Text style={styles.required}>*</Text></Text>
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
          {mode === 'create' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Presentaciones</Text>
                <TouchableOpacity onPress={addPresentation} style={styles.addButton}>
                  <Text style={styles.addButtonText}>+ Agregar</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.infoText}>
                📦 Las presentaciones son del catálogo global, pero cada producto define sus propios factores de conversión.
                {'\n'}
                {'\n'}💡 Ejemplo: Leche Gloria 1L
                {'\n'}• 1 Unidad (UN) = 1 unidad base (factor: 1) ✓ BASE
                {'\n'}• 1 Paquete (PK) = 6 unidades (factor: 6)
                {'\n'}• 1 Caja (CJ) = 24 unidades (factor: 24)
                {'\n'}
                {'\n'}⚠️ El costo se define por unidad base. Los precios de venta se calculan automáticamente según los perfiles de precio configurados.
              </Text>

              {presentations.map((presentation, index) => (
                <View key={index} style={styles.presentationCard}>
                  <View style={styles.presentationHeader}>
                    <Text style={styles.presentationTitle}>Presentación {index + 1}</Text>
                    {!presentation.isBase && (
                      <TouchableOpacity onPress={() => removePresentation(index)}>
                        <Text style={styles.removeButton}>✕</Text>
                      </TouchableOpacity>
                    )}
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
                                Alert.alert('Sin presentaciones', 'No hay presentaciones disponibles. Por favor, crea una primero.');
                                return;
                              }

                              const options = availablePresentations.map((p) => ({
                                text: `${p.code} - ${p.name}`,
                                onPress: () => updatePresentation(index, 'presentationIdOrCode', p.code),
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
                                    const selected = availablePresentations.find(
                                      (p) => p.code === presentation.presentationIdOrCode
                                    );
                                    return selected ? `${selected.code} - ${selected.name}` : presentation.presentationIdOrCode;
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

                  <View style={styles.formRow}>
                    <View style={[styles.formGroup, styles.formGroupHalf]}>
                      <View style={styles.switchContainer}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Es Presentación Base</Text>
                          <Text style={styles.helpText}>
                            {presentation.isBase
                              ? '✓ Esta es la unidad base del producto'
                              : 'Solo una presentación puede ser base'}
                          </Text>
                        </View>
                        <Switch
                          value={presentation.isBase}
                          onValueChange={(value) => {
                            if (value) {
                              // Desmarcar todas las demás y establecer factor 1
                              const updated = presentations.map((p, i) => ({
                                ...p,
                                isBase: i === index,
                                factorToBase: i === index ? 1 : p.factorToBase,
                              }));
                              setPresentations(updated);
                            }
                          }}
                        />
                      </View>
                    </View>

                    <View style={[styles.formGroup, styles.formGroupHalf]}>
                      <Text style={styles.label}>
                        Factor a Base {!presentation.isBase && <Text style={styles.required}>*</Text>}
                      </Text>
                      <TextInput
                        style={[styles.input, presentation.isBase && styles.inputDisabled]}
                        value={presentation.factorToBase.toString()}
                        onChangeText={(text) => {
                          if (presentation.isBase) {
                            console.log('⚠️ Intento de editar factor base - bloqueado');
                            return;
                          }
                          console.log('✏️ Editando factor:', text);
                          const value = text.trim() === '' ? '' : parseFloat(text);
                          if (text.trim() === '' || (!isNaN(value as number) && (value as number) > 0)) {
                            updatePresentation(index, 'factorToBase', value === '' ? 1 : (value as number));
                          }
                        }}
                        placeholder={presentation.isBase ? "1" : "Ej: 6, 12, 24"}
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        editable={!presentation.isBase}
                        onFocus={() => console.log('🎯 Factor field focused - isBase:', presentation.isBase)}
                      />
                      <Text style={styles.helpText}>
                        {presentation.isBase
                          ? '✓ La presentación base siempre tiene factor 1'
                          : presentation.presentationIdOrCode
                          ? `Cuántas unidades base contiene 1 ${presentation.presentationIdOrCode}`
                          : 'Cuántas unidades base contiene esta presentación'}
                      </Text>
                      {!presentation.isBase && presentation.factorToBase > 1 && formData.costCents && (
                        <Text style={styles.calculationText}>
                          💰 Costo por {presentation.presentationIdOrCode}: S/ {((parseFloat(formData.costCents) * presentation.factorToBase) / 100).toFixed(2)}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.formRow}>
                    <View style={[styles.formGroup, styles.formGroupHalf]}>
                      <Text style={styles.label}>Cantidad Mínima de Pedido</Text>
                      <TextInput
                        style={styles.input}
                        value={presentation.minOrderQty.toString()}
                        onChangeText={(text) =>
                          updatePresentation(index, 'minOrderQty', parseInt(text) || 1)
                        }
                        placeholder="1"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                      />
                      <Text style={styles.helpText}>
                        Cantidad mínima que se puede pedir de esta presentación
                      </Text>
                    </View>

                    <View style={[styles.formGroup, styles.formGroupHalf]}>
                      <Text style={styles.label}>Incremento de Pedido</Text>
                      <TextInput
                        style={styles.input}
                        value={presentation.orderStep.toString()}
                        onChangeText={(text) =>
                          updatePresentation(index, 'orderStep', parseInt(text) || 1)
                        }
                        placeholder="1"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                      />
                      <Text style={styles.helpText}>
                        Los pedidos deben ser múltiplos de este valor
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Preview de Precios de Venta (solo en modo crear) */}
          {mode === 'create' && formData.costCents && parseFloat(formData.costCents) > 0 && availablePriceProfiles.length > 0 && presentations.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Vista Previa de Precios de Venta</Text>
              <Text style={styles.infoText}>
                💰 Los siguientes precios se generarán automáticamente al crear el producto:
              </Text>

              {presentations.map((presentation, presIndex) => {
                const presentationData = availablePresentations.find(p => p.code === presentation.presentationIdOrCode);
                const presentationName = presentationData ? `${presentationData.code} - ${presentationData.name}` : presentation.presentationIdOrCode;

                return (
                  <View key={presIndex} style={styles.pricePreviewCard}>
                    <Text style={styles.pricePreviewTitle}>
                      📦 {presentationName} (Factor: {presentation.factorToBase})
                    </Text>

                    {availablePriceProfiles.map((profile, profIndex) => {
                      const factorToCost = typeof profile.factorToCost === 'string'
                        ? parseFloat(profile.factorToCost)
                        : profile.factorToCost;
                      const costCents = parseFloat(formData.costCents);
                      const priceCents = Math.round(costCents * presentation.factorToBase * factorToCost);
                      const priceInSoles = (priceCents / 100).toFixed(2);

                      return (
                        <View key={profIndex} style={styles.pricePreviewItem}>
                          <Text style={styles.pricePreviewLabel}>
                            {profile.name} (x{factorToCost}):
                          </Text>
                          <Text style={styles.pricePreviewValue}>
                            S/ {priceInSoles}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}

              <Text style={styles.helpText}>
                ℹ️ Estos precios se pueden modificar posteriormente desde la gestión de precios de venta
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Actualizar'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#1E293B',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formGroupHalf: {
    flex: 1,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1E293B',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  picker: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerText: {
    fontSize: 15,
    color: '#1E293B',
  },
  helpText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  infoText: {
    fontSize: 11,
    color: '#667eea',
    marginTop: 6,
    fontStyle: 'italic',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  presentationCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presentationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  presentationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  removeButton: {
    fontSize: 18,
    color: '#EF4444',
    paddingHorizontal: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  inputDisabled: {
    backgroundColor: '#F1F5F9',
    color: '#94A3B8',
  },
  calculationText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  submitButton: {
    backgroundColor: '#667eea',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  pricePreviewCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pricePreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  pricePreviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    marginBottom: 4,
  },
  pricePreviewLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  pricePreviewValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  imageButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  imageButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  imageButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  imagesScrollView: {
    marginTop: 12,
  },
  imagesContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  mainImageBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mainImageBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  noImagesContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginTop: 12,
  },
  noImagesText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  noImagesSubtext: {
    fontSize: 12,
    color: '#94A3B8',
  },
});

export default ProductFormModal;
