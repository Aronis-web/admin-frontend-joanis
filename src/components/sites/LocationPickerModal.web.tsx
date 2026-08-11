import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';

interface LocationData {
  latitude: number;
  longitude: number;
  addressLine1?: string;
  district?: string;
  province?: string;
  department?: string;
  country?: string;
  postalCode?: string;
}

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelect: (location: LocationData) => void;
  initialLocation?: LocationData;
}

const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  visible,
  onClose,
  onLocationSelect,
  initialLocation,
}) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [latitude, setLatitude] = useState(
    initialLocation?.latitude?.toString() || '-12.0464'
  );
  const [longitude, setLongitude] = useState(
    initialLocation?.longitude?.toString() || '-77.0428'
  );
  const [address, setAddress] = useState(initialLocation?.addressLine1 || '');

  const handleConfirm = () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      Alert.alert('Error', 'Por favor ingresa coordenadas válidas');
      return;
    }

    onLocationSelect({
      latitude: lat,
      longitude: lng,
      addressLine1: address,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Seleccionar Ubicación</Text>
          <Text style={styles.subtitle}>
            Nota: En la versión web, ingresa las coordenadas manualmente.
            {'\n'}Usa Google Maps para obtener las coordenadas exactas.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Latitud:</Text>
            <TextInput
              style={styles.input}
              value={latitude}
              onChangeText={setLatitude}
              placeholder="-12.0464"
              placeholderTextColor={theme.color.text.placeholder}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Longitud:</Text>
            <TextInput
              style={styles.input}
              value={longitude}
              onChangeText={setLongitude}
              placeholder="-77.0428"
              placeholderTextColor={theme.color.text.placeholder}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Dirección:</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="Ingresa la dirección"
              placeholderTextColor={theme.color.text.placeholder}
            />
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
              <Text style={styles.confirmButtonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[5],
      width: '90%',
      maxWidth: 500,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: theme.space[2],
      textAlign: 'center',
      color: theme.color.text.heading,
    },
    subtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginBottom: theme.space[5],
      textAlign: 'center',
    },
    inputContainer: {
      marginBottom: theme.space[4],
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: theme.space[1],
      color: theme.color.text.body,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      padding: theme.space[2],
      fontSize: 16,
      color: theme.color.text.heading,
      backgroundColor: theme.color.surface.base,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: theme.space[5],
    },
    cancelButton: {
      flex: 1,
      backgroundColor: theme.color.surface.muted,
      padding: theme.space[4],
      borderRadius: theme.radii.md,
      marginRight: theme.space[2],
    },
    cancelButtonText: {
      textAlign: 'center',
      fontSize: 16,
      color: theme.color.text.body,
      fontWeight: '600',
    },
    confirmButton: {
      flex: 1,
      backgroundColor: theme.color.brand.primary,
      padding: theme.space[4],
      borderRadius: theme.radii.md,
    },
    confirmButtonText: {
      textAlign: 'center',
      fontSize: 16,
      color: theme.color.text.onAction,
      fontWeight: '600',
    },
  });

export default LocationPickerModal;
