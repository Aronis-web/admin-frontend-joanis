import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { biometricApi, BiometricProfile } from '@/services/api/biometric';

export const BiometricProfilesScreen: React.FC = () => {
  const navigation = useNavigation();
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
                <MaterialIcons name="photo-camera" size={14} color={colors.neutral[500]} />
                <Text style={styles.statText}>
                  {item.registration_frames_count || 0} frames
                </Text>
              </View>
              <View style={styles.statBadge}>
                <MaterialIcons name="verified" size={14} color={colors.success[500]} />
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
              <MaterialIcons name="face" size={24} color={colors.neutral[0]} />
              <Text style={styles.actionButtonText}>Verificar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDeleteProfile(item)}
            >
              <MaterialIcons name="delete" size={24} color={colors.neutral[0]} />
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
      <MaterialIcons name="face-retouching-off" size={64} color={colors.neutral[300]} />
      <Text style={styles.emptyTitle}>No hay perfiles registrados</Text>
      <Text style={styles.emptyText}>
        Registra un nuevo rostro para comenzar
      </Text>
      <TouchableOpacity
        style={styles.registerButton}
        onPress={() => navigation.navigate('RegisterFace' as never)}
      >
        <MaterialIcons name="add-a-photo" size={24} color={colors.neutral[0]} />
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
          <MaterialIcons name="add" size={24} color={colors.primary[500]} />
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
          <ActivityIndicator size="large" color={colors.primary[500]} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.neutral[800],
  },
  addButton: {
    padding: spacing[2],
  },
  filterContainer: {
    backgroundColor: colors.surface.primary,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[500],
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
    backgroundColor: colors.neutral[100],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  filterButtonActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  filterIcon: {
    fontSize: 16,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  filterButtonTextActive: {
    color: colors.neutral[0],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing[3],
    fontSize: 16,
    color: colors.neutral[500],
  },
  listContent: {
    padding: spacing[4],
  },
  profileCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    shadowColor: colors.neutral[950],
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
    color: colors.neutral[800],
    marginBottom: spacing[1],
  },
  profileType: {
    fontSize: 14,
    color: colors.neutral[500],
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
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.xl,
  },
  statText: {
    fontSize: 12,
    color: colors.neutral[500],
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
    backgroundColor: colors.primary[500],
  },
  deleteButton: {
    backgroundColor: colors.danger[500],
    paddingHorizontal: spacing[3],
  },
  actionButtonText: {
    color: colors.neutral[0],
    fontSize: 14,
    fontWeight: '600',
  },
  profileDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  detailText: {
    fontSize: 12,
    color: colors.neutral[500],
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
    color: colors.neutral[800],
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  emptyText: {
    fontSize: 14,
    color: colors.neutral[500],
    marginBottom: spacing[6],
    textAlign: 'center',
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  registerButtonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: '600',
  },
});
