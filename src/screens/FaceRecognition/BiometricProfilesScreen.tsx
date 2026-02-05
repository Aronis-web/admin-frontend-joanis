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
      // TODO: Implementar endpoint para listar perfiles
      // Por ahora mostramos un mensaje
      setProfiles([]);
    } catch (error) {
      console.error('Error cargando perfiles:', error);
      Alert.alert('Error', 'No se pudieron cargar los perfiles biométricos');
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
      prefilledEntityType: profile.entityType,
      prefilledEntityId: profile.entityId,
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

  const renderProfile = ({ item }: { item: BiometricProfile }) => (
    <View style={styles.profileCard}>
      <View style={styles.profileHeader}>
        <View style={styles.profileInfo}>
          <Text style={styles.profileId}>{item.entityId}</Text>
          <Text style={styles.profileType}>{item.entityType}</Text>
          <View style={styles.profileStats}>
            <View style={styles.statBadge}>
              <MaterialIcons name="photo-camera" size={14} color="#666" />
              <Text style={styles.statText}>{item.registrationFramesCount} frames</Text>
            </View>
            <View style={styles.statBadge}>
              <MaterialIcons name="verified" size={14} color="#34C759" />
              <Text style={styles.statText}>{item.registrationQuality.toFixed(0)}%</Text>
            </View>
          </View>
        </View>
        <View style={styles.profileActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.verifyButton]}
            onPress={() => handleVerifyProfile(item)}
          >
            <MaterialIcons name="face" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Verificar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteProfile(item)}
          >
            <MaterialIcons name="delete" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.profileDetails}>
        <Text style={styles.detailText}>
          Registrado: {new Date(item.registeredAt).toLocaleDateString()}
        </Text>
        <Text style={styles.detailText}>
          Liveness: {item.livenessScoreAtRegistration.toFixed(0)}%
        </Text>
        <Text style={styles.detailText}>
          Estado: {item.isActive ? '✅ Activo' : '❌ Inactivo'}
        </Text>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="face-retouching-off" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No hay perfiles registrados</Text>
      <Text style={styles.emptyText}>
        Registra un nuevo rostro para comenzar
      </Text>
      <TouchableOpacity
        style={styles.registerButton}
        onPress={() => navigation.navigate('RegisterFace' as never)}
      >
        <MaterialIcons name="add-a-photo" size={24} color="#fff" />
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
          <MaterialIcons name="add" size={24} color="#007AFF" />
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
          <ActivityIndicator size="large" color="#007AFF" />
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    padding: 8,
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterIcon: {
    fontSize: 16,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
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
    color: '#333',
    marginBottom: 4,
  },
  profileType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  profileStats: {
    flexDirection: 'row',
    gap: 8,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  profileActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  verifyButton: {
    backgroundColor: '#007AFF',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  profileDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  detailText: {
    fontSize: 12,
    color: '#666',
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
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
