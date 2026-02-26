/**
 * Supplier Types Constants - v1.1.0
 * Constantes y utilidades para tipos de proveedor
 */

import { SupplierType } from '@/types/suppliers';

/**
 * Traducciones de tipos de proveedor al español
 */
export const SUPPLIER_TYPE_LABELS: Record<SupplierType, string> = {
  [SupplierType.MERCHANDISE]: 'Mercadería/Productos',
  [SupplierType.SERVICES]: 'Servicios Profesionales',
  [SupplierType.UTILITIES]: 'Servicios Públicos',
  [SupplierType.RENT]: 'Alquiler/Arrendamiento',
  [SupplierType.PAYROLL]: 'Nómina/Planilla',
  [SupplierType.TAXES]: 'Impuestos y Tributos',
  [SupplierType.LOANS]: 'Préstamos y Financiamiento',
  [SupplierType.INSURANCE]: 'Seguros',
  [SupplierType.MAINTENANCE]: 'Mantenimiento',
  [SupplierType.TRANSPORT]: 'Transporte y Logística',
  [SupplierType.OTHER]: 'Otros',
};

/**
 * Descripciones detalladas de cada tipo
 */
export const SUPPLIER_TYPE_DESCRIPTIONS: Record<SupplierType, string> = {
  [SupplierType.MERCHANDISE]: 'Proveedores de productos físicos, materias primas, inventario',
  [SupplierType.SERVICES]: 'Servicios profesionales, consultorías, asesorías',
  [SupplierType.UTILITIES]: 'Luz, agua, internet, teléfono, gas',
  [SupplierType.RENT]: 'Alquiler de locales, equipos, vehículos',
  [SupplierType.PAYROLL]: 'Servicios de nómina, planilla, recursos humanos',
  [SupplierType.TAXES]: 'Impuestos, tributos, obligaciones fiscales',
  [SupplierType.LOANS]: 'Préstamos bancarios, financiamiento, créditos',
  [SupplierType.INSURANCE]: 'Seguros de vida, salud, vehículos, propiedad',
  [SupplierType.MAINTENANCE]: 'Mantenimiento de equipos, instalaciones, vehículos',
  [SupplierType.TRANSPORT]: 'Transporte de mercancías, logística, courier',
  [SupplierType.OTHER]: 'Otros tipos de proveedores no clasificados',
};

/**
 * Iconos para cada tipo de proveedor
 */
export const SUPPLIER_TYPE_ICONS: Record<SupplierType, string> = {
  [SupplierType.MERCHANDISE]: '📦',
  [SupplierType.SERVICES]: '💼',
  [SupplierType.UTILITIES]: '⚡',
  [SupplierType.RENT]: '🏢',
  [SupplierType.PAYROLL]: '💰',
  [SupplierType.TAXES]: '📊',
  [SupplierType.LOANS]: '🏦',
  [SupplierType.INSURANCE]: '🛡️',
  [SupplierType.MAINTENANCE]: '🔧',
  [SupplierType.TRANSPORT]: '🚚',
  [SupplierType.OTHER]: '📋',
};

/**
 * Colores para cada tipo de proveedor (para badges)
 */
export const SUPPLIER_TYPE_COLORS: Record<SupplierType, string> = {
  [SupplierType.MERCHANDISE]: '#4CAF50',
  [SupplierType.SERVICES]: '#2196F3',
  [SupplierType.UTILITIES]: '#FF9800',
  [SupplierType.RENT]: '#9C27B0',
  [SupplierType.PAYROLL]: '#F44336',
  [SupplierType.TAXES]: '#795548',
  [SupplierType.LOANS]: '#3F51B5',
  [SupplierType.INSURANCE]: '#00BCD4',
  [SupplierType.MAINTENANCE]: '#FFC107',
  [SupplierType.TRANSPORT]: '#607D8B',
  [SupplierType.OTHER]: '#9E9E9E',
};

/**
 * Obtener todos los tipos de proveedor como array
 */
export const getAllSupplierTypes = (): SupplierType[] => {
  return Object.values(SupplierType);
};

/**
 * Obtener opciones para picker/select
 */
export const getSupplierTypeOptions = () => {
  return getAllSupplierTypes().map((type) => ({
    value: type,
    label: SUPPLIER_TYPE_LABELS[type],
    icon: SUPPLIER_TYPE_ICONS[type],
    description: SUPPLIER_TYPE_DESCRIPTIONS[type],
    color: SUPPLIER_TYPE_COLORS[type],
  }));
};

/**
 * Frecuencias de pago disponibles
 */
export const PAYMENT_FREQUENCIES = [
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quincenal' },
  { value: 'MONTHLY', label: 'Mensual' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'ANNUAL', label: 'Anual' },
  { value: 'ON_DELIVERY', label: 'Contra Entrega' },
  { value: 'CUSTOM', label: 'Personalizado' },
];

/**
 * Métodos de pago preferidos
 */
export const PREFERRED_PAYMENT_METHODS = [
  { value: 'TRANSFER', label: 'Transferencia Bancaria' },
  { value: 'CHECK', label: 'Cheque' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'DEPOSIT', label: 'Depósito' },
  { value: 'WIRE', label: 'Giro' },
  { value: 'OTHER', label: 'Otro' },
];

/**
 * Monedas disponibles
 */
export const CURRENCIES = [
  { value: 'PEN', label: 'Soles (PEN)', symbol: 'S/' },
  { value: 'USD', label: 'Dólares (USD)', symbol: '$' },
  { value: 'EUR', label: 'Euros (EUR)', symbol: '€' },
];

/**
 * Etiquetas predefinidas para proveedores
 */
export const PREDEFINED_TAGS = [
  'VIP',
  'Proveedor Crítico',
  'Descuento Especial',
  'Pago Inmediato',
  'Crédito Extendido',
  'Proveedor Local',
  'Proveedor Internacional',
  'Certificado',
  'Nuevo',
  'En Evaluación',
  'Preferido',
  'Exclusivo',
];
