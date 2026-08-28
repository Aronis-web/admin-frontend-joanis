import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { organizationApi } from '@/services/api/organization';
import { OrganizationPosition, PositionTreeNode, ScopeLevel } from '@/types/organization';
import { OrganizationTreeView } from '@/components/Organization';
import { OrganizationInteractiveTree } from '@/components/Organization';
import { CreatePositionModal } from '@/components/Organization';
import { EditPositionModal } from '@/components/Organization';
import { PositionDetailModal } from '@/components/Organization';
import { buildPositionTree } from '@/components/Organization';
import { ScopeInfoBanner } from '@/components/Organization';
import { ProtectedFAB } from '@/components/ui/ProtectedFAB';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

type ScopeFilter = 'all' | 'COMPANY' | 'SITE';

/**
 * Organigrama - Vista Visual (árbol invertido).
 *
 * Fuente unica: la lista de empresa (`GET /organization/companies/:id/positions`)
 * que ya devuelve TODOS los puestos (COMPANY + SITE). El arbol se construye en
 * el cliente con `buildPositionTree` para evitar el truncado a 3 niveles del
 * endpoint `.../tree` del backend. El scope se filtra con chips (Todos / Empresa
 * / Sede) en lugar del antiguo toggle Empresa/Sede que mostraba subconjuntos
 * redundantes.
 */
