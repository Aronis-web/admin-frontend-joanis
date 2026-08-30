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
import Alert from '@/utils/alert';

// Design System
import { activeOpacity, iconSizes } from '@/design-system/tokens';
import { Text, Title, Caption, Avatar, Divider, IconButton } from '@/design-system/components';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

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
  // Finanzas
  {
    id: 'finances',
    title: 'Finanzas',
    icon: 'wallet-outline',
    items: [
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
      {
        id: 'tesoreria',
        icon: 'briefcase-outline',
        label: 'Tesorería',
        subItems: [
          {
            id: 'tesoreria-operaciones',
            icon: 'swap-horizontal-outline',
            label: 'Operaciones Bancarias',
            route: MAIN_ROUTES.BANK_OPERATIONS,
            requiredPermissions: ['treasury.transactions.read'],
          },
          {
            id: 'tesoreria-upload-files',
            icon: 'cloud-upload-outline',
            label: 'Subir archivos',
            route: MAIN_ROUTES.TREASURY_UPLOAD_FILES,
            requiredPermissions: ['treasury.transactions.upload'],
          },
        ],
      },
      {
        id: 'cuentas-por',
        icon: 'swap-vertical-outline',
        label: 'Cuentas por',
        subItems: [
          {
            id: 'accounts-receivable',
            icon: 'trending-up-outline',
            label: 'Cuentas por Cobrar',
            route: MAIN_ROUTES.ACCOUNTS_RECEIVABLE,
            requiredPermissions: [
              'accounts-receivable.read',
              'accounts-receivable.read-own-company',
              'accounts-receivable.read-all',
            ],
          },
          {
            id: 'accounts-payable',
            icon: 'trending-down-outline',
            label: 'Cuentas por Pagar',
            route: MAIN_ROUTES.ACCOUNTS_PAYABLE,
            requiredPermissions: [
              'accounts-payable.read',
              'accounts-payable.read-own-company',
              'accounts-payable.read-all',
            ],
          },
        ],
      },
      {
        id: 'gastos-category',
        icon: 'receipt-outline',
        label: 'Gastos',
        subItems: [
          {
            id: 'expenses-templates',
            icon: 'repeat-outline',
            label: 'Gastos Recurrentes',
            route: MAIN_ROUTES.EXPENSE_TEMPLATES,
            requiredPermissions: ['expenses.templates.read'],
          },
          {
            id: 'expenses-list',
            icon: 'receipt-outline',
            label: 'Gastos',
            route: MAIN_ROUTES.EXPENSES,
            requiredPermissions: ['expenses.read'],
          },
        ],
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
        label: 'Campañas de Fotos',
        route: MAIN_ROUTES.PHOTOS,
        requiredPermissions: ['photo_campaigns.read'],
      },
      {
        id: 'etiquetas',
        icon: 'pricetag-outline',
        label: 'Etiquetas Electrónicas',
        route: MAIN_ROUTES.ETIQUETAS,
        // Sin permisos por ahora (etapa de desarrollo).
        requiredPermissions: [],
      },
      {
        id: 'tickets-turno',
        icon: 'receipt-outline',
        label: 'Tickets de Turno',
        route: MAIN_ROUTES.SHIFT_TICKETS,
        // Módulo libre: sin permisos.
        requiredPermissions: [],
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
      {
        id: 'sessions-management',
        icon: 'time-outline',
        label: 'Gestión de Sesiones',
        route: MAIN_ROUTES.SESSIONS_MANAGEMENT,
        requiredPermissions: ['admin.sessions.management.read'],
      },
      {
        id: 'recaudo-efectivo',
        icon: 'cash-outline',
        label: 'Recaudo Efectivo',
        route: MAIN_ROUTES.RECAUDO_EFECTIVO,
        requiredPermissions: [
          'admin.collections.scan',
          'admin.collections.process',
          'admin.collections.read',
          'admin.closure.scan',
          'admin.closure.collect-close',
          'admin.holdings.read',
          'admin.holdings.deposit',
        ],
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
  // Contaduría
  {
    id: 'accounting',
    title: 'Contaduría',
    icon: 'document-attach-outline',
    items: [
      {
        id: 'contaduria-dashboard',
        icon: 'stats-chart-outline',
        label: 'Dashboard Contaduría',
        route: MAIN_ROUTES.CONTADURIA_DASHBOARD,
        requiredPermissions: ['admin.sire_compras.invoices.read'],
      },
      {
        id: 'tax-documents',
        icon: 'document-text-outline',
        label: 'Documentos Tributarios',
        route: MAIN_ROUTES.BIZLINKS_DOCUMENTS,
        requiredPermissions: ['bizlinks.documents.view'],
      },
      {
        id: 'sire-compras',
        icon: 'sync-outline',
        label: 'Registro Compras · Conciliación',
        route: MAIN_ROUTES.SIRE_COMPRAS,
        requiredPermissions: ['admin.sire_compras.invoices.read'],
      },
      {
        id: 'sire-ventas',
        icon: 'sync-outline',
        label: 'Registro Ventas · Conciliación',
        route: MAIN_ROUTES.SIRE_VENTAS,
        requiredPermissions: ['admin.sire_ventas.invoices.read'],
      },
      {
        id: 'sire-compras-declared',
        icon: 'cloud-done-outline',
        label: 'Compras declaradas a SUNAT',
        route: MAIN_ROUTES.SIRE_COMPRAS_DECLARED,
        requiredPermissions: ['admin.sire_compras.declared.read'],
      },
      {
        id: 'sire-ventas-declared',
        icon: 'cloud-done-outline',
        label: 'Ventas declaradas a SUNAT',
        route: MAIN_ROUTES.SIRE_VENTAS_DECLARED,
        requiredPermissions: ['admin.sire_ventas.declared.read'],
      },
    ],
  },
  // Ventas WhatsApp (Chatbot)
  {
    id: 'ventas-whatsapp',
    title: 'Ventas WhatsApp',
    icon: 'logo-whatsapp',
    requiredPermissions: [
      'chatbot.chats.manage',
      'chatbot.orders.validate',
      'chatbot.catalog.manage',
      'chatbot.training.manage',
    ],
    items: [
      {
        id: 'chatbot-chats',
        icon: 'chatbubbles-outline',
        label: 'Chats',
        route: MAIN_ROUTES.CHATBOT_CHATS,
        requiredPermissions: ['chatbot.chats.manage'],
      },
      {
        id: 'chatbot-orders',
        icon: 'cart-outline',
        label: 'Pedidos',
        route: MAIN_ROUTES.CHATBOT_ORDERS,
        requiredPermissions: ['chatbot.orders.validate'],
      },
      {
        id: 'chatbot-catalog',
        icon: 'pricetags-outline',
        label: 'Catálogo',
        route: MAIN_ROUTES.CHATBOT_CATALOG,
        requiredPermissions: ['chatbot.catalog.manage'],
      },
      {
        id: 'chatbot-training',
        icon: 'school-outline',
        label: 'Entrenamiento',
        route: MAIN_ROUTES.CHATBOT_TRAINING,
        requiredPermissions: ['chatbot.training.manage'],
      },
    ],
  },
  // Asistencia
  {
    id: 'asistencia',
    title: 'Asistencia',
    icon: 'finger-print-outline',
    requiredPermissions: [
      'attendance.read.all',
      'attendance.read.own',
      'attendance.terminals.read',
    ],
    items: [
      {
        id: 'attendance-workers',
        icon: 'people-outline',
        label: 'Asistencia',
        route: MAIN_ROUTES.ATTENDANCE,
        requiredPermissions: ['attendance.read.all', 'attendance.read.own'],
      },
      {
        id: 'attendance-terminals',
        icon: 'hardware-chip-outline',
        label: 'Terminales',
        route: MAIN_ROUTES.ATTENDANCE_TERMINALS,
        requiredPermissions: ['attendance.terminals.read'],
      },
    ],
  },
  // RRHH (Recursos Humanos)
  {
    id: 'rrhh',
    title: 'RRHH',
    icon: 'people-circle-outline',
    requiredPermissions: [
      'organization.positions.company.read',
      'organization.positions.site.read',
    ],
    items: [
      {
        id: 'rrhh-organigrama',
        icon: 'git-network-outline',
        label: 'Organigrama',
        requiredPermissions: [
          'organization.positions.company.read',
          'organization.positions.site.read',
        ],
        subItems: [
          {
            id: 'rrhh-organigrama-lista',
            icon: 'list-outline',
            label: 'Lista',
            route: MAIN_ROUTES.ORGANIZATION_CHART_LIST,
            requiredPermissions: [
              'organization.positions.company.read',
              'organization.positions.site.read',
            ],
          },
          {
            id: 'rrhh-organigrama-visual',
            icon: 'git-network-outline',
            label: 'Visual',
            route: MAIN_ROUTES.ORGANIZATION_CHART,
            requiredPermissions: [
              'organization.positions.company.read',
              'organization.positions.site.read',
            ],
          },
        ],
      },
    ],
  },
  // Nota: el Correo se movió del menú a un acceso rápido en el footer,
  // junto al botón de cerrar sesión (ver render abajo).
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
            requiredPermissions: [
              'suppliers.read',
              'suppliers.create',
              'suppliers.update',
              'providers.read',
            ],
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
          {
            id: 'app-versions',
            icon: 'cloud-upload-outline',
            label: 'Versiones de App',
            route: MAIN_ROUTES.APP_VERSIONS,
            requiredPermissions: ['apps.manage', 'apps.read'],
          },
          {
            id: 'theme-playground',
            icon: 'color-palette-outline',
            label: 'Theme Playground',
            route: MAIN_ROUTES.THEME_PLAYGROUND,
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () => {
            onClose();
            setTimeout(logout, 300);
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleSiteChange = () => {
    onClose();
    setTimeout(() => {
      navigation.navigate(AUTH_ROUTES.SITE_SELECTION as never);
    }, 300);
  };

  const handleWebmail = () => {
    onClose();
    setTimeout(() => {
      navigation.navigate(MAIN_ROUTES.WEBMAIL_INBOX as never);
    }, 300);
  };

  const canOpenWebmail = hasPermission('webmail.read');

  const handleDrive = () => {
    onClose();
    setTimeout(() => {
      navigation.navigate(MAIN_ROUTES.DRIVE_HOME as never);
    }, 300);
  };

  const canOpenDrive = hasPermission('drive.read');

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
                <Ionicons name="business" size={iconSizes.md} color={theme.color.brand.primary} />
                <View style={styles.siteSelectorText}>
                  <Caption color="tertiary">Sede actual</Caption>
                  <Text variant="labelMedium" color="primary" numberOfLines={1}>
                    {selectedSite.name}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={iconSizes.sm}
                  color={theme.color.icon.subtle}
                />
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
              const isSingleDirectItem =
                category.items.length === 1 &&
                (!category.items[0].subItems || category.items[0].subItems.length === 0);

              // Single direct item (without subItems) - render directly
              if (isSingleDirectItem) {
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
                      <Ionicons
                        name={item.icon}
                        size={iconSizes.md}
                        color={theme.color.icon.muted}
                      />
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
                        <Ionicons
                          name={category.icon}
                          size={iconSizes.md}
                          color={theme.color.icon.muted}
                        />
                      </View>
                      <Text variant="titleSmall" color="primary">
                        {category.title}
                      </Text>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={iconSizes.sm}
                      color={theme.color.icon.subtle}
                    />
                  </TouchableOpacity>

                  {isExpanded &&
                    category.items.map((item) => {
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
                                <Ionicons
                                  name={item.icon}
                                  size={iconSizes.sm}
                                  color={theme.color.icon.subtle}
                                />
                              </View>
                              <Text
                                variant="bodySmall"
                                color="secondary"
                                style={styles.subMenuLabel}
                              >
                                {item.label}
                              </Text>
                              <Ionicons
                                name={isSubExpanded ? 'chevron-up' : 'chevron-down'}
                                size={iconSizes.xs}
                                color={theme.color.icon.subtle}
                              />
                            </TouchableOpacity>

                            {isSubExpanded &&
                              item.subItems.map((subItem) => (
                                <TouchableOpacity
                                  key={subItem.id}
                                  style={styles.subMenuItem}
                                  onPress={() => handleMenuItemPress(subItem.route)}
                                  activeOpacity={activeOpacity.medium}
                                >
                                  <View style={styles.subMenuItemIconSmall}>
                                    <Ionicons
                                      name={subItem.icon}
                                      size={iconSizes.sm}
                                      color={theme.color.icon.subtle}
                                    />
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
                            <Ionicons
                              name={item.icon}
                              size={iconSizes.sm}
                              color={theme.color.icon.subtle}
                            />
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
            <View style={styles.footerActions}>
              {canOpenWebmail && (
                <TouchableOpacity
                  style={styles.webmailButton}
                  onPress={handleWebmail}
                  activeOpacity={activeOpacity.medium}
                  accessibilityLabel="Abrir correo"
                >
                  <Ionicons
                    name="mail-outline"
                    size={iconSizes.lg}
                    color={theme.color.brand.primary}
                  />
                  <Text
                    variant="buttonMedium"
                    color={theme.color.brand.primary}
                    style={styles.webmailText}
                  >
                    Correo
                  </Text>
                </TouchableOpacity>
              )}
              {canOpenDrive && (
                <TouchableOpacity
                  style={styles.driveButton}
                  onPress={handleDrive}
                  activeOpacity={activeOpacity.medium}
                  accessibilityLabel="Abrir Drive"
                >
                  <Ionicons
                    name="cloud-outline"
                    size={iconSizes.lg}
                    color={theme.color.brand.primary}
                  />
                  <Text
                    variant="buttonMedium"
                    color={theme.color.brand.primary}
                    style={styles.driveText}
                  >
                    Drive
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
                activeOpacity={activeOpacity.medium}
              >
                <Ionicons
                  name="log-out-outline"
                  size={iconSizes.lg}
                  color={theme.color.state.danger.text}
                />
                <Text
                  variant="buttonMedium"
                  color={theme.color.state.danger.text}
                  style={styles.logoutText}
                >
                  Cerrar Sesión
                </Text>
              </TouchableOpacity>
            </View>
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    modalContainer: {
      flex: 1,
      flexDirection: 'row',
    },

    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
    },

    drawer: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      backgroundColor: theme.color.surface.base,
      ...theme.shadow.xl,
    },

    // ============================================
    // HEADER
    // ============================================
    header: {
      padding: theme.space[4],
    },

    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.space[4],
    },

    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1],
    },

    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.subtle,
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      marginBottom: theme.space[3],
    },

    userDetails: {
      flex: 1,
      marginLeft: theme.space[3],
    },

    siteSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.brand.primarySoft,
      padding: theme.space[3],
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },

    siteSelectorText: {
      flex: 1,
      marginLeft: theme.space[3],
    },

    // ============================================
    // MENU
    // ============================================
    menuScroll: {
      flex: 1,
    },

    menuScrollContent: {
      paddingVertical: theme.space[2],
    },

    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
    },

    menuItemIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.space[3],
    },

    categorySection: {
      marginBottom: theme.space[1],
    },

    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[4],
      backgroundColor: theme.color.surface.base,
    },

    categoryHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    categoryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[2.5],
      paddingLeft: theme.space[8],
      paddingRight: theme.space[4],
      backgroundColor: theme.color.surface.subtle,
    },

    subMenuItemIcon: {
      width: 28,
      height: 28,
      borderRadius: theme.radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.space[2],
    },

    subMenuItemIconSmall: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.space[2],
    },

    subCategoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[2.5],
      paddingLeft: theme.space[8],
      paddingRight: theme.space[4],
      backgroundColor: theme.color.surface.subtle,
    },

    subMenuLabel: {
      flex: 1,
    },

    subMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.space[2],
      paddingLeft: theme.space[14],
      paddingRight: theme.space[4],
      backgroundColor: theme.color.surface.muted,
    },

    // ============================================
    // FOOTER
    // ============================================
    footer: {
      paddingHorizontal: theme.space[4],
      paddingBottom: theme.space[2],
    },

    footerActions: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: theme.space[2],
      marginTop: theme.space[3],
    },

    webmailButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.space[3],
      backgroundColor: theme.color.brand.primarySoft,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },

    webmailText: {
      marginLeft: theme.space[2],
    },

    driveButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.space[3],
      backgroundColor: theme.color.brand.primarySoft,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },

    driveText: {
      marginLeft: theme.space[2],
    },

    logoutButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.space[3],
      backgroundColor: theme.color.state.danger.background,
      borderRadius: theme.radii.lg,
    },

    logoutText: {
      marginLeft: theme.space[2],
    },
  });

export default DrawerMenu;
