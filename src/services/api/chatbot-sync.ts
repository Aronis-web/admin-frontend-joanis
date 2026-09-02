import { apiClient } from './client';
import type {
  PinSellableBody,
  PriceTier,
  SellableProduct,
  SyncRule,
  SyncRulePreview,
  SyncSummary,
  UpdatePriceTierBody,
  UpdateSyncRuleBody,
  UpsertPriceTierBody,
  UpsertSyncRuleBody,
} from '@/types/chatbot';

/**
 * Chatbot · Sincronización automática del catálogo vendible.
 *
 * Cubre las rutas `/chatbot/sync/...` documentadas en la guía de backend:
 * reglas de sincronización, previsualización, ejecución (dry-run o firme),
 * escalas de precio manuales por opción vendible y pin de filas.
 *
 * Permiso: `chatbot.catalog.manage`.
 */
class ChatbotSyncService {
  private readonly basePath = '/chatbot/sync';

  // ==========================================================================
  // Reglas
  // ==========================================================================
  async listRules(): Promise<SyncRule[]> {
    return apiClient.get<SyncRule[]>(`${this.basePath}/rules`);
  }

  async getRule(id: string): Promise<SyncRule> {
    return apiClient.get<SyncRule>(`${this.basePath}/rules/${id}`);
  }

  async createRule(body: UpsertSyncRuleBody): Promise<SyncRule> {
    return apiClient.post<SyncRule>(`${this.basePath}/rules`, body);
  }

  async updateRule(id: string, body: UpdateSyncRuleBody): Promise<SyncRule> {
    return apiClient.patch<SyncRule>(`${this.basePath}/rules/${id}`, body);
  }

  async deleteRule(id: string): Promise<void> {
    await apiClient.delete<void>(`${this.basePath}/rules/${id}`);
  }

  /**
   * Previsualiza la selección sin escribir nada en BD.
   * Ideal para mostrar "qué entraría" antes de correr en firme.
   */
  async previewRule(id: string): Promise<SyncRulePreview> {
    return apiClient.get<SyncRulePreview>(`${this.basePath}/rules/${id}/preview`);
  }

  /**
   * Ejecuta la regla ahora. Con `dryRun: true` simula y devuelve el resumen
   * exacto de altas/bajas sin persistir nada.
   */
  async runRule(id: string, dryRun = false): Promise<SyncSummary> {
    const suffix = dryRun ? '?dryRun=true' : '';
    return apiClient.post<SyncSummary>(`${this.basePath}/rules/${id}/run${suffix}`, undefined);
  }

  // ==========================================================================
  // Escalas de precio manuales (tiers)
  // ==========================================================================
  async listTiers(sellableId: string): Promise<PriceTier[]> {
    return apiClient.get<PriceTier[]>(`${this.basePath}/sellables/${sellableId}/tiers`);
  }

  async createTier(sellableId: string, body: UpsertPriceTierBody): Promise<PriceTier> {
    return apiClient.post<PriceTier>(`${this.basePath}/sellables/${sellableId}/tiers`, body);
  }

  async updateTier(tierId: string, body: UpdatePriceTierBody): Promise<PriceTier> {
    return apiClient.patch<PriceTier>(`${this.basePath}/tiers/${tierId}`, body);
  }

  async deleteTier(tierId: string): Promise<void> {
    await apiClient.delete<void>(`${this.basePath}/tiers/${tierId}`);
  }

  // ==========================================================================
  // Pin
  // ==========================================================================
  /**
   * Fija/libera una fila del catálogo. Mientras `pinned: true`, ninguna regla
   * la modifica ni la desactiva.
   */
  async pinSellable(sellableId: string, body: PinSellableBody): Promise<SellableProduct> {
    return apiClient.patch<SellableProduct>(`${this.basePath}/sellables/${sellableId}/pin`, body);
  }
}

export const chatbotSyncApi = new ChatbotSyncService();
