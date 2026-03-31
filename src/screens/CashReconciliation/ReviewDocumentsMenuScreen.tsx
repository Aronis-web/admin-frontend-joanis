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

import { colors } from '@/design-system/tokens/colors';
import { spacing, borderRadius } from '@/design-system/tokens/spacing';
import { shadows } from '@/design-system/tokens/shadows';
import { fontSizes, fontWeights } from '@/design-system/tokens/typography';
import { durations } from '@/design-system/tokens/animations';

type Props = NativeStackScreenProps<any, 'ReviewDocumentsMenu'>;

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
      color: colors.success[500],
      lightColor: colors.success[50],
    },
    {
      id: 'review-izipay',
      title: 'Revisar Izipay',
      description: 'Consultar transacciones de Izipay con filtros avanzados',
      icon: '💳',
      route: 'ReviewIzipay',
      color: colors.primary[500],
      lightColor: colors.primary[50],
    },
    {
      id: 'review-prosegur',
      title: 'Revisar Prosegur',
      description: 'Consultar depósitos y recogidas de Prosegur',
      icon: '🏦',
      route: 'ReviewProsegur',
      color: '#8B5CF6',
      lightColor: '#F3E8FF',
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Revisar Documentos</Text>
          <Text style={styles.headerSubtitle}>Consulta información del sistema</Text>
        </View>
        <View style={styles.placeholder} />
      </Animated.View>

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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    ...shadows.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: fontSizes['2xl'],
    color: colors.neutral[700],
    fontWeight: fontWeights.semibold,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
  },
  headerSubtitle: {
    fontSize: fontSizes.xs,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  placeholder: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  menuContainer: {
    padding: spacing[4],
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[5],
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  infoIcon: {
    fontSize: 24,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.primary[800],
    marginBottom: spacing[1],
  },
  infoText: {
    fontSize: fontSizes.xs,
    color: colors.primary[600],
    lineHeight: 18,
  },
  cardsContainer: {
    gap: spacing[3],
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    ...shadows.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  icon: {
    fontSize: 28,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.neutral[900],
    marginBottom: spacing[1],
  },
  menuDescription: {
    fontSize: fontSizes.xs,
    color: colors.neutral[500],
    lineHeight: 18,
  },
  arrowContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing[2],
  },
  arrow: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
  },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning[50],
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginTop: spacing[5],
    borderWidth: 1,
    borderColor: colors.warning[100],
  },
  helpIcon: {
    fontSize: 20,
    marginRight: spacing[3],
  },
  helpText: {
    flex: 1,
    fontSize: fontSizes.xs,
    color: colors.warning[700],
    lineHeight: 18,
  },
});
