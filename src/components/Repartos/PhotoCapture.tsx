import React, { useState } from 'react';
import Alert from '@/utils/alert';
import { View, Text, StyleSheet, TouchableOpacity, Image} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
  MediaTypeOptions
} from '@/utils/filePicker';

interface PhotoCaptureProps {
  onPhotoCapture: (photoUri: string) => void;
  onCancel: () => void;
  currentPhoto?: string;
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  onPhotoCapture,
  onCancel,
  currentPhoto,
}) => {
  const [photo, setPhoto] = useState<string | undefined>(currentPhoto);

  const requestCameraPermission = async () => {
    const { status } = await requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Requerido', 'Se necesita permiso para acceder a la cámara');
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      return;
    }

    try {
      const result = await launchCameraAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: false, // ✅ Desactivar recorte
        quality: 0.8,
      });

      console.log('📷 Camera result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const photoUri = result.assets[0].uri;
        console.log('✅ Photo captured:', photoUri);
        setPhoto(photoUri);
      } else {
        console.log('❌ Photo capture canceled or no assets');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'No se pudo tomar la foto');
    }
  };

  const handleSelectFromGallery = async () => {
    try {
      const result = await launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsEditing: false, // ✅ Desactivar recorte
        quality: 0.8,
      });

      console.log('🖼️ Gallery result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const photoUri = result.assets[0].uri;
        console.log('✅ Photo selected:', photoUri);
        setPhoto(photoUri);
      } else {
        console.log('❌ Photo selection canceled or no assets');
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'No se pudo seleccionar la foto');
    }
  };

  const handleConfirm = () => {
    if (photo) {
      onPhotoCapture(photo);
    } else {
      Alert.alert('Error', 'Por favor toma o selecciona una foto');
    }
  };

  const handleRetake = () => {
    setPhoto(undefined);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Foto del Producto</Text>
      <Text style={styles.subtitle}>Toma una foto del producto que se está entregando</Text>

      <View style={styles.photoContainer}>
        {photo ? (
          <>
            <Image source={{ uri: photo }} style={styles.photo} resizeMode="contain" />
            <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
              <Text style={styles.retakeButtonText}>📷 Tomar otra foto</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📷</Text>
            <Text style={styles.placeholderText}>No hay foto</Text>
          </View>
        )}
      </View>

      {!photo && (
        <View style={styles.captureButtons}>
          <TouchableOpacity style={styles.cameraButton} onPress={handleTakePhoto}>
            <Text style={styles.cameraButtonText}>📷 Tomar Foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.galleryButton} onPress={handleSelectFromGallery}>
            <Text style={styles.galleryButtonText}>🖼️ Seleccionar de Galería</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmButton, !photo && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!photo}
        >
          <Text style={styles.confirmButtonText}>Confirmar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing[5],
    backgroundColor: colors.neutral[0],
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.neutral[800],
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: spacing[5],
    textAlign: 'center',
  },
  photoContainer: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background.secondary,
    marginBottom: spacing[5],
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: spacing[3],
  },
  placeholderText: {
    fontSize: 16,
    color: colors.neutral[400],
  },
  retakeButton: {
    position: 'absolute',
    bottom: spacing[4],
    left: spacing[4],
    right: spacing[4],
    backgroundColor: 'rgba(99, 102, 241, 0.9)',
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  retakeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  captureButtons: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[5],
  },
  cameraButton: {
    flex: 1,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.accent[500],
    alignItems: 'center',
  },
  cameraButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  galleryButton: {
    flex: 1,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  galleryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[600],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.danger[100],
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger[600],
  },
  confirmButton: {
    flex: 1,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.accent[500],
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: colors.border.default,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
});
