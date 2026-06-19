import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { photoCampaignsApi } from '@/services/api';
import priceProfilesApi from '@/services/api/price-profiles';
import { productsApi, Product } from '@/services/api/products';
import {
  PhotoCampaign,
  PhotoCampaignProductItem,
  PhotoType,
  ProductPhotoAsset,
  AdDesignTemplate,
  PhotoCampaignWhatsappContact,
} from '@/types/photo-campaigns';
import { PriceProfile, ProductSalePrice } from '@/types/price-profiles';
import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  MediaTypeOptions,
} from '@/utils/filePicker';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import { PERMISSIONS } from '@/constants/permissions';

interface PhotoCampaignManagementScreenProps {
  navigation: any;
  route: {
    params?: {
      campaignId?: string;
    };
  };
}

type CampaignFormState = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  notes: string;
};

const emptyCampaignForm: CampaignFormState = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  notes: '',
};

const PHOTO_TYPES: Array<{ key: PhotoType; label: string }> = [
  { key: 'reference', label: 'Referencia' },
  { key: 'design', label: 'Diseño' },
  { key: 'price', label: 'Con precio' },
];

const DEFAULT_DESIGN_PROMPT = `Transforma esta imagen en una fotografía de producto premium de nivel comercial y publicitario.

El producto debe mantenerse exactamente igual al original, sin alterar su forma, proporciones, branding, etiquetas ni colores reales.

Composición:

* Producto perfectamente centrado.
* Encuadre limpio y equilibrado.
* El producto debe ocupar la mayor parte de la imagen sin recortarse.
* Perspectiva profesional tipo fotografía e-commerce / catálogo premium.
* Enfoque extremadamente nítido y detallado en todo el producto.

Iluminación:

* Luz natural suave de día.
* Iluminación uniforme y profesional.
* Sombras suaves y realistas.
* El producto debe destacar claramente del fondo.
* Si el producto tiene colores oscuros, aclararlo ligeramente manteniendo colores reales, contraste natural y texturas visibles.

Escenario y fondo:

* Crear un ambiente elegante y minimalista relacionado con el uso o identidad del producto.
* El entorno debe complementar el producto sin quitarle protagonismo.
* Fondo limpio, ordenado, moderno y visualmente atractivo.
* Cambiar la superficie/base del producto por una más estética y premium.
* Evitar fondos recargados, elementos distractores o exceso de decoración.

Estilo visual:

* Fotografía publicitaria de alta gama.
* Estilo moderno, limpio y profesional.
* Calidad tipo campaña comercial para redes sociales y catálogo digital.
* Texturas realistas y acabado fotográfico natural.

Restricciones:

* No deformar el producto.
* No agregar objetos innecesarios.
* No alterar logos, empaques ni diseño original.
* No usar efectos caricaturescos ni ilustrativos.

Salida final:

* Resolución 1800x1800 px.
* Formato cuadrado.
* Alta nitidez y calidad premium.
* Optimizado para Instagram, e-commerce y publicidad digital.`;

type PricePhotoFormState = {
  name: string;
  sku: string;
  price: string;
  template: AdDesignTemplate;
  profileId: string;
};

const defaultPricePhotoForm: PricePhotoFormState = {
  name: '',
  sku: '',
  price: '',
  template: 'promo',
  profileId: '',
};

const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  reference: 'Referencia',
  design: 'Diseño',
  price: 'Con precio',
};

