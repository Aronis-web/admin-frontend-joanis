// Site Types and Interfaces

export interface Site {
  id: string;
  companyId: string; // FK to companies - Multi-tenancy support
  code: string; // Unique per company
  name: string;
  isActive: boolean;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  numberExt?: string;
  district?: string;
  province?: string;
  department?: string;
  country?: string;
  postalCode?: string;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
  admins?: SiteAdmin[];
  company?: {
    id: string;
    name: string;
    ruc?: string;
    companyType?: string;
  };
}

export interface SiteAdmin {
  id: string;
  siteId: string;
  userId: string;
  createdAt: string;
  user?: {
    id: string;
    name?: string;
    email: string;
    username?: string;
  };
}

export interface CreateSiteRequest {
  companyId: string; // Required for multi-tenancy
  code: string;
  name: string;
  isActive?: boolean;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  numberExt?: string;
  district?: string;
  province?: string;
  department?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  admins?: string[]; // Array of user IDs
}

export interface UpdateSiteRequest {
  code?: string;
  name?: string;
  isActive?: boolean;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  numberExt?: string;
  district?: string;
  province?: string;
  department?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

export interface GetSitesParams {
  companyId?: string; // Filter by company (optional, may be set via headers)
  userId?: string; // Filter sites of a specific user
  q?: string; // Search in name and fullAddress
  isActive?: boolean;
  district?: string;
  province?: string;
  department?: string;
  page?: number;
  limit?: number;
  orderBy?: 'name' | 'code' | 'createdAt';
  orderDir?: 'ASC' | 'DESC';
}

export interface SitesResponse {
  data: Site[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AddAdminRequest {
  userId: string;
}
