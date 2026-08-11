/**
 * DriveFAB
 *
 * FAB rojo con speed-dial vertical hacia arriba y a la izquierda.
 * Estilos idénticos a `ExpensesFAB` (rojo `action.danger.background`,
 * borde blanco de 3px, label pill blanca a la izquierda).
 *
 * Se posiciona respetando la altura de la BottomBar via FloatingFooterProvider.
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles, useTheme } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { useFloatingActionBottomOffset } from '@/design-system/layout/FloatingFooterProvider';

export type DriveFABActionId = 'upload-file' | 'upload-folder' | 'new-folder' | 'new-space';

interface ActionOption {
  id: DriveFABActionId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export interface DriveFABProps {
  onAction: (id: DriveFABActionId) => void;
  actions: DriveFABActionId[];
  /** Si false, no renderiza nada. */
  visible?: boolean;
}

export const DriveFAB: React.FC<DriveFABProps> = ({ onAction, actions, visible = true }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  // Tier "module": el FAB queda encima de la BottomBar y por debajo del botón menú/reload
  const bottomOffset = useFloatingActionBottomOffset('module', insets.bottom, 0);

  const [isOpen, setIsOpen] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  // Aseguramos sincrónicamente una animation.Value por cada acción actual
  const buttonAnimsRef = useRef<Animated.Value[]>([]);
  while (buttonAnimsRef.current.length < actions.length) {
    buttonAnimsRef.current.push(new Animated.Value(0));
  }
  const buttonAnims = buttonAnimsRef.current;

  // Catálogo dentro del componente para acceder al theme
  const ACTION_CATALOG: Record<DriveFABActionId, Omit<ActionOption, 'id'>> = {
    'upload-file': {
      label: 'Subir archivo',
      icon: 'cloud-upload',
      color: theme.color.icon.accent,
    },
    'upload-folder': {
      label: 'Subir carpeta',
      icon: 'folder-open',
      color: theme.color.brand.primary,
    },
    'new-folder': {
      label: 'Nueva carpeta',
      icon: 'folder',
      color: theme.color.icon.success,
    },
    'new-space': {
      label: 'Nuevo espacio',
      icon: 'albums',
      color: theme.color.icon.warning,
    },
  };

  if (!visible || actions.length === 0) return null;

  const options: ActionOption[] = actions.map((id) => ({ id, ...ACTION_CATALOG[id] }));

  const toggle = () => {
    const to = isOpen ? 0 : 1;
    Animated.parallel([
      Animated.timing(rotateAnim, { toValue: to, duration: 300, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: to, duration: 300, useNativeDriver: true }),
      Animated.stagger(
        50,
        buttonAnims
          .slice(0, options.length)
          .map((a) =>
            Animated.spring(a, { toValue: to, friction: 5, tension: 40, useNativeDriver: true })
          )
      ),
    ]).start();
    setIsOpen((v) => !v);
  };

  const handleAction = (id: DriveFABActionId) => {
    toggle();
    setTimeout(() => onAction(id), 300);
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const verticalSpacing = isTablet ? 70 : 65;
  const horizontalOffset = isTablet ? -80 : -70;

  const getButtonPosition = (index: number) => ({
    x: horizontalOffset,
    y: -(verticalSpacing * (index + 1)),
  });

  return (
    <>
      {/* Overlay oscuro */}
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: overlayAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
          },
        ]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={toggle} activeOpacity={1} />
      </Animated.View>

      {/* Contenedor absoluto anclado a la esquina inferior derecha */}
      <View
        style={[styles.fabContainer, { bottom: bottomOffset, right: isTablet ? 30 : 20 }]}
        pointerEvents="box-none"
      >
        {/* Botones de acciones */}
        {options.map((opt, index) => {
          const pos = getButtonPosition(index);
          const anim = buttonAnims[index];
          return (
            <Animated.View
              key={opt.id}
              style={[
                styles.optionButtonContainer,
                {
                  opacity: anim,
                  transform: [
                    {
                      translateX: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, pos.x],
                      }),
                    },
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, pos.y],
                      }),
                    },
                    {
                      scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                    },
                  ],
                },
              ]}
              pointerEvents={isOpen ? 'auto' : 'none'}
            >
              <View style={styles.optionRow}>
                <View style={styles.labelContainer}>
                  <RNText style={[styles.optionLabel, isTablet && styles.optionLabelTablet]}>
                    {opt.label}
                  </RNText>
                </View>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    isTablet && styles.optionButtonTablet,
                    { backgroundColor: opt.color },
                  ]}
                  onPress={() => handleAction(opt.id)}
                  activeOpacity={0.9}
                >
                  <Ionicons
                    name={opt.icon}
                    size={isTablet ? 24 : 20}
                    color={theme.color.text.inverse}
                  />
                </TouchableOpacity>
              </View>
            </Animated.View>
          );
        })}

        {/* FAB principal */}
        <Animated.View style={[styles.mainFabContainer, { transform: [{ rotate: rotation }] }]}>
          <TouchableOpacity
            style={[styles.mainFab, isTablet && styles.mainFabTablet]}
            onPress={toggle}
            activeOpacity={0.9}
            accessibilityLabel="Acciones del Drive"
          >
            <RNText style={[styles.mainFabIcon, isTablet && styles.mainFabIconTablet]}>+</RNText>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: theme.color.shadow,
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
      backgroundColor: theme.color.action.danger.background,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.color.action.danger.background,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 12,
      borderWidth: 3,
      borderColor: theme.color.surface.base,
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
      color: theme.color.text.inverse,
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
      gap: theme.space[3],
    },
    optionButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
      borderWidth: 2,
      borderColor: theme.color.surface.base,
    },
    optionButtonTablet: {
      width: 56,
      height: 56,
      borderRadius: 28,
    },
    labelContainer: {
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: theme.space[3],
      paddingVertical: 6,
      borderRadius: theme.radii.xl,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
      minWidth: 140,
    },
    optionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.heading,
      textAlign: 'center',
    },
    optionLabelTablet: {
      fontSize: 13,
    },
  });

export default DriveFAB;
