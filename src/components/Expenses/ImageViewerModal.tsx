import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { config } from '@/utils/config';
import { useAuthStore } from '@/store/auth';
import { filesApi } from '@/services/api/files';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

interface ImageViewerModalProps {
  visible: boolean;
  imageUrl?: string | null; // Deprecated: use fileId instead
  fileId?: string | null; // Preferred: generates fresh signed URL
  fileName?: string;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  visible,
  imageUrl,
  fileId,
  fileName,
  onClose,
}) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [imageData, setImageData] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (visible && (imageUrl || fileId)) {
      setLoading(true);
      setError(false);
      loadImage();
    } else {
      setImageData(null);
    }
  }, [visible, imageUrl, fileId]);

  const loadImage = async () => {
    try {
      let url: string;

      // If fileId is provided, generate a fresh signed URL
      if (fileId) {
        console.log('🔄 Generating fresh signed URL for fileId:', fileId);
        url = await filesApi.getPrivateFileUrl(fileId);
        console.log('✅ Fresh signed URL generated');
      } else if (imageUrl) {
        // Fallback to imageUrl if provided (legacy support)
        console.log('⚠️ Using pre-generated imageUrl (may expire)');
        url = imageUrl;
      } else {
        throw new Error('No fileId or imageUrl provided');
      }

      await loadImageWithHeaders(url);
    } catch (err) {
      console.error('❌ Error loading image:', err);
      setError(true);
      setLoading(false);
    }
  };

  const loadImageWithHeaders = async (url: string) => {
    try {
      console.log('🖼️ Loading image from signed URL:', url);

      // Get the JWT token from auth store
      const token = useAuthStore.getState().token;

      // El backend requiere el header X-App-Id y Authorization para archivos privados
      const headers: Record<string, string> = {
        'X-App-Id': config.APP_ID,
        Accept: 'image/*',
      };

      // Add Authorization header if token is available
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('🔑 Adding Authorization header with JWT token');
      }

      headers['X-App-Version'] = config.APP_VERSION;

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log('📡 Image fetch response:', {
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get('content-type'),
      });

      if (!response.ok) {
        // Intentar leer el mensaje de error del servidor
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          console.error('❌ Server error response:', errorData);
          throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      console.log('📦 Blob received:', {
        size: blob.size,
        type: blob.type,
      });

      const reader = new FileReader();

      reader.onloadend = () => {
        const base64data = reader.result as string;
        console.log('✅ Image loaded successfully as base64');
        setImageData(base64data);
        setLoading(false);
      };

      reader.onerror = () => {
        console.error('❌ Error reading blob');
        setError(true);
        setLoading(false);
      };

      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('❌ Error loading image:', err);
      setError(true);
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {fileName || 'Imagen del Pago'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.neutral[0]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Image Content */}
        <View style={styles.imageContainer}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent[500]} />
              <Text style={styles.loadingText}>Cargando imagen...</Text>
            </View>
          )}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={64} color={colors.danger[500]} />
              <Text style={styles.errorText}>No se pudo cargar la imagen</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  if (imageUrl || fileId) {
                    setError(false);
                    setLoading(true);
                    loadImage();
                  }
                }}
              >
                <Text style={styles.retryButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          )}
          {!loading && !error && imageData && (
            <Image source={{ uri: imageData }} style={styles.image} resizeMode="contain" />
          )}
          {!loading && !error && !imageData && !imageUrl && !fileId && (
            <View style={styles.errorContainer}>
              <Ionicons name="image-outline" size={64} color={colors.neutral[400]} />
              <Text style={styles.errorText}>No hay imagen disponible</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.closeFooterButton} onPress={onClose}>
            <Ionicons name="close-circle" size={20} color={colors.neutral[0]} />
            <Text style={styles.closeFooterButtonText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.overlay.dark,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : spacing[5],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[4],
    backgroundColor: colors.overlay.dark,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
    marginRight: spacing[3],
  },
  closeButton: {
    padding: spacing[1],
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 200,
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: 14,
    color: colors.neutral[0],
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  errorText: {
    marginTop: spacing[4],
    fontSize: 16,
    color: colors.neutral[0],
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing[4],
    paddingVertical: spacing[2.5],
    paddingHorizontal: spacing[5],
    backgroundColor: colors.accent[500],
    borderRadius: borderRadius.lg,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  footer: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    paddingBottom: Platform.OS === 'ios' ? spacing[8] : spacing[4],
    backgroundColor: colors.overlay.dark,
    alignItems: 'center',
  },
  closeFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    backgroundColor: colors.accent[500],
    borderRadius: borderRadius.lg,
  },
  closeFooterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
});

export default ImageViewerModal;
