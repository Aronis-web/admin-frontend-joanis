/**
 * Balances Types
 *
 * Type definitions for the Balances module
 */

// Balance Types
export enum BalanceType {
  INTERNAL = 'INTERNO',
  EXTERNAL = 'EXTERNO',
}

// Balance Status
export enum BalanceStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CLOSED = 'CLOSED',
}

// Operation Types
export enum OperationType {
  DISTRIBUTED = 'DISTRIBUTED', // Monto repartido (emisor → receptor)
  SOLD = 'SOLD', // Monto vendido por el receptor
  TO_PAY = 'TO_PAY', // Monto que debe pagar el receptor
  PAID = 'PAID', // Monto pagado por el receptor
  RETURNED = 'RETURNED', // Monto devuelto por el receptor al emisor
}

// Payment Methods
export enum PaymentMethod {
  IZIPAY = 'IZIPAY',
  PROSEGUR = 'PROSEGUR',
  TRANSFERENCIA_BANCARIA = 'TRANSFERENCIA_BANCARIA',
}

// Balance Entity
export interface Balance {
  id: string;
  code: string;
  balanceType: BalanceType;
  receiverCompanyId?: string;
  receiverSiteId?: string;
  receiverCompany?: {
    id: string;
    name: string;
  };
  receiverSite?: {
    id: string;
    name: string;
  };
  startDate: string;
  endDate?: string;
  status: BalanceStatus;
  notes?: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// Balance Operation File
export interface BalanceOperationFile {
  id: string;
  operationId: string;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileCategory: string;
  description?: string;
  uploadedBy: string;
  createdAt: string;
  deletedAt?: string;
  signedUrl?: string;
}

// Balance Operation Entity
export interface BalanceOperation {
  id: string;
  balanceId: string;
  balance?: Balance;
  emitterCompanyId?: string;
  emitterSiteId?: string;
  emitterCompany?: {
    id: string;
    name: string;
  };
  emitterSite?: {
    id: string;
    name: string;
  };
  operationType: OperationType;
  amountCents: number;
  currency: string;
  operationDate: string;
  paymentMethod?: PaymentMethod;
  description?: string;
  reference?: string;
  notes?: string;
  files?: BalanceOperationFile[];
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// Balance Summary
export interface BalanceSummary {
  balanceId: string;
  balanceCode: string;
  totalDistributedAmountCents: number;
  totalSoldAmountCents: number;
  totalToPayAmountCents: number;
  totalPaidAmountCents: number;
  totalReturnedAmountCents: number;
  pendingAmountCents: number;
  totalEmitters: number;
  emittersSummary: EmitterSummary[];
}

// Emitter Summary
export interface EmitterSummary {
  emitterCompanyId?: string;
  emitterSiteId?: string;
  emitterCompanyName?: string;
  emitterSiteName?: string;
  distributedAmountCents: number;
  returnedAmountCents: number;
  netAmountCents: number;
  operationCount: number;
}

// Create Balance DTO
export interface CreateBalanceRequest {
  balanceType: BalanceType;
  receiverCompanyId?: string;
  receiverSiteId?: string;
  startDate: string;
  endDate?: string;
  isActive?: boolean;
  notes?: string;
}

// Update Balance DTO
export interface UpdateBalanceRequest {
  balanceType?: BalanceType;
  receiverCompanyId?: string;
  receiverSiteId?: string;
  startDate?: string;
  endDate?: string;
  status?: BalanceStatus;
  notes?: string;
}

// Query Balance DTO
export interface QueryBalanceRequest {
  balanceType?: BalanceType;
  receiverCompanyId?: string;
  receiverSiteId?: string;
  startDate?: string;
  endDate?: string;
  status?: BalanceStatus;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// Balance Operation File DTO
export interface BalanceOperationFileDto {
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileCategory: string;
  description?: string;
}

// Create Balance Operation DTO
export interface CreateBalanceOperationRequest {
  balanceId: string;
  emitterCompanyId?: string;
  emitterSiteId?: string;
  operationType: OperationType;
  amountCents: number;
  currency?: string;
  operationDate: string;
  paymentMethod?: PaymentMethod;
  description?: string;
  reference?: string;
  notes?: string;
  files?: BalanceOperationFileDto[];
}

// Update Balance Operation DTO
export interface UpdateBalanceOperationRequest {
  emitterCompanyId?: string;
  emitterSiteId?: string;
  operationType?: OperationType;
  amountCents?: number;
  currency?: string;
  operationDate?: string;
  description?: string;
  reference?: string;
  notes?: string;
}

// Query Balance Operation DTO
export interface QueryBalanceOperationRequest {
  balanceId?: string;
  emitterCompanyId?: string;
  emitterSiteId?: string;
  operationType?: OperationType;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// Paginated Response
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Helper function to format cents to currency
export const formatCentsToCurrency = (cents: number, currency: string = 'PEN'): string => {
  const amount = cents / 100;
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

// Helper function to convert currency to cents
export const currencyToCents = (amount: number): number => {
  return Math.round(amount * 100);
};

// Helper function to get operation type label
export const getOperationTypeLabel = (type: OperationType): string => {
  const labels: Record<OperationType, string> = {
    [OperationType.DISTRIBUTED]: 'Repartido',
    [OperationType.SOLD]: 'Vendido',
    [OperationType.TO_PAY]: 'Por Pagar',
    [OperationType.PAID]: 'Pagado',
    [OperationType.RETURNED]: 'Devuelto',
  };
  return labels[type];
};

// Helper function to get operation type color
export const getOperationTypeColor = (type: OperationType): string => {
  const colors: Record<OperationType, string> = {
    [OperationType.DISTRIBUTED]: '#0EA5E9', // Blue
    [OperationType.SOLD]: '#10B981', // Green
    [OperationType.TO_PAY]: '#F59E0B', // Orange
    [OperationType.PAID]: '#8B5CF6', // Purple
    [OperationType.RETURNED]: '#EF4444', // Red
  };
  return colors[type];
};

// Helper function to get balance type label
export const getBalanceTypeLabel = (type: BalanceType): string => {
  const labels: Record<BalanceType, string> = {
    [BalanceType.INTERNAL]: 'Interno',
    [BalanceType.EXTERNAL]: 'Externo',
  };
  return labels[type];
};

// Helper function to get balance status label
export const getBalanceStatusLabel = (status: BalanceStatus): string => {
  const labels: Record<BalanceStatus, string> = {
    [BalanceStatus.ACTIVE]: 'Activo',
    [BalanceStatus.INACTIVE]: 'Inactivo',
    [BalanceStatus.CLOSED]: 'Cerrado',
  };
  return labels[status];
};

// Helper function to get balance status color
export const getBalanceStatusColor = (status: BalanceStatus): string => {
  const colors: Record<BalanceStatus, string> = {
    [BalanceStatus.ACTIVE]: '#10B981', // Green
    [BalanceStatus.INACTIVE]: '#F59E0B', // Orange
    [BalanceStatus.CLOSED]: '#6B7280', // Gray
  };
  return colors[status];
};

// Helper function to get payment method label
export const getPaymentMethodLabel = (method: PaymentMethod): string => {
  const labels: Record<PaymentMethod, string> = {
    [PaymentMethod.IZIPAY]: 'Izipay',
    [PaymentMethod.PROSEGUR]: 'Prosegur',
    [PaymentMethod.TRANSFERENCIA_BANCARIA]: 'Transferencia Bancaria',
  };
  return labels[method];
};

// Helper function to check if payment method is required
export const isPaymentMethodRequired = (
  balanceType: BalanceType,
  operationType: OperationType
): boolean => {
  // For EXTERNAL balances, only PAID requires payment method
  if (balanceType === BalanceType.EXTERNAL) {
    return operationType === OperationType.PAID;
  }

  // For INTERNAL balances, SOLD, TO_PAY, and PAID require payment method
  if (balanceType === BalanceType.INTERNAL) {
    return [OperationType.SOLD, OperationType.TO_PAY, OperationType.PAID].includes(operationType);
  }

  return false;
};

// Helper function to get allowed payment methods
export const getAllowedPaymentMethods = (
  balanceType: BalanceType,
  operationType: OperationType
): PaymentMethod[] => {
  // For EXTERNAL balances, only TRANSFERENCIA_BANCARIA is allowed for PAID
  if (balanceType === BalanceType.EXTERNAL && operationType === OperationType.PAID) {
    return [PaymentMethod.TRANSFERENCIA_BANCARIA];
  }

  // For INTERNAL balances, all methods are allowed for SOLD, TO_PAY, and PAID
  if (
    balanceType === BalanceType.INTERNAL &&
    [OperationType.SOLD, OperationType.TO_PAY, OperationType.PAID].includes(operationType)
  ) {
    return [PaymentMethod.IZIPAY, PaymentMethod.PROSEGUR, PaymentMethod.TRANSFERENCIA_BANCARIA];
  }

  return [];
};

// Helper function to check if files are allowed
export const areFilesAllowed = (operationType: OperationType): boolean => {
  return [
    OperationType.PAID,
    OperationType.SOLD,
    OperationType.DISTRIBUTED,
    OperationType.RETURNED,
  ].includes(operationType);
};
