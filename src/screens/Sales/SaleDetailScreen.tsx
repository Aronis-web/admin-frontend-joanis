import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  useWindowDimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { salesApi } from '@/services/api/sales';
import {
  Sale,
  SaleStatus,
  PaymentStatus,
  SaleStatusLabels,
  PaymentStatusLabels,
  SaleTypeLabels,
  ProcessingStatusLabels,
  DocumentType,
  CreateCreditNoteRequest,
  CreateDebitNoteRequest,
} from '@/types/sales';
import { useAuthStore } from '@/store/auth';
import { config } from '@/utils/config';
import { colors, spacing, borderRadius, shadows } from '@/design-system/tokens';
import logger from '@/utils/logger';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

interface SaleDetailScreenProps {
  route: {
    params: {
      saleId: string;
    };
  };
}

export const SaleDetailScreen: React.FC<SaleDetailScreenProps> = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { saleId } = route.params as { saleId: string };
  const { token, currentCompany, currentSite } = useAuthStore();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // State
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saleDocuments, setSaleDocuments] = useState<any>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [debitNotes, setDebitNotes] = useState<any[]>([]);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [showDebitNoteModal, setShowDebitNoteModal] = useState(false);

  // Load sale
  const loadSale = async (isRefresh: boolean = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await salesApi.getSaleById(saleId, {
        includeItems: true,
        includeDocuments: true,
        includePayments: true,
      });

      setSale(data);
      logger.info('📊 Venta cargada:', data);

      if (data.documents && Array.isArray(data.documents)) {
        const creditNotesList = data.documents.filter((doc: any) =>
          doc.documentType?.code === '07' || doc.documentType?.name?.toLowerCase().includes('crédito')
        );
        const debitNotesList = data.documents.filter((doc: any) =>
          doc.documentType?.code === '08' || doc.documentType?.name?.toLowerCase().includes('débito')
        );

        setCreditNotes(creditNotesList);
        setDebitNotes(debitNotesList);

        setSaleDocuments({
          documents: data.documents,
          allDocuments: data.documents,
        });
      } else {
        setCreditNotes([]);
        setDebitNotes([]);
      }

      loadSaleDocuments();
    } catch (error) {
      logger.error('Error cargando venta:', error);
      Alert.alert('Error', 'No se pudo cargar la venta');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadSaleDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const docs = await salesApi.getSaleDocuments(saleId);
      const allDocs = docs?.allDocuments || docs?.documents || [];

      if (allDocs.length > 0) {
        setSaleDocuments((prev: any) => ({
          ...prev,
          ...docs,
          documents: allDocs,
          allDocuments: allDocs,
        }));

        if (docs?.creditNotes && Array.isArray(docs.creditNotes) && docs.creditNotes.length > 0) {
          setCreditNotes((prev) => prev.length === 0 ? docs.creditNotes : prev);
        }

        if (docs?.debitNotes && Array.isArray(docs.debitNotes) && docs.debitNotes.length > 0) {
          setDebitNotes((prev) => prev.length === 0 ? docs.debitNotes : prev);
        }
      }
    } catch (error: any) {
      logger.error('❌ Error cargando documentos:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  useEffect(() => {
    loadSale();
  }, [saleId]);

  const handleRefresh = () => {
    loadSale(true);
  };



  const handleRegisterPayment = () => {
    if (sale?.id) {
      (navigation as any).navigate('RegisterSalePayment', { saleId: sale.id });
    }
  };

  const handleDownloadDocument = async () => {
    if (!saleDocuments || !saleDocuments.documents || saleDocuments.documents.length === 0) {
      Alert.alert('Error', 'No hay documentos disponibles para descargar');
      return;
    }

    const document = saleDocuments.documents[0];
    setLoadingDocuments(true);

    try {
      if (Platform.OS === 'web') {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
        const pdfUrl = `${apiUrl}/sales/${saleId}/documents/${document.id}/pdf`;
        window.open(pdfUrl, '_blank');
      } else {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
        const pdfUrl = `${apiUrl}/sales/${saleId}/documents/${document.id}/pdf`;

        const fileName = `${document.documentNumber}.pdf`;
        const fileUri = FileSystem.cacheDirectory + fileName;

        const headers: Record<string, string> = {
          'X-App-Id': config.APP_ID,
        };

        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (currentCompany?.id) headers['X-Company-Id'] = currentCompany.id;
        if (currentSite?.id) headers['X-Site-Id'] = currentSite.id;

        const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri, { headers });

        if (downloadResult.status !== 200) {
          throw new Error(`Error del servidor: ${downloadResult.status}`);
        }

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: `${sale?.documentType} ${document.documentNumber}`,
          });
        } else {
          Alert.alert('Éxito', `PDF guardado en: ${downloadResult.uri}`);
        }
      }
    } catch (error: any) {
      logger.error('❌ Error al descargar documento:', error);
      Alert.alert('Error', error.message || 'Error al descargar el documento');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleDownloadNoteDocument = async (documentId: string, documentNumber: string) => {
    setLoadingDocuments(true);
    try {
      if (Platform.OS === 'web') {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
        const pdfUrl = `${apiUrl}/sales/${saleId}/documents/${documentId}/pdf`;
        window.open(pdfUrl, '_blank');
      } else {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
        const pdfUrl = `${apiUrl}/sales/${saleId}/documents/${documentId}/pdf`;

        const fileName = `${documentNumber}.pdf`;
        const fileUri = FileSystem.cacheDirectory + fileName;

        const headers: Record<string, string> = { 'X-App-Id': config.APP_ID };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (currentCompany?.id) headers['X-Company-Id'] = currentCompany.id;
        if (currentSite?.id) headers['X-Site-Id'] = currentSite.id;

        const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri, { headers });

        if (downloadResult.status !== 200) {
          throw new Error(`Error del servidor: ${downloadResult.status}`);
        }

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/pdf',
            dialogTitle: documentNumber,
          });
        }
      }
    } catch (error: any) {
      logger.error('❌ Error al descargar nota:', error);
      Alert.alert('Error', error.message || 'Error al descargar la nota');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const createCreditNote = async (data: CreateCreditNoteRequest) => {
    if (!sale?.id) return;

    setLoadingDocuments(true);
    try {
      const result = await salesApi.createCreditNote(sale.id, data);
      setShowCreditNoteModal(false);
      Alert.alert(
        'Éxito',
        `Nota de crédito creada: ${result.documentNumber}`,
        [{ text: 'OK', onPress: () => loadSale(true) }]
      );
    } catch (error: any) {
      logger.error('Error creando nota de crédito:', error);
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo crear la nota de crédito');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const createDebitNote = async (monto: number, sustentoNota: string) => {
    if (!sale?.id) return;

    setLoadingDocuments(true);
    try {
      const valorUnitario = monto / 1.18;
      const precioVentaUnitario = monto;

      const data: CreateDebitNoteRequest = {
        motivoNota: '01',
        sustentoNota,
        items: [
          {
            sku: 'CARGO-ADICIONAL',
            descripcion: sustentoNota,
            cantidad: 1,
            unidadMedida: 'ZZ',
            valorUnitario: Math.round(valorUnitario * 100) / 100,
            precioVentaUnitario: Math.round(precioVentaUnitario * 100) / 100,
          },
        ],
        observaciones: `Cargo adicional: S/ ${monto.toFixed(2)}`,
      };

      const result = await salesApi.createDebitNote(sale.id, data);
      setShowDebitNoteModal(false);
      Alert.alert(
        'Éxito',
        `Nota de débito creada: ${result.documentNumber}`,
        [{ text: 'OK', onPress: () => loadSale(true) }]
      );
    } catch (error: any) {
      logger.error('Error creando nota de débito:', error);
      Alert.alert('Error', error?.response?.data?.message || 'No se pudo crear la nota de débito');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const getStatusColor = (status: SaleStatus) => {
    switch (status) {
      case SaleStatus.CONFIRMED: return colors.success[500];
      case SaleStatus.COMPLETED: return colors.accent[500];
      case SaleStatus.CANCELLED: return colors.danger[500];
      case SaleStatus.DRAFT: return colors.warning[500];
      default: return colors.neutral[500];
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID: return colors.success[500];
      case PaymentStatus.PARTIAL: return colors.warning[500];
      case PaymentStatus.PENDING: return colors.neutral[500];
      case PaymentStatus.OVERDUE: return colors.danger[500];
      default: return colors.neutral[500];
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent[500]} />
        <Text style={styles.loadingText}>Cargando venta...</Text>
      </View>
    );
  }

  if (!sale) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.danger[400]} />
        <Text style={styles.errorText}>No se encontró la venta</Text>
        <TouchableOpacity style={styles.backButtonError} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonErrorText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const customerName = sale.customerSnapshot?.fullName || sale.companySnapshot?.razonSocial || 'Sin cliente';
  const documentNumber = sale.customerSnapshot?.documentNumber || sale.companySnapshot?.ruc || '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary[900], colors.primary[800]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.neutral[0]} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerCode}>{sale.code}</Text>
            <View style={styles.headerBadges}>
              <View style={[styles.headerBadge, { backgroundColor: getStatusColor(sale.status) }]}>
                <Text style={styles.headerBadgeText}>{SaleStatusLabels[sale.status]}</Text>
              </View>
              <View style={[styles.headerBadge, { backgroundColor: colors.accent[500] }]}>
                <Text style={styles.headerBadgeText}>{SaleTypeLabels[sale.saleType]}</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            {sale.status !== SaleStatus.CANCELLED && saleDocuments?.documents?.length > 0 && (
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={handleDownloadDocument}
                disabled={loadingDocuments}
              >
                <Ionicons name="download-outline" size={22} color={colors.neutral[0]} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>S/ {(sale.totalCents / 100).toFixed(2)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pagado</Text>
            <Text style={[styles.summaryValue, { color: colors.success[300] }]}>
              S/ {(sale.paidAmountCents / 100).toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Saldo</Text>
            <Text style={[styles.summaryValue, { color: sale.balanceCents > 0 ? colors.danger[300] : colors.success[300] }]}>
              S/ {(sale.balanceCents / 100).toFixed(2)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.accent[500]]} />}
      >
        {/* Customer Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color={colors.neutral[600]} />
            <Text style={styles.sectionTitle}>Cliente</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nombre</Text>
              <Text style={styles.infoValue}>{customerName}</Text>
            </View>
            {documentNumber && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Documento</Text>
                <Text style={styles.infoValue}>{documentNumber}</Text>
              </View>
            )}
            {sale.customerSnapshot?.email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{sale.customerSnapshot.email}</Text>
              </View>
            )}
            {sale.customerSnapshot?.phone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Teléfono</Text>
                <Text style={styles.infoValue}>{sale.customerSnapshot.phone}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Sale Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={20} color={colors.neutral[600]} />
            <Text style={styles.sectionTitle}>Información de la Venta</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fecha</Text>
              <Text style={styles.infoValue}>
                {new Date(sale.saleDate).toLocaleDateString('es-PE', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Procesamiento</Text>
              <View style={[styles.processingBadge, { backgroundColor: colors.accent[50] }]}>
                <Text style={[styles.processingBadgeText, { color: colors.accent[700] }]}>
                  {ProcessingStatusLabels[sale.processingStatus]}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Stock Validado</Text>
              <View style={styles.checkContainer}>
                <Ionicons
                  name={sale.isStockValidated ? "checkmark-circle" : "close-circle"}
                  size={20}
                  color={sale.isStockValidated ? colors.success[500] : colors.danger[500]}
                />
              </View>
            </View>
            {sale.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Notas</Text>
                <Text style={styles.notesText}>{sale.notes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cube-outline" size={20} color={colors.neutral[600]} />
            <Text style={styles.sectionTitle}>Productos ({sale.itemCount})</Text>
          </View>
          {sale.items && sale.items.length > 0 ? (
            <View style={styles.productsContainer}>
              {sale.items.map((item, index) => (
                <View key={item.id} style={styles.productCard}>
                  <View style={styles.productHeader}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {item.productSnapshot.title}
                    </Text>
                    <Text style={styles.productPrice}>
                      S/ {(item.totalCents / 100).toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.productSku}>SKU: {item.productSnapshot.sku}</Text>
                  <View style={styles.productDetails}>
                    <View style={styles.productDetailItem}>
                      <Text style={styles.productDetailLabel}>Cant.:</Text>
                      <Text style={styles.productDetailValue}>{item.quantity}</Text>
                    </View>
                    <View style={styles.productDetailItem}>
                      <Text style={styles.productDetailLabel}>P.Unit.:</Text>
                      <Text style={styles.productDetailValue}>
                        S/ {(item.unitPriceCents / 100).toFixed(2)}
                      </Text>
                    </View>
                    {item.discountCents > 0 && (
                      <View style={styles.productDetailItem}>
                        <Text style={[styles.productDetailLabel, { color: colors.danger[500] }]}>Desc.:</Text>
                        <Text style={[styles.productDetailValue, { color: colors.danger[500] }]}>
                          -S/ {(item.discountCents / 100).toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay productos</Text>
            </View>
          )}
        </View>

        {/* Totals */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calculator-outline" size={20} color={colors.neutral[600]} />
            <Text style={styles.sectionTitle}>Totales</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>S/ {(sale.subtotalCents / 100).toFixed(2)}</Text>
            </View>
            {sale.discountCents > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Descuento</Text>
                <Text style={[styles.totalValue, { color: colors.danger[500] }]}>
                  -S/ {(sale.discountCents / 100).toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.totalRowFinal}>
              <Text style={styles.totalLabelFinal}>Total</Text>
              <Text style={styles.totalValueFinal}>S/ {(sale.totalCents / 100).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Payment Status */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="wallet-outline" size={20} color={colors.neutral[600]} />
            <Text style={styles.sectionTitle}>Estado de Pago</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Estado</Text>
              <View style={[styles.paymentStatusBadge, { backgroundColor: getPaymentStatusColor(sale.paymentStatus) + '15' }]}>
                <View style={[styles.paymentStatusDot, { backgroundColor: getPaymentStatusColor(sale.paymentStatus) }]} />
                <Text style={[styles.paymentStatusText, { color: getPaymentStatusColor(sale.paymentStatus) }]}>
                  {PaymentStatusLabels[sale.paymentStatus]}
                </Text>
              </View>
            </View>
            <View style={styles.paymentSummary}>
              <View style={styles.paymentSummaryItem}>
                <Text style={styles.paymentSummaryLabel}>Total</Text>
                <Text style={styles.paymentSummaryValue}>S/ {(sale.totalCents / 100).toFixed(2)}</Text>
              </View>
              <View style={styles.paymentSummaryItem}>
                <Text style={styles.paymentSummaryLabel}>Pagado</Text>
                <Text style={[styles.paymentSummaryValue, { color: colors.success[600] }]}>
                  S/ {(sale.paidAmountCents / 100).toFixed(2)}
                </Text>
              </View>
              <View style={styles.paymentSummaryItem}>
                <Text style={styles.paymentSummaryLabel}>Saldo</Text>
                <Text style={[styles.paymentSummaryValue, { color: sale.balanceCents > 0 ? colors.danger[600] : colors.success[600] }]}>
                  S/ {(sale.balanceCents / 100).toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Payments */}
        {sale.payments && sale.payments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cash-outline" size={20} color={colors.neutral[600]} />
              <Text style={styles.sectionTitle}>Pagos ({sale.payments.length})</Text>
            </View>
            <View style={styles.paymentsContainer}>
              {sale.payments.map((payment) => (
                <View key={payment.id} style={styles.paymentCard}>
                  <View style={styles.paymentHeader}>
                    <Text style={styles.paymentAmount}>S/ {(payment.amountCents / 100).toFixed(2)}</Text>
                    <Text style={styles.paymentDate}>
                      {new Date(payment.createdAt).toLocaleDateString('es-PE')}
                    </Text>
                  </View>
                  {payment.paymentMethod && (
                    <View style={styles.paymentMethodContainer}>
                      <Ionicons name="card-outline" size={14} color={colors.neutral[500]} />
                      <Text style={styles.paymentMethod}>{payment.paymentMethod.name}</Text>
                    </View>
                  )}
                  {payment.referenceNumber && (
                    <Text style={styles.paymentReference}>Ref: {payment.referenceNumber}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Credit Notes */}
        {creditNotes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={20} color={colors.warning[600]} />
              <Text style={styles.sectionTitle}>Notas de Crédito ({creditNotes.length})</Text>
            </View>
            {creditNotes.map((note, index) => (
              <View key={note.id || index} style={styles.noteCard}>
                <View style={styles.noteHeader}>
                  <Text style={styles.noteNumber}>{note.documentNumber}</Text>
                  <View style={[styles.noteStatusBadge, { backgroundColor: colors.warning[100] }]}>
                    <Text style={[styles.noteStatusText, { color: colors.warning[700] }]}>{note.status}</Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Monto</Text>
                  <Text style={[styles.infoValue, { color: colors.warning[600] }]}>
                    S/ {(note.totalCents / 100).toFixed(2)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.downloadNoteButton}
                  onPress={() => handleDownloadNoteDocument(note.id, note.documentNumber)}
                  disabled={loadingDocuments}
                >
                  <Ionicons name="download-outline" size={18} color={colors.neutral[0]} />
                  <Text style={styles.downloadNoteButtonText}>Descargar PDF</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Actions */}
        {sale.status !== SaleStatus.CANCELLED && (
          <View style={styles.actionsSection}>
            {sale.balanceCents > 0 && (
              <TouchableOpacity style={styles.actionButton} onPress={handleRegisterPayment}>
                <Ionicons name="add-circle-outline" size={20} color={colors.neutral[0]} />
                <Text style={styles.actionButtonText}>Registrar Pago</Text>
              </TouchableOpacity>
            )}

            {sale.status === SaleStatus.CONFIRMED && (sale.documentType === DocumentType.BOLETA || sale.documentType === DocumentType.FACTURA) && (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.warning[500] }]}
                  onPress={() => setShowCreditNoteModal(true)}
                >
                  <Ionicons name="document-text-outline" size={20} color={colors.neutral[0]} />
                  <Text style={styles.actionButtonText}>Nota de Crédito</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.info[500] }]}
                  onPress={() => setShowDebitNoteModal(true)}
                >
                  <Ionicons name="add-outline" size={20} color={colors.neutral[0]} />
                  <Text style={styles.actionButtonText}>Nota de Débito</Text>
                </TouchableOpacity>
              </>
            )}


          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Credit Note Modal */}
      <Modal visible={showCreditNoteModal} transparent animationType="slide" onRequestClose={() => setShowCreditNoteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear Nota de Crédito</Text>
              <TouchableOpacity onPress={() => setShowCreditNoteModal(false)}>
                <Ionicons name="close" size={24} color={colors.neutral[500]} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>Selecciona el tipo de devolución:</Text>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => createCreditNote({
                  motivoNota: '06',
                  sustentoNota: 'Devolución total de mercadería',
                  observaciones: 'Devolución total solicitada por el cliente',
                })}
              >
                <View style={styles.modalOptionIcon}>
                  <Ionicons name="return-down-back" size={24} color={colors.warning[600]} />
                </View>
                <View style={styles.modalOptionContent}>
                  <Text style={styles.modalOptionTitle}>Devolución Total</Text>
                  <Text style={styles.modalOptionSubtitle}>100% del monto de la venta</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => createCreditNote({
                  motivoNota: '07',
                  sustentoNota: 'Devolución parcial de mercadería',
                  porcentajeDevolucion: 50,
                  observaciones: 'Devolución del 50% de los productos',
                })}
              >
                <View style={styles.modalOptionIcon}>
                  <Ionicons name="git-branch-outline" size={24} color={colors.warning[600]} />
                </View>
                <View style={styles.modalOptionContent}>
                  <Text style={styles.modalOptionTitle}>Devolución 50%</Text>
                  <Text style={styles.modalOptionSubtitle}>Devolución parcial de la venta</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Debit Note Modal */}
      <Modal visible={showDebitNoteModal} transparent animationType="slide" onRequestClose={() => setShowDebitNoteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear Nota de Débito</Text>
              <TouchableOpacity onPress={() => setShowDebitNoteModal(false)}>
                <Ionicons name="close" size={24} color={colors.neutral[500]} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalDescription}>Selecciona el monto del cargo:</Text>
              {[50, 100, 200].map((monto) => (
                <TouchableOpacity
                  key={monto}
                  style={styles.modalOption}
                  onPress={() => createDebitNote(monto, 'Cargo adicional')}
                >
                  <View style={[styles.modalOptionIcon, { backgroundColor: colors.info[100] }]}>
                    <Text style={[styles.modalOptionIconText, { color: colors.info[700] }]}>+</Text>
                  </View>
                  <View style={styles.modalOptionContent}>
                    <Text style={styles.modalOptionTitle}>S/ {monto.toFixed(2)}</Text>
                    <Text style={styles.modalOptionSubtitle}>Cargo adicional</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.neutral[400]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    gap: spacing[4],
  },
  loadingText: {
    fontSize: 16,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  errorText: {
    fontSize: 18,
    color: colors.danger[600],
    fontWeight: '600',
    marginTop: spacing[4],
  },
  backButtonError: {
    marginTop: spacing[4],
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    backgroundColor: colors.accent[500],
    borderRadius: borderRadius.lg,
  },
  backButtonErrorText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  headerGradient: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    paddingBottom: spacing[4],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerCode: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.neutral[0],
    marginBottom: spacing[2],
  },
  headerBadges: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  headerBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.full,
  },
  headerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  headerActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.xl,
    padding: spacing[4],
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: spacing[1],
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  summaryDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing[3],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[700],
  },
  card: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  infoLabel: {
    fontSize: 14,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: colors.neutral[800],
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  processingBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  processingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  checkContainer: {},
  notesContainer: {
    paddingTop: spacing[3],
    marginTop: spacing[2],
  },
  notesLabel: {
    fontSize: 13,
    color: colors.neutral[500],
    fontWeight: '500',
    marginBottom: spacing[1],
  },
  notesText: {
    fontSize: 14,
    color: colors.neutral[700],
    lineHeight: 20,
  },
  productsContainer: {
    gap: spacing[3],
  },
  productCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...shadows.sm,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[2],
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.neutral[800],
    flex: 1,
    marginRight: spacing[3],
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.success[600],
  },
  productSku: {
    fontSize: 12,
    color: colors.neutral[500],
    marginBottom: spacing[3],
  },
  productDetails: {
    flexDirection: 'row',
    gap: spacing[4],
    flexWrap: 'wrap',
  },
  productDetailItem: {
    flexDirection: 'row',
    gap: spacing[1],
  },
  productDetailLabel: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  productDetailValue: {
    fontSize: 13,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
  },
  totalLabel: {
    fontSize: 14,
    color: colors.neutral[500],
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  totalRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing[3],
    marginTop: spacing[2],
    borderTopWidth: 2,
    borderTopColor: colors.neutral[200],
  },
  totalLabelFinal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  totalValueFinal: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.success[600],
  },
  paymentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: borderRadius.full,
    gap: spacing[1.5],
  },
  paymentStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  paymentStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  paymentSummary: {
    flexDirection: 'row',
    marginTop: spacing[4],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  paymentSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  paymentSummaryLabel: {
    fontSize: 11,
    color: colors.neutral[500],
    fontWeight: '500',
    marginBottom: spacing[1],
  },
  paymentSummaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  paymentsContainer: {
    gap: spacing[3],
  },
  paymentCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    ...shadows.sm,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.success[600],
  },
  paymentDate: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  paymentMethodContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1.5],
  },
  paymentMethod: {
    fontSize: 13,
    color: colors.neutral[600],
  },
  paymentReference: {
    fontSize: 12,
    color: colors.neutral[400],
    marginTop: spacing[1],
  },
  emptyContainer: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing[8],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  emptyText: {
    fontSize: 14,
    color: colors.neutral[400],
  },
  noteCard: {
    backgroundColor: colors.surface.primary,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.warning[200],
    ...shadows.sm,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
    paddingBottom: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  noteNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  noteStatusBadge: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  noteStatusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  downloadNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent[500],
    padding: spacing[3],
    borderRadius: borderRadius.lg,
    marginTop: spacing[3],
    gap: spacing[2],
  },
  downloadNoteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  actionsSection: {
    gap: spacing[3],
    marginTop: spacing[4],
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success[500],
    padding: spacing[4],
    borderRadius: borderRadius.xl,
    gap: spacing[2],
    ...shadows.sm,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[0],
  },
  bottomSpacer: {
    height: spacing[10],
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface.primary,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.neutral[800],
  },
  modalBody: {
    padding: spacing[5],
  },
  modalDescription: {
    fontSize: 15,
    color: colors.neutral[600],
    marginBottom: spacing[4],
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.neutral[50],
    borderRadius: borderRadius.xl,
    marginBottom: spacing[3],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  modalOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.warning[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[4],
  },
  modalOptionIconText: {
    fontSize: 24,
    fontWeight: '700',
  },
  modalOptionContent: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral[800],
    marginBottom: spacing[0.5],
  },
  modalOptionSubtitle: {
    fontSize: 13,
    color: colors.neutral[500],
  },
});
