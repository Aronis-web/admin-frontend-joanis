import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
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
      <View key={discrepancy.id} style={[styles.card, isTablet && styles.cardTablet]}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.productName, isTablet && styles.productNameTablet]}>
              {discrepancy.productName}
            </Text>
            <Text style={[styles.productSku, isTablet && styles.productSkuTablet]}>
              SKU: {discrepancy.productSku}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              isTablet && styles.statusBadgeTablet,
              {
                backgroundColor: DiscrepancyStatusColors[discrepancy.status] + '20',
                borderColor: DiscrepancyStatusColors[discrepancy.status],
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isTablet && styles.statusTextTablet,
                { color: DiscrepancyStatusColors[discrepancy.status] },
              ]}
            >
              {DiscrepancyStatusLabels[discrepancy.status]}
            </Text>
          </View>
        </View>

        {/* Reparto Info */}
        <View style={styles.repartoInfo}>
          <Text style={[styles.repartoLabel, isTablet && styles.repartoLabelTablet]}>
            Reparto:
          </Text>
          <Text style={[styles.repartoValue, isTablet && styles.repartoValueTablet]}>
            {discrepancy.repartoCode} - {discrepancy.repartoName}
          </Text>
        </View>

        {/* Quantities */}
        <View style={styles.quantitiesContainer}>
          <View style={styles.quantityRow}>
            <Text style={[styles.quantityLabel, isTablet && styles.quantityLabelTablet]}>
              Asignado:
            </Text>
            <Text style={[styles.quantityValue, isTablet && styles.quantityValueTablet]}>
              {discrepancy.quantityAssigned} unidades
            </Text>
          </View>
          <View style={styles.quantityRow}>
            <Text style={[styles.quantityLabel, isTablet && styles.quantityLabelTablet]}>
              Validado:
            </Text>
            <Text
              style={[
                styles.quantityValue,
                isTablet && styles.quantityValueTablet,
                { color: '#10B981' },
              ]}
            >
              {discrepancy.quantityValidated} unidades
            </Text>
          </View>
          {hasDifference && (
            <View style={styles.quantityRow}>
              <Text style={[styles.quantityLabel, isTablet && styles.quantityLabelTablet]}>
                Diferencia:
              </Text>
              <Text
                style={[
                  styles.quantityValue,
                  isTablet && styles.quantityValueTablet,
                  {
                    color: isNegative ? '#EF4444' : '#F59E0B',
                    fontWeight: '700',
                  },
                ]}
              >
                {isNegative ? '' : '+'}
                {discrepancy.quantityDifference} unidades
              </Text>
            </View>
          )}
        </View>

        {/* Validation Info */}
        {discrepancy.validatedByName && (
          <View style={styles.validationInfo}>
            <Text style={[styles.validationLabel, isTablet && styles.validationLabelTablet]}>
              Validado por: {discrepancy.validatedByName}
            </Text>
            {discrepancy.validationNotes && (
              <Text style={[styles.validationNotes, isTablet && styles.validationNotesTablet]}>
                Nota: {discrepancy.validationNotes}
              </Text>
            )}
          </View>
        )}

        {/* Notes Count */}
        {discrepancy.notesCount !== undefined && discrepancy.notesCount > 0 && (
          <View style={styles.notesCountContainer}>
            <Text style={[styles.notesCountText, isTablet && styles.notesCountTextTablet]}>
              📝 {discrepancy.notesCount} nota{discrepancy.notesCount !== 1 ? 's' : ''} explicativa
              {discrepancy.notesCount !== 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={[styles.manageButton, isTablet && styles.manageButtonTablet]}
          onPress={() => handleManageNotes(discrepancy)}
        >
          <Text style={[styles.manageButtonText, isTablet && styles.manageButtonTextTablet]}>
            {discrepancy.notesCount && discrepancy.notesCount > 0
              ? '📝 Ver/Editar Notas'
              : '➕ Agregar Nota Explicativa'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <Text style={[styles.title, isTablet && styles.titleTablet]}>
            Reporte de Discrepancias
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeButtonText, isTablet && styles.closeButtonTextTablet]}>
              ✕
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={[styles.loadingText, isTablet && styles.loadingTextTablet]}>
              Cargando reporte...
            </Text>
          </View>
        ) : report ? (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {/* Summary */}
            <View style={[styles.summaryCard, isTablet && styles.summaryCardTablet]}>
              <Text style={[styles.summaryTitle, isTablet && styles.summaryTitleTablet]}>
                Resumen del Reporte
              </Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
                  Productos con discrepancias:
                </Text>
                <Text style={[styles.summaryValue, isTablet && styles.summaryValueTablet]}>
                  {report.totalProductsWithDiscrepancies}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
                  Total asignado:
                </Text>
                <Text style={[styles.summaryValue, isTablet && styles.summaryValueTablet]}>
                  {report.totalQuantityAssigned} unidades
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
                  Total validado:
                </Text>
                <Text
                  style={[
                    styles.summaryValue,
                    isTablet && styles.summaryValueTablet,
                    { color: '#10B981' },
                  ]}
                >
                  {report.totalQuantityValidated} unidades
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, isTablet && styles.summaryLabelTablet]}>
                  Diferencia total:
                </Text>
                <Text
                  style={[
                    styles.summaryValue,
                    isTablet && styles.summaryValueTablet,
                    { color: '#EF4444', fontWeight: '700' },
                  ]}
                >
                  {report.totalQuantityDifference} unidades
                </Text>
              </View>
            </View>

            {/* Discrepancies List */}
            <Text style={[styles.sectionTitle, isTablet && styles.sectionTitleTablet]}>
              Discrepancias por Producto
            </Text>
            {report.discrepancies && report.discrepancies.length > 0 ? (
              report.discrepancies.map((discrepancy) => renderDiscrepancyCard(discrepancy))
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
                  No hay discrepancias registradas
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, isTablet && styles.emptyTextTablet]}>
              No se pudo cargar el reporte
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTablet: {
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  titleTablet: {
    fontSize: 26,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#64748B',
    fontWeight: '600',
  },
  closeButtonTextTablet: {
    fontSize: 28,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  loadingTextTablet: {
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryCardTablet: {
    padding: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  summaryTitleTablet: {
    fontSize: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  summaryLabelTablet: {
    fontSize: 16,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  summaryValueTablet: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  sectionTitleTablet: {
    fontSize: 22,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTablet: {
    padding: 24,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  productNameTablet: {
    fontSize: 20,
  },
  productSku: {
    fontSize: 13,
    color: '#64748B',
  },
  productSkuTablet: {
    fontSize: 15,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeTablet: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextTablet: {
    fontSize: 14,
  },
  repartoInfo: {
    marginBottom: 12,
  },
  repartoLabel: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  repartoLabelTablet: {
    fontSize: 15,
  },
  repartoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  repartoValueTablet: {
    fontSize: 16,
  },
  quantitiesContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  quantityLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  quantityLabelTablet: {
    fontSize: 16,
  },
  quantityValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  quantityValueTablet: {
    fontSize: 16,
  },
  validationInfo: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  validationLabel: {
    fontSize: 13,
    color: '#4F46E5',
    marginBottom: 4,
  },
  validationLabelTablet: {
    fontSize: 15,
  },
  validationNotes: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
  },
  validationNotesTablet: {
    fontSize: 15,
  },
  notesCountContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  notesCountText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
  },
  notesCountTextTablet: {
    fontSize: 15,
  },
  manageButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  manageButtonTablet: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  manageButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  manageButtonTextTablet: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  emptyTextTablet: {
    fontSize: 18,
  },
});
