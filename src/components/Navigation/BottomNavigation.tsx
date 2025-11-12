import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Botón de Chat - Izquierda */}
        <TouchableOpacity
          style={styles.navButton}
          onPress={onChatPress}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            <View style={styles.iconContainer}>
              <Text style={styles.buttonIcon}>💬</Text>
            </View>
            {chatBadge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {chatBadge > 99 ? '99+' : chatBadge}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.buttonLabel}>Mensajes</Text>
        </TouchableOpacity>

        {/* Botón de Menú - Centro */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={onMenuPress}
          activeOpacity={0.8}
        >
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    minHeight: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    borderTopWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.5)',
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    maxWidth: 80,
  },
  buttonContent: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 18,
    opacity: 0.7,
  },
  buttonLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '400',
  },
  menuButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  menuButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  menuIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  menuLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '400',
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '600',
  },
});

export default BottomNavigation;