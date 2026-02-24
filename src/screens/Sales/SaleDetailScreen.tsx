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
  Linking,
  Platform,
} from 'react-native';
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
} from '@/types/sales';
import { useAuthStore } from '@/store/auth';
import { config } from '@/utils/config';
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

  // State
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [saleDocuments, setSaleDocuments] = useState<any>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

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

      // Load documents - siempre intentar cargar documentos
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

  // Load sale documents
  const loadSaleDocuments = async () => {
    setLoadingDocuments(true);
    try {
      const docs = await salesApi.getSaleDocuments(saleId);
      logger.info('📄 Documentos cargados:', docs);
      logger.info('📄 Tiene documentos:', docs?.documents?.length > 0);
      if (docs?.documents?.length > 0) {
        logger.info('📄 Primer documento:', docs.documents[0]);
      }
      setSaleDocuments(docs);
    } catch (error: any) {
      logger.error('❌ Error cargando documentos:', error);
      logger.error('❌ Error message:', error?.message);
      logger.error('❌ Error response:', error?.response?.data);
      // No mostrar error al usuario, solo loggearlo
      // Esto permite que la app continúe funcionando aunque no haya documentos
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

  const handleCancelSale = () => {
    Alert.alert(
      'Cancelar Venta',
      '¿Está seguro que desea cancelar esta venta?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, Cancelar',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await salesApi.cancelSale(saleId);
              Alert.alert('Éxito', 'Venta cancelada exitosamente');
              loadSale(true);
            } catch (error) {
              logger.error('Error cancelando venta:', error);
              Alert.alert('Error', 'No se pudo cancelar la venta');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
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
      logger.info('📥 Descargando documento:', document.documentNumber);

      if (Platform.OS === 'web') {
        // En web, usar el endpoint directo que devuelve el blob
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
        const pdfUrl = `${apiUrl}/sales/${saleId}/documents/${document.id}/pdf`;

        // Abrir en nueva pestaña
        window.open(pdfUrl, '_blank');
      } else {
        // En móvil, descargar usando el endpoint directo con autenticación
        const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081';
        const pdfUrl = `${apiUrl}/sales/${saleId}/documents/${document.id}/pdf`;

        logger.info('🌐 URL de descarga:', pdfUrl);

        const fileName = `${document.documentNumber}.pdf`;
        const fileUri = FileSystem.documentDirectory + fileName;

        // Incluir headers de autenticación
        const headers: Record<string, string> = {
          'X-App-Id': config.APP_ID,
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        if (currentCompany?.id) {
          headers['X-Company-Id'] = currentCompany.id;
        }
        if (currentSite?.id) {
          headers['X-Site-Id'] = currentSite.id;
        }

        logger.info('📤 Headers:', Object.keys(headers));

        const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri, {
          headers,
        });

        logger.info('📦 Download result:', {
          uri: downloadResult.uri,
          status: downloadResult.status,
        });

        // Verificar que el archivo se descargó correctamente
        if (downloadResult.status !== 200) {
          throw new Error(`Error del servidor: ${downloadResult.status}`);
        }

        // Verificar el tamaño del archivo
        const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
        logger.info('📄 File info:', fileInfo);

        if (fileInfo.exists && fileInfo.size === 0) {
          throw new Error('El archivo descargado está vacío');
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

      logger.info('✅ Documento descargado exitosamente');
    } catch (error: any) {
      logger.error('❌ Error al descargar documento:', error);
      Alert.alert('Error', error.message || 'Error al descargar el documento');
    } finally {
      setLoadingDocuments(false);
    }
  };

  const getStatusColor = (status: SaleStatus) => {
    switch (status) {
      case SaleStatus.CONFIRMED:
        return '#10B981';
      case SaleStatus.COMPLETED:
        return '#3B82F6';
      case SaleStatus.CANCELLED:
        return '#EF4444';
      case SaleStatus.DRAFT:
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getPaymentStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return '#10B981';
      case PaymentStatus.PARTIAL:
        return '#F59E0B';
      case PaymentStatus.PENDING:
        return '#6B7280';
      case PaymentStatus.OVERDUE:
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Cargando venta...</Text>
      </View>
    );
  }

  if (!sale) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No se encontró la venta</Text>
      </View>
    );
  }

  const customerName = sale.customerSnapshot?.fullName || sale.companySnapshot?.razonSocial || 'Sin cliente';
  const documentNumber = sale.customerSnapshot?.documentNumber || sale.companySnapshot?.ruc || '';

  // Debug logs para ver el estado de los documentos
  logger.info('🔍 Render - saleDocuments:', saleDocuments);
  logger.info('🔍 Render - tiene saleDocuments:', !!saleDocuments);
  logger.info('🔍 Render - tiene documents array:', !!saleDocuments?.documents);
  logger.info('🔍 Render - documents length:', saleDocuments?.documents?.length);
  logger.info('🔍 Render - condición botón:', !!(saleDocuments && saleDocuments.documents && saleDocuments.documents.length > 0));

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{sale.code}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: getStatusColor(sale.status) }]}>
              <Text style={styles.badgeText}>{SaleStatusLabels[sale.status]}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#3B82F6' }]}>
              <Text style={styles.badgeText}>{SaleTypeLabels[sale.saleType]}</Text>
            </View>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información del Cliente</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nombre:</Text>
              <Text style={styles.infoValue}>{customerName}</Text>
            </View>
            {documentNumber && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Documento:</Text>
                <Text style={styles.infoValue}>{documentNumber}</Text>
              </View>
            )}
            {sale.customerSnapshot?.email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email:</Text>
                <Text style={styles.infoValue}>{sale.customerSnapshot.email}</Text>
              </View>
            )}
            {sale.customerSnapshot?.phone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Teléfono:</Text>
                <Text style={styles.infoValue}>{sale.customerSnapshot.phone}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Sale Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información de la Venta</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fecha:</Text>
              <Text style={styles.infoValue}>
                {new Date(sale.saleDate).toLocaleDateString('es-PE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Estado de Procesamiento:</Text>
              <View style={[styles.processingBadge, { backgroundColor: '#3B82F6' }]}>
                <Text style={styles.processingBadgeText}>
                  {ProcessingStatusLabels[sale.processingStatus]}
                </Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Stock Validado:</Text>
              <Text style={styles.infoValue}>{sale.isStockValidated ? '✓ Sí' : '✗ No'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Stock Actualizado:</Text>
              <Text style={styles.infoValue}>{sale.isStockUpdated ? '✓ Sí' : '✗ No'}</Text>
            </View>
            {sale.notes && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Notas:</Text>
                <Text style={styles.infoValue}>{sale.notes}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Products */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Productos ({sale.itemCount})</Text>
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
                      <Text style={styles.productDetailLabel}>Cantidad:</Text>
                      <Text style={styles.productDetailValue}>{item.quantity}</Text>
                    </View>
                    <View style={styles.productDetailItem}>
                      <Text style={styles.productDetailLabel}>Precio Unit.:</Text>
                      <Text style={styles.productDetailValue}>
                        S/ {(item.unitPriceCents / 100).toFixed(2)}
                      </Text>
                    </View>
                    {item.discountCents > 0 && (
                      <View style={styles.productDetailItem}>
                        <Text style={styles.productDetailLabel}>Descuento:</Text>
                        <Text style={styles.productDetailValue}>
                          - S/ {(item.discountCents / 100).toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No hay productos</Text>
          )}
        </View>

        {/* Totals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Totales</Text>
          <View style={styles.card}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>S/ {(sale.subtotalCents / 100).toFixed(2)}</Text>
            </View>
            {sale.discountCents > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Descuento:</Text>
                <Text style={styles.totalValue}>- S/ {(sale.discountCents / 100).toFixed(2)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.totalRowFinal]}>
              <Text style={styles.totalLabelFinal}>Total:</Text>
              <Text style={styles.totalValueFinal}>S/ {(sale.totalCents / 100).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Payment Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado de Pago</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Estado:</Text>
              <View style={[styles.paymentBadge, { backgroundColor: getPaymentStatusColor(sale.paymentStatus) }]}>
                <Text style={styles.paymentBadgeText}>{PaymentStatusLabels[sale.paymentStatus]}</Text>
              </View>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>S/ {(sale.totalCents / 100).toFixed(2)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Pagado:</Text>
              <Text style={[styles.totalValue, { color: '#10B981' }]}>
                S/ {(sale.paidAmountCents / 100).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.totalRowFinal]}>
              <Text style={styles.totalLabelFinal}>Saldo:</Text>
              <Text style={[styles.totalValueFinal, { color: sale.balanceCents > 0 ? '#EF4444' : '#10B981' }]}>
                S/ {(sale.balanceCents / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Payments */}
        {sale.payments && sale.payments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pagos Registrados ({sale.payments.length})</Text>
            <View style={styles.paymentsContainer}>
              {sale.payments.map((payment) => (
                <View key={payment.id} style={styles.paymentCard}>
                  <View style={styles.paymentHeader}>
                    <Text style={styles.paymentAmount}>
                      S/ {(payment.amountCents / 100).toFixed(2)}
                    </Text>
                    <Text style={styles.paymentDate}>
                      {new Date(payment.createdAt).toLocaleDateString('es-PE')}
                    </Text>
                  </View>
                  {payment.paymentMethod && (
                    <Text style={styles.paymentMethod}>
                      Método: {payment.paymentMethod.name}
                    </Text>
                  )}
                  {payment.referenceNumber && (
                    <Text style={styles.paymentReference}>
                      Ref: {payment.referenceNumber}
                    </Text>
                  )}
                  {payment.notes && (
                    <Text style={styles.paymentNotes}>{payment.notes}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Documents Section */}
        {saleDocuments && saleDocuments.documents && saleDocuments.documents.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documentos</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tipo de Documento:</Text>
                <Text style={styles.infoValue}>{sale.documentType}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Número:</Text>
                <Text style={styles.infoValue}>{saleDocuments.documents[0].documentNumber}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Estado:</Text>
                <Text style={styles.infoValue}>{saleDocuments.documents[0].status}</Text>
              </View>
              {saleDocuments.documentGeneratedAt && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Generado:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(saleDocuments.documentGeneratedAt).toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Actions */}
        {sale.status !== SaleStatus.CANCELLED && (
          <View style={styles.actionsSection}>
            {/* Download Document Button - Mostrar siempre que haya documentos, sin importar el estado */}
            {saleDocuments && saleDocuments.documents && saleDocuments.documents.length > 0 && (
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={handleDownloadDocument}
                disabled={loadingDocuments}
              >
                {loadingDocuments ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Text style={styles.downloadButtonText}>📄 Descargar {sale.documentType === DocumentType.BOLETA ? 'Boleta' : sale.documentType === DocumentType.FACTURA ? 'Factura' : 'Documento'}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {sale.balanceCents > 0 && (
              <TouchableOpacity
                style={styles.paymentButton}
                onPress={handleRegisterPayment}
              >
                <Text style={styles.paymentButtonText}>Registrar Pago</Text>
              </TouchableOpacity>
            )}

            {sale.status === SaleStatus.CONFIRMED && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelSale}
                disabled={cancelling}
              >
                {cancelling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.cancelButtonText}>Cancelar Venta</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
  },
  header: {
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007bff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  processingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  processingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  productsContainer: {
    gap: 12,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
    marginLeft: 12,
  },
  productSku: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  productDetails: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  productDetailItem: {
    flexDirection: 'row',
    gap: 4,
  },
  productDetailLabel: {
    fontSize: 13,
    color: '#666',
  },
  productDetailValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 15,
    color: '#666',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  totalRowFinal: {
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#ddd',
    marginTop: 4,
  },
  totalLabelFinal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValueFinal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10B981',
  },
  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  paymentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  paymentsContainer: {
    gap: 12,
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10B981',
  },
  paymentDate: {
    fontSize: 13,
    color: '#666',
  },
  paymentMethod: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  paymentReference: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  paymentNotes: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
  actionsSection: {
    gap: 12,
    marginTop: 8,
  },
  downloadButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  paymentButton: {
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#EF4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