export const OrganizationChartScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const { currentCompany, currentSite } = useAuthStore();
  const { selectedCompany, selectedSite } = useTenantStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [positions, setPositions] = useState<OrganizationPosition[]>([]);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [displayMode, setDisplayMode] = useState<'cards' | 'tree'>('tree');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createScope, setCreateScope] = useState<ScopeLevel>('COMPANY');
  const [createSiteId, setCreateSiteId] = useState<string | undefined>(undefined);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<PositionTreeNode | null>(null);
  const [parentPosition, setParentPosition] = useState<PositionTreeNode | null>(null);

  const companyId = selectedCompany?.id || currentCompany?.id;
  const siteId = selectedSite?.id || currentSite?.id;
  const companyName = selectedCompany?.name || currentCompany?.name || 'Empresa';

  // Cargar lista plana (fuente unica).
  const loadPositions = useCallback(async () => {
    if (!companyId) {
      Alert.alert('Error', 'No hay empresa seleccionada');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await organizationApi.getCompanyPositions(companyId);
      setPositions(data);
    } catch (error: any) {
      logger.error('Error loading organization positions', error);
      Alert.alert('Error', error?.response?.data?.message || 'Error al cargar el organigrama');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPositions();
    setRefreshing(false);
  }, [loadPositions]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  const counts = useMemo(
    () => ({
      all: positions.length,
      COMPANY: positions.filter((p) => p.scopeLevel === 'COMPANY').length,
      SITE: positions.filter((p) => p.scopeLevel === 'SITE').length,
    }),
    [positions]
  );

  // Construir el arbol en el cliente a partir de la lista (filtrada por scope).
  const treeData = useMemo(() => {
    const filtered =
      scopeFilter === 'all' ? positions : positions.filter((p) => p.scopeLevel === scopeFilter);
    return buildPositionTree(filtered);
  }, [positions, scopeFilter]);

  const handlePositionPress = (position: PositionTreeNode) => {
    setSelectedPosition(position);
    setDetailModalVisible(true);
  };

  const handleEditPosition = (position: PositionTreeNode) => {
    setSelectedPosition(position);
    setEditModalVisible(true);
  };

  const handleDeletePosition = (position: PositionTreeNode) => {
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
              void loadPositions();
            } catch (error: any) {
              Alert.alert('Error', error?.response?.data?.message || 'Error al eliminar el puesto');
            }
          },
        },
      ]
    );
  };

  // Crear hijo: hereda scope y sede del padre.
  const handleCreateChild = (parent: PositionTreeNode) => {
    setParentPosition(parent);
    setCreateScope(parent.scopeLevel);
    setCreateSiteId(parent.scopeLevel === 'SITE' ? (parent.siteId ?? undefined) : undefined);
    setCreateModalVisible(true);
  };

  // Crear raíz: puesto de empresa por defecto.
  const handleCreateRoot = (scope: ScopeLevel) => {
    setParentPosition(null);
    setCreateScope(scope);
    setCreateSiteId(scope === 'SITE' ? siteId : undefined);
    setCreateModalVisible(true);
  };

  const handlePositionCreated = () => {
    setCreateModalVisible(false);
    setParentPosition(null);
    void loadPositions();
  };

  const handlePositionUpdated = () => {
    setEditModalVisible(false);
    setSelectedPosition(null);
    void loadPositions();
  };

  const renderScopeChip = (value: ScopeFilter, label: string, count: number) => {
    const active = scopeFilter === value;
    return (
      <TouchableOpacity
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => setScopeFilter(value)}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {label} ({count})
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.color.brand.accent} />
        <Text style={styles.loadingText}>Cargando organigrama...</Text>
      </View>
    );
  }

  const fabActions = [
    {
      icon: 'business-outline' as const,
      label: 'Puesto de Empresa',
      onPress: () => handleCreateRoot('COMPANY'),
      requiredPermissions: ['organization.positions.company.create'],
    },
    ...(siteId
      ? [
          {
            icon: 'storefront-outline' as const,
            label: 'Puesto de Sede',
            onPress: () => handleCreateRoot('SITE'),
            requiredPermissions: ['organization.positions.site.create'],
          },
        ]
      : []),
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, isTablet && styles.titleTablet]}>Organigrama · Visual</Text>
        <Text style={styles.subtitle}>{companyName}</Text>
      </View>

      {/* Scope filter chips */}
      <View style={styles.chipsContainer}>
        {renderScopeChip('all', 'Todos', counts.all)}
        {renderScopeChip('COMPANY', 'Empresa', counts.COMPANY)}
        {renderScopeChip('SITE', 'Sede', counts.SITE)}
      </View>

      {/* Explicación de alcance */}
      <ScopeInfoBanner />

      {/* Display Mode Selector */}
      <View style={styles.displayModeContainer}>
        <Text style={styles.displayModeLabel}>Vista:</Text>
        <TouchableOpacity
          style={[
            styles.displayModeButton,
            displayMode === 'tree' && styles.displayModeButtonActive,
          ]}
          onPress={() => setDisplayMode('tree')}
        >
          <Text
            style={[
              styles.displayModeButtonText,
              displayMode === 'tree' && styles.displayModeButtonTextActive,
            ]}
          >
            🌳 Árbol
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.displayModeButton,
            displayMode === 'cards' && styles.displayModeButtonActive,
          ]}
          onPress={() => setDisplayMode('cards')}
        >
          <Text
            style={[
              styles.displayModeButtonText,
              displayMode === 'cards' && styles.displayModeButtonTextActive,
            ]}
          >
            📋 Tarjetas
          </Text>
        </TouchableOpacity>
      </View>

      {/* Organization Tree */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.color.brand.accent]}
          />
        }
      >
        {treeData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyText}>No hay puestos en el organigrama</Text>
            <Text style={styles.emptySubtext}>Crea el primer puesto para comenzar</Text>
          </View>
        ) : displayMode === 'cards' ? (
          <OrganizationTreeView
            data={treeData}
            onPositionPress={handlePositionPress}
            onEditPress={handleEditPosition}
            onDeletePress={handleDeletePosition}
            onCreateChild={handleCreateChild}
          />
        ) : (
          <OrganizationInteractiveTree
            data={treeData}
            onPositionPress={handlePositionPress}
            onEditPress={handleEditPosition}
            onDeletePress={handleDeletePosition}
            onCreateChild={handleCreateChild}
          />
        )}
      </ScrollView>

      <ProtectedFAB
        requiredPermissions={[
          'organization.positions.company.create',
          'organization.positions.site.create',
        ]}
        actions={fabActions}
      />

      {/* Modals */}
      <CreatePositionModal
        visible={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setParentPosition(null);
        }}
        onSuccess={handlePositionCreated}
        parentPosition={parentPosition}
        scopeLevel={createScope}
        companyId={companyId}
        siteId={createSiteId}
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.surface.muted,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.color.surface.muted,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: theme.color.text.muted,
    },
    header: {
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: 4,
    },
    titleTablet: {
      fontSize: 32,
    },
    subtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    chipsContainer: {
      flexDirection: 'row',
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    chipActive: {
      backgroundColor: theme.color.brand.accent,
      borderColor: theme.color.brand.accent,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    chipTextActive: {
      color: theme.color.text.onAction,
    },
    displayModeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    displayModeLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.body,
      marginRight: 4,
    },
    displayModeButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: theme.color.surface.muted,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    displayModeButtonActive: {
      backgroundColor: theme.color.brand.primarySoft,
      borderColor: theme.color.brand.accent,
    },
    displayModeButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    displayModeButtonTextActive: {
      color: theme.color.brand.accent,
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
      color: theme.color.text.body,
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
  });

export default OrganizationChartScreen;
