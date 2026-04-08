import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { VideoCaptureCamera } from '@/components/FaceRecognition/VideoCaptureCamera';
import { biometricApi, VerifyFromVideoResponse } from '@/services/api/biometric';
import { usersApi, User } from '@/services/api/users';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Step = 'search' | 'camera' | 'processing' | 'result';

type RouteParams = {
  VerifyFace: {
    userId?: string;
    userName?: string;
    prefilledEntityType?: string;
    prefilledEntityId?: string;
  };
};

interface VideoCaptureResult {
  uri: string;
  type: string;
  name: string;
}

export const VerifyFaceScreen: React.FC = () => {
  const route = useRoute<RouteProp<RouteParams, 'VerifyFace'>>();
  const { userId, userName, prefilledEntityType, prefilledEntityId } = route.params || {};

  // Determine initial values
  const initialUserId = userId || prefilledEntityId;
  const initialEntityType = prefilledEntityType || (userId ? 'user' : 'employee');

  // Si viene con userId, ir directo a la cámara
  const initialStep: Step = initialUserId ? 'camera' : 'search';

  const [step, setStep] = useState<Step>(initialStep);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(
    initialUserId ? { id: initialUserId, email: userName || '', createdAt: '', updatedAt: '', status: 'active' } as User : null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyFromVideoResponse | null>(null);

  // Load user details if we have an initial userId
  useEffect(() => {
    if (initialUserId && !userName) {
      loadUserDetails(initialUserId);
    }
  }, [initialUserId]);

  const loadUserDetails = async (id: string) => {
    try {
      const userDetails = await usersApi.getUserById(id);
      setSelectedUser(userDetails);
    } catch (error) {
      console.error('Error loading user details:', error);
    }
  };

  // Buscar usuarios
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Ingresa un término de búsqueda');
      return;
    }

    setIsSearching(true);
    try {
      const response = await usersApi.getUsers({
        search: searchQuery.trim(),
        limit: 20,
      });
      setSearchResults(response.data);

      if (response.data.length === 0) {
        Alert.alert('Sin resultados', 'No se encontraron usuarios con ese criterio');
      }
    } catch (error: any) {
      console.error('Error buscando usuarios:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || error.message || 'Error al buscar usuarios'
      );
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Seleccionar usuario y pasar a captura de video
  const handleSelectUser = useCallback((user: User) => {
    setSelectedUser(user);
    setStep('camera');
  }, []);

  // Cuando se completa la grabación del video
  const handleVideoComplete = useCallback(async (video: VideoCaptureResult) => {
    if (!selectedUser) return;

    setStep('processing');
    setIsLoading(true);

    try {
      console.log('📤 Enviando video para verificación...', {
        userId: selectedUser.id,
        videoUri: video.uri,
      });

      const response = await biometricApi.verifyFromVideo(video, {
        entityType: 'user',
        userId: selectedUser.id,
        metadata: {
          verifiedAt: new Date().toISOString(),
          userName: selectedUser.username || selectedUser.email,
        },
      });

      console.log('📥 Verify response:', JSON.stringify(response, null, 2));

      setIsLoading(false);

      if (response.success) {
        // Normalizar la respuesta para manejar diferentes formatos del backend
        const rawResponse = response as any;
        const normalizedResult: VerifyFromVideoResponse = {
          success: response.success,
          verified: rawResponse.verified ?? false,
          entityId: rawResponse.entityId || selectedUser.id,
          similarityScore: rawResponse.similarityScore ?? rawResponse.similarity ?? rawResponse.matchScore ?? 0,
          confidence: rawResponse.confidence ?? rawResponse.confidenceScore ?? rawResponse.livenessScore ?? 0,
          threshold: rawResponse.threshold ?? rawResponse.minimumThreshold ?? 75,
          framesExtracted: rawResponse.framesExtracted ?? 0,
          framesAnalyzed: rawResponse.framesAnalyzed ?? rawResponse.framesUsed ?? 0,
          videoDurationSeconds: rawResponse.videoDurationSeconds ?? 0,
          processingTimeMs: rawResponse.processingTimeMs ?? 0,
          message: rawResponse.message || '',
        };
        console.log('📊 Normalized result:', normalizedResult);
        setVerifyResult(normalizedResult);
        setStep('result');
      } else {
        Alert.alert('Error', response.message || 'No se pudo verificar el rostro');
        setStep('search');
      }
    } catch (error: any) {
      setIsLoading(false);
      console.error('Error verificando rostro:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || error.message || 'Error al verificar el rostro'
      );
      setStep('search');
    }
  }, [selectedUser]);

  // Cancelar captura de video
  const handleCancelCapture = useCallback(() => {
    setStep('search');
  }, []);

  // Reiniciar todo el proceso
  const handleReset = useCallback(() => {
    setStep('search');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setVerifyResult(null);
  }, []);

  // Renderizar item de usuario
  const renderUserItem = useCallback(({ item }: { item: User }) => {
    const displayName = item.first_name && item.last_name
      ? `${item.first_name} ${item.last_name}`
      : item.username || item.email;

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => handleSelectUser(item)}
      >
        <View style={styles.userAvatar}>
          <MaterialIcons name="person" size={28} color={colors.success[500]} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          {item.has_biometric ? (
            <Text style={styles.userBiometric}>🔐 Tiene biometría</Text>
          ) : (
            <Text style={styles.userNoBiometric}>⚠️ Sin biometría registrada</Text>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={24} color={colors.neutral[400]} />
      </TouchableOpacity>
    );
  }, [handleSelectUser]);

  // Pantalla de captura de video
  if (step === 'camera') {
    return (
      <SafeAreaView style={styles.cameraContainer} edges={['top']}>
        <VideoCaptureCamera
          onCaptureComplete={handleVideoComplete}
          onCancel={handleCancelCapture}
        />
      </SafeAreaView>
    );
  }

  // Pantalla de procesamiento
  if (step === 'processing') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={colors.success[500]} />
          <Text style={styles.processingText}>Verificando rostro...</Text>
          <Text style={styles.processingSubtext}>
            Comparando con el perfil registrado
          </Text>
          <Text style={styles.processingSubtext}>
            Esto puede tomar unos segundos
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Pantalla de resultado
  if (step === 'result' && verifyResult) {
    const isVerified = verifyResult.verified;

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.resultContainer}>
          <View style={styles.resultIcon}>
            <MaterialIcons
              name={isVerified ? 'verified-user' : 'gpp-bad'}
              size={80}
              color={isVerified ? colors.success[500] : colors.danger[500]}
            />
          </View>

          <Text style={[styles.resultTitle, { color: isVerified ? colors.success[600] : colors.danger[600] }]}>
            {isVerified ? '¡Verificación Exitosa!' : 'Verificación Fallida'}
          </Text>
          <Text style={styles.resultSubtitle}>
            {isVerified
              ? 'La identidad ha sido verificada correctamente'
              : 'No se pudo verificar la identidad'}
          </Text>

          <View style={styles.resultCard}>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Usuario</Text>
              <Text style={styles.resultValue}>
                {selectedUser?.username || selectedUser?.email}
              </Text>
            </View>
            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Similitud</Text>
              <Text style={[styles.resultValue, { color: isVerified ? colors.success[500] : colors.danger[500] }]}>
                {(verifyResult.similarityScore ?? 0).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Confianza</Text>
              <Text style={[styles.resultValue, { color: isVerified ? colors.success[500] : colors.danger[500] }]}>
                {(verifyResult.confidence ?? 0).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Umbral mínimo</Text>
              <Text style={styles.resultValue}>{verifyResult.threshold ?? 75}%</Text>
            </View>
            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Frames analizados</Text>
              <Text style={styles.resultValue}>{verifyResult.framesAnalyzed ?? 0}</Text>
            </View>
            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Duración video</Text>
              <Text style={styles.resultValue}>
                {(verifyResult.videoDurationSeconds ?? 0).toFixed(2)}s
              </Text>
            </View>
            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Tiempo proceso</Text>
              <Text style={styles.resultValue}>{verifyResult.processingTimeMs ?? 0}ms</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <MaterialIcons name="refresh" size={24} color={colors.neutral[0]} />
            <Text style={styles.resetButtonText}>Verificar Otro Usuario</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Pantalla principal: búsqueda de usuario
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <MaterialIcons name="verified-user" size={48} color={colors.success[500]} />
          <Text style={styles.title}>Verificar Rostro</Text>
          <Text style={styles.subtitle}>
            Busca un usuario para verificar su identidad
          </Text>
        </View>

        {/* Barra de búsqueda */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <MaterialIcons name="search" size={24} color={colors.neutral[400]} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre, email o documento..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={20} color={colors.neutral[400]} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color={colors.neutral[0]} />
            ) : (
              <MaterialIcons name="search" size={24} color={colors.neutral[0]} />
            )}
          </TouchableOpacity>
        </View>

        {/* Lista de resultados */}
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="person-search" size={64} color={colors.neutral[300]} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Sin resultados' : 'Busca un usuario para verificar'}
              </Text>
            </View>
          }
        />

        {/* Consejos */}
        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={20} color={colors.success[500]} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Importante:</Text>
            <Text style={styles.infoText}>• El usuario debe tener biometría registrada</Text>
            <Text style={styles.infoText}>• Buena iluminación para la verificación</Text>
            <Text style={styles.infoText}>• Mirar directamente a la cámara</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: colors.neutral[950],
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[5],
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.neutral[800],
    marginTop: spacing[3],
  },
  subtitle: {
    fontSize: 14,
    color: colors.neutral[500],
    textAlign: 'center',
    marginTop: spacing[1],
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing[5],
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[3],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    gap: spacing[2],
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing[3],
    fontSize: 16,
    color: colors.neutral[800],
  },
  searchButton: {
    backgroundColor: colors.success[500],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: colors.success[300],
  },
  // User list
  listContent: {
    paddingHorizontal: spacing[5],
    flexGrow: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.success[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  userEmail: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: spacing[0.5],
  },
  userBiometric: {
    fontSize: 12,
    color: colors.success[600],
    marginTop: spacing[0.5],
  },
  userNoBiometric: {
    fontSize: 12,
    color: colors.warning[600],
    marginTop: spacing[0.5],
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[10],
  },
  emptyText: {
    fontSize: 16,
    color: colors.neutral[400],
    marginTop: spacing[4],
    textAlign: 'center',
  },
  // Info box
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.success[50],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success[600],
    marginBottom: spacing[1],
  },
  infoText: {
    fontSize: 12,
    color: colors.neutral[600],
  },
  // Processing
  processingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[5],
  },
  processingText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.neutral[800],
    marginTop: spacing[5],
  },
  processingSubtext: {
    fontSize: 14,
    color: colors.neutral[500],
    marginTop: spacing[2],
    textAlign: 'center',
  },
  // Result
  resultContainer: {
    padding: spacing[5],
    alignItems: 'center',
  },
  resultIcon: {
    marginBottom: spacing[4],
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing[2],
  },
  resultSubtitle: {
    fontSize: 16,
    color: colors.neutral[500],
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  resultCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[5],
    width: '100%',
    marginBottom: spacing[6],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  resultDivider: {
    height: 1,
    backgroundColor: colors.neutral[100],
  },
  resultLabel: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  resultValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success[500],
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[6],
    borderRadius: borderRadius.lg,
    gap: spacing[2],
    width: '100%',
  },
  resetButtonText: {
    color: colors.neutral[0],
    fontSize: 16,
    fontWeight: 'bold',
  },
});
