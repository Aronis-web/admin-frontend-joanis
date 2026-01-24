import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { transmisionesApi } from '@/services/api';
import {
  TransmisionWithProducts,
  TransmisionProduct,
  TransmisionStatus,
  ProductStatus,
  getTransmisionStatusLabel,
  getTransmisionStatusColor,
  getProductStatusLabel,
  getProductStatusColor,
  formatCentsToCurrency,
  calculateProfitMargin,
  isProductPreliminary,
  isProductActive,
} from '@/types/transmisiones';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { TransmisionProductsList } from '@/components/Transmisiones/TransmisionProductsList';
import { AddProductModal } from '@/components/Transmisiones/AddProductModal';

interface TransmisionDetailScreenProps {
  navigation: any;
  route: {
    params: {
      transmisionId: string;
    };
  };
}

export const TransmisionDetailScreen: React.FC<TransmisionDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { transmisionId } = route.params;
  const [transmision, setTransmision] = useState<TransmisionWithProducts | null>(null);
  const [products, setProducts] = useState<TransmisionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedStatus, setEditedStatus] = useState<TransmisionStatus>(TransmisionStatus.DRAFT);
  const [saving, setSaving] = useState(false);
  const [addProductModalVisible, setAddProductModalVisible] = useState(false);

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  const loadTransmision = useCallback(async () => {
    try {
      setLoading(true);
      const data = await transmisionesApi.getTransmisionById(transmisionId);
      setTransmision(data);
      setEditedName(data.name);
      setEditedDescription(data.description || '');
      setEditedStatus(data.status);

      // Load products
      const productsResponse = await transmisionesApi.getTransmisionProducts(transmisionId, {
        page: 1,
        limit: 100,
      });

      // Handle both paginated response and direct array response
      if (Array.isArray(productsResponse)) {
        setProducts(productsResponse);
      } else if (productsResponse.data) {
        setProducts(productsResponse.data);
      } else {
        setProducts([]);
      }
    } catch (error: any) {
      console.error('Error loading transmision:', error);
      Alert.alert('Error', 'No se pudo cargar la transmisión');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [transmisionId, navigation]);

  useFocusEffect(
    useCallback(() => {
      console.log('📱 TransmisionDetailScreen focused - reloading...');
      loadTransmision();
    }, [loadTransmision])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadTransmision();
  };

  const handleSave = async () => {
    if (!editedName.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    try {
      setSaving(true);
      await transmisionesApi.updateTransmision(transmisionId, {
        name: editedName.trim(),
        description: editedDescription.trim() || undefined,
        status: editedStatus,
      });

      Alert.alert('Éxito', 'Transmisión actualizada correctamente');
      setEditMode(false);
      loadTransmision();
    } catch (error: any) {
      console.error('Error updating transmision:', error);
      Alert.alert('Error', 'No se pudo actualizar la transmisión');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (transmision) {
      setEditedName(transmision.name);
      setEditedDescription(transmision.description || '');
      setEditedStatus(transmision.status);
    }
    setEditMode(false);
  };

  const handleAddProduct = () => {
    setAddProductModalVisible(true);
  };

  const handleProductAdded = () => {
    setAddProductModalVisible(false);
    loadTransmision();
  };

  const handleDeleteTransmision = () => {
    Alert.alert(
      'Eliminar Transmisión',
      '¿Estás seguro de que deseas eliminar esta transmisión? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await transmisionesApi.deleteTransmision(transmisionId);
              Alert.alert('Éxito', 'Transmisión eliminada correctamente', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error: any) {
              console.error('Error deleting transmision:', error);
              Alert.alert('Error', 'No se pudo eliminar la transmisión');
            }
          },
        },
      ]
    );
  };

  const renderHeader = () => {
    if (!transmision) {
      return null;
    }

    if (editMode) {
      return (
        <View style={styles.editContainer}>
          <View style={styles.section}>
            <Text style={[styles.label, isTablet && styles.labelTablet]}>
              Nombre <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, isTablet && styles.inputTablet]}
              value={editedName}
              onChangeText={setEditedName}
              placeholder="Nombre de la transmisión"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, isTablet && styles.labelTablet]}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.textArea, isTablet && styles.inputTablet]}
              value={editedDescription}
              onChangeText={setEditedDescription}
              placeholder="Descripción opcional"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, isTablet && styles.labelTablet]}>Estado</Text>
            <View style={styles.statusContainer}>
              {Object.values(TransmisionStatus).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusButton, editedStatus === s && styles.statusButtonActive]}
                  onPress={() => setEditedStatus(s)}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      editedStatus === s && styles.statusButtonTextActive,
                    ]}
                  >
                    {getTransmisionStatusLabel(s)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.editActions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancelEdit}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.headerContainer}>
        <View style={styles.compactHeader}>
          <View style={styles.headerLeft}>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>{transmision.name}</Text>
          </View>
          <View style={[styles.statusBadge, getStatusBadgeStyle(transmision.status)]}>
            <Text style={[styles.statusText, getStatusTextStyle(transmision.status)]}>
              {getTransmisionStatusLabel(transmision.status)}
            </Text>
          </View>
        </View>

        <View style={styles.miniStats}>
          <Text style={styles.miniStatText}>
            📦 {products.length} productos • 🔄{' '}
            {products.filter((p) => isProductPreliminary(p.productStatus)).length} preliminares • ✅{' '}
            {products.filter((p) => isProductActive(p.productStatus)).length} activos
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => setEditMode(true)}>
            <Text style={styles.actionButtonText}>✏️ Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteActionButton]}
            onPress={handleDeleteTransmision}
          >
            <Text style={styles.deleteActionButtonText}>🗑️ Eliminar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getStatusBadgeStyle = (status: TransmisionStatus) => {
    return {
      backgroundColor: getTransmisionStatusColor(status) + '20',
      borderColor: getTransmisionStatusColor(status),
    };
  };

  const getStatusTextStyle = (status: TransmisionStatus) => {
    return {
      color: getTransmisionStatusColor(status),
    };
  };

  if (loading && !transmision) {
    return (
      <ScreenLayout navigation={navigation}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0EA5E9" />
            <Text style={styles.loadingText}>Cargando transmisión...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {renderHeader()}

          {!editMode && (
            <TransmisionProductsList
              transmisionId={transmisionId}
              products={products}
              onProductsChanged={loadTransmision}
            />
          )}
        </ScrollView>

        {/* Floating Add Product Button - Above drawer menu */}
        {!editMode && (
          <View style={styles.floatingButtonContainer} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.floatingButton}
              onPress={handleAddProduct}
              activeOpacity={0.9}
            >
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        <AddProductModal
          visible={addProductModalVisible}
          transmisionId={transmisionId}
          priceProfile={transmision?.priceProfile}
          onClose={() => setAddProductModalVisible(false)}
          onProductAdded={handleProductAdded}
        />
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTablet: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#0EA5E9',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerTitleTablet: {
    fontSize: 28,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  miniStats: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 12,
  },
  miniStatText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  titleTablet: {
    fontSize: 28,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  descriptionTablet: {
    fontSize: 16,
    lineHeight: 24,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  deleteActionButton: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  deleteActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  editContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  labelTablet: {
    fontSize: 16,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputTablet: {
    padding: 16,
    fontSize: 18,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusButtonActive: {
    backgroundColor: '#0EA5E9',
    borderColor: '#0EA5E9',
  },
  statusButtonText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButton: {
    backgroundColor: '#0EA5E9',
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: 0,
    top: 0,
    zIndex: 999,
    elevation: 999,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 999,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    zIndex: 999,
  },
});
