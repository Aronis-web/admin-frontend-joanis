import { apiClient } from './client';
import type {
  NotifWaPairResponse,
  NotifWaQrResponse,
  NotifWaSessionStatus,
} from '@/types/notifications-whatsapp';

/**
 * WhatsApp de Notificaciones · Sesión API Service
 *
 * Gestiona el número saliente de notificaciones (independiente del chatbot de
 * ventas). Todos los endpoints requieren el permiso
 * `notifications.whatsapp.session.manage`.
 *
 * Base path: `/notifications/whatsapp`.
 */
class NotificationsWhatsappService {
  private readonly basePath = '/notifications/whatsapp';

  async getStatus(): Promise<NotifWaSessionStatus> {
    return apiClient.get<NotifWaSessionStatus>(`${this.basePath}/status`);
  }

  async getQr(): Promise<NotifWaQrResponse> {
    return apiClient.get<NotifWaQrResponse>(`${this.basePath}/qr`);
  }

  async start(): Promise<NotifWaSessionStatus> {
    return apiClient.post<NotifWaSessionStatus>(`${this.basePath}/start`, {});
  }

  /** Pide el código para vincular el número sin QR ("Vincular con número de teléfono"). */
  async pair(phone: string): Promise<NotifWaPairResponse> {
    return apiClient.post<NotifWaPairResponse>(`${this.basePath}/pair`, { phone });
  }

  async logout(): Promise<NotifWaSessionStatus> {
    return apiClient.post<NotifWaSessionStatus>(`${this.basePath}/logout`, {});
  }
}

export const notificationsWhatsappApi = new NotificationsWhatsappService();
