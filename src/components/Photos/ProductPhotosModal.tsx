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
  TextInput,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Product } from '@/services/api/products';
import { filesApi } from '@/services/api/files';
import { productsApi } from '@/services/api/products';
import { googleLensApi, GoogleLensResult } from '@/services/api/google-lens';
import { geminiImageEditorApi, GeminiEditImageResponse } from '@/services/api/gemini-image-editor';
import { validateImageFile } from '@/utils/fileHelpers';

interface ProductPhotosModalProps {
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

export const ProductPhotosModal: React.FC<ProductPhotosModalProps> = ({
  visible,
  onClose,
  onSuccess,
  product,
}) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<'gallery' | 'lens' | 'gemini'>('gallery');

  // Gallery tab states
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [newImages, setNewImages] = useState<
    Array<{ uri: string; filename: string; mimeType?: string }>
  >([]);

  // Google Lens tab states
  const [lensSearching, setLensSearching] = useState(false);
  const [lensResults, setLensResults] = useState<GoogleLensResult[]>([]);
  const [lensImageUrl, setLensImageUrl] = useState('');

  // Gemini Editor states
  const [geminiEditing, setGeminiEditing] = useState(false);
  const [geminiPrompt, setGeminiPrompt] = useState('');
  const [selectedImageForGemini, setSelectedImageForGemini] = useState<ProductImage | null>(null);
  const [editedGeminiImage, setEditedGeminiImage] = useState<GeminiEditImageResponse | null>(null);
  const [showGeminiPreview, setShowGeminiPreview] = useState(false);

  // Load product images when modal opens
  useEffect(() => {
    if (visible && product?.id) {
      loadProductImages();
    }
  }, [visible, product?.id]);

  // Reset Gemini editor state when product changes
  useEffect(() => {
    if (visible && product?.id) {
      // Clear Gemini editor states when switching products
      setGeminiPrompt('');
      setSelectedImageForGemini(null);
      setEditedGeminiImage(null);
      setShowGeminiPreview(false);

      // Also clear Google Lens states
      setLensResults([]);
      setLensImageUrl('');

      // Clear new images queue
      setNewImages([]);
    }
  }, [product?.id]);

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
    if (!hasPermission) {
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Requerido', 'Se necesita permiso para usar la cámara.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
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

              const deletePath = `catalog/productos/imagenes/${product.id}/${image.filename}`;
              await filesApi.deletePublicFile(deletePath);

              console.log('✅ Image deleted successfully:', image.filename);

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

  // Download image
  const handleDownloadImage = async (image: ProductImage) => {
    try {
      setDownloading(image.filename);
      console.log('📥 Downloading image:', image.filename);

      if (Platform.OS === 'web') {
        // Web: Create download link
        const link = document.createElement('a');
        link.href = image.url;
        link.download = image.filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        Alert.alert('Éxito', 'Imagen descargada correctamente');
      } else {
        // Mobile: Download and share
        const fileUri = `${FileSystem.cacheDirectory}${image.filename}`;

        // Download the image
        const downloadResult = await FileSystem.downloadAsync(image.url, fileUri);

        if (downloadResult.status === 200) {
          console.log('✅ Image downloaded to:', downloadResult.uri);

          // Check if sharing is available
          const isSharingAvailable = await Sharing.isAvailableAsync();

          if (isSharingAvailable) {
            // Share the file (user can save to gallery from share menu)
            await Sharing.shareAsync(downloadResult.uri, {
              mimeType: 'image/jpeg',
              dialogTitle: 'Guardar imagen',
              UTI: 'public.jpeg',
            });

            Alert.alert('Éxito', 'Imagen descargada. Puedes guardarla desde el menú de compartir.');
          } else {
            Alert.alert('Éxito', `Imagen descargada en: ${downloadResult.uri}`);
          }
        } else {
          throw new Error('Error al descargar la imagen');
        }
      }
    } catch (error: any) {
      console.error('❌ Error downloading image:', error);
      Alert.alert('Error', error.message || 'No se pudo descargar la imagen');
    } finally {
      setDownloading(null);
    }
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

      const uploadPromises = newImages.map((img) =>
        filesApi.uploadProductImage(img.uri, product.id, img.filename, img.mimeType)
      );

      await Promise.all(uploadPromises);
      console.log(`✅ Uploaded ${newImages.length} images successfully`);

      setNewImages([]);

      setTimeout(async () => {
        await loadProductImages();
      }, 500);

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

  // Google Lens functions
  const handleLensSearchByUpload = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      const imageUri = lensImage.originalImage || lensImage.image || lensImage.thumbnail;

      console.log('📥 Selecting Lens image:', {
        thumbnail: lensImage.thumbnail,
        image: lensImage.image,
        originalImage: lensImage.originalImage,
        selected: imageUri,
      });

      const filename = `lens_${Date.now()}.jpg`;
      setNewImages([
        ...newImages,
        {
          uri: imageUri,
          filename,
          mimeType: 'image/jpeg',
        },
      ]);

      setActiveTab('gallery');
      Alert.alert('Éxito', 'Imagen de alta calidad agregada. Puedes subirla desde la pestaña Galería');
    } catch (error: any) {
      console.error('Error adding Lens image:', error);
      Alert.alert('Error', error.message || 'No se pudo agregar la imagen');
    }
  };

