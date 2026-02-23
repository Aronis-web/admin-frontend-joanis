// ============================================
// BIZLINKS - Facturación Electrónica SUNAT
// ============================================

// ==================== ENUMS ====================

export enum BizlinksDocumentType {
  FACTURA = '01',
  BOLETA = '03',
  NOTA_CREDITO = '07',
  NOTA_DEBITO = '08',
  GUIA_REMISION_REMITENTE = '09',
  GUIA_REMISION_TRANSPORTISTA = '31',
  RETENCION = '20',
  PERCEPCION = '40',
}

export enum BizlinksStatusWs {
  NULL = 'NULL',
  SIGNED = 'SIGNED',
  SIGNED_PE_02 = 'SIGNED/PE_02',
  SIGNED_PE_09 = 'SIGNED/PE_09',
  SIGNED_ED_06 = 'SIGNED/ED_06',
  SIGNED_AC_03 = 'SIGNED/AC_03',
  SIGNED_RC_05 = 'SIGNED/RC_05',
}

export enum BizlinksStatusSunat {
  PENDIENTE_ENVIO = 'PENDIENTE_ENVIO',
  PENDIENTE_RESPUESTA = 'PENDIENTE_RESPUESTA',
  ACEPTADO = 'ACEPTADO',
  RECHAZADO = 'RECHAZADO',
  ANULADO = 'ANULADO',
}

export enum BizlinksCurrency {
  PEN = 'PEN',
  USD = 'USD',
  EUR = 'EUR',
}

export enum BizlinksUnitMeasure {
  NIU = 'NIU', // Unidad (bienes)
  ZZ = 'ZZ',   // Unidad (servicios)
  KGM = 'KGM', // Kilogramo
  LTR = 'LTR', // Litro
  MTR = 'MTR', // Metro
  MTK = 'MTK', // Metro cuadrado
  MTQ = 'MTQ', // Metro cúbico
  GRM = 'GRM', // Gramo
  TNE = 'TNE', // Tonelada
  DZN = 'DZN', // Docena
  SET = 'SET', // Juego
  BX = 'BX',   // Caja
}

export enum BizlinksTaxType {
  IGV = '10',           // Gravado - Operación Onerosa
  IGV_GRATUITO = '11',  // Gravado - Retiro por premio
  IGV_DONACION = '12',  // Gravado - Retiro por donación
  IGV_RETIRO = '13',    // Gravado - Retiro
  IGV_BONIFICACION = '14', // Gravado - Retiro por bonificación
  IGV_PUBLICIDAD = '15',   // Gravado - Retiro por publicidad
  IGV_MUESTRAS = '16',     // Gravado - Retiro por muestras
  EXONERADO = '20',     // Exonerado - Operación Onerosa
  INAFECTO = '30',      // Inafecto - Operación Onerosa
  EXPORTACION = '40',   // Exportación
}

export enum BizlinksDocumentIdentityType {
  DNI = '1',
  RUC = '6',
  CARNET_EXTRANJERIA = '4',
  PASAPORTE = '7',
  CEDULA_DIPLOMATICA = 'A',
}

// ==================== INTERFACES ====================

export interface BizlinksConfig {
  id: string;
  companyId: string;
  siteId?: string;
  baseUrl: string;
  contextPath: string;
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  domicilioFiscal: string;
  ubigeo: string;
  departamento: string;
  provincia: string;
  distrito: string;
  urbanizacion?: string;
  codigoPais: string;
  email: string;
  telefono?: string;
  logoUrl?: string;
  autoSend: boolean;
  autoDownloadPdf: boolean;
  autoDownloadXml: boolean;
  timeoutSeconds: number;
  isActive: boolean;
  isProduction: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations
  company?: {
    id: string;
    name: string;
  };
  site?: {
    id: string;
    name: string;
  };
}

export interface BizlinksDocument {
  id: string;
  companyId: string;
  siteId?: string;
  configId: string;
  correlativeId?: string;
  documentType: BizlinksDocumentType;
  serieNumero: string;
  fechaEmision: string;
  horaEmision: string;
  tipoMoneda: BizlinksCurrency;
  // Emisor
  rucEmisor: string;
  razonSocialEmisor: string;
  // Adquiriente
  tipoDocumentoAdquiriente: string;
  numeroDocumentoAdquiriente: string;
  razonSocialAdquiriente: string;
  // Totales
  totalValorVenta?: number;
  totalPrecioVenta?: number;
  totalIgv?: number;
  totalVenta?: number;
  // Estados
  statusWs?: BizlinksStatusWs;
  statusSunat?: BizlinksStatusSunat;
  messageSunat?: BizlinksSunatMessage;
  // Archivos
  hashCode?: string;
  pdfUrl?: string;
  xmlSignUrl?: string;
  xmlSunatUrl?: string;
  pdfPath?: string;
  xmlSignPath?: string;
  xmlSunatPath?: string;
  // Metadata
  requestPayload?: any;
  responsePayload?: any;
  errorMessage?: string;
  sentAt?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  config?: BizlinksConfig;
  correlative?: {
    id: string;
    documentNumber: string;
  };
}

