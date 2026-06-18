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
import { spacing, borderRadius } from '@/design-system/tokens';
import { palette } from '@/design-system/tokens/palette';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import { VideoCaptureCamera } from '@/components/FaceRecognition/VideoCaptureCamera';
import { biometricApi, RegisterFromVideoResponse, UpdateFromVideoResponse } from '@/services/api/biometric';
import { usersApi, User } from '@/services/api/users';

type Step = 'search' | 'camera' | 'processing' | 'result';
type Mode = 'register' | 'update';

type RouteParams = {
  RegisterFace: {
    userId?: string;
    userName?: string;
    mode?: Mode;
  };
};

interface VideoCaptureResult {
  uri: string;
  type: string;
  name: string;
}

export const RegisterFaceScreen: React.FC = () => {
  const route = useRoute<RouteProp<RouteParams, 'RegisterFace'>>();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { userId: initialUserId, userName: initialUserName, mode: initialMode } = route.params || {};
  const [step, setStep] = useState<Step>(initialUserId ? 'camera' : 'search');
  const [mode, setMode] = useState<Mode>(initialMode || 'register');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(
    initialUserId ? { id: initialUserId, email: initialUserName || '', createdAt: '', updatedAt: '', status: 'active' } as User : null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [registerResult, setRegisterResult] = useState<RegisterFromVideoResponse | UpdateFromVideoResponse | null>(null);

  // Load user details if we have an initial userId
  useEffect(() => {
    if (initialUserId) {
      loadUserDetails(initialUserId);
    }
  }, [initialUserId]);

  const loadUserDetails = async (userId: string) => {
    try {
      const userDetails = await usersApi.getUserById(userId);
      setSelectedUser(userDetails);
    } catch (error) {
      console.error('Error loading user details:', error);
      // Keep the minimal user info we already have
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
    setIsProcessing(true);

    try {
      const isUpdate = mode === 'update';
      console.log(`📤 Enviando video para ${isUpdate ? 'actualización' : 'registro'}...`, {
        userId: selectedUser.id,
        videoUri: video.uri,
        mode,
      });

      let response: RegisterFromVideoResponse | UpdateFromVideoResponse;

      if (isUpdate) {
        response = await biometricApi.updateFromVideo(video, {
          entityType: 'user',
          userId: selectedUser.id,
          replaceExisting: true,
          metadata: {
            updatedAt: new Date().toISOString(),
            userName: selectedUser.username || selectedUser.email,
          },
        });
      } else {
        response = await biometricApi.registerFromVideo(video, {
          entityType: 'user',
          userId: selectedUser.id,
          metadata: {
            registeredAt: new Date().toISOString(),
            userName: selectedUser.username || selectedUser.email,
          },
        });
      }

      setIsProcessing(false);

      if (response.success) {
        setRegisterResult(response);
        setStep('result');
      } else {
        Alert.alert('Error', response.message || `No se pudo ${isUpdate ? 'actualizar' : 'registrar'} el rostro`);
        setStep('search');
      }
    } catch (error: any) {
      setIsProcessing(false);
      console.error(`Error ${mode === 'update' ? 'actualizando' : 'registrando'} rostro:`, error);
      Alert.alert(
        'Error',
        error.response?.data?.message || error.message || `Error al ${mode === 'update' ? 'actualizar' : 'registrar'} el rostro`
      );
      setStep('search');
    }
  }, [selectedUser, mode]);

  // Cancelar captura de video
  const handleCancelCapture = useCallback(() => {
    setStep('search');
  }, []);

  // Reiniciar todo el proceso
  const handleReset = useCallback(() => {
    setStep('search');
    setMode('register');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setRegisterResult(null);
  }, []);

  // Get title based on mode
  const getTitle = () => mode === 'update' ? 'Actualizar Rostro' : 'Registrar Rostro';
  const getSubtitle = () => mode === 'update'
    ? 'Actualiza la biometría facial del usuario'
    : 'Busca un usuario para registrar su rostro';

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
          <MaterialIcons name="person" size={28} color={theme.color.brand.accent} />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          {item.document_number && (
            <Text style={styles.userDocument}>Doc: {item.document_number}</Text>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={24} color={theme.color.icon.disabled} />
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
          <ActivityIndicator size="large" color={theme.color.brand.accent} />
          <Text style={styles.processingText}>Procesando video...</Text>
          <Text style={styles.processingSubtext}>
            {mode === 'update' ? 'Actualizando perfil biométrico' : 'Extrayendo frames y registrando rostro'}
          </Text>
          <Text style={styles.processingSubtext}>
            Esto puede tomar unos segundos
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Pantalla de resultado exitoso
  if (step === 'result' && registerResult) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.resultContainer}>
          <View style={styles.successIcon}>
            <MaterialIcons name="check-circle" size={80} color={theme.color.icon.success} />
          </View>

          <Text style={styles.resultTitle}>
            {mode === 'update' ? '¡Rostro Actualizado!' : '¡Rostro Registrado!'}
          </Text>
          <Text style={styles.resultSubtitle}>
            {mode === 'update'
              ? 'El perfil biométrico se ha actualizado correctamente'
              : 'El perfil biométrico se ha creado correctamente'}
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
              <Text style={styles.resultLabel}>ID Perfil</Text>
              <Text style={styles.resultValueSmall} numberOfLines={1}>
                {registerResult.biometricProfileId}
              </Text>
            </View>
            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Calidad</Text>
              <Text style={[styles.resultValue, { color: theme.color.text.success }]}>
                {(registerResult.qualityScore * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Liveness</Text>
              <Text style={[styles.resultValue, { color: theme.color.text.success }]}>
                {(registerResult.livenessScore * 100).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Frames extraídos</Text>
              <Text style={styles.resultValue}>{registerResult.framesExtracted}</Text>
            </View>
            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Frames usados</Text>
              <Text style={styles.resultValue}>{registerResult.framesUsed}</Text>
            </View>
            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Duración video</Text>
              <Text style={styles.resultValue}>
                {registerResult.videoDurationSeconds.toFixed(2)}s
              </Text>
            </View>
            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Tiempo proceso</Text>
              <Text style={styles.resultValue}>{registerResult.processingTimeMs}ms</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <MaterialIcons name="add" size={24} color={theme.color.text.inverse} />
            <Text style={styles.resetButtonText}>Registrar Otro Usuario</Text>
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
          <MaterialIcons name="face" size={48} color={theme.color.brand.accent} />
          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>{getSubtitle()}</Text>
        </View>

        {/* Barra de búsqueda */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <MaterialIcons name="search" size={24} color={theme.color.icon.disabled} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre, email o documento..."
              placeholderTextColor={theme.color.text.placeholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={20} color={theme.color.icon.disabled} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color={theme.color.text.inverse} />
            ) : (
              <MaterialIcons name="search" size={24} color={theme.color.text.inverse} />
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
              <MaterialIcons
                name="person-search"
                size={64}
                color={theme.color.icon.disabled}
              />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Sin resultados' : 'Busca un usuario para comenzar'}
              </Text>
            </View>
          }
        />

        {/* Consejos */}
        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={20} color={theme.color.brand.accent} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Consejos:</Text>
            <Text style={styles.infoText}>• Buena iluminación</Text>
            <Text style={styles.infoText}>• Mirar a la cámara</Text>
            <Text style={styles.infoText}>• Sin lentes oscuros</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    cameraContainer: {
      flex: 1,
      backgroundColor: palette.neutral[950],
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
      color: theme.color.text.heading,
      marginTop: spacing[3],
    },
    subtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
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
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: spacing[2],
    },
    searchInput: {
      flex: 1,
      paddingVertical: spacing[3],
      fontSize: 16,
      color: theme.color.text.body,
    },
    searchButton: {
      backgroundColor: theme.color.brand.accent,
      borderRadius: borderRadius.lg,
      padding: spacing[3],
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchButtonDisabled: {
      backgroundColor: palette.blue[300],
    },
    // User list
    listContent: {
      paddingHorizontal: spacing[5],
      flexGrow: 1,
    },
    userItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.lg,
      padding: spacing[4],
      marginBottom: spacing[3],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    userAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.color.brand.accentSoft,
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
      color: theme.color.text.heading,
    },
    userEmail: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginTop: spacing[0.5],
    },
    userDocument: {
      fontSize: 12,
      color: theme.color.text.disabled,
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
      color: theme.color.text.disabled,
      marginTop: spacing[4],
      textAlign: 'center',
    },
    // Info box
    infoBox: {
      flexDirection: 'row',
      backgroundColor: theme.color.brand.accentSoft,
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
      color: palette.blue[600],
      marginBottom: spacing[1],
    },
    infoText: {
      fontSize: 12,
      color: theme.color.text.muted,
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
      color: theme.color.text.heading,
      marginTop: spacing[5],
    },
    processingSubtext: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginTop: spacing[2],
      textAlign: 'center',
    },
    // Result
    resultContainer: {
      padding: spacing[5],
      alignItems: 'center',
    },
    successIcon: {
      marginBottom: spacing[4],
    },
    resultTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: spacing[2],
    },
    resultSubtitle: {
      fontSize: 16,
      color: theme.color.text.muted,
      textAlign: 'center',
      marginBottom: spacing[6],
    },
    resultCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: borderRadius.xl,
      padding: spacing[5],
      width: '100%',
      marginBottom: spacing[6],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    resultRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing[3],
    },
    resultDivider: {
      height: 1,
      backgroundColor: theme.color.background.muted,
    },
    resultLabel: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    resultValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    resultValueSmall: {
      fontSize: 12,
      fontWeight: '500',
      color: theme.color.text.muted,
      maxWidth: '60%',
    },
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.brand.accent,
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[6],
      borderRadius: borderRadius.lg,
      gap: spacing[2],
      width: '100%',
    },
    resetButtonText: {
      color: theme.color.text.inverse,
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
