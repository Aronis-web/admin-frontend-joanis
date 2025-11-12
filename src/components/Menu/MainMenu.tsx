import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';

interface MenuItem {
  id: string;
  title: string;
  icon: string;
  color: string;
  requiredPermissions?: string[];
  submenu?: MenuItem[];
}

interface MainMenuProps {
  isVisible: boolean;
  onClose: () => void;
  onMenuSelect: (menuId: string) => void;
  onLogout: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  isVisible,
  onClose,
  onMenuSelect,
  onLogout,
}) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, fadeAnim, scaleAnim]);

  const menuItems: MenuItem[] = [
    {
      id: 'dashboard',
      title: 'Panel de Control',
      icon: '🎨',
      color: '#FF6B6B',
      requiredPermissions: ['dashboard.read'],
    },
    {
      id: 'configuracion',
      title: 'Configuración',
      icon: '⚡',
      color: '#4ECDC4',
      // No requiere permisos - se muestra si al menos un submenú es visible
      submenu: [
        {
          id: 'usuarios',
          title: 'Usuarios',
          icon: '👤',
          color: '#FF6B9D',
          requiredPermissions: ['users.read'],
        },
        {
          id: 'roles-permisos',
          title: 'Roles y Permisos',
          icon: '🔑',
          color: '#C44569',
          requiredPermissions: ['roles.read'],
        },
        {
          id: 'gestion-apps',
          title: 'Gestión de Apps',
          icon: '📲',
          color: '#F38181',
          requiredPermissions: ['apps.read'],
        },
        {
          id: 'sedes',
          title: 'Sedes',
          icon: '🏢',
          color: '#4ECDC4',
          requiredPermissions: ['sites.list'],
        },
      ],
    },
    {
      id: 'reportes',
      title: 'Reportes y Análisis',
      icon: '📊',
      color: '#95E1D3',
      requiredPermissions: ['reports.read'],
    },
  ];

  const handleMenuPress = (item: MenuItem) => {
    if (item.submenu) {
      // Toggle submenu expansion
      setExpandedMenus(prev => {
        const newSet = new Set(prev);
        if (newSet.has(item.id)) {
          newSet.delete(item.id);
        } else {
          newSet.add(item.id);
        }
        return newSet;
      });
    } else {
      onMenuSelect(item.id);
    }
  };

  const renderMenuItem = (item: MenuItem) => (
    <ProtectedElement
      key={item.id}
      requiredPermissions={item.requiredPermissions}
      fallback={null}
    >
      <View>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => handleMenuPress(item)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
            <Text style={styles.icon}>{item.icon}</Text>
          </View>
          <Text style={styles.menuItemText}>{item.title}</Text>
          {item.submenu && (
            <Text style={[styles.arrowIcon, expandedMenus.has(item.id) && styles.arrowIconExpanded]}>
              {expandedMenus.has(item.id) ? '▼' : '▶'}
            </Text>
          )}
        </TouchableOpacity>

        {item.submenu && expandedMenus.has(item.id) && (
          <View style={styles.submenu}>
            {item.submenu.map((subItem, index) => (
              <ProtectedElement
                key={subItem.id}
                requiredPermissions={subItem.requiredPermissions || []}
                fallback={null}
              >
                <TouchableOpacity
                  style={[
                    styles.submenuItem,
                    index === item.submenu!.length - 1 && { borderBottomWidth: 0 }
                  ]}
                  onPress={() => onMenuSelect(subItem.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.subIconContainer, { backgroundColor: subItem.color }]}>
                    <Text style={styles.subIcon}>{subItem.icon}</Text>
                  </View>
                  <Text style={styles.submenuItemText}>{subItem.title}</Text>
                </TouchableOpacity>
              </ProtectedElement>
            ))}
          </View>
        )}
      </View>
    </ProtectedElement>
  );

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.fullscreenOverlay,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <View style={styles.backgroundPattern}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Menú Principal</Text>
            <Text style={styles.subtitle}>Explora todas las opciones</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Items Grid */}
        <ScrollView style={styles.menuList} showsVerticalScrollIndicator={false}>
          <View style={styles.menuGrid}>
            {menuItems.map(renderMenuItem)}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => {
              onClose();
              onMenuSelect('debug-permissions');
            }}
          >
            <Text style={styles.debugButtonText}>🔍 Ver Mis Permisos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <View style={styles.logoutInner}>
              <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.footerText}>Panel Admin Grit</Text>
          <Text style={styles.footerSubtext}>© 2024 Todos los derechos reservados</Text>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fullscreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    backgroundColor: '#F8FAFC',
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    top: -100,
    right: -100,
  },
  circle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
    bottom: 100,
    left: -50,
  },
  circle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    top: '50%',
    right: 50,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '400',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '600',
  },
  menuList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  menuGrid: {
    paddingVertical: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  icon: {
    fontSize: 24,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  arrowIcon: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
    marginLeft: 8,
  },
  arrowIconExpanded: {
    color: '#4ECDC4',
  },
  submenu: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginVertical: 8,
    marginLeft: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  submenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  subIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  subIcon: {
    fontSize: 18,
  },
  submenuItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#475569',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  debugButton: {
    marginBottom: 12,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  debugButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoutInner: {
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
    textAlign: 'center',
  },
  footerSubtext: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '400',
  },
});

export default MainMenu;