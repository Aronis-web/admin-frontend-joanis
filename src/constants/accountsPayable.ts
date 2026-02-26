import { AccountPayableStatus, AccountPayableSourceType, SupplierType } from '@/types/accounts-payable';

/**
 * Status Labels
 */
export const ACCOUNT_PAYABLE_STATUS_LABELS: Record<AccountPayableStatus, string> = {
  [AccountPayableStatus.DRAFT]: 'Borrador',
  [AccountPayableStatus.PENDING_APPROVAL]: 'Pendiente Aprobación',
  [AccountPayableStatus.APPROVED]: 'Aprobado',
  [AccountPayableStatus.PENDING]: 'Pendiente',
  [AccountPayableStatus.PARTIAL]: 'Pago Parcial',
  [AccountPayableStatus.PAID]: 'Pagado',
  [AccountPayableStatus.OVERDUE]: 'Vencido',
  [AccountPayableStatus.CANCELLED]: 'Cancelado',
  [AccountPayableStatus.DISPUTED]: 'En Disputa',
};

/**
 * Status Colors
 */
export const ACCOUNT_PAYABLE_STATUS_COLORS: Record<AccountPayableStatus, string> = {
  [AccountPayableStatus.DRAFT]: '#94A3B8',
  [AccountPayableStatus.PENDING_APPROVAL]: '#F59E0B',
  [AccountPayableStatus.APPROVED]: '#10B981',
  [AccountPayableStatus.PENDING]: '#3B82F6',
  [AccountPayableStatus.PARTIAL]: '#8B5CF6',
  [AccountPayableStatus.PAID]: '#10B981',
  [AccountPayableStatus.OVERDUE]: '#EF4444',
  [AccountPayableStatus.CANCELLED]: '#6B7280',
  [AccountPayableStatus.DISPUTED]: '#F97316',
};

/**
 * Status Icons
 */
export const ACCOUNT_PAYABLE_STATUS_ICONS: Record<AccountPayableStatus, string> = {
  [AccountPayableStatus.DRAFT]: '📝',
  [AccountPayableStatus.PENDING_APPROVAL]: '⏳',
  [AccountPayableStatus.APPROVED]: '✅',
  [AccountPayableStatus.PENDING]: '⏰',
  [AccountPayableStatus.PARTIAL]: '💰',
  [AccountPayableStatus.PAID]: '✔️',
  [AccountPayableStatus.OVERDUE]: '⚠️',
  [AccountPayableStatus.CANCELLED]: '❌',
  [AccountPayableStatus.DISPUTED]: '⚡',
};

/**
 * Source Type Labels
 */
export const SOURCE_TYPE_LABELS: Record<AccountPayableSourceType, string> = {
  [AccountPayableSourceType.PURCHASE]: 'Compra',
  [AccountPayableSourceType.EXPENSE]: 'Gasto',
  [AccountPayableSourceType.SERVICE_CONTRACT]: 'Contrato Servicio',
  [AccountPayableSourceType.UTILITY_BILL]: 'Servicio Público',
  [AccountPayableSourceType.INVESTMENT]: 'Inversión',
  [AccountPayableSourceType.ASSET_PURCHASE]: 'Compra Activo',
  [AccountPayableSourceType.LOAN]: 'Préstamo',
  [AccountPayableSourceType.LEASE]: 'Arrendamiento',
  [AccountPayableSourceType.TAX_OBLIGATION]: 'Obligación Tributaria',
  [AccountPayableSourceType.PAYROLL]: 'Nómina',
  [AccountPayableSourceType.INSURANCE]: 'Seguro',
  [AccountPayableSourceType.LICENSE]: 'Licencia',
  [AccountPayableSourceType.SUBSCRIPTION]: 'Suscripción',
  [AccountPayableSourceType.MAINTENANCE]: 'Mantenimiento',
  [AccountPayableSourceType.MARKETING]: 'Marketing',
  [AccountPayableSourceType.PROFESSIONAL_FEES]: 'Honorarios',
  [AccountPayableSourceType.OTHER]: 'Otros',
};

/**
 * Source Type Icons
 */
export const SOURCE_TYPE_ICONS: Record<AccountPayableSourceType, string> = {
  [AccountPayableSourceType.PURCHASE]: '🛒',
  [AccountPayableSourceType.EXPENSE]: '💸',
  [AccountPayableSourceType.SERVICE_CONTRACT]: '📋',
  [AccountPayableSourceType.UTILITY_BILL]: '💡',
  [AccountPayableSourceType.INVESTMENT]: '📈',
  [AccountPayableSourceType.ASSET_PURCHASE]: '🏢',
  [AccountPayableSourceType.LOAN]: '🏦',
  [AccountPayableSourceType.LEASE]: '🏠',
  [AccountPayableSourceType.TAX_OBLIGATION]: '📊',
  [AccountPayableSourceType.PAYROLL]: '👥',
  [AccountPayableSourceType.INSURANCE]: '🛡️',
  [AccountPayableSourceType.LICENSE]: '📜',
  [AccountPayableSourceType.SUBSCRIPTION]: '🔄',
  [AccountPayableSourceType.MAINTENANCE]: '🔧',
  [AccountPayableSourceType.MARKETING]: '📢',
  [AccountPayableSourceType.PROFESSIONAL_FEES]: '💼',
  [AccountPayableSourceType.OTHER]: '📦',
};

/**
 * Supplier Type Labels
 */
export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  [SupplierType.MERCHANDISE]: 'Mercadería',
  [SupplierType.SERVICES]: 'Servicios',
  [SupplierType.UTILITIES]: 'Servicios Públicos',
  [SupplierType.TRANSPORT]: 'Transporte',
  [SupplierType.MAINTENANCE]: 'Mantenimiento',
  [SupplierType.PROFESSIONAL]: 'Profesional',
  [SupplierType.SUPPLIES]: 'Suministros',
  [SupplierType.TECHNOLOGY]: 'Tecnología',
  [SupplierType.MARKETING]: 'Marketing',
  [SupplierType.OTHER]: 'Otros',
};

/**
 * Supplier Type Icons
 */
export const SUPPLIER_TYPE_ICONS: Record<SupplierType, string> = {
  [SupplierType.MERCHANDISE]: '📦',
  [SupplierType.SERVICES]: '🔧',
  [SupplierType.UTILITIES]: '💡',
  [SupplierType.TRANSPORT]: '🚚',
  [SupplierType.MAINTENANCE]: '🛠️',
  [SupplierType.PROFESSIONAL]: '💼',
  [SupplierType.SUPPLIES]: '📋',
  [SupplierType.TECHNOLOGY]: '💻',
  [SupplierType.MARKETING]: '📢',
  [SupplierType.OTHER]: '📌',
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
