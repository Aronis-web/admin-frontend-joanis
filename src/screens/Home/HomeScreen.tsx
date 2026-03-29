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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header con gradiente */}
      <LinearGradient
        colors={[colors.primary[900], colors.primary[800]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View style={styles.greetingSection}>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <Text style={[styles.userName, isTablet && styles.userNameTablet]}>
              {user?.name?.split(' ')[0] || 'Usuario'}
            </Text>
          </View>
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image
                source={{ uri: user.avatar }}
                style={[styles.avatar, isTablet && styles.avatarTablet]}
              />
            ) : (
              <LinearGradient
                colors={[colors.accent[400], colors.accent[600]]}
                style={[styles.avatarPlaceholder, isTablet && styles.avatarPlaceholderTablet]}
              >
                <Text style={[styles.avatarText, isTablet && styles.avatarTextTablet]}>
                  {user?.name ? getUserInitials(user.name) : 'U'}
                </Text>
              </LinearGradient>
            )}
          </View>
        </View>

        {/* Info badges */}
        <View style={styles.badgesContainer}>
          {currentCompany && (
            <View style={styles.infoBadge}>
              <Ionicons name="business" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.infoBadgeText}>{currentCompany.alias || currentCompany.name}</Text>
            </View>
          )}
          {currentSite && (
            <View style={styles.infoBadge}>
              <Ionicons name="location" size={14} color="rgba(255,255,255,0.8)" />
              <Text style={styles.infoBadgeText}>{currentSite.name}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          isTablet && styles.contentTablet,
          isTablet && isLandscape && styles.contentTabletLandscape,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, isTablet && styles.profileCardTablet]}>
          <View style={styles.profileCardHeader}>
            <View style={styles.profileIconContainer}>
              <Ionicons name="person" size={20} color={colors.accent[600]} />
            </View>
            <Text style={styles.profileCardTitle}>Mi Perfil</Text>
          </View>

          <View style={styles.profileInfoRow}>
            <View style={styles.profileInfoItem}>
              <Text style={styles.profileInfoLabel}>Correo electrónico</Text>
              <Text style={styles.profileInfoValue}>{user?.email || 'No disponible'}</Text>
            </View>
          </View>

          <View style={styles.profileInfoRow}>
            <View style={styles.profileInfoItem}>
              <Text style={styles.profileInfoLabel}>Rol</Text>
              <View style={styles.roleContainer}>
                <Ionicons name="shield-checkmark" size={14} color={colors.accent[600]} />
                <Text style={styles.userRole}>{getUserRole()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* QR Code Section */}
        <View style={[styles.qrCard, isTablet && styles.qrCardTablet]}>
          <View style={styles.qrCardHeader}>
            <View style={styles.qrIconContainer}>
              <Ionicons name="qr-code" size={20} color={colors.primary[700]} />
            </View>
            <View style={styles.qrCardTitleContainer}>
              <Text style={styles.qrCardTitle}>Mi Código QR</Text>
              <Text style={styles.qrCardSubtitle}>Identificación única</Text>
            </View>
          </View>

          <View
            style={[
              styles.qrContainer,
              isTablet && styles.qrContainerTablet,
              isTablet && isLandscape && styles.qrContainerLandscape,
            ]}
          >
            {user?.id ? (
              <View style={styles.qrWrapper}>
                <QRCodeStyled
                  data={user.id}
                  style={
                    isTablet && isLandscape
                      ? styles.qrCodeLandscape
                      : isTablet
                        ? styles.qrCodeTablet
                        : styles.qrCode
                  }
                  color={colors.primary[900]}
                />
              </View>
            ) : (
              <View
                style={[
                  styles.qrPlaceholder,
                  isTablet && styles.qrPlaceholderTablet,
                  isTablet && isLandscape && styles.qrPlaceholderLandscape,
                ]}
              >
                <Ionicons name="qr-code-outline" size={48} color={colors.neutral[400]} />
                <Text style={styles.qrPlaceholderText}>Generando QR...</Text>
              </View>
            )}
          </View>

          <Text style={styles.qrHint}>
            <Ionicons name="information-circle-outline" size={14} color={colors.neutral[400]} />
            {' '}Usa este código para identificarte
          </Text>
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
  headerGradient: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingSection: {
    flex: 1,
  },
  greetingText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    marginBottom: spacing[0.5],
  },
  userName: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.neutral[0],
    letterSpacing: 0.3,
  },
  userNameTablet: {
    fontSize: 32,
  },
  avatarContainer: {},
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[0],
    letterSpacing: 1,
  },
  avatarTextTablet: {
    fontSize: 24,
  },
  avatarTablet: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholderTablet: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    gap: spacing[1.5],
  },
  infoBadgeText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing[5],
    paddingBottom: 100,
  },
  contentTablet: {
    paddingHorizontal: spacing[8],
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
  },
  contentTabletLandscape: {
    maxWidth: 800,
    paddingBottom: 80,
  },
  // Profile Card
  profileCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    padding: spacing[5],
    marginBottom: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  profileCardTablet: {
    padding: spacing[6],
  },
  profileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[5],
    paddingBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  profileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.accent[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  profileCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  profileInfoRow: {
    marginBottom: spacing[4],
  },
  profileInfoItem: {},
  profileInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[400],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing[1],
  },
  profileInfoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.neutral[700],
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent[50],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
    gap: spacing[1.5],
  },
  userRole: {
    fontSize: 13,
    color: colors.accent[700],
    fontWeight: '600',
  },
  // QR Card
  qrCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius['2xl'],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  qrCardTablet: {
    padding: spacing[6],
  },
  qrCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[5],
  },
  qrIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  qrCardTitleContainer: {
    flex: 1,
  },
  qrCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  qrCardSubtitle: {
    fontSize: 13,
    color: colors.neutral[500],
    marginTop: spacing[0.5],
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  qrContainerTablet: {},
  qrContainerLandscape: {},
  qrWrapper: {
    backgroundColor: colors.neutral[0],
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.neutral[100],
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  qrCode: {
    width: 180,
    height: 180,
  },
  qrCodeTablet: {
    width: 220,
    height: 220,
  },
  qrCodeLandscape: {
    width: 160,
    height: 160,
  },
  qrPlaceholder: {
    width: 180,
    height: 180,
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.neutral[200],
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
  },
  qrPlaceholderTablet: {
    width: 220,
    height: 220,
  },
  qrPlaceholderLandscape: {
    width: 160,
    height: 160,
  },
  qrPlaceholderText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.neutral[500],
  },
  qrHint: {
    fontSize: 13,
    color: colors.neutral[400],
    textAlign: 'center',
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 80,
  },
});

export default HomeScreen;
