import React, { useRef, useState } from 'react';
import Alert from '@/utils/alert';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import ViewShot from 'react-native-view-shot';

interface SignatureCaptureProps {
  onSignatureCapture: (signature: string) => void;
  onCancel: () => void;
}

export const SignatureCapture: React.FC<SignatureCaptureProps> = ({
  onSignatureCapture,
  onCancel,
}) => {
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const viewShotRef = useRef<ViewShot>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(`M${locationX},${locationY}`);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath((prev) => `${prev} L${locationX},${locationY}`);
      },
      onPanResponderRelease: () => {
        if (currentPath) {
          setPaths((prev) => [...prev, currentPath]);
          setCurrentPath('');
        }
      },
    })
  ).current;

  const handleClear = () => {
    setPaths([]);
    setCurrentPath('');
  };

  const handleConfirm = async () => {
    // Verificar si hay firma (paths guardados o trazo actual)
    const hasSignatureData = paths.length > 0 || currentPath.length > 0;

    if (!hasSignatureData) {
      Alert.alert('Error', 'Por favor firme antes de confirmar');
      return;
    }

    // Si hay un trazo actual sin guardar, guardarlo primero
    if (currentPath) {
      setPaths((prev) => [...prev, currentPath]);
      setCurrentPath('');
      // Esperar un momento para que se actualice el estado
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    try {
      if (viewShotRef.current && viewShotRef.current.capture) {
        const uri = await viewShotRef.current.capture();
        onSignatureCapture(uri);
      }
    } catch (error) {
      console.error('Error capturing signature:', error);
      Alert.alert('Error', 'No se pudo capturar la firma');
    }
  };

  const hasSignature = paths.length > 0 || currentPath.length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firma del Supervisor</Text>
      <Text style={styles.subtitle}>Por favor, firme en el área de abajo</Text>

      <ViewShot ref={viewShotRef} style={styles.signatureContainer}>
        <View style={styles.canvas} {...panResponder.panHandlers}>
          <Svg height="100%" width="100%">
            {paths.map((path, index) => (
              <Path
                key={index}
                d={path}
                stroke={colors.neutral[900]}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {currentPath && (
              <Path
                d={currentPath}
                stroke={colors.neutral[900]}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
          {!hasSignature && (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>Firme aquí</Text>
            </View>
          )}
        </View>
      </ViewShot>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearButtonText}>Limpiar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmButton, !hasSignature && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!hasSignature}
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
  signatureContainer: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[0],
    marginBottom: spacing[5],
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  placeholderText: {
    fontSize: 18,
    color: colors.neutral[300],
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  clearButton: {
    flex: 1,
    paddingVertical: spacing[3.5],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[600],
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
