// ============================================
// TRANSPORT MODULE - Types & Interfaces
// ============================================

// ==================== ENUMS ====================

export enum DocumentType {
  DNI = '1',
  CARNET_EXTRANJERIA = '4',
  PASAPORTE = '7',
  CEDULA_DIPLOMATICA = 'A',
}

export enum DriverStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum VehicleType {
  PRINCIPAL = 'PRINCIPAL',
  SECONDARY = 'SECONDARY',
}

export enum VehicleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

export enum AuthorizedCode {
  TRANSPORTE_PRIVADO = '01',
  TRANSPORTE_PUBLICO = '02',
  TRANSPORTE_CARGA = '03',
  TRANSPORTE_PASAJEROS = '04',
  TRANSPORTE_MIXTO = '05',
  TRANSPORTE_ESPECIAL = '06',
  TRANSPORTE_INTERNACIONAL = '07',
}

export enum TransporterDocumentType {
  RUC = '6',
  DNI = '1',
}

export enum TransporterStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

// ==================== INTERFACES ====================

// Driver (Conductor)
export interface Driver {
  id: string;
  tipoDocumento: DocumentType;
  numeroDocumento: string;
  nombre: string;
  apellido: string;
  numeroLicencia: string;
  categoriaLicencia: string;
  fechaVencimientoLicencia: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  status: DriverStatus;
  isActive: boolean;
  notas?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CreateDriverRequest {
  tipoDocumento: DocumentType;
  numeroDocumento: string;
  nombre: string;
  apellido: string;
  numeroLicencia: string;
  categoriaLicencia: string;
  fechaVencimientoLicencia: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  status?: DriverStatus;
  isActive?: boolean;
  notas?: string;
}

export interface UpdateDriverRequest {
  tipoDocumento?: DocumentType;
  numeroDocumento?: string;
  nombre?: string;
  apellido?: string;
  numeroLicencia?: string;
  categoriaLicencia?: string;
  fechaVencimientoLicencia?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  status?: DriverStatus;
  isActive?: boolean;
  notas?: string;
}

export interface QueryDriversParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: DriverStatus;
  isActive?: boolean;
  includeDeleted?: boolean;
}

export interface DriversResponse {
  data: Driver[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Vehicle (Vehículo)
export interface Vehicle {
  id: string;
  numeroPlaca: string;
  tipoVehiculo: VehicleType;
  tarjetaUnicaCirculacion?: string;
  numeroAutorizacion?: string;
  codigoAutorizado?: AuthorizedCode;
  marca: string;
  modelo: string;
  anio?: number;
  color?: string;
  capacidadCargaKg?: number;
  indTrasVehiculoCatM1L?: boolean;
  status: VehicleStatus;
  isActive: boolean;
  notas?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CreateVehicleRequest {
  numeroPlaca: string;
  tipoVehiculo: VehicleType;
  tarjetaUnicaCirculacion?: string;
  numeroAutorizacion?: string;
  codigoAutorizado?: AuthorizedCode;
  marca: string;
  modelo: string;
  anio?: number;
  color?: string;
  capacidadCargaKg?: number;
  indTrasVehiculoCatM1L?: boolean;
  status?: VehicleStatus;
  isActive?: boolean;
  notas?: string;
}

export interface UpdateVehicleRequest {
  numeroPlaca?: string;
  tipoVehiculo?: VehicleType;
  tarjetaUnicaCirculacion?: string;
  numeroAutorizacion?: string;
  codigoAutorizado?: AuthorizedCode;
  marca?: string;
  modelo?: string;
  anio?: number;
  color?: string;
  capacidadCargaKg?: number;
  indTrasVehiculoCatM1L?: boolean;
  status?: VehicleStatus;
  isActive?: boolean;
  notas?: string;
}

export interface QueryVehiclesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: VehicleStatus;
  tipoVehiculo?: VehicleType;
  isActive?: boolean;
  includeDeleted?: boolean;
}

export interface VehiclesResponse {
  data: Vehicle[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Transporter (Transportista)
export interface Transporter {
  id: string;
  numeroRuc: string;
  tipoDocumento: TransporterDocumentType;
  razonSocial: string;
  numeroRegistroMTC?: string;
  numeroAutorizacion?: string;
  codigoAutorizado?: AuthorizedCode;
  telefono?: string;
  email?: string;
  direccion?: string;
  status: TransporterStatus;
  isActive: boolean;
  notas?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CreateTransporterRequest {
  numeroRuc: string;
  tipoDocumento: TransporterDocumentType;
  razonSocial: string;
  numeroRegistroMTC?: string;
  numeroAutorizacion?: string;
  codigoAutorizado?: AuthorizedCode;
  telefono?: string;
  email?: string;
  direccion?: string;
  status?: TransporterStatus;
  isActive?: boolean;
  notas?: string;
}

export interface UpdateTransporterRequest {
  numeroRuc?: string;
  tipoDocumento?: TransporterDocumentType;
  razonSocial?: string;
  numeroRegistroMTC?: string;
  numeroAutorizacion?: string;
  codigoAutorizado?: AuthorizedCode;
  telefono?: string;
  email?: string;
  direccion?: string;
  status?: TransporterStatus;
  isActive?: boolean;
  notas?: string;
}

export interface QueryTransportersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: TransporterStatus;
  isActive?: boolean;
  includeDeleted?: boolean;
}

export interface TransportersResponse {
  data: Transporter[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