export const PhotoCampaignManagementScreen: React.FC<PhotoCampaignManagementScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const campaignIdFromRoute = route?.params?.campaignId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [campaigns, setCampaigns] = useState<PhotoCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<PhotoCampaign | null>(null);
  const [selectedCampaignProducts, setSelectedCampaignProducts] = useState<PhotoCampaignProductItem[]>([]);

  const [campaignFormVisible, setCampaignFormVisible] = useState(false);
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(emptyCampaignForm);
  const [editingCampaign, setEditingCampaign] = useState<PhotoCampaign | null>(null);

  const [productSearchQuery, setProductSearchQuery] = useState('');

  const [showCampaignSearchSuggestions, setShowCampaignSearchSuggestions] = useState(false);
  const [campaignSearchLoading, setCampaignSearchLoading] = useState(false);
  const [campaignSearchResults, setCampaignSearchResults] = useState<Product[]>([]);
  const [campaignSearchTimeout, setCampaignSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const [visibleProductIds, setVisibleProductIds] = useState<Set<string>>(new Set());
  const [photosByProduct, setPhotosByProduct] = useState<Record<string, ProductPhotoAsset[]>>({});
  const [photoLoadingByProduct, setPhotoLoadingByProduct] = useState<Record<string, boolean>>({});
  const [photoUploadingKey, setPhotoUploadingKey] = useState<string | null>(null);

  const [designModalVisible, setDesignModalVisible] = useState(false);
  const [pricePhotoModalVisible, setPricePhotoModalVisible] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerUri, setImageViewerUri] = useState<string | null>(null);
  const [imageViewerTitle, setImageViewerTitle] = useState('');
  const imageViewerScale = useSharedValue(1);
  const imageViewerSavedScale = useSharedValue(1);
  const imageViewerTranslateX = useSharedValue(0);
  const imageViewerTranslateY = useSharedValue(0);
  const imageViewerSavedTranslateX = useSharedValue(0);
  const imageViewerSavedTranslateY = useSharedValue(0);
  const imageViewerFocalX = useSharedValue(0);
  const imageViewerFocalY = useSharedValue(0);
  const [designTargetItem, setDesignTargetItem] = useState<PhotoCampaignProductItem | null>(null);
  const [pricePhotoTargetItem, setPricePhotoTargetItem] = useState<PhotoCampaignProductItem | null>(null);
  const [designPrompt, setDesignPrompt] = useState(DEFAULT_DESIGN_PROMPT);
  const [designReferenceFile, setDesignReferenceFile] = useState<any | null>(null);
  const [designPreviewUri, setDesignPreviewUri] = useState<string | null>(null);
  const [designGeneratedBase64, setDesignGeneratedBase64] = useState<string | null>(null);
  const [designGeneratedMimeType, setDesignGeneratedMimeType] = useState<string>('image/jpeg');
  const [designGenerating, setDesignGenerating] = useState(false);
  const [designSaving, setDesignSaving] = useState(false);

  const [pricePhotoForm, setPricePhotoForm] = useState<PricePhotoFormState>(defaultPricePhotoForm);
  const [pricePhotoPreviewUri, setPricePhotoPreviewUri] = useState<string | null>(null);
  const [pricePhotoDesignBaseUri, setPricePhotoDesignBaseUri] = useState<string | null>(null);
  const [pricePhotoDesignBaseMimeType, setPricePhotoDesignBaseMimeType] = useState<string>('image/jpeg');
  const [pricePhotoHasGeneratedPreview, setPricePhotoHasGeneratedPreview] = useState(false);
  const [pricePhotoGenerating, setPricePhotoGenerating] = useState(false);
  const [pricePhotoSaving, setPricePhotoSaving] = useState(false);
  const [priceProfiles, setPriceProfiles] = useState<PriceProfile[]>([]);
  const [priceSalePrices, setPriceSalePrices] = useState<ProductSalePrice[]>([]);
  const [priceProfilesLoading, setPriceProfilesLoading] = useState(false);

  const [whatsappModalVisible, setWhatsappModalVisible] = useState(false);
  const [whatsappContacts, setWhatsappContacts] = useState<PhotoCampaignWhatsappContact[]>([]);
  const [whatsappContactsLoading, setWhatsappContactsLoading] = useState(false);
  const [whatsappSubmitting, setWhatsappSubmitting] = useState(false);
  const [whatsappContactId, setWhatsappContactId] = useState('');
  const [whatsappSendAll, setWhatsappSendAll] = useState(true);
  const [whatsappSelectedProductIds, setWhatsappSelectedProductIds] = useState<Set<string>>(new Set());
  const [whatsappSelectedPhotoTypes, setWhatsappSelectedPhotoTypes] = useState<Set<PhotoType>>(new Set());
  const [whatsappCaption, setWhatsappCaption] = useState('');
  const [whatsappProductSearchQuery, setWhatsappProductSearchQuery] = useState('');

  const photosCacheRef = useRef<Record<string, ProductPhotoAsset[]>>({});

  const loadCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const response = await photoCampaignsApi.getCampaigns();
      setCampaigns(response);

      if (response.length === 0) {
        setSelectedCampaign(null);
        return;
      }

      if (campaignIdFromRoute) {
        const requestedCampaign = response.find((campaign) => campaign.id === campaignIdFromRoute);
        if (requestedCampaign) {
          setSelectedCampaign(requestedCampaign);
          return;
        }
      }

      // Si no hay campaña seleccionada aún, selecciona la primera
      setSelectedCampaign((prev) => prev || response[0]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar las campañas');
    } finally {
      setLoading(false);
    }
  }, [campaignIdFromRoute]);

  const loadCampaignProducts = useCallback(async (campaignId: string) => {
    try {
      const response = await photoCampaignsApi.getCampaignProducts(campaignId);
      setSelectedCampaignProducts(response);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar los productos de la campaña');
      setSelectedCampaignProducts([]);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (selectedCampaign?.id) {
      void loadCampaignProducts(selectedCampaign.id);
    } else {
      setSelectedCampaignProducts([]);
    }
  }, [selectedCampaign?.id, loadCampaignProducts]);


  const filteredCampaignProducts = useMemo(() => {
    const query = productSearchQuery.trim().toLowerCase();
    if (!query) {
      return selectedCampaignProducts;
    }

    return selectedCampaignProducts.filter((item) => {
      const text = `${item.product?.title || ''} ${item.product?.sku || ''} ${item.notes || ''}`.toLowerCase();
      return text.includes(query);
    });
  }, [selectedCampaignProducts, productSearchQuery]);

  const searchProductsForCampaign = useCallback(async (query: string) => {
    const term = query.trim();
    if (term.length < 2) {
      setCampaignSearchResults([]);
      setShowCampaignSearchSuggestions(false);
      return;
    }

    try {
      setCampaignSearchLoading(true);
      const searchResponse = await productsApi.searchProductsV2({
        q: term,
        limit: 20,
        includePhotos: false,
      });

      const candidateIds = (searchResponse.results || []).map((product) => product.id);
      if (candidateIds.length === 0) {
        setCampaignSearchResults([]);
        setShowCampaignSearchSuggestions(true);
        return;
      }

      try {
        const batchResponse = await productsApi.getProductsByIds(candidateIds, false);
        setCampaignSearchResults(batchResponse.products || []);
      } catch {
        setCampaignSearchResults(searchResponse.results || []);
      }

      setShowCampaignSearchSuggestions(true);
    } catch {
      setCampaignSearchResults([]);
      setShowCampaignSearchSuggestions(true);
    } finally {
      setCampaignSearchLoading(false);
    }
  }, []);

  const handleCampaignProductsSearchChange = (text: string) => {
    const trimmed = text.trim();
    setProductSearchQuery(text);

    if (!trimmed) {
      setShowCampaignSearchSuggestions(false);
      setCampaignSearchResults([]);
      if (campaignSearchTimeout) {
        clearTimeout(campaignSearchTimeout);
      }
      return;
    }

    setShowCampaignSearchSuggestions(true);

    if (campaignSearchTimeout) {
      clearTimeout(campaignSearchTimeout);
    }

    if (trimmed.length < 2) {
      setCampaignSearchResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      void searchProductsForCampaign(trimmed);
    }, 500);

    setCampaignSearchTimeout(timeout);
  };

  const loadProductPhotos = useCallback(async (productId: string, force = false) => {
    if (!force && photosCacheRef.current[productId]) {
      setPhotosByProduct((prev) => ({ ...prev, [productId]: photosCacheRef.current[productId] }));
      return;
    }

    if (photoLoadingByProduct[productId]) {
      return;
    }

    try {
      setPhotoLoadingByProduct((prev) => ({ ...prev, [productId]: true }));
      const assets = await photoCampaignsApi.getProductPhotos(productId);
      photosCacheRef.current[productId] = assets;
      setPhotosByProduct((prev) => ({ ...prev, [productId]: assets }));
    } catch {
      setPhotosByProduct((prev) => ({ ...prev, [productId]: [] }));
    } finally {
      setPhotoLoadingByProduct((prev) => ({ ...prev, [productId]: false }));
    }
  }, [photoLoadingByProduct]);

  const getPhotoByType = useCallback(
    (productId: string, photoType: PhotoType): ProductPhotoAsset | undefined => {
      return photosByProduct[productId]?.find((asset) => asset.photoType === photoType && asset.isActive);
    },
    [photosByProduct]
  );

  const getPhotoCompletion = useCallback(
    (productId: string): number => {
      const assets = photosByProduct[productId] || [];
      const typesFound = new Set(assets.filter((asset) => asset.isActive).map((asset) => asset.photoType));
      return PHOTO_TYPES.reduce((acc, type) => (typesFound.has(type.key) ? acc + 1 : acc), 0);
    },
    [photosByProduct]
  );

  const pickAndUploadPhoto = useCallback(
    async (item: PhotoCampaignProductItem, photoType: PhotoType) => {
      const campaignId = selectedCampaign?.id;
      if (!campaignId) {
        Alert.alert('Atención', 'Selecciona una campaña primero');
        return;
      }

      const permission = await requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permiso requerido', 'Se necesita permiso para acceder a las fotos');
        return;
      }

      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      const filePayload: any = {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: asset.fileName || `${photoType}-${Date.now()}.jpg`,
      };

      const uploadKey = `${item.productId}:${photoType}`;

      try {
        setPhotoUploadingKey(uploadKey);
        await photoCampaignsApi.uploadProductPhoto(item.productId, {
          photoType,
          file: filePayload,
          photoCampaignId: campaignId,
        });

        await loadProductPhotos(item.productId, true);
      } catch (error: any) {
        Alert.alert('Error', error?.message || `No se pudo subir la foto (${photoType})`);
      } finally {
        setPhotoUploadingKey(null);
      }
    },
    [loadProductPhotos, selectedCampaign?.id]
  );

  const openPricePhotoModal = async (item: PhotoCampaignProductItem) => {
    const designPhoto = getPhotoByType(item.productId, 'design');

    if (!designPhoto?.fileUrl) {
      Alert.alert('Diseño requerido', 'Primero debes tener una foto de diseño para agregarle precio.');
      return;
    }

    try {
      setPriceProfilesLoading(true);
      const [profilesResponse, salePricesResponse] = await Promise.all([
        priceProfilesApi.getActivePriceProfiles(),
        priceProfilesApi.getProductSalePrices(item.productId),
      ]);

      const salePricesArray =
        (salePricesResponse as any).salePrices || salePricesResponse.data || [];

      const defaultProfile =
        profilesResponse.find((p) => p.name?.toLowerCase().includes('socia')) ||
        profilesResponse[0] ||
        null;

      const defaultSalePrice = defaultProfile
        ? salePricesArray.find(
            (sp: ProductSalePrice) => sp.profileId === defaultProfile.id && sp.presentationId === null
          )
        : null;

      const defaultPrice = defaultSalePrice
        ? (defaultSalePrice.priceCents / 100).toFixed(2)
        : '';

      const fileUri = `${FileSystem.cacheDirectory}price-design-${item.productId}-${Date.now()}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(designPhoto.fileUrl, fileUri, {
        cache: true,
      });

      if (downloadResult.status !== 200) {
        Alert.alert('Error', 'No se pudo preparar la foto de diseño.');
        return;
      }

      const fileForAdDesign: any = {
        uri: downloadResult.uri,
        type: designPhoto.mimeType || 'image/jpeg',
        name: `design-price-${item.productId}.jpg`,
      };

      setPriceProfiles(profilesResponse);
      setPriceSalePrices(salePricesArray);
      setPricePhotoTargetItem(item);
      setDesignReferenceFile(fileForAdDesign);
      setPricePhotoDesignBaseUri(downloadResult.uri);
      setPricePhotoDesignBaseMimeType(designPhoto.mimeType || 'image/jpeg');
      setPricePhotoPreviewUri(null);
      setPricePhotoHasGeneratedPreview(false);
      setPricePhotoForm({
        name: item.product?.title || '',
        sku: item.product?.sku || '',
        price: defaultPrice,
        template: 'promo',
        profileId: defaultProfile?.id || '',
      });
      setPricePhotoPreviewUri(null);
      setPricePhotoHasGeneratedPreview(false);
      setPricePhotoModalVisible(true);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo preparar la foto para diseño con precio.');
    } finally {
      setPriceProfilesLoading(false);
    }
  };

  const handlePreviewPricePhoto = async () => {
    if (!pricePhotoTargetItem?.productId || !selectedCampaign?.id) {
      Alert.alert('Error', 'No hay producto seleccionado para generar diseño con precio.');
      return;
    }

    if (!designReferenceFile) {
      Alert.alert('Error', 'No se encontró la imagen base para generar el diseño.');
      return;
    }

    if (!pricePhotoForm.name.trim() || !pricePhotoForm.sku.trim() || !pricePhotoForm.price.trim()) {
      Alert.alert('Validación', 'Nombre, SKU y precio son obligatorios.');
      return;
    }

    try {
      setPricePhotoGenerating(true);
      const response = await photoCampaignsApi.generateAdDesign(pricePhotoTargetItem.productId, {
        file: designReferenceFile,
        name: pricePhotoForm.name.trim(),
        sku: pricePhotoForm.sku.trim(),
        price: pricePhotoForm.price.trim(),
        template: pricePhotoForm.template,
        photoCampaignId: selectedCampaign.id,
      });

      const generatedUrl =
        response?.asset?.fileUrl ||
        response?.imageUrl ||
        response?.fileUrl ||
        response?.url ||
        response?.data?.asset?.fileUrl ||
        response?.data?.imageUrl ||
        response?.data?.fileUrl ||
        response?.data?.url;

      if (!generatedUrl) {
        Alert.alert('Error', 'No se pudo obtener la vista previa del diseño con precio.');
        return;
      }

      setPricePhotoPreviewUri(generatedUrl);
      setPricePhotoHasGeneratedPreview(true);

      // El endpoint ad-design persiste en tipo design. Restauramos el design original
      // para que previsualizar no deje cambios.
      await restoreOriginalDesignAfterPreview(pricePhotoTargetItem.productId, selectedCampaign.id);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo generar la vista previa del diseño con precio.');
    } finally {
      if (pricePhotoTargetItem?.productId) {
        await loadProductPhotos(pricePhotoTargetItem.productId, true);
      }
      setPricePhotoGenerating(false);
    }
  };

  const handleSavePricePhoto = async () => {
    if (!pricePhotoTargetItem?.productId || !selectedCampaign?.id) {
      Alert.alert('Error', 'No hay producto seleccionado para guardar diseño con precio.');
      return;
    }

    if (!pricePhotoPreviewUri) {
      Alert.alert('Error', 'Primero debes generar la vista previa de la foto con precio.');
      return;
    }

    try {
      setPricePhotoSaving(true);

      const fileUri = `${FileSystem.cacheDirectory}price-${pricePhotoTargetItem.productId}-${Date.now()}.png`;
      const downloadResult = await FileSystem.downloadAsync(pricePhotoPreviewUri, fileUri, {
        cache: true,
      });

      if (downloadResult.status !== 200) {
        Alert.alert('Error', 'No se pudo descargar la imagen para guardar foto con precio.');
        return;
      }

      const priceFile: any = {
        uri: downloadResult.uri,
        type: 'image/png',
        name: `price-${pricePhotoTargetItem.productId}.png`,
      };

      await photoCampaignsApi.uploadProductPhoto(pricePhotoTargetItem.productId, {
        photoType: 'price',
        file: priceFile,
        photoCampaignId: selectedCampaign.id,
      });

      await loadProductPhotos(pricePhotoTargetItem.productId, true);
      setPricePhotoModalVisible(false);
      setPricePhotoTargetItem(null);
      setPricePhotoPreviewUri(null);
      setPricePhotoHasGeneratedPreview(false);
      setPricePhotoForm(defaultPricePhotoForm);
      setPriceProfiles([]);
      setPriceSalePrices([]);
      setDesignReferenceFile(null);
      setPricePhotoDesignBaseUri(null);
      setPricePhotoDesignBaseMimeType('image/jpeg');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo guardar la foto con precio.');
    } finally {
      setPricePhotoSaving(false);
    }
  };

  const restoreOriginalDesignAfterPreview = async (productId: string, campaignId: string) => {
    if (!pricePhotoDesignBaseUri) {
      return;
    }

    const extension = pricePhotoDesignBaseMimeType.includes('png') ? 'png' : 'jpg';

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await photoCampaignsApi.uploadProductPhoto(productId, {
        photoType: 'design',
        file: {
          uri: pricePhotoDesignBaseUri,
          type: pricePhotoDesignBaseMimeType,
          name: `restore-design-${productId}-${attempt}.${extension}`,
        },
        photoCampaignId: campaignId,
      });

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
  };

  const openDesignModal = async (item: PhotoCampaignProductItem) => {
    const campaignId = selectedCampaign?.id;
    if (!campaignId) {
      Alert.alert('Atención', 'Selecciona una campaña primero');
      return;
    }

    const referencePhoto = getPhotoByType(item.productId, 'reference');
    if (!referencePhoto?.fileUrl) {
      Alert.alert('Referencia requerida', 'Primero debes subir la foto de referencia.');
      return;
    }

    try {
      const fileUri = `${FileSystem.cacheDirectory}ref-${item.productId}-${Date.now()}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(referencePhoto.fileUrl, fileUri, {
        cache: true,
      });

      if (downloadResult.status !== 200) {
        Alert.alert('Error', 'No se pudo preparar la foto de referencia.');
        return;
      }

      const fileForGemini: any = {
        uri: downloadResult.uri,
        type: 'image/jpeg',
        name: `reference-${item.productId}.jpg`,
      };

      setDesignTargetItem(item);
      setDesignReferenceFile(fileForGemini);
      setDesignPrompt(DEFAULT_DESIGN_PROMPT);
      setDesignPreviewUri(null);
      setDesignGeneratedBase64(null);
      setDesignGeneratedMimeType('image/jpeg');
      setDesignModalVisible(true);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo cargar la foto de referencia.');
    }
  };

  const handleGenerateDesignWithGemini = async () => {
    if (!designReferenceFile || !designPrompt.trim()) {
      Alert.alert('Validación', 'Debes escribir un prompt para generar la foto de diseño.');
      return;
    }

    try {
      setDesignGenerating(true);
      console.log('🧪 [PHOTO_CAMPAIGNS][GEMINI] Generating design', {
        productId: designTargetItem?.productId,
        promptLength: designPrompt.trim().length,
        referenceFile: {
          name: designReferenceFile?.name,
          type: designReferenceFile?.type,
          uri: designReferenceFile?.uri,
        },
      });

      const response = await photoCampaignsApi.editImageWithGemini(designReferenceFile, designPrompt.trim());

      console.log('🧪 [PHOTO_CAMPAIGNS][GEMINI] Response received', {
        response,
        topLevelKeys: response ? Object.keys(response) : [],
      });

      const generatedUrl =
        response?.imageUrl ||
        response?.url ||
        response?.data?.imageUrl ||
        response?.data?.url ||
        response?.result?.imageUrl ||
        response?.result?.url;

      const generatedBase64 =
        response?.editedImageBase64 ||
        response?.data?.editedImageBase64 ||
        response?.result?.editedImageBase64;

      const generatedMimeType =
        response?.mimeType ||
        response?.data?.mimeType ||
        response?.result?.mimeType ||
        'image/png';

      console.log('🧪 [PHOTO_CAMPAIGNS][GEMINI] URL/Base64 extraction', {
        generatedUrl,
        hasBase64: !!generatedBase64,
        base64Length: generatedBase64?.length || 0,
        generatedMimeType,
        imageUrl: response?.imageUrl,
        url: response?.url,
        dataImageUrl: response?.data?.imageUrl,
        dataUrl: response?.data?.url,
        resultImageUrl: response?.result?.imageUrl,
        resultUrl: response?.result?.url,
        hasTopLevelBase64: !!response?.editedImageBase64,
      });

      if (generatedUrl) {
        setDesignGeneratedBase64(null);
        setDesignGeneratedMimeType('image/jpeg');
        setDesignPreviewUri(generatedUrl);
        return;
      }

      if (generatedBase64) {
        setDesignGeneratedBase64(generatedBase64);
        setDesignGeneratedMimeType(generatedMimeType);
        setDesignPreviewUri(`data:${generatedMimeType};base64,${generatedBase64}`);
        return;
      }

      console.warn('⚠️ [PHOTO_CAMPAIGNS][GEMINI] No valid image URL/Base64 found in response');
      Alert.alert('Error', 'Gemini no devolvió una imagen válida.');
    } catch (error: any) {
      console.error('❌ [PHOTO_CAMPAIGNS][GEMINI] Generation error', error);
      Alert.alert('Error', error?.message || 'No se pudo generar la foto de diseño.');
    } finally {
      setDesignGenerating(false);
    }
  };

  const resetImageViewerTransform = () => {
    imageViewerScale.value = 1;
    imageViewerSavedScale.value = 1;
    imageViewerTranslateX.value = 0;
    imageViewerTranslateY.value = 0;
    imageViewerSavedTranslateX.value = 0;
    imageViewerSavedTranslateY.value = 0;
    imageViewerFocalX.value = 0;
    imageViewerFocalY.value = 0;
  };

  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      imageViewerFocalX.value = event.focalX;
      imageViewerFocalY.value = event.focalY;
    })
    .onUpdate((event) => {
      imageViewerFocalX.value = event.focalX;
      imageViewerFocalY.value = event.focalY;

      const nextScale = imageViewerSavedScale.value * event.scale;
      imageViewerScale.value = Math.max(1, Math.min(nextScale, 6));
    })
    .onEnd(() => {
      imageViewerSavedScale.value = imageViewerScale.value;

      if (imageViewerScale.value <= 1) {
        imageViewerTranslateX.value = 0;
        imageViewerTranslateY.value = 0;
        imageViewerSavedTranslateX.value = 0;
        imageViewerSavedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      imageViewerSavedTranslateX.value = imageViewerTranslateX.value;
      imageViewerSavedTranslateY.value = imageViewerTranslateY.value;
    })
    .onUpdate((event) => {
      if (imageViewerScale.value <= 1) {
        return;
      }

      imageViewerTranslateX.value = imageViewerSavedTranslateX.value + event.translationX;
      imageViewerTranslateY.value = imageViewerSavedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      imageViewerSavedTranslateX.value = imageViewerTranslateX.value;
      imageViewerSavedTranslateY.value = imageViewerTranslateY.value;
    });

  const imageViewerGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const imageViewerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: imageViewerTranslateX.value },
        { translateY: imageViewerTranslateY.value },
        { translateX: imageViewerFocalX.value },
        { translateY: imageViewerFocalY.value },
        { scale: imageViewerScale.value },
        { translateX: -imageViewerFocalX.value },
        { translateY: -imageViewerFocalY.value },
      ],
    };
  });

  const openImageViewer = (uri: string, title: string) => {
    resetImageViewerTransform();
    setImageViewerUri(uri);
    setImageViewerTitle(title);
    setImageViewerVisible(true);
  };

  const handleAcceptGeneratedDesign = async () => {
    if (!designTargetItem || !designPreviewUri || !selectedCampaign?.id) {
      Alert.alert('Error', 'Faltan datos para guardar la foto de diseño.');
      return;
    }

    try {
      setDesignSaving(true);
      const extension = designGeneratedMimeType.includes('png') ? 'png' : 'jpg';
      const fileUri = `${FileSystem.cacheDirectory}design-${designTargetItem.productId}-${Date.now()}.${extension}`;

      if (designGeneratedBase64) {
        await FileSystem.writeAsStringAsync(fileUri, designGeneratedBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        const downloadResult = await FileSystem.downloadAsync(designPreviewUri, fileUri, {
          cache: true,
        });

        if (downloadResult.status !== 200) {
          Alert.alert('Error', 'No se pudo descargar la imagen generada.');
          return;
        }
      }

      const designFile: any = {
        uri: fileUri,
        type: designGeneratedMimeType || 'image/jpeg',
        name: `design-${designTargetItem.productId}.${extension}`,
      };

      await photoCampaignsApi.uploadProductPhoto(designTargetItem.productId, {
        photoType: 'design',
        file: designFile,
        photoCampaignId: selectedCampaign.id,
      });

      await loadProductPhotos(designTargetItem.productId, true);
      setDesignModalVisible(false);
      setDesignTargetItem(null);
      setDesignReferenceFile(null);
      setDesignPrompt(DEFAULT_DESIGN_PROMPT);
      setDesignPreviewUri(null);
      setDesignGeneratedBase64(null);
      setDesignGeneratedMimeType('image/jpeg');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo guardar la foto de diseño.');
    } finally {
      setDesignSaving(false);
    }
  };

  useEffect(() => {
    const toLoad = selectedCampaignProducts.filter((item) => visibleProductIds.has(item.productId));

    toLoad.forEach((item) => {
      if (!photosCacheRef.current[item.productId]) {
        void loadProductPhotos(item.productId);
      }
    });
  }, [selectedCampaignProducts, visibleProductIds, loadProductPhotos]);



  const openEditCampaignModal = () => {
    if (!selectedCampaign) {
      return;
    }

    setEditingCampaign(selectedCampaign);
    setCampaignForm({
      name: selectedCampaign.name || '',
      description: selectedCampaign.description || '',
      startDate: selectedCampaign.startDate || '',
      endDate: selectedCampaign.endDate || '',
      notes: selectedCampaign.notes || '',
    });
    setCampaignFormVisible(true);
  };

  const handleSaveCampaign = async () => {
    if (!campaignForm.name.trim()) {
      Alert.alert('Validación', 'El nombre de campaña es obligatorio');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        name: campaignForm.name.trim(),
        description: campaignForm.description.trim() || undefined,
        startDate: campaignForm.startDate.trim() || undefined,
        endDate: campaignForm.endDate.trim() || undefined,
        notes: campaignForm.notes.trim() || undefined,
      };

      if (editingCampaign?.id) {
        await photoCampaignsApi.updateCampaign(editingCampaign.id, payload);
      } else {
        await photoCampaignsApi.createCampaign(payload);
      }

      setCampaignFormVisible(false);
      setCampaignForm(emptyCampaignForm);
      await loadCampaigns();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo guardar la campaña');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCampaign = () => {
    if (!selectedCampaign) {
      return;
    }

    Alert.alert(
      'Eliminar campaña',
      `¿Seguro que deseas eliminar ${selectedCampaign.code}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              await photoCampaignsApi.deleteCampaign(selectedCampaign.id);

              const campaignsAfterDelete = campaigns.filter((c) => c.id !== selectedCampaign.id);
              setCampaigns(campaignsAfterDelete);
              setSelectedCampaign(campaignsAfterDelete[0] || null);
              setSelectedCampaignProducts([]);
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'No se pudo eliminar la campaña');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteCampaignProduct = (item: PhotoCampaignProductItem) => {
    if (!selectedCampaign) {
      return;
    }

    Alert.alert(
      'Eliminar producto',
      `¿Quitar ${item.product?.title || item.productId} de la campaña?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              await photoCampaignsApi.removeCampaignProduct(selectedCampaign.id, item.id);
              await loadCampaignProducts(selectedCampaign.id);
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'No se pudo eliminar el producto');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const isUuid = (value?: string) =>
    !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const getWhatsappContactUuid = (contact: PhotoCampaignWhatsappContact): string => {
    const directCandidates = [
      contact.id,
      (contact as any).contactId,
      (contact as any).whatsappContactId,
      (contact as any).uuid,
    ].filter(Boolean) as string[];

    const directMatch = directCandidates.find((candidate) => isUuid(candidate));
    if (directMatch) {
      return directMatch;
    }

    const allValues = Object.values(contact || {}).filter((v) => typeof v === 'string') as string[];
    return allValues.find((candidate) => isUuid(candidate)) || '';
  };

  const toggleWhatsappProduct = (productId: string) => {
    setWhatsappSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleWhatsappPhotoType = (photoType: PhotoType) => {
    setWhatsappSelectedPhotoTypes((prev) => {
      const next = new Set(prev);
      if (next.has(photoType)) {
        next.delete(photoType);
      } else {
        next.add(photoType);
      }
      return next;
    });
  };

  const openWhatsappModal = async () => {
    if (!selectedCampaign?.id) {
      return;
    }

    try {
      setWhatsappContactsLoading(true);
      const contacts = await photoCampaignsApi.getCampaignWhatsappContacts(selectedCampaign.id);
      setWhatsappContacts(contacts || []);
      setWhatsappContactId(getWhatsappContactUuid((contacts || [])[0] as any) || '');
      setWhatsappSendAll(true);
      setWhatsappSelectedProductIds(new Set());
      setWhatsappSelectedPhotoTypes(new Set());
      setWhatsappCaption('');
      setWhatsappProductSearchQuery('');
      setWhatsappModalVisible(true);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudieron cargar los contactos de WhatsApp.');
    } finally {
      setWhatsappContactsLoading(false);
    }
  };

  const handleSendWhatsapp = async () => {
    if (!selectedCampaign?.id) {
      return;
    }

    if (!whatsappContactId) {
      Alert.alert('Validación', 'Selecciona un contacto destino.');
      return;
    }

    if (!isUuid(whatsappContactId)) {
      Alert.alert('Validación', 'El contacto seleccionado no tiene un UUID válido.');
      return;
    }

    if (!whatsappSendAll && whatsappSelectedProductIds.size === 0) {
      Alert.alert('Validación', 'Selecciona al menos un producto o cambia a "Todos".');
      return;
    }

    const selectedProductIds = Array.from(whatsappSelectedProductIds);

    const selectedItems = selectedCampaignProducts.filter(
      (item) => whatsappSendAll || selectedProductIds.includes(item.productId)
    );

    const productsWithoutLoadedPhotos = selectedItems.filter(
      (item) => !photosCacheRef.current[item.productId] && !photoLoadingByProduct[item.productId]
    );

    if (productsWithoutLoadedPhotos.length > 0) {
      await Promise.all(productsWithoutLoadedPhotos.map((item) => loadProductPhotos(item.productId)));
    }

    const selectedAssets = selectedItems.flatMap((item) => {
      const assets = photosCacheRef.current[item.productId] || photosByProduct[item.productId] || [];
      return assets.filter((asset) => asset.isActive);
    });

    const selectedPhotoTypes = Array.from(new Set(Array.from(whatsappSelectedPhotoTypes)));
    const filteredAssets =
      selectedPhotoTypes.length > 0
        ? selectedAssets.filter((asset) => selectedPhotoTypes.includes(asset.photoType))
        : selectedAssets;

    const photoAssetIds = Array.from(new Set(filteredAssets.map((asset) => asset.id)));

    if (!whatsappSendAll && photoAssetIds.length === 0) {
      Alert.alert('Validación', 'Cuando no envías todos, debes seleccionar productos con fotos disponibles.');
      return;
    }

    try {
      setWhatsappSubmitting(true);
      await photoCampaignsApi.sendCampaignPhotosWhatsapp(selectedCampaign.id, {
        contactId: whatsappContactId,
        sendAll: whatsappSendAll,
        photoAssetIds: whatsappSendAll ? [] : photoAssetIds,
        photoTypes: selectedPhotoTypes.length > 0 ? selectedPhotoTypes : undefined,
        caption: whatsappCaption.trim() || undefined,
      });

      Alert.alert('Éxito', 'Fotos enviadas por WhatsApp correctamente.');
      setWhatsappModalVisible(false);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo enviar las fotos por WhatsApp.');
    } finally {
      setWhatsappSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={theme.color.brand.accent} />
          <Text style={styles.loaderText}>Cargando campañas de fotos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={theme.motion.activeOpacity.medium}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gestión de Campaña de Fotos</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mainContent}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                {selectedCampaign ? selectedCampaign.name : 'Selecciona una campaña'}
              </Text>
              {!!selectedCampaign && (
                <Text style={styles.sectionSubtitle}>{selectedCampaign.code}</Text>
              )}
            </View>

            {!!selectedCampaign && (
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={openEditCampaignModal}
                  disabled={submitting}
                >
                  <Text style={styles.secondaryButtonText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dangerButton}
                  onPress={handleDeleteCampaign}
                  disabled={submitting}
                >
                  <Text style={styles.dangerButtonText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.productsToolbar}>
            <TextInput
              style={[styles.searchInput, styles.productsFilterInput]}
              value={productSearchQuery}
              onChangeText={handleCampaignProductsSearchChange}
              onFocus={() => {
                if (productSearchQuery.trim().length > 0) {
                  setShowCampaignSearchSuggestions(true);
                }
              }}
              placeholder="Buscar producto de campaña por SKU, nombre o descripción..."
              placeholderTextColor={theme.color.text.placeholder}
            />
          </View>

          {showCampaignSearchSuggestions && (
            <View style={styles.suggestionsContainerInline}>
              {campaignSearchLoading ? (
                <View style={styles.suggestionsLoadingWrap}>
                  <ActivityIndicator size="small" color={theme.color.brand.accent} />
                  <Text style={styles.suggestionsLoadingText}>Buscando productos...</Text>
                </View>
              ) : campaignSearchResults.length > 0 ? (
                <ScrollView
                  style={styles.suggestionsList}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {campaignSearchResults.slice(0, 10).map((product) => (
                    <TouchableOpacity
                      key={product.id}
                      style={styles.searchResultItem}
                      onPress={async () => {
                        if (!selectedCampaign?.id) {
                          return;
                        }

                        try {
                          setSubmitting(true);
                          await photoCampaignsApi.addCampaignProduct(selectedCampaign.id, { productId: product.id });
                          await loadCampaignProducts(selectedCampaign.id);
                          setShowCampaignSearchSuggestions(false);
                        } catch (error: any) {
                          Alert.alert('Error', error?.message || 'No se pudo agregar el producto');
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                    >
                      <Text style={styles.searchResultTitle}>{product.title}</Text>
                      <Text style={styles.searchResultMeta}>SKU: {product.sku}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.emptySuggestionsText}>
                  {productSearchQuery.trim().length < 2
                    ? 'Escribe al menos 2 caracteres'
                    : 'No se encontraron productos'}
                </Text>
              )}
            </View>
          )}

          <FlatList
            style={styles.productsList}
            data={filteredCampaignProducts}
            keyExtractor={(item) => item.id}
            initialNumToRender={14}
            maxToRenderPerBatch={20}
            windowSize={9}
            removeClippedSubviews
            onViewableItemsChanged={({ viewableItems }) => {
              const ids = viewableItems
                .map((v) => (v.item as PhotoCampaignProductItem | undefined)?.productId)
                .filter((id): id is string => !!id);

              setVisibleProductIds(new Set(ids));
            }}
            renderItem={({ item }) => {
              const completion = getPhotoCompletion(item.productId);
              const isLoadingPhotos = photoLoadingByProduct[item.productId];

              return (
                <View style={styles.productItemCard}>
                    <View style={styles.productHeaderRow}>
                    <View style={styles.productItemMain}>
                      <Text style={styles.productTitle}>{item.product?.title || item.productId}</Text>
                      <Text style={styles.productMeta}>SKU: {item.product?.sku || '-'}</Text>
                      {!!item.notes && <Text style={styles.productMeta}>Nota: {item.notes}</Text>}
                      {typeof item.sortOrder === 'number' && (
                        <Text style={styles.productMeta}>Orden: {item.sortOrder}</Text>
                      )}
                      <Text style={styles.photoCompletionText}>Completitud fotos: {completion}/3</Text>
                    </View>

                    <View style={styles.itemActions}>
                    <TouchableOpacity
                      style={styles.dangerButton}
                      onPress={() => handleDeleteCampaignProduct(item)}
                      disabled={submitting}
                    >
                      <Text style={styles.dangerButtonText}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                  </View>

                  {(() => {
                    const referencePhoto = getPhotoByType(item.productId, 'reference');
                    const designPhoto = getPhotoByType(item.productId, 'design');
                    const pricePhoto = getPhotoByType(item.productId, 'price');

                    const referenceUploading = photoUploadingKey === `${item.productId}:reference`;

                    return (
                      <>
                        <View style={styles.referenceDesignHeaderRow}>
                          <TouchableOpacity
                            style={styles.geminiGenerateButton}
                            onPress={() => void openDesignModal(item)}
                            disabled={submitting}
                          >
                            <Text style={styles.geminiGenerateButtonText}>Generar diseño</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.priceDesignButton}
                            onPress={() => void openPricePhotoModal(item)}
                            disabled={submitting}
                          >
                            <Text style={styles.priceDesignButtonText}>Agregar datos</Text>
                          </TouchableOpacity>
                        </View>

                        <View style={styles.photoTypesRow}>
                          <View style={styles.photoTypeCard}>
                            <Text style={styles.photoTypeLabel}>Referencia</Text>
                            {referencePhoto ? (
                              <TouchableOpacity
                                onPress={() => openImageViewer(referencePhoto.fileUrl, 'Referencia')}
                                activeOpacity={0.9}
                                style={styles.photoTouchArea}
                              >
                                <Image source={{ uri: referencePhoto.fileUrl }} style={styles.photoThumb} resizeMode="cover" />
                              </TouchableOpacity>
                            ) : (
                              <View style={styles.photoMissingBox}>
                                <Text style={styles.photoMissingText}>Sin foto</Text>
                              </View>
                            )}
                            <TouchableOpacity
                              onPress={() => void pickAndUploadPhoto(item, 'reference')}
                              disabled={referenceUploading || submitting}
                            >
                              {referenceUploading ? (
                                <ActivityIndicator size="small" color={theme.color.brand.accent} style={styles.photoActionIndicator} />
                              ) : (
                                <Text style={styles.photoActionText}>{referencePhoto ? 'Reemplazar' : 'Subir'}</Text>
                              )}
                            </TouchableOpacity>
                          </View>

                          <View style={styles.photoTypeCard}>
                            <Text style={styles.photoTypeLabel}>Diseño</Text>
                            {designPhoto ? (
                              <TouchableOpacity
                                onPress={() => openImageViewer(designPhoto.fileUrl, 'Diseño')}
                                activeOpacity={0.9}
                                style={styles.photoTouchArea}
                              >
                                <Image source={{ uri: designPhoto.fileUrl }} style={styles.photoThumb} resizeMode="cover" />
                              </TouchableOpacity>
                            ) : (
                              <View style={styles.photoMissingBox}>
                                <Text style={styles.photoMissingText}>Generar con Gemini</Text>
                              </View>
                            )}
                            <Text style={styles.photoActionTextMuted}>Se genera desde referencia</Text>
                          </View>

                          <View style={styles.photoTypeCard}>
                            <Text style={styles.photoTypeLabel}>Con precio</Text>
                            {pricePhoto ? (
                              <TouchableOpacity
                                onPress={() => openImageViewer(pricePhoto.fileUrl, 'Con precio')}
                                activeOpacity={0.9}
                                style={styles.photoTouchArea}
                              >
                                <Image source={{ uri: pricePhoto.fileUrl }} style={styles.photoThumb} resizeMode="cover" />
                              </TouchableOpacity>
                            ) : (
                              <View style={styles.photoMissingBox}>
                                <Text style={styles.photoMissingText}>Paso específico</Text>
                              </View>
                            )}
                            <Text style={styles.photoActionTextMuted}>Se llena en flujo específico</Text>
                          </View>
                        </View>
                      </>
                    );
                  })()}

                  {isLoadingPhotos && (
                    <View style={styles.inlineLoadingRow}>
                      <ActivityIndicator size="small" color={theme.color.brand.accent} />
                      <Text style={styles.inlineLoadingText}>Cargando fotos...</Text>
                    </View>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              selectedCampaign ? <Text style={styles.emptyText}>No hay productos en esta campaña</Text> : null
            }
          />
      </View>

      {!!selectedCampaign && (
        <ProtectedFAB
          actions={[
            {
              icon: 'logo-whatsapp',
              label: 'Enviar por WhatsApp',
              onPress: () => void openWhatsappModal(),
              requiredPermissions: [PERMISSIONS.PHOTO_CAMPAIGNS.UPDATE],
            },
          ]}
        />
      )}

      <Modal visible={whatsappModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.whatsappModalCard]}>
            <Text style={styles.modalTitle}>Enviar fotos por WhatsApp</Text>
            <Text style={styles.geminiModalSubtitle}>
              Campaña: {selectedCampaign?.name || '-'}
            </Text>

            <ScrollView
              style={styles.whatsappBodyScroll}
              contentContainerStyle={styles.whatsappBodyScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.inputLabel}>Contacto destino</Text>
              {whatsappContactsLoading ? (
                <View style={styles.inlineLoadingRow}>
                  <ActivityIndicator size="small" color={theme.color.brand.accent} />
                  <Text style={styles.inlineLoadingText}>Cargando contactos...</Text>
                </View>
              ) : (
                <View style={styles.templateRowWrap}>
                  {whatsappContacts.map((contact) => {
                    const resolvedContactId = getWhatsappContactUuid(contact);
                    const selected = whatsappContactId === resolvedContactId;
                    const label =
                      contact.name ||
                      (contact as any).fullName ||
                      (contact as any).contactName ||
                      (contact as any).displayName ||
                      'Contacto sin nombre';
                    return (
                      <TouchableOpacity
                        key={contact.id}
                        style={[styles.templateChip, selected && styles.templateChipSelected]}
                        onPress={() => setWhatsappContactId(resolvedContactId)}
                        disabled={!resolvedContactId}
                      >
                        <Text style={[styles.templateChipText, selected && styles.templateChipTextSelected]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={styles.inputLabel}>Productos a enviar</Text>
              <View style={styles.switchRow}>
                <TouchableOpacity
                  style={[styles.templateChip, whatsappSendAll && styles.templateChipSelected]}
                  onPress={() => setWhatsappSendAll(true)}
                >
                  <Text style={[styles.templateChipText, whatsappSendAll && styles.templateChipTextSelected]}>
                    Todos
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.templateChip, !whatsappSendAll && styles.templateChipSelected]}
                  onPress={() => setWhatsappSendAll(false)}
                >
                  <Text style={[styles.templateChipText, !whatsappSendAll && styles.templateChipTextSelected]}>
                    Seleccionar
                  </Text>
                </TouchableOpacity>
              </View>

              {!whatsappSendAll && (
                <>
                  <TextInput
                    style={styles.input}
                    value={whatsappProductSearchQuery}
                    onChangeText={setWhatsappProductSearchQuery}
                    placeholder="Buscar producto por nombre o SKU"
                    placeholderTextColor={theme.color.text.placeholder}
                  />
                  <ScrollView style={styles.whatsappProductsList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {selectedCampaignProducts
                      .filter((item) => {
                        const query = whatsappProductSearchQuery.trim().toLowerCase();
                        if (!query) {
                          return true;
                        }
                        const haystack = `${item.product?.title || ''} ${item.product?.sku || ''}`.toLowerCase();
                        return haystack.includes(query);
                      })
                      .map((item) => {
                        const selected = whatsappSelectedProductIds.has(item.productId);
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.whatsappProductRow, selected && styles.whatsappProductRowSelected]}
                            onPress={() => toggleWhatsappProduct(item.productId)}
                          >
                            <Text style={styles.whatsappProductTitle}>{item.product?.title || item.productId}</Text>
                            <Text style={styles.whatsappProductMeta}>SKU: {item.product?.sku || '-'}</Text>
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                </>
              )}

              <Text style={styles.inputLabel}>Tipo de foto</Text>
              <View style={styles.templateRowWrap}>
                {(Object.keys(PHOTO_TYPE_LABELS) as PhotoType[]).map((photoType) => {
                  const selected = whatsappSelectedPhotoTypes.has(photoType);
                  return (
                    <TouchableOpacity
                      key={photoType}
                      style={[styles.templateChip, selected && styles.templateChipSelected]}
                      onPress={() => toggleWhatsappPhotoType(photoType)}
                    >
                      <Text style={[styles.templateChipText, selected && styles.templateChipTextSelected]}>
                        {PHOTO_TYPE_LABELS[photoType]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>Mensaje (opcional)</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                multiline
                value={whatsappCaption}
                onChangeText={setWhatsappCaption}
                placeholder="Ej: Hola, te compartimos las fotos de la campaña"
                placeholderTextColor={theme.color.text.placeholder}
              />
            </ScrollView>

            <View style={styles.whatsappModalFooter}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setWhatsappModalVisible(false)}
                disabled={whatsappSubmitting}
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.whatsappButton}
                onPress={() => void handleSendWhatsapp()}
                disabled={whatsappSubmitting || !whatsappContactId}
              >
                <Text style={styles.whatsappButtonText}>
                  {whatsappSubmitting ? 'Enviando...' : 'Enviar WhatsApp'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={campaignFormVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingCampaign ? 'Editar campaña' : 'Nueva campaña'}
            </Text>

            <Text style={styles.inputLabel}>Nombre *</Text>
            <TextInput
              style={styles.input}
              value={campaignForm.name}
              onChangeText={(value) => setCampaignForm((prev) => ({ ...prev, name: value }))}
              placeholder="Nombre *"
              placeholderTextColor={theme.color.text.placeholder}
            />
            <Text style={styles.inputLabel}>Descripción</Text>
            <TextInput
              style={styles.input}
              value={campaignForm.description}
              onChangeText={(value) => setCampaignForm((prev) => ({ ...prev, description: value }))}
              placeholder="Descripción"
              placeholderTextColor={theme.color.text.placeholder}
            />
            <Text style={styles.inputLabel}>Fecha inicio</Text>
            <TextInput
              style={styles.input}
              value={campaignForm.startDate}
              onChangeText={(value) => setCampaignForm((prev) => ({ ...prev, startDate: value }))}
              placeholder="Fecha inicio (YYYY-MM-DD)"
              placeholderTextColor={theme.color.text.placeholder}
            />
            <Text style={styles.inputLabel}>Fecha fin</Text>
            <TextInput
              style={styles.input}
              value={campaignForm.endDate}
              onChangeText={(value) => setCampaignForm((prev) => ({ ...prev, endDate: value }))}
              placeholder="Fecha fin (YYYY-MM-DD)"
              placeholderTextColor={theme.color.text.placeholder}
            />
            <Text style={styles.inputLabel}>Notas</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              value={campaignForm.notes}
              onChangeText={(value) => setCampaignForm((prev) => ({ ...prev, notes: value }))}
              placeholder="Notas"
              placeholderTextColor={theme.color.text.placeholder}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setCampaignFormVisible(false)}
                disabled={submitting}
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveCampaign}
                disabled={submitting}
              >
                <Text style={styles.primaryButtonText}>{submitting ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={designModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Crear foto de diseño con Gemini</Text>
              <Text style={styles.geminiModalSubtitle}>
                Producto: {designTargetItem?.product?.title || designTargetItem?.productId || '-'}
              </Text>

              <Text style={styles.inputLabel}>Prompt de diseño</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                multiline
                value={designPrompt}
                onChangeText={setDesignPrompt}
                placeholder="Describe cómo quieres generar la foto de diseño..."
                placeholderTextColor={theme.color.text.placeholder}
              />

              <View style={styles.geminiModalActionsTop}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => void handleGenerateDesignWithGemini()}
                  disabled={designGenerating || designSaving}
                >
                  <Text style={styles.primaryButtonText}>
                    {designGenerating ? 'Generando...' : 'Generar con Gemini'}
                  </Text>
                </TouchableOpacity>
              </View>

              {designPreviewUri ? (
                <Image source={{ uri: designPreviewUri }} style={styles.geminiPreviewImage} resizeMode="cover" />
              ) : (
                <View style={styles.geminiPreviewPlaceholder}>
                  <Text style={styles.photoMissingText}>Aquí verás la vista previa del diseño</Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setDesignModalVisible(false);
                    setDesignTargetItem(null);
                    setDesignReferenceFile(null);
                    setDesignPrompt(DEFAULT_DESIGN_PROMPT);
                    setDesignPreviewUri(null);
                    setDesignGeneratedBase64(null);
                    setDesignGeneratedMimeType('image/jpeg');
                  }}
                  disabled={designGenerating || designSaving}
                >
                  <Text style={styles.secondaryButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => void handleAcceptGeneratedDesign()}
                  disabled={!designPreviewUri || designGenerating || designSaving}
                >
                  <Text style={styles.primaryButtonText}>{designSaving ? 'Guardando...' : 'Aceptar y guardar'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={pricePhotoModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Diseño con precio</Text>
              <Text style={styles.geminiModalSubtitle}>
                Producto: {pricePhotoTargetItem?.product?.title || pricePhotoTargetItem?.productId || '-'}
              </Text>

              <Text style={styles.inputLabel}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={pricePhotoForm.name}
                onChangeText={(value) => setPricePhotoForm((prev) => ({ ...prev, name: value }))}
                placeholder="Nombre"
                placeholderTextColor={theme.color.text.placeholder}
              />
              <Text style={styles.inputLabel}>SKU</Text>
              <TextInput
                style={styles.input}
                value={pricePhotoForm.sku}
                onChangeText={(value) => setPricePhotoForm((prev) => ({ ...prev, sku: value }))}
                placeholder="SKU"
                placeholderTextColor={theme.color.text.placeholder}
              />
              <Text style={styles.inputLabel}>Perfil de precio</Text>
              {priceProfilesLoading ? (
                <View style={styles.inlineLoadingRow}>
                  <ActivityIndicator size="small" color={theme.color.brand.accent} />
                  <Text style={styles.inlineLoadingText}>Cargando perfiles...</Text>
                </View>
              ) : (
                <View style={styles.templateRow}>
                  {priceProfiles.map((profile) => {
                    const selected = pricePhotoForm.profileId === profile.id;
                    return (
                      <TouchableOpacity
                        key={profile.id}
                        style={[styles.templateChip, selected && styles.templateChipSelected]}
                        onPress={() => {
                          const matchedPrice = priceSalePrices.find(
                            (sp) => sp.profileId === profile.id && sp.presentationId === null
                          );
                          setPricePhotoForm((prev) => ({
                            ...prev,
                            profileId: profile.id,
                            price: matchedPrice ? (matchedPrice.priceCents / 100).toFixed(2) : prev.price,
                          }));
                        }}
                      >
                        <Text style={[styles.templateChipText, selected && styles.templateChipTextSelected]}>
                          {profile.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={styles.inputLabel}>Precio</Text>
              <TextInput
                style={styles.input}
                value={pricePhotoForm.price}
                keyboardType="numeric"
                onChangeText={(value) => setPricePhotoForm((prev) => ({ ...prev, price: value }))}
                placeholder="Precio"
                placeholderTextColor={theme.color.text.placeholder}
              />

              <Text style={styles.inputLabel}>Template</Text>
              <View style={styles.templateRow}>
                {(['promo', 'premium', 'minimal'] as AdDesignTemplate[]).map((templateKey) => {
                  const selected = pricePhotoForm.template === templateKey;
                  return (
                    <TouchableOpacity
                      key={templateKey}
                      style={[styles.templateChip, selected && styles.templateChipSelected]}
                      onPress={() => setPricePhotoForm((prev) => ({ ...prev, template: templateKey }))}
                    >
                      <Text style={[styles.templateChipText, selected && styles.templateChipTextSelected]}>
                        {templateKey}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.geminiModalActionsTop}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => void handlePreviewPricePhoto()}
                  disabled={pricePhotoGenerating || pricePhotoSaving}
                >
                  <Text style={styles.primaryButtonText}>
                    {pricePhotoGenerating ? 'Previsualizando...' : 'Previsualizar'}
                  </Text>
                </TouchableOpacity>
              </View>

              {pricePhotoPreviewUri ? (
                <TouchableOpacity onPress={() => openImageViewer(pricePhotoPreviewUri, 'Vista previa con precio')} activeOpacity={0.9}>
                  <Image source={{ uri: pricePhotoPreviewUri }} style={styles.geminiPreviewImage} resizeMode="cover" />
                </TouchableOpacity>
              ) : (
                <View style={styles.geminiPreviewPlaceholder}>
                  <Text style={styles.photoMissingText}>Genera vista previa para continuar</Text>
                </View>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setPricePhotoModalVisible(false);
                    setPricePhotoTargetItem(null);
                    setPricePhotoPreviewUri(null);
                    setPricePhotoHasGeneratedPreview(false);
                    setPricePhotoForm(defaultPricePhotoForm);
                    setPriceProfiles([]);
                    setPriceSalePrices([]);
                    setPricePhotoDesignBaseUri(null);
                    setPricePhotoDesignBaseMimeType('image/jpeg');
                  }}
                  disabled={pricePhotoGenerating || pricePhotoSaving}
                >
                  <Text style={styles.secondaryButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => void handleSavePricePhoto()}
                  disabled={!pricePhotoHasGeneratedPreview || pricePhotoGenerating || pricePhotoSaving}
                >
                  <Text style={styles.primaryButtonText}>{pricePhotoSaving ? 'Guardando...' : 'Guardar foto con precio'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={imageViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          resetImageViewerTransform();
          setImageViewerVisible(false);
        }}
      >
        <View style={styles.imageViewerBackdrop}>
          <View style={styles.imageViewerHeader}>
            <Text style={styles.imageViewerTitle}>{imageViewerTitle}</Text>
            <TouchableOpacity
              style={styles.imageViewerCloseButton}
              onPress={() => {
                resetImageViewerTransform();
                setImageViewerVisible(false);
              }}
            >
              <Text style={styles.imageViewerCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>

          <GestureHandlerRootView style={styles.imageViewerContent}>
            <GestureDetector gesture={imageViewerGesture}>
              <Animated.View style={styles.imageViewerImageWrap}>
                {imageViewerUri ? (
                  <Animated.Image
                    source={{ uri: imageViewerUri }}
                    style={[styles.imageViewerImage, imageViewerAnimatedStyle]}
                    resizeMode="contain"
                  />
                ) : null}
              </Animated.View>
            </GestureDetector>
          </GestureHandlerRootView>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: theme.space[3],
    color: theme.color.text.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[3],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 22,
    color: theme.color.text.body,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: theme.space[2],
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.body,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  mainContent: {
    flex: 1,
    backgroundColor: theme.color.surface.base,
    padding: theme.space[3],
  },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.background.subtle,
    color: theme.color.text.body,
    paddingHorizontal: theme.space[2.5],
    paddingVertical: theme.space[2],
    marginBottom: theme.space[2.5],
  },
  inputLabel: {
    marginTop: theme.space[0.5],
    marginBottom: theme.space[1.5],
    color: theme.color.text.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  productsFilterInput: {
    flex: 1,
    marginBottom: 0,
  },
  campaignList: {
    flex: 1,
  },
  campaignCard: {
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: theme.color.surface.base,
  },
  campaignCardSelected: {
    borderColor: theme.color.brand.accent,
    backgroundColor: theme.color.brand.accentSoft,
  },
  campaignCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  campaignCode: {
    fontSize: 12,
    color: theme.color.text.muted,
    fontWeight: '700',
  },
  campaignStatus: {
    fontSize: 12,
    color: theme.color.brand.accent,
    fontWeight: '700',
  },
  campaignName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  campaignDescription: {
    marginTop: 4,
    color: theme.color.text.muted,
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  sectionSubtitle: {
    marginTop: 2,
    color: theme.color.text.muted,
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  productsToolbar: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  floatingActionsContainer: {
    position: 'absolute',
    right: 20,
    bottom: 130,
    zIndex: 999,
    alignItems: 'flex-end',
    gap: 10,
  },
  floatingSecondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: theme.color.brand.accent,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  floatingSecondaryButtonText: {
    color: theme.color.text.onAction,
    fontWeight: '700',
    fontSize: 12,
  },
  floatingWhatsappButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: theme.color.state.success.background,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  floatingWhatsappButtonText: {
    color: theme.color.state.success.text,
    fontWeight: '700',
    fontSize: 12,
  },
  productsList: {
    flex: 1,
    marginTop: 8,
  },
  productItemCard: {
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: theme.radii.lg,
    padding: theme.space[2.5],
    marginBottom: theme.space[2],
    backgroundColor: theme.color.surface.base,
    ...theme.shadow.sm,
  },
  productHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  productItemMain: {
    flex: 1,
  },
  productTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 4,
  },
  productMeta: {
    color: theme.color.text.muted,
    fontSize: 12,
  },
  photoCompletionText: {
    marginTop: 6,
    color: theme.color.brand.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  itemActions: {
    justifyContent: 'center',
    gap: 6,
  },
  referenceDesignHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  photoTypesRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    alignItems: 'center',
  },
  photoTypeCard: {
    flex: 1,
    minWidth: 145,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: 8,
    backgroundColor: theme.color.background.subtle,
    padding: 10,
    alignItems: 'center',
  },
  photoTouchArea: {
    width: '100%',
  },
  geminiGenerateButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.color.brand.accentSoft,
    borderWidth: 1,
    borderColor: theme.color.state.info.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 130,
  },
  geminiGenerateButtonText: {
    textAlign: 'center',
    color: theme.color.brand.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  priceDesignButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.color.state.success.background,
    borderWidth: 1,
    borderColor: theme.color.state.success.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 120,
  },
  priceDesignButtonText: {
    textAlign: 'center',
    color: theme.color.state.success.text,
    fontWeight: '700',
    fontSize: 12,
  },
  photoTypeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.text.muted,
    marginBottom: 6,
  },
  photoThumb: {
    width: '100%',
    aspectRatio: 1.35,
    borderRadius: 6,
    backgroundColor: theme.color.border.subtle,
  },
  photoMissingBox: {
    width: '100%',
    aspectRatio: 1.35,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.color.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface.base,
  },
  photoMissingText: {
    color: theme.color.text.placeholder,
    fontSize: 11,
    fontWeight: '600',
  },
  photoActionText: {
    marginTop: 6,
    color: theme.color.brand.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  photoActionTextMuted: {
    marginTop: 6,
    color: theme.color.text.subtle,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  photoActionIndicator: {
    marginTop: 6,
  },
  inlineLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  inlineLoadingText: {
    fontSize: 12,
    color: theme.color.text.subtle,
  },
  primaryButton: {
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: theme.color.text.inverse,
    fontWeight: '700',
    fontSize: 12,
  },
  secondaryButton: {
    paddingVertical: theme.space[2],
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: theme.color.text.body,
    fontWeight: '700',
    fontSize: 12,
  },
  dangerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.color.state.danger.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: theme.color.state.danger.text,
    fontWeight: '700',
    fontSize: 12,
  },
  whatsappButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.color.state.success.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappButtonText: {
    color: theme.color.state.success.text,
    fontWeight: '700',
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.color.text.subtle,
    marginTop: theme.space[4],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.color.overlay.medium,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 560,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.surface.base,
    padding: theme.space[3.5],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    ...theme.shadow.md,
  },
  modalScroll: {
    width: '100%',
  },
  modalScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 10,
  },
  whatsappModalCard: {
    maxHeight: '85%',
    paddingBottom: 0,
  },
  whatsappBodyScroll: {
    maxHeight: 520,
  },
  whatsappBodyScrollContent: {
    paddingBottom: 12,
  },
  whatsappProductsList: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: theme.color.background.subtle,
  },
  whatsappProductRow: {
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  whatsappProductRowSelected: {
    backgroundColor: theme.color.brand.accentSoft,
  },
  whatsappProductTitle: {
    color: theme.color.text.heading,
    fontSize: 12,
    fontWeight: '600',
  },
  whatsappProductMeta: {
    color: theme.color.text.subtle,
    fontSize: 11,
    marginTop: 2,
  },
  whatsappModalFooter: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    backgroundColor: theme.color.surface.base,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border.default,
    borderRadius: theme.radii.md,
    backgroundColor: theme.color.surface.base,
    color: theme.color.text.body,
    paddingHorizontal: theme.space[2.5],
    paddingVertical: theme.space[2],
    marginBottom: theme.space[2],
  },
  multiline: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  modalActions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  geminiModalSubtitle: {
    color: theme.color.text.muted,
    marginBottom: 8,
    fontSize: 12,
  },
  geminiModalActionsTop: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  templateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  templateRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  switchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  templateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.color.border.strong,
    backgroundColor: theme.color.background.subtle,
  },
  templateChipSelected: {
    borderColor: theme.color.brand.accent,
    backgroundColor: theme.color.brand.accentSoft,
  },
  templateChipText: {
    color: theme.color.text.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  templateChipTextSelected: {
    color: theme.color.text.link,
    fontWeight: '700',
  },
  geminiPreviewImage: {
    width: '100%',
    aspectRatio: 1.35,
    borderRadius: 8,
    backgroundColor: theme.color.border.subtle,
    marginBottom: 8,
  },
  geminiPreviewPlaceholder: {
    width: '100%',
    aspectRatio: 1.35,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.color.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface.base,
    marginBottom: 8,
  },
  inlineLoader: {
    marginBottom: 8,
  },
  suggestionsContainer: {
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: 8,
    backgroundColor: theme.color.surface.base,
    maxHeight: 240,
    marginBottom: 8,
  },
  suggestionsContainerInline: {
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    borderRadius: 8,
    backgroundColor: theme.color.surface.base,
    height: 180,
    marginBottom: 8,
    overflow: 'hidden',
  },
  suggestionsList: {
    flex: 1,
  },
  suggestionsLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  suggestionsLoadingText: {
    color: theme.color.text.subtle,
    fontSize: 12,
  },
  searchResultItem: {
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
    padding: 8,
    backgroundColor: theme.color.background.subtle,
  },
  searchResultTitle: {
    color: theme.color.text.heading,
    fontWeight: '600',
  },
  searchResultMeta: {
    marginTop: 2,
    fontSize: 12,
    color: theme.color.text.subtle,
  },
  emptySuggestionsText: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: theme.color.text.subtle,
    textAlign: 'center',
    fontSize: 12,
  },
  imageViewerBackdrop: {
    flex: 1,
    backgroundColor: theme.color.overlay.strong,
  },
  imageViewerHeader: {
    paddingTop: 44,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageViewerTitle: {
    color: theme.color.text.inverse,
    fontSize: 16,
    fontWeight: '700',
  },
  imageViewerCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: theme.color.brand.headerBadge,
  },
  imageViewerCloseText: {
    color: theme.color.text.inverse,
    fontWeight: '700',
    fontSize: 12,
  },
  imageViewerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerImageWrap: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },

});
