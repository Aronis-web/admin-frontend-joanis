import React, { useState, useEffect, useCallback } from 'react';
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
import { balancesApi } from '@/services/api';
import {
  Balance,
  BalanceType,
  BalanceStatus,
  CreateBalanceRequest,
  UpdateBalanceRequest,
  getBalanceTypeLabel,
  getBalanceStatusLabel,
  getBalanceStatusColor,
  formatCentsToCurrency,
} from '@/types/balances';
import { useAuthStore } from '@/store/auth';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { AddButton } from '@/components/Navigation/AddButton';
import { MAIN_ROUTES } from '@/constants/routes';
import { BalanceOperationsModal } from '@/components/Balances/BalanceOperationsModal';

interface BalancesScreenProps {
  navigation: any;
}

export const BalancesScreen: React.FC<BalancesScreenProps> = ({ navigation }) => {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<BalanceStatus | 'ALL'>('ALL');
  const [selectedType, setSelectedType] = useState<BalanceType | 'ALL'>('ALL');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<Balance | null>(null);
  const { currentCompany, currentSite } = useAuthStore();
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  const loadBalances = useCallback(async () => {
    try {
      const params: any = {};
      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }
      if (selectedType !== 'ALL') {
        params.balanceType = selectedType;
      }

      const response = await balancesApi.getBalances({
        page: 1,
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'ASC',
        ...params,
      });
      setBalances(response.data);
    } catch (error: any) {
      console.error('Error loading balances:', error);
      Alert.alert('Error', 'No se pudieron cargar los balances');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, selectedType]);

  // Auto-reload balances when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 BalancesScreen focused - reloading balances...');
      setLoading(true);
      loadBalances();
    }, [loadBalances])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadBalances();
  };

  const handleCreateBalance = () => {
    navigation.navigate(MAIN_ROUTES.CREATE_BALANCE);
  };

  const handleBalancePress = (balance: Balance) => {
    navigation.navigate(MAIN_ROUTES.BALANCE_DETAIL, { balanceId: balance.id });
  };

  const handleViewOperations = (balance: Balance) => {
    setSelectedBalance(balance);
    setModalVisible(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return 'N/A';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusBadgeStyle = (status: BalanceStatus) => {
    return {
      backgroundColor: getBalanceStatusColor(status) + '20',
      borderColor: getBalanceStatusColor(status),
    };
  };

  const getStatusTextStyle = (status: BalanceStatus) => {
    return {
      color: getBalanceStatusColor(status),
    };
  };

  const renderStatusFilter = () => {
    const statuses: Array<BalanceStatus | 'ALL'> = [
      'ALL',
      BalanceStatus.ACTIVE,
      BalanceStatus.INACTIVE,
      BalanceStatus.CLOSED,
    ];

    return (
      <View style={styles.filterWrapper}>
        <Text style={styles.filterLabel}>Estado:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {statuses.map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                isTablet && styles.filterButtonTablet,
                selectedStatus === status && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  isTablet && styles.filterButtonTextTablet,
                  selectedStatus === status && styles.filterButtonTextActive,
                ]}
              >
                {status === 'ALL' ? 'Todos' : getBalanceStatusLabel(status)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderTypeFilter = () => {
    const types: Array<BalanceType | 'ALL'> = ['ALL', BalanceType.INTERNAL, BalanceType.EXTERNAL];

    return (
      <View style={styles.filterWrapper}>
        <Text style={styles.filterLabel}>Tipo:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
        >
          {types.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterButton,
                isTablet && styles.filterButtonTablet,
                selectedType === type && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedType(type)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  isTablet && styles.filterButtonTextTablet,
                  selectedType === type && styles.filterButtonTextActive,
                ]}
              >
                {type === 'ALL' ? 'Todos' : getBalanceTypeLabel(type)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderBalanceCard = (balance: Balance) => {
    const isExternal = balance.balanceType === BalanceType.EXTERNAL;

    return (
      <TouchableOpacity
        key={balance.id}
        style={[styles.card, isTablet && styles.cardTablet, isExternal && styles.cardExternal]}
        onPress={() => handleBalancePress(balance)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.receiverName, isTablet && styles.receiverNameTablet]}>
              {balance.receiverSite?.name ||
                balance.receiverCompany?.alias ||
                balance.receiverCompany?.name ||
                'N/A'}
            </Text>
            <Text style={[styles.cardCode, isTablet && styles.cardCodeTablet]}>{balance.code}</Text>
            <View style={styles.badgesRow}>
              <View
                style={[
                  styles.statusBadge,
                  isTablet && styles.statusBadgeTablet,
                  getStatusBadgeStyle(balance.status),
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    isTablet && styles.statusTextTablet,
                    getStatusTextStyle(balance.status),
                  ]}
                >
                  {getBalanceStatusLabel(balance.status)}
                </Text>
              </View>
              <View
                style={[
                  styles.typeBadge,
                  isTablet && styles.typeBadgeTablet,
                  isExternal && styles.typeBadgeExternal,
                ]}
              >
                <Text
                  style={[
                    styles.typeText,
                    isTablet && styles.typeTextTablet,
                    isExternal && styles.typeTextExternal,
                  ]}
                >
                  {getBalanceTypeLabel(balance.balanceType)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Inicio:</Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {formatDate(balance.startDate)}
            </Text>
          </View>

          {balance.endDate && (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>Fin:</Text>
              <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
                {formatDate(balance.endDate)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={[styles.footerButton, styles.viewOperationsButton]}
            onPress={(e) => {
              e.stopPropagation();
              handleViewOperations(balance);
            }}
          >
            <Text style={[styles.footerButtonText, isTablet && styles.footerButtonTextTablet]}>
              Ver Operaciones
            </Text>
          </TouchableOpacity>
          <Text style={[styles.arrowIcon, isTablet && styles.arrowIconTablet]}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Cargando balances...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ScreenLayout navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>Balances</Text>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
              Gestión de balances de distribución
            </Text>
          </View>
        </View>

        {/* Status Filter */}
        {renderStatusFilter()}

        {/* Type Filter */}
        {renderTypeFilter()}

        {/* Balances List */}
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            isTablet && styles.contentContainerTablet,
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {balances.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyIcon, isTablet && styles.emptyIconTablet]}>⚖️</Text>
              <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                No hay balances registrados
              </Text>
              <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
                Crea un nuevo balance para comenzar
              </Text>
            </View>
          ) : (
            balances.map(renderBalanceCard)
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Add Button */}
        <AddButton onPress={handleCreateBalance} icon="+" />

        {/* Operations Modal */}
        <BalanceOperationsModal
          visible={modalVisible}
          balance={selectedBalance}
          onClose={() => {
            setModalVisible(false);
            setSelectedBalance(null);
          }}
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
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  titleTablet: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  subtitleTablet: {
    fontSize: 16,
  },
  filterWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    paddingHorizontal: 24,
    paddingTop: 12,
    marginBottom: 8,
  },
  filterContent: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  filterButtonTablet: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterButtonActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  filterButtonTextTablet: {
    fontSize: 15,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  contentContainerTablet: {
    padding: 32,
    maxWidth: 1200,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardExternal: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 2,
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
  receiverName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  receiverNameTablet: {
    fontSize: 24,
  },
  cardCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  cardCodeTablet: {
    fontSize: 16,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeTablet: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextTablet: {
    fontSize: 13,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  typeBadgeExternal: {
    backgroundColor: '#F59E0B',
  },
  typeBadgeTablet: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  typeTextExternal: {
    color: '#FFFFFF',
  },
  typeTextTablet: {
    fontSize: 13,
  },
  cardBody: {
    gap: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    width: 90,
  },
  infoLabelTablet: {
    fontSize: 15,
    width: 110,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  infoValueTablet: {
    fontSize: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#6366F1',
  },
  viewOperationsButton: {
    backgroundColor: '#6366F1',
  },
  footerButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footerButtonTextTablet: {
    fontSize: 15,
  },
  arrowIcon: {
    fontSize: 24,
    color: '#CBD5E1',
    fontWeight: '300',
  },
  arrowIconTablet: {
    fontSize: 28,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyIconTablet: {
    fontSize: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptyTextTablet: {
    fontSize: 22,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
  },
  emptySubtextTablet: {
    fontSize: 16,
  },
  bottomSpacer: {
    height: 100,
  },
});
