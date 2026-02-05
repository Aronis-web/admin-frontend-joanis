/**
 * Navigation Type Definitions
 *
 * This file contains all the type definitions for React Navigation.
 * It provides type safety for navigation and route parameters.
 */

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Auth Stack Parameter List
 * Defines all screens in the authentication flow
 */
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  CompanySelection: undefined;
  SiteSelection: {
    companyId: string;
    companyName: string;
  };
};

/**
 * Main Stack Parameter List
 * Defines all screens in the main application
 */
export type MainStackParamList = {
  // Dashboard
  Home: undefined;

  // Products & Inventory
  Products: undefined;
  Stock: undefined;

  // Purchases
  Purchases: undefined;
  CreatePurchase: undefined;
  PurchaseDetail: {
    purchaseId: string;
  };
  AddPurchaseProduct: {
    purchaseId: string;
  };
  EditPurchaseProduct: {
    purchaseId: string;
    productId: string;
  };
  ValidatePurchaseProduct: {
    purchaseId: string;
    productId: string;
  };
  AssignDebt: {
    purchaseId: string;
  };

  // Expenses
  Expenses: undefined;
  CreateExpense: undefined;
  ExpenseDetail: {
    expenseId: string;
  };
  ExpensesPayments: undefined;
  CreateExpensePayment: {
    expenseId: string;
  };
  ExpensesProjects: undefined;
  CreateExpenseProject: undefined;
  ExpenseProjectDetail: {
    projectId: string;
  };
  ExpensesCategories: undefined;
  ExpenseCategoryDetail: {
    categoryId: string;
  };
  CreateExpenseCategory: undefined;
  EditExpenseCategory: {
    categoryId: string;
  };
  ExpensesReports: undefined;
  ExpenseTemplates: undefined;
  CreateExpenseTemplate: undefined;
  EditExpenseTemplate: {
    templateId: string;
  };
  TemplateExpenses: {
    templateId: string;
    templateName: string;
  };

  // Transfers
  InternalTransfers: undefined;
  ExternalTransfers: undefined;
  TransferDetail: {
    transferId: string;
  };
  Receptions: undefined;

  // Suppliers
  Suppliers: undefined;
  SupplierDetail: {
    supplierId: string;
  };

  // Campaigns
  Campaigns: undefined;
  CreateCampaign: undefined;
  CampaignDetail: {
    campaignId: string;
    shouldReload?: boolean;
    skipReloadOnce?: boolean;
  };
  AddCampaignParticipant: {
    campaignId: string;
  };
  ParticipantDetail: {
    campaignId: string;
    participantId: string;
  };
  AddCampaignProduct: {
    campaignId: string;
  };
  CampaignProductDetail: {
    campaignId: string;
    productId: string;
    fromCampaignDetail?: boolean;
  };
  ManageCustomDistribution: {
    campaignId: string;
    productId: string;
  };

  // Repartos
  Repartos: undefined;
  RepartoCampaignDetail: {
    campaignId: string;
  };
  RepartoParticipantDetail: {
    campaignId: string;
    participantId: string;
  };
  RepartoDetail: {
    repartoId: string;
  };

  // Users & Permissions
  Users: undefined;
  RolesPermissions: undefined;
  PermissionsDebug: undefined;

  // Company & Sites
  Companies: undefined;
  CompanyDetail: {
    companyId: string;
  };
  Sites: {
    companyId?: string;
    companyName?: string;
  };

  // Warehouses & Areas
  Warehouses: {
    companyId: string;
    companyName: string;
    siteId: string;
    siteName: string;
    siteCode: string;
  };
  WarehouseAreas: {
    companyId: string;
    companyName: string;
    siteId: string;
    siteName: string;
    siteCode: string;
    warehouseId: string;
    warehouseName: string;
    warehouseCode: string;
  };

  // Configuration
  Apps: undefined;
  PriceProfiles: undefined;
  Presentations: undefined;

  // Balances
  Balances: undefined;
  BalanceDetail: {
    balanceId: string;
  };
  BalanceOperations: {
    balanceId: string;
  };
  AllBalanceOperations: undefined;
  CreateBalance: undefined;
  CreateBalanceOperation: {
    balanceId: string;
  };

  // Transmisiones
  Transmisiones: undefined;
  CreateTransmision: undefined;
  TransmisionDetail: {
    transmisionId: string;
  };

  // Face Recognition
  FaceRecognitionMenu: undefined;
  BiometricProfiles: undefined;
  RegisterFace: undefined;
  VerifyFace: undefined;

  // Organization
  OrganizationChart: undefined;
};

/**
 * Root Stack Parameter List
 * Combines both Auth and Main stacks
 */
export type RootStackParamList = AuthStackParamList & MainStackParamList;

/**
 * Screen Props Type Helpers
 * Use these to type your screen components
 *
 * Example:
 * type Props = ScreenProps<'PurchaseDetail'>;
 * const PurchaseDetailScreen: React.FC<Props> = ({ route, navigation }) => {
 *   const { purchaseId } = route.params; // Fully typed!
 * };
 */
export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

/**
 * Navigation Prop Type Helper
 * Use this when you only need the navigation prop
 *
 * Example:
 * const navigation = useNavigation<NavigationProp>();
 */
export type NavigationProp = NativeStackScreenProps<RootStackParamList>['navigation'];

/**
 * Route Prop Type Helper
 * Use this when you only need the route prop
 */
export type RouteProp<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>['route'];

/**
 * Type guard to check if a route has parameters
 */
export function hasParams<T extends keyof RootStackParamList>(
  route: RouteProp<T>
): route is RouteProp<T> & { params: NonNullable<RootStackParamList[T]> } {
  return route.params !== undefined;
}

/**
 * Helper to safely get route parameters with validation
 */
export function getRouteParams<T extends keyof RootStackParamList>(
  route: RouteProp<T>,
  screenName: T
): RootStackParamList[T] {
  if (!hasParams(route)) {
    throw new Error(`Screen ${screenName} requires parameters but none were provided`);
  }
  return route.params;
}
