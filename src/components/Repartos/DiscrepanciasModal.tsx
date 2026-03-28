/**
 * DiscrepanciasModal - Modal de reporte de discrepancias
 * Migrado al Design System unificado
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { repartosService } from '@/services/api';
import {
  ConsolidatedTransferReport,
  TransferReportDiscrepancy,
  DiscrepancyStatusLabels,
  DiscrepancyStatusColors,
} from '@/types/consolidated-reports';
import logger from '@/utils/logger';
import {
  colors,
  spacing,
  borderRadius,
  shadows,
  Title,
  Body,
  Label,
  Caption,
  Card,
  Button,
  IconButton,
  Badge,
  EmptyState,
} from '@/design-system';

interface DiscrepanciasModalProps {
  visible: boolean;
  reportId: string | null;
  onClose: () => void;
  onManageNotes?: (discrepancy: TransferReportDiscrepancy) => void;
}

export const DiscrepanciasModal: React.FC<DiscrepanciasModalProps> = ({
  visible,
  reportId,
  onClose,
  onManageNotes,
}) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ConsolidatedTransferReport | null>(null);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768 || height >= 768;

  useEffect(() => {
    if (visible && reportId) {
      loadReport();
    }
  }, [visible, reportId]);

  const loadReport = async () => {
    if (!reportId) return;

    try {
      setLoading(true);
      logger.info('📋 Cargando reporte de discrepancias:', reportId);
      const data = await repartosService.getReport(reportId);
      setReport(data);
      logger.info('✅ Reporte cargado:', data);
    } catch (error: any) {
      logger.error('Error cargando reporte:', error);
      Alert.alert('Error', 'No se pudo cargar el reporte de discrepancias');
    } finally {
      setLoading(false);
    }
  };

  const handleManageNotes = (discrepancy: TransferReportDiscrepancy) => {
    if (onManageNotes) {
      onManageNotes(discrepancy);
    }
  };

  const renderDiscrepancyCard = (discrepancy: TransferReportDiscrepancy) => {
    const hasDifference = discrepancy.quantityDifference !== 0;
    const isNegative = discrepancy.quantityDifference < 0;

    return (
      <View key={discrepancy.id} style={[styles.card, isTablet ? styles.cardTablet : undefined]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Title size="small" style={{ marginBottom: spacing[1] }}>
              {discrepancy.productName}
            </Title>
            <Caption color="secondary">
              SKU: {discrepancy.productSku}
            </Caption>
          </View>
          <View
            style={[
              styles.statusBadge,
              isTablet ? styles.statusBadgeTablet : undefined,
              {
                backgroundColor: DiscrepancyStatusColors[discrepancy.status] + '20',
                borderColor: DiscrepancyStatusColors[discrepancy.status],
              },
            ]}
          >
            <Caption style={{ fontWeight: '600', color: DiscrepancyStatusColors[discrepancy.status] }}>
              {DiscrepancyStatusLabels[discrepancy.status]}
            </Caption>
          </View>
        </View>

        {/* Reparto Info */}
        <View style={styles.repartoInfo}>
          <Caption color="secondary" style={{ marginBottom: spacing[1] }}>
            Reparto:
          </Caption>
          <Body style={{ fontWeight: '600' }}>
            {discrepancy.repartoCode} - {discrepancy.repartoName}
          </Body>
        </View>

        {/* Quantities */}
        <View style={styles.quantitiesContainer}>
          <View style={styles.quantityRow}>
            <Caption color="secondary">Asignado:</Caption>
            <Body style={{ fontWeight: '600' }}>{discrepancy.quantityAssigned} unidades</Body>
          </View>
          <View style={styles.quantityRow}>
            <Caption color="secondary">Validado:</Caption>
            <Body style={{ fontWeight: '600', color: colors.success[600] }}>
              {discrepancy.quantityValidated} unidades
            </Body>
          </View>
          {hasDifference && (
            <View style={styles.quantityRow}>
              <Caption color="secondary">Diferencia:</Caption>
              <Body
                style={{
                  fontWeight: '700',
                  color: isNegative ? colors.danger[600] : colors.warning[600],
                }}
              >
                {isNegative ? '' : '+'}
                {discrepancy.quantityDifference} unidades
              </Body>
            </View>
          )}
        </View>

        {/* Validation Info */}
        {discrepancy.validatedByName && (
          <View style={styles.validationInfo}>
            <Caption style={{ color: colors.accent[600], marginBottom: spacing[1] }}>
              Validado por: {discrepancy.validatedByName}
            </Caption>
            {discrepancy.validationNotes && (
              <Caption color="secondary" style={{ fontStyle: 'italic' }}>
                Nota: {discrepancy.validationNotes}
              </Caption>
            )}
          </View>
        )}

        {/* Notes Count */}
        {discrepancy.notesCount !== undefined && discrepancy.notesCount > 0 && (
          <View style={styles.notesCountContainer}>
            <Caption style={{ fontWeight: '600', color: colors.warning[700] }}>
              📝 {discrepancy.notesCount} nota{discrepancy.notesCount !== 1 ? 's' : ''} explicativa
              {discrepancy.notesCount !== 1 ? 's' : ''}
            </Caption>
          </View>
        )}

        {/* Action Button */}
        <Button
          title={discrepancy.notesCount && discrepancy.notesCount > 0
            ? '📝 Ver/Editar Notas'
            : '➕ Agregar Nota Explicativa'}
          variant="primary"
          onPress={() => handleManageNotes(discrepancy)}
          fullWidth
        />
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet ? styles.headerTablet : undefined]}>
          <Title>Reporte de Discrepancias</Title>
          <IconButton
            icon="close"
            variant="ghost"
            size="small"
            onPress={onClose}
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent[500]} />
            <Body color="secondary" style={{ marginTop: spacing[3] }}>
              Cargando reporte...
            </Body>
          </View>
        ) : report ? (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Summary */}
            <View style={[styles.summaryCard, isTablet ? styles.summaryCardTablet : undefined]}>
              <Label style={{ marginBottom: spacing[3] }}>
                Resumen del Reporte
              </Label>
              <View style={styles.summaryRow}>
                <Caption color="secondary">Productos con discrepancias:</Caption>
                <Body style={{ fontWeight: '600' }}>{report.totalProductsWithDiscrepancies}</Body>
              </View>
              <View style={styles.summaryRow}>
                <Caption color="secondary">Total asignado:</Caption>
                <Body style={{ fontWeight: '600' }}>{report.totalQuantityAssigned} unidades</Body>
              </View>
              <View style={styles.summaryRow}>
                <Caption color="secondary">Total validado:</Caption>
                <Body style={{ fontWeight: '600', color: colors.success[600] }}>
                  {report.totalQuantityValidated} unidades
                </Body>
              </View>
              <View style={styles.summaryRow}>
                <Caption color="secondary">Diferencia total:</Caption>
                <Body style={{ fontWeight: '700', color: colors.danger[600] }}>
                  {report.totalQuantityDifference} unidades
                </Body>
              </View>
            </View>

            {/* Discrepancies List */}
            <Label style={{ marginBottom: spacing[4] }}>
              Discrepancias por Producto
            </Label>
            {report.discrepancies && report.discrepancies.length > 0 ? (
              report.discrepancies.map((discrepancy) => renderDiscrepancyCard(discrepancy))
            ) : (
              <EmptyState
                icon="clipboard-outline"
                title="Sin discrepancias"
                description="No hay discrepancias registradas"
              />
            )}
          </ScrollView>
        ) : (
          <EmptyState
            icon="alert-circle-outline"
            title="Error"
            description="No se pudo cargar el reporte"
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerTablet: {
    paddingHorizontal: spacing[8],
    paddingVertical: spacing[6],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },
  summaryCard: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[6],
    ...shadows.md,
  },
  summaryCardTablet: {
    padding: spacing[6],
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  card: {
    backgroundColor: colors.background.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    ...shadows.md,
  },
  cardTablet: {
    padding: spacing[6],
    marginBottom: spacing[4],
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  statusBadge: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  statusBadgeTablet: {
    paddingHorizontal: spacing[3.5],
    paddingVertical: spacing[1.5],
  },
  repartoInfo: {
    marginBottom: spacing[3],
  },
  quantitiesContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  validationInfo: {
    backgroundColor: colors.accent[50],
    borderRadius: borderRadius.lg,
    padding: spacing[3],
    marginBottom: spacing[3],
  },
  notesCountContainer: {
    backgroundColor: colors.warning[100],
    borderRadius: borderRadius.lg,
    padding: spacing[2],
    marginBottom: spacing[3],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing[12],
  },
});
