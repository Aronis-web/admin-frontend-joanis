import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Modal,
  ScrollView,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MAIN_ROUTES, AUTH_ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { usePermissions } from '@/hooks/usePermissions';

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  route: string;
  color: string;
  requiredPermissions?: string[];
}

interface MenuCategory {
  id: string;
  title: string;
  icon: string;
  color: string;
  items: MenuItem[];
  requiredPermissions?: string[];
}

const menuCategories: MenuCategory[] = [
  // Inicio - Sin submenú
  {
    id: 'home',
    title: 'Inicio',
    icon: '🏠',
    color: '#6366F1',
    items: [
      {
        id: 'home',
        icon: '🏠',
        label: 'Inicio',
        route: MAIN_ROUTES.HOME,
        color: '#6366F1',
      },
    ],
  },
  // Inventario
  {
    id: 'inventory',
    title: 'Inventario',
    icon: '📦',
    color: '#8B5CF6',
    items: [
      {
        id: 'products',
        icon: '📦',
        label: 'Productos',
        route: MAIN_ROUTES.PRODUCTS,
        color: '#8B5CF6',
        requiredPermissions: ['products.read', 'products.create', 'products.update'],
      },
      {
        id: 'stock',
        icon: '📊',
        label: 'Stock',
        route: MAIN_ROUTES.STOCK,
        color: '#10B981',
        requiredPermissions: ['products.read'],
      },
      {
        id: 'fotos',
        icon: '📸',
        label: 'Fotos',
        route: MAIN_ROUTES.PHOTOS,
        color: '#EC4899',
        requiredPermissions: ['products.read'],
      },
    ],
  },
  // Compras - Sin submenú
  {
    id: 'purchases',
    title: 'Compras',
    icon: '🛒',
    color: '#F59E0B',
    items: [
      {
        id: 'purchases',
        icon: '🛒',
        label: 'Compras',
        route: MAIN_ROUTES.PURCHASES,
        color: '#F59E0B',
        requiredPermissions: ['purchases.read', 'purchases.create', 'purchases.update'],
      },
    ],
  },
  // Ventas - Sin submenú
  {
    id: 'sales',
    title: 'Ventas',
    icon: '💰',
    color: '#10B981',
    items: [
      {
        id: 'sales',
        icon: '💰',
        label: 'Ventas',
        route: MAIN_ROUTES.SALES,
        color: '#10B981',
        requiredPermissions: ['sales.read', 'sales.create', 'sales.update'],
      },
    ],
  },
  // Campaña - Con submenú (Campañas y Repartos)
  {
    id: 'campana',
    title: 'Campaña',
    icon: '🎯',
    color: '#10B981',
    items: [
      {
        id: 'campaigns',
        icon: '📋',
        label: 'Campañas',
        route: MAIN_ROUTES.CAMPAIGNS,
        color: '#10B981',
        requiredPermissions: ['menu.campain'],
      },
      {
        id: 'repartos',
        icon: '🚚',
        label: 'Repartos',
        route: MAIN_ROUTES.REPARTOS,
        color: '#059669',
        requiredPermissions: ['campaigns.read'],
      },
    ],
  },
  // Traslados - Módulo Unificado (SALIDAS y ENTRADAS)
  {
    id: 'transfers',
    title: 'Traslados',
    icon: '🚛',
    color: '#EC4899',
    items: [
      {
        id: 'internal-transfers',
        icon: '📤',
        label: '📤 Traslado Interno',
        route: MAIN_ROUTES.INTERNAL_TRANSFERS,
        color: '#EC4899',
        requiredPermissions: ['transfers.read', 'transfers.create'],
      },
      {
        id: 'external-transfers',
        icon: '📤',
        label: '📤 Traslado Externo',
        route: MAIN_ROUTES.EXTERNAL_TRANSFERS,
        color: '#14B8A6',
        requiredPermissions: ['transfers.read', 'transfers.create'],
      },
      {
        id: 'receptions',
        icon: '📥',
        label: '📥 Recepciones',
        route: MAIN_ROUTES.RECEPTIONS,
        color: '#06B6D4',
        requiredPermissions: ['transfers.receive', 'transfers.validate', 'transfers.complete'],
      },
    ],
  },

  // Finanzas
  {
    id: 'finances',
    title: 'Finanzas',
    icon: '💰',
    color: '#DC2626',
    items: [
      {
        id: 'accounts-payable',
        icon: '💰',
        label: 'Cuentas por Pagar',
        route: MAIN_ROUTES.ACCOUNTS_PAYABLE,
        color: '#F59E0B',
        requiredPermissions: ['accounts-payable.read', 'accounts-payable.read-own-company', 'accounts-payable.read-all'],
      },
      {
        id: 'accounts-receivable',
        icon: '💵',
        label: 'Cuentas por Cobrar',
        route: MAIN_ROUTES.ACCOUNTS_RECEIVABLE,
        color: '#10B981',
        requiredPermissions: ['accounts-receivable.read', 'accounts-receivable.read-own-company', 'accounts-receivable.read-all'],
      },
      {
        id: 'treasury',
        icon: '🏦',
        label: 'Tesorería (Próximamente)',
        route: MAIN_ROUTES.HOME, // Temporal hasta que se implemente
        color: '#3B82F6',
        requiredPermissions: [],
      },
      {
        id: 'cash-reconciliation',
        icon: '📊',
        label: 'Cuadre de Caja',
        route: MAIN_ROUTES.CASH_RECONCILIATION_MENU,
        color: '#06B6D4',
      },
      {
        id: 'expenses-list',
        icon: '📋',
        label: 'Lista de Gastos',
        route: MAIN_ROUTES.EXPENSES,
        color: '#DC2626',
        requiredPermissions: ['expenses.read'],
      },
      {
        id: 'expenses-templates',
        icon: '🔄',
        label: 'Gastos Recurrentes',
        route: MAIN_ROUTES.EXPENSE_TEMPLATES,
        color: '#8B5CF6',
        requiredPermissions: [
          'expenses.templates.create',
          'expenses.templates.read',
          'expenses.templates.update',
          'expenses.templates.delete',
        ],
      },
    ],
  },
  // Generar Documentos (Bizlinks)
  {
    id: 'generate-documents',
    title: 'Generar Documentos',
    icon: '📝',
    color: '#10B981',
    items: [
      {
        id: 'bizlinks-generate',
        icon: '📝',
        label: 'Generar Documentos',
        route: MAIN_ROUTES.BIZLINKS_DOCUMENTS,
        color: '#10B981',
        requiredPermissions: ['bizlinks.documents.send'],
      },
    ],
  },
  // Configuración
  {
    id: 'config',
    title: 'Configuración',
    icon: '⚙️',
    color: '#6366F1',
    requiredPermissions: ['menu.config'],
    items: [
      // General
      {
        id: 'companies',
        icon: '🏛️',
        label: 'Empresas',
        route: MAIN_ROUTES.COMPANIES,
        color: '#6366F1',
      },
      {
        id: 'suppliers',
        icon: '🏢',
        label: 'Proveedores',
        route: MAIN_ROUTES.SUPPLIERS,
        color: '#3B82F6',
        requiredPermissions: [
          'suppliers.read',
          'suppliers.create',
          'suppliers.update',
          'providers.read',
        ],
      },
      {
        id: 'customers',
        icon: '👥',
        label: 'Clientes',
        route: MAIN_ROUTES.CUSTOMERS,
        color: '#10B981',
        requiredPermissions: [
          'customers.read',
          'customers.create',
          'customers.update',
        ],
      },
      // Usuarios
      {
        id: 'users',
        icon: '👥',
        label: 'Usuarios',
        route: MAIN_ROUTES.USERS,
        color: '#8B5CF6',
        requiredPermissions: ['users.read', 'users.create', 'users.update'],
      },
      {
        id: 'roles',
        icon: '🔐',
        label: 'Roles y Permisos',
        route: MAIN_ROUTES.ROLES_PERMISSIONS,
        color: '#EF4444',
        requiredPermissions: ['roles.read', 'roles.create', 'roles.update', 'permissions.read'],
      },
      // Productos Config
      {
        id: 'presentations',
        icon: '📋',
        label: 'Presentaciones',
        route: MAIN_ROUTES.PRESENTATIONS,
        color: '#F59E0B',
      },
      {
        id: 'price-profiles',
        icon: '💰',
        label: 'Perfiles de Precio',
        route: MAIN_ROUTES.PRICE_PROFILES,
        color: '#14B8A6',
      },
      // Gastos Config
      {
        id: 'expenses-categories',
        icon: '🏷️',
        label: 'Categorías de Gastos',
        route: MAIN_ROUTES.EXPENSES_CATEGORIES,
        color: '#FCA5A5',
        requiredPermissions: ['expenses.categories.read'],
      },
      // Organización
      {
        id: 'organization-chart',
        icon: '📊',
        label: 'Organigrama',
        route: MAIN_ROUTES.ORGANIZATION_CHART,
        color: '#F59E0B',
        requiredPermissions: ['organization.positions.company.read', 'organization.positions.site.read'],
      },
      // Reconocimiento Facial
      {
        id: 'face-recognition-menu',
        icon: '📸',
        label: 'Reconocimiento Facial',
        route: MAIN_ROUTES.FACE_RECOGNITION_MENU,
        color: '#EC4899',
        requiredPermissions: ['biometric.read', 'biometric.register', 'biometric.verify'],
      },
      // Configuración de Comprobantes
      {
        id: 'emission-points',
        icon: '📄',
        label: 'Configuración de Comprobantes',
        route: MAIN_ROUTES.EMISSION_POINTS,
        color: '#8B5CF6',
        requiredPermissions: ['billing.emission-points.read', 'billing.series.read'],
      },
      // Transporte
      {
        id: 'vehicles',
        icon: '🚗',
        label: 'Vehículos',
        route: 'Vehicles',
        color: '#06B6D4',
        requiredPermissions: [
          'transport.vehicles.read',
          'transport.vehicles.create',
          'transport.vehicles.update',
          'transport.vehicles.delete',
        ],
      },
      {
        id: 'drivers',
        icon: '👤',
        label: 'Conductores',
        route: 'Drivers',
        color: '#14B8A6',
        requiredPermissions: [
          'transport.drivers.read',
          'transport.drivers.create',
          'transport.drivers.update',
          'transport.drivers.delete',
        ],
      },
      // Apps
      {
        id: 'apps',
        icon: '📱',
        label: 'Apps',
        route: MAIN_ROUTES.APPS,
        color: '#06B6D4',
        requiredPermissions: ['apps.manage', 'apps.read'],
      },
    ],
  },
];

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
}

