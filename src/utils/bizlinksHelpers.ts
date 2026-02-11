import {
  BizlinksStatusWs,
  BizlinksStatusSunat,
  BizlinksDocumentType,
  BizlinksCurrency,
  BizlinksUnitMeasure,
  BizlinksTaxType,
  BizlinksDocumentIdentityType,
} from '../types/bizlinks';

// ============================================
// BIZLINKS HELPERS & UTILITIES
// ============================================

// Status helpers
export const getBizlinksStatusWsLabel = (status?: BizlinksStatusWs): string => {
  if (!status) return 'Sin estado';

  const labels: Record<BizlinksStatusWs, string> = {
    [BizlinksStatusWs.NULL]: 'Error en el registro',
    [BizlinksStatusWs.SIGNED]: 'Firmado',
    [BizlinksStatusWs.SIGNED_PE_02]: 'Firmado, emitido y aceptado',
    [BizlinksStatusWs.SIGNED_PE_09]: 'Firmado y pendiente de envío',
    [BizlinksStatusWs.SIGNED_ED_06]: 'Firmado y enviado a declarar',
    [BizlinksStatusWs.SIGNED_AC_03]: 'Firmado, emitido y aceptado por SUNAT',
    [BizlinksStatusWs.SIGNED_RC_05]: 'Firmado, emitido y rechazado por SUNAT',
  };

  return labels[status] || status;
};

export const getBizlinksStatusSunatLabel = (status?: BizlinksStatusSunat): string => {
  if (!status) return 'Sin estado';

  const labels: Record<BizlinksStatusSunat, string> = {
    [BizlinksStatusSunat.PENDIENTE_ENVIO]: 'Pendiente de envío',
    [BizlinksStatusSunat.PENDIENTE_RESPUESTA]: 'Pendiente de respuesta',
    [BizlinksStatusSunat.ACEPTADO]: 'Aceptado',
    [BizlinksStatusSunat.RECHAZADO]: 'Rechazado',
    [BizlinksStatusSunat.ANULADO]: 'Anulado',
  };

  return labels[status] || status;
};

export const getBizlinksStatusWsColor = (status?: BizlinksStatusWs): string => {
  if (!status) return '#999999';

  const colors: Record<BizlinksStatusWs, string> = {
    [BizlinksStatusWs.NULL]: '#dc3545',
    [BizlinksStatusWs.SIGNED]: '#ffc107',
    [BizlinksStatusWs.SIGNED_PE_02]: '#28a745',
    [BizlinksStatusWs.SIGNED_PE_09]: '#17a2b8',
    [BizlinksStatusWs.SIGNED_ED_06]: '#17a2b8',
    [BizlinksStatusWs.SIGNED_AC_03]: '#28a745',
    [BizlinksStatusWs.SIGNED_RC_05]: '#dc3545',
  };

  return colors[status] || '#999999';
};

export const getBizlinksStatusSunatColor = (status?: BizlinksStatusSunat): string => {
  if (!status) return '#999999';

  const colors: Record<BizlinksStatusSunat, string> = {
    [BizlinksStatusSunat.PENDIENTE_ENVIO]: '#ffc107',
    [BizlinksStatusSunat.PENDIENTE_RESPUESTA]: '#17a2b8',
    [BizlinksStatusSunat.ACEPTADO]: '#28a745',
    [BizlinksStatusSunat.RECHAZADO]: '#dc3545',
    [BizlinksStatusSunat.ANULADO]: '#6c757d',
  };

  return colors[status] || '#999999';
};

// Document type helpers
export const getDocumentTypeLabel = (type: BizlinksDocumentType): string => {
  const labels: Record<BizlinksDocumentType, string> = {
    [BizlinksDocumentType.FACTURA]: 'Factura Electrónica',
    [BizlinksDocumentType.BOLETA]: 'Boleta de Venta Electrónica',
    [BizlinksDocumentType.NOTA_CREDITO]: 'Nota de Crédito Electrónica',
    [BizlinksDocumentType.NOTA_DEBITO]: 'Nota de Débito Electrónica',
    [BizlinksDocumentType.GUIA_REMISION_REMITENTE]: 'Guía de Remisión Remitente',
    [BizlinksDocumentType.GUIA_REMISION_TRANSPORTISTA]: 'Guía de Remisión Transportista',
    [BizlinksDocumentType.RETENCION]: 'Retención',
    [BizlinksDocumentType.PERCEPCION]: 'Percepción',
  };

  return labels[type] || type;
};

