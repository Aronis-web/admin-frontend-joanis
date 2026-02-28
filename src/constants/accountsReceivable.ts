import { AccountReceivableStatus, AccountReceivableSourceType, DebtorType } from '@/types/accounts-receivable';

/**
 * Status Labels
 */
export const ACCOUNT_RECEIVABLE_STATUS_LABELS: Record<AccountReceivableStatus, string> = {
  [AccountReceivableStatus.PENDING]: 'Pendiente',
  [AccountReceivableStatus.PARTIAL]: 'Cobro Parcial',
  [AccountReceivableStatus.PAID]: 'Cobrado',
  [AccountReceivableStatus.OVERDUE]: 'Vencido',
  [AccountReceivableStatus.CANCELLED]: 'Cancelado',
  [AccountReceivableStatus.DISPUTED]: 'En Disputa',
};

/**
 * Status Colors
 */
export const ACCOUNT_RECEIVABLE_STATUS_COLORS: Record<AccountReceivableStatus, string> = {
  [AccountReceivableStatus.PENDING]: '#3B82F6',
  [AccountReceivableStatus.PARTIAL]: '#8B5CF6',
  [AccountReceivableStatus.PAID]: '#10B981',
  [AccountReceivableStatus.OVERDUE]: '#EF4444',
  [AccountReceivableStatus.CANCELLED]: '#6B7280',
  [AccountReceivableStatus.DISPUTED]: '#F97316',
};

/**
 * Status Icons
 */
export const ACCOUNT_RECEIVABLE_STATUS_ICONS: Record<AccountReceivableStatus, string> = {
  [AccountReceivableStatus.PENDING]: '⏰',
  [AccountReceivableStatus.PARTIAL]: '💰',
  [AccountReceivableStatus.PAID]: '✔️',
  [AccountReceivableStatus.OVERDUE]: '⚠️',
  [AccountReceivableStatus.CANCELLED]: '❌',
  [AccountReceivableStatus.DISPUTED]: '⚡',
};

/**
 * Source Type Labels
 */
export const SOURCE_TYPE_LABELS: Record<AccountReceivableSourceType, string> = {
  [AccountReceivableSourceType.SALE]: 'Venta',
  [AccountReceivableSourceType.FRANCHISE_DELIVERY]: 'Entrega Franquicia',
  [AccountReceivableSourceType.CAMPAIGN_DELIVERY]: 'Entrega Campaña',
  [AccountReceivableSourceType.SERVICE]: 'Servicio',
  [AccountReceivableSourceType.RENTAL]: 'Alquiler',
  [AccountReceivableSourceType.COMMISSION]: 'Comisión',
  [AccountReceivableSourceType.LOAN]: 'Préstamo',
  [AccountReceivableSourceType.INTEREST]: 'Interés',
  [AccountReceivableSourceType.OTHER]: 'Otros',
};

/**
 * Source Type Icons
 */
export const SOURCE_TYPE_ICONS: Record<AccountReceivableSourceType, string> = {
  [AccountReceivableSourceType.SALE]: '🛒',
  [AccountReceivableSourceType.FRANCHISE_DELIVERY]: '🏪',
  [AccountReceivableSourceType.CAMPAIGN_DELIVERY]: '📦',
  [AccountReceivableSourceType.SERVICE]: '🔧',
  [AccountReceivableSourceType.RENTAL]: '🏠',
  [AccountReceivableSourceType.COMMISSION]: '💼',
  [AccountReceivableSourceType.LOAN]: '🏦',
  [AccountReceivableSourceType.INTEREST]: '📈',
  [AccountReceivableSourceType.OTHER]: '📋',
};

/**
 * Debtor Type Labels
 */
export const DEBTOR_TYPE_LABELS: Record<DebtorType, string> = {
  [DebtorType.CUSTOMER]: 'Cliente',
  [DebtorType.COMPANY]: 'Empresa',
  [DebtorType.FRANCHISE]: 'Franquicia',
  [DebtorType.EMPLOYEE]: 'Empleado',
  [DebtorType.OTHER]: 'Otros',
};

/**
 * Debtor Type Icons
 */
export const DEBTOR_TYPE_ICONS: Record<DebtorType, string> = {
  [DebtorType.CUSTOMER]: '👤',
  [DebtorType.COMPANY]: '🏢',
  [DebtorType.FRANCHISE]: '🏪',
  [DebtorType.EMPLOYEE]: '👨‍💼',
  [DebtorType.OTHER]: '📌',
};

/**
 * Currency Symbols
 */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  PEN: 'S/',
  USD: '$',
  EUR: '€',
};

/**
 * Currency Labels
 */
export const CURRENCY_LABELS: Record<string, string> = {
  PEN: 'Soles',
  USD: 'Dólares',
  EUR: 'Euros',
};
