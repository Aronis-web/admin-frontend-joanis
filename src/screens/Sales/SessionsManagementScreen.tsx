import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Alert from '@/utils/alert';
import { posSessionsApi } from '@/services/api';
import {
  PosSessionCollectionDetail,
  PosSessionManagementDetailResponse,
  PosSessionManagementItem,
  PosSessionRequestDetail,
  PosSessionSaleDetail,
} from '@/types/pos-sessions';
import { Badge, Button, Card, Text } from '@/design-system/components';
import { activeOpacity, borderRadius, colors, shadows, spacing } from '@/design-system/tokens';

interface SessionsManagementScreenProps {
  navigation: any;
}

const formatCurrency = (cents?: number): string => {
  const amount = (cents || 0) / 100;
  return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value?: string): string => {
  if (!value) return '-';
  return new Date(value).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusVariant = (status: string): 'success' | 'info' | 'warning' => {
  if (status === 'OPEN') return 'success';
  if (status === 'CLOSED') return 'info';
  return 'warning';
};

const getRequestStatusVariant = (status: string): 'success' | 'info' | 'warning' | 'danger' => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'danger';
  return 'warning';
};

const getDifferenceTypeVariant = (type: string): 'success' | 'warning' | 'danger' | 'info' => {
  if (type === 'NONE') return 'success';
  if (type === 'A_FAVOR') return 'info';
  if (type === 'EN_CONTRA') return 'danger';
  return 'warning';
};

const getManualDifferenceColor = (differenceCents: number): string => {
  if (differenceCents > 0) return colors.info[700];
  if (differenceCents < 0) return colors.danger[700];
  return colors.success[700];
};

const DetailKeyValue = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.kvItem}>
    <Text variant="caption" color="tertiary">{label}</Text>
    <Text variant="bodySmall" color="primary">{value || '-'}</Text>
  </View>
);

const FinancialMetric = ({
  label,
  value,
  highlight = false,
  valueColor,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  valueColor?: string;
}) => (
  <View style={[styles.financialMetricBox, highlight && styles.financialMetricBoxHighlight]}>
    <Text variant="caption" color="tertiary" align="center">{label}</Text>
    <Text
      variant="labelMedium"
      color={valueColor || (highlight ? colors.primary[900] : 'primary')}
      align="center"
      style={styles.financialMetricValue}
    >
      {value}
    </Text>
  </View>
);

