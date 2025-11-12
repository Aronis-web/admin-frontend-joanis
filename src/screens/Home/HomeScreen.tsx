import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { BottomNavigation } from '@/components/Navigation/BottomNavigation';
import { MainMenu } from '@/components/Menu/MainMenu';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuthStore();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [chatBadge] = useState(3); // Ejemplo: 3 mensajes no leídos
  const [notificationsBadge] = useState(7); // Ejemplo: 7 notificaciones

  const handleMenuToggle = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const handleMenuClose = () => {
    setIsMenuVisible(false);
  };

  const handleMenuSelect = (menuId: string) => {
    setIsMenuVisible(false);

    // Aquí puedes agregar la navegación a diferentes pantallas
    switch (menuId) {
      case 'roles-permisos':
        navigation.navigate('RolesPermissions');
        break;
      case 'dashboard':
        // Navegando a Dashboard
        break;
      case 'configuracion':
        // Abriendo Configuración
        break;
      case 'usuarios':
        navigation.navigate('Users');
        break;
      case 'gestion-apps':
        navigation.navigate('Apps');
        break;
      case 'sedes':
        navigation.navigate('Sites');
        break;
      case 'debug-permissions':
        navigation.navigate('PermissionsDebug');
        break;
      case 'reportes':
        // Navegando a Reportes
        break;
      default:
        // Menú no reconocido
        console.log('Menu item not handled:', menuId);
        break;
    }
  };

  const handleLogout = async () => {
    setIsMenuVisible(false);
    await logout();
  };

  const handleChatPress = () => {
    // Navegar a pantalla de chat
    console.log('Abrir chat');
  };

  const handleNotificationsPress = () => {
    // Navegar a pantalla de notificaciones
    console.log('Abrir notificaciones');
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserRole = () => {
    if (user?.roles && user.roles.length > 0) {
      return user.roles[0].name;
    }
    return 'Usuario';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backgroundPattern}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header del Perfil */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user?.name ? getUserInitials(user.name) : 'U'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.welcomeText}>Bienvenido de nuevo</Text>
            <Text style={styles.userName}>{user?.name || 'Usuario'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'usuario@ejemplo.com'}</Text>
            <View style={styles.roleContainer}>
              <Text style={styles.userRole}>{getUserRole()}</Text>
            </View>
          </View>
        </View>

        {/* Tarjetas de Información */}
        <View style={styles.infoCards}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>Teléfono</Text>
            <Text style={styles.infoCardValue}>
              {user?.phone || 'No especificado'}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>ID de Usuario</Text>
            <Text style={styles.infoCardValue}>
              {user?.id || 'N/A'}
            </Text>
          </View>
        </View>

        {/* Sección de Roles y Permisos */}
        {user?.roles && user.roles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tus Roles</Text>
            <View style={styles.rolesContainer}>
              {user.roles.map((role, index) => (
                <View key={role.id} style={styles.roleBadge}>
                  <Text style={styles.roleText}>{role.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Estadísticas */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{user?.roles?.length || 0}</Text>
            <Text style={styles.statLabel}>Roles</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{user?.permissions?.length || 0}</Text>
            <Text style={styles.statLabel}>Permisos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>24h</Text>
            <Text style={styles.statLabel}>Último Acceso</Text>
          </View>
        </View>

        {/* Espacio para el botón flotante */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Barra de navegación inferior */}
      <BottomNavigation
        onChatPress={handleChatPress}
        onNotificationsPress={handleNotificationsPress}
        onMenuPress={handleMenuToggle}
        chatBadge={chatBadge}
        notificationsBadge={notificationsBadge}
      />

      {/* Menú principal con protección por permisos */}
      <MainMenu
        isVisible={isMenuVisible}
        onClose={handleMenuClose}
        onMenuSelect={handleMenuSelect}
        onLogout={handleLogout}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  content: {
    flex: 1,
    padding: 24,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 40,
    paddingTop: 20,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  profileInfo: {
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  userEmail: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 12,
  },
  roleContainer: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  userRole: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '600',
  },
  infoCards: {
    marginBottom: 32,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  infoCardTitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 6,
  },
  infoCardValue: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '600',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  rolesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
  },
  bottomSpacer: {
    height: 100,
  },
});

export default HomeScreen;
