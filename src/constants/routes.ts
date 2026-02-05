/**
 * Route Constants
 *
 * Centralized route names for the entire application.
 * This ensures consistency and prevents typos in navigation calls.
 */

/**
 * Authentication Routes
 */
export const AUTH_ROUTES = {
  LOGIN: 'Login',
  REGISTER: 'Register',
  COMPANY_SELECTION: 'CompanySelection',
  SITE_SELECTION: 'SiteSelection',
} as const;

/**
 * Main Application Routes
 */
export const MAIN_ROUTES = {
  // Dashboard
  HOME: 'Home',

  // Products & Inventory
  PRODUCTS: 'Products',
  STOCK: 'Stock',

  // Purchases
  PURCHASES: 'Purchases',
  CREATE_PURCHASE: 'CreatePurchase',
  PURCHASE_DETAIL: 'PurchaseDetail',
  ADD_PURCHASE_PRODUCT: 'AddPurchaseProduct',
  EDIT_PURCHASE_PRODUCT: 'EditPurchaseProduct',
  VALIDATE_PURCHASE_PRODUCT: 'ValidatePurchaseProduct',
  ASSIGN_DEBT: 'AssignDebt',

  // Expenses
  EXPENSES: 'Expenses',
  CREATE_EXPENSE: 'CreateExpense',
  EXPENSE_DETAIL: 'ExpenseDetail',
  EXPENSES_PAYMENTS: 'ExpensesPayments',
  CREATE_EXPENSE_PAYMENT: 'CreateExpensePayment',
  EXPENSES_PROJECTS: 'ExpensesProjects',
  CREATE_EXPENSE_PROJECT: 'CreateExpenseProject',
  EXPENSE_PROJECT_DETAIL: 'ExpenseProjectDetail',
  EXPENSES_CATEGORIES: 'ExpensesCategories',
  EXPENSE_CATEGORY_DETAIL: 'ExpenseCategoryDetail',
  CREATE_EXPENSE_CATEGORY: 'CreateExpenseCategory',
  EDIT_EXPENSE_CATEGORY: 'EditExpenseCategory',
  EXPENSES_REPORTS: 'ExpensesReports',
  EXPENSE_TEMPLATES: 'ExpenseTemplates',
  CREATE_EXPENSE_TEMPLATE: 'CreateExpenseTemplate',
  EDIT_EXPENSE_TEMPLATE: 'EditExpenseTemplate',
  TEMPLATE_EXPENSES: 'TemplateExpenses',

  // Transfers
  INTERNAL_TRANSFERS: 'InternalTransfers',
  EXTERNAL_TRANSFERS: 'ExternalTransfers',
  TRANSFER_DETAIL: 'TransferDetail',
  RECEPTIONS: 'Receptions',

  // Suppliers
  SUPPLIERS: 'Suppliers',
  SUPPLIER_DETAIL: 'SupplierDetail',

  // Campaigns
  CAMPAIGNS: 'Campaigns',
  CREATE_CAMPAIGN: 'CreateCampaign',
  CAMPAIGN_DETAIL: 'CampaignDetail',
  ADD_CAMPAIGN_PARTICIPANT: 'AddCampaignParticipant',
  PARTICIPANT_DETAIL: 'ParticipantDetail',
  ADD_CAMPAIGN_PRODUCT: 'AddCampaignProduct',
  CAMPAIGN_PRODUCT_DETAIL: 'CampaignProductDetail',
  MANAGE_CUSTOM_DISTRIBUTION: 'ManageCustomDistribution',

  // Repartos
  REPARTOS: 'Repartos',
  REPARTO_DETAIL: 'RepartoDetail',

  // Users & Permissions
  USERS: 'Users',
  ROLES_PERMISSIONS: 'RolesPermissions',
  PERMISSIONS_DEBUG: 'PermissionsDebug',

  // Company & Sites
  COMPANIES: 'Companies',
  COMPANY_DETAIL: 'CompanyDetail',
  SITES: 'Sites',

  // Configuration
  APPS: 'Apps',
  PRICE_PROFILES: 'PriceProfiles',
  PRESENTATIONS: 'Presentations',

  // Balances
  BALANCES: 'Balances',
  BALANCE_DETAIL: 'BalanceDetail',
  BALANCE_OPERATIONS: 'BalanceOperations',
  ALL_BALANCE_OPERATIONS: 'AllBalanceOperations',
  CREATE_BALANCE: 'CreateBalance',
  CREATE_BALANCE_OPERATION: 'CreateBalanceOperation',

  // Transmisiones
  TRANSMISIONES: 'Transmisiones',
  CREATE_TRANSMISION: 'CreateTransmision',
  TRANSMISION_DETAIL: 'TransmisionDetail',

  // Face Recognition
  FACE_RECOGNITION_MENU: 'FaceRecognitionMenu',
  BIOMETRIC_PROFILES: 'BiometricProfiles',
  REGISTER_FACE: 'RegisterFace',
  VERIFY_FACE: 'VerifyFace',

  // Organization
  ORGANIZATION_CHART: 'OrganizationChart',
} as const;

/**
 * All Routes Combined
 */
export const ROUTES = {
  ...AUTH_ROUTES,
  ...MAIN_ROUTES,
} as const;

/**
 * Menu ID to Route Mapping
 * Maps menu item IDs to their corresponding route names
 */
