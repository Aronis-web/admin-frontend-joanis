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
  ProductListResponse,
  CreateProductDto,
  UpdateProductDto,
  ProductPresentation,
  ProductDetail,
  ProductPresentationDetail,
  Category,
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
  userAppRolesApi,
  AppType
} from './apps';
export type {
  App,
  Scope,
  AppPermission,
  CreateAppDto,
  UpdateAppDto,
  CreateScopeDto,
  AssignUserRoleDto,
  AppsResponse,
  ScopesResponse,
  PermissionsResponse,
  GetAppsParams,
  GetScopesParams,
  GetPermissionsParams as GetAppPermissionsParams
} from './apps';

// Scopes exports (nuevo módulo de scopes)
export { scopesApi as scopesApiV2 } from './scopes';
export type {
  Scope as ScopeV2,
  ResolvedScope,
  CreateScopeDto as CreateScopeDtoV2,
  UpdateScopeDto,
  GetScopesParams as GetScopesParamsV2,
  ScopesPaginatedResponse,
  TargetScope,
  CheckAccessResponse,
  AppScopeStats,
  CacheStats,
  ScopesMetrics,
  ScopeLevel,
  AccessType,
  UserScope,
  AssignUserScopeDto,
  UpdateUserScopeDto,
  UserScopesPaginatedResponse
} from './scopes';

// Companies exports (Multi-Tenancy)
export { companiesApi } from './companies';
export type {
  Company,
  UserCompany,
  UserCompanySite,
  CompaniesResponse,
  CreateCompanyRequest,
  UpdateCompanyRequest,
  GetCompaniesParams,
  AssignUserToCompanyRequest,
  AssignUserToSitesRequest,
  UserCompaniesResponse,
  UserSitesResponse,
  UserCompanyStatus,
  AppScopeLevel,
  AppScope,
  TenantContext,
  TenantHeaders
} from '@/types/companies';

// Sites exports
export { sitesApi } from './sites';
export { sitesService } from './sites';
export type {
  Site,
  SiteAdmin,
  SitesResponse,
  CreateSiteRequest,
  UpdateSiteRequest,
  GetSitesParams,
  AddAdminRequest
} from '@/types/sites';

// Warehouses exports
export { warehousesApi, warehouseAreasApi } from './warehouses';
export { accessApi } from './access';

// Inventory API
export { inventoryApi } from './inventory';
export type {
  StockItem,
  StockAdjustmentReason,
  AdjustStockDto,
  TransferStockDto,
  StockResponse,
  StockByProductResponse,
  StockByWarehouseResponse,
} from './inventory';
export type {
  Warehouse,
  WarehouseArea,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  CreateWarehouseAreaRequest,
  UpdateWarehouseAreaRequest,
  WarehousesResponse,
  WarehouseAreasResponse
} from '@/types/warehouses';

export type {
  CheckScopeParams,
  CheckScopeResponse,
  UserAccessibleScope,
  UserScopesResponse
} from './access';

// Price Profiles exports
export { priceProfilesApi } from './price-profiles';
export type {
  PriceProfile,
  ProductSalePrice,
  PriceProfilesResponse,
  CreatePriceProfileRequest,
  UpdatePriceProfileRequest,
  GetPriceProfilesParams,
  UpdateSalePriceRequest,
  ProductSalePricesResponse,
  RecalculatePricesResponse
} from '@/types/price-profiles';

// Presentations exports
export { presentationsApi } from './presentations';
export type {
  Presentation,
  PresentationsResponse,
  CreatePresentationDto,
  UpdatePresentationDto,
  GetPresentationsParams
} from './presentations';

// Suppliers exports
export { suppliersService, paymentMethodsService } from './suppliers';
export type {
  Supplier,
  SupplierLegalEntity,
  SupplierContact,
  SupplierBankAccount,
  SupplierCompanyDebt,
  SupplierUnassignedBalance,
  SupplierDebtTransaction,
  SupplierPayment,
  PaymentMethod,
  SuppliersResponse,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  QuerySuppliersParams,
  CreateSupplierLegalEntityDto,
  UpdateLegalEntityRequest,
  CreateSupplierContactDto,
  UpdateContactRequest,
  CreateBankAccountRequest,
  UpdateBankAccountRequest,
  CreateDebtTransactionRequest,
  AssignCompanyRequest,
  CreatePaymentRequest,
  SupplierDebtSummaryResponse,
  DebtByCompany,
  TransactionsResponse,
  PaymentsResponse,
  QueryTransactionsParams,
  QueryPaymentsParams,
  CreatePaymentMethodRequest,
  UpdatePaymentMethodRequest,
  LocationAccuracy,
  LocationSource,
  BankAccountType,
  TransactionType,
  PaymentStatus
} from '@/types/suppliers';

// Purchases exports
export { purchasesService } from './purchases';
export type { OcrScanResponse, OcrScannedItem } from '@/types/purchases';
export type {
  Purchase,
  PurchaseProduct,
  PurchaseStatusHistory,
  PurchaseProductValidation,
  PurchasesResponse,
  CreatePurchaseRequest,
  UpdatePurchaseRequest,
  AddProductRequest,
  UpdateProductRequest,
  ValidateProductRequest,
  ValidatedPresentationConfig,
  RejectProductRequest,
  AssignDebtRequest,
  QueryPurchasesParams,
  PurchaseSummaryResponse,
  ValidationStatusResponse,
  PurchaseStatus,
  PurchaseProductStatus,
  GuideType,
  GuideFile,
  PurchaseStatusLabels,
  PurchaseProductStatusLabels,
  GuideTypeLabels,
  PurchaseStatusColors,
  PurchaseProductStatusColors
} from '@/types/purchases';

