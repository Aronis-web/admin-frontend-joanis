// ============================================
// TRANSPORT - Normalizacion y validacion de formularios
// ============================================
// Mismas reglas que el backend (svc-admin/transport/utils/transport-normalizers.ts).
// SUNAT rechaza la guia de remision si documento, licencia, placa o RUC traen
// guiones, puntos, espacios o una longitud incorrecta.

import { DocumentType } from '../types/transport';

/** Mayusculas y solo letras/numeros (quita guiones, puntos, comas y espacios). */
export const sanitizeCode = (text: string, maxLength?: number): string => {
  const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return maxLength ? clean.slice(0, maxLength) : clean;
};

/** Solo digitos. */
export const sanitizeDigits = (text: string, maxLength?: number): string => {
  const clean = text.replace(/\D/g, '');
  return maxLength ? clean.slice(0, maxLength) : clean;
};

/** Nombres: letras, espacio, apostrofo y guion (sin numeros, comas ni puntos). */
export const sanitizePersonName = (text: string): string =>
  text.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, '').replace(/\s{2,}/g, ' ');

/** Limpieza final al guardar (quita espacios sobrantes). */
export const tidyText = (text: string): string => text.replace(/\s+/g, ' ').trim();

interface DocumentRule {
  label: string;
  maxLength: number;
  numericOnly: boolean;
  pattern: RegExp;
  message: string;
  placeholder: string;
}

export const DRIVER_DOCUMENT_RULES: Record<DocumentType, DocumentRule> = {
  [DocumentType.DNI]: {
    label: 'DNI',
    maxLength: 8,
    numericOnly: true,
    pattern: /^\d{8}$/,
    message: 'El DNI debe tener exactamente 8 dígitos',
    placeholder: '12345678',
  },
  [DocumentType.CARNET_EXTRANJERIA]: {
    label: 'Carnet de Extranjería',
    maxLength: 12,
    numericOnly: false,
    pattern: /^[A-Z0-9]{8,12}$/,
    message: 'El carnet de extranjería debe tener entre 8 y 12 caracteres',
    placeholder: '001234567',
  },
  [DocumentType.PASAPORTE]: {
    label: 'Pasaporte',
    maxLength: 12,
    numericOnly: false,
    pattern: /^[A-Z0-9]{6,12}$/,
    message: 'El pasaporte debe tener entre 6 y 12 caracteres',
    placeholder: 'AB1234567',
  },
  [DocumentType.CEDULA_DIPLOMATICA]: {
    label: 'Cédula Diplomática',
    maxLength: 15,
    numericOnly: true,
    pattern: /^\d{6,15}$/,
    message: 'La cédula diplomática debe tener entre 6 y 15 dígitos',
    placeholder: '123456789',
  },
};

export const sanitizeDriverDocument = (tipo: DocumentType, text: string): string => {
  const rule = DRIVER_DOCUMENT_RULES[tipo];
  return rule.numericOnly
    ? sanitizeDigits(text, rule.maxLength)
    : sanitizeCode(text, rule.maxLength);
};

export const LICENSE_MAX_LENGTH = 10;
export const PLATE_MAX_LENGTH = 8;
export const RUC_LENGTH = 11;
export const PHONE_MAX_LENGTH = 15;

/** Devuelve el mensaje de error del primer campo invalido, o null si todo esta bien. */
export const validateDriverFields = (data: {
  tipoDocumento: DocumentType;
  numeroDocumento: string;
  numeroLicencia: string;
  telefono?: string;
}): string | null => {
  const rule = DRIVER_DOCUMENT_RULES[data.tipoDocumento];
  if (rule && !rule.pattern.test(data.numeroDocumento)) return rule.message;
  if (!/^[A-Z0-9]{9,10}$/.test(data.numeroLicencia)) {
    return 'La licencia debe tener 9 o 10 caracteres, sin guiones (ej. Q12345678)';
  }
  if (data.telefono && !/^\d{7,15}$/.test(data.telefono)) {
    return 'El teléfono debe tener entre 7 y 15 dígitos';
  }
  return null;
};

export const validateRuc = (ruc: string): string | null =>
  /^(10|15|17|20)\d{9}$/.test(ruc)
    ? null
    : 'El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20';

export const validatePlate = (placa: string): string | null =>
  /^[A-Z0-9]{6,8}$/.test(placa)
    ? null
    : 'La placa debe tener entre 6 y 8 caracteres, sin guion (ej. ABC123)';

export const validatePhone = (telefono?: string): string | null =>
  !telefono || /^\d{7,15}$/.test(telefono) ? null : 'El teléfono debe tener entre 7 y 15 dígitos';
