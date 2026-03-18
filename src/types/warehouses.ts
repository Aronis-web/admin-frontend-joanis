// Warehouse Types and Interfaces
import { WarehouseType, WarehouseAreaType } from './enums';

export interface WarehouseArea {
  id: string;
  companyId: string; // FK to companies - Multi-tenancy support
  siteId: string; // FK to sites - Multi-tenancy support
  warehouseId: string;
  code: string; // Unique per company/site/warehouse
  name?: string;
  areaType?: WarehouseAreaType; // Tipo de área (GENERAL, SHELF, SECTION, ZONE)
  warehouse?: {
    id: string;
    siteCode: string;
    name: string;
  };
}

export interface Warehouse {
  id: string;
  companyId: string; // FK to companies - Multi-tenancy support
  siteId: string; // FK to sites - Multi-tenancy support
  code: string; // Unique per company/site
  siteCode: string; // Legacy field, kept for compatibility
  name: string;
  warehouseType?: WarehouseType; // Tipo de almacén (GENERAL, STORE_WAREHOUSE, PHYSICAL_STORE)
  isActive?: boolean; // Optional flag to filter active warehouses
  createdAt: string;
  areas?: WarehouseArea[];
  site?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface CreateWarehouseRequest {
  companyId: string; // Required for multi-tenancy
  siteId: string; // Required for multi-tenancy
  code: string; // Unique code per company/site
  siteCode: string; // Legacy field, kept for compatibility
  name: string;
  warehouseType?: WarehouseType; // Tipo de almacén (GENERAL, STORE_WAREHOUSE, PHYSICAL_STORE)
}

export interface UpdateWarehouseRequest {
  code?: string;
  siteCode?: string; // Legacy field, kept for compatibility
  name?: string;
  warehouseType?: WarehouseType; // Tipo de almacén (GENERAL, STORE_WAREHOUSE, PHYSICAL_STORE)
}

export interface CreateWarehouseAreaRequest {
  companyId: string; // Required for multi-tenancy
  siteId: string; // Required for multi-tenancy
  warehouseId: string; // Required for multi-tenancy
  code: string; // Unique code per company/site/warehouse
  name?: string;
  areaType?: WarehouseAreaType; // Tipo de área (GENERAL, SHELF, SECTION, ZONE)
}

export interface UpdateWarehouseAreaRequest {
  code?: string;
  name?: string;
  areaType?: WarehouseAreaType; // Tipo de área (GENERAL, SHELF, SECTION, ZONE)
}

export interface WarehousesResponse {
  data: Warehouse[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface WarehouseAreasResponse {
  data: WarehouseArea[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
