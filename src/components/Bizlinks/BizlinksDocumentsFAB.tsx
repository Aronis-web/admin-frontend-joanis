import React, { useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BizlinksDocumentType } from '@/types/bizlinks';

interface BizlinksDocumentsFABProps {
  onDocumentTypeSelect: (documentType: BizlinksDocumentType) => void;
}

interface DocumentTypeOption {
  type: BizlinksDocumentType;
  label: string;
  color: string;
  icon: string;
}

export const BizlinksDocumentsFAB: React.FC<BizlinksDocumentsFABProps> = ({
  onDocumentTypeSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Individual animations for each button
  const button1Anim = useRef(new Animated.Value(0)).current;
  const button2Anim = useRef(new Animated.Value(0)).current;
  const button3Anim = useRef(new Animated.Value(0)).current;
  const button4Anim = useRef(new Animated.Value(0)).current;
  const button5Anim = useRef(new Animated.Value(0)).current;

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const documentTypes: DocumentTypeOption[] = [
    {
      type: BizlinksDocumentType.FACTURA,
      label: 'Factura Electrónica',
      color: '#3B82F6',
      icon: '📄',
    },
    {
      type: BizlinksDocumentType.BOLETA,
      label: 'Boleta de Venta',
      color: '#10B981',
      icon: '🧾',
    },
    {
      type: BizlinksDocumentType.NOTA_CREDITO,
      label: 'Nota de Crédito',
      color: '#F59E0B',
      icon: '📝',
    },
    {
      type: BizlinksDocumentType.NOTA_DEBITO,
      label: 'Nota de Débito',
      color: '#EF4444',
      icon: '📋',
    },
    {
      type: BizlinksDocumentType.GUIA_REMISION_REMITENTE,
      label: 'Guía de Remisión',
      color: '#8B5CF6',
      icon: '🚚',
    },
  ];

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;

    Animated.parallel([
      // Rotate main button
      Animated.timing(rotateAnim, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
      // Fade in/out overlay
      Animated.timing(opacityAnim, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
      // Animate option buttons with stagger
      Animated.stagger(50, [
        Animated.spring(button1Anim, {
          toValue,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(button2Anim, {
          toValue,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(button3Anim, {
          toValue,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(button4Anim, {
          toValue,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.spring(button5Anim, {
          toValue,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    setIsOpen(!isOpen);
  };

  const handleDocumentTypePress = (documentType: BizlinksDocumentType) => {
    toggleMenu();
    setTimeout(() => {
      onDocumentTypeSelect(documentType);
    }, 300);
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const buttonAnims = [button1Anim, button2Anim, button3Anim, button4Anim, button5Anim];

  // Calculate positions in a vertical stack (upward)
  const getButtonPosition = (index: number) => {
    const spacing = isTablet ? 70 : 65; // Vertical spacing between buttons
    const offsetX = isTablet ? -80 : -70; // Move to the left

    // Stack buttons vertically upward from the main FAB
    const position = {
      x: offsetX,
      y: -(spacing * (index + 1)), // Negative Y goes up
    };

    return position;
  };

  return (
    <>
      {/* Overlay */}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: opacityAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.5],
            }),
          },
        ]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={toggleMenu} activeOpacity={1} />
      </Animated.View>

      {/* Container for all buttons */}
      <View
        style={[
          styles.fabContainer,
          {
            bottom: insets.bottom + 90,
            right: isTablet ? 30 : 20,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Document Type Buttons */}
        {documentTypes.map((docType, index) => {
          const position = getButtonPosition(index);
          const buttonAnim = buttonAnims[index];

          return (
            <Animated.View
              key={docType.type}
              style={[
                styles.optionButtonContainer,
                {
                  opacity: buttonAnim,
                  transform: [
                    {
                      translateX: buttonAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, position.x],
                      }),
                    },
                    {
                      translateY: buttonAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, position.y],
                      }),
                    },
                    {
                      scale: buttonAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 1],
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents={isOpen ? 'auto' : 'none'}
            >
              <View style={styles.optionRow}>
                <View style={styles.labelContainer}>
                  <Text style={[styles.optionLabel, isTablet && styles.optionLabelTablet]}>
                    {docType.label}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    isTablet && styles.optionButtonTablet,
                    { backgroundColor: docType.color },
                  ]}
                  onPress={() => handleDocumentTypePress(docType.type)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.optionIcon, isTablet && styles.optionIconTablet]}>
                    {docType.icon}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          );
        })}

        {/* Main FAB */}
        <Animated.View
          style={[
            styles.mainFabContainer,
            {
              transform: [{ scale: scaleAnim }, { rotate: rotation }],
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.mainFab, isTablet && styles.mainFabTablet]}
            onPress={toggleMenu}
            activeOpacity={0.9}
          >
            <Text style={[styles.mainFabIcon, isTablet && styles.mainFabIconTablet]}>+</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 10000,
  },
  fabContainer: {
    position: 'absolute',
    zIndex: 10001,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainFabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  mainFabTablet: {
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowRadius: 16,
    elevation: 10,
  },
  mainFabIcon: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  mainFabIconTablet: {
    fontSize: 32,
  },
  optionButtonContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  optionButtonTablet: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  optionIcon: {
    fontSize: 20,
  },
  optionIconTablet: {
    fontSize: 24,
  },
  labelContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 140,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  optionLabelTablet: {
    fontSize: 13,
  },
});
