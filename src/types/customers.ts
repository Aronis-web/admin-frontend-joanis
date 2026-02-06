/**
 * Customer Types
 * Types for the Customers module (Personas Naturales y Empresas)
 */

/**
 * Customer Type Enum
 */
export enum CustomerType {
  PERSONA = 'PERSONA',
  EMPRESA = 'EMPRESA',
}

/**
 * Document Type Enum
 */
export enum DocumentType {
  DNI = 'DNI',
  RUC = 'RUC',
  CE = 'CE',
  PASSPORT = 'PASSPORT',
}

/**
 * Customer Status Enum
 */
export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

/**
 * Customer Interface
 */
export interface Customer {
  id: string;
  customerType: CustomerType;
  documentType: DocumentType;
  documentNumber: string;

  // Campos para PERSONA NATURAL
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;

  // Campos para EMPRESA
  razonSocial?: string;
  nombreComercial?: string;

  fullName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  direccion?: string;
  distrito?: string;
  departamento?: string;
  provincia?: string;
  country: string;
  aceptaPublicidad: boolean;
  status: CustomerStatus;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/**
 * Create Customer Request
 */
export interface CreateCustomerRequest {
  customerType: CustomerType;
  documentType: DocumentType;
  documentNumber: string;

  // Campos para PERSONA NATURAL
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;

  // Campos para EMPRESA
  razonSocial?: string;
  nombreComercial?: string;

  email?: string;
  phone?: string;
  mobile?: string;
  direccion?: string;
  distrito?: string;
  departamento?: string;
  provincia?: string;
  country?: string;
  aceptaPublicidad?: boolean;
  notes?: string;
}

/**
 * Update Customer Request
 */
export interface UpdateCustomerRequest {
  customerType?: CustomerType;
  documentType?: DocumentType;
  documentNumber?: string;

  // Campos para PERSONA NATURAL
  nombres?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;

  // Campos para EMPRESA
  razonSocial?: string;
  nombreComercial?: string;

  email?: string;
  phone?: string;
  mobile?: string;
  direccion?: string;
  distrito?: string;
  departamento?: string;
  provincia?: string;
  country?: string;
  aceptaPublicidad?: boolean;
  status?: CustomerStatus;
  isActive?: boolean;
  notes?: string;
}

/**
 * Query Customers Parameters
 */
export interface QueryCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  customerType?: CustomerType;
  status?: CustomerStatus;
  isActive?: boolean;
  includeDeleted?: boolean;
}

/**
 * Customers Response
 */
export interface CustomersResponse {
  data: Customer[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * ApiPeru DNI Response
 */
export interface ApiPeruDniResponse {
  success: boolean;
  data: {
    numero: string;
    nombre_completo: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string;
    codigo_verificacion: string;
  };
}

/**
 * ApiPeru RUC Response
 */
export interface ApiPeruRucResponse {
  success: boolean;
  data: {
    ruc: string;
    nombre_o_razon_social: string;
    estado: string;
    condicion: string;
    direccion: string;
    direccion_completa: string;
    departamento: string;
    provincia: string;
    distrito: string;
    ubigeo_sunat: string;
    ubigeo: string[];
  };
}
