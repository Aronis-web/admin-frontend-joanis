import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupplierDebtSummaryResponse } from '@/types/suppliers';

interface DebtSummaryCardProps {
  summary: SupplierDebtSummaryResponse;
  formatCurrency: (cents: number) => string;
}

export const DebtSummaryCard: React.FC<DebtSummaryCardProps> = ({ summary, formatCurrency }) => {
  return (
    <ScrollView style={styles.container}>
      {/* Total Summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resumen General</Text>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Deuda Asignada</Text>
            <Text style={[styles.summaryValue, styles.debtValue]}>
              {formatCurrency(summary.totalDebtAllCompaniesCents)}
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Balance Sin Asignar</Text>
            <Text style={[styles.summaryValue, styles.unassignedValue]}>
              {formatCurrency(summary.unassignedBalanceCents)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total General</Text>
            <Text style={[styles.summaryValue, styles.totalValue]}>
              {formatCurrency(summary.totalBalanceCents)}
            </Text>
          </View>
        </View>
      </View>

      {/* Debt by Company */}
      {summary.debtByCompany && summary.debtByCompany.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Deuda por Empresa</Text>

          {summary.debtByCompany.map((debt, index) => (
            <View key={debt.companyId} style={styles.companyItem}>
              <View style={styles.companyHeader}>
                <View style={styles.companyInfo}>
                  <Ionicons name="business" size={20} color="#3498db" />
                  <View style={styles.companyTexts}>
                    <Text style={styles.companyName}>{debt.companyName}</Text>
                    {debt.legalEntity && (
                      <Text style={styles.companyRuc}>
                        {debt.legalEntity.legalName} - RUC: {debt.legalEntity.ruc}
                      </Text>
                    )}
                  </View>
                </View>
                <Text style={[styles.companyDebt, debt.totalDebtCents > 0 ? styles.debtValue : styles.creditValue]}>
                  {formatCurrency(debt.totalDebtCents)}
                </Text>
              </View>

              {(debt.lastPurchaseDate || debt.lastPaymentDate) && (
                <View style={styles.companyDates}>
                  {debt.lastPurchaseDate && (
                    <View style={styles.dateRow}>
                      <Ionicons name="cart-outline" size={14} color="#7f8c8d" />
                      <Text style={styles.dateText}>
                        Última compra: {new Date(debt.lastPurchaseDate).toLocaleDateString('es-PE')}
                      </Text>
                    </View>
                  )}
                  {debt.lastPaymentDate && (
                    <View style={styles.dateRow}>
                      <Ionicons name="cash-outline" size={14} color="#7f8c8d" />
                      <Text style={styles.dateText}>
                        Último pago: {new Date(debt.lastPaymentDate).toLocaleDateString('es-PE')}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {index < summary.debtByCompany.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      )}

      {/* Empty State */}
      {(!summary.debtByCompany || summary.debtByCompany.length === 0) && (
        <View style={styles.emptyCard}>
          <Ionicons name="business-outline" size={48} color="#bdc3c7" />
          <Text style={styles.emptyText}>No hay deudas asignadas a empresas</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  summaryRow: {
    marginBottom: 12,
  },
  summaryItem: {
    gap: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  debtValue: {
    color: '#e74c3c',
  },
  creditValue: {
    color: '#27ae60',
  },
  unassignedValue: {
    color: '#f39c12',
  },
  totalValue: {
    color: '#2c3e50',
  },
  divider: {
    height: 1,
    backgroundColor: '#ecf0f1',
    marginVertical: 12,
  },
  companyItem: {
    marginBottom: 12,
  },
  companyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  companyInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  companyTexts: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  companyRuc: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 2,
  },
  companyDebt: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  companyDates: {
    gap: 4,
    marginLeft: 32,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  emptyCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
  },
});

export default DebtSummaryCard;