export const MENU_TO_ROUTE: Record<string, keyof typeof MAIN_ROUTES> = {
  dashboard: 'HOME',
  productos: 'PRODUCTS',
  stock: 'STOCK',
  compras: 'PURCHASES',
  'gastos-templates': 'CREATE_EXPENSE_TEMPLATE',
  'gastos-lista': 'EXPENSES',
  'gastos-pagos': 'EXPENSES_PAYMENTS',
  'gastos-proyectos': 'EXPENSES_PROJECTS',
  'gastos-categorias': 'EXPENSES_CATEGORIES',
  'gastos-reportes': 'EXPENSES_REPORTS',
  'traslados-internos': 'INTERNAL_TRANSFERS',
  'traslados-externos': 'EXTERNAL_TRANSFERS',
  recepciones: 'RECEPTIONS',
  proveedores: 'SUPPLIERS',
  campanas: 'CAMPAIGNS',
  usuarios: 'USERS',
  'roles-permisos': 'ROLES_PERMISSIONS',
  empresas: 'COMPANIES',
  'gestion-apps': 'APPS',
  'perfiles-precio': 'PRICE_PROFILES',
  presentaciones: 'PRESENTATIONS',
  'debug-permissions': 'PERMISSIONS_DEBUG',
  transmisiones: 'TRANSMISIONES',
};

/**
 * Route Permissions Mapping
 * Defines which permission is required to access each route
 * Based on actual permissions from the backend system
 */
export const ROUTE_PERMISSIONS: Partial<Record<keyof typeof MAIN_ROUTES, string>> = {
  // Products & Inventory
  PRODUCTS: 'products.read',
  STOCK: 'products.read',

  // Purchases
  PURCHASES: 'purchases.read',
  CREATE_PURCHASE: 'purchases.create',
  PURCHASE_DETAIL: 'purchases.read',
  ADD_PURCHASE_PRODUCT: 'purchases.products.add',
  EDIT_PURCHASE_PRODUCT: 'purchases.products.edit',
  VALIDATE_PURCHASE_PRODUCT: 'purchases.validate',
  ASSIGN_DEBT: 'purchases.debt.assign',

  // Expenses
  EXPENSES: 'expenses.read',
  CREATE_EXPENSE: 'expenses.create',
  EXPENSE_DETAIL: 'expenses.read',
  CREATE_EXPENSE_TEMPLATE: 'expenses.templates.read',
  EXPENSES_PAYMENTS: 'expenses.payments.read',
  EXPENSES_PROJECTS: 'expenses.projects.read',
  CREATE_EXPENSE_PROJECT: 'expenses.projects.create',
  EXPENSE_PROJECT_DETAIL: 'expenses.projects.read',
  EXPENSES_CATEGORIES: 'expenses.categories.read',
  EXPENSES_REPORTS: 'expenses.reports.view',
  TEMPLATE_EXPENSES: 'expenses.templates.read',

  // Transfers
  INTERNAL_TRANSFERS: 'transfers.read',
  EXTERNAL_TRANSFERS: 'transfers.read',
  TRANSFER_DETAIL: 'transfers.read',
  RECEPTIONS: 'transfers.receive',

  // Suppliers
  SUPPLIERS: 'suppliers.read',
  SUPPLIER_DETAIL: 'suppliers.read',

  // Campaigns
  CAMPAIGNS: 'campaigns.read',
  CREATE_CAMPAIGN: 'campaigns.create',
  CAMPAIGN_DETAIL: 'campaigns.read',
  ADD_CAMPAIGN_PARTICIPANT: 'campaigns.participants.create',
  ADD_CAMPAIGN_PRODUCT: 'campaigns.products.create',
  CAMPAIGN_PRODUCT_DETAIL: 'campaigns.products.read',

  // Repartos
  REPARTOS: 'campaigns.read',
  REPARTO_DETAIL: 'campaigns.read',

  // Users & Permissions
  USERS: 'users.read',
  ROLES_PERMISSIONS: 'roles.read',
  PERMISSIONS_DEBUG: 'permissions.read',

  // Company & Sites
  COMPANIES: 'companies.read',
  SITES: 'sites.read',

  // Configuration
  APPS: 'apps.manage',
  PRICE_PROFILES: 'price_profiles.read',
  PRESENTATIONS: 'presentations.read',

  // Balances
  BALANCES: 'balances.read',
  BALANCE_DETAIL: 'balances.read',
  BALANCE_OPERATIONS: 'balances.operations.read',
  ALL_BALANCE_OPERATIONS: 'balances.operations.read',
  CREATE_BALANCE: 'balances.create',
  CREATE_BALANCE_OPERATION: 'balances.operations.create',

  // Transmisiones
  TRANSMISIONES: 'transmisiones.read',
  CREATE_TRANSMISION: 'transmisiones.create',
  TRANSMISION_DETAIL: 'transmisiones.read',

  // Face Recognition
  FACE_RECOGNITION_MENU: 'biometric.read',
  BIOMETRIC_PROFILES: 'biometric.read',
  REGISTER_FACE: 'biometric.register',
  VERIFY_FACE: 'biometric.verify',

  // Organization
  ORGANIZATION_CHART: 'organization.positions.company.read',
};

/**
 * Helper function to get route name from constant
 */
export function getRouteName<T extends keyof typeof ROUTES>(routeKey: T): (typeof ROUTES)[T] {
  return ROUTES[routeKey];
}

/**
 * Helper function to check if a route requires authentication
 */
export function isAuthRoute(routeName: string): boolean {
  return Object.values(AUTH_ROUTES).includes(routeName as any);
}

/**
 * Helper function to check if a route is in the main app
 */
export function isMainRoute(routeName: string): boolean {
  return Object.values(MAIN_ROUTES).includes(routeName as any);
}

/**
 * Helper function to get permission required for a route
 */
export function getRoutePermission(routeKey: keyof typeof MAIN_ROUTES): string | undefined {
  return ROUTE_PERMISSIONS[routeKey];
}
