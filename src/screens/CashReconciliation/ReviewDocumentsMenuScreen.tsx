/**
 * ReviewDocumentsMenuScreen.tsx
 * Menú de selección para revisar documentos
 * Rediseñado con sistema de diseño global
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { durations } from '@/design-system/tokens/animations';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { useTheme } from '@/design-system/themes';
import { useThemedStyles } from '@/design-system/themes/useThemedStyles';
import type { Theme } from '@/design-system/themes/defaultLight';

type Props = NativeStackScreenProps<any, 'ReviewDocumentsMenu'>;

// Prosegur vendor brand color (no equivalente semantico en theme)
const PROSEGUR_BRAND = '#8B5CF6';
const PROSEGUR_BRAND_SOFT = '#F3E8FF';

interface MenuOption {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
  lightColor: string;
}

export const ReviewDocumentsMenuScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cardAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    // Header animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: durations.normal,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: durations.normal,
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered card animations
    const cardAnimations = cardAnims.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: durations.normal,
        delay: index * 100,
        useNativeDriver: true,
      })
    );
    Animated.stagger(100, cardAnimations).start();
  }, []);

  const menuOptions: MenuOption[] = [
    {
      id: 'review-sales',
      title: 'Revisar Ventas',
      description: 'Consultar y filtrar ventas registradas en el sistema',
      icon: '💰',
      route: 'ReviewSales',
      color: theme.color.state.success.border,
      lightColor: theme.color.state.success.background,
    },
    {
      id: 'review-izipay',
      title: 'Revisar Izipay',
      description: 'Consultar transacciones de Izipay con filtros avanzados',
      icon: '💳',
      route: 'ReviewIzipay',
      color: theme.color.brand.accent,
      lightColor: theme.color.brand.accentSoft,
    },
    {
      id: 'review-prosegur',
      title: 'Revisar Prosegur',
      description: 'Consultar depósitos y recogidas de Prosegur',
      icon: '🏦',
      route: 'ReviewProsegur',
      color: PROSEGUR_BRAND,
      lightColor: PROSEGUR_BRAND_SOFT,
    },
  ];

  const renderOption = (option: MenuOption, index: number) => {
    const animatedStyle = {
      opacity: cardAnims[index],
      transform: [
        {
          translateY: cardAnims[index].interpolate({
            inputRange: [0, 1],
            outputRange: [30, 0],
          }),
        },
        {
          scale: cardAnims[index].interpolate({
            inputRange: [0, 1],
            outputRange: [0.95, 1],
          }),
        },
      ],
    };

    return (
      <Animated.View key={option.id} style={animatedStyle}>
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => navigation.navigate(option.route)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, { backgroundColor: option.lightColor }]}>
            <Text style={styles.icon}>{option.icon}</Text>
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>{option.title}</Text>
            <Text style={styles.menuDescription}>{option.description}</Text>
          </View>
          <View style={[styles.arrowContainer, { backgroundColor: option.lightColor }]}>
            <Text style={[styles.arrow, { color: option.color }]}>→</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <ScreenLayout navigation={navigation as any}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header con gradiente */}
        <LinearGradient
          colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButtonGradient}>
              <Ionicons name="arrow-back" size={24} color={theme.color.brand.onHeader} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIconRow}>
                <View style={styles.headerIconContainer}>
                  <Ionicons name="document-text-outline" size={22} color={theme.color.brand.onHeader} />
                </View>
                <Text style={styles.titleGradient}>Revisar Documentos</Text>
              </View>
              <Text style={styles.subtitleGradient}>Consulta información del sistema</Text>
            </View>
          </View>
        </LinearGradient>

      {/* Menu Options */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.menuContainer}>
          {/* Info Card */}
          <Animated.View
            style={[
              styles.infoCard,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.infoIconContainer}>
              <Text style={styles.infoIcon}>📋</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Selecciona el tipo de documento</Text>
              <Text style={styles.infoText}>
                Elige una opción para revisar los documentos correspondientes con filtros avanzados
              </Text>
            </View>
          </Animated.View>

          {/* Menu Cards */}
          <View style={styles.cardsContainer}>
            {menuOptions.map((option, index) => renderOption(option, index))}
          </View>

          {/* Help Section */}
          <Animated.View
            style={[
              styles.helpCard,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            <Text style={styles.helpIcon}>💡</Text>
            <Text style={styles.helpText}>
              Puedes filtrar por fecha, sede y otros criterios en cada sección
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
      </View>
    </ScreenLayout>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  // Header con gradiente
  headerGradient: {
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[4],
    paddingBottom: theme.space[4],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[1],
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.headerBadge,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  titleGradient: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
    letterSpacing: 0.3,
  },
  subtitleGradient: {
    fontSize: 14,
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    marginLeft: theme.space[12],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space[4],
    paddingVertical: theme.space[4],
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
    ...theme.shadow.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.full,
    backgroundColor: theme.color.surface.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: theme.color.text.body,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.color.text.subtle,
    marginTop: theme.space[1],
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  menuContainer: {
    padding: theme.space[4],
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: theme.color.state.info.background,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    marginBottom: theme.space[5],
    borderWidth: 1,
    borderColor: theme.color.state.info.border,
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  infoIcon: {
    fontSize: 24,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.state.info.text,
    marginBottom: theme.space[1],
  },
  infoText: {
    fontSize: 12,
    color: theme.color.state.info.text,
    lineHeight: 18,
  },
  cardsContainer: {
    gap: theme.space[3],
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii.xl,
    padding: theme.space[4],
    ...theme.shadow.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[4],
  },
  icon: {
    fontSize: 28,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: theme.space[1],
  },
  menuDescription: {
    fontSize: 12,
    color: theme.color.text.subtle,
    lineHeight: 18,
  },
  arrowContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.space[2],
  },
  arrow: {
    fontSize: 20,
    fontWeight: '700',
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.state.warning.background,
    borderRadius: theme.radii.lg,
    padding: theme.space[4],
    marginTop: theme.space[5],
    borderWidth: 1,
    borderColor: theme.color.state.warning.border,
  },
  helpIcon: {
    fontSize: 20,
    marginRight: theme.space[3],
  },
  helpText: {
    flex: 1,
    fontSize: 12,
    color: theme.color.state.warning.text,
    lineHeight: 18,
  },
});
