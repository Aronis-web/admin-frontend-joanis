/**
 * Treasury Types
 *
 * Types for bank operations and treasury management
 */

/**
 * Transaction Direction
 */
export enum TransactionDirection {
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
}

/**
 * Movement Types - Income
 */
export enum IncomeMovementType {
  ABONO_TRANSFERENCIA = 'ABONO_TRANSFERENCIA',
  DEP_EFECTIVO = 'DEP_EFECTIVO',
  TRAN_INTERNA_ABONO = 'TRAN_INTERNA_ABONO',
  ABONO_CHEQUE = 'ABONO_CHEQUE',
  INTERES_GANADO = 'INTERES_GANADO',
  DEVOLUCION = 'DEVOLUCION',
  OTRO_ABONO = 'OTRO_ABONO',
}

/**
 * Movement Types - Expense
 */
export enum ExpenseMovementType {
  CARGO_TRANSFERENCIA = 'CARGO_TRANSFERENCIA',
  TRAN_INTERNA_CARGO = 'TRAN_INTERNA_CARGO',
  PAGO_MASIVO_PROVEEDORES = 'PAGO_MASIVO_PROVEEDORES',
  PAGO_PLANILLAS = 'PAGO_PLANILLAS',
  RETIRO_EFECTIVO = 'RETIRO_EFECTIVO',
  PAGO_CHEQUE = 'PAGO_CHEQUE',
  OTRO_CARGO = 'OTRO_CARGO',
}

/**
 * Movement Types - Commissions
 */
export enum CommissionMovementType {
  ITF = 'ITF',
  COMISION_OPERACION = 'COMISION_OPERACION',
  COMISION_PLANILLA = 'COMISION_PLANILLA',
  COMISION_MANTENIMIENTO = 'COMISION_MANTENIMIENTO',
  COMISION_IBANC = 'COMISION_IBANC',
  NOTA_DEBITO = 'NOTA_DEBITO',
}

/**
 * All Movement Types
 */
export type MovementType =
  | IncomeMovementType
  | ExpenseMovementType
  | CommissionMovementType
  | string;

/**
 * Assignment Status
 */
export enum AssignmentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  ASSIGNED = 'ASSIGNED',
  AUTO_ASSIGNED = 'AUTO_ASSIGNED',
  IGNORED = 'IGNORED',
}

/**
 * Bank Account Info
 */
export interface BankAccountInfo {
  id: string;
  accountNumber: string;
  bankName: string;
  currency: string;
  accountType?: string;
}

/**
 * Transaction Assignment
 */
export interface TransactionAssignment {
  id: string;
  type: string;
  amount: number;
  reference?: string;
}

/**
 * Transfer Type
 */
export enum TransferType {
  INTERNAL_SAME_BANK = 'INTERNAL_SAME_BANK',
  INTERNAL_OTHER_BANK = 'INTERNAL_OTHER_BANK',
  EXTERNAL = 'EXTERNAL',
}

/**
 * Bank Transaction
 */
export interface BankTransaction {
  id: string;
  transactionDate: string;
  direction: TransactionDirection;
  movementType: MovementType;
  amountCents: number;
  description: string;
  counterpartyName?: string;
  operationNumber?: string;
  assignmentStatus: AssignmentStatus;
  bankAccount: BankAccountInfo;
  assignments?: TransactionAssignment[];
  batchNumber?: string;
  createdAt?: string;
  updatedAt?: string;
  // New fields
  bankCode?: string;
  bankName?: string;
  accountAlias?: string;
  accountNumber?: string;
  transferType?: TransferType;
  isOwnCompanyTransfer?: boolean;
}

/**
 * Labels for Transfer Type
 */
export const TRANSFER_TYPE_LABELS: Record<TransferType, string> = {
  [TransferType.INTERNAL_SAME_BANK]: 'Interno mismo banco',
  [TransferType.INTERNAL_OTHER_BANK]: 'Interno otro banco',
  [TransferType.EXTERNAL]: 'Externo',
};

/**
 * Query Parameters for Bank Transactions
 */
