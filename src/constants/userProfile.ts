/**
 * Constants for User Worker Profile
 * These constants match the backend validation enums
 */

export const DOCUMENT_TYPES = {
  DNI: 'DNI',
  CE: 'CE',
  PASAPORTE: 'PASAPORTE',
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

export const DOCUMENT_TYPE_OPTIONS = [
  { label: 'DNI', value: DOCUMENT_TYPES.DNI },
  { label: 'Carnet de Extranjería (CE)', value: DOCUMENT_TYPES.CE },
  { label: 'Pasaporte', value: DOCUMENT_TYPES.PASAPORTE },
];

export const GENDER_TYPES = {
  M: 'M',
  F: 'F',
  OTRO: 'OTRO',
} as const;

export type GenderType = (typeof GENDER_TYPES)[keyof typeof GENDER_TYPES];

export const GENDER_OPTIONS = [
  { label: 'Masculino', value: GENDER_TYPES.M },
  { label: 'Femenino', value: GENDER_TYPES.F },
  { label: 'Otro', value: GENDER_TYPES.OTRO },
];

export const MARITAL_STATUS_TYPES = {
  SOLTERO: 'SOLTERO',
  CASADO: 'CASADO',
  DIVORCIADO: 'DIVORCIADO',
  VIUDO: 'VIUDO',
  CONVIVIENTE: 'CONVIVIENTE',
} as const;

export type MaritalStatusType = (typeof MARITAL_STATUS_TYPES)[keyof typeof MARITAL_STATUS_TYPES];

export const MARITAL_STATUS_OPTIONS = [
  { label: 'Soltero/a', value: MARITAL_STATUS_TYPES.SOLTERO },
  { label: 'Casado/a', value: MARITAL_STATUS_TYPES.CASADO },
  { label: 'Divorciado/a', value: MARITAL_STATUS_TYPES.DIVORCIADO },
  { label: 'Viudo/a', value: MARITAL_STATUS_TYPES.VIUDO },
  { label: 'Conviviente', value: MARITAL_STATUS_TYPES.CONVIVIENTE },
];

export const EPP_SIZE_OPTIONS = [
  { label: 'XS', value: 'XS' },
  { label: 'S', value: 'S' },
  { label: 'M', value: 'M' },
  { label: 'L', value: 'L' },
  { label: 'XL', value: 'XL' },
  { label: 'XXL', value: 'XXL' },
];

export const EMERGENCY_RELATIONSHIP_OPTIONS = [
  { label: 'Padre', value: 'Padre' },
  { label: 'Madre', value: 'Madre' },
  { label: 'Esposo/a', value: 'Esposo/a' },
  { label: 'Hijo/a', value: 'Hijo/a' },
  { label: 'Hermano/a', value: 'Hermano/a' },
  { label: 'Otro familiar', value: 'Otro familiar' },
  { label: 'Amigo/a', value: 'Amigo/a' },
];
