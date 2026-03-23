// Supplier Types and Interfaces

/**
 * Location accuracy levels
 */
export enum LocationAccuracy {
  EXACT = 'EXACT',
  APPROXIMATE = 'APPROXIMATE',
  CITY = 'CITY',
  REGION = 'REGION',
}

/**
 * Location source types
 */
export enum LocationSource {
  GPS = 'GPS',
  MANUAL = 'MANUAL',
  GEOCODING = 'GEOCODING',
  ADDRESS = 'ADDRESS',
}

/**
 * Bank account types
 */
export enum BankAccountType {
  CHECKING = 'CHECKING',
  SAVINGS = 'SAVINGS',
  INTERBANK = 'INTERBANK',
}

/**
 * Transaction types for debts
 */
export enum TransactionType {
  PURCHASE = 'PURCHASE',
  PAYMENT = 'PAYMENT',
  ADJUSTMENT = 'ADJUSTMENT',
  CREDIT_NOTE = 'CREDIT_NOTE',
  DEBIT_NOTE = 'DEBIT_NOTE',
}

/**
 * Payment status
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  CANCELLED = 'CANCELLED',
}

/**
 * Supplier Types - v1.1.0
 * Categorización de proveedores según el tipo de bien o servicio que proveen
 */
export enum SupplierType {
  MERCHANDISE = 'MERCHANDISE',    // Mercadería/Productos
  SERVICES = 'SERVICES',          // Servicios profesionales
  UTILITIES = 'UTILITIES',        // Servicios públicos (luz, agua, internet)
  RENT = 'RENT',                  // Alquiler/Arrendamiento
  PAYROLL = 'PAYROLL',            // Nómina/Planilla
  TAXES = 'TAXES',                // Impuestos y tributos
  LOANS = 'LOANS',                // Préstamos y financiamiento
  INSURANCE = 'INSURANCE',        // Seguros
  MAINTENANCE = 'MAINTENANCE',    // Mantenimiento
  TRANSPORT = 'TRANSPORT',        // Transporte y logística
  OTHER = 'OTHER',                // Otros
}

/**
 * Supplier Legal Entity (Razón Social)
 */
export interface SupplierLegalEntity {
  id: string;
  supplierId: string;
  legalName: string;
  ruc: string;
  taxAddress: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Supplier Contact
 */
export interface SupplierContact {
  id: string;
  supplierId: string;
  fullName: string;
  position?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Supplier Bank Account
 */
export interface SupplierBankAccount {
  id: string;
  supplierId: string;
  supplierLegalEntityId: string;
  bankName: string;
  accountNumber: string;
  accountType: BankAccountType;
  cci?: string;
  accountHolderName: string;
  accountHolderRuc: string;
  isPreferred: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  legalEntity?: SupplierLegalEntity;
}

/**
 * Payment Method
 */
export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  requiresBankAccount: boolean;
  requiresReference: boolean;
  requiresApproval: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Supplier Company Debt
 */
export interface SupplierCompanyDebt {
  supplierId: string;
  companyId: string;
  supplierLegalEntityId: string;
  totalDebtCents: number;
  lastPurchaseDate?: string;
  lastPaymentDate?: string;
  createdAt: string;
  updatedAt: string;
  company?: {
    id: string;
    name: string;
    ruc?: string;
  };
  legalEntity?: SupplierLegalEntity;
}

/**
 * Supplier Unassigned Balance
 */
export interface SupplierUnassignedBalance {
  supplierId: string;
  unassignedBalanceCents: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Supplier Debt Transaction
 */
export interface SupplierDebtTransaction {
  id: string;
  transactionNumber: string;
  supplierId: string;
  companyId?: string;
  supplierLegalEntityId?: string;
  transactionType: TransactionType;
  amountCents: number;
  balanceAfterCents?: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  transactionDate: string;
  dueDate?: string;
  notes?: string;
  attachmentFileId?: string;
  bankName?: string;
  bankAccountNumber?: string;
  createdById: string;
  assignedById?: string;
  assignedAt?: string;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
  company?: {
    id: string;
    name: string;
    ruc?: string;
  };
  legalEntity?: SupplierLegalEntity;
  createdBy?: {
    id: string;
    name?: string;
    email: string;
  };
}

/**
 * Supplier Payment
 */
export interface SupplierPayment {
  id: string;
  supplierId: string;
  companyId?: string;
  supplierLegalEntityId: string;
  amountCents: number;
  paymentMethodId: string;
  supplierBankAccountId?: string;
  transactionReference?: string;
  paymentDate: string;
  status: PaymentStatus;
  notes?: string;
  createdById: string;
  approvedById?: string;
  approvedAt?: string;
  assignedById?: string;
  assignedAt?: string;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
  company?: {
    id: string;
    name: string;
    ruc?: string;
  };
  legalEntity?: SupplierLegalEntity;
  paymentMethod?: PaymentMethod;
  bankAccount?: SupplierBankAccount;
  createdBy?: {
    id: string;
    name?: string;
    email: string;
  };
}

/**
 * Main Supplier Entity - v1.1.0
 * Actualizado con tipos de proveedor y campos universales
 */
export interface Supplier {
  id: string;
  code: string;
  commercialName: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  district?: string;
  province?: string;
  department?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: LocationAccuracy;
  locationSource?: LocationSource;
  paymentTermsDays?: number;
  creditLimitCents?: number;
  notes?: string;
  isActive: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;

