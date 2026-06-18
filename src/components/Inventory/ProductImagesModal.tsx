import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Share,
  Platform,
  TextInput,
} from 'react-native';
import { Product } from '@/services/api/products';

import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { filesApi } from '@/services/api/files';
import { productsApi } from '@/services/api/products';
import { priceProfilesApi } from '@/services/api/price-profiles';
import { googleLensApi, GoogleLensResult, GoogleLensPrice, ImageQualityAnalysis } from '@/services/api/google-lens';
import { validateImageFile } from '@/utils/fileHelpers';
import {
  launchImageLibraryAsync,
  launchCameraAsync,
  requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync,
  MediaTypeOptions
} from '@/utils/filePicker';

// Conditional imports for optional features
let ViewShot: any = null;
let FileSystem: any = null;
let Sharing: any = null;

try {
  ViewShot = require('react-native-view-shot').default;
} catch (e) {
  console.log('react-native-view-shot not installed');
}

try {
  FileSystem = require('expo-file-system/legacy');
} catch (e) {
  console.log('expo-file-system not installed');
}

try {
  Sharing = require('expo-sharing');
} catch (e) {
  console.log('expo-sharing not installed');
}

interface ProductImagesModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: Product;
}

interface ProductImage {
  filename: string;
  url: string;
  path: string;
}

