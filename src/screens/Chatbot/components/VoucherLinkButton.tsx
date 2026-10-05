/**
 * Botón "🧾 Ver voucher": pide al backend un enlace firmado temporal (15 min,
 * público) y lo abre en el navegador / visor del sistema. Funciona igual en
 * web, Electron y Android/iOS sin depender de descargar la imagen con token.
 */
import React, { useState } from 'react';
import { Linking, Platform } from 'react-native';

import { Button } from '@/design-system';
import { chatbotOrdersApi } from '@/services/api/chatbot-orders';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';

const errorMessage = (err: unknown): string => {
  const e = err as { response?: { data?: { message?: unknown } }; message?: string } | null;
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join('\n');
  if (typeof msg === 'string' && msg.trim()) return msg;
  return 'No se pudo abrir el voucher. Inténtalo otra vez.';
};

export const VoucherLinkButton: React.FC<{
  /** Voucher de la conversación. */
  voucherId?: string;
  /** Voucher guardado en el pedido (si no hay `voucherId`). */
  orderId?: string;
  title?: string;
}> = ({ voucherId, orderId, title = '🧾 Ver voucher' }) => {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    if (!voucherId && !orderId) return;
    setLoading(true);
    try {
      const { url } = voucherId
        ? await chatbotOrdersApi.voucherLink(voucherId)
        : await chatbotOrdersApi.orderVoucherLink(orderId as string);
      if (!url) throw new Error('Sin enlace');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      logger.error('Error abriendo voucher', err);
      Alert.alert('Voucher', errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      title={title}
      variant="outline"
      size="small"
      onPress={() => open()}
      loading={loading}
      disabled={loading}
    />
  );
};