export const DrawerMenu: React.FC<DrawerMenuProps> = ({ visible, onClose, side = 'left' }) => {
  const [slideAnim] = useState(new Animated.Value(side === 'left' ? -300 : 300));
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['main']));
  const navigation = useNavigation();
  const { logout, user } = useAuthStore();
  const { selectedSite, setSelectedSite } = useTenantStore();
  const { hasPermission } = usePermissions();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isTablet = width >= 768;
  const drawerWidth = isTablet ? 400 : 350; // Increased by 25% (320->400, 280->350)

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: side === 'left' ? -drawerWidth : drawerWidth,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, side, drawerWidth]);

  const handleMenuItemPress = (route: string) => {
    onClose();
    setTimeout(() => {
      navigation.navigate(route as never);
    }, 300);
  };

  const handleLogout = () => {
    onClose();
    setTimeout(() => {
      logout();
    }, 300);
  };

  const handleSiteChange = () => {
    onClose();
    setTimeout(() => {
      // Navigate to site selection screen to change the current site
      navigation.navigate(AUTH_ROUTES.SITE_SELECTION as never);
    }, 300);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        // Close all other categories and open this one (accordion behavior)
        newSet.clear();
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Filter categories and items based on permissions
  const visibleCategories = menuCategories
    .filter((category) => {
      // Check category-level permissions first
      if (category.requiredPermissions && category.requiredPermissions.length > 0) {
        return category.requiredPermissions.some((permission) => hasPermission(permission));
      }
      return true;
    })
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => {
        if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
          return true;
        }
        return item.requiredPermissions.some((permission) => hasPermission(permission));
      }),
    }))
    .filter((category) => category.items.length > 0);

  return (
    <Modal visible={visible} animationType="none" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* Overlay */}
        <Pressable style={styles.overlay} onPress={onClose} />

        {/* Drawer */}
        <Animated.View
          style={[
            styles.drawer,
            {
              width: drawerWidth,
              [side]: 0,
              transform: [{ translateX: slideAnim }],
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Menú Principal</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* User Info */}
            <View style={styles.userInfo}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{user?.name || 'Usuario'}</Text>
                <Text style={styles.userEmail}>{user?.email || ''}</Text>
              </View>
            </View>

            {/* Site Selector */}
            {selectedSite && (
              <TouchableOpacity style={styles.siteSelector} onPress={handleSiteChange}>
                <View style={styles.siteSelectorContent}>
                  <Text style={styles.siteSelectorIcon}>🏪</Text>
                  <View style={styles.siteSelectorText}>
                    <Text style={styles.siteSelectorLabel}>Sede Actual</Text>
                    <Text style={styles.siteSelectorValue}>{selectedSite.name}</Text>
                  </View>
                </View>
                <Text style={styles.siteSelectorArrow}>›</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Menu Items */}
          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {visibleCategories.map((category) => {
              const isExpanded = expandedCategories.has(category.id);
              const isSingleItem = category.items.length === 1;

              // Si solo tiene un item, renderizar directamente sin categoría
              if (isSingleItem) {
                const item = category.items[0];
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={styles.singleMenuItem}
                    onPress={() => handleMenuItemPress(item.route)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.menuItemIcon, { backgroundColor: item.color }]}>
                      <Text style={styles.menuItemEmoji}>{item.icon}</Text>
                    </View>
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                  </TouchableOpacity>
                );
              }

              // Categoría con múltiples items (desplegable)
              return (
                <View key={category.id} style={styles.categorySection}>
                  {/* Category Header */}
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() => toggleCategory(category.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.categoryHeaderContent}>
                      <View style={[styles.menuItemIcon, { backgroundColor: category.color }]}>
                        <Text style={styles.menuItemEmoji}>{category.icon}</Text>
                      </View>
                      <Text style={styles.categoryTitle}>{category.title}</Text>
                      <Text style={styles.categoryCount}>({category.items.length})</Text>
                    </View>
                    <Text
                      style={[styles.categoryArrow, isExpanded && styles.categoryArrowExpanded]}
                    >
                      ›
                    </Text>
                  </TouchableOpacity>

                  {/* Category Items */}
                  {isExpanded &&
                    category.items.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.menuItem}
                        onPress={() => handleMenuItemPress(item.route)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.menuItemIcon, { backgroundColor: item.color }]}>
                          <Text style={styles.menuItemEmoji}>{item.icon}</Text>
                        </View>
                        <Text style={styles.menuItemLabel}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: '600',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    borderRadius: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: '#6B7280',
  },
  siteSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  siteSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  siteSelectorIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  siteSelectorText: {
    flex: 1,
  },
  siteSelectorLabel: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  siteSelectorValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  siteSelectorArrow: {
    fontSize: 24,
    color: '#6366F1',
    fontWeight: '600',
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingVertical: 8,
  },
  categorySection: {
    marginBottom: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  singleMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  categoryHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  categoryCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginLeft: 6,
  },
  categoryArrow: {
    fontSize: 24,
    fontWeight: '700',
    color: '#9CA3AF',
    transform: [{ rotate: '90deg' }],
    marginLeft: 8,
  },
  categoryArrowExpanded: {
    transform: [{ rotate: '-90deg' }],
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingLeft: 68,
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemEmoji: {
    fontSize: 18,
  },
  menuItemLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#DC2626',
  },
});
