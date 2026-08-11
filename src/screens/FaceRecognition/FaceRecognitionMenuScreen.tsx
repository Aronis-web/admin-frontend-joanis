import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { spacing, borderRadius } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

export const FaceRecognitionMenuScreen: React.FC = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const menuOptions = [
    {
      id: 'profiles',
      title: 'Ver Perfiles',
      description: 'Lista de perfiles biométricos registrados',
      icon: 'people' as const,
      color: theme.color.icon.accent,
      screen: 'BiometricProfiles',
    },
    {
      id: 'register',
      title: 'Registrar Rostro',
      description: 'Captura y registra un nuevo rostro en el sistema',
      icon: 'face' as const,
      color: theme.color.brand.accent,
      screen: 'RegisterFace',
    },
    {
      id: 'verify',
      title: 'Verificar Rostro',
      description: 'Verifica la identidad comparando con un perfil registrado',
      icon: 'verified-user' as const,
      color: theme.color.icon.success,
      screen: 'VerifyFace',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <MaterialIcons
            name="face-retouching-natural"
            size={80}
            color={theme.color.brand.accent}
          />
          <Text style={styles.title}>Reconocimiento Facial</Text>
          <Text style={styles.subtitle}>
            Sistema de verificación biométrica para autenticación segura
          </Text>
        </View>

        <View style={styles.menuContainer}>
          {menuOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.menuCard}
              onPress={() => navigation.navigate(option.screen as never)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: `${option.color}15` }]}>
                <MaterialIcons name={option.icon} size={40} color={option.color} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{option.title}</Text>
                <Text style={styles.menuDescription}>{option.description}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={theme.color.icon.disabled} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Características</Text>
          <View style={styles.featureItem}>
            <MaterialIcons name="check-circle" size={20} color={theme.color.icon.success} />
            <Text style={styles.featureText}>Detección de vivacidad (anti-spoofing)</Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialIcons name="check-circle" size={20} color={theme.color.icon.success} />
            <Text style={styles.featureText}>Reconocimiento facial de alta precisión</Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialIcons name="check-circle" size={20} color={theme.color.icon.success} />
            <Text style={styles.featureText}>Verificación 1:1 contra perfil específico</Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialIcons name="check-circle" size={20} color={theme.color.icon.success} />
            <Text style={styles.featureText}>Procesamiento seguro y privado</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    scrollContent: {
      padding: spacing[5],
    },
    header: {
      alignItems: 'center',
      marginBottom: 30,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginTop: spacing[4],
    },
    subtitle: {
      fontSize: 16,
      color: theme.color.text.muted,
      textAlign: 'center',
      marginTop: spacing[2],
      paddingHorizontal: spacing[5],
    },
    menuContainer: {
      gap: spacing[4],
      marginBottom: spacing[8],
    },
    menuCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[4],
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: borderRadius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing[4],
    },
    menuContent: {
      flex: 1,
    },
    menuTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: spacing[1],
    },
    menuDescription: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    featuresContainer: {
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[5],
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    featuresTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: spacing[4],
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing[3],
      gap: spacing[2.5],
    },
    featureText: {
      fontSize: 14,
      color: theme.color.text.muted,
      flex: 1,
    },
  });
