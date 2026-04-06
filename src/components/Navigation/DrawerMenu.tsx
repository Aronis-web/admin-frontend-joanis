/**
 * DrawerMenu - Rediseñado con Design System
 *
 * Menú de navegación lateral profesional y moderno.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Modal,
  ScrollView,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MAIN_ROUTES, AUTH_ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/store/auth';
import { useTenantStore } from '@/store/tenant';
import { usePermissions } from '@/hooks/usePermissions';

// Design System
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  activeOpacity,
  iconSizes,
} from '@/design-system/tokens';
import {
  Text,
  Title,
  Body,
  Caption,
  Avatar,
  Divider,
  IconButton,
} from '@/design-system/components';

// Settings Modal
import { SettingsModal } from './SettingsModal';

// ============================================
// MENU CONFIGURATION
// ============================================
interface MenuItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  requiredPermissions?: string[];
  subItems?: MenuItem[];
}

interface MenuCategory {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: MenuItem[];
  requiredPermissions?: string[];
}

const menuCategories: MenuCategory[] = [
  // Dashboard
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: 'analytics-outline',
    items: [
      {
        id: 'dashboard',
        icon: 'bar-chart-outline',
        label: 'Dashboard',
        route: MAIN_ROUTES.DASHBOARD,
        requiredPermissions: ['dashboard.read'],
      },
    ],
  },
  // Inicio
  {
    id: 'home',
    title: 'Inicio',
    icon: 'home-outline',
    items: [
      {
        id: 'home',
        icon: 'home-outline',
        label: 'Inicio',
        route: MAIN_ROUTES.HOME,
      },
    ],
  },
  // Inventario
  {
    id: 'inventory',
    title: 'Inventario',
    icon: 'cube-outline',
    items: [
      {
        id: 'products',
        icon: 'cube-outline',
        label: 'Productos',
        route: MAIN_ROUTES.PRODUCTS,
        requiredPermissions: ['products.read', 'products.create', 'products.update'],
      },
      {
        id: 'stock',
        icon: 'layers-outline',
        label: 'Stock',
        route: MAIN_ROUTES.STOCK,
        requiredPermissions: ['products.read'],
      },
      {
        id: 'fotos',
        icon: 'camera-outline',
        label: 'Fotos',
        route: MAIN_ROUTES.PHOTOS,
        requiredPermissions: ['products.read'],
      },
    ],
  },
  // Compras
  {
    id: 'purchases',
    title: 'Compras',
    icon: 'cart-outline',
    items: [
      {
        id: 'purchases',
        icon: 'cart-outline',
        label: 'Compras',
        route: MAIN_ROUTES.PURCHASES,
        requiredPermissions: ['purchases.read', 'purchases.create', 'purchases.update'],
      },
    ],
  },
  // Ventas
  {
    id: 'sales',
    title: 'Ventas',
    icon: 'cash-outline',
    items: [
      {
        id: 'sales',
        icon: 'cash-outline',
        label: 'Ventas',
        route: MAIN_ROUTES.SALES,
        requiredPermissions: ['sales.read', 'sales.create', 'sales.update'],
      },
    ],
  },
  // Campaña
  {
    id: 'campana',
    title: 'Campaña',
    icon: 'megaphone-outline',
    items: [
      {
        id: 'campaigns',
        icon: 'calendar-outline',
        label: 'Campañas',
        route: MAIN_ROUTES.CAMPAIGNS,
        requiredPermissions: ['menu.campain'],
      },
      {
        id: 'repartos',
        icon: 'bicycle-outline',
        label: 'Repartos',
        route: MAIN_ROUTES.REPARTOS,
        requiredPermissions: ['campaigns.read'],
      },
    ],
  },
  // Traslados
  {
    id: 'transfers',
    title: 'Traslados',
    icon: 'swap-horizontal-outline',
    items: [
      {
        id: 'internal-transfers',
        icon: 'arrow-forward-outline',
        label: 'Traslado Interno',
        route: MAIN_ROUTES.INTERNAL_TRANSFERS,
        requiredPermissions: ['transfers.read', 'transfers.create'],
      },
      {
        id: 'external-transfers',
        icon: 'globe-outline',
        label: 'Traslado Externo',
        route: MAIN_ROUTES.EXTERNAL_TRANSFERS,
        requiredPermissions: ['transfers.read', 'transfers.create'],
      },
      {
        id: 'receptions',
        icon: 'download-outline',
        label: 'Recepciones',
        route: MAIN_ROUTES.RECEPTIONS,
        requiredPermissions: ['transfers.receive', 'transfers.validate', 'transfers.complete'],
      },
    ],
  },
  // Finanzas
  {
    id: 'finances',
    title: 'Finanzas',
    icon: 'wallet-outline',
    items: [
      {
        id: 'accounts-payable',
        icon: 'trending-down-outline',
        label: 'Cuentas por Pagar',
        route: MAIN_ROUTES.ACCOUNTS_PAYABLE,
        requiredPermissions: ['accounts-payable.read', 'accounts-payable.read-own-company', 'accounts-payable.read-all'],
      },
      {
        id: 'accounts-receivable',
        icon: 'trending-up-outline',
        label: 'Cuentas por Cobrar',
        route: MAIN_ROUTES.ACCOUNTS_RECEIVABLE,
        requiredPermissions: ['accounts-receivable.read', 'accounts-receivable.read-own-company', 'accounts-receivable.read-all'],
      },
      {
        id: 'expenses-list',
        icon: 'receipt-outline',
        label: 'Lista de Gastos',
        route: MAIN_ROUTES.EXPENSES,
        requiredPermissions: ['expenses.read'],
      },
      {
        id: 'expenses-templates',
        icon: 'repeat-outline',
        label: 'Gastos Recurrentes',
        route: MAIN_ROUTES.EXPENSE_TEMPLATES,
        requiredPermissions: ['expenses.templates.read'],
      },
      {
        id: 'cash-reconciliation',
        icon: 'calculator-outline',
        label: 'Cuadre de Caja',
        requiredPermissions: ['cash_reconciliation.read'],
        subItems: [
          {
            id: 'upload-cash-files',
            icon: 'cloud-upload-outline',
            label: 'Subir Archivos',
            route: MAIN_ROUTES.UPLOAD_CASH_RECONCILIATION_FILES,
            requiredPermissions: ['cash_reconciliation.upload'],
          },
          {
            id: 'review-documents',
            icon: 'document-text-outline',
            label: 'Revisar Documentos',
            route: MAIN_ROUTES.REVIEW_DOCUMENTS_MENU,
            requiredPermissions: ['cash_reconciliation.read'],
          },
          {
            id: 'cuadre',
            icon: 'checkmark-done-outline',
            label: 'Cuadre',
            route: MAIN_ROUTES.CUADRE,
            requiredPermissions: ['cash_reconciliation.read'],
          },
        ],
      },
    ],
  },
  // Contaduría
  {
    id: 'accounting',
    title: 'Contaduría',
    icon: 'document-attach-outline',
    items: [
      {
        id: 'generate-documents',
        icon: 'create-outline',
        label: 'Generar Documentos',
        route: MAIN_ROUTES.BIZLINKS_DOCUMENTS,
        requiredPermissions: ['bizlinks.documents.view', 'bizlinks.documents.send'],
      },
      {
        id: 'retenciones',
        icon: 'shield-checkmark-outline',
        label: 'Retenciones',
        route: MAIN_ROUTES.RETENCIONES,
        requiredPermissions: ['bizlinks.documents.view', 'bizlinks.documents.send'],
      },
    ],
  },
  // Configuración
  {
    id: 'config',
    title: 'Configuración',
    icon: 'settings-outline',
    requiredPermissions: ['menu.config'],
    items: [
      {
        id: 'companies',
        icon: 'business-outline',
        label: 'Empresas',
        route: MAIN_ROUTES.COMPANIES,
      },
      {
        id: 'customers',
        icon: 'people-outline',
        label: 'Clientes',
        route: MAIN_ROUTES.CUSTOMERS,
        requiredPermissions: ['customers.read', 'customers.create', 'customers.update'],
      },
      {
        id: 'products-config',
        icon: 'pricetags-outline',
        label: 'Productos',
        subItems: [
          {
            id: 'presentations',
            icon: 'list-outline',
            label: 'Presentaciones',
            route: MAIN_ROUTES.PRESENTATIONS,
          },
          {
            id: 'price-profiles',
            icon: 'pricetag-outline',
            label: 'Perfiles de Precio',
            route: MAIN_ROUTES.PRICE_PROFILES,
          },
          {
            id: 'suppliers',
            icon: 'storefront-outline',
            label: 'Proveedores',
            route: MAIN_ROUTES.SUPPLIERS,
            requiredPermissions: ['suppliers.read', 'suppliers.create', 'suppliers.update', 'providers.read'],
          },
        ],
      },
      {
        id: 'documents-config',
        icon: 'folder-outline',
        label: 'Documentos',
        subItems: [
          {
            id: 'emission-points',
            icon: 'print-outline',
            label: 'Comprobantes',
            route: MAIN_ROUTES.EMISSION_POINTS,
            requiredPermissions: ['billing.emission-points.read', 'billing.series.read'],
          },
          {
            id: 'vehicles',
            icon: 'car-outline',
            label: 'Vehículos',
            route: 'Vehicles',
            requiredPermissions: ['transport.vehicles.read'],
          },
          {
            id: 'drivers',
            icon: 'person-circle-outline',
            label: 'Conductores',
            route: 'Drivers',
            requiredPermissions: ['transport.drivers.read'],
          },
          {
            id: 'transporters',
            icon: 'bus-outline',
            label: 'Transportistas',
            route: 'Transporters',
            requiredPermissions: ['transport.transporters.read'],
          },
        ],
      },
      {
        id: 'access-config',
        icon: 'lock-closed-outline',
        label: 'Acceso',
        subItems: [
          {
            id: 'users',
            icon: 'people-outline',
            label: 'Usuarios',
            route: MAIN_ROUTES.USERS,
            requiredPermissions: ['users.read', 'users.create', 'users.update'],
          },
          {
            id: 'organization-chart',
            icon: 'git-network-outline',
            label: 'Organigrama',
            route: MAIN_ROUTES.ORGANIZATION_CHART,
            requiredPermissions: ['organization.positions.company.read', 'organization.positions.site.read'],
          },
          {
            id: 'roles',
            icon: 'key-outline',
            label: 'Roles y Permisos',
            route: MAIN_ROUTES.ROLES_PERMISSIONS,
            requiredPermissions: ['roles.read', 'roles.create', 'roles.update', 'permissions.read'],
          },
        ],
      },
      {
        id: 'others-config',
        icon: 'ellipsis-horizontal-outline',
        label: 'Otros',
        subItems: [
          {
            id: 'face-recognition-menu',
            icon: 'scan-outline',
            label: 'Reconocimiento Facial',
            route: MAIN_ROUTES.FACE_RECOGNITION_MENU,
            requiredPermissions: ['biometric.read', 'biometric.register', 'biometric.verify'],
          },
          {
            id: 'apps',
            icon: 'apps-outline',
            label: 'Apps',
            route: MAIN_ROUTES.APPS,
            requiredPermissions: ['apps.manage', 'apps.read'],
          },
          {
            id: 'expenses-categories',
            icon: 'bookmark-outline',
            label: 'Categorías de Gastos',
            route: MAIN_ROUTES.EXPENSES_CATEGORIES,
            requiredPermissions: ['expenses.categories.read'],
          },
          {
            id: 'series-config',
            icon: 'options-outline',
            label: 'Config. Series Cuadre',
            route: MAIN_ROUTES.SERIES_CONFIG,
            requiredPermissions: ['cash_reconciliation.config'],
          },
        ],
      },
    ],
  },
];

// ============================================
// DRAWER MENU COMPONENT
// ============================================
interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
}

export const DrawerMenu: React.FC<DrawerMenuProps> = ({ visible, onClose, side = 'left' }) => {
  const [slideAnim] = useState(new Animated.Value(side === 'left' ? -300 : 300));
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubItems, setExpandedSubItems] = useState<Set<string>>(new Set());
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const navigation = useNavigation();
  const { logout, user } = useAuthStore();
  const { selectedSite } = useTenantStore();
  const { hasPermission } = usePermissions();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isTablet = width >= 768;
  const drawerWidth = isTablet ? 380 : 320;

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

  const handleMenuItemPress = (route: string | undefined) => {
    if (!route) return;
    onClose();
    setTimeout(() => {
      navigation.navigate(route as never);
    }, 300);
  };

  const handleLogout = () => {
    onClose();
    setTimeout(logout, 300);
  };

  const handleSiteChange = () => {
    onClose();
    setTimeout(() => {
      navigation.navigate(AUTH_ROUTES.SITE_SELECTION as never);
    }, 300);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.clear();
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const toggleSubItem = (itemId: string) => {
    setExpandedSubItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Filter categories and items based on permissions
  const visibleCategories = menuCategories
    .filter((category) => {
      if (category.requiredPermissions && category.requiredPermissions.length > 0) {
        return category.requiredPermissions.some((permission) => hasPermission(permission));
      }
      return true;
    })
    .map((category) => ({
      ...category,
      items: category.items
        .filter((item) => {
          if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
            return true;
          }
          return item.requiredPermissions.some((permission) => hasPermission(permission));
        })
        .map((item) => {
          if (item.subItems && item.subItems.length > 0) {
            const filteredSubItems = item.subItems.filter((subItem) => {
              if (!subItem.requiredPermissions || subItem.requiredPermissions.length === 0) {
                return true;
              }
              return subItem.requiredPermissions.some((permission) => hasPermission(permission));
            });
            return { ...item, subItems: filteredSubItems };
          }
          return item;
        })
        .filter((item) => {
          if (!item.subItems || item.subItems.length === 0) return true;
          return item.subItems.length > 0;
        }),
    }))
    .filter((category) => category.items.length > 0);

  return (
    <Modal visible={visible} animationType="none" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <Pressable style={styles.overlay} onPress={onClose} />

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
            <View style={styles.headerTop}>
              <Title size="large">Menú</Title>
              <View style={styles.headerActions}>
                <IconButton
                  icon="settings-outline"
                  onPress={() => setIsSettingsModalVisible(true)}
                  variant="ghost"
                  size="medium"
                />
                <IconButton icon="close" onPress={onClose} variant="ghost" size="medium" />
              </View>
            </View>

            {/* User Info */}
            <View style={styles.userInfo}>
              <Avatar name={user?.name || 'Usuario'} size="large" />
              <View style={styles.userDetails}>
                <Text variant="titleSmall" color="primary" numberOfLines={1}>
                  {user?.name || 'Usuario'}
                </Text>
                <Caption color="tertiary" numberOfLines={1}>
                  {user?.email || ''}
                </Caption>
              </View>
            </View>

            {/* Site Selector */}
            {selectedSite && (
              <TouchableOpacity
                style={styles.siteSelector}
                onPress={handleSiteChange}
                activeOpacity={activeOpacity.medium}
              >
                <Ionicons name="business" size={iconSizes.md} color={colors.primary[900]} />
                <View style={styles.siteSelectorText}>
                  <Caption color="tertiary">Sede actual</Caption>
                  <Text variant="labelMedium" color="primary" numberOfLines={1}>
                    {selectedSite.name}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={iconSizes.sm} color={colors.icon.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          <Divider spacing="none" />

          {/* Menu Items */}
          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {visibleCategories.map((category) => {
              const isExpanded = expandedCategories.has(category.id);
              const isSingleItem = category.items.length === 1;

              // Single item - render directly
              if (isSingleItem) {
                const item = category.items[0];
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={styles.menuItem}
                    onPress={() => handleMenuItemPress(item.route)}
                    activeOpacity={activeOpacity.medium}
                    disabled={!item.route}
                  >
                    <View style={styles.menuItemIcon}>
                      <Ionicons name={item.icon} size={iconSizes.md} color={colors.icon.secondary} />
                    </View>
                    <Text variant="bodyMedium" color="primary">
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }

              // Category with multiple items
              return (
                <View key={category.id} style={styles.categorySection}>
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() => toggleCategory(category.id)}
                    activeOpacity={activeOpacity.medium}
                  >
                    <View style={styles.categoryHeaderLeft}>
                      <View style={styles.menuItemIcon}>
                        <Ionicons name={category.icon} size={iconSizes.md} color={colors.icon.secondary} />
                      </View>
                      <Text variant="titleSmall" color="primary">
                        {category.title}
                      </Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={iconSizes.sm}
                      color={colors.icon.tertiary}
                    />
                  </TouchableOpacity>

                  {isExpanded && category.items.map((item) => {
                    if (item.subItems && item.subItems.length > 0) {
                      const isSubExpanded = expandedSubItems.has(item.id);
                      return (
                        <View key={item.id}>
                          <TouchableOpacity
                            style={styles.subCategoryHeader}
                            onPress={() => toggleSubItem(item.id)}
                            activeOpacity={activeOpacity.medium}
                          >
                            <View style={styles.subMenuItemIcon}>
                              <Ionicons name={item.icon} size={iconSizes.sm} color={colors.icon.tertiary} />
                            </View>
                            <Text variant="bodySmall" color="secondary" style={styles.subMenuLabel}>
                              {item.label}
                            </Text>
                            <Ionicons
                              name={isSubExpanded ? 'chevron-up' : 'chevron-down'}
                              size={iconSizes.xs}
                              color={colors.icon.tertiary}
                            />
                          </TouchableOpacity>

                          {isSubExpanded && item.subItems.map((subItem) => (
                            <TouchableOpacity
                              key={subItem.id}
                              style={styles.subMenuItem}
                              onPress={() => handleMenuItemPress(subItem.route)}
                              activeOpacity={activeOpacity.medium}
                            >
                              <View style={styles.subMenuItemIconSmall}>
                                <Ionicons name={subItem.icon} size={iconSizes.sm} color={colors.icon.tertiary} />
                              </View>
                              <Text variant="bodySmall" color="secondary">
                                {subItem.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      );
                    }

                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.categoryItem}
                        onPress={() => handleMenuItemPress(item.route)}
                        activeOpacity={activeOpacity.medium}
                      >
                        <View style={styles.subMenuItemIcon}>
                          <Ionicons name={item.icon} size={iconSizes.sm} color={colors.icon.tertiary} />
                        </View>
                        <Text variant="bodySmall" color="secondary">
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Divider spacing="none" />
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={activeOpacity.medium}
            >
              <Ionicons name="log-out-outline" size={iconSizes.lg} color={colors.danger[600]} />
              <Text variant="buttonMedium" color={colors.danger[600]} style={styles.logoutText}>
                Cerrar Sesión
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Settings Modal */}
        <SettingsModal
          visible={isSettingsModalVisible}
          onClose={() => setIsSettingsModalVisible(false)}
        />
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
    backgroundColor: colors.overlay.medium,
  },

  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.surface.primary,
    ...shadows.xl,
  },

  // ============================================
  // HEADER
  // ============================================
  header: {
    padding: spacing[4],
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },

  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.secondary,
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
  },

  userDetails: {
    flex: 1,
    marginLeft: spacing[3],
  },

  siteSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },

  siteSelectorText: {
    flex: 1,
    marginLeft: spacing[3],
  },

  // ============================================
  // MENU
  // ============================================
  menuScroll: {
    flex: 1,
  },

  menuScrollContent: {
    paddingVertical: spacing[2],
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },

  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },

  categorySection: {
    marginBottom: spacing[1],
  },

  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.surface.primary,
  },

  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2.5],
    paddingLeft: spacing[8],
    paddingRight: spacing[4],
    backgroundColor: colors.surface.secondary,
  },

  subMenuItemIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[2],
  },

  subMenuItemIconSmall: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[2],
  },

  subCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2.5],
    paddingLeft: spacing[8],
    paddingRight: spacing[4],
    backgroundColor: colors.surface.secondary,
  },

  subMenuLabel: {
    flex: 1,
  },

  subMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    paddingLeft: spacing[14],
    paddingRight: spacing[4],
    backgroundColor: colors.surface.tertiary,
  },

  // ============================================
  // FOOTER
  // ============================================
  footer: {
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[3],
    marginTop: spacing[3],
    backgroundColor: colors.danger[50],
    borderRadius: borderRadius.lg,
  },

  logoutText: {
    marginLeft: spacing[2],
  },
});

export default DrawerMenu;