export interface BizlinksSunatMessage {
  codigo: string;
  mensaje: string;
}

export interface BizlinksLog {
  id: string;
  documentId?: string;
  configId: string;
  method: string;
  url: string;
  requestHeaders?: any;
  requestBody?: any;
  responseStatus?: number;
  responseHeaders?: any;
  responseBody?: any;
  errorMessage?: string;
  durationMs?: number;
  createdAt: string;
}

// ==================== DTOs ====================

// Config DTOs
export interface CreateBizlinksConfigDto {
  companyId: string;
  siteId?: string;
  baseUrl: string;
  contextPath: string;
  ruc: string;
  razonSocial: string;
  nombreComercial?: string;
  domicilioFiscal: string;
  ubigeo: string;
  departamento: string;
  provincia: string;
  distrito: string;
  urbanizacion?: string;
  codigoPais?: string;
  email: string;
  telefono?: string;
  autoSend?: boolean;
  autoDownloadPdf?: boolean;
  autoDownloadXml?: boolean;
  timeoutSeconds?: number;
  isActive?: boolean;
  isProduction?: boolean;
}

export interface UpdateBizlinksConfigDto {
  baseUrl?: string;
  contextPath?: string;
  ruc?: string;
  razonSocial?: string;
  nombreComercial?: string;
  domicilioFiscal?: string;
  ubigeo?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  urbanizacion?: string;
  codigoPais?: string;
  email?: string;
  telefono?: string;
  autoSend?: boolean;
  autoDownloadPdf?: boolean;
  autoDownloadXml?: boolean;
  timeoutSeconds?: number;
  isActive?: boolean;
  isProduction?: boolean;
}

export interface GetBizlinksConfigsParams {
  page?: number;
  limit?: number;
  companyId?: string;
  siteId?: string;
  isActive?: boolean;
}

// Document DTOs - Common
export interface BizlinksEmisorDto {
  rucEmisor: string;
  razonSocialEmisor: string;
  nombreComercialEmisor?: string;
  ubigeoEmisor: string;
  direccionEmisor: string;
  urbanizacionEmisor?: string;
  provinciaEmisor: string;
  departamentoEmisor: string;
  distritoEmisor: string;
  codigoPaisEmisor: string;
  correoEmisor?: string;
  telefonoEmisor?: string;
}

export interface BizlinksAdquirienteDto {
  tipoDocumentoAdquiriente: string;
  numeroDocumentoAdquiriente: string;
  razonSocialAdquiriente: string;
  direccionAdquiriente?: string;
  correoAdquiriente?: string;
  telefonoAdquiriente?: string;
}

export interface BizlinksItemDto {
  numeroOrdenItem: number;
  cantidad: number;
  unidadMedida: string;
  codigoProducto?: string;
  codigoProductoSunat?: string;
  descripcion: string;
  valorUnitario: number;
  precioVentaUnitario: number;
  codigoAfectacionIgv: string;
  porcentajeIgv: number;
  montoIgvItem: number;
  valorVentaItem: number;
  descuentoItem?: number;
}

export interface BizlinksTotalesDto {
  totalValorVenta: number;
  totalPrecioVenta: number;
  totalDescuentos?: number;
  totalIgv: number;
  totalIsc?: number;
  totalOtrosTributos?: number;
  totalVenta: number;
  tipoMoneda: string;
  totalOperacionesGravadas?: number;
  totalOperacionesExoneradas?: number;
  totalOperacionesInafectas?: number;
  totalOperacionesGratuitas?: number;
}

// Factura DTO
export interface EmitirFacturaDto {
  correlativeId?: string;
  serieNumero: string;
  fechaEmision: string;
  horaEmision: string;
  fechaVencimiento?: string;
  emisor: BizlinksEmisorDto;
  adquiriente: BizlinksAdquirienteDto;
  items: BizlinksItemDto[];
  totales: BizlinksTotalesDto;
  observaciones?: string;
  ordenCompra?: string;
  guiaRemision?: string;
}

export interface GetBizlinksDocumentsParams {
  page?: number;
  limit?: number;
  companyId?: string;
  siteId?: string;
  documentType?: BizlinksDocumentType;
  serieNumero?: string;
  statusWs?: BizlinksStatusWs;
  statusSunat?: BizlinksStatusSunat;
  startDate?: string;
  endDate?: string;
}

export interface DownloadArtifactsDto {
  downloadPdf?: boolean;
  downloadXml?: boolean;
  downloadCdr?: boolean;
}

// ==================== RESPONSE INTERFACES ====================

export interface BizlinksApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

export interface BizlinksTestConnectionResponse {
  success: boolean;
  message: string;
  responseTime?: number;
  version?: string;
}
