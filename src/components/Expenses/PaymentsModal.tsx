import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { expensesService, filesApi } from '@/services/api';
import { PaymentCard } from './PaymentCard';
import { ImageViewerModal } from './ImageViewerModal';

interface PaymentsModalProps {
  visible: boolean;
  expenseId: string | null;
  expenseCode?: string;
  onClose: () => void;
}

export const PaymentsModal: React.FC<PaymentsModalProps> = ({
  visible,
  expenseId,
  expenseCode,
  onClose,
}) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; fileName: string } | null>(null);

  useEffect(() => {
    if (visible && expenseId) {
      loadPayments();
    } else if (!visible) {
      // Reset state when modal closes
      setPayments([]);
    }
  }, [visible, expenseId]);

  const loadPayments = async () => {
    if (!expenseId) return;

    try {
      setLoading(true);
      console.log('📥 Fetching payments for expense:', expenseId);
      const paymentsData = await expensesService.getPayments(expenseId);
      console.log('✅ Payments loaded - count:', paymentsData?.length || 0);
      console.log('📊 Payments data type:', typeof paymentsData);
      console.log('📊 Is array?:', Array.isArray(paymentsData));
      console.log('📊 Full response:', JSON.stringify(paymentsData, null, 2));

      if (Array.isArray(paymentsData)) {
        setPayments(paymentsData);
      } else if (paymentsData && typeof paymentsData === 'object') {
        // Check if response is wrapped in a data property
        console.log('🔍 Checking for wrapped data...');
        if ((paymentsData as any).data && Array.isArray((paymentsData as any).data)) {
          console.log('✅ Found payments in data property');
          setPayments((paymentsData as any).data);
        } else {
          console.log('⚠️ Response is not an array and has no data property');
          setPayments([]);
        }
      } else {
        console.log('⚠️ Invalid response format');
        setPayments([]);
      }
    } catch (error: any) {
      console.error('❌ Error loading payments:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      Alert.alert('Error', 'No se pudieron cargar los pagos');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAttachment = async (attachment: any) => {
    console.log('🔍 PaymentsModal - handleViewAttachment called with:', {
      attachment,
      hasFileId: !!attachment.fileId,
      hasUrl: !!attachment.url,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    });

    const fileName = attachment.fileName || 'Archivo';

    try {
      // Usar el endpoint de archivos privados con URL firmada
      let url = attachment.url;
      if (!url && attachment.fileId) {
        // El backend generará el token JWT
        url = await filesApi.getPrivateFileUrl(attachment.fileId);
        console.log('🔗 PaymentsModal - Generated signed URL for attachment:', {
          fileId: attachment.fileId,
          url,
        });
      }

      if (!url) {
        console.error('❌ PaymentsModal - No URL available');
        Alert.alert('Error', 'No hay archivo adjunto');
        return;
      }

      const isImage = attachment.mimeType?.startsWith('image/') ||
                      attachment.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

      console.log('🖼️ PaymentsModal - Opening attachment in modal:', {
        fileName,
        url,
        isImage,
        mimeType: attachment.mimeType,
      });

      if (isImage) {
        // Open image in modal with signed URL
        console.log('✅ PaymentsModal - Setting image viewer state:', {
          url,
          fileName,
        });
        setSelectedImage({ url, fileName });
        setImageViewerVisible(true);
        console.log('✅ PaymentsModal - Image viewer should now be visible');
      } else {
        // For PDFs and other files, show alert with option to open externally
        Alert.alert(
          'Abrir Archivo',
          `¿Deseas abrir ${fileName}?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Abrir',
              onPress: async () => {
                const { Linking } = require('react-native');
                const canOpen = await Linking.canOpenURL(url);
                if (canOpen) {
                  await Linking.openURL(url);
                } else {
                  Alert.alert('Error', 'No se pudo abrir el archivo');
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('❌ PaymentsModal - Error handling attachment:', error);
      Alert.alert('Error', 'No se pudo abrir el archivo');
    }
  };

  const formatAmount = (cents: number | string) => {
    const centsNumber = typeof cents === 'string' ? parseInt(cents, 10) : cents;
    const amount = centsNumber / 100;
    return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTotalPaid = () => {
    return payments.reduce((sum, payment) => {
      const amountCents = typeof payment.amountCents === 'string'
        ? parseInt(payment.amountCents, 10)
        : payment.amountCents;
      return sum + (amountCents || 0);
    }, 0);
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>Pagos Registrados</Text>
                {expenseCode && (
                  <Text style={styles.headerSubtitle}>{expenseCode}</Text>
                )}
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={28} color="#1E293B" />
              </TouchableOpacity>
            </View>

            {/* Summary */}
            {payments.length > 0 && (
              <View style={styles.summary}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Total de Pagos</Text>
                  <Text style={styles.summaryValue}>{payments.length}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Monto Total</Text>
                  <Text style={styles.summaryValueAmount}>{formatAmount(getTotalPaid())}</Text>
                </View>
              </View>
            )}

            {/* Content */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#6366F1" />
                  <Text style={styles.loadingText}>Cargando pagos...</Text>
                </View>
              ) : payments.length > 0 ? (
                <>
                  <Text style={styles.debugText}>Mostrando {payments.length} pagos</Text>
                  {payments.map((payment, index) => {
                    console.log(`🎴 Rendering payment ${index + 1}:`, payment.id);
                    console.log(`📋 Payment ${index + 1} data:`, JSON.stringify(payment, null, 2));
                    return (
                      <PaymentCard
                        key={payment.id}
                        payment={payment}
                        onViewAttachment={handleViewAttachment}
                      />
                    );
                  })}
                  <Text style={styles.debugText}>✅ Fin de la lista de pagos</Text>
                </>
              ) : (
                <View style={styles.emptyContainer}>
                  <Ionicons name="receipt-outline" size={64} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No hay pagos registrados</Text>
                  <Text style={styles.debugText}>Payments array length: {payments.length}</Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.closeFooterButton} onPress={onClose}>
                <Text style={styles.closeFooterButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      <ImageViewerModal
        visible={imageViewerVisible}
        imageUrl={selectedImage?.url || null}
        fileName={selectedImage?.fileName}
        onClose={() => {
          setImageViewerVisible(false);
          setSelectedImage(null);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
    marginLeft: 12,
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 16,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  summaryValueAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  scrollView: {
    flex: 1,
    minHeight: 200,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
  },
  debugText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  closeFooterButton: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closeFooterButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
});

export default PaymentsModal;
