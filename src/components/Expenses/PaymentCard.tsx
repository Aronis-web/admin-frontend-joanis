import React, { useState } from 'react';
import Alert from '@/utils/alert';
import { View, Text, StyleSheet, TouchableOpacity, Linking} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ExpensePayment,
  PaymentAttachment,
  PaymentStatusLabels,
  PaymentStatusColors,
  PaymentMethodLabels,
} from '@/types/expenses';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { ImageViewerModal } from './ImageViewerModal';
import { filesApi } from '@/services/api';

// Design System
import { useTheme, useThemedStyles } from '@/design-system/themes';
import type { Theme } from '@/design-system/themes';

interface PaymentCardProps {
  payment: ExpensePayment;
  onPress?: (payment: ExpensePayment) => void;
  onViewAttachment?: (attachment: PaymentAttachment) => void;
}

export const PaymentCard: React.FC<PaymentCardProps> = ({ payment, onPress, onViewAttachment }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ fileId: string; fileName: string } | null>(null);
  console.log('💳 PaymentCard rendering with payment:', {
    id: payment.id,
    paymentNumber: (payment as any).paymentNumber,
    amountCents: payment.amountCents,
    amountCentsType: typeof payment.amountCents,
    paymentMethod: payment.paymentMethod,
    bankName: payment.bankName,
    attachmentFileId: payment.attachmentFileId,
    hasAttachmentFile: !!payment.attachmentFile,
    attachmentFile: payment.attachmentFile,
    attachmentsCount: payment.attachments?.length || 0,
    attachments: payment.attachments,
  });

  const formatDate = (dateString?: string | null) => {
    if (!dateString) {
      return '-';
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatAmount = (cents: number | string) => {
    const centsNumber = typeof cents === 'string' ? parseInt(cents, 10) : cents;
    const amount = centsNumber / 100;
    return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getAttachmentUrl = async (attachment: PaymentAttachment): Promise<string> => {
    // Si ya tiene URL, usarla
    if (attachment.url) {
      return attachment.url;
    }

    // Usar el endpoint de archivos privados con URL firmada
    // El fileId viene como: "expenses\\pagos\\uuid\\archivo.jpg"
    // El backend generará el token JWT
    const url = await filesApi.getPrivateFileUrl(attachment.fileId);

    console.log('🔗 Generated signed URL for attachment:', {
      fileId: attachment.fileId,
      url,
    });

    return url;
  };

  const handleViewAttachment = async (attachment: PaymentAttachment) => {
    try {
      console.log('🔍 PaymentCard - handleViewAttachment called with:', {
        attachment,
        hasOnViewAttachment: !!onViewAttachment,
      });

      const fileName = attachment.fileName || 'Archivo';

      // Generar URL firmada
      let url: string;
      try {
        url = await getAttachmentUrl(attachment);
        console.log('🔗 PaymentCard - Generated URL:', url);
      } catch (urlError) {
        console.error('❌ PaymentCard - Error generating URL:', urlError);
        Alert.alert('Error', 'No se pudo generar la URL del archivo');
        return;
      }

      const attachmentWithUrl = {
        ...attachment,
        url,
      };

      // Si hay callback, usarlo
      if (onViewAttachment) {
        console.log('✅ PaymentCard - Calling onViewAttachment callback');
        onViewAttachment(attachmentWithUrl);
        return;
      }

      // Determinar si es imagen
      const isImage =
        attachment.mimeType?.startsWith('image/') ||
        attachment.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

      console.log('🖼️ PaymentCard - Opening attachment:', {
        fileName,
        url,
        isImage,
        mimeType: attachment.mimeType,
      });

      if (isImage) {
        // Abrir imagen en modal dentro de la app
        // Pasar fileId en lugar de URL para que el modal genere una URL firmada fresca
        console.log('✅ PaymentCard - Opening image in modal with fileId:', attachment.fileId);
        setSelectedImage({ fileId: attachment.fileId, fileName });
        setImageViewerVisible(true);
      } else {
        // Para PDFs y otros archivos, mostrar alerta con opción de abrir externamente
        Alert.alert('Abrir Archivo', `¿Deseas abrir ${fileName}?`, [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Abrir',
            onPress: async () => {
              const canOpen = await Linking.canOpenURL(url);
              if (canOpen) {
                await Linking.openURL(url);
              } else {
                Alert.alert('Error', 'No se pudo abrir el archivo');
              }
            },
          },
        ]);
      }
    } catch (error) {
      console.error('❌ PaymentCard - Error in handleViewAttachment:', error);
      Alert.alert('Error', 'No se pudo abrir el archivo');
    }
  };

  const getFileIcon = (attachment: PaymentAttachment) => {
    const mimeType = attachment.mimeType || '';
    const fileName = attachment.fileName || '';

    if (mimeType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return 'image';
    } else if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return 'document-text';
    } else {
      return 'document-attach';
    }
  };

  const getFileTypeLabel = (attachment: PaymentAttachment) => {
    const mimeType = attachment.mimeType || '';
    const fileName = attachment.fileName || '';

    if (attachment.fileType === 'RECEIPT') {
      return 'Comprobante';
    } else if (attachment.fileType === 'INVOICE') {
      return 'Factura';
    }

    if (mimeType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return 'Ver Foto';
    } else if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return 'Ver PDF';
    } else {
      return 'Ver Archivo';
    }
  };

  const CardWrapper = onPress ? TouchableOpacity : View;
  const cardProps = onPress ? { onPress: () => onPress(payment), activeOpacity: 0.7 } : {};

  // Handle both 'code' and 'paymentNumber' fields from backend
  const paymentCode = (payment as any).paymentNumber || payment.code || 'N/A';
  const paymentStatus = payment.status || 'PENDING';

  console.log('🎨 Rendering PaymentCard UI:', {
    paymentCode,
    paymentStatus,
    hasPaymentMethod: !!payment.paymentMethod,
    paymentMethodLabel: PaymentMethodLabels[payment.paymentMethod],
    formattedAmount: formatAmount(payment.amountCents),
    paymentDate: formatDate(payment.paymentDate),
    bankName: payment.bankName,
  });

  try {
    return (
      <CardWrapper style={styles.card} {...cardProps}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.paymentCode}>{paymentCode}</Text>
            <Text style={styles.paymentMethod}>
              {PaymentMethodLabels[payment.paymentMethod] || payment.paymentMethod}
            </Text>
          </View>
          <PaymentStatusBadge status={paymentStatus as any} size="small" />
        </View>

        <View style={styles.divider} />

        <View style={styles.content}>
          <View style={styles.amountContainer}>
            <Text style={styles.amountLabel}>Monto</Text>
            <Text style={styles.amountValue}>{formatAmount(payment.amountCents)}</Text>
          </View>

          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fecha de pago:</Text>
              <Text style={styles.detailValue}>{formatDate(payment.paymentDate)}</Text>
            </View>

            {payment.bankName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Banco:</Text>
                <Text style={styles.detailValue}>{payment.bankName}</Text>
              </View>
            )}

            {payment.transactionReference && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Referencia:</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {payment.transactionReference}
                </Text>
              </View>
            )}

            {payment.notes && (
              <View style={styles.notesContainer}>
                <Text style={styles.notesLabel}>Notas:</Text>
                <Text style={styles.notesText} numberOfLines={2}>
                  {payment.notes}
                </Text>
              </View>
            )}
          </View>

          {/* Attachments Section */}
          {payment.attachments && payment.attachments.length > 0 ? (
            <View style={styles.attachmentsContainer}>
              <Text style={styles.attachmentsTitle}>
                Archivos adjuntos ({payment.attachments.length})
              </Text>
              {payment.attachments.map((attachment, index) => {
                console.log(`📎 Rendering attachment ${index}:`, {
                  id: attachment.id,
                  fileId: attachment.fileId,
                  fileName: attachment.fileName,
                  mimeType: attachment.mimeType,
                  fileType: attachment.fileType,
                });
                return (
                  <TouchableOpacity
                    key={attachment.id || index}
                    style={styles.attachmentButton}
                    onPress={() => {
                      console.log(`👆 Attachment button pressed for: ${attachment.fileName}`);
                      handleViewAttachment(attachment);
                    }}
                  >
                    <Ionicons name={getFileIcon(attachment) as any} size={20} color={theme.color.brand.accent} />
                    <View style={styles.attachmentInfo}>
                      <Text style={styles.attachmentButtonText}>
                        {getFileTypeLabel(attachment)}
                      </Text>
                      <Text style={styles.attachmentFileName} numberOfLines={1}>
                        {attachment.fileName}
                      </Text>
                      {attachment.description && (
                        <Text style={styles.attachmentDescription} numberOfLines={1}>
                          {attachment.description}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="open-outline" size={16} color={theme.color.brand.accent} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : payment.attachmentFile ? (
            <TouchableOpacity
              style={styles.attachmentButton}
              onPress={() =>
                payment.attachmentFile &&
                handleViewAttachment({
                  id: payment.attachmentFile.id,
                  fileId: payment.attachmentFile.url,
                  fileName: payment.attachmentFile.fileName,
                  fileType: 'OTHER',
                  url: payment.attachmentFile.url,
                  mimeType: payment.attachmentFile.mimeType,
                  createdAt: payment.createdAt,
                })
              }
            >
              <Ionicons name="document-attach" size={20} color={theme.color.brand.accent} />
              <Text style={styles.attachmentButtonText}>Ver archivo adjunto</Text>
              <Ionicons name="open-outline" size={16} color={theme.color.brand.accent} />
            </TouchableOpacity>
          ) : (
            <View style={styles.noAttachmentContainer}>
              <Ionicons name="document-outline" size={16} color={theme.color.text.placeholder} />
              <Text style={styles.noAttachmentText}>Sin archivos adjuntos</Text>
            </View>
          )}

          {payment.createdByUser && (
            <View style={styles.footer}>
              <Text style={styles.footerLabel}>Registrado por:</Text>
              <Text style={styles.footerValue}>
                {payment.createdByUser.name || payment.createdByUser.email}
              </Text>
            </View>
          )}
        </View>

        {/* Image Viewer Modal */}
        <ImageViewerModal
          visible={imageViewerVisible}
          fileId={selectedImage?.fileId || null}
          fileName={selectedImage?.fileName}
          onClose={() => {
            setImageViewerVisible(false);
            setSelectedImage(null);
          }}
        />
      </CardWrapper>
    );
  } catch (error) {
    console.error('❌ Error rendering PaymentCard:', error);
    return (
      <View style={styles.card}>
        <Text style={{ color: 'red' }}>Error al renderizar el pago</Text>
      </View>
    );
  }
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[3],
      marginBottom: theme.space[2.5],
      ...theme.shadow.sm,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[2],
    },
    headerLeft: {
      flex: 1,
    },
    paymentCode: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.brand.accent,
      marginBottom: theme.space[0.5],
    },
    paymentMethod: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.body,
    },
    divider: {
      height: 1,
      backgroundColor: theme.color.border.subtle,
      marginBottom: theme.space[2],
    },
    content: {
      gap: theme.space[2],
    },
    amountContainer: {
      backgroundColor: theme.color.state.success.background,
      borderRadius: theme.radii.md,
      padding: theme.space[2.5],
      alignItems: 'center',
    },
    amountLabel: {
      fontSize: 10,
      color: theme.color.state.success.text,
      fontWeight: '600',
      marginBottom: theme.space[0.5],
    },
    amountValue: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.state.success.text,
    },
    detailsContainer: {
      gap: theme.space[1.5],
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    detailLabel: {
      fontSize: 12,
      color: theme.color.text.muted,
    },
    detailValue: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.body,
      flex: 1,
      textAlign: 'right',
      marginLeft: theme.space[2],
    },
    notesContainer: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.sm,
      padding: theme.space[2.5],
      marginTop: theme.space[1],
    },
    notesLabel: {
      fontSize: 10,
      color: theme.color.text.subtle,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: theme.space[1],
    },
    notesText: {
      fontSize: 12,
      color: theme.color.text.muted,
      lineHeight: 16,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: theme.space[2],
      borderTopWidth: 1,
      borderTopColor: theme.color.surface.subtle,
    },
    footerLabel: {
      fontSize: 10,
      color: theme.color.text.subtle,
    },
    footerValue: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    attachmentsContainer: {
      marginTop: theme.space[2],
      gap: theme.space[1.5],
    },
    attachmentsTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.color.text.muted,
      textTransform: 'uppercase',
      marginBottom: theme.space[1],
    },
    attachmentButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.brand.accentSoft,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.brand.accent,
      paddingVertical: theme.space[2.5],
      paddingHorizontal: theme.space[3],
      gap: theme.space[2],
    },
    attachmentInfo: {
      flex: 1,
      gap: theme.space[0.5],
    },
    attachmentButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.brand.accent,
    },
    attachmentFileName: {
      fontSize: 11,
      color: theme.color.brand.accent,
      opacity: 0.8,
    },
    attachmentDescription: {
      fontSize: 10,
      color: theme.color.brand.accent,
      opacity: 0.6,
      fontStyle: 'italic',
    },
    noAttachmentContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      borderStyle: 'dashed',
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[3],
      gap: theme.space[1.5],
      marginTop: theme.space[1],
    },
    noAttachmentText: {
      fontSize: 12,
      color: theme.color.text.subtle,
      fontStyle: 'italic',
    },
  });

export default PaymentCard;