export const getDocumentTypeShortLabel = (type: BizlinksDocumentType): string => {
  const labels: Record<BizlinksDocumentType, string> = {
    [BizlinksDocumentType.FACTURA]: 'Factura',
    [BizlinksDocumentType.BOLETA]: 'Boleta',
    [BizlinksDocumentType.NOTA_CREDITO]: 'N. Crédito',
    [BizlinksDocumentType.NOTA_DEBITO]: 'N. Débito',
    [BizlinksDocumentType.GUIA_REMISION_REMITENTE]: 'G. Remisión',
    [BizlinksDocumentType.GUIA_REMISION_TRANSPORTISTA]: 'G. Transportista',
    [BizlinksDocumentType.RETENCION]: 'Retención',
    [BizlinksDocumentType.PERCEPCION]: 'Percepción',
  };

  return labels[type] || type;
};

// Currency helpers
export const getCurrencyLabel = (currency: BizlinksCurrency): string => {
  const labels: Record<BizlinksCurrency, string> = {
    [BizlinksCurrency.PEN]: 'Soles (PEN)',
    [BizlinksCurrency.USD]: 'Dólares (USD)',
    [BizlinksCurrency.EUR]: 'Euros (EUR)',
  };

  return labels[currency] || currency;
};

export const getCurrencySymbol = (currency: BizlinksCurrency): string => {
  const symbols: Record<BizlinksCurrency, string> = {
    [BizlinksCurrency.PEN]: 'S/',
    [BizlinksCurrency.USD]: '$',
    [BizlinksCurrency.EUR]: '€',
  };

  return symbols[currency] || currency;
};

// Unit measure helpers
export const getUnitMeasureLabel = (unit: BizlinksUnitMeasure): string => {
  const labels: Record<BizlinksUnitMeasure, string> = {
    [BizlinksUnitMeasure.NIU]: 'Unidad (bienes)',
    [BizlinksUnitMeasure.ZZ]: 'Unidad (servicios)',
    [BizlinksUnitMeasure.KGM]: 'Kilogramo',
    [BizlinksUnitMeasure.LTR]: 'Litro',
    [BizlinksUnitMeasure.MTR]: 'Metro',
    [BizlinksUnitMeasure.MTK]: 'Metro cuadrado',
    [BizlinksUnitMeasure.MTQ]: 'Metro cúbico',
    [BizlinksUnitMeasure.GRM]: 'Gramo',
    [BizlinksUnitMeasure.TNE]: 'Tonelada',
    [BizlinksUnitMeasure.DZN]: 'Docena',
    [BizlinksUnitMeasure.SET]: 'Juego',
    [BizlinksUnitMeasure.BX]: 'Caja',
  };

  return labels[unit] || unit;
};

// Tax type helpers
export const getTaxTypeLabel = (taxType: BizlinksTaxType): string => {
  const labels: Record<BizlinksTaxType, string> = {
    [BizlinksTaxType.IGV]: 'Gravado - Operación Onerosa',
    [BizlinksTaxType.IGV_GRATUITO]: 'Gravado - Retiro por premio',
    [BizlinksTaxType.IGV_DONACION]: 'Gravado - Retiro por donación',
    [BizlinksTaxType.IGV_RETIRO]: 'Gravado - Retiro',
    [BizlinksTaxType.IGV_BONIFICACION]: 'Gravado - Retiro por bonificación',
    [BizlinksTaxType.IGV_PUBLICIDAD]: 'Gravado - Retiro por publicidad',
    [BizlinksTaxType.IGV_MUESTRAS]: 'Gravado - Retiro por muestras',
    [BizlinksTaxType.EXONERADO]: 'Exonerado - Operación Onerosa',
    [BizlinksTaxType.INAFECTO]: 'Inafecto - Operación Onerosa',
    [BizlinksTaxType.EXPORTACION]: 'Exportación',
  };

  return labels[taxType] || taxType;
};

// Document identity type helpers
export const getDocumentIdentityTypeLabel = (type: BizlinksDocumentIdentityType): string => {
  const labels: Record<BizlinksDocumentIdentityType, string> = {
    [BizlinksDocumentIdentityType.DNI]: 'DNI',
    [BizlinksDocumentIdentityType.RUC]: 'RUC',
    [BizlinksDocumentIdentityType.CARNET_EXTRANJERIA]: 'Carnet de Extranjería',
    [BizlinksDocumentIdentityType.PASAPORTE]: 'Pasaporte',
    [BizlinksDocumentIdentityType.CEDULA_DIPLOMATICA]: 'Cédula Diplomática',
  };

  return labels[type] || type;
};

