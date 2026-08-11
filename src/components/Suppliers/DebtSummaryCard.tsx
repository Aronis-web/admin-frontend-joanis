import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupplierDebtSummaryResponse } from '@/types/suppliers';

// Design System
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';
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
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Total Summary */}
      <Card variant="elevated" padding="medium" style={styles.card}>
        <Title size="small" style={styles.cardTitle}>Resumen General</Title>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Label size="medium" color="secondary">Total Deuda Asignada</Label>
            <Numeric size="large" color={theme.color.text.danger}>
              {formatCurrency(summary.totalDebtAllCompaniesCents)}
            </Numeric>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Label size="medium" color="secondary">Balance Sin Asignar</Label>
            <Numeric size="large" color={theme.color.text.warning}>
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
                  <Ionicons name="business" size={theme.icon.md} color={theme.color.brand.accent} />
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
                  color={debt.totalDebtCents > 0 ? theme.color.text.danger : theme.color.text.success}
                >
                  {formatCurrency(debt.totalDebtCents)}
                </Numeric>
              </View>

              {(debt.lastPurchaseDate || debt.lastPaymentDate) && (
                <View style={styles.companyDates}>
                  {debt.lastPurchaseDate && (
                    <View style={styles.dateRow}>
                      <Ionicons name="cart-outline" size={theme.icon.sm} color={theme.color.icon.subtle} />
                      <Caption color="tertiary">
                        Última compra: {new Date(debt.lastPurchaseDate).toLocaleDateString('es-PE')}
                      </Caption>
                    </View>
                  )}
                  {debt.lastPaymentDate && (
                    <View style={styles.dateRow}>
                      <Ionicons name="cash-outline" size={theme.icon.sm} color={theme.color.icon.subtle} />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    card: {
      marginHorizontal: theme.space[4],
      marginVertical: theme.space[2],
    },
    cardTitle: {
      marginBottom: theme.space[4],
    },
    summaryRow: {
      marginBottom: theme.space[3],
    },
    summaryItem: {
      gap: theme.space[1],
    },
    companyItem: {
      marginBottom: theme.space[3],
    },
    companyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.space[2],
    },
    companyInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flex: 1,
      gap: theme.space[3],
    },
    companyTexts: {
      flex: 1,
    },
    companyDates: {
      gap: theme.space[1],
      marginLeft: theme.space[8],
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[1.5],
    },
  });

export default DebtSummaryCard;
