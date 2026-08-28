import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { usePermissions } from '@/hooks/usePermissions';
import { organizationApi } from '@/services/api/organization';
import { OrganizationPosition, PositionTreeNode, ScopeLevel } from '@/types/organization';
import {
  CreatePositionModal,
  EditPositionModal,
  PositionDetailModal,
  ScopeInfoBanner,
} from '@/components/Organization';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

type ScopeFilter = 'all' | 'COMPANY' | 'SITE';

interface PositionSection {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  scope: ScopeLevel;
  siteId?: string;
  data: OrganizationPosition[];
}

/**
 * Organigrama - Vista Lista.
 *
 * Los puestos se agrupan en secciones: una de "Empresa" (COMPANY) y una por
 * cada Sede (SITE). Cada encabezado tiene un boton "+" contextual que crea un
 * puesto exactamente en ese alcance/sede, eliminando la ambiguedad del antiguo
 * toggle Empresa/Sede. Los chips superiores permiten filtrar rapido.
 */
export const OrganizationChartListScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { hasPermission } = usePermissions();

  const { currentCompany, currentSite } = useAuthStore();
  const { selectedCompany, selectedSite } = useTenantStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [positions, setPositions] = useState<OrganizationPosition[]>([]);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [search, setSearch] = useState('');

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createScope, setCreateScope] = useState<ScopeLevel>('COMPANY');
  const [createSiteId, setCreateSiteId] = useState<string | undefined>(undefined);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<OrganizationPosition | null>(null);

  const companyId = selectedCompany?.id || currentCompany?.id;
  const tenantSiteId = selectedSite?.id || currentSite?.id;
  const tenantSiteName = selectedSite?.name || currentSite?.name;
  const companyName = selectedCompany?.name || currentCompany?.name || 'Empresa';

  const canCreateCompany = hasPermission('organization.positions.company.create');
  const canCreateSite = hasPermission('organization.positions.site.create');

  // Fuente unica: la lista de empresa trae puestos COMPANY + SITE.
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
      logger.error('Error loading positions list', error);
      Alert.alert('Error', error?.response?.data?.message || 'Error al cargar los puestos');
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

  const sortPositions = (arr: OrganizationPosition[]) =>
    [...arr].sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    });

  const sections = useMemo<PositionSection[]>(() => {
    const term = search.trim().toLowerCase();
    const matches = (p: OrganizationPosition) =>
      !term ||
      p.name.toLowerCase().includes(term) ||
      p.code.toLowerCase().includes(term) ||
      (p.description ?? '').toLowerCase().includes(term);

    const result: PositionSection[] = [];

    // Seccion Empresa (siempre presente para permitir crear).
    if (scopeFilter !== 'SITE') {
      const companyData = sortPositions(
        positions.filter((p) => p.scopeLevel === 'COMPANY' && matches(p))
      );
      result.push({
        key: 'company',
        title: 'Empresa',
        icon: 'business-outline',
        scope: 'COMPANY',
        data: companyData,
      });
    }

    // Secciones por Sede.
    if (scopeFilter !== 'COMPANY') {
      const siteGroups = new Map<string, PositionSection>();
      positions
        .filter((p) => p.scopeLevel === 'SITE' && matches(p))
        .forEach((p) => {
          const sid = p.siteId || 'sin-sede';
          if (!siteGroups.has(sid)) {
            siteGroups.set(sid, {
              key: `site-${sid}`,
              title: p.site?.name || 'Sede',
              icon: 'storefront-outline',
              scope: 'SITE',
              siteId: p.siteId || undefined,
              data: [],
            });
          }
          siteGroups.get(sid)!.data.push(p);
        });

      // Asegurar que la sede del contexto aparezca aunque no tenga puestos.
      if (tenantSiteId && !siteGroups.has(tenantSiteId) && !term) {
        siteGroups.set(tenantSiteId, {
          key: `site-${tenantSiteId}`,
          title: tenantSiteName || 'Sede',
          icon: 'storefront-outline',
          scope: 'SITE',
          siteId: tenantSiteId,
          data: [],
        });
      }

      siteGroups.forEach((section) => {
        section.data = sortPositions(section.data);
        result.push(section);
      });
    }

    return result;
  }, [positions, search, scopeFilter, tenantSiteId, tenantSiteName]);

  const totalVisible = useMemo(
    () => sections.reduce((acc, s) => acc + s.data.length, 0),
    [sections]
  );

  // Mapear puesto plano al shape que esperan los modales.
  const asTreeNode = (p: OrganizationPosition): PositionTreeNode => ({
    id: p.id,
    code: p.code,
    name: p.name,
    level: p.level,
    scopeLevel: p.scopeLevel,
    description: p.description,
    parentPositionId: p.parentPositionId,
    maxOccupants: p.maxOccupants,
    minOccupants: p.minOccupants,
    isActive: p.isActive,
    displayOrder: p.displayOrder,
    siteId: p.siteId,
    site: p.site,
  });

  const handlePositionPress = (position: OrganizationPosition) => {
    setSelectedPosition(position);
    setDetailModalVisible(true);
  };

  const handleEditPosition = (position: OrganizationPosition) => {
    setSelectedPosition(position);
    setEditModalVisible(true);
  };

  const handleDeletePosition = (position: OrganizationPosition) => {
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

  const handleCreate = (scope: ScopeLevel, siteId?: string) => {
    setCreateScope(scope);
    setCreateSiteId(scope === 'SITE' ? siteId : undefined);
    setSelectedPosition(null);
    setCreateModalVisible(true);
  };

  const handlePositionCreated = () => {
    setCreateModalVisible(false);
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

  const renderSectionHeader = ({ section }: { section: PositionSection }) => {
    const canAdd = section.scope === 'COMPANY' ? canCreateCompany : canCreateSite;
    return (
      <View style={styles.sectionHeader}>
        <Ionicons name={section.icon} size={16} color={theme.color.text.muted} />
        <Text style={styles.sectionTitle} numberOfLines={1}>
          {section.title}
        </Text>
        <Text style={styles.sectionCount}>{section.data.length}</Text>
        <View style={styles.sectionHeaderSpacer} />
        {canAdd && (
          <TouchableOpacity
            style={styles.sectionAddBtn}
            onPress={() => handleCreate(section.scope, section.siteId)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add" size={16} color={theme.color.text.onAction} />
            <Text style={styles.sectionAddText}>Nuevo</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderSectionFooter = ({ section }: { section: PositionSection }) =>
    section.data.length === 0 ? (
      <Text style={styles.sectionEmpty}>Sin puestos en esta sección</Text>
    ) : null;

  const renderItem = ({ item }: { item: OrganizationPosition }) => {
    const isActive = item.isActive !== false;
    const occupantsLabel =
      item.maxOccupants != null
        ? `${item.minOccupants ?? 0}–${item.maxOccupants} cupos`
        : `Mín. ${item.minOccupants ?? 0} · ilimitado`;

    return (
      <TouchableOpacity
        style={[styles.row, !isActive && styles.rowInactive]}
        activeOpacity={0.7}
        onPress={() => handlePositionPress(item)}
      >
        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeText}>N{item.level}</Text>
        </View>

        <View style={styles.rowContent}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.rowCode} numberOfLines={1}>
            {item.code}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {occupantsLabel}
            {!isActive ? ' · Inactivo' : ''}
          </Text>
        </View>

        <View style={styles.rowActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(e) => {
              e.stopPropagation();
              handleEditPosition(item);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="create-outline" size={20} color={theme.color.icon.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={(e) => {
              e.stopPropagation();
              handleDeletePosition(item);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={20} color={theme.color.icon.danger} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.color.brand.accent} />
        <Text style={styles.loadingText}>Cargando puestos...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, isTablet && styles.titleTablet]}>Organigrama · Lista</Text>
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

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={theme.color.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o código..."
          placeholderTextColor={theme.color.text.muted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearch('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={theme.color.text.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sectioned list */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.color.brand.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>
              {search ? 'Sin resultados' : 'No hay puestos registrados'}
            </Text>
            <Text style={styles.emptySubtext}>
              {search
                ? 'Prueba con otro término de búsqueda'
                : 'Usa el botón "Nuevo" de cada sección para crear un puesto'}
            </Text>
          </View>
        }
        ListFooterComponent={totalVisible > 0 ? <View style={styles.listFooterSpace} /> : null}
      />

      {/* Modals */}
      <CreatePositionModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={handlePositionCreated}
        parentPosition={null}
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
            position={asTreeNode(selectedPosition)}
          />

          <PositionDetailModal
            visible={detailModalVisible}
            onClose={() => {
              setDetailModalVisible(false);
              setSelectedPosition(null);
            }}
            position={asTreeNode(selectedPosition)}
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
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.color.surface.base,
      marginHorizontal: 20,
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: theme.color.text.body,
      paddingVertical: 0,
    },
    listContent: {
      padding: 20,
      paddingBottom: 40,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 16,
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.color.text.heading,
      flexShrink: 1,
    },
    sectionCount: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
      overflow: 'hidden',
    },
    sectionHeaderSpacer: {
      flex: 1,
    },
    sectionAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: theme.color.brand.accent,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
    },
    sectionAddText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    sectionEmpty: {
      fontSize: 12,
      color: theme.color.text.muted,
      fontStyle: 'italic',
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    rowInactive: {
      opacity: 0.55,
    },
    levelBadge: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: theme.color.brand.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    levelBadgeText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.color.brand.accent,
    },
    rowContent: {
      flex: 1,
    },
    rowName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: 2,
    },
    rowCode: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginBottom: 2,
    },
    rowMeta: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    rowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginLeft: 8,
    },
    actionBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
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
      textAlign: 'center',
    },
    listFooterSpace: {
      height: 24,
    },
  });

export default OrganizationChartListScreen;
