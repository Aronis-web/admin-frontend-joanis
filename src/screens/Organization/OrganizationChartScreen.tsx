import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { organizationApi } from '@/services/api/organization';
import { PositionTreeNode, ScopeLevel } from '@/types/organization';
import { OrganizationTreeView } from '@/components/Organization';
import { CreatePositionModal } from '@/components/Organization';
import { EditPositionModal } from '@/components/Organization';
import { PositionDetailModal } from '@/components/Organization';

export const OrganizationChartScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const { currentCompany, currentSite } = useAuthStore();
  const { selectedCompany, selectedSite } = useTenantStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [treeData, setTreeData] = useState<PositionTreeNode[]>([]);
  const [viewMode, setViewMode] = useState<'company' | 'site'>('company');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<PositionTreeNode | null>(null);
  const [parentPosition, setParentPosition] = useState<PositionTreeNode | null>(null);

  const companyId = selectedCompany?.id || currentCompany?.id;
  const siteId = selectedSite?.id || currentSite?.id;

  // Load organization tree
  const loadOrganizationTree = useCallback(async () => {
    if (!companyId) {
      Alert.alert('Error', 'No hay empresa seleccionada');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let data: PositionTreeNode[];

      if (viewMode === 'company') {
        data = await organizationApi.getCompanyPositionsTree(companyId);
      } else {
        if (!siteId) {
          Alert.alert('Error', 'No hay sede seleccionada para ver el organigrama de sede');
          setLoading(false);
          return;
        }
        data = await organizationApi.getSitePositionsTree(siteId);
      }

      setTreeData(data);
    } catch (error: any) {
      console.error('Error loading organization tree:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Error al cargar el organigrama'
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, siteId, viewMode]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrganizationTree();
    setRefreshing(false);
  }, [loadOrganizationTree]);

  // Load on mount and when view mode changes
  useEffect(() => {
    loadOrganizationTree();
  }, [loadOrganizationTree]);

  // Handle position click
  const handlePositionPress = (position: PositionTreeNode) => {
    setSelectedPosition(position);
    setDetailModalVisible(true);
  };

  // Handle edit position
  const handleEditPosition = (position: PositionTreeNode) => {
    setSelectedPosition(position);
    setEditModalVisible(true);
  };

  // Handle delete position
  const handleDeletePosition = async (position: PositionTreeNode) => {
    Alert.alert(
      'Confirmar eliminación',
      `¿Estás seguro de eliminar el puesto "${position.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await organizationApi.deletePosition(position.id);
              Alert.alert('Éxito', 'Puesto eliminado correctamente');
              loadOrganizationTree();
            } catch (error: any) {
              Alert.alert(
                'Error',
                error.response?.data?.message || 'Error al eliminar el puesto'
              );
            }
          },
        },
      ]
    );
  };

  // Handle create child position
  const handleCreateChild = (parent: PositionTreeNode) => {
    setParentPosition(parent);
    setCreateModalVisible(true);
  };

  // Handle create root position
  const handleCreateRoot = () => {
    setParentPosition(null);
    setCreateModalVisible(true);
  };

  // Handle position created
  const handlePositionCreated = () => {
    setCreateModalVisible(false);
    setParentPosition(null);
    loadOrganizationTree();
  };

  // Handle position updated
  const handlePositionUpdated = () => {
    setEditModalVisible(false);
    setSelectedPosition(null);
    loadOrganizationTree();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Cargando organigrama...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, isTablet && styles.titleTablet]}>Organigrama</Text>
        <Text style={styles.subtitle}>
          {viewMode === 'company'
            ? selectedCompany?.name || currentCompany?.name || 'Empresa'
            : selectedSite?.name || currentSite?.name || 'Sede'}
        </Text>
      </View>

      {/* View Mode Selector */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'company' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('company')}
        >
          <Text
            style={[
              styles.viewModeButtonText,
              viewMode === 'company' && styles.viewModeButtonTextActive,
            ]}
          >
            🏢 Empresa
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.viewModeButton, viewMode === 'site' && styles.viewModeButtonActive]}
          onPress={() => setViewMode('site')}
          disabled={!siteId}
        >
          <Text
            style={[
              styles.viewModeButtonText,
              viewMode === 'site' && styles.viewModeButtonTextActive,
              !siteId && styles.viewModeButtonTextDisabled,
            ]}
          >
            🏪 Sede
          </Text>
        </TouchableOpacity>
      </View>

      {/* Organization Tree */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#6366F1']} />
        }
      >
        {treeData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No hay puestos en el organigrama</Text>
            <Text style={styles.emptySubtext}>Crea el primer puesto para comenzar</Text>
          </View>
        ) : (
          <OrganizationTreeView
            data={treeData}
            onPositionPress={handlePositionPress}
            onEditPress={handleEditPosition}
            onDeletePress={handleDeletePosition}
            onCreateChild={handleCreateChild}
          />
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={handleCreateRoot}>
        <Text style={styles.fabIcon}>➕</Text>
      </TouchableOpacity>

      {/* Modals */}
      <CreatePositionModal
        visible={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setParentPosition(null);
        }}
        onSuccess={handlePositionCreated}
        parentPosition={parentPosition}
        scopeLevel={viewMode === 'company' ? 'COMPANY' : 'SITE'}
        companyId={companyId}
        siteId={viewMode === 'site' ? siteId : undefined}
      />

      {selectedPosition && (
        <>
          <EditPositionModal
            visible={editModalVisible}
            onClose={() => {
              setEditModalVisible(false);
              setSelectedPosition(null);
            }}
            onSuccess={handlePositionUpdated}
            position={selectedPosition}
          />

          <PositionDetailModal
            visible={detailModalVisible}
            onClose={() => {
              setDetailModalVisible(false);
              setSelectedPosition(null);
            }}
            position={selectedPosition}
            onEdit={() => {
              setDetailModalVisible(false);
              setEditModalVisible(true);
            }}
            onDelete={() => {
              setDetailModalVisible(false);
              handleDeletePosition(selectedPosition);
            }}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  titleTablet: {
    fontSize: 32,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  viewModeButtonActive: {
    backgroundColor: '#6366F1',
  },
  viewModeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  viewModeButtonTextActive: {
    color: '#FFFFFF',
  },
  viewModeButtonTextDisabled: {
    color: '#D1D5DB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabIcon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
});

export default OrganizationChartScreen;