export const ProductImagesModal: React.FC<ProductImagesModalProps> = ({
  visible,
  onClose,
  onSuccess,
  product,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  // Tab state
  const [activeTab, setActiveTab] = useState<'gallery' | 'lens' | 'promo'>('gallery');

  // Gallery tab states
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [newImages, setNewImages] = useState<
    Array<{ uri: string; filename: string; mimeType?: string }>
  >([]);

  // Google Lens tab states
  const [lensSearching, setLensSearching] = useState(false);
  const [lensResults, setLensResults] = useState<GoogleLensResult[]>([]);
  const [lensImageUrl, setLensImageUrl] = useState('');
  const [selectedLensImage, setSelectedLensImage] = useState<GoogleLensResult | null>(null);
  const [imageQuality, setImageQuality] = useState<ImageQualityAnalysis | null>(null);
  const [showQualityModal, setShowQualityModal] = useState(false);

  // Promo editor states
  const [generatingPromo, setGeneratingPromo] = useState(false);
  const [showPromoPreview, setShowPromoPreview] = useState(false);
  const [selectedImageForPromo, setSelectedImageForPromo] = useState<ProductImage | null>(null);
  const [salePrices, setSalePrices] = useState<any[]>([]);
  const [priceProfiles, setPriceProfiles] = useState<any[]>([]);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [imageScale, setImageScale] = useState(1);
  const [containerSize, setContainerSize] = useState(0);
  const viewShotRef = useRef<any>(null);

  // Load product images and prices when modal opens
  useEffect(() => {
    if (visible && product?.id) {
      loadProductImages();
      loadSalePrices();
    }
  }, [visible, product?.id]);

  const loadSalePrices = async () => {
    try {
      // Load both sale prices and profiles
      const [salePricesResponse, profilesResponse]: [any, any] = await Promise.all([
        priceProfilesApi.getProductSalePrices(product.id),
        priceProfilesApi.getActivePriceProfiles(),
      ]);

      const salePricesArray = salePricesResponse.salePrices || salePricesResponse.data || [];

      // Enrich sale prices with profile names
      const enrichedPrices = salePricesArray.map((price: any) => {
        const profile = profilesResponse.find((p: any) => p.id === price.profileId);
        return {
          ...price,
          profileName: profile?.name || price.profile?.name || 'Precio',
          profileCode: profile?.code || price.profile?.code || '',
        };
      });

      setSalePrices(enrichedPrices);
      setPriceProfiles(profilesResponse);
    } catch (error) {
      console.error('Error loading sale prices:', error);
      setSalePrices([]);
      setPriceProfiles([]);
    }
  };

  const loadProductImages = async () => {
    try {
      setLoading(true);
      console.log('📸 Loading images for product:', product.id);

      const response = await productsApi.getProductImages(product.id);

      if (response.success && response.images) {
        setProductImages(response.images);
        console.log(`✅ Loaded ${response.images.length} images for product ${product.id}`);
      } else {
        setProductImages([]);
      }
    } catch (error: any) {
      console.error('❌ Error loading product images:', error);
      Alert.alert('Error', 'No se pudieron cargar las imágenes del producto');
      setProductImages([]);
    } finally {
      setLoading(false);
    }
  };

  // Request camera roll permissions
  const requestPermissions = async () => {
    const { status } = await requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Requerido', 'Se necesita permiso para acceder a las fotos.');
      return false;
    }
    return true;
  };

  // Pick images from gallery
  const handlePickImages = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      return;
    }

    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 1,
      });

      if (!result.canceled && result.assets) {
        const selectedImages = result.assets.map((asset) => ({
          uri: asset.uri,
          filename: asset.fileName || asset.uri.split('/').pop() || `image_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
        }));

        // Validate images
        for (const img of selectedImages) {
          if (!validateImageFile(img.filename)) {
            Alert.alert('Error', `El archivo ${img.filename} no es una imagen válida`);
            return;
          }
        }

        setNewImages([...newImages, ...selectedImages]);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'No se pudieron seleccionar las imágenes');
    }
  };

  // Take photo with camera
  const handleTakePhoto = async () => {
    const { status } = await requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Requerido', 'Se necesita permiso para usar la cámara.');
      return;
    }

    try {
      const result = await launchCameraAsync({
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const newImage = {
          uri: asset.uri,
          filename: `photo_${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
        };

        setNewImages([...newImages, newImage]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  // Remove new image (not yet uploaded)
  const handleRemoveNewImage = (index: number) => {
    Alert.alert('Eliminar Imagen', '¿Estás seguro de que deseas eliminar esta imagen?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          const updatedImages = newImages.filter((_, i) => i !== index);
          setNewImages(updatedImages);
        },
      },
    ]);
  };

  // Delete existing image from server
  const handleDeleteImage = async (image: ProductImage) => {
    Alert.alert(
      'Eliminar Imagen',
      '¿Estás seguro de que deseas eliminar esta imagen del servidor?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(image.filename);
              console.log('🗑️ Deleting image:', image.filename);

              // DELETE /files/public/catalog/productos/imagenes/{productId}/{filename}
              const deletePath = `catalog/productos/imagenes/${product.id}/${image.filename}`;
              await filesApi.deletePublicFile(deletePath);

              console.log('✅ Image deleted successfully:', image.filename);

              // Reload images to verify deletion
              await loadProductImages();

              Alert.alert('Éxito', 'Imagen eliminada correctamente');
              onSuccess();
            } catch (error: any) {
              console.error('❌ Error deleting image:', error);
              Alert.alert('Error', error.message || 'No se pudo eliminar la imagen');
            } finally {
              setDeleting(null);
            }
          },
        },
      ]
    );
  };

  // Upload new images
  const handleUploadImages = async () => {
    if (newImages.length === 0) {
      Alert.alert('Info', 'No hay imágenes nuevas para subir');
      return;
    }

    try {
      setUploading(true);
      console.log(`📸 Uploading ${newImages.length} new images...`);

      // Upload each image individually
      const uploadPromises = newImages.map((img) =>
        filesApi.uploadProductImage(img.uri, product.id, img.filename, img.mimeType)
      );

      await Promise.all(uploadPromises);
      console.log(`✅ Uploaded ${newImages.length} images successfully`);

      // Clear new images and reload product images
      setNewImages([]);

      // Force reload with a small delay to ensure backend has processed the files
      setTimeout(async () => {
        await loadProductImages();
      }, 500);

      // Also reload immediately
      await loadProductImages();

      Alert.alert('Éxito', `${newImages.length} imagen(es) subida(s) correctamente`);
      onSuccess();
    } catch (error: any) {
      console.error('❌ Error uploading images:', error);
      Alert.alert('Error', error.message || 'No se pudieron subir las imágenes');
    } finally {
      setUploading(false);
    }
  };

  // Generate promotional image with prices
  const handleGeneratePromoImage = async (image: ProductImage) => {
    if (!ViewShot || !FileSystem || !Sharing) {
      Alert.alert(
        'Funcionalidad no disponible',
        'Para usar esta función, instala las dependencias:\n\nnpx expo install expo-file-system react-native-view-shot expo-sharing'
      );
      return;
    }

    if (salePrices.length === 0) {
      Alert.alert('Info', 'Este producto no tiene precios configurados');
      return;
    }

    // Calculate square size based on screen width
    const screenWidth = Dimensions.get('window').width;
    const size = Math.min(screenWidth - 80, 600); // Max 600px, with 80px padding
    setContainerSize(size);

    // Reset image position and scale
    setImagePosition({ x: 0, y: 0 });
    setImageScale(1);
    setSelectedImageForPromo(image);
    setShowPromoPreview(true);
  };

  const handleScaleChange = (value: number) => {
    setImageScale(value);
  };

  const handlePositionChange = (axis: 'x' | 'y', value: number) => {
    setImagePosition((prev) => ({
      ...prev,
      [axis]: value,
    }));
  };

  // Capture and save promotional image
  const handleSavePromoImage = async () => {
    if (!ViewShot || !FileSystem || !Sharing) {
      Alert.alert(
        'Error',
        'Dependencias no instaladas. Instala: expo-file-system, react-native-view-shot y expo-sharing'
      );
      return;
    }

    try {
      setGeneratingPromo(true);

      // Capture the view as image
      if (viewShotRef.current) {
        const uri = await viewShotRef.current.capture();

        // Create a permanent file path
        const fileName = `promo_${product.sku}_${Date.now()}.jpg`;
        const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

        // Copy the captured image to a permanent location
        await FileSystem.copyAsync({
          from: uri,
          to: fileUri,
        });

        console.log('📸 Promo image saved to:', fileUri);

        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          Alert.alert('Error', 'La función de compartir no está disponible en este dispositivo');
          return;
        }

        // Share the image file
        await Sharing.shareAsync(fileUri, {
          mimeType: 'image/jpeg',
          dialogTitle: `Imagen promocional de ${product.title}`,
          UTI: 'public.jpeg',
        });

        Alert.alert('Éxito', 'Imagen compartida. Puedes guardarla desde el menú de compartir.');
        setShowPromoPreview(false);
        setSelectedImageForPromo(null);
      }
    } catch (error: any) {
      console.error('Error generating promo image:', error);
      Alert.alert('Error', error.message || 'No se pudo generar la imagen promocional');
    } finally {
      setGeneratingPromo(false);
    }
  };

  const formatPrice = (priceCents: number, currency: string = 'PEN'): string => {
    const amount = priceCents / 100;
    const symbol = currency === 'PEN' ? 'S/' : currency === 'USD' ? '$' : currency;
    return `${symbol} ${amount.toFixed(2)}`;
  };

  const formatLensPrice = (price: string | GoogleLensPrice | undefined): string | null => {
    if (!price) return null;

    // If it's already a string, return it
    if (typeof price === 'string') {
      return price;
    }

    // If it's an object with value property
    if (typeof price === 'object' && 'value' in price) {
      return price.value;
    }

    return null;
  };

  // Google Lens functions
  const handleLensSearchByUpload = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setLensSearching(true);

        try {
          const response = await googleLensApi.searchByUpload(
            asset.uri,
            asset.fileName || 'search-image.jpg'
          );

          setLensResults([...response.results, ...response.visualMatches]);
          Alert.alert('Éxito', `Se encontraron ${response.results.length + response.visualMatches.length} resultados`);
        } catch (error: any) {
          console.error('Error searching with Google Lens:', error);
          Alert.alert('Error', error.message || 'No se pudo realizar la búsqueda');
        } finally {
          setLensSearching(false);
        }
      }
    } catch (error) {
      console.error('Error picking image for Lens:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    }
  };

  const handleLensSearchByUrl = async () => {
    if (!lensImageUrl.trim()) {
      Alert.alert('Error', 'Por favor ingresa una URL de imagen');
      return;
    }

    setLensSearching(true);
    try {
      const response = await googleLensApi.searchByUrl(lensImageUrl);
      setLensResults([...response.results, ...response.visualMatches]);
      Alert.alert('Éxito', `Se encontraron ${response.results.length + response.visualMatches.length} resultados`);
    } catch (error: any) {
      console.error('Error searching with Google Lens:', error);
      Alert.alert('Error', error.message || 'No se pudo realizar la búsqueda');
    } finally {
      setLensSearching(false);
    }
  };

  const handleLensSearchFromProductImage = async (image: ProductImage) => {
    setLensSearching(true);
    setActiveTab('lens');

    try {
      const response = await googleLensApi.searchByUrl(image.url);
      setLensResults([...response.results, ...response.visualMatches]);
      Alert.alert('Éxito', `Se encontraron ${response.results.length + response.visualMatches.length} resultados similares`);
    } catch (error: any) {
      console.error('Error searching with Google Lens:', error);
      Alert.alert('Error', error.message || 'No se pudo realizar la búsqueda');
    } finally {
      setLensSearching(false);
    }
  };

  const handleSelectLensImage = async (lensImage: GoogleLensResult) => {
    try {
      // Use the highest quality image available
      // Priority: originalImage > image > thumbnail
      const imageUri = lensImage.originalImage || lensImage.image || lensImage.thumbnail;

      console.log('📥 Selecting Lens image:', {
        thumbnail: lensImage.thumbnail,
        image: lensImage.image,
        originalImage: lensImage.originalImage,
        selected: imageUri,
      });

      // Add to new images
      const filename = `lens_${Date.now()}.jpg`;
      setNewImages([
        ...newImages,
        {
          uri: imageUri,
          filename,
          mimeType: 'image/jpeg',
        },
      ]);

      // Switch to gallery tab to show the new image
      setActiveTab('gallery');
      Alert.alert('Éxito', 'Imagen de alta calidad agregada. Puedes subirla desde la pestaña Galería');
    } catch (error: any) {
      console.error('Error adding Lens image:', error);
      Alert.alert('Error', error.message || 'No se pudo agregar la imagen');
    }
  };

  const handleAnalyzeImageQuality = async (imageUrl: string) => {
    try {
      setLensSearching(true);
      console.log('🔍 Analyzing image quality:', imageUrl);

      const quality = await googleLensApi.analyzeImageQuality(imageUrl);

      setImageQuality(quality);
      setShowQualityModal(true);
    } catch (error: any) {
      console.error('Error analyzing image quality:', error);
      Alert.alert('Error', error.message || 'No se pudo analizar la calidad de la imagen');
    } finally {
      setLensSearching(false);
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gestionar Imágenes</Text>
          <View style={styles.closeButton} />
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'gallery' && styles.tabActive]}
            onPress={() => setActiveTab('gallery')}
          >
            <Text style={[styles.tabText, activeTab === 'gallery' && styles.tabTextActive]}>
              📸 Galería
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'lens' && styles.tabActive]}
            onPress={() => setActiveTab('lens')}
          >
            <Text style={[styles.tabText, activeTab === 'lens' && styles.tabTextActive]}>
              🔍 Google Lens
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'promo' && styles.tabActive]}
            onPress={() => setActiveTab('promo')}
          >
            <Text style={[styles.tabText, activeTab === 'promo' && styles.tabTextActive]}>
              🎨 Editor Promo
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Product Info */}
          <View style={styles.productInfo}>
            <Text style={styles.productTitle}>{product.title}</Text>
            <Text style={styles.productSku}>SKU: {product.sku}</Text>
          </View>

          {/* Gallery Tab */}
          {activeTab === 'gallery' && (
            <>
              {/* Existing Images Section */}
              <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              📸 Imágenes del Producto ({productImages.length})
            </Text>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.color.brand.accent} />
                <Text style={styles.loadingText}>Cargando imágenes...</Text>
              </View>
            ) : productImages.length === 0 ? (
              <View style={styles.noImagesContainer}>
                <Text style={styles.noImagesText}>📦 No hay imágenes</Text>
                <Text style={styles.noImagesSubtext}>
                  Este producto no tiene imágenes guardadas
                </Text>
              </View>
            ) : (
              <View style={styles.imagesGrid}>
                {productImages.map((image, index) => (
                  <View key={image.filename} style={styles.imageCard}>
                    <Image source={{ uri: image.url }} style={styles.image} resizeMode="cover" />
                    {index === 0 && (
                      <View style={styles.mainImageBadge}>
                        <Text style={styles.mainImageBadgeText}>Principal</Text>
                      </View>
                    )}
                    <View style={styles.imageActions}>
                      <TouchableOpacity
                        style={styles.lensButton}
                        onPress={() => handleLensSearchFromProductImage(image)}
                      >
                        <Text style={styles.lensButtonText}>🔍</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.promoButton}
                        onPress={() => handleGeneratePromoImage(image)}
                      >
                        <Text style={styles.promoButtonText}>🎨</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.deleteButton,
                          deleting === image.filename && styles.deleteButtonDisabled,
                        ]}
                        onPress={() => handleDeleteImage(image)}
                        disabled={deleting === image.filename}
                      >
                        <Text style={styles.deleteButtonText}>
                          {deleting === image.filename ? '⏳' : '🗑️'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.imageFilename} numberOfLines={1}>
                      {image.filename}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* New Images Section */}
          {newImages.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📷 Nuevas Imágenes ({newImages.length})</Text>
                <TouchableOpacity
                  onPress={handleUploadImages}
                  style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
                  disabled={uploading}
                >
                  <Text style={styles.uploadButtonText}>
                    {uploading ? '⏳ Subiendo...' : '☁️ Subir Todo'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.imagesGrid}>
                {newImages.map((image, index) => (
                  <View key={index} style={styles.imageCard}>
                    <Image source={{ uri: image.uri }} style={styles.image} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleRemoveNewImage(index)}
                    >
                      <Text style={styles.deleteButtonText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.imageFilename} numberOfLines={1}>
                      {image.filename}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

              {/* Add Images Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>➕ Agregar Imágenes</Text>

                <View style={styles.imageButtonsContainer}>
                  <TouchableOpacity onPress={handlePickImages} style={styles.imageButton}>
                    <Text style={styles.imageButtonText}>📁 Galería</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleTakePhoto} style={styles.imageButton}>
                    <Text style={styles.imageButtonText}>📷 Cámara</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.infoText}>
                  💡 Selecciona imágenes de la galería o toma fotos con la cámara. Las imágenes
                  seleccionadas aparecerán en la sección "Nuevas Imágenes" y deberás subirlas
                  manualmente.
                </Text>
              </View>
            </>
          )}

          {/* Google Lens Tab */}
          {activeTab === 'lens' && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🔍 Buscar con Google Lens</Text>

                <View style={styles.lensSearchContainer}>
                  <TextInput
                    style={styles.lensUrlInput}
                    placeholder="URL de imagen (opcional)"
                    value={lensImageUrl}
                    onChangeText={setLensImageUrl}
                    placeholderTextColor={theme.color.text.placeholder}
                  />
                  <TouchableOpacity
                    onPress={handleLensSearchByUrl}
                    style={[styles.lensSearchButton, lensSearching && styles.buttonDisabled]}
                    disabled={lensSearching}
                  >
                    <Text style={styles.lensSearchButtonText}>Buscar por URL</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.imageButtonsContainer}>
                  <TouchableOpacity
                    onPress={handleLensSearchByUpload}
                    style={[styles.imageButton, lensSearching && styles.buttonDisabled]}
                    disabled={lensSearching}
                  >
                    <Text style={styles.imageButtonText}>📁 Buscar desde Galería</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.infoText}>
                  💡 Busca productos similares usando Google Lens. Puedes subir una imagen o
                  proporcionar una URL.
                </Text>
              </View>

              {lensSearching && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.color.brand.accent} />
                  <Text style={styles.loadingText}>Buscando con Google Lens...</Text>
                </View>
              )}

              {lensResults.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    🎯 Resultados ({lensResults.length})
                  </Text>

                  <View style={styles.imagesGrid}>
                    {lensResults.map((result, index) => {
                      const formattedPrice = formatLensPrice(result.price);
                      const imageUri = result.originalImage || result.image || result.thumbnail;
                      return (
                        <View key={index} style={styles.lensResultCard}>
                          <Image
                            source={{ uri: result.thumbnail }}
                            style={styles.image}
                            resizeMode="cover"
                          />
                          <View style={styles.lensResultInfo}>
                            <Text style={styles.lensResultTitle} numberOfLines={2}>
                              {result.title}
                            </Text>
                            {formattedPrice && (
                              <Text style={styles.lensResultPrice}>{formattedPrice}</Text>
                            )}
                            <Text style={styles.lensResultSource} numberOfLines={1}>
                              {result.source}
                            </Text>
                          </View>
                          <View style={styles.lensResultActions}>
                            <TouchableOpacity
                              style={styles.lensAnalyzeButton}
                              onPress={() => handleAnalyzeImageQuality(imageUri)}
                            >
                              <Text style={styles.lensAnalyzeButtonText}>📊</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.lensSelectButton}
                              onPress={() => handleSelectLensImage(result)}
                            >
                              <Text style={styles.lensSelectButtonText}>✓ Usar</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Promo Editor Tab */}
          {activeTab === 'promo' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎨 Editor de Imágenes Promocionales</Text>

              {productImages.length === 0 ? (
                <View style={styles.noImagesContainer}>
                  <Text style={styles.noImagesText}>📦 No hay imágenes</Text>
                  <Text style={styles.noImagesSubtext}>
                    Primero agrega imágenes en la pestaña Galería
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.infoText}>
                    💡 Selecciona una imagen para crear una versión promocional con precios
                  </Text>

                  <View style={styles.imagesGrid}>
                    {productImages.map((image, index) => (
                      <View key={image.filename} style={styles.imageCard}>
                        <Image source={{ uri: image.url }} style={styles.image} resizeMode="cover" />
                        {index === 0 && (
                          <View style={styles.mainImageBadge}>
                            <Text style={styles.mainImageBadgeText}>Principal</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          style={styles.promoEditButton}
                          onPress={() => handleGeneratePromoImage(image)}
                        >
                          <Text style={styles.promoEditButtonText}>🎨 Editar</Text>
                        </TouchableOpacity>
                        <Text style={styles.imageFilename} numberOfLines={1}>
                          {image.filename}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={onClose} style={styles.closeButtonBottom}>
            <Text style={styles.closeButtonBottomText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Promotional Image Preview Modal */}
      <Modal visible={showPromoPreview} animationType="fade" transparent={true}>
        <View style={styles.promoModalOverlay}>
          <View style={styles.promoModalContainer}>
            <View style={styles.promoModalHeader}>
              <Text style={styles.promoModalTitle}>Vista Previa - Imagen Promocional</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowPromoPreview(false);
                  setSelectedImageForPromo(null);
                }}
                style={styles.promoCloseButton}
              >
                <Text style={styles.promoCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.promoModalContentScroll}
              contentContainerStyle={styles.promoModalContent}
            >
              {ViewShot ? (
                <View
                  style={[
                    styles.promoPreviewContainer,
                    containerSize > 0 && {
                      width: containerSize,
                      height: containerSize,
                    },
                  ]}
                >
                  <View style={styles.promoImageContainer}>
                    <ViewShot
                      ref={viewShotRef}
                      options={{ format: 'jpg', quality: 0.9 }}
                      style={{
                        width: containerSize,
                        height: containerSize,
                        overflow: 'hidden',
                        borderRadius: 9,
                      }}
                    >
                      <View
                        style={{
                          width: containerSize,
                          height: containerSize,
                          backgroundColor: '#000',
                        }}
                      >
                        {selectedImageForPromo && (
                          <Image
                            source={{ uri: selectedImageForPromo.url }}
                            style={[
                              styles.promoImage,
                              {
                                transform: [
                                  { scale: imageScale },
                                  { translateX: imagePosition.x },
                                  { translateY: imagePosition.y },
                                ],
                              },
                            ]}
                            resizeMode="cover"
                          />
                        )}

                        {/* Branding - Top */}
                        <View style={styles.promoBrandingTop}>
                          <View style={styles.promoBranding}>
                            <Text style={styles.promoBrandingText}>🔥 ¡OFERTA ESPECIAL!</Text>
                          </View>
                        </View>

                        {/* Overlay compacto y colorido */}
                        <View style={styles.promoOverlay}>
                          {/* Product Title */}
                          <View style={styles.promoTitleContainer}>
                            <Text style={styles.promoProductTitle} numberOfLines={2}>
                              {product.title}
                            </Text>
                            <Text style={styles.promoProductSku}>SKU: {product.sku}</Text>
                          </View>

                          {/* Prices Section - Pills horizontales */}
                          <View style={styles.promoPricesContainer}>
                            {salePrices.map((price: any, index: number) => (
                              <View key={index} style={styles.promoPriceCard}>
                                <Text style={styles.promoPriceLabel}>{price.profileName}:</Text>
                                <Text style={styles.promoPriceValue}>
                                  {formatPrice(price.priceCents, product.currency)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>
                    </ViewShot>
                  </View>

                  {/* Crop Guide - Shows the square area that will be captured */}
                  <View style={styles.cropGuide}>
                    <View style={[styles.cropCorner, styles.cropCornerTopLeft]} />
                    <View style={[styles.cropCorner, styles.cropCornerTopRight]} />
                    <View style={[styles.cropCorner, styles.cropCornerBottomLeft]} />
                    <View style={[styles.cropCorner, styles.cropCornerBottomRight]} />
                  </View>
                </View>
              ) : (
                <View
                  style={[
                    styles.promoPreviewContainer,
                    containerSize > 0 && {
                      width: containerSize,
                      height: containerSize,
                    },
                  ]}
                >
                  <View style={styles.promoImageContainer}>
                    {selectedImageForPromo && (
                      <Image
                        source={{ uri: selectedImageForPromo.url }}
                        style={[
                          styles.promoImage,
                          {
                            transform: [
                              { scale: imageScale },
                              { translateX: imagePosition.x },
                              { translateY: imagePosition.y },
                            ],
                          },
                        ]}
                        resizeMode="cover"
                      />
                    )}
                    {/* Branding - Top */}
                    <View style={styles.promoBrandingTop}>
                      <View style={styles.promoBranding}>
                        <Text style={styles.promoBrandingText}>🔥 ¡OFERTA ESPECIAL!</Text>
                      </View>
                    </View>

                    <View style={styles.promoOverlay}>
                      <View style={styles.promoTitleContainer}>
                        <Text style={styles.promoProductTitle} numberOfLines={2}>
                          {product.title}
                        </Text>
                        <Text style={styles.promoProductSku}>SKU: {product.sku}</Text>
                      </View>
                      <View style={styles.promoPricesContainer}>
                        {salePrices.map((price: any, index: number) => (
                          <View key={index} style={styles.promoPriceCard}>
                            <Text style={styles.promoPriceLabel}>{price.profileName}:</Text>
                            <Text style={styles.promoPriceValue}>
                              {formatPrice(price.priceCents, product.currency)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Crop Guide - Shows the square area that will be captured */}
                  <View style={styles.cropGuide}>
                    <View style={[styles.cropCorner, styles.cropCornerTopLeft]} />
                    <View style={[styles.cropCorner, styles.cropCornerTopRight]} />
                    <View style={[styles.cropCorner, styles.cropCornerBottomLeft]} />
                    <View style={[styles.cropCorner, styles.cropCornerBottomRight]} />
                  </View>
                </View>
              )}

              {/* Image Adjustment Controls */}
              <View style={styles.imageControls}>
                <Text style={styles.controlsTitle}>Ajustar Imagen</Text>

                {/* Scale Control */}
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Zoom:</Text>
                  <View style={styles.controlButtons}>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() => handleScaleChange(Math.max(0.5, imageScale - 0.1))}
                    >
                      <Text style={styles.controlButtonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.controlValue}>{imageScale.toFixed(1)}x</Text>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() => handleScaleChange(Math.min(3, imageScale + 0.1))}
                    >
                      <Text style={styles.controlButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Horizontal Position Control */}
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Horizontal:</Text>
                  <View style={styles.controlButtons}>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() => handlePositionChange('x', imagePosition.x - 10)}
                    >
                      <Text style={styles.controlButtonText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.controlValue}>{imagePosition.x}</Text>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() => handlePositionChange('x', imagePosition.x + 10)}
                    >
                      <Text style={styles.controlButtonText}>→</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Vertical Position Control */}
                <View style={styles.controlRow}>
                  <Text style={styles.controlLabel}>Vertical:</Text>
                  <View style={styles.controlButtons}>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() => handlePositionChange('y', imagePosition.y - 10)}
                    >
                      <Text style={styles.controlButtonText}>↑</Text>
                    </TouchableOpacity>
                    <Text style={styles.controlValue}>{imagePosition.y}</Text>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() => handlePositionChange('y', imagePosition.y + 10)}
                    >
                      <Text style={styles.controlButtonText}>↓</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Reset Button */}
                <TouchableOpacity
                  style={styles.resetControlsButton}
                  onPress={() => {
                    setImageScale(1);
                    setImagePosition({ x: 0, y: 0 });
                  }}
                >
                  <Text style={styles.resetControlsButtonText}>↻ Restablecer</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.helpContainer}>
                <View style={styles.helpBadge}>
                  <Text style={styles.helpBadgeText}>📐 ÁREA DE CAPTURA</Text>
                </View>
                <Text style={styles.promoHelpText}>
                  El borde morado muestra el área cuadrada que se guardará. Ajusta la imagen para
                  que quede centrada dentro del cuadrado.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.promoModalFooter}>
              <TouchableOpacity
                onPress={() => {
                  setShowPromoPreview(false);
                  setSelectedImageForPromo(null);
                }}
                style={styles.promoCancelButton}
              >
                <Text style={styles.promoCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSavePromoImage}
                style={[styles.promoSaveButton, generatingPromo && styles.promoSaveButtonDisabled]}
                disabled={generatingPromo}
              >
                {generatingPromo ? (
                  <ActivityIndicator size="small" color={theme.color.text.inverse} />
                ) : (
                  <Text style={styles.promoSaveButtonText}>💾 Guardar en Galería</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    {/* Image Quality Analysis Modal */}
    <Modal visible={showQualityModal} animationType="fade" transparent={true}>
        <View style={styles.qualityModalOverlay}>
          <View style={styles.qualityModalContainer}>
            <View style={styles.qualityModalHeader}>
              <Text style={styles.qualityModalTitle}>📊 Análisis de Calidad de Imagen</Text>
              <TouchableOpacity
                onPress={() => setShowQualityModal(false)}
                style={styles.qualityModalCloseButton}
              >
                <Text style={styles.qualityModalCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.qualityModalContent}
              showsVerticalScrollIndicator={true}
            >
              {imageQuality && (
                <>
                  {/* Quality Badge */}
                  <View style={[
                    styles.qualityBadgeLarge,
                    imageQuality.quality === 'excellent' && styles.qualityExcellent,
                    imageQuality.quality === 'high' && styles.qualityHigh,
                    imageQuality.quality === 'medium' && styles.qualityMedium,
                    imageQuality.quality === 'low' && styles.qualityLow,
                  ]}>
                    <Text style={styles.qualityBadgeLargeText}>
                      {imageQuality.quality === 'excellent' && '⭐ Calidad Excelente'}
                      {imageQuality.quality === 'high' && '✅ Calidad Alta'}
                      {imageQuality.quality === 'medium' && '⚠️ Calidad Media'}
                      {imageQuality.quality === 'low' && '❌ Calidad Baja'}
                    </Text>
                  </View>

                  {/* Specifications */}
                  <View style={styles.qualitySection}>
                    <Text style={styles.qualitySectionTitle}>📐 Especificaciones</Text>
                    <View style={styles.qualityRow}>
                      <Text style={styles.qualityLabel}>Resolución:</Text>
                      <Text style={styles.qualityValue}>{imageQuality.width} x {imageQuality.height} px</Text>
                    </View>
                    <View style={styles.qualityRow}>
                      <Text style={styles.qualityLabel}>Megapíxeles:</Text>
                      <Text style={styles.qualityValue}>{imageQuality.megapixels.toFixed(2)} MP</Text>
                    </View>
                    <View style={styles.qualityRow}>
                      <Text style={styles.qualityLabel}>Formato:</Text>
                      <Text style={styles.qualityValue}>{imageQuality.format.toUpperCase()}</Text>
                    </View>
                    <View style={styles.qualityRow}>
                      <Text style={styles.qualityLabel}>Tamaño:</Text>
                      <Text style={styles.qualityValue}>{imageQuality.sizeMB.toFixed(2)} MB ({imageQuality.sizeBytes.toLocaleString()} bytes)</Text>
                    </View>
                    <View style={styles.qualityRow}>
                      <Text style={styles.qualityLabel}>Aspecto:</Text>
                      <Text style={styles.qualityValue}>{imageQuality.aspectRatio}</Text>
                    </View>
                  </View>

                  {/* Suitability */}
                  <View style={styles.qualitySection}>
                    <Text style={styles.qualitySectionTitle}>✓ Idoneidad</Text>
                    <View style={styles.qualityRow}>
                      <Text style={styles.qualityLabel}>Para búsqueda:</Text>
                      <Text style={[styles.qualityValue, imageQuality.isGoodForSearch ? styles.qualityGood : styles.qualityBad]}>
                        {imageQuality.isGoodForSearch ? '✅ Sí' : '❌ No'}
                      </Text>
                    </View>
                    <View style={styles.qualityRow}>
                      <Text style={styles.qualityLabel}>Para e-commerce:</Text>
                      <Text style={[styles.qualityValue, imageQuality.isGoodForEcommerce ? styles.qualityGood : styles.qualityBad]}>
                        {imageQuality.isGoodForEcommerce ? '✅ Sí' : '❌ No'}
                      </Text>
                    </View>
                  </View>

                  {/* Recommendations */}
                  {imageQuality.recommendations.length > 0 && (
                    <View style={styles.qualitySection}>
                      <Text style={styles.qualitySectionTitle}>💡 Recomendaciones</Text>
                      {imageQuality.recommendations.map((rec, index) => (
                        <Text key={index} style={styles.qualityRecommendation}>
                          {rec}
                        </Text>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.qualityModalFooter}>
              <TouchableOpacity
                onPress={() => setShowQualityModal(false)}
                style={styles.qualityModalCloseButtonBottom}
              >
                <Text style={styles.qualityModalCloseButtonBottomText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
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
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.subtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButtonText: {
      fontSize: 24,
      color: theme.color.text.body,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    content: {
      flex: 1,
      padding: theme.space[4],
    },
    productInfo: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    productTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    productSku: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    section: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginBottom: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
    },
    loadingContainer: {
      paddingVertical: theme.space[8],
      alignItems: 'center',
    },
    loadingText: {
      marginTop: theme.space[3],
      fontSize: 14,
      color: theme.color.text.muted,
    },
    noImagesContainer: {
      paddingVertical: theme.space[8],
      alignItems: 'center',
    },
    noImagesText: {
      fontSize: 48,
      marginBottom: theme.space[2],
    },
    noImagesSubtext: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
    },
    imagesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -6,
    },
    imageCard: {
      width: '48%',
      marginHorizontal: '1%',
      marginBottom: theme.space[3],
      position: 'relative',
    },
    image: {
      width: '100%',
      height: 150,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
    },
    mainImageBadge: {
      position: 'absolute',
      top: theme.space[2],
      left: theme.space[2],
      backgroundColor: theme.color.action.success.background,
      paddingHorizontal: theme.space[2],
      paddingVertical: theme.space[1],
      borderRadius: theme.radii.sm,
    },
    mainImageBadgeText: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    imageActions: {
      position: 'absolute',
      top: theme.space[2],
      right: theme.space[2],
      flexDirection: 'row',
      gap: theme.space[1],
    },
    promoButton: {
      backgroundColor: theme.color.brand.accent,
      width: 28,
      height: 28,
      borderRadius: theme.radii.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    promoButtonText: {
      fontSize: 14,
      color: theme.color.text.inverse,
    },
    deleteButton: {
      backgroundColor: theme.color.action.danger.background,
      width: 28,
      height: 28,
      borderRadius: theme.radii.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteButtonDisabled: {
      backgroundColor: theme.color.action.primary.backgroundDisabled,
    },
    deleteButtonText: {
      fontSize: 14,
      color: theme.color.text.inverse,
    },
    imageFilename: {
      fontSize: 11,
      color: theme.color.text.muted,
      marginTop: theme.space[1],
      textAlign: 'center',
    },
    // Promotional Image Styles
    promoModalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      paddingTop: theme.space[5],
      paddingBottom: theme.space[5],
      paddingHorizontal: theme.space[4],
    },
    promoModalContainer: {
      flex: 1,
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      overflow: 'hidden',
    },
    promoModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.space[6],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    promoModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
      flex: 1,
    },
    promoCloseButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.subtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    promoCloseButtonText: {
      fontSize: 20,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    promoModalContentScroll: {
      flex: 1,
    },
    promoModalContent: {
      padding: theme.space[6],
      alignItems: 'center',
    },
    promoPreviewContainer: {
      position: 'relative',
      alignSelf: 'center',
      borderRadius: theme.radii.xl,
      borderWidth: 3,
      borderColor: theme.color.brand.accent,
      overflow: 'visible',
      backgroundColor: theme.color.background.inverse,
    },
    promoImageContainer: {
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'visible',
    },
    promoImage: {
      width: '100%',
      height: '100%',
    },
    cropGuide: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderWidth: 2,
      borderColor: 'rgba(139, 92, 246, 0.8)',
      borderStyle: 'dashed',
      pointerEvents: 'none',
    },
    cropCorner: {
      position: 'absolute',
      width: 30,
      height: 30,
      borderColor: theme.color.brand.accent,
      borderWidth: 3,
    },
    cropCornerTopLeft: {
      top: -2,
      left: -2,
      borderRightWidth: 0,
      borderBottomWidth: 0,
    },
    cropCornerTopRight: {
      top: -2,
      right: -2,
      borderLeftWidth: 0,
      borderBottomWidth: 0,
    },
    cropCornerBottomLeft: {
      bottom: -2,
      left: -2,
      borderRightWidth: 0,
      borderTopWidth: 0,
    },
    cropCornerBottomRight: {
      bottom: -2,
      right: -2,
      borderLeftWidth: 0,
      borderTopWidth: 0,
    },
    promoOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    promoTitleContainer: {
      backgroundColor: 'rgba(139, 92, 246, 0.95)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      marginBottom: 8,
      alignSelf: 'flex-start',
    },
    promoProductTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.inverse,
      marginBottom: 2,
    },
    promoProductSku: {
      fontSize: 12,
      color: theme.color.brand.accentSoft,
    },
    promoPricesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    promoPricesTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.state.warning.border,
      marginBottom: 6,
      width: '100%',
    },
    promoPriceCard: {
      backgroundColor: 'rgba(16, 185, 129, 0.95)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    promoPriceLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    promoPriceValue: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.inverse,
    },
    promoBrandingTop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignItems: 'flex-start',
    },
    promoBranding: {
      backgroundColor: 'rgba(252, 211, 77, 0.95)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    promoBrandingText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.state.warning.text,
      textAlign: 'center',
    },
    imageControls: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      marginTop: theme.space[5],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    controlsTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
      textAlign: 'center',
    },
    controlRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    controlLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
      flex: 1,
    },
    controlButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    controlButton: {
      backgroundColor: theme.color.action.primary.background,
      width: 36,
      height: 36,
      borderRadius: theme.radii.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    controlButtonText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.inverse,
    },
    controlValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      minWidth: 40,
      textAlign: 'center',
    },
    resetControlsButton: {
      backgroundColor: theme.color.surface.muted,
      paddingVertical: theme.space[2.5],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.md,
      alignItems: 'center',
      marginTop: theme.space[2],
    },
    resetControlsButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    helpContainer: {
      marginTop: theme.space[4],
      alignItems: 'center',
    },
    helpBadge: {
      backgroundColor: theme.color.brand.accent,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.full,
      marginBottom: theme.space[3],
    },
    helpBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.color.text.inverse,
      letterSpacing: 1,
    },
    promoHelpText: {
      fontSize: 13,
      color: theme.color.text.muted,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: theme.space[5],
    },
    promoModalFooter: {
      flexDirection: 'row',
      padding: theme.space[6],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
      gap: theme.space[4],
    },
    promoCancelButton: {
      flex: 1,
      backgroundColor: theme.color.surface.muted,
      paddingVertical: theme.space[4],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    promoCancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    promoSaveButton: {
      flex: 2,
      backgroundColor: theme.color.brand.accent,
      paddingVertical: theme.space[4],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    promoSaveButtonDisabled: {
      backgroundColor: theme.color.brand.accentSoft,
    },
    promoSaveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    imageButtonsContainer: {
      flexDirection: 'row',
      gap: theme.space[3],
      marginBottom: theme.space[3],
    },
    imageButton: {
      flex: 1,
      backgroundColor: theme.color.action.primary.background,
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    imageButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    uploadButton: {
      backgroundColor: theme.color.action.success.background,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.md,
    },
    uploadButtonDisabled: {
      backgroundColor: theme.color.action.primary.backgroundDisabled,
    },
    uploadButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    infoText: {
      fontSize: 13,
      color: theme.color.text.muted,
      lineHeight: 20,
    },
    footer: {
      padding: theme.space[4],
      backgroundColor: theme.color.surface.base,
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    closeButtonBottom: {
      backgroundColor: theme.color.text.muted,
      paddingVertical: theme.space[3.5],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    closeButtonBottomText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    // Tabs styles
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    tab: {
      flex: 1,
      paddingVertical: theme.space[3],
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: theme.color.brand.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    tabTextActive: {
      color: theme.color.brand.primary,
    },
    // Google Lens styles
    lensSearchContainer: {
      marginBottom: theme.space[3],
    },
    lensUrlInput: {
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[2.5],
      fontSize: 14,
      color: theme.color.text.body,
      marginBottom: theme.space[2],
    },
    lensSearchButton: {
      backgroundColor: theme.color.brand.accent,
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    lensSearchButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    lensResultCard: {
      width: '48%',
      marginHorizontal: '1%',
      marginBottom: theme.space[3],
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    lensResultInfo: {
      padding: theme.space[2],
    },
    lensResultTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    lensResultPrice: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.action.success.background,
      marginBottom: theme.space[1],
    },
    lensResultSource: {
      fontSize: 10,
      color: theme.color.text.muted,
    },
    lensResultActions: {
      flexDirection: 'row',
      gap: theme.space[1],
    },
    lensAnalyzeButton: {
      flex: 1,
      backgroundColor: theme.color.brand.accent,
      paddingVertical: theme.space[2],
      alignItems: 'center',
    },
    lensAnalyzeButtonText: {
      fontSize: 16,
    },
    lensSelectButton: {
      flex: 2,
      backgroundColor: theme.color.action.primary.background,
      paddingVertical: theme.space[2],
      alignItems: 'center',
    },
    lensSelectButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    lensButton: {
      backgroundColor: theme.color.brand.accent,
      width: 28,
      height: 28,
      borderRadius: theme.radii.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    lensButtonText: {
      fontSize: 14,
      color: theme.color.text.inverse,
    },
    promoEditButton: {
      position: 'absolute',
      bottom: 30,
      left: theme.space[2],
      right: theme.space[2],
      backgroundColor: theme.color.brand.accent,
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.sm,
      alignItems: 'center',
    },
    promoEditButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    // Image Quality Analysis styles
    qualityBadgeContainer: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.xl,
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    qualityBadge: {
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.full,
      alignSelf: 'flex-start',
      marginBottom: theme.space[2],
    },
    qualityExcellent: {
      backgroundColor: theme.color.action.success.background,
    },
    qualityHigh: {
      backgroundColor: theme.color.action.primary.background,
    },
    qualityMedium: {
      backgroundColor: theme.color.state.warning.border,
    },
    qualityLow: {
      backgroundColor: theme.color.action.danger.background,
    },
    qualityBadgeText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.inverse,
    },
    qualitySummary: {
      marginTop: theme.space[1],
    },
    qualitySummaryText: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginBottom: theme.space[1],
    },
    qualityTapText: {
      fontSize: 12,
      color: theme.color.brand.accent,
      fontWeight: '600',
    },
    // Quality Modal styles
    qualityModalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.strong,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[4],
    },
    qualityModalContainer: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      width: Dimensions.get('window').width * 0.95,
      height: Dimensions.get('window').height * 0.85,
      maxWidth: 600,
      ...theme.shadow.xl,
    },
    qualityModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    qualityModalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
      flex: 1,
    },
    qualityModalCloseButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.subtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    qualityModalCloseButtonText: {
      fontSize: 20,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    qualityModalContent: {
      flex: 1,
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[4],
    },
    qualityBadgeLarge: {
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.xl,
      alignSelf: 'center',
      marginBottom: theme.space[5],
    },
    qualityBadgeLargeText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.inverse,
    },
    qualitySection: {
      marginBottom: theme.space[5],
    },
    qualitySectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
    },
    qualityRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.space[2],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.surface.subtle,
    },
    qualityLabel: {
      fontSize: 14,
      color: theme.color.text.muted,
      flex: 1,
    },
    qualityValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      flex: 1,
      textAlign: 'right',
    },
    qualityGood: {
      color: theme.color.action.success.background,
    },
    qualityBad: {
      color: theme.color.action.danger.background,
    },
    qualityRecommendation: {
      fontSize: 14,
      color: theme.color.text.muted,
      lineHeight: 20,
      marginBottom: theme.space[2],
    },
    qualityModalFooter: {
      padding: theme.space[5],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    qualityModalCloseButtonBottom: {
      backgroundColor: theme.color.action.primary.background,
      paddingVertical: theme.space[3.5],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    qualityModalCloseButtonBottomText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
  });
