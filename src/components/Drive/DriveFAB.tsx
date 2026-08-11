/**
 * DriveFAB
 *
 * FAB rojo con speed-dial vertical para acciones de creación/subida.
 * Mismo estilo visual que `BizlinksDocumentsFAB` y `ExpensesFAB`.
 * Se posiciona respetando la altura de la BottomBar (via FloatingFooterProvider).
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
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

const ACTION_CATALOG: Record<DriveFABActionId, Omit<ActionOption, 'id'>> = {
  'upload-file': { label: 'Subir archivo', icon: 'cloud-upload-outline', color: '#3B82F6' },
  'upload-folder': { label: 'Subir carpeta', icon: 'folder-open-outline', color: '#8B5CF6' },
  'new-folder': { label: 'Nueva carpeta', icon: 'folder-outline', color: '#10B981' },
  'new-space': { label: 'Nuevo espacio', icon: 'albums-outline', color: '#F59E0B' },
};

export const DriveFAB: React.FC<DriveFABProps> = ({ onAction, actions, visible = true }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  // Tier "module": queda encima de la BottomBar y por debajo del botón de menú/reload.
  const bottomOffset = useFloatingActionBottomOffset('module', insets.bottom, 0);

  const [isOpen, setIsOpen] = useState(false);
  const rotate = useRef(new Animated.Value(0)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const buttonAnims = useRef(actions.map(() => new Animated.Value(0))).current;

  // Reajusta el número de anims si cambia el conjunto de acciones
  React.useEffect(() => {
    while (buttonAnims.length < actions.length) {
      buttonAnims.push(new Animated.Value(0));
    }
  }, [actions, buttonAnims]);

  if (!visible || actions.length === 0) return null;

  const options: ActionOption[] = actions.map((id) => ({ id, ...ACTION_CATALOG[id] }));

  const toggle = () => {
    const to = isOpen ? 0 : 1;
    Animated.parallel([
      Animated.timing(rotate, { toValue: to, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: to, duration: 250, useNativeDriver: true }),
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

  const handlePress = (id: DriveFABActionId) => {
    toggle();
    setTimeout(() => onAction(id), 250);
  };

  const rotation = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });
  const spacing = isTablet ? 70 : 64;

  return (
    <>
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: overlayOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }),
          },
        ]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={toggle} activeOpacity={1} />
      </Animated.View>

      <View
        style={[styles.container, { bottom: bottomOffset, right: isTablet ? 28 : 16 }]}
        pointerEvents="box-none"
      >
        {options.map((opt, index) => {
          const anim = buttonAnims[index];
          return (
            <Animated.View
              key={opt.id}
              pointerEvents={isOpen ? 'auto' : 'none'}
              style={[
                styles.optionWrap,
                {
                  opacity: anim,
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -spacing * (index + 1)],
                      }),
                    },
                    {
                      scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.labelPill}>
                <Text style={styles.labelText}>{opt.label}</Text>
              </View>
              <TouchableOpacity
                style={[styles.optionButton, { backgroundColor: opt.color }]}
                onPress={() => handlePress(opt.id)}
                activeOpacity={0.9}
              >
                <Ionicons name={opt.icon} size={22} color={theme.color.text.inverse} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <TouchableOpacity
            style={[styles.mainFab, isTablet && styles.mainFabTablet]}
            onPress={toggle}
            activeOpacity={0.9}
            accessibilityLabel="Acciones del Drive"
          >
            <Ionicons name="add" size={isTablet ? 32 : 28} color={theme.color.text.inverse} />
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
      backgroundColor: theme.color.overlay.strong,
      zIndex: 9998,
    },
    container: {
      position: 'absolute',
      zIndex: 10001,
      alignItems: 'center',
    },
    mainFab: {
      width: 56,
      height: 56,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.brand.accent,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.color.brand.accent,
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
    },
    optionWrap: {
      position: 'absolute',
      right: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    optionButton: {
      width: 48,
      height: 48,
      borderRadius: theme.radii.full,
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
    labelPill: {
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: theme.space[3],
      paddingVertical: 6,
      borderRadius: theme.radii.xl,
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    labelText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
  });

export default DriveFAB;
