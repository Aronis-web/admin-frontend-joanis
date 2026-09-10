/**
 * Customer Levels Types
 * Catálogo de niveles comerciales de cliente ("Niveles de Socia").
 *
 * Ver documentación del servicio SVC-ADMIN, endpoints /customers/levels.
 */

export interface CustomerLevel {
  id: string;
  code: string;
  name: string;
  priceProfileId: string | null;
  discountPct: number;
  whatsappEnabled: boolean;
  isDefault: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerLevelRequest {
  code: string;
  name: string;
  priceProfileId?: string | null;
  discountPct?: number;
  whatsappEnabled?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateCustomerLevelRequest = Partial<CreateCustomerLevelRequest>;

export interface GetCustomerLevelsParams {
  activeOnly?: boolean;
}

export interface AssignCustomerLevelRequest {
  customerLevelId: string | null;
}
