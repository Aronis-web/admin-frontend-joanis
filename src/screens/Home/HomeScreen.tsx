import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { useAuthStore } from '@/store/auth';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/utils/config';
import QRCodeStyled from 'react-native-qrcode-styled';
import { useScreenTracking } from '@/hooks/useScreenTracking';

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  // Screen tracking
  useScreenTracking('HomeScreen', 'HomeScreen');

  const { user, logout, currentCompany, currentSite, setCurrentCompany, setCurrentSite } =
    useAuthStore();
  const { width, height } = useWindowDimensions();

  // Determine if device is tablet based on width (works for both portrait and landscape)
  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  const handleLogout = async () => {
    await logout();
  };

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.backgroundPattern}>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
        <View style={styles.circle3} />
      </View>

      <ScrollView
        style={[
          styles.content,
          isTablet && styles.contentTablet,
          isTablet && isLandscape && styles.contentTabletLandscape,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header del Perfil */}
        <View
          style={[
            styles.profileHeader,
            isTablet && styles.profileHeaderTablet,
            isTablet && isLandscape && styles.profileHeaderLandscape,
          ]}
        >
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image
                source={{ uri: user.avatar }}
                style={[styles.avatar, isTablet && styles.avatarTablet]}
              />
            ) : (
              <View style={[styles.avatarPlaceholder, isTablet && styles.avatarPlaceholderTablet]}>
                <Text style={[styles.avatarText, isTablet && styles.avatarTextTablet]}>
                  {user?.name ? getUserInitials(user.name) : 'U'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <Text style={[styles.welcomeText, isTablet && styles.welcomeTextTablet]}>
              Bienvenido de nuevo
            </Text>
            <Text style={[styles.userName, isTablet && styles.userNameTablet]}>
              {user?.name || 'Usuario'}
            </Text>
            <Text style={[styles.userEmail, isTablet && styles.userEmailTablet]}>
              {user?.email || 'usuario@ejemplo.com'}
            </Text>
            <View style={[styles.roleContainer, isTablet && styles.roleContainerTablet]}>
              <Text style={[styles.userRole, isTablet && styles.userRoleTablet]}>
                {getUserRole()}
              </Text>
            </View>
          </View>
        </View>

        {/* QR Code */}
        <View
          style={[
            styles.qrSection,
            isTablet && styles.qrSectionTablet,
            isTablet && isLandscape && styles.qrSectionLandscape,
          ]}
        >
          <View
            style={[
              styles.qrContainer,
              isTablet && styles.qrContainerTablet,
              isTablet && isLandscape && styles.qrContainerLandscape,
            ]}
          >
            {user?.id ? (
              <QRCodeStyled
                data={user.id}
                style={
                  isTablet && isLandscape
                    ? styles.qrCodeLandscape
                    : isTablet
                      ? styles.qrCodeTablet
                      : styles.qrCode
                }
                color={colors.neutral[800]}
              />
            ) : (
              <View
                style={[
                  styles.qrPlaceholder,
                  isTablet && styles.qrPlaceholderTablet,
                  isTablet && isLandscape && styles.qrPlaceholderLandscape,
                ]}
              >
                <Text
                  style={[
                    styles.qrIcon,
                    isTablet && styles.qrIconTablet,
                    isTablet && isLandscape && styles.qrIconLandscape,
                  ]}
                >
                  📱
                </Text>
                <Text
                  style={[
                    styles.qrText,
                    isTablet && styles.qrTextTablet,
                    isTablet && isLandscape && styles.qrTextLandscape,
                  ]}
                >
                  Generando QR...
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Espacio para el botón flotante */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
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
    backgroundColor: colors.accent[100],
    opacity: 0.3,
    top: -100,
    right: -100,
  },
  circle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.accent[200],
    opacity: 0.2,
    bottom: 100,
    left: -50,
  },
  circle3: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.primary[100],
    opacity: 0.2,
    top: '50%',
    right: 50,
  },
  content: {
    flex: 1,
    padding: spacing[6],
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing[10],
    paddingTop: spacing[5],
  },
  avatarContainer: {
    marginBottom: spacing[5],
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.neutral[0],
    shadowColor: colors.accent[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accent[500],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.neutral[0],
    shadowColor: colors.accent[500],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.neutral[0],
    letterSpacing: 1,
  },
  profileInfo: {
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: colors.neutral[500],
    fontWeight: '500',
    marginBottom: spacing[1],
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.neutral[800],
    marginBottom: spacing[1.5],
  },
  userEmail: {
    fontSize: 16,
    color: colors.neutral[500],
    marginBottom: spacing[3],
  },
  roleContainer: {
    backgroundColor: colors.accent[50],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.accent[100],
  },
  userRole: {
    fontSize: 13,
    color: colors.accent[500],
    fontWeight: '600',
  },
  qrSection: {
    marginBottom: spacing[6],
    alignItems: 'center',
  },
  qrContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    padding: spacing[5],
    borderWidth: 2,
    borderColor: colors.neutral[200],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCode: {
    width: 200,
    height: 200,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.neutral[200],
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
  },
  qrIcon: {
    fontSize: 48,
  },
  qrText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  bottomSpacer: {
    height: 100,
  },
  // Tablet-specific styles
  contentTablet: {
    paddingHorizontal: 48,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  profileHeaderTablet: {
    marginBottom: 48,
    paddingTop: 24,
  },
  avatarTablet: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholderTablet: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarTextTablet: {
    fontSize: 40,
  },
  welcomeTextTablet: {
    fontSize: 16,
  },
  userNameTablet: {
    fontSize: 34,
  },
  userEmailTablet: {
    fontSize: 18,
  },
  roleContainerTablet: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  userRoleTablet: {
    fontSize: 15,
  },
  qrSectionTablet: {
    marginBottom: 32,
  },
  qrContainerTablet: {
    padding: 24,
    borderRadius: 20,
  },
  qrCodeTablet: {
    width: 250,
    height: 250,
  },
  qrPlaceholderTablet: {
    width: 250,
    height: 250,
  },
  qrIconTablet: {
    fontSize: 56,
  },
  qrTextTablet: {
    fontSize: 18,
  },
  // Landscape-specific styles for tablets
  contentTabletLandscape: {
    maxWidth: 1200,
    paddingHorizontal: 64,
    paddingBottom: 70,
  },
  profileHeaderLandscape: {
    marginBottom: 20,
    paddingTop: 8,
  },
  qrSectionLandscape: {
    marginBottom: 20,
  },
  qrContainerLandscape: {
    padding: 16,
    borderRadius: 16,
  },
  qrCodeLandscape: {
    width: 180,
    height: 180,
  },
  qrPlaceholderLandscape: {
    width: 180,
    height: 180,
  },
  qrIconLandscape: {
    fontSize: 40,
  },
  qrTextLandscape: {
    fontSize: 15,
  },
});

export default HomeScreen;
