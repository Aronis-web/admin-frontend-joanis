import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { balancesApi } from '@/services/api';
import {
  Balance,
  BalanceStatus,
  getBalanceTypeLabel,
  getBalanceStatusLabel,
  getBalanceStatusColor,
  formatCentsToCurrency,
} from '@/types/balances';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { BalanceOperationsModal } from '@/components/Balances/BalanceOperationsModal';
import { MAIN_ROUTES } from '@/constants/routes';

interface BalanceDetailScreenProps {
  navigation: any;
  route: {
    params: {
      balanceId: string;
    };
  };
}

export const BalanceDetailScreen: React.FC<BalanceDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { balanceId } = route.params;
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showOperationsModal, setShowOperationsModal] = useState(false);
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;

  const loadBalance = useCallback(async () => {
    try {
      const data = await balancesApi.getBalanceById(balanceId);
      setBalance(data);
    } catch (error: any) {
      console.error('Error loading balance:', error);
      Alert.alert('Error', 'No se pudo cargar el balance');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [balanceId]);

  useFocusEffect(
    useCallback(() => {
      console.log('📱 BalanceDetailScreen focused - reloading balance...');
      setLoading(true);
      loadBalance();
    }, [loadBalance])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadBalance();
  };

  const handleActivate = async () => {
    if (!balance) return;

    Alert.alert(
      'Activar Balance',
      '¿Está seguro de que desea activar este balance?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Activar',
          onPress: async () => {
            try {
              setActionLoading(true);
              await balancesApi.activateBalance(balance.id);
              Alert.alert('Éxito', 'Balance activado correctamente');
              loadBalance();
            } catch (error: any) {
              console.error('Error activating balance:', error);
              Alert.alert('Error', 'No se pudo activar el balance');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeactivate = async () => {
    if (!balance) return;

    Alert.alert(
      'Desactivar Balance',
      '¿Está seguro de que desea desactivar este balance?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          onPress: async () => {
            try {
              setActionLoading(true);
              await balancesApi.deactivateBalance(balance.id);
              Alert.alert('Éxito', 'Balance desactivado correctamente');
              loadBalance();
            } catch (error: any) {
              console.error('Error deactivating balance:', error);
              Alert.alert('Error', 'No se pudo desactivar el balance');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClose = async () => {
    if (!balance) return;

    Alert.alert(
      'Cerrar Balance',
      '¿Está seguro de que desea cerrar este balance? No se podrán realizar más operaciones.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await balancesApi.closeBalance(balance.id);
              Alert.alert('Éxito', 'Balance cerrado correctamente');
              loadBalance();
            } catch (error: any) {
              console.error('Error closing balance:', error);
              Alert.alert('Error', 'No se pudo cerrar el balance');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async () => {
    if (!balance) return;

    Alert.alert(
      'Eliminar Balance',
      '¿Está seguro de que desea eliminar este balance? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await balancesApi.deleteBalance(balance.id);
              Alert.alert('Éxito', 'Balance eliminado correctamente');
              navigation.goBack();
            } catch (error: any) {
              console.error('Error deleting balance:', error);
              Alert.alert('Error', 'No se pudo eliminar el balance');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleViewOperations = () => {
    console.log('🔵 Opening operations modal for balance:', balance?.code);
    setShowOperationsModal(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando balance...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!balance) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No se encontró el balance</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canModify = balance.status !== BalanceStatus.CLOSED;

  return (
    <>
      <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={[styles.backButtonText, isTablet && styles.backButtonTextTablet]}>
              ← Volver
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>
            Detalle de Balance
          </Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            isTablet && styles.contentContainerTablet,
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Balance Info Card */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Text style={[styles.balanceCode, isTablet && styles.balanceCodeTablet]}>
                  {balance.code}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    isTablet && styles.statusBadgeTablet,
                    { backgroundColor: getBalanceStatusColor(balance.status) + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isTablet && styles.statusTextTablet,
                      { color: getBalanceStatusColor(balance.status) },
                    ]}
                  >
                    {getBalanceStatusLabel(balance.status)}
                  </Text>
                </View>
              </View>
              <View style={styles.typeBadge}>
                <Text style={[styles.typeText, isTablet && styles.typeTextTablet]}>
                  {getBalanceTypeLabel(balance.balanceType)}
                </Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                  Receptor:
                </Text>
                <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                  {balance.receiverSite?.name || balance.receiverCompany?.alias || balance.receiverCompany?.name || 'N/A'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                  Fecha Inicio:
                </Text>
                <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                  {formatDate(balance.startDate)}
                </Text>
              </View>

              {balance.endDate && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                    Fecha Fin:
                  </Text>
                  <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                    {formatDate(balance.endDate)}
                  </Text>
                </View>
              )}

              {balance.notes && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
                    Notas:
                  </Text>
                  <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                    {balance.notes}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Actions Card */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <Text style={[styles.cardTitle, isTablet && styles.cardTitleTablet]}>
              Acciones
            </Text>

            <TouchableOpacity
              style={[styles.actionButton, styles.viewOperationsButton]}
              onPress={handleViewOperations}
            >
              <Text style={[styles.actionButtonText, isTablet && styles.actionButtonTextTablet]}>
                Ver Operaciones
              </Text>
            </TouchableOpacity>

            {canModify && (
              <>
                {balance.status === BalanceStatus.ACTIVE ? (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deactivateButton]}
                    onPress={handleDeactivate}
                    disabled={actionLoading}
                  >
                    <Text style={[styles.actionButtonText, isTablet && styles.actionButtonTextTablet]}>
                      Desactivar Balance
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.activateButton]}
                    onPress={handleActivate}
                    disabled={actionLoading}
                  >
                    <Text style={[styles.actionButtonText, isTablet && styles.actionButtonTextTablet]}>
                      Activar Balance
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionButton, styles.closeButton]}
                  onPress={handleClose}
                  disabled={actionLoading}
                >
                  <Text style={[styles.actionButtonText, isTablet && styles.actionButtonTextTablet]}>
                    Cerrar Balance
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={handleDelete}
                  disabled={actionLoading}
                >
                  <Text style={[styles.actionButtonText, isTablet && styles.actionButtonTextTablet]}>
                    Eliminar Balance
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </ScreenLayout>

    {/* Operations Modal */}
    <BalanceOperationsModal
      visible={showOperationsModal}
      balance={balance}
      onClose={() => setShowOperationsModal(false)}
    />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 20,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  backButtonTextTablet: {
    fontSize: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  titleTablet: {
    fontSize: 24,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  contentContainerTablet: {
    padding: 32,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTablet: {
    padding: 24,
    borderRadius: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardHeaderLeft: {
    flex: 1,
    gap: 8,
  },
  balanceCode: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  balanceCodeTablet: {
    fontSize: 28,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeTablet: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextTablet: {
    fontSize: 14,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  typeTextTablet: {
    fontSize: 14,
  },
  cardBody: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    width: 100,
  },
  infoLabelTablet: {
    fontSize: 16,
    width: 120,
  },
  infoValue: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '600',
  },
  infoValueTablet: {
    fontSize: 17,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  cardTitleTablet: {
    fontSize: 20,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtonTextTablet: {
    fontSize: 17,
  },
  viewOperationsButton: {
    backgroundColor: '#6366F1',
  },
  activateButton: {
    backgroundColor: '#10B981',
  },
  deactivateButton: {
    backgroundColor: '#F59E0B',
  },
  closeButton: {
    backgroundColor: '#6B7280',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default BalanceDetailScreen;