// Expenses exports
export { expensesService } from './expenses';
export type {
  Expense,
  ExpenseCategory,
  ExpenseProject,
  ExpenseRecurrence,
  ExpenseInstance,
  ExpensePayment,
  ExpenseAlertConfig,
  ExpenseAlertContact,
  ExpenseAlertLog,
  ExpensePaymentInfo,
  ExpenseAttachment,
  ExpensesResponse,
  ExpenseCategoriesResponse,
  ExpenseProjectsResponse,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  CreateExpenseCategoryRequest,
  UpdateExpenseCategoryRequest,
  CreateExpenseProjectRequest,
  UpdateExpenseProjectRequest,
  CreateExpenseRecurrenceRequest,
  UpdateExpenseRecurrenceRequest,
  CreateExpensePaymentRequest,
  UpdateExpensePaymentRequest,
  CreateExpenseAlertConfigRequest,
  UpdateExpenseAlertConfigRequest,
  CreateExpenseAlertContactRequest,
  UpdateExpenseAlertContactRequest,
  CreateExpensePaymentInfoRequest,
  UpdateExpensePaymentInfoRequest,
  QueryExpensesParams,
  QueryExpenseProjectsParams,
  ExpenseSummaryResponse,
  ProjectSummaryResponse,
  ExpenseType,
  CostType,
  ExpenseStatus,
  PaymentMethod,
  RecurrenceType,
  RecurrenceFrequency,
  ProjectStatus,
  PaymentStatus,
  ExpenseTypeLabels,
  CostTypeLabels,
  ExpenseStatusLabels,
  PaymentMethodLabels,
  RecurrenceFrequencyLabels,
  ProjectStatusLabels,
  PaymentStatusLabels,
  ExpenseStatusColors,
  ProjectStatusColors,
  PaymentStatusColors
} from '@/types/expenses';

// Campaigns exports
export { campaignsService } from './campaigns';
export type {
  Campaign,
  CampaignParticipant,
  CampaignProduct,
  CampaignCustomDistribution,
  CampaignCustomDistributionItem,
  CampaignsResponse,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  AddParticipantRequest,
  UpdateParticipantRequest,
  AddProductRequest,
  AddProductsFromPurchaseRequest,
  UpdateProductRequest,
  SetCustomDistributionRequest,
  DistributionPreviewResponse,
  DistributionPreviewItem,
  DistributionPreviewRequest,
  ParticipantPreference,
  DistributionResultResponse,
  DistributionResultDetail,
  GenerateDistributionRequest,
  DistributionGenerateItem,
  QueryCampaignsParams,
  CampaignStatus,
  ParticipantType,
  DistributionType,
  ProductStatus,
  ProductSourceType,
  CampaignStatusLabels,
  ParticipantTypeLabels,
  DistributionTypeLabels,
  ProductStatusLabels,
  ProductSourceTypeLabels,
  CampaignStatusColors,
  ProductStatusColors,
  DistributionTypeDescriptions
} from '@/types/campaigns';

// Repartos exports
export { repartosService } from './repartos';
export type {
  Reparto,
  RepartoParticipante,
  RepartoProducto,
  ValidacionSalida,
  RepartosResponse,
  CreateRepartoRequest,
  UpdateRepartoRequest,
  ValidarSalidaRequest,
  QueryRepartosParams,
  RepartoStatus,
  RepartoProductoStatus,
  RepartoProductoValidationStatus,
  RepartoStatusLabels,
  RepartoProductoStatusLabels,
  RepartoProductoValidationStatusLabels,
  RepartoStatusColors,
  RepartoProductoStatusColors,
  RepartoProductoValidationStatusColors
} from '@/types/repartos';

// Balances exports
export { balancesApi } from './balances';
export type {
  Balance,
  BalanceOperation,
  BalanceSummary,
  EmitterSummary,
  CreateBalanceRequest,
  UpdateBalanceRequest,
  QueryBalanceRequest,
  CreateBalanceOperationRequest,
  UpdateBalanceOperationRequest,
  QueryBalanceOperationRequest,
  PaginatedResponse,
  BalanceType,
  BalanceStatus,
  OperationType
} from '@/types/balances';


// Transmisiones exports
export { transmisionesApi } from './transmisiones';
export type {
  Transmision,
  TransmisionProduct,
  TransmisionWithProducts,
  CreateTransmisionRequest,
  UpdateTransmisionRequest,
  AddProductToTransmisionRequest,
  QuickEditPricesRequest,
  ValidationCheckResult,
  UpdateProductDataResult,
  QueryTransmisionesRequest,
  PaginatedTransmisionesResponse,
  PaginatedTransmisionProductsResponse,
  TransmisionStatus,
  ProductStatus,
  TransmisionStatusLabels,
  TransmisionStatusColors,
  ProductStatusLabels,
  ProductStatusColors
} from '@/types/transmisiones';