export interface QueryBankTransactionsParams {
  bankAccountId?: string;
  companyId?: string;
  startDate?: string;
  endDate?: string;
  direction?: TransactionDirection;
  movementType?: MovementType;
  assignmentStatus?: AssignmentStatus;
  batchNumber?: string;
  search?: string;
  minAmountCents?: number;
  maxAmountCents?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Bank Transactions Response
 */
export interface BankTransactionsResponse {
  data: BankTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Labels for Movement Types
 */
export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  // Income
  ABONO_TRANSFERENCIA: 'Transferencia recibida',
  DEP_EFECTIVO: 'Depósito en efectivo',
  TRAN_INTERNA_ABONO: 'Transferencia interna (abono)',
  ABONO_CHEQUE: 'Depósito de cheque',
  INTERES_GANADO: 'Intereses',
  DEVOLUCION: 'Devolución',
  OTRO_ABONO: 'Otro ingreso',
  // Expense
  CARGO_TRANSFERENCIA: 'Transferencia a terceros',
  TRAN_INTERNA_CARGO: 'Transferencia interna (cargo)',
  PAGO_MASIVO_PROVEEDORES: 'Pago masivo',
  PAGO_PLANILLAS: 'Nómina',
  RETIRO_EFECTIVO: 'Retiro',
  PAGO_CHEQUE: 'Cheque',
  OTRO_CARGO: 'Otro egreso',
  // Commissions
  ITF: 'ITF',
  COMISION_OPERACION: 'Comisión operación',
  COMISION_PLANILLA: 'Comisión planillas',
  COMISION_MANTENIMIENTO: 'Mantenimiento cuenta',
  COMISION_IBANC: 'Comisión banca internet',
  NOTA_DEBITO: 'Nota de débito',
};

/**
 * Labels for Direction
 */
export const DIRECTION_LABELS: Record<TransactionDirection, string> = {
  [TransactionDirection.INGRESO]: 'Ingreso',
  [TransactionDirection.EGRESO]: 'Egreso',
};

/**
 * Labels for Assignment Status
 */
export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  [AssignmentStatus.PENDING]: 'Pendiente',
  [AssignmentStatus.PARTIAL]: 'Parcial',
  [AssignmentStatus.ASSIGNED]: 'Asignado',
  [AssignmentStatus.AUTO_ASSIGNED]: 'Auto-asignado',
  [AssignmentStatus.IGNORED]: 'Ignorado',
};

/**
 * Colors for Direction
 */
export const DIRECTION_COLORS: Record<TransactionDirection, string> = {
  [TransactionDirection.INGRESO]: '#10B981', // green
  [TransactionDirection.EGRESO]: '#EF4444', // red
};

/**
 * Colors for Assignment Status
 */
export const ASSIGNMENT_STATUS_COLORS: Record<AssignmentStatus, string> = {
  [AssignmentStatus.PENDING]: '#F59E0B', // amber
  [AssignmentStatus.PARTIAL]: '#3B82F6', // blue
  [AssignmentStatus.ASSIGNED]: '#10B981', // green
  [AssignmentStatus.AUTO_ASSIGNED]: '#8B5CF6', // purple
  [AssignmentStatus.IGNORED]: '#6B7280', // gray
};

/**
 * Icons for Assignment Status
 */
export const ASSIGNMENT_STATUS_ICONS: Record<AssignmentStatus, string> = {
  [AssignmentStatus.PENDING]: '⏳',
  [AssignmentStatus.PARTIAL]: '◐',
  [AssignmentStatus.ASSIGNED]: '✓',
  [AssignmentStatus.AUTO_ASSIGNED]: '⚡',
  [AssignmentStatus.IGNORED]: '✗',
};

// ==================== Bank Account Types ====================

/**
 * Bank Account Type
 */
export type BankAccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'OTHER';

/**
 * Bank Info
 */
export interface BankInfo {
  id: string;
  code: string;
  name: string;
  shortName: string;
}

/**
 * Bank Account
 */
export interface BankAccount {
  id: string;
  alias: string;
  accountNumber: string;
  cci?: string;
  accountType: BankAccountType;
  currency: string;
  isActive: boolean;
  bank: BankInfo;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Query Parameters for Bank Accounts
 */
export interface QueryBankAccountsParams {
  companyId?: string;
  bankId?: string;
  accountType?: BankAccountType;
  currency?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Bank Accounts Response
 */
export interface BankAccountsResponse {
  data: BankAccount[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Labels for Bank Account Type
 */
export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  CHECKING: 'Cuenta Corriente',
  SAVINGS: 'Cuenta de Ahorros',
  CREDIT: 'Línea de Crédito',
  OTHER: 'Otro',
};
