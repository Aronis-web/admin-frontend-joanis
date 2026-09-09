import { apiClient } from './client';
import type { NotifWaQrResponse, NotifWaSessionStatus } from '@/types/notifications-whatsapp';

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

  async logout(): Promise<NotifWaSessionStatus> {
    return apiClient.post<NotifWaSessionStatus>(`${this.basePath}/logout`, {});
  }
}

export const notificationsWhatsappApi = new NotificationsWhatsappService();
