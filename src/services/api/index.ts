export { apiClient } from './client';
export { authApi } from './auth';
export type { LoginRequest, RegisterRequest, AuthResponse } from './auth';

export { productsApi } from './products';
export type {
  Product,
  ProductVariant,
  ProductCategory,
  ProductsResponse,
  ProductFilters,
  Review,
  ReviewsResponse,
} from './products';

export { filesApi } from './files';
export type { UploadResponse, SignedUrlResponse } from './files';

export { usersApi } from './users';
export type {
  User,
  UsersResponse,
  CreateUserRequest,
  UpdateUserRequest,
  GetUsersParams
} from './users';

// RBAC exports
export {
  rolesApi,
  permissionsApi,
  rolePermissionsApi,
  userRolesApi,
  userPermissionsApi
} from './roles';
export type {
  Role,
  Permission,
  CreateRoleRequest,
  CreateRoleResponse,
  GetPermissionsParams
} from './roles';

// Apps exports
export {
  appsApi,
  scopesApi,
  appPermissionsApi,
  userAppRolesApi
} from './apps';
export type {
  App,
  Scope,
  AppPermission,
  UserAppRole,
  CreateAppDto,
  UpdateAppDto,
  CreateScopeDto,
  CreateAppPermissionDto,
  AssignUserRoleDto,
  AppsResponse,
  ScopesResponse,
  PermissionsResponse,
  GetAppsParams,
  GetScopesParams,
  GetPermissionsParams as GetAppPermissionsParams
} from './apps';
// Note: AppType enum should be imported directly from './apps' to avoid issues

// Sites exports
export { sitesApi } from './sites';
export type {
  Site,
  SiteAdmin,
  SitesResponse,
  CreateSiteRequest,
  UpdateSiteRequest,
  GetSitesParams,
  AddAdminRequest
} from '@/types/sites';
