import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
import Alert from '@/utils/alert';

interface ExpensePaymentsScreenProps {
  navigation: any;
}

export const ExpensePaymentsScreen: React.FC<ExpensePaymentsScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768 || height >= 768;
  const isLandscape = width > height;

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      // TODO: Implementar carga de pagos
      console.log('Cargando pagos...');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al cargar los pagos');
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
  }, [loadPayments]);

  useFocusEffect(
    useCallback(() => {
      loadPayments();
    }, [loadPayments])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.brand.primary} />
          <Text style={styles.loadingText}>Cargando pagos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ProtectedRoute requiredPermissions={['expenses.payments.read']}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Pagos de Gastos</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyTitle}>Módulo de Pagos</Text>
            <Text style={styles.emptyMessage}>
              Aquí podrás gestionar todos los pagos de gastos.
            </Text>
            <Text style={styles.emptyHint}>Esta funcionalidad estará disponible próximamente.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ProtectedRoute>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.color.surface.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: theme.color.brand.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: theme.color.text.muted,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text.heading,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: theme.color.text.muted,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 40,
  },
  emptyHint: {
    fontSize: 14,
    color: theme.color.text.placeholder,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 40,
  },
});

export default ExpensePaymentsScreen;