  // Gemini Editor functions
  const handleOpenGeminiEditor = (image: ProductImage) => {
    setSelectedImageForGemini(image);
    setGeminiPrompt('');
    setEditedGeminiImage(null);
    setShowGeminiPreview(false);
    setActiveTab('gemini');
  };

  const handleEditWithGemini = async () => {
    if (!selectedImageForGemini) {
      Alert.alert('Error', 'No hay imagen seleccionada');
      return;
    }

    if (!geminiPrompt.trim()) {
      Alert.alert('Error', 'Por favor ingresa las instrucciones de edición');
      return;
    }

    try {
      setGeminiEditing(true);
      console.log('🎨 Editing image with Gemini:', selectedImageForGemini.url);

      const response = await geminiImageEditorApi.editImage(
        selectedImageForGemini.url,
        geminiPrompt.trim(),
        selectedImageForGemini.filename
      );

      setEditedGeminiImage(response);
      setShowGeminiPreview(true);
      Alert.alert('Éxito', 'Imagen editada con Gemini. Revisa el resultado.');
    } catch (error: any) {
      console.error('❌ Error editing with Gemini:', error);
      Alert.alert('Error', error.message || 'No se pudo editar la imagen con Gemini');
    } finally {
      setGeminiEditing(false);
    }
  };

  const handleRegenerateGemini = () => {
    setEditedGeminiImage(null);
    setShowGeminiPreview(false);
  };

  const handleAddGeminiImageToProduct = async () => {
    if (!editedGeminiImage) {
      Alert.alert('Error', 'No hay imagen editada para agregar');
      return;
    }

    try {
      // Save base64 to local file
      const filename = `gemini_${Date.now()}.png`;
      const localUri = await geminiImageEditorApi.saveBase64ToFile(
        editedGeminiImage.editedImageBase64,
        editedGeminiImage.mimeType,
        filename
      );

      // Add to new images
      setNewImages([
        ...newImages,
        {
          uri: localUri,
          filename,
          mimeType: editedGeminiImage.mimeType,
        },
      ]);

      // Reset Gemini state
      setEditedGeminiImage(null);
      setShowGeminiPreview(false);
      setSelectedImageForGemini(null);
      setGeminiPrompt('');

      // Switch to gallery tab
      setActiveTab('gallery');

      Alert.alert('Éxito', 'Imagen editada agregada. Puedes subirla desde la pestaña Galería');
    } catch (error: any) {
      console.error('❌ Error adding Gemini image:', error);
      Alert.alert('Error', error.message || 'No se pudo agregar la imagen editada');
    }
  };

  const formatLensPrice = (price: any): string | null => {
    if (!price) return null;
    if (typeof price === 'string') return price;
    if (typeof price === 'object' && 'value' in price) return price.value;
    return null;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gestionar Fotos</Text>
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
              🔍 Sugerencias
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'gemini' && styles.tabActive]}
            onPress={() => setActiveTab('gemini')}
          >
            <Text style={[styles.tabText, activeTab === 'gemini' && styles.tabTextActive]}>
              🎨 Editar IA
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
                    <ActivityIndicator size="large" color="#3B82F6" />
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
                            style={styles.geminiButton}
                            onPress={() => handleOpenGeminiEditor(image)}
                          >
                            <Text style={styles.geminiButtonText}>🎨</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.downloadButton,
                              downloading === image.filename && styles.downloadButtonDisabled,
                            ]}
                            onPress={() => handleDownloadImage(image)}
                            disabled={downloading === image.filename}
                          >
                            <Text style={styles.downloadButtonText}>
                              {downloading === image.filename ? '⏳' : '📥'}
                            </Text>
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
                <Text style={styles.sectionTitle}>🔍 Buscar Sugerencias con Google Lens</Text>

                <View style={styles.lensSearchContainer}>
                  <TextInput
                    style={styles.lensUrlInput}
                    placeholder="URL de imagen (opcional)"
                    value={lensImageUrl}
                    onChangeText={setLensImageUrl}
                    placeholderTextColor="#94A3B8"
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
                  proporcionar una URL para encontrar sugerencias de fotos de alta calidad.
                </Text>
              </View>

              {lensSearching && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#3B82F6" />
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

          {/* Gemini Editor Tab */}
          {activeTab === 'gemini' && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🎨 Editor de Imágenes con IA (Gemini)</Text>

                {productImages.length === 0 ? (
                  <View style={styles.noImagesContainer}>
                    <Text style={styles.noImagesText}>📦 No hay imágenes</Text>
                    <Text style={styles.noImagesSubtext}>
                      Primero agrega imágenes en la pestaña Galería
                    </Text>
                  </View>
                ) : !selectedImageForGemini ? (
                  <>
                    <Text style={styles.infoText}>
                      💡 Selecciona una imagen para editarla con inteligencia artificial
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
                            style={styles.geminiEditButton}
                            onPress={() => handleOpenGeminiEditor(image)}
                          >
                            <Text style={styles.geminiEditButtonText}>🎨 Editar</Text>
                          </TouchableOpacity>
                          <Text style={styles.imageFilename} numberOfLines={1}>
                            {image.filename}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <>
                    {/* Gemini Editor Interface */}
                    <View style={styles.geminiEditorContainer}>
                      <Text style={styles.geminiEditorTitle}>Imagen Seleccionada:</Text>
                      <Image
                        source={{ uri: selectedImageForGemini.url }}
                        style={styles.geminiSelectedImage}
                        resizeMode="contain"
                      />

                      <TouchableOpacity
                        style={styles.geminiChangeImageButton}
                        onPress={() => {
                          setSelectedImageForGemini(null);
                          setEditedGeminiImage(null);
                          setShowGeminiPreview(false);
                        }}
                      >
                        <Text style={styles.geminiChangeImageButtonText}>Cambiar Imagen</Text>
                      </TouchableOpacity>

                      <Text style={styles.geminiPromptLabel}>Instrucciones de Edición:</Text>
                      <TextInput
                        style={styles.geminiPromptInput}
                        placeholder="Ej: Cambia el fondo a blanco, mejora los colores, elimina el fondo..."
                        value={geminiPrompt}
                        onChangeText={setGeminiPrompt}
                        placeholderTextColor="#94A3B8"
                        multiline
                        numberOfLines={4}
                      />

                      <TouchableOpacity
                        style={[styles.geminiEditActionButton, geminiEditing && styles.buttonDisabled]}
                        onPress={handleEditWithGemini}
                        disabled={geminiEditing}
                      >
                        <Text style={styles.geminiEditActionButtonText}>
                          {geminiEditing ? '⏳ Editando...' : '🎨 Editar con Gemini'}
                        </Text>
                      </TouchableOpacity>

                      {/* Preview of edited image */}
                      {showGeminiPreview && editedGeminiImage && (
                        <View style={styles.geminiPreviewContainer}>
                          <Text style={styles.geminiPreviewTitle}>Resultado:</Text>
                          <Image
                            source={{
                              uri: geminiImageEditorApi.getDataUri(
                                editedGeminiImage.editedImageBase64,
                                editedGeminiImage.mimeType
                              ),
                            }}
                            style={styles.geminiPreviewImage}
                            resizeMode="contain"
                          />

                          <View style={styles.geminiPreviewActions}>
                            <TouchableOpacity
                              style={styles.geminiRegenerateButton}
                              onPress={handleRegenerateGemini}
                            >
                              <Text style={styles.geminiRegenerateButtonText}>🔄 Regenerar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.geminiAddButton}
                              onPress={handleAddGeminiImageToProduct}
                            >
                              <Text style={styles.geminiAddButtonText}>✓ Agregar al Producto</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={onClose} style={styles.closeButtonBottom}>
            <Text style={styles.closeButtonBottomText}>Cerrar</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#64748B',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  productInfo: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  productSku: {
    fontSize: 14,
    color: '#64748B',
  },
  section: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  noImagesContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noImagesText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  noImagesSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  image: {
    width: '100%',
    height: 150,
    backgroundColor: '#F1F5F9',
  },
  mainImageBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  mainImageBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  imageActions: {
    flexDirection: 'row',
    padding: 8,
    gap: 4,
  },
  lensButton: {
    flex: 1,
    backgroundColor: '#EEF2FF',
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  lensButtonText: {
    fontSize: 16,
  },
  geminiButton: {
    flex: 1,
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  geminiButtonText: {
    fontSize: 16,
  },
  downloadButton: {
    flex: 1,
    backgroundColor: '#DBEAFE',
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  downloadButtonDisabled: {
    opacity: 0.5,
  },
  downloadButtonText: {
    fontSize: 16,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  imageFilename: {
    fontSize: 11,
    color: '#64748B',
    padding: 8,
    paddingTop: 0,
  },
  uploadButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  imageButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  imageButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  imageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  lensSearchContainer: {
    marginBottom: 12,
  },
  lensUrlInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
    marginBottom: 8,
  },
  lensSearchButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  lensSearchButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  lensResultCard: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lensResultInfo: {
    padding: 8,
  },
  lensResultTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  lensResultPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  lensResultSource: {
    fontSize: 10,
    color: '#94A3B8',
  },
  lensResultActions: {
    padding: 8,
    paddingTop: 0,
  },
  lensSelectButton: {
    backgroundColor: '#10B981',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  lensSelectButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  geminiEditButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 8,
    margin: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  geminiEditButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  geminiEditorContainer: {
    gap: 12,
  },
  geminiEditorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  geminiSelectedImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  geminiChangeImageButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  geminiChangeImageButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  geminiPromptLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 8,
  },
  geminiPromptInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  geminiEditActionButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  geminiEditActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  geminiPreviewContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  geminiPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  geminiPreviewImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 12,
  },
  geminiPreviewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  geminiRegenerateButton: {
    flex: 1,
    backgroundColor: '#64748B',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  geminiRegenerateButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  geminiAddButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  geminiAddButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  closeButtonBottom: {
    backgroundColor: '#64748B',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonBottomText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
