// API Services Index
// Central export point for all API services

export { default as apiClient } from './client';
export { companiesApi } from './companies';
export { inventoryApi } from './inventory';
export { warehousesApi, warehouseAreasApi } from './warehouses';
export { expensesApi, expensesService } from './expenses';
export { balancesApi } from './balances';
export { biometricApi } from './biometric';
export { filesApi } from './files';
export { accessApi } from './access';
export { transmisionesApi } from './transmisiones';
export { organizationApi } from './organization';
export { sitesApi, sitesService } from './sites';
export { authApi } from './auth';

// Re-export commonly used types and services
// Note: Using selective exports to avoid conflicts
export type { LoginRequest, RegisterRequest, AuthResponse, RefreshTokenResponse } from './auth';
export type { Site, SitesResponse, CreateSiteRequest, UpdateSiteRequest, GetSitesParams, AddAdminRequest } from './sites';
export * from './products';
export * from './purchases';
export * from './suppliers';
export * from './transfers';
export * from './campaigns';
export * from './repartos';
export * from './users';
export * from './roles';
// Selective exports to avoid conflicts with scopes
export type { App, CreateAppRequest, UpdateAppRequest, GetAppsParams } from './apps';
export * from './scopes';
export * from './price-profiles';
// Selective export to avoid Presentation conflict
export type { PresentationFormData, CreatePresentationRequest, UpdatePresentationRequest } from './presentations';