// Validation helpers
export const validateRucFormat = (ruc: string): boolean => {
  // RUC debe tener 11 dígitos
  if (!/^\d{11}$/.test(ruc)) {
    return false;
  }

  // Validación básica de dígito verificador
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const digits = ruc.split('').map(Number);
  const checkDigit = digits[10];

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * weights[i];
  }

  const remainder = sum % 11;
  const expectedCheckDigit = remainder === 0 ? 0 : 11 - remainder;

  return checkDigit === expectedCheckDigit;
};

export const validateDniFormat = (dni: string): boolean => {
  // DNI debe tener 8 dígitos
  return /^\d{8}$/.test(dni);
};

export const validateSerieFormat = (serie: string, documentType: BizlinksDocumentType): boolean => {
  // Serie debe tener 4 caracteres
  if (serie.length !== 4) {
    return false;
  }

  // Validar prefijo según tipo de documento
  const prefixes: Record<BizlinksDocumentType, string[]> = {
    [BizlinksDocumentType.FACTURA]: ['F'],
    [BizlinksDocumentType.BOLETA]: ['B'],
    [BizlinksDocumentType.NOTA_CREDITO]: ['FC', 'BC'],
    [BizlinksDocumentType.NOTA_DEBITO]: ['FD', 'BD'],
    [BizlinksDocumentType.GUIA_REMISION_REMITENTE]: ['T'],
    [BizlinksDocumentType.GUIA_REMISION_TRANSPORTISTA]: ['T'],
    [BizlinksDocumentType.RETENCION]: ['R'],
    [BizlinksDocumentType.PERCEPCION]: ['P'],
  };

  const validPrefixes = prefixes[documentType] || [];

  if (validPrefixes.length === 0) {
    return true; // No hay validación específica
  }

  return validPrefixes.some(prefix => serie.startsWith(prefix));
};

// Format helpers
export const formatCurrency = (amount: number | undefined | null, currency: BizlinksCurrency = BizlinksCurrency.PEN): string => {
  const symbol = getCurrencySymbol(currency);
  if (amount === undefined || amount === null) {
    return `${symbol} 0.00`;
  }
  return `${symbol} ${amount.toFixed(2)}`;
};

export const formatSerieNumero = (serie: string, numero: number): string => {
  return `${serie}-${numero.toString().padStart(8, '0')}`;
};

export const parseSerieNumero = (serieNumero: string): { serie: string; numero: number } | null => {
  const match = serieNumero.match(/^([A-Z0-9]{4})-(\d{8})$/);
  if (!match) {
    return null;
  }

  return {
    serie: match[1],
    numero: parseInt(match[2], 10),
  };
};

// Date helpers
export const formatDateForBizlinks = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatTimeForBizlinks = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

// URL helpers
export const buildBizlinksUrl = (baseUrl: string, contextPath: string, endpoint: string): string => {
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const cleanContextPath = contextPath.replace(/^\/|\/$/g, '');
  const cleanEndpoint = endpoint.replace(/^\//, '');

  return `${cleanBaseUrl}/${cleanContextPath}/${cleanEndpoint}`;
};

// Error helpers
export const parseBizlinksError = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  if (error.message) {
    return error.message;
  }

  return 'Error desconocido al comunicarse con Bizlinks';
};

// Status check helpers
export const isDocumentAccepted = (statusSunat?: BizlinksStatusSunat): boolean => {
  return statusSunat === BizlinksStatusSunat.ACEPTADO;
};

export const isDocumentRejected = (statusSunat?: BizlinksStatusSunat): boolean => {
  return statusSunat === BizlinksStatusSunat.RECHAZADO;
};

export const isDocumentVoided = (statusSunat?: BizlinksStatusSunat): boolean => {
  return statusSunat === BizlinksStatusSunat.ANULADO;
};

export const isDocumentPending = (statusSunat?: BizlinksStatusSunat): boolean => {
  return statusSunat === BizlinksStatusSunat.PENDIENTE_ENVIO ||
         statusSunat === BizlinksStatusSunat.PENDIENTE_RESPUESTA;
};

export const canRefreshDocument = (statusSunat?: BizlinksStatusSunat): boolean => {
  return isDocumentPending(statusSunat);
};

export const canVoidDocument = (statusSunat?: BizlinksStatusSunat): boolean => {
  return isDocumentAccepted(statusSunat);
};

export const canDownloadArtifacts = (statusSunat?: BizlinksStatusSunat): boolean => {
  return isDocumentAccepted(statusSunat);
};