export const SessionsManagementScreen: React.FC<SessionsManagementScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [sessions, setSessions] = useState<PosSessionManagementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<PosSessionManagementDetailResponse | null>(null);
  const [isRequestsExpanded, setIsRequestsExpanded] = useState(false);
  const [isSalesExpanded, setIsSalesExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadSessions = useCallback(async (targetPage = page) => {
    try {
      setLoading(true);
      const response = await posSessionsApi.getManagementList({
        page: targetPage,
        limit,
      });

      setSessions(response.data || []);
      setPage(response.pagination?.page || targetPage);
      setTotal(response.pagination?.total || 0);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo cargar la gestión de sesiones');
    } finally {
      setLoading(false);
    }
  }, [limit, page]);

  useEffect(() => {
    void loadSessions(page);
  }, [loadSessions, page]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadSessions(page);
    } finally {
      setRefreshing(false);
    }
  };

  const handleViewDetail = async (sessionId: string) => {
    try {
      setDetailLoadingId(sessionId);
      const detail = await posSessionsApi.getManagementDetail(sessionId);
      setSelectedDetail(detail);
      setDetailModalVisible(true);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'No se pudo cargar el detalle de la sesión');
    } finally {
      setDetailLoadingId(null);
    }
  };

  const handleCloseDetailModal = () => {
    setDetailModalVisible(false);
    setSelectedDetail(null);
    setIsRequestsExpanded(false);
    setIsSalesExpanded(false);
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage((prev) => prev + 1);
    }
  };

  const totals = selectedDetail?.summary?.totals;

  const manualDifferenceCents = useMemo(() => {
    if (!selectedDetail) return 0;

    const openingCashCents = Number(selectedDetail.summary?.totals?.openingCashCents || 0);
    const cashSalesCents = (selectedDetail.summary?.paymentMethodBreakdown || [])
      .filter((item) => String(item.paymentMethodCode || '').toUpperCase() === 'CASH')
      .reduce((sum, item) => sum + Number(item.totalCents || 0), 0);
    const collectedCents = (selectedDetail.collections || []).reduce(
      (sum, collection) => sum + Number(collection.amountCents || 0),
      0
    );

    return openingCashCents + cashSalesCents - collectedCents;
  }, [selectedDetail]);

  const paymentBreakdown = useMemo(
    () => selectedDetail?.summary?.paymentMethodBreakdown || [],
    [selectedDetail?.summary?.paymentMethodBreakdown]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={activeOpacity.medium}
        >
          <Text variant="titleLarge" color="secondary">←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text variant="titleLarge" color="primary">Gestión de Sesiones</Text>
          <Text variant="caption" color="tertiary">Listado paginado de sesiones de caja</Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary[900]} />
          <Text variant="bodyMedium" color="tertiary" style={styles.loadingText}>Cargando sesiones...</Text>
        </View>
      ) : (
        <View style={styles.contentWrapper}>
          <ScrollView
            style={styles.content}
            contentContainerStyle={[
              styles.contentContainer,
              { paddingBottom: Math.max(insets.bottom + 110, 140) },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary[900]}
              />
            }
          >
            {sessions.length === 0 ? (
              <Card variant="outlined" padding="large">
                <Text variant="titleSmall" color="primary" align="center">Sin sesiones</Text>
                <Text variant="bodySmall" color="tertiary" align="center" style={styles.emptySubtitle}>
                  No se encontraron sesiones para la página actual.
                </Text>
              </Card>
            ) : (
              sessions.map((session) => (
                <Card key={session.id} variant="outlined" padding="medium" style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text variant="titleSmall" color="primary" style={styles.cardTitle}>
                      {session.cashRegister.code} - {session.cashRegister.name}
                    </Text>
                    <Badge label={session.status} variant={getStatusVariant(session.status)} size="small" />
                  </View>

                  <Text variant="bodySmall" color="secondary">Cajera: {session.userName}</Text>
                  <Text variant="bodySmall" color="secondary">Apertura: {formatDate(session.openedAt)}</Text>
                  <Text variant="bodySmall" color="secondary">Cierre: {formatDate(session.closedAt)}</Text>

                  <View style={styles.summaryRow}>
                    <View style={styles.summaryBox}>
                      <Text variant="caption" color="tertiary" align="center">Ventas</Text>
                      <Text variant="labelLarge" color="primary" align="center">{session.totals.salesCount}</Text>
                    </View>
                    <View style={styles.summaryBox}>
                      <Text variant="caption" color="tertiary" align="center">Total ventas</Text>
                      <Text variant="labelMedium" color="primary" align="center">{formatCurrency(session.totals.salesCents)}</Text>
                    </View>

                  </View>

                  <Button
                    title="Ver detalle sesión"
                    variant="primary"
                    onPress={() => handleViewDetail(session.id)}
                    loading={detailLoadingId === session.id}
                    fullWidth
                    style={styles.detailButton}
                  />
                </Card>
              ))
            )}
          </ScrollView>

          <View style={styles.paginationFixedContainer}>
            <View style={[styles.paginationContainer, { paddingBottom: Math.max(insets.bottom, spacing[2]) }]}>
              <View style={styles.paginationButtonsRow}>
                <Button
                  title="Anterior"
                  variant="secondary"
                  onPress={handlePrevPage}
                  disabled={page <= 1}
                  style={styles.paginationButton}
                />

                <Button
                  title="Siguiente"
                  variant="secondary"
                  onPress={handleNextPage}
                  disabled={page >= totalPages}
                  style={styles.paginationButton}
                />
              </View>

              <Text variant="caption" color="secondary" align="center" style={styles.paginationInfo}>
                Página {page} de {Math.max(totalPages, 1)} • Total: {total}
              </Text>
            </View>
          </View>
        </View>
      )}

      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseDetailModal}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={handleCloseDetailModal}
              style={styles.backButton}
              activeOpacity={activeOpacity.medium}
            >
              <Text variant="titleLarge" color="secondary">←</Text>
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text variant="titleLarge" color="primary">Detalle de Sesión</Text>
              <Text variant="caption" color="tertiary">
                {selectedDetail?.session?.cashRegister?.code || '-'} • {selectedDetail?.session?.id?.slice(0, 8) || '-'}
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {!selectedDetail ? (
              <Card variant="outlined" padding="medium">
                <Text variant="bodyMedium" color="tertiary" align="center">Sin información de sesión</Text>
              </Card>
            ) : (
              <>
                <Card variant="outlined" padding="medium" style={styles.modalSection}>
                  <View style={styles.rowBetween}>
                    <Text variant="titleSmall" color="primary">Información General</Text>
                    <Badge
                      label={selectedDetail.session.status}
                      variant={getStatusVariant(selectedDetail.session.status)}
                      size="small"
                    />
                  </View>
                  <DetailKeyValue label="ID Sesión" value={selectedDetail.session.id} />
                  <DetailKeyValue label="Cajera" value={selectedDetail.session.userName} />
                  <DetailKeyValue
                    label="Caja"
                    value={`${selectedDetail.session.cashRegister.code} - ${selectedDetail.session.cashRegister.name}`}
                  />
                  <DetailKeyValue label="Apertura" value={formatDate(selectedDetail.session.openedAt)} />
                  <DetailKeyValue label="Cierre" value={formatDate(selectedDetail.session.closedAt)} />
                  <DetailKeyValue label="Company ID" value={selectedDetail.session.companyId || '-'} />
                  <DetailKeyValue label="Site ID" value={selectedDetail.session.siteId || '-'} />
                </Card>

                <Card variant="outlined" padding="medium" style={styles.modalSection}>
                  <Text variant="titleSmall" color="primary" style={styles.sectionTitle}>Resumen financiero</Text>

                  <View style={styles.financialGroup}>
                    <Text variant="labelSmall" color="tertiary" style={styles.financialGroupTitle}>Ventas y pagos</Text>
                    <View style={styles.financialRow}>
                      <FinancialMetric label="N° ventas" value={`${totals?.salesCount || 0}`} />
                      <FinancialMetric label="Ventas" value={formatCurrency(totals?.salesCents)} />
                      <FinancialMetric label="Pagos" value={formatCurrency(totals?.paymentsCents)} />
                    </View>
                    <View style={styles.financialRow}>
                      <FinancialMetric label="Reembolsos" value={formatCurrency(totals?.refundsCents)} />
                    </View>
                  </View>

                  <View style={styles.financialGroup}>
                    <Text variant="labelSmall" color="tertiary" style={styles.financialGroupTitle}>Caja</Text>
                    <View style={styles.financialRow}>
                      <FinancialMetric label="Apertura" value={formatCurrency(totals?.openingCashCents)} />
                      <FinancialMetric label="Actual" value={formatCurrency(totals?.currentCashCents)} />
                      <FinancialMetric label="Esperado" value={formatCurrency(totals?.expectedCashCents)} />
                    </View>
                    <View style={styles.financialRow}>
                      <FinancialMetric label="Cierre" value={formatCurrency(totals?.closingCashCents)} />
                      <FinancialMetric
                        label="Diferencia manual"
                        value={formatCurrency(manualDifferenceCents)}
                        valueColor={getManualDifferenceColor(manualDifferenceCents)}
                        highlight
                      />
                    </View>
                  </View>
                </Card>

                <Card variant="outlined" padding="medium" style={styles.modalSection}>
                  <Text variant="titleSmall" color="primary" style={styles.sectionTitle}>Métodos de pago</Text>
                  {paymentBreakdown.length === 0 ? (
                    <Text variant="bodySmall" color="tertiary">Sin registros</Text>
                  ) : (
                    paymentBreakdown.map((item) => (
                      <View key={item.paymentMethodId} style={styles.listItem}>
                        <View>
                          <Text variant="bodySmall" color="primary">{item.paymentMethodName} ({item.paymentMethodCode})</Text>
                          <Text variant="caption" color="tertiary">Transacciones: {item.count}</Text>
                        </View>
                        <Text variant="labelMedium" color="primary">{formatCurrency(item.totalCents)}</Text>
                      </View>
                    ))
                  )}
                </Card>

                <Card variant="outlined" padding="medium" style={styles.modalSection}>
                  <Text variant="titleSmall" color="primary" style={styles.sectionTitle}>Cierre de sesión</Text>
                  <DetailKeyValue
                    label="Estado motivo cierre"
                    value={selectedDetail.session.closure?.closureReasonStatus || '-'}
                  />
                  <DetailKeyValue
                    label="Motivo diferencia"
                    value={selectedDetail.session.closure?.closureDifferenceReason || '-'}
                  />
                  <DetailKeyValue
                    label="Recaudo final esperado"
                    value={formatCurrency(selectedDetail.session.closure?.finalCollectionExpectedCents)}
                  />
                  <DetailKeyValue
                    label="Recaudo final real"
                    value={formatCurrency(selectedDetail.session.closure?.finalCollectionActualCents)}
                  />
                  <View style={[styles.rowBetween, styles.kvItem]}> 
                    <View>
                      <Text variant="caption" color="tertiary">Tipo diferencia recaudo final</Text>
                      <Text variant="bodySmall" color="primary">{selectedDetail.session.closure?.finalCollectionDifferenceType || '-'}</Text>
                    </View>
                    <Badge
                      label={selectedDetail.session.closure?.finalCollectionDifferenceType || 'NONE'}
                      variant={getDifferenceTypeVariant(selectedDetail.session.closure?.finalCollectionDifferenceType || 'NONE')}
                      size="small"
                    />
                  </View>
                </Card>

                <Card variant="outlined" padding="medium" style={styles.modalSection}>
                  <Text variant="titleSmall" color="primary" style={styles.sectionTitle}>
                    Recaudaciones ({selectedDetail.collections.length})
                  </Text>
                  {selectedDetail.collections.length === 0 ? (
                    <Text variant="bodySmall" color="tertiary">Sin recaudaciones registradas</Text>
                  ) : (
                    selectedDetail.collections.map((collection: PosSessionCollectionDetail) => (
                      <View key={collection.id} style={styles.listItemColumn}>
                        <View style={styles.rowBetween}>
                          <Text variant="labelMedium" color="primary">{collection.collectionNumber}</Text>
                          <Badge label={collection.collectionType} variant="info" size="small" />
                        </View>
                        <DetailKeyValue label="Monto" value={formatCurrency(collection.amountCents)} />
                        <DetailKeyValue label="Esperado" value={formatCurrency(collection.expectedAmountCents)} />
                        <DetailKeyValue label="Diferencia" value={formatCurrency(collection.differenceCents)} />
                        <DetailKeyValue label="Cajera" value={collection.cashierName} />
                        <DetailKeyValue label="Supervisora" value={collection.supervisorName} />
                        <DetailKeyValue label="Completado" value={formatDate(collection.completedAt)} />
                      </View>
                    ))
                  )}
                </Card>

                <Card variant="outlined" padding="medium" style={styles.modalSection}>
                  <TouchableOpacity
                    style={styles.collapsibleHeader}
                    activeOpacity={activeOpacity.medium}
                    onPress={() => setIsRequestsExpanded((prev) => !prev)}
                  >
                    <Text variant="titleSmall" color="primary">
                      Solicitudes ({selectedDetail.requests.length})
                    </Text>
                    <View style={styles.expandIconContainer}>
                      <Ionicons
                        name={isRequestsExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={colors.primary[900]}
                      />
                    </View>
                  </TouchableOpacity>

                  {isRequestsExpanded && (
                    selectedDetail.requests.length === 0 ? (
                      <Text variant="bodySmall" color="tertiary">Sin solicitudes registradas</Text>
                    ) : (
                      selectedDetail.requests.map((request: PosSessionRequestDetail) => (
                        <View key={request.id} style={styles.listItemColumn}>
                          <View style={styles.rowBetween}>
                            <Text variant="labelMedium" color="primary">{request.reason}</Text>
                            <Badge label={request.status} variant={getRequestStatusVariant(request.status)} size="small" />
                          </View>
                          <DetailKeyValue label="Token" value={request.token} />
                          <DetailKeyValue label="Cajera" value={request.cashierName} />
                          <DetailKeyValue label="Procesado por" value={request.processedByName || '-'} />
                          <DetailKeyValue label="Procesado" value={formatDate(request.processedAt)} />
                          <DetailKeyValue label="Efectivo actual" value={formatCurrency(request.currentCashCents)} />
                          <DetailKeyValue label="Máx. recaudable" value={formatCurrency(request.maxCollectionCents)} />
                          <DetailKeyValue label="Creado" value={formatDate(request.createdAt)} />
                          <DetailKeyValue label="Expira" value={formatDate(request.expiresAt)} />
                        </View>
                      ))
                    )
                  )}
                </Card>

                <Card variant="outlined" padding="medium" style={styles.modalSection}>
                  <TouchableOpacity
                    style={styles.collapsibleHeader}
                    activeOpacity={activeOpacity.medium}
                    onPress={() => setIsSalesExpanded((prev) => !prev)}
                  >
                    <Text variant="titleSmall" color="primary">Ventas ({selectedDetail.sales.length})</Text>
                    <View style={styles.expandIconContainer}>
                      <Ionicons
                        name={isSalesExpanded ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={colors.primary[900]}
                      />
                    </View>
                  </TouchableOpacity>

                  {isSalesExpanded && (
                    selectedDetail.sales.length === 0 ? (
                      <Text variant="bodySmall" color="tertiary">Sin ventas registradas</Text>
                    ) : (
                      selectedDetail.sales.map((sale: PosSessionSaleDetail) => (
                        <View key={sale.id} style={styles.saleCard}>
                          <View style={styles.rowBetween}>
                            <Text variant="labelMedium" color="primary">{sale.code}</Text>
                            <Badge label={sale.status} variant="info" size="small" />
                          </View>
                          <DetailKeyValue label="Fecha" value={formatDate(sale.saleDate)} />
                          <DetailKeyValue label="Comprobante" value={sale.documentType} />
                          <DetailKeyValue label="Total" value={formatCurrency(sale.totalCents)} />

                          <Text variant="caption" color="tertiary" style={styles.inlineSectionLabel}>Pagos ({sale.payments.length})</Text>
                          {sale.payments.map((payment) => (
                            <View key={payment.id} style={styles.paymentRow}>
                              <Text variant="bodySmall" color="secondary">{payment.paymentMethodName}</Text>
                              <Text variant="bodySmall" color="primary">{formatCurrency(payment.amountCents)}</Text>
                            </View>
                          ))}
                        </View>
                      ))
                    )
                  )}
                </Card>
              </>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button title="Cerrar detalle" variant="primary" onPress={handleCloseDetailModal} fullWidth />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing[2],
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing[2],
  },
  contentWrapper: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing[3],
  },
  emptySubtitle: {
    marginTop: spacing[1],
  },
  card: {
    marginBottom: spacing[2.5],
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  cardTitle: {
    flex: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  summaryBox: {
    flex: 1,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    padding: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  detailButton: {
    marginTop: spacing[3],
  },
  paginationFixedContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
  },
  paginationContainer: {
    backgroundColor: colors.surface.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    ...shadows.sm,
  },
  paginationButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
  },
  paginationButton: {
    minWidth: 120,
  },
  paginationInfo: {
    marginTop: spacing[1.5],
  },

  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.surface.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalContent: {
    padding: spacing[3],
    paddingBottom: spacing[6],
  },
  modalSection: {
    marginBottom: spacing[2.5],
  },
  sectionTitle: {
    marginBottom: spacing[2],
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[1.5],
  },
  expandIconContainer: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  kvItem: {
    marginTop: spacing[1.5],
  },
  gridTwoColumns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  financialGroup: {
    marginTop: spacing[1],
    marginBottom: spacing[2],
  },
  financialGroupTitle: {
    marginBottom: spacing[1.5],
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  financialRow: {
    flexDirection: 'row',
    gap: spacing[1.5],
    marginBottom: spacing[1.5],
  },
  financialMetricBox: {
    flex: 1,
    minHeight: 64,
    backgroundColor: colors.surface.secondary,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacing[1.5],
    paddingVertical: spacing[1.5],
    justifyContent: 'center',
  },
  financialMetricBoxHighlight: {
    borderColor: colors.primary[300],
    backgroundColor: colors.primary[50],
  },
  financialMetricValue: {
    marginTop: spacing[0.5],
  },
  listItem: {
    marginTop: spacing[1.5],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing[1.5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  listItemColumn: {
    marginTop: spacing[2],
    padding: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
  },
  saleCard: {
    marginTop: spacing[2],
    padding: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.light,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface.secondary,
  },
  inlineSectionLabel: {
    marginTop: spacing[1.5],
    marginBottom: spacing[1],
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[0.75],
  },
  modalFooter: {
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
    paddingTop: spacing[1],
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.surface.primary,
  },
});

export default SessionsManagementScreen;
