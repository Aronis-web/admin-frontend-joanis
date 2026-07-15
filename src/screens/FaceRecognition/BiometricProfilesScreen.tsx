import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { spacing, borderRadius } from '@/design-system/tokens';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { biometricApi, BiometricProfile } from '@/services/api/biometric';
import Alert from '@/utils/alert';

export const BiometricProfilesScreen: React.FC = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [profiles, setProfiles] = useState<BiometricProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEntityType, setSelectedEntityType] = useState<string>('visitor');

  const entityTypes = [
    { value: 'employee', label: 'Empleados', icon: '👨‍💼' },
    { value: 'customer', label: 'Clientes', icon: '👤' },
    { value: 'user', label: 'Usuarios', icon: '🧑' },
    { value: 'driver', label: 'Conductores', icon: '🚗' },
    { value: 'visitor', label: 'Visitantes', icon: '🚶' },
  ];

  useEffect(() => {
    loadProfiles();
  }, [selectedEntityType]);

  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      const response = await biometricApi.listProfiles({
        entityType: selectedEntityType,
        // No filtrar por isActive para mostrar todos los perfiles
        limit: 100,
        offset: 0,
      });

      console.log('📋 Profiles loaded:', {
        total: response.total,
        count: response.profiles.length,
        entityType: selectedEntityType,
        firstProfile: response.profiles[0],
      });

      setProfiles(response.profiles);
    } catch (error: any) {
      console.error('Error cargando perfiles:', error);
      Alert.alert('Error', error.message || 'No se pudieron cargar los perfiles biométricos');
      setProfiles([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadProfiles();
  };

  const handleVerifyProfile = (profile: BiometricProfile) => {
    (navigation as any).navigate('VerifyFace', {
      prefilledEntityType: profile.entity_type,
      prefilledEntityId: profile.entity_id,
    });
  };

  const handleDeleteProfile = async (profile: BiometricProfile) => {
    Alert.alert(
      'Eliminar Perfil',
      `¿Estás seguro de que deseas eliminar el perfil biométrico?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await biometricApi.deleteBiometricProfile(profile.id);
              Alert.alert('Éxito', 'Perfil eliminado correctamente');
              loadProfiles();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar el perfil');
            }
          },
        },
      ]
    );
  };

  const renderProfile = ({ item }: { item: BiometricProfile }) => {
    console.log('🎨 Rendering profile:', item);

    // Convertir valores string a number si es necesario
    const registrationQuality = typeof item.registration_quality === 'string'
      ? parseFloat(item.registration_quality)
      : item.registration_quality;

    const livenessScore = typeof item.liveness_score_at_registration === 'string'
      ? parseFloat(item.liveness_score_at_registration)
      : item.liveness_score_at_registration;

    return (
      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.profileInfo}>
            <Text style={styles.profileId}>{item.entity_id || 'Sin ID'}</Text>
            <Text style={styles.profileType}>{item.entity_type || 'Sin tipo'}</Text>
            <View style={styles.profileStats}>
              <View style={styles.statBadge}>
                <MaterialIcons name="photo-camera" size={14} color={theme.color.icon.muted} />
                <Text style={styles.statText}>
                  {item.registration_frames_count || 0} frames
                </Text>
              </View>
              <View style={styles.statBadge}>
                <MaterialIcons name="verified" size={14} color={theme.color.icon.success} />
                <Text style={styles.statText}>
                  {registrationQuality ? (registrationQuality * 100).toFixed(0) : '0'}%
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.profileActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.verifyButton]}
              onPress={() => handleVerifyProfile(item)}
            >
              <MaterialIcons name="face" size={24} color={theme.color.text.inverse} />
              <Text style={styles.actionButtonText}>Verificar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteProfile(item)}
            >
              <MaterialIcons name="delete" size={24} color={theme.color.text.inverse} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.profileDetails}>
          <Text style={styles.detailText}>
            Registrado: {item.registered_at ? new Date(item.registered_at).toLocaleDateString() : 'N/A'}
          </Text>
          <Text style={styles.detailText}>
            Liveness: {livenessScore ? livenessScore.toFixed(0) : '0'}%
          </Text>
          <Text style={styles.detailText}>
            Estado: {item.is_active ? '✅ Activo' : '❌ Inactivo'}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons
        name="face-retouching-off"
        size={64}
        color={theme.color.icon.disabled}
      />
      <Text style={styles.emptyTitle}>No hay perfiles registrados</Text>
      <Text style={styles.emptyText}>
        Registra un nuevo rostro para comenzar
      </Text>
      <TouchableOpacity
        style={styles.registerButton}
        onPress={() => navigation.navigate('RegisterFace' as never)}
      >
        <MaterialIcons name="add-a-photo" size={24} color={theme.color.text.inverse} />
        <Text style={styles.registerButtonText}>Registrar Rostro</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Perfiles Biométricos</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('RegisterFace' as never)}
        >
          <MaterialIcons name="add" size={24} color={theme.color.brand.accent} />
        </TouchableOpacity>
      </View>

      {/* Filtro por tipo de entidad */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Tipo:</Text>
        <View style={styles.filterButtons}>
          {entityTypes.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.filterButton,
                selectedEntityType === type.value && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedEntityType(type.value)}
            >
              <Text style={styles.filterIcon}>{type.icon}</Text>
              <Text
                style={[
                  styles.filterButtonText,
                  selectedEntityType === type.value && styles.filterButtonTextActive,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.accent} />
          <Text style={styles.loadingText}>Cargando perfiles...</Text>
        </View>
      ) : (
        <FlatList
          data={profiles}
          renderItem={renderProfile}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[4],
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.color.text.heading,
    },
    addButton: {
      padding: spacing[2],
    },
    filterContainer: {
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    filterLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginBottom: spacing[2],
    },
    filterButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[1.5],
      borderRadius: borderRadius.full,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    filterButtonActive: {
      backgroundColor: theme.color.brand.accent,
      borderColor: theme.color.brand.accent,
    },
    filterIcon: {
      fontSize: 16,
    },
    filterButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    filterButtonTextActive: {
      color: theme.color.text.inverse,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: spacing[3],
      fontSize: 16,
      color: theme.color.text.muted,
    },
    listContent: {
      padding: spacing[4],
    },
    profileCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[4],
      marginBottom: spacing[3],
      shadowColor: theme.color.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    profileHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    profileInfo: {
      flex: 1,
    },
    profileId: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: spacing[1],
    },
    profileType: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginBottom: spacing[2],
    },
    profileStats: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    statBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[2],
      paddingVertical: spacing[1],
      backgroundColor: theme.color.surface.muted,
      borderRadius: borderRadius.xl,
    },
    statText: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    profileActions: {
      flexDirection: 'row',
      gap: spacing[2],
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1],
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[2],
      borderRadius: borderRadius.lg,
    },
    verifyButton: {
      backgroundColor: theme.color.brand.accent,
    },
    deleteButton: {
      backgroundColor: theme.color.action.danger.background,
      paddingHorizontal: spacing[3],
    },
    actionButtonText: {
      color: theme.color.text.inverse,
      fontSize: 14,
      fontWeight: '600',
    },
    profileDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: spacing[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.background.muted,
    },
    detailText: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginTop: spacing[4],
      marginBottom: spacing[2],
    },
    emptyText: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginBottom: spacing[6],
      textAlign: 'center',
    },
    registerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[2],
      backgroundColor: theme.color.brand.accent,
      paddingHorizontal: spacing[6],
      paddingVertical: spacing[3],
      borderRadius: borderRadius.lg,
    },
    registerButtonText: {
      color: theme.color.text.inverse,
      fontSize: 16,
      fontWeight: '600',
    },
  });
