import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupplierDebtSummaryResponse } from '@/types/suppliers';

// Design System
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  iconSizes,
} from '@/design-system/tokens';
import {
  Text,
  Title,
  Body,
  Caption,
  Label,
  Numeric,
  Card,
  EmptyState,
  Divider,
} from '@/design-system/components';

interface DebtSummaryCardProps {
  summary: SupplierDebtSummaryResponse;
  formatCurrency: (cents: number) => string;
}

export const DebtSummaryCard: React.FC<DebtSummaryCardProps> = ({ summary, formatCurrency }) => {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Total Summary */}
      <Card variant="elevated" padding="medium" style={styles.card}>
        <Title size="small" style={styles.cardTitle}>Resumen General</Title>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Label size="medium" color="secondary">Total Deuda Asignada</Label>
            <Numeric size="large" color={colors.danger[600]}>
              {formatCurrency(summary.totalDebtAllCompaniesCents)}
            </Numeric>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Label size="medium" color="secondary">Balance Sin Asignar</Label>
            <Numeric size="large" color={colors.warning[600]}>
              {formatCurrency(summary.unassignedBalanceCents)}
            </Numeric>
          </View>
        </View>

        <Divider />

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Label size="medium" color="secondary">Total General</Label>
            <Numeric size="large" color="primary">
              {formatCurrency(summary.totalBalanceCents)}
            </Numeric>
          </View>
        </View>
      </Card>

      {/* Debt by Company */}
      {summary.debtByCompany && summary.debtByCompany.length > 0 && (
        <Card variant="elevated" padding="medium" style={styles.card}>
          <Title size="small" style={styles.cardTitle}>Deuda por Empresa</Title>

          {summary.debtByCompany.map((debt, index) => (
            <View key={debt.companyId} style={styles.companyItem}>
              <View style={styles.companyHeader}>
                <View style={styles.companyInfo}>
                  <Ionicons name="business" size={iconSizes.md} color={colors.accent[500]} />
                  <View style={styles.companyTexts}>
                    <Title size="small">{debt.companyName}</Title>
                    {debt.legalEntity && (
                      <Caption color="secondary">
                        {debt.legalEntity.legalName} - RUC: {debt.legalEntity.ruc}
                      </Caption>
                    )}
                  </View>
                </View>
                <Numeric
                  size="medium"
                  color={debt.totalDebtCents > 0 ? colors.danger[600] : colors.success[600]}
                >
                  {formatCurrency(debt.totalDebtCents)}
                </Numeric>
              </View>

              {(debt.lastPurchaseDate || debt.lastPaymentDate) && (
                <View style={styles.companyDates}>
                  {debt.lastPurchaseDate && (
                    <View style={styles.dateRow}>
                      <Ionicons name="cart-outline" size={iconSizes.sm} color={colors.icon.tertiary} />
                      <Caption color="tertiary">
                        Última compra: {new Date(debt.lastPurchaseDate).toLocaleDateString('es-PE')}
                      </Caption>
                    </View>
                  )}
                  {debt.lastPaymentDate && (
                    <View style={styles.dateRow}>
                      <Ionicons name="cash-outline" size={iconSizes.sm} color={colors.icon.tertiary} />
                      <Caption color="tertiary">
                        Último pago: {new Date(debt.lastPaymentDate).toLocaleDateString('es-PE')}
                      </Caption>
                    </View>
                  )}
                </View>
              )}

              {index < summary.debtByCompany.length - 1 && <Divider />}
            </View>
          ))}
        </Card>
      )}

      {/* Empty State */}
      {(!summary.debtByCompany || summary.debtByCompany.length === 0) && (
        <Card variant="elevated" padding="large" style={styles.card}>
          <EmptyState
            icon="business-outline"
            title="Sin deudas asignadas"
            description="No hay deudas asignadas a empresas"
          />
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    marginHorizontal: spacing[4],
    marginVertical: spacing[2],
  },
  cardTitle: {
    marginBottom: spacing[4],
  },
  summaryRow: {
    marginBottom: spacing[3],
  },
  summaryItem: {
    gap: spacing[1],
  },
  companyItem: {
    marginBottom: spacing[3],
  },
  companyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  companyInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: spacing[3],
  },
  companyTexts: {
    flex: 1,
  },
  companyDates: {
    gap: spacing[1],
    marginLeft: spacing[8],
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
  },
});

export default DebtSummaryCard;
