// ============================================
// ENUMS - Tipos de Sedes, Almacenes y Áreas
// ============================================

/**
 * SiteType - Tipos de Sede
 * Una sede puede tener múltiples tipos simultáneamente
 */
export enum SiteType {
  STORE = 'STORE',                    // Tienda - Punto de venta al público
  WAREHOUSE = 'WAREHOUSE',            // Almacén - Centro de distribución
  ADMINISTRATIVE = 'ADMINISTRATIVE'   // Administrativo - Oficinas
}

/**
 * WarehouseType - Tipos de Almacén
 * Clasificación según la función del almacén
 */
export enum WarehouseType {
  GENERAL = 'GENERAL',                // Almacén general (default)
  STORE_WAREHOUSE = 'STORE_WAREHOUSE', // Almacén de respaldo para tienda
  PHYSICAL_STORE = 'PHYSICAL_STORE'   // Tienda física (punto de venta)
}

/**
 * WarehouseAreaType - Tipos de Área
 * Clasificación de áreas dentro de un almacén
 */
export enum WarehouseAreaType {
  GENERAL = 'GENERAL',    // Área general (default)
  SHELF = 'SHELF',        // Anaquel (exhibición en tienda)
  SECTION = 'SECTION',    // Sección
  ZONE = 'ZONE'           // Zona
}

// ============================================
// LABELS - Etiquetas para UI
// ============================================

export const SiteTypeLabels: Record<SiteType, string> = {
  [SiteType.STORE]: 'Tienda',
  [SiteType.WAREHOUSE]: 'Almacén',
  [SiteType.ADMINISTRATIVE]: 'Administrativo',
};

export const WarehouseTypeLabels: Record<WarehouseType, string> = {
  [WarehouseType.GENERAL]: 'Almacén General',
  [WarehouseType.STORE_WAREHOUSE]: 'Almacén de Tienda',
  [WarehouseType.PHYSICAL_STORE]: 'Tienda Física',
};

export const WarehouseAreaTypeLabels: Record<WarehouseAreaType, string> = {
  [WarehouseAreaType.GENERAL]: 'Área General',
  [WarehouseAreaType.SHELF]: 'Anaquel',
  [WarehouseAreaType.SECTION]: 'Sección',
  [WarehouseAreaType.ZONE]: 'Zona',
};

// ============================================
// DESCRIPTIONS - Descripciones para UI
// ============================================

export const SiteTypeDescriptions: Record<SiteType, string> = {
  [SiteType.STORE]: 'Punto de venta al público',
  [SiteType.WAREHOUSE]: 'Centro de distribución',
  [SiteType.ADMINISTRATIVE]: 'Oficinas administrativas',
};

export const WarehouseTypeDescriptions: Record<WarehouseType, string> = {
  [WarehouseType.GENERAL]: 'Almacén de uso general',
  [WarehouseType.STORE_WAREHOUSE]: 'Almacén de respaldo para tienda',
  [WarehouseType.PHYSICAL_STORE]: 'Tienda física con punto de venta',
};

export const WarehouseAreaTypeDescriptions: Record<WarehouseAreaType, string> = {
  [WarehouseAreaType.GENERAL]: 'Área de uso general',
  [WarehouseAreaType.SHELF]: 'Anaquel para exhibición en tienda',
  [WarehouseAreaType.SECTION]: 'Sección del almacén',
  [WarehouseAreaType.ZONE]: 'Zona del almacén',
};
