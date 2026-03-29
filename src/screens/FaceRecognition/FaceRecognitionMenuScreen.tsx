import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';

export const FaceRecognitionMenuScreen: React.FC = () => {
  const navigation = useNavigation();

  const menuOptions = [
    {
      id: 'profiles',
      title: 'Ver Perfiles',
      description: 'Lista de perfiles biométricos registrados',
      icon: 'people' as const,
      color: colors.accent[600],
      screen: 'BiometricProfiles',
    },
    {
      id: 'register',
      title: 'Registrar Rostro',
      description: 'Captura y registra un nuevo rostro en el sistema',
      icon: 'face' as const,
      color: colors.primary[500],
      screen: 'RegisterFace',
    },
    {
      id: 'verify',
      title: 'Verificar Rostro',
      description: 'Verifica la identidad comparando con un perfil registrado',
      icon: 'verified-user' as const,
      color: colors.success[500],
      screen: 'VerifyFace',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <MaterialIcons name="face-retouching-natural" size={80} color={colors.primary[500]} />
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
              <MaterialIcons name="chevron-right" size={24} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Características</Text>
          <View style={styles.featureItem}>
            <MaterialIcons name="check-circle" size={20} color={colors.success[500]} />
            <Text style={styles.featureText}>Detección de vivacidad (anti-spoofing)</Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialIcons name="check-circle" size={20} color={colors.success[500]} />
            <Text style={styles.featureText}>Reconocimiento facial de alta precisión</Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialIcons name="check-circle" size={20} color={colors.success[500]} />
            <Text style={styles.featureText}>Verificación 1:1 contra perfil específico</Text>
          </View>
          <View style={styles.featureItem}>
            <MaterialIcons name="check-circle" size={20} color={colors.success[500]} />
            <Text style={styles.featureText}>Procesamiento seguro y privado</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
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
    color: colors.neutral[800],
    marginTop: spacing[4],
  },
  subtitle: {
    fontSize: 16,
    color: colors.neutral[500],
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
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    shadowColor: colors.neutral[950],
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
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  menuDescription: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  featuresContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.neutral[800],
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
    color: colors.neutral[600],
    flex: 1,
  },
});
