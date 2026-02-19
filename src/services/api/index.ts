// API Services Index
// Central export point for all API services

export { default as apiClient } from './client';
export { companiesApi } from './companies';
export { sitesApi, sitesService } from './sites';
export { inventoryApi } from './inventory';
export { warehousesApi, warehouseAreasApi } from './warehouses';
export { expensesService } from './expenses';
export { balancesApi } from './balances';
export { biometricApi } from './biometric';
export { filesApi } from './files';
export { accessApi } from './access';
export { transmisionesApi } from './transmisiones';
export { organizationApi } from './organization';

// Re-export commonly used services
export * from './products';
export * from './purchases';
export * from './suppliers';
export * from './transfers';
export * from './campaigns';
export * from './repartos';
export * from './users';

// Export roles API (avoid GetPermissionsParams conflict with apps)
export { rolesApi } from './roles';
export type { Role, CreateRoleRequest, CreateRoleResponse, Permission } from './roles';

// Export apps API (avoid conflicts with roles and scopes)
export { appsApi } from './apps';
export type {
  App,
  AppsResponse,
  CreateAppDto,
  UpdateAppDto,
  GetAppsParams,
  Scope,
  AppPermission,
  UserAppRole,
  AppUser,
  UserRole,
  AssignUserRoleDto,
  UpdateUserRoleDto,
  ScopesResponse,
  PermissionsResponse as AppsPermissionsResponse
} from './apps';

// Export scopes API (avoid conflicts with apps)
export { scopesApi } from './scopes';

export * from './price-profiles';

// Export presentations API (avoid Presentation conflict with products)
export { presentationsApi } from './presentations';
export type { PresentationsResponse, CreatePresentationDto, UpdatePresentationDto, GetPresentationsParams } from './presentations';

export * from './billing';
export * from './bizlinks';
export * from './emission-points';

export { locationsApi } from './locations';
export type {
  LocationSuggestion,
  AutocompleteResponse,
  LocationDetails,
  GpsCoordinates,
  UbigeosMap,
} from './locations';

export { geminiImageEditorApi } from './gemini-image-editor';
export type {
  GeminiEditImageRequest,
  GeminiEditImageResponse,
} from './gemini-image-editor';
