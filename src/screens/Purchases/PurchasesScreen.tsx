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
import { purchasesService } from '@/services/api';
import {
  Purchase,
  PurchaseStatus,
  PurchaseStatusLabels,
  PurchaseStatusColors,
} from '@/types/purchases';
import { useAuthStore } from '@/store/auth';
import { ScreenLayout } from '@/components/Layout/ScreenLayout';
import { AddButton } from '@/components/Navigation/AddButton';

interface PurchasesScreenProps {
  navigation: any;
}

export const PurchasesScreen: React.FC<PurchasesScreenProps> = ({ navigation }) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<PurchaseStatus | 'ALL'>('ALL');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const { currentCompany, currentSite } = useAuthStore();
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  const loadPurchases = useCallback(async (page: number = 1) => {
    try {
      setLoading(true);

      const params: any = {
        page,
        limit: pagination.limit,
      };

      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }

      const response = await purchasesService.getPurchases(params);
      setPurchases(response.data);

      // Update pagination info - API returns flat structure
      const totalPages = Math.ceil(response.total / response.limit);
      setPagination({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: totalPages,
      });
    } catch (error: any) {
      console.error('Error loading purchases:', error);
      Alert.alert('Error', 'No se pudieron cargar las compras');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, pagination.limit]);

  // Auto-reload purchases when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 PurchasesScreen focused - reloading purchases...');
      setLoading(true);
      loadPurchases();
    }, [loadPurchases])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadPurchases(1);
  };

  const handlePreviousPage = () => {
    if (pagination.page > 1) {
      loadPurchases(pagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages) {
      loadPurchases(pagination.page + 1);
    }
  };

  const handleCreatePurchase = () => {
    navigation.navigate('CreatePurchase');
  };

  const handlePurchasePress = (purchase: Purchase) => {
    navigation.navigate('PurchaseDetail', { purchaseId: purchase.id });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (cents: number) => {
    return `S/ ${(cents / 100).toFixed(2)}`;
  };

  const getStatusBadgeStyle = (status: PurchaseStatus) => {
    return {
      backgroundColor: PurchaseStatusColors[status] + '20',
      borderColor: PurchaseStatusColors[status],
    };
  };

  const getStatusTextStyle = (status: PurchaseStatus) => {
    return {
      color: PurchaseStatusColors[status],
    };
  };

  const renderStatusFilter = () => {
    const statuses: Array<PurchaseStatus | 'ALL'> = [
      'ALL',
      PurchaseStatus.DRAFT,
      PurchaseStatus.IN_CAPTURE,
      PurchaseStatus.IN_VALIDATION,
      PurchaseStatus.VALIDATED,
      PurchaseStatus.CLOSED,
    ];

    return (
      <View style={styles.filterWrapper}>
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
                {status === 'ALL' ? 'Todos' : PurchaseStatusLabels[status]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderPurchaseCard = (purchase: Purchase) => {
    const totalProducts = purchase.products?.length || 0;
    const validatedProducts =
      purchase.products?.filter((p) => p.status === 'VALIDATED').length || 0;

    return (
      <TouchableOpacity
        key={purchase.id}
        style={[styles.card, isTablet && styles.cardTablet]}
        onPress={() => handlePurchasePress(purchase)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={[styles.cardCode, isTablet && styles.cardCodeTablet]}>
              {purchase.code}
            </Text>
            <View
              style={[
                styles.statusBadge,
                isTablet && styles.statusBadgeTablet,
                getStatusBadgeStyle(purchase.status),
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  isTablet && styles.statusTextTablet,
                  getStatusTextStyle(purchase.status),
                ]}
              >
                {PurchaseStatusLabels[purchase.status]}
              </Text>
            </View>
          </View>
          <Text style={[styles.cardDate, isTablet && styles.cardDateTablet]}>
            {formatDate(purchase.guideDate)}
          </Text>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Proveedor:
            </Text>
            <Text
              style={[styles.infoValue, isTablet && styles.infoValueTablet]}
              numberOfLines={1}
            >
              {purchase.supplier?.commercialName || 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Guía:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {purchase.guideNumber}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isTablet && styles.infoLabelTablet]}>
              Productos:
            </Text>
            <Text style={[styles.infoValue, isTablet && styles.infoValueTablet]}>
              {validatedProducts}/{totalProducts}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={[styles.footerText, isTablet && styles.footerTextTablet]}>
            Creado: {formatDate(purchase.createdAt)}
          </Text>
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
          <Text style={styles.loadingText}>Cargando compras...</Text>
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
            <Text style={[styles.title, isTablet && styles.titleTablet]}>
              Compras
            </Text>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
              Gestión de compras y validación de productos
            </Text>
          </View>
        </View>

      {/* Status Filter */}
      {renderStatusFilter()}

      {/* Purchases List */}
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
        {purchases.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyIcon, isTablet && styles.emptyIconTablet]}>📦</Text>
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              No hay compras registradas
            </Text>
            <Text style={[styles.emptySubtext, isTablet && styles.emptySubtextTablet]}>
              Crea una nueva compra para comenzar
            </Text>
          </View>
        ) : (
          purchases.map(renderPurchaseCard)
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Pagination Controls */}
      {pagination.total > 0 && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[
              styles.paginationButton,
              pagination.page === 1 && styles.paginationButtonDisabled,
            ]}
            onPress={handlePreviousPage}
            disabled={pagination.page === 1}
          >
            <Text
              style={[
                styles.paginationButtonText,
                pagination.page === 1 && styles.paginationButtonTextDisabled,
              ]}
            >
              ← Anterior
            </Text>
          </TouchableOpacity>

          <View style={styles.paginationInfo}>
            <Text style={styles.paginationText}>
              Pág. {pagination.page}/{pagination.totalPages}
            </Text>
            <Text style={styles.paginationSubtext}>
              {purchases.length} de {pagination.total}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.paginationButton,
              pagination.page >= pagination.totalPages && styles.paginationButtonDisabled,
            ]}
            onPress={handleNextPage}
            disabled={pagination.page >= pagination.totalPages}
          >
            <Text
              style={[
                styles.paginationButtonText,
                pagination.page >= pagination.totalPages && styles.paginationButtonTextDisabled,
              ]}
            >
              Siguiente →
            </Text>
          </TouchableOpacity>
        </View>
      )}

        {/* Add Button */}
        <AddButton onPress={handleCreatePurchase} icon="+" />
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
  cardCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  cardCodeTablet: {
    fontSize: 20,
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
  cardDate: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  cardDateTablet: {
    fontSize: 15,
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
  footerText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  footerTextTablet: {
    fontSize: 14,
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
  paginationContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 60,
  },
  paginationInfo: {
    alignItems: 'center',
    minWidth: 100,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  paginationSubtext: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  paginationButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#6366F1',
    minWidth: 110,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  paginationButtonTextDisabled: {
    color: '#94A3B8',
  },
});

export default PurchasesScreen;
