import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    padding: spacing[5],
    width: '90%',
    maxWidth: 500,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: spacing[2],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: spacing[5],
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: spacing[4],
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: spacing[1],
    color: colors.neutral[700],
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral[300],
    borderRadius: borderRadius.md,
    padding: spacing[2],
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[5],
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.neutral[100],
    padding: spacing[4],
    borderRadius: borderRadius.md,
    marginRight: spacing[2],
  },
  cancelButtonText: {
    textAlign: 'center',
    fontSize: 16,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.primary[500],
    padding: spacing[4],
    borderRadius: borderRadius.md,
  },
  confirmButtonText: {
    textAlign: 'center',
    fontSize: 16,
    color: colors.neutral[0],
    fontWeight: '600',
  },
});

export default LocationPickerModal;