  // ============================================
  // NUEVOS CAMPOS v1.1.0 - Tipos de Proveedor
  // ============================================

  /**
   * Tipos de proveedor (puede tener múltiples)
   * Ejemplo: ["MERCHANDISE", "SERVICES"]
   */
  supplierTypes?: SupplierType[];

  /**
   * Tipo principal de proveedor
   * Usado para clasificación y reportes
   */
  primaryType?: SupplierType;

  // ============================================
  // CAMPOS UNIVERSALES (14 campos)
  // ============================================

  /**
   * Categoría del proveedor
   * Ejemplo: "Materiales de Construcción", "Servicios de Limpieza"
   */
  category?: string;

  /**
   * Subcategoría del proveedor
   * Ejemplo: "Cemento y Agregados", "Limpieza de Oficinas"
   */
  subcategory?: string;

  /**
   * Sitio web del proveedor
   */
  website?: string;

  /**
   * Número de cuenta del proveedor
   * Código interno de la empresa para este proveedor
   */
  accountNumber?: string;

  /**
   * Frecuencia de pago
   * Ejemplo: "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"
   */
  paymentFrequency?: string;

  /**
   * Método de pago preferido
   * Ejemplo: "TRANSFER", "CHECK", "CASH", "CARD"
   */
  preferredPaymentMethod?: string;

  /**
   * Moneda preferida
   * Ejemplo: "PEN", "USD", "EUR"
   */
  preferredCurrency?: string;

  /**
   * Calificación del proveedor (1-5)
   */
  rating?: number;

  /**
   * Certificaciones del proveedor
   * Ejemplo: ["ISO 9001", "ISO 14001"]
   */
  certifications?: string[];

  /**
   * Número de licencia del proveedor
   */
  licenseNumber?: string;

  /**
   * Fecha de vencimiento de la licencia
   */
  licenseExpiryDate?: string;

  /**
   * Número de póliza de seguro
   */
  insurancePolicyNumber?: string;

  /**
   * Fecha de vencimiento del seguro
   */
  insuranceExpiryDate?: string;

  /**
   * Etiquetas personalizadas
   * Ejemplo: ["VIP", "Proveedor Crítico", "Descuento Especial"]
   */
  tags?: string[];

  // ============================================
  // Relaciones
  // ============================================
  legalEntities?: SupplierLegalEntity[];
  contacts?: SupplierContact[];
  bankAccounts?: SupplierBankAccount[];
  companyDebts?: SupplierCompanyDebt[];
  unassignedBalance?: SupplierUnassignedBalance;

