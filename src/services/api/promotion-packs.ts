import { apiClient } from './client';
import type {
  AdminPackView,
  CreatePackBody,
  PackPreview,
  UpdatePackBody,
} from '@/types/promotions';

/**
 * Promociones · Packs API Service
 *
 * Base path: `/promotions/packs`.
 */
class PromotionPacksService {
  private readonly basePath = '/promotions/packs';

  /** GET /promotions/packs */
  async list(): Promise<AdminPackView[]> {
    return apiClient.get<AdminPackView[]>(this.basePath);
  }

  /** GET /promotions/packs/:id */
  async get(id: string): Promise<AdminPackView> {
    return apiClient.get<AdminPackView>(`${this.basePath}/${id}`);
  }

  /** GET /promotions/packs/:id/preview */
  async preview(id: string): Promise<PackPreview> {
    return apiClient.get<PackPreview>(`${this.basePath}/${id}/preview`);
  }

  /** POST /promotions/packs */
  async create(body: CreatePackBody): Promise<AdminPackView> {
    return apiClient.post<AdminPackView>(this.basePath, body);
  }

  /** PATCH /promotions/packs/:id */
  async update(id: string, body: UpdatePackBody): Promise<AdminPackView> {
    return apiClient.patch<AdminPackView>(`${this.basePath}/${id}`, body);
  }

  /** PATCH /promotions/packs/:id/active */
  async setActive(id: string, isActive: boolean): Promise<AdminPackView> {
    return apiClient.patch<AdminPackView>(`${this.basePath}/${id}/active`, { isActive });
  }

  /** DELETE /promotions/packs/:id */
  async remove(id: string): Promise<void> {
    await apiClient.delete<void>(`${this.basePath}/${id}`);
  }
}

export const promotionPacksApi = new PromotionPacksService();
