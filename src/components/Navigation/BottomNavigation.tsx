import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { colors, spacing, borderRadius } from '@/design-system/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BottomNavigationProps {
  onChatPress: () => void;
  onNotificationsPress: () => void;
  onMenuPress: () => void;
  chatBadge?: number;
  notificationsBadge?: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  onChatPress,
  onNotificationsPress,
  onMenuPress,
  chatBadge = 0,
  notificationsBadge = 0,
}) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Determine if device is in landscape mode
  const isLandscape = width > height;

  return (
    <View
      style={[
        styles.safeArea,
        { paddingBottom: insets.bottom },
        isLandscape && styles.safeAreaLandscape,
      ]}
    >
      <View style={[styles.container, isLandscape && styles.containerLandscape]}>
        {/* Botón de Chat - Izquierda */}
        <TouchableOpacity style={styles.navButton} onPress={onChatPress} activeOpacity={0.8}>
          <View style={styles.buttonContent}>
            <View style={styles.iconContainer}>
              <Text style={styles.buttonIcon}>💬</Text>
            </View>
            {chatBadge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{chatBadge > 99 ? '99+' : chatBadge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.buttonLabel}>Mensajes</Text>
        </TouchableOpacity>

        {/* Botón de Menú - Centro */}
        <TouchableOpacity style={styles.menuButton} onPress={onMenuPress} activeOpacity={0.8}>
          <View style={styles.menuButtonInner}>
            <Text style={styles.menuIcon}>☰</Text>
          </View>
          <Text style={styles.menuLabel}>Menú</Text>
        </TouchableOpacity>

        {/* Botón de Notificaciones - Derecha */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={onNotificationsPress}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            <View style={styles.iconContainer}>
              <Text style={styles.buttonIcon}>🔔</Text>
            </View>
            {notificationsBadge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {notificationsBadge > 99 ? '99+' : notificationsBadge}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.buttonLabel}>Alertas</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    zIndex: 1001,
    elevation: 10,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: '5%',
    paddingVertical: spacing[2],
    minHeight: 60,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderTopWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[1.5],
    minWidth: 60,
    maxWidth: 100,
  },
  buttonContent: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[0.5],
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 18,
    opacity: 0.7,
  },
  buttonLabel: {
    fontSize: 10,
    color: colors.neutral[400],
    fontWeight: '400',
    marginTop: spacing[0.5],
  },
  menuButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    minWidth: 60,
  },
  menuButtonInner: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.accent[500],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  menuIcon: {
    fontSize: 20,
    color: colors.neutral[0],
    fontWeight: '600',
  },
  menuLabel: {
    fontSize: 10,
    color: colors.neutral[400],
    fontWeight: '400',
    marginTop: spacing[1],
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.danger[500],
    borderRadius: borderRadius.lg,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[1],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  badgeText: {
    color: colors.neutral[0],
    fontSize: 8,
    fontWeight: '600',
  },
  // Landscape-specific styles
  safeAreaLandscape: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  containerLandscape: {
    paddingVertical: spacing[1],
    minHeight: 50,
  },
});

export default BottomNavigation;