  // ============================================
  // Campos de conveniencia (de la entidad legal primaria)
  // ============================================
  legalName?: string;
  ruc?: string;
}

// ============================================
// Request/Response Types
// ============================================

/**
 * Create Supplier Legal Entity DTO
 */
export interface CreateSupplierLegalEntityDto {
  legalName: string;
  ruc: string;
  taxAddress: string;
  isPrimary: boolean;
}

/**
 * Create Supplier Contact DTO
 */
export interface CreateSupplierContactDto {
  fullName: string;
  position?: string;
  email?: string;
  phone?: string;
  isPrimary: boolean;
}

/**
 * Create Supplier Request - v1.1.0
 * Actualizado con tipos de proveedor y campos universales
 */
export interface CreateSupplierRequest {
  code: string;
  commercialName: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  district?: string;
  province?: string;
  department?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: LocationAccuracy;
  locationSource?: LocationSource;
  paymentTermsDays?: number;
  creditLimitCents?: number;
  notes?: string;
  isActive?: boolean;

  // Nuevos campos v1.1.0
  supplierTypes?: SupplierType[];
  primaryType?: SupplierType;
  category?: string;
  subcategory?: string;
  website?: string;
  accountNumber?: string;
  paymentFrequency?: string;
  preferredPaymentMethod?: string;
  preferredCurrency?: string;
  rating?: number;
  certifications?: string[];
  licenseNumber?: string;
  licenseExpiryDate?: string;
  insurancePolicyNumber?: string;
  insuranceExpiryDate?: string;
  tags?: string[];

  legalEntities?: CreateSupplierLegalEntityDto[];
  contacts?: CreateSupplierContactDto[];
}

/**
 * Update Supplier Request - v1.1.0
 * Actualizado con tipos de proveedor y campos universales
 */
export interface UpdateSupplierRequest {
  code?: string;
  commercialName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  district?: string;
  province?: string;
  department?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: LocationAccuracy;
  locationSource?: LocationSource;
  paymentTermsDays?: number;
  creditLimitCents?: number;
  notes?: string;
  isActive?: boolean;

  // Nuevos campos v1.1.0
  supplierTypes?: SupplierType[];
  primaryType?: SupplierType;
  category?: string;
  subcategory?: string;
  website?: string;
  accountNumber?: string;
  paymentFrequency?: string;
  preferredPaymentMethod?: string;
  preferredCurrency?: string;
  rating?: number;
  certifications?: string[];
  licenseNumber?: string;
  licenseExpiryDate?: string;
  insurancePolicyNumber?: string;
  insuranceExpiryDate?: string;
  tags?: string[];
}

/**
 * Query Suppliers Parameters - v1.1.0
 * Actualizado con filtros por tipo de proveedor
 */
export interface QuerySuppliersParams {
  q?: string; // Search in code, commercial name, RUC (alias for query)
  query?: string; // Search in code, commercial name, RUC (backend expects this)
  isActive?: boolean;
  department?: string;
  province?: string;
  district?: string;

  // Nuevos filtros v1.1.0
  primaryType?: SupplierType; // Filtrar por tipo principal
  supplierTypes?: string; // Filtrar por tipos (comma-separated: "MERCHANDISE,SERVICES")
  category?: string; // Filtrar por categoría
  subcategory?: string; // Filtrar por subcategoría
  rating?: number; // Filtrar por calificación mínima
  tags?: string; // Filtrar por etiquetas (comma-separated)

