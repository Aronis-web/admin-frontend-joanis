// Site Types and Interfaces

export interface Site {
  id: string;
  code: string;
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
  total: number;
  page: number;
  limit: number;
}

export interface AddAdminRequest {
  userId: string;
}
