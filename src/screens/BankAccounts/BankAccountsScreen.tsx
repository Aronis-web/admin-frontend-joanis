/**
 * Bank Accounts Screen
 *
 * Screen to list and manage bank accounts for a company
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { treasuryApi } from '@/services/api/treasury';
import {
  BankAccount,
  BankAccountsSummary,
  BANK_ACCOUNT_TYPE_LABELS,
  CURRENCY_SYMBOLS,
  BankAccountCurrency,
} from '@/types/treasury';
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface BankAccountsScreenProps {
  navigation: any;
  route: {
    params: {
      companyId: string;
      companyName: string;
    };
  };
}

export const BankAccountsScreen: React.FC<BankAccountsScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const { companyId, companyName } = route.params;

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [summary, setSummary] = useState<BankAccountsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAccounts = async () => {
    try {
      const data = await treasuryApi.getBankAccounts({
        companyId,
        isActive: true,
      });
      setAccounts(data);
    } catch (error: any) {
      console.error('Error loading bank accounts:', error);
      Alert.alert('Error', 'No se pudieron cargar las cuentas bancarias');
    }
  };

  const loadSummary = async () => {
    try {
      const data = await treasuryApi.getBankAccountsSummary(companyId);
      setSummary(data);
    } catch (error: any) {
      console.error('Error loading summary:', error);
      // Summary might not be available, not critical
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadAccounts(), loadSummary()]);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAccounts(), loadSummary()]);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [companyId])
  );

  const handleDelete = (account: BankAccount) => {
    Alert.alert(
      'Eliminar Cuenta',
      `¿Está seguro de eliminar la cuenta "${account.alias}"?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await treasuryApi.deleteBankAccount(account.id);
              Alert.alert('Éxito', 'Cuenta eliminada correctamente');
              loadAccounts();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar la cuenta');
            }
          },
        },
      ]
    );
  };

  const formatBalance = (cents: number, currency: string) => {
    const amount = cents / 100;
    const symbol = CURRENCY_SYMBOLS[currency as BankAccountCurrency] || currency;
    return `${symbol} ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderSummary = () => {
    if (!summary) return null;

    return (
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>💰 Resumen de Saldos</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Soles</Text>
            <Text style={styles.summaryValue}>
              {formatBalance(summary.totalPEN, 'PEN')}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Dólares</Text>
            <Text style={styles.summaryValue}>
              {formatBalance(summary.totalUSD, 'USD')}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderAccount = ({ item }: { item: BankAccount }) => (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: item.color || theme.color.brand.accent }]}
      onPress={() =>
        navigation.navigate('BankAccountForm', {
          companyId,
          companyName,
          accountId: item.id,
          mode: 'view',
        })
      }
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.bankBadge}>
            <Text style={styles.bankBadgeText}>{item.bank?.shortName || item.bank?.code || 'N/A'}</Text>
          </View>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.cardTitle}>{item.alias}</Text>
            <Text style={styles.cardSubtitle}>{item.accountNumber}</Text>
          </View>
        </View>
        <View style={styles.cardHeaderRight}>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>⭐ Principal</Text>
            </View>
          )}
          <View style={[styles.statusBadge, item.isActive ? styles.statusActive : styles.statusInactive]}>
            <Text style={styles.statusText}>{item.isActive ? 'Activa' : 'Inactiva'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tipo:</Text>
          <Text style={styles.infoValue}>
            {BANK_ACCOUNT_TYPE_LABELS[item.accountType] || item.accountType}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Moneda:</Text>
          <Text style={styles.infoValue}>{item.currency}</Text>
        </View>
        {item.accountNumberCci && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CCI:</Text>
            <Text style={styles.infoValue}>{item.accountNumberCci}</Text>
          </View>
        )}
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Saldo:</Text>
          <Text style={[styles.balanceValue, item.currentBalanceCents >= 0 ? styles.balancePositive : styles.balanceNegative]}>
            {formatBalance(item.currentBalanceCents, item.currency)}
          </Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            navigation.navigate('BankAccountForm', {
              companyId,
              companyName,
              accountId: item.id,
              mode: 'edit',
            })
          }
        >
          <Text style={styles.actionButtonText}>✏️ Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonDanger]}
          onPress={() => handleDelete(item)}
        >
          <Text style={styles.actionButtonText}>🗑️ Eliminar</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.color.brand.accent} />
        <Text style={styles.loadingText}>Cargando cuentas bancarias...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Cuentas Bancarias</Text>
          <Text style={styles.headerSubtitle}>{companyName}</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() =>
            navigation.navigate('BankAccountForm', {
              companyId,
              companyName,
              mode: 'create',
            })
          }
        >
          <Text style={styles.addButtonText}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* Summary */}
      {renderSummary()}

      {/* Accounts List */}
      <FlatList
        data={accounts}
        renderItem={renderAccount}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏦</Text>
            <Text style={styles.emptyText}>No hay cuentas bancarias</Text>
            <Text style={styles.emptySubtext}>
              Agregue cuentas bancarias para gestionar los pagos de la empresa
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() =>
                navigation.navigate('BankAccountForm', {
                  companyId,
                  companyName,
                  mode: 'create',
                })
              }
            >
              <Text style={styles.emptyButtonText}>+ Crear Primera Cuenta</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const createStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.background.subtle,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.color.background.subtle,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.color.text.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.color.surface.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: theme.color.brand.accent,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.color.text.heading,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.color.text.muted,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: theme.color.state.success.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: theme.color.text.inverse,
    fontSize: 14,
    fontWeight: 'bold',
  },
  summaryContainer: {
    backgroundColor: theme.color.surface.base,
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.color.text.heading,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.color.text.muted,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.color.state.success.border,
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  card: {
    backgroundColor: theme.color.surface.base,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: theme.color.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border.subtle,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bankBadge: {
    backgroundColor: theme.color.brand.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 12,
  },
  bankBadgeText: {
    color: theme.color.text.inverse,
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.color.text.heading,
  },
  cardSubtitle: {
    fontSize: 14,
    color: theme.color.text.muted,
    marginTop: 2,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  defaultBadge: {
    backgroundColor: theme.color.state.warning.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.color.state.warning.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: theme.color.state.success.background,
  },
  statusInactive: {
    backgroundColor: theme.color.state.danger.background,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.state.success.text,
  },
  cardBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.color.text.muted,
    width: 80,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: theme.color.text.heading,
    flex: 1,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  balanceLabel: {
    fontSize: 14,
    color: theme.color.text.muted,
    width: 80,
    fontWeight: '500',
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  balancePositive: {
    color: theme.color.state.success.border,
  },
  balanceNegative: {
    color: theme.color.state.danger.border,
  },
  cardActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.color.border.subtle,
  },
  actionButton: {
    flex: 1,
    padding: 10,
    backgroundColor: theme.color.brand.accent,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonDanger: {
    backgroundColor: theme.color.state.danger.border,
  },
  actionButtonText: {
    color: theme.color.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.color.text.heading,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.color.text.muted,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: theme.color.state.success.border,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: theme.color.text.inverse,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default BankAccountsScreen;