  page?: number;
  limit?: number;
  orderBy?: 'code' | 'commercialName' | 'createdAt' | 'rating';
  orderDir?: 'ASC' | 'DESC';
}

/**
 * Suppliers Response with Pagination
 */
export interface SuppliersResponse {
  data: Supplier[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Create Bank Account Request
 */
export interface CreateBankAccountRequest {
  supplierLegalEntityId: string;
  bankName: string;
  accountNumber: string;
  accountType: BankAccountType;
  cci?: string;
  accountHolderName: string;
  accountHolderRuc: string;
  isPreferred?: boolean;
}

/**
 * Update Bank Account Request
 */
export interface UpdateBankAccountRequest {
  bankName?: string;
  accountNumber?: string;
  accountType?: BankAccountType;
  cci?: string;
  accountHolderName?: string;
  accountHolderRuc?: string;
  isPreferred?: boolean;
  isActive?: boolean;
}

/**
 * Update Legal Entity Request
 */
export interface UpdateLegalEntityRequest {
  legalName?: string;
  ruc?: string;
  taxAddress?: string;
  isPrimary?: boolean;
}

/**
 * Update Contact Request
 */
export interface UpdateContactRequest {
  fullName?: string;
  position?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

/**
 * Create Debt Transaction Request
 */
export interface CreateDebtTransactionRequest {
  companyId?: string;
  supplierLegalEntityId?: string;
  transactionType: TransactionType;
  amountCents: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  transactionDate?: string;
  dueDate?: string;
  notes?: string;
  attachmentFilePath?: string;
  bankName?: string;
  bankAccountNumber?: string;
}

/**
 * Update Debt Transaction Request
 */
export interface UpdateDebtTransactionRequest {
  companyId?: string;
  supplierLegalEntityId?: string;
  transactionType?: TransactionType;
  amountCents?: number;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  transactionDate?: string;
  dueDate?: string;
  notes?: string;
  attachmentFilePath?: string;
  bankName?: string;
  bankAccountNumber?: string;
}

/**
 * Assign Company Request
 */
export interface AssignCompanyRequest {
  companyId: string;
}

/**
 * Create Payment Request
 */
export interface CreatePaymentRequest {
  companyId?: string;
  supplierLegalEntityId: string;
  amountCents: number;
  paymentMethodId: string;
  supplierBankAccountId?: string;
  transactionReference?: string;
  paymentDate: string;
  notes?: string;
}

/**
 * Debt Summary by Company
 */
export interface DebtByCompany {
  companyId: string;
  companyName: string;
  legalEntity: {
    id: string;
    legalName: string;
    ruc: string;
  };
  totalDebtCents: number;
  lastPurchaseDate?: string;
  lastPaymentDate?: string;
}

/**
 * Supplier Debt Summary Response
 */
export interface SupplierDebtSummaryResponse {
  supplierId: string;
  commercialName: string;
  totalDebtAllCompaniesCents: number;
  unassignedBalanceCents: number;
  totalBalanceCents: number;
  debtByCompany: DebtByCompany[];
}

/**
 * Create Payment Method Request
 */
export interface CreatePaymentMethodRequest {
  code: string;
  name: string;
  requiresBankAccount?: boolean;
  requiresReference?: boolean;
  requiresApproval?: boolean;
  isActive?: boolean;
}

/**
 * Update Payment Method Request
 */
export interface UpdatePaymentMethodRequest {
  code?: string;
  name?: string;
  requiresBankAccount?: boolean;
  requiresReference?: boolean;
  requiresApproval?: boolean;
  isActive?: boolean;
}

/**
 * Query Transactions Parameters
 */
export interface QueryTransactionsParams {
  companyId?: string;
  supplierLegalEntityId?: string;
  transactionType?: TransactionType;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/**
 * Query Payments Parameters
 */
export interface QueryPaymentsParams {
  companyId?: string;
  supplierLegalEntityId?: string;
  paymentMethodId?: string;
  status?: PaymentStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/**
 * Transactions Response with Pagination
 */
export interface TransactionsResponse {
  data: SupplierDebtTransaction[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Payments Response with Pagination
 */
export interface PaymentsResponse {
  data: SupplierPayment[];
  total: number;
  page: number;
  limit: number;
}
