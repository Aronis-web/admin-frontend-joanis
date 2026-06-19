import React, { useState } from 'react';
import Alert from '@/utils/alert';
import { View, Text, StyleSheet, TouchableOpacity, Image} from 'react-native';
import { useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const styles = useThemedStyles(createStyles);
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
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhoto(result.assets[0].uri);
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
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhoto(result.assets[0].uri);
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
      <Text style={styles.title}>Foto de Validación</Text>
      <Text style={styles.subtitle}>Toma una foto del producto que se está validando</Text>

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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: theme.space[5],
      backgroundColor: theme.color.surface.base,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: theme.space[2],
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginBottom: theme.space[5],
      textAlign: 'center',
    },
    photoContainer: {
      flex: 1,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.subtle,
      marginBottom: theme.space[5],
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
      marginBottom: theme.space[3],
    },
    placeholderText: {
      fontSize: 16,
      color: theme.color.text.placeholder,
    },
    retakeButton: {
      position: 'absolute',
      bottom: theme.space[4],
      left: theme.space[4],
      right: theme.space[4],
      backgroundColor: theme.color.brand.primary,
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
    },
    retakeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    captureButtons: {
      flexDirection: 'row',
      gap: theme.space[3],
      marginBottom: theme.space[5],
    },
    cameraButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.brand.primary,
      alignItems: 'center',
    },
    cameraButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
    galleryButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.surface.muted,
      alignItems: 'center',
    },
    galleryButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.state.danger.background,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.state.danger.text,
    },
    confirmButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.brand.primary,
      alignItems: 'center',
    },
    confirmButtonDisabled: {
      backgroundColor: theme.color.border.default,
    },
    confirmButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.inverse,
    },
  });
