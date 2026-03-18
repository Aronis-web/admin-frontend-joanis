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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { useAuthStore } from '@/store/auth';
import { cashRegistersApi, CashRegister, CashRegisterStatus } from '@/services/api/cash-registers';
import logger from '@/utils/logger';

interface CashRegistersScreenProps {
  navigation: any;
  route: {
    params: {
      emissionPointId: string;
      emissionPointName: string;
      emissionPointCode: string;
    };
  };
}

export const CashRegistersScreen: React.FC<CashRegistersScreenProps> = ({ navigation, route }) => {
  const { emissionPointId, emissionPointName, emissionPointCode } = route.params;
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { currentSite, currentCompany } = useAuthStore();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const loadCashRegisters = useCallback(async () => {
    if (!currentSite?.id || !currentCompany?.id) {
      logger.warn('No hay sede o empresa seleccionada');
      return;
    }

    try {
      setLoading(true);
      const registers = await cashRegistersApi.getCashRegistersBySite(currentSite.id, {
        companyId: currentCompany.id,
      });

      // Filtrar solo las cajas del punto de emisión actual
      const filtered = registers.filter(r => r.emissionPointId === emissionPointId);
      setCashRegisters(filtered);
    } catch (error: any) {
      logger.error('Error cargando cajas registradoras:', error);
      Alert.alert('Error', 'No se pudieron cargar las cajas registradoras');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentSite?.id, currentCompany?.id, emissionPointId]);

  useFocusEffect(
    useCallback(() => {
      loadCashRegisters();
    }, [loadCashRegisters])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadCashRegisters();
  };

  const handleCreateCashRegister = () => {
    navigation.navigate('CreateCashRegister', {
      emissionPointId,
      emissionPointName,
      emissionPointCode,
    });
  };

  const handleEditCashRegister = (cashRegister: CashRegister) => {
    navigation.navigate('EditCashRegister', {
      cashRegisterId: cashRegister.id,
      emissionPointId,
      emissionPointName,
      emissionPointCode,
    });
  };

  const handleToggleStatus = async (cashRegister: CashRegister) => {
    const newStatus: CashRegisterStatus = cashRegister.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const action = newStatus === 'ACTIVE' ? 'activar' : 'desactivar';

    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Caja`,
      `¿Estás seguro de que deseas ${action} la caja "${cashRegister.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await cashRegistersApi.updateCashRegister(cashRegister.id, {
                status: newStatus,
              });
              Alert.alert('Éxito', `Caja ${action}da exitosamente`);
              loadCashRegisters();
            } catch (error: any) {
              logger.error(`Error al ${action} caja:`, error);
              Alert.alert('Error', `No se pudo ${action} la caja`);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: CashRegisterStatus): string => {
    switch (status) {
      case 'ACTIVE':
        return '#10B981';
      case 'INACTIVE':
        return '#EF4444';
      case 'MAINTENANCE':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: CashRegisterStatus): string => {
    switch (status) {
      case 'ACTIVE':
        return '✅ Activa';
      case 'INACTIVE':
        return '❌ Inactiva';
      case 'MAINTENANCE':
        return '🔧 Mantenimiento';
      default:
        return status;
    }
  };

  const formatCurrency = (cents?: number): string => {
    if (!cents) return '$0.00';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const renderCashRegisterCard = (register: CashRegister) => (
    <View key={register.id} style={[styles.card, isTablet && styles.cardTablet]}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.registerIcon}>💰</Text>
          <View>
            <Text style={[styles.registerName, isTablet && styles.registerNameTablet]}>
              {register.code}
            </Text>
            <Text style={[styles.registerSubtitle, isTablet && styles.registerSubtitleTablet]}>
              {register.name}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${getStatusColor(register.status)}20` },
            ]}
          >
            <Text style={[styles.statusText, { color: getStatusColor(register.status) }]}>
              {getStatusLabel(register.status)}
            </Text>
          </View>
          {register.isOpen && (
            <View style={styles.openBadge}>
              <Text style={styles.openText}>🔓 Abierta</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.infoContainer}>
        {register.warehouse && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📦 Almacén:</Text>
            <Text style={styles.infoValue}>
              {register.warehouse.name} ({register.warehouse.code})
            </Text>
          </View>
        )}
        {register.priceProfile && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>💰 Perfil de Precio:</Text>
            <Text style={styles.infoValue}>
              {register.priceProfile.name} ({register.priceProfile.code})
            </Text>
          </View>
        )}
        {register.metadata?.location && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>📍 Ubicación:</Text>
            <Text style={styles.infoValue}>{register.metadata.location}</Text>
          </View>
        )}
        {register.maxCashAmountCents && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>💵 Monto máximo:</Text>
            <Text style={styles.infoValue}>{formatCurrency(register.maxCashAmountCents)}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>⚙️ Configuración:</Text>
          <Text style={styles.infoValue}>
            {register.allowNegativeBalance ? '✓ Permite saldo negativo' : '✗ No permite saldo negativo'}
          </Text>
        </View>
        {register.requiresManagerApproval && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>👔 Aprobación:</Text>
            <Text style={styles.infoValue}>Requiere aprobación de gerente</Text>
          </View>
        )}
        {!register.warehouse && (
          <View style={styles.infoRow}>
            <Text style={styles.warningLabel}>⚠️ Sin almacén:</Text>
            <Text style={styles.warningValue}>Las ventas no descontarán stock</Text>
          </View>
        )}
        {!register.priceProfile && (
          <View style={styles.infoRow}>
            <Text style={styles.warningLabel}>⚠️ Sin perfil:</Text>
            <Text style={styles.warningValue}>Se usarán precios por defecto</Text>
          </View>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={() => handleEditCashRegister(register)}
        >
          <Text style={styles.primaryButtonText}>✏️ Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => handleToggleStatus(register)}
        >
          <Text style={styles.secondaryButtonText}>
            {register.status === 'ACTIVE' ? '🚫 Desactivar' : '✅ Activar'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <ScreenLayout navigation={navigation}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Cargando cajas registradoras...</Text>
          </View>
        </SafeAreaView>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View>
            <Text style={[styles.headerTitle, isTablet && styles.headerTitleTablet]}>
              Cajas Registradoras
            </Text>
            <Text style={[styles.headerSubtitle, isTablet && styles.headerSubtitleTablet]}>
              {emissionPointCode} - {emissionPointName}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.createButton, isTablet && styles.createButtonTablet]}
            onPress={handleCreateCashRegister}
          >
            <Text style={[styles.createButtonText, isTablet && styles.createButtonTextTablet]}>
              + Nueva Caja
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {cashRegisters.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💰</Text>
              <Text style={styles.emptyTitle}>No hay cajas registradoras</Text>
              <Text style={styles.emptyText}>
                Crea tu primera caja registradora para este punto de emisión
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={handleCreateCashRegister}
              >
                <Text style={styles.emptyButtonText}>+ Crear Caja Registradora</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cardsContainer}>
              {cashRegisters.map(renderCashRegisterCard)}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTablet: {
    padding: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerTitleTablet: {
    fontSize: 32,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  headerSubtitleTablet: {
    fontSize: 16,
  },
  createButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonTablet: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  createButtonTextTablet: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTablet: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  registerIcon: {
    fontSize: 32,
  },
  registerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  registerNameTablet: {
    fontSize: 20,
  },
  registerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  registerSubtitleTablet: {
    fontSize: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  openBadge: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  openText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  infoContainer: {
    gap: 8,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#111827',
    flex: 1,
  },
  warningLabel: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '500',
  },
  warningValue: {
    fontSize: 13,
    color: '#F59E0B',
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 120,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#6366F1',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  emptyButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
