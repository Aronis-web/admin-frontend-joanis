import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/design-system/themes';
import { useThemedStyles } from '@/design-system/themes/useThemedStyles';
import type { Theme } from '@/design-system/themes/defaultLight';
import { ProtectedElement } from '@/components/auth/ProtectedRoute';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '@/utils/config';
import QRCodeStyled from 'react-native-qrcode-styled';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import Alert from '@/utils/alert';

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  // Screen tracking
  useScreenTracking('HomeScreen', 'HomeScreen');

  const { user, logout, currentCompany, currentSite, setCurrentCompany, setCurrentSite } =
    useAuthStore();
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

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
        colors={[theme.color.brand.headerFrom, theme.color.brand.headerTo]}
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
                colors={[theme.color.brand.avatarFrom, theme.color.brand.avatarTo]}
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
              <Ionicons name="business" size={14} color={theme.color.brand.onHeaderMuted} />
              <Text style={styles.infoBadgeText}>{currentCompany.alias || currentCompany.name}</Text>
            </View>
          )}
          {currentSite && (
            <View style={styles.infoBadge}>
              <Ionicons name="location" size={14} color={theme.color.brand.onHeaderMuted} />
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
              <Ionicons name="person" size={20} color={theme.color.icon.accent} />
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
                <Ionicons name="shield-checkmark" size={14} color={theme.color.icon.accent} />
                <Text style={styles.userRole}>{getUserRole()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* QR Code Section */}
        <View style={[styles.qrCard, isTablet && styles.qrCardTablet]}>
          <View style={styles.qrCardHeader}>
            <View style={styles.qrIconContainer}>
              <Ionicons name="qr-code" size={20} color={theme.color.brand.primary} />
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
                  color={theme.color.brand.primary}
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
                <Ionicons name="qr-code-outline" size={48} color={theme.color.text.placeholder} />
                <Text style={styles.qrPlaceholderText}>Generando QR...</Text>
              </View>
            )}
          </View>

          <Text style={styles.qrHint}>
            <Ionicons name="information-circle-outline" size={14} color={theme.color.text.placeholder} />
            {' '}Usa este código para identificarte
          </Text>
        </View>

        {/* Espacio para el botón flotante */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  headerGradient: {
    paddingHorizontal: theme.space[5],
    paddingTop: theme.space[4],
    paddingBottom: theme.space[6],
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
    color: theme.color.brand.onHeaderMuted,
    fontWeight: '500',
    marginBottom: theme.space[0.5],
  },
  userName: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
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
    borderColor: theme.color.brand.headerBorder,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.color.brand.headerBorder,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.brand.onHeader,
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
    gap: theme.space[2],
    marginTop: theme.space[4],
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.brand.headerBadge,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1.5],
    borderRadius: theme.radii.full,
    gap: theme.space[1.5],
  },
  infoBadgeText: {
    fontSize: 12,
    color: theme.color.brand.onHeader,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.space[5],
    paddingBottom: 100,
  },
  contentTablet: {
    paddingHorizontal: theme.space[8],
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
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii['2xl'],
    padding: theme.space[5],
    marginBottom: theme.space[4],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  profileCardTablet: {
    padding: theme.space[6],
  },
  profileCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[5],
    paddingBottom: theme.space[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  profileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  profileCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  profileInfoRow: {
    marginBottom: theme.space[4],
  },
  profileInfoItem: {},
  profileInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.text.placeholder,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.space[1],
  },
  profileInfoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.color.text.body,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.color.brand.accentSoft,
    paddingHorizontal: theme.space[3],
    paddingVertical: theme.space[1.5],
    borderRadius: theme.radii.full,
    alignSelf: 'flex-start',
    gap: theme.space[1.5],
  },
  userRole: {
    fontSize: 13,
    color: theme.color.icon.accent,
    fontWeight: '600',
  },
  // QR Card
  qrCard: {
    backgroundColor: theme.color.surface.base,
    borderRadius: theme.radii['2xl'],
    padding: theme.space[5],
    borderWidth: 1,
    borderColor: theme.color.border.subtle,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  qrCardTablet: {
    padding: theme.space[6],
  },
  qrCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.space[5],
  },
  qrIconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.color.brand.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.space[3],
  },
  qrCardTitleContainer: {
    flex: 1,
  },
  qrCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  qrCardSubtitle: {
    fontSize: 13,
    color: theme.color.text.subtle,
    marginTop: theme.space[0.5],
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space[4],
  },
  qrContainerTablet: {},
  qrContainerLandscape: {},
  qrWrapper: {
    backgroundColor: theme.color.surface.base,
    padding: theme.space[4],
    borderRadius: theme.radii.xl,
    borderWidth: 2,
    borderColor: theme.color.border.subtle,
    shadowColor: theme.color.shadow,
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
    backgroundColor: theme.color.surface.subtle,
    borderRadius: theme.radii.xl,
    borderWidth: 2,
    borderColor: theme.color.border.subtle,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.space[2],
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
    color: theme.color.text.subtle,
  },
  qrHint: {
    fontSize: 13,
    color: theme.color.text.placeholder,
    textAlign: 'center',
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 80,
  },
});

export default HomeScreen;
