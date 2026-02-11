import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/auth';
import { lazyLoad } from '@/utils/lazyLoad';

// Type Definitions
import { AuthStackParamList, MainStackParamList } from '@/types/navigation';
import { AUTH_ROUTES, MAIN_ROUTES } from '@/constants/routes';

// ============================================
// EAGER LOADED - Critical screens (always loaded)
// ============================================

// Auth Screens (always needed immediately)
import LoginScreen from '@/screens/Auth/LoginScreen';
import RegisterScreen from '@/screens/Auth/RegisterScreen';

// Selection Screens (needed after login)
import { CompanySelectionScreen } from '@/screens/Selection/CompanySelectionScreen';
import { SiteSelectionScreen } from '@/screens/Selection/SiteSelectionScreen';

// Home Screen (first screen after auth)
import HomeScreen from '@/screens/Home/HomeScreen';

// ============================================
// LAZY LOADED - Heavy screens (loaded on demand)
// ============================================

// Main Screens - Lazy Loaded
const CompaniesScreen = lazyLoad(() => import('@/screens/Companies/CompaniesScreen').then(m => ({ default: m.CompaniesScreen })));
const CompanyDetailScreen = lazyLoad(() => import('@/screens/Companies/CompanyDetailScreen').then(m => ({ default: m.CompanyDetailScreen })));
const RolesPermissionsScreen = lazyLoad(() => import('@/screens/Roles/RolesPermissionsScreen').then(m => ({ default: m.RolesPermissionsScreen })));
const UsersScreen = lazyLoad(() => import('@/screens/Users/UsersScreen').then(m => ({ default: m.UsersScreen })));
const AppsScreen = lazyLoad(() => import('@/screens/Apps/AppsScreen').then(m => ({ default: m.AppsScreen })));
const SitesScreen = lazyLoad(() => import('@/screens/Sites/SitesScreen').then(m => ({ default: m.SitesScreen })));
const WarehousesScreen = lazyLoad(() => import('@/screens/Warehouses').then(m => ({ default: m.WarehousesScreen })));
const WarehouseAreasScreen = lazyLoad(() => import('@/screens/Warehouses').then(m => ({ default: m.WarehouseAreasScreen })));
const PermissionsDebugScreen = lazyLoad(() => import('@/screens/Debug/PermissionsDebugScreen').then(m => ({ default: m.PermissionsDebugScreen })));
const ProductsScreen = lazyLoad(() => import('@/screens/Inventory/ProductsScreen').then(m => ({ default: m.ProductsScreen })), 'Cargando productos...');
const StockScreen = lazyLoad(() => import('@/screens/Inventory/StockScreen').then(m => ({ default: m.StockScreen })), 'Cargando inventario...');
const PriceProfilesScreen = lazyLoad(() => import('@/screens/PriceProfiles/PriceProfilesScreen').then(m => ({ default: m.PriceProfilesScreen })));
const PresentationsScreen = lazyLoad(() => import('@/screens/Presentations/PresentationsScreen').then(m => ({ default: m.PresentationsScreen })));

// Transfers Screens - Lazy Loaded
const InternalTransfersScreen = lazyLoad(() => import('@/screens/Transfers/InternalTransfersScreen'));
const ExternalTransfersScreen = lazyLoad(() => import('@/screens/Transfers/ExternalTransfersScreen'));
const ReceptionsScreen = lazyLoad(() => import('@/screens/Transfers/ReceptionsScreen'));
const TransferDetailScreen = lazyLoad(() => import('@/screens/Transfers/TransferDetailScreen'));

// Suppliers Screens - Lazy Loaded
const SuppliersScreen = lazyLoad(() => import('@/screens/Suppliers/SuppliersScreen').then(m => ({ default: m.SuppliersScreen })));
const SupplierDetailScreen = lazyLoad(() => import('@/screens/Suppliers/SupplierDetailScreen').then(m => ({ default: m.SupplierDetailScreen })));
const SupplierDebtsScreen = lazyLoad(() => import('@/screens/Suppliers/SupplierDebtsScreen').then(m => ({ default: m.SupplierDebtsScreen })));

// Customers Screens - Lazy Loaded
const CustomersScreen = lazyLoad(() => import('@/screens/Customers').then(m => ({ default: m.CustomersScreen })));
const CustomerDetailScreen = lazyLoad(() => import('@/screens/Customers').then(m => ({ default: m.CustomerDetailScreen })));

// Purchases Screens - Lazy Loaded
const PurchasesScreen = lazyLoad(() => import('@/screens/Purchases/PurchasesScreen').then(m => ({ default: m.PurchasesScreen })), 'Cargando compras...');
const CreatePurchaseScreen = lazyLoad(() => import('@/screens/Purchases/CreatePurchaseScreen').then(m => ({ default: m.CreatePurchaseScreen })));
const PurchaseDetailScreen = lazyLoad(() => import('@/screens/Purchases/PurchaseDetailScreen').then(m => ({ default: m.PurchaseDetailScreen })));
const AddPurchaseProductScreen = lazyLoad(() => import('@/screens/Purchases/AddPurchaseProductScreen').then(m => ({ default: m.AddPurchaseProductScreen })));
const EditPurchaseProductScreen = lazyLoad(() => import('@/screens/Purchases/EditPurchaseProductScreen').then(m => ({ default: m.EditPurchaseProductScreen })));
const ValidatePurchaseProductScreen = lazyLoad(() => import('@/screens/Purchases/ValidatePurchaseProductScreen').then(m => ({ default: m.ValidatePurchaseProductScreen })));
const AssignDebtScreen = lazyLoad(() => import('@/screens/Purchases/AssignDebtScreen').then(m => ({ default: m.AssignDebtScreen })));

// Expenses Screens - Lazy Loaded
const ExpensesScreen = lazyLoad(() => import('@/screens/Expenses/ExpensesScreen').then(m => ({ default: m.ExpensesScreen })), 'Cargando gastos...');
const CreateExpenseScreen = lazyLoad(() => import('@/screens/Expenses/CreateExpenseScreen').then(m => ({ default: m.CreateExpenseScreen })));
const ExpenseDetailScreen = lazyLoad(() => import('@/screens/Expenses/ExpenseDetailScreen').then(m => ({ default: m.ExpenseDetailScreen })));
const CreateExpensePaymentScreen = lazyLoad(() => import('@/screens/Expenses/CreateExpensePaymentScreen').then(m => ({ default: m.CreateExpensePaymentScreen })));
const ExpenseProjectsScreen = lazyLoad(() => import('@/screens/Expenses/ExpenseProjectsScreen').then(m => ({ default: m.ExpenseProjectsScreen })));
const CreateExpenseProjectScreen = lazyLoad(() => import('@/screens/Expenses/CreateExpenseProjectScreen').then(m => ({ default: m.CreateExpenseProjectScreen })));
const ExpenseProjectDetailScreen = lazyLoad(() => import('@/screens/Expenses/ExpenseProjectDetailScreen').then(m => ({ default: m.ExpenseProjectDetailScreen })));
const ExpenseCategoriesScreen = lazyLoad(() => import('@/screens/Expenses/ExpenseCategoriesScreen').then(m => ({ default: m.ExpenseCategoriesScreen })));
const ExpenseCategoryDetailScreen = lazyLoad(() => import('@/screens/Expenses/ExpenseCategoryDetailScreen').then(m => ({ default: m.ExpenseCategoryDetailScreen })));
const ExpenseReportsScreen = lazyLoad(() => import('@/screens/Expenses/ExpenseReportsScreen').then(m => ({ default: m.ExpenseReportsScreen })));
const ExpenseTemplatesScreen = lazyLoad(() => import('@/screens/Expenses/ExpenseTemplatesScreen').then(m => ({ default: m.ExpenseTemplatesScreen })));
const CreateExpenseTemplateScreen = lazyLoad(() => import('@/screens/Expenses/CreateExpenseTemplateScreen').then(m => ({ default: m.CreateExpenseTemplateScreen })));
const TemplateExpensesScreen = lazyLoad(() => import('@/screens/Expenses/TemplateExpensesScreen').then(m => ({ default: m.TemplateExpensesScreen })));

// Campaigns Screens - Lazy Loaded
const CampaignsScreen = lazyLoad(() => import('@/screens/Campaigns').then(m => ({ default: m.CampaignsScreen })), 'Cargando campañas...');
const CreateCampaignScreen = lazyLoad(() => import('@/screens/Campaigns').then(m => ({ default: m.CreateCampaignScreen })));
const CampaignDetailScreen = lazyLoad(() => import('@/screens/Campaigns').then(m => ({ default: m.CampaignDetailScreen })));
const AddParticipantScreen = lazyLoad(() => import('@/screens/Campaigns').then(m => ({ default: m.AddParticipantScreen })));
const EditParticipantScreen = lazyLoad(() => import('@/screens/Campaigns').then(m => ({ default: m.EditParticipantScreen })));
const AddProductScreen = lazyLoad(() => import('@/screens/Campaigns').then(m => ({ default: m.AddProductScreen })));
const CampaignProductDetailScreen = lazyLoad(() => import('@/screens/Campaigns').then(m => ({ default: m.CampaignProductDetailScreen })));
const CampaignParticipantDetailScreen = lazyLoad(() => import('@/screens/Campaigns').then(m => ({ default: m.CampaignParticipantDetailScreen })));

// Repartos Screens - Lazy Loaded
const RepartosScreen = lazyLoad(() => import('@/screens/Repartos').then(m => ({ default: m.RepartosScreen })), 'Cargando repartos...');
const RepartoDetailScreen = lazyLoad(() => import('@/screens/Repartos').then(m => ({ default: m.RepartoDetailScreen })));
const RepartoCampaignDetailScreen = lazyLoad(() => import('@/screens/Repartos').then(m => ({ default: m.RepartoCampaignDetailScreen })));
const RepartoParticipantDetailScreen = lazyLoad(() => import('@/screens/Repartos').then(m => ({ default: m.RepartoParticipantDetailScreen })));

// Balances Screens - Lazy Loaded
const BalancesScreen = lazyLoad(() => import('@/screens/Balances').then(m => ({ default: m.BalancesScreen })));
const CreateBalanceScreen = lazyLoad(() => import('@/screens/Balances').then(m => ({ default: m.CreateBalanceScreen })));
const BalanceDetailScreen = lazyLoad(() => import('@/screens/Balances').then(m => ({ default: m.BalanceDetailScreen })));
const BalanceOperationsScreen = lazyLoad(() => import('@/screens/Balances').then(m => ({ default: m.BalanceOperationsScreen })));
const AllBalanceOperationsScreen = lazyLoad(() => import('@/screens/Balances').then(m => ({ default: m.AllBalanceOperationsScreen })));

// Transmisiones Screens - Lazy Loaded
const TransmisionesScreen = lazyLoad(() => import('@/screens/Transmisiones').then(m => ({ default: m.TransmisionesScreen })));
const CreateTransmisionScreen = lazyLoad(() => import('@/screens/Transmisiones').then(m => ({ default: m.CreateTransmisionScreen })));
const TransmisionDetailScreen = lazyLoad(() => import('@/screens/Transmisiones').then(m => ({ default: m.TransmisionDetailScreen })));

// Face Recognition Screens - Lazy Loaded
const FaceRecognitionMenuScreen = lazyLoad(() => import('@/screens/FaceRecognition').then(m => ({ default: m.FaceRecognitionMenuScreen })), 'Cargando reconocimiento facial...');
const BiometricProfilesScreen = lazyLoad(() => import('@/screens/FaceRecognition').then(m => ({ default: m.BiometricProfilesScreen })), 'Cargando perfiles...');
const RegisterFaceScreen = lazyLoad(() => import('@/screens/FaceRecognition').then(m => ({ default: m.RegisterFaceScreen })));
const VerifyFaceScreen = lazyLoad(() => import('@/screens/FaceRecognition').then(m => ({ default: m.VerifyFaceScreen })));

// Organization Screens - Lazy Loaded
const OrganizationChartScreen = lazyLoad(() => import('@/screens/Organization').then(m => ({ default: m.OrganizationChartScreen })), 'Cargando organigrama...');

// Billing Screens - Lazy Loaded
const BillingConfigMenuScreen = lazyLoad(() => import('@/screens/Billing').then(m => ({ default: m.BillingConfigMenuScreen })), 'Cargando configuración tributaria...');
const DocumentTypesScreen = lazyLoad(() => import('@/screens/Billing').then(m => ({ default: m.DocumentTypesScreen })), 'Cargando tipos de documento...');
const DocumentSeriesScreen = lazyLoad(() => import('@/screens/Billing').then(m => ({ default: m.DocumentSeriesScreen })), 'Cargando series...');
const DocumentCorrelativesScreen = lazyLoad(() => import('@/screens/Billing').then(m => ({ default: m.DocumentCorrelativesScreen })), 'Cargando correlativos...');

// Bizlinks Screens - Lazy Loaded
const BizlinksMenuScreen = lazyLoad(() => import('@/screens/Bizlinks').then(m => ({ default: m.BizlinksMenuScreen })), 'Cargando Bizlinks...');
const BizlinksGenerateDocumentsScreen = lazyLoad(() => import('@/screens/Bizlinks').then(m => ({ default: m.BizlinksGenerateDocumentsScreen })), 'Cargando generación de documentos...');
const BizlinksConfigureDocumentsScreen = lazyLoad(() => import('@/screens/Bizlinks').then(m => ({ default: m.BizlinksConfigureDocumentsScreen })), 'Cargando configuración de documentos...');
const BizlinksConfigScreen = lazyLoad(() => import('@/screens/Bizlinks').then(m => ({ default: m.BizlinksConfigScreen })), 'Cargando configuración Bizlinks...');
const BizlinksConfigCreateScreen = lazyLoad(() => import('@/screens/Bizlinks').then(m => ({ default: m.BizlinksConfigCreateScreen })), 'Cargando formulario...');
const BizlinksConfigEditScreen = lazyLoad(() => import('@/screens/Bizlinks').then(m => ({ default: m.BizlinksConfigEditScreen })), 'Cargando formulario...');
const BizlinksDocumentsScreen = lazyLoad(() => import('@/screens/Bizlinks').then(m => ({ default: m.BizlinksDocumentsScreen })), 'Cargando documentos...');
const BizlinksDocumentDetailScreen = lazyLoad(() => import('@/screens/Bizlinks').then(m => ({ default: m.BizlinksDocumentDetailScreen })), 'Cargando detalle...');
const BizlinksEmitirFacturaScreen = lazyLoad(() => import('@/screens/Bizlinks').then(m => ({ default: m.BizlinksEmitirFacturaScreen })), 'Cargando formulario...');

// RBAC Components
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

// Navigation Components
import { FloatingActionButton } from '@/components/Navigation/FloatingActionButton';
import { DrawerMenu } from '@/components/Navigation/DrawerMenu';

const AuthStackNavigator = createNativeStackNavigator<AuthStackParamList>();
const MainStackNavigator = createNativeStackNavigator<MainStackParamList>();

const AuthStack = React.memo(() => {
  const { isAuthenticated, currentCompany, currentSite } = useAuthStore();

  // Validate that we have valid data
  const hasValidCompany = !!(currentCompany && currentCompany.id && currentCompany.name);
  const hasValidSite = !!(currentSite && currentSite.id && currentSite.name);

  // Determine initial route based on authentication state
  const initialRouteName = React.useMemo(() => {
    if (isAuthenticated && !hasValidCompany) {
      return AUTH_ROUTES.COMPANY_SELECTION;
    }
    if (isAuthenticated && hasValidCompany && !hasValidSite) {
      return AUTH_ROUTES.SITE_SELECTION;
    }
    return AUTH_ROUTES.LOGIN;
  }, [isAuthenticated, hasValidCompany, hasValidSite]);

  return (
    <AuthStackNavigator.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={initialRouteName}
    >
      <AuthStackNavigator.Screen name={AUTH_ROUTES.LOGIN} component={LoginScreen} />
      <AuthStackNavigator.Screen name={AUTH_ROUTES.REGISTER} component={RegisterScreen} />
      <AuthStackNavigator.Screen
        name={AUTH_ROUTES.COMPANY_SELECTION}
        component={CompanySelectionScreen}
      />
      <AuthStackNavigator.Screen
        name={AUTH_ROUTES.SITE_SELECTION}
        component={SiteSelectionScreen}
      />
    </AuthStackNavigator.Navigator>
  );
});

const MainStack = React.memo(() => {
  return (
    <MainStackNavigator.Navigator screenOptions={{ headerShown: false }}>
      <MainStackNavigator.Screen name={MAIN_ROUTES.HOME} component={HomeScreen} />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.COMPANIES}
        component={CompaniesScreen}
        options={{
          title: 'Gestión de Empresas',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.COMPANY_DETAIL}
        component={CompanyDetailScreen}
        options={{
          title: 'Detalle de Empresa',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.SITES}
        component={SitesScreen}
        options={{
          title: 'Gestión de Sedes',
        }}
      />
      <MainStackNavigator.Screen
        name="Warehouses"
        component={WarehousesScreen}
        options={{
          title: 'Gestión de Almacenes',
        }}
      />
      <MainStackNavigator.Screen
        name="WarehouseAreas"
        component={WarehouseAreasScreen}
        options={{
          title: 'Gestión de Áreas',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.USERS}
        options={{
          title: 'Gestión de Usuarios',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['users.read', 'users.create', 'users.update']} requireAll={false}>
            <UsersScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.ROLES_PERMISSIONS}
        options={{
          title: 'Roles y Permisos',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['roles.read', 'permissions.read']} requireAll={false}>
            <RolesPermissionsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.APPS}
        options={{
          title: 'Gestión de Apps',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['apps.read']}>
            <AppsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.PERMISSIONS_DEBUG}
        options={{
          title: 'Debug de Permisos',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['permissions.read']}>
            <PermissionsDebugScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.PRODUCTS}
        options={{
          title: 'Gestión de Productos',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={['products.read', 'products.create', 'products.update']}
          >
            <ProductsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.STOCK}
        options={{
          title: 'Gestión de Inventario',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['products.read']} requireAll={false}>
            <StockScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.PRICE_PROFILES}
        component={PriceProfilesScreen}
        options={{
          title: 'Perfiles de Precio',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.PRESENTATIONS}
        component={PresentationsScreen}
        options={{
          title: 'Presentaciones',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.INTERNAL_TRANSFERS}
        options={{
          title: 'Traslados Internos',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={[
              'transfers.read',
              'transfers.create',
            ]}
            requireAll={false}
          >
            <InternalTransfersScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXTERNAL_TRANSFERS}
        options={{
          title: 'Traslados Externos',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={[
              'transfers.read',
              'transfers.create',
            ]}
            requireAll={false}
          >
            <ExternalTransfersScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.RECEPTIONS}
        options={{
          title: 'Recepciones',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={[
              'transfers.receive',
              'transfers.validate',
              'transfers.complete',
            ]}
            requireAll={false}
          >
            <ReceptionsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.TRANSFER_DETAIL}
        component={TransferDetailScreen}
        options={{
          title: 'Detalle de Traslado',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.SUPPLIERS}
        options={{
          title: 'Proveedores',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={[
              'suppliers.read',
              'suppliers.create',
              'suppliers.update',
              'providers.read',
            ]}
          >
            <SuppliersScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.SUPPLIER_DETAIL}
        component={SupplierDetailScreen}
        options={{
          title: 'Detalle de Proveedor',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.SUPPLIER_DEBTS}
        component={SupplierDebtsScreen}
        options={{
          title: 'Deudas de Proveedor',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.CUSTOMERS}
        options={{
          title: 'Clientes',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={[
              'customers.read',
              'customers.create',
              'customers.update',
            ]}
          >
            <CustomersScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.CUSTOMER_DETAIL}
        component={CustomerDetailScreen}
        options={{
          title: 'Detalle de Cliente',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.PURCHASES}
        options={{
          title: 'Compras',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={['purchases.read', 'purchases.create', 'purchases.update']}
          >
            <PurchasesScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.CREATE_PURCHASE}
        options={{
          title: 'Nueva Compra',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['purchases.create']}>
            <CreatePurchaseScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.PURCHASE_DETAIL}
        component={PurchaseDetailScreen}
        options={{
          title: 'Detalle de Compra',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.ADD_PURCHASE_PRODUCT}
        component={AddPurchaseProductScreen}
        options={{
          title: 'Agregar Producto',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EDIT_PURCHASE_PRODUCT}
        component={EditPurchaseProductScreen}
        options={{
          title: 'Editar Producto',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.VALIDATE_PURCHASE_PRODUCT}
        component={ValidatePurchaseProductScreen}
        options={{
          title: 'Validar Producto',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.ASSIGN_DEBT}
        component={AssignDebtScreen}
        options={{
          title: 'Asignar Deudas',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXPENSES}
        options={{
          title: 'Gastos',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['expenses.read']}>
            <ExpensesScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.CREATE_EXPENSE}
        component={CreateExpenseScreen}
        options={{
          title: 'Crear Gasto',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXPENSE_DETAIL}
        component={ExpenseDetailScreen}
        options={{
          title: 'Detalle de Gasto',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.CREATE_EXPENSE_PAYMENT}
        component={CreateExpensePaymentScreen}
        options={{
          title: 'Registrar Pago',
        }}
      />
      {/* ExpensePaymentsScreen removed - payments are now managed within each expense detail */}
      {/* <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXPENSES_PAYMENTS}
        options={{
          title: 'Pagos de Gastos'
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['expenses.payments.read']}>
            <ExpensePaymentsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen> */}
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXPENSES_PROJECTS}
        options={{
          title: 'Proyectos de Gastos',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['expenses.projects.read']}>
            <ExpenseProjectsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.CREATE_EXPENSE_PROJECT}
        component={CreateExpenseProjectScreen}
        options={{
          title: 'Nuevo Proyecto',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXPENSE_PROJECT_DETAIL}
        component={ExpenseProjectDetailScreen}
        options={{
          title: 'Detalle del Proyecto',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXPENSES_CATEGORIES}
        options={{
          title: 'Categorías de Gastos',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['expenses.categories.read']}>
            <ExpenseCategoriesScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXPENSE_CATEGORY_DETAIL}
        component={ExpenseCategoryDetailScreen}
        options={{
          title: 'Detalle de Categoría',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXPENSES_REPORTS}
        options={{
          title: 'Reportes de Gastos',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['expenses.reports.view']}>
            <ExpenseReportsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXPENSE_TEMPLATES}
        options={{
          title: 'Gastos Recurrentes',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['expenses.templates.read']}>
            <ExpenseTemplatesScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.CREATE_EXPENSE_TEMPLATE}
        options={{
          title: 'Crear Plantilla',
        }}
      >
        {(props) => <CreateExpenseTemplateScreen {...props} />}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EDIT_EXPENSE_TEMPLATE}
        options={{
          title: 'Editar Plantilla',
        }}
      >
        {(props) => <CreateExpenseTemplateScreen {...props} />}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.TEMPLATE_EXPENSES}
        options={{
          title: 'Gastos Generados',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['expenses.templates.read']}>
            <TemplateExpensesScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name="Campaigns"
        options={{
          title: 'Campañas',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['campaigns.read', 'campaigns.create']}>
            <CampaignsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name="CreateCampaign"
        component={CreateCampaignScreen}
        options={{
          title: 'Nueva Campaña',
        }}
      />
      <MainStackNavigator.Screen
        name="CampaignDetail"
        component={CampaignDetailScreen}
        options={{
          title: 'Detalle de Campaña',
        }}
      />
      <MainStackNavigator.Screen
        name="AddCampaignParticipant"
        component={AddParticipantScreen}
        options={{
          title: 'Agregar Participante',
        }}
      />
      <MainStackNavigator.Screen
        name="EditCampaignParticipant"
        component={EditParticipantScreen}
        options={{
          title: 'Editar Participante',
        }}
      />
      <MainStackNavigator.Screen
        name="AddCampaignProduct"
        component={AddProductScreen}
        options={{
          title: 'Agregar Producto',
        }}
      />
      <MainStackNavigator.Screen
        name="CampaignProductDetail"
        component={CampaignProductDetailScreen}
        options={{
          title: 'Detalle de Producto',
        }}
      />
      <MainStackNavigator.Screen
        name="ParticipantDetail"
        component={CampaignParticipantDetailScreen}
        options={{
          title: 'Detalle de Participante',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.REPARTOS}
        options={{
          title: 'Repartos',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['campaigns.read', 'campaigns.create']}>
            <RepartosScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name="RepartoCampaignDetail"
        component={RepartoCampaignDetailScreen}
        options={{
          title: 'Participantes de Campaña',
        }}
      />
      <MainStackNavigator.Screen
        name="RepartoParticipantDetail"
        component={RepartoParticipantDetailScreen}
        options={{
          title: 'Productos de Reparto',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.REPARTO_DETAIL}
        component={RepartoDetailScreen}
        options={{
          title: 'Detalle de Reparto',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BALANCES}
        options={{
          title: 'Balances',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={['balances.read', 'balances.create', 'balances.update']}
          >
            <BalancesScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.CREATE_BALANCE}
        component={CreateBalanceScreen}
        options={{
          title: 'Nuevo Balance',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BALANCE_DETAIL}
        component={BalanceDetailScreen}
        options={{
          title: 'Detalle de Balance',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BALANCE_OPERATIONS}
        options={{
          title: 'Operaciones de Balance',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={[
              'balances.operations.read',
              'balances.operations.create',
              'balances.operations.update',
            ]}
          >
            <BalanceOperationsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.ALL_BALANCE_OPERATIONS}
        options={{
          title: 'Todas las Operaciones',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['balances.operations.read']}>
            <AllBalanceOperationsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.TRANSMISIONES}
        options={{
          title: 'Transmisiones',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={[
              'transmisiones.read',
              'transmisiones.create',
              'transmisiones.update',
            ]}
          >
            <TransmisionesScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.CREATE_TRANSMISION}
        options={{
          title: 'Nueva Transmisión',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['transmisiones.create']}>
            <CreateTransmisionScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.TRANSMISION_DETAIL}
        component={TransmisionDetailScreen}
        options={{
          title: 'Detalle de Transmisión',
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.FACE_RECOGNITION_MENU}
        options={{
          title: 'Reconocimiento Facial',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={['biometric.read', 'biometric.register', 'biometric.verify']}
            requireAll={false}
          >
            <FaceRecognitionMenuScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BIOMETRIC_PROFILES}
        options={{
          title: 'Perfiles Biométricos',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['biometric.read']}>
            <BiometricProfilesScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.REGISTER_FACE}
        options={{
          title: 'Registrar Rostro',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['biometric.register']}>
            <RegisterFaceScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.VERIFY_FACE}
        options={{
          title: 'Verificar Rostro',
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['biometric.verify']}>
            <VerifyFaceScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.ORGANIZATION_CHART}
        options={{
          title: 'Organigrama',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={[
              'organization.positions.company.read',
              'organization.positions.site.read',
            ]}
            requireAll={false}
          >
            <OrganizationChartScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      {/* Billing / Tax Configuration Screens */}
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BILLING_CONFIG}
        options={{
          title: 'Configuración Tributaria',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={[
              'billing.read',
              'billing.document-types.read',
              'billing.series.read',
              'billing.correlatives.read',
            ]}
            requireAll={false}
          >
            <BillingConfigMenuScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.DOCUMENT_TYPES}
        options={{
          title: 'Tipos de Documentos',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={[
              'billing.document-types.read',
              'billing.document-types.manage',
            ]}
            requireAll={false}
          >
            <DocumentTypesScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.DOCUMENT_SERIES}
        options={{
          title: 'Series de Documentos',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={[
              'billing.series.read',
              'billing.series.create',
              'billing.series.update',
            ]}
            requireAll={false}
          >
            <DocumentSeriesScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.DOCUMENT_CORRELATIVES}
        options={{
          title: 'Correlativos',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={['billing.correlatives.read']}
          >
            <DocumentCorrelativesScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>

      {/* Bizlinks Screens */}
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BIZLINKS_MENU}
        options={{
          title: 'Bizlinks',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={['bizlinks.read']}
          >
            <BizlinksMenuScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BIZLINKS_GENERATE_DOCUMENTS}
        options={{
          title: 'Generar Documentos',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={['bizlinks.documents.emit']}
          >
            <BizlinksGenerateDocumentsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BIZLINKS_CONFIGURE_DOCUMENTS}
        options={{
          title: 'Configurar Documentos',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={['bizlinks.config.view']}
          >
            <BizlinksConfigureDocumentsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BIZLINKS_CONFIG}
        options={{
          title: 'Configuración Bizlinks',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={['bizlinks.config.view']}
          >
            <BizlinksConfigScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BIZLINKS_CONFIG_CREATE}
        options={{
          title: 'Crear Configuración',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={['bizlinks.config.create']}
          >
            <BizlinksConfigCreateScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BIZLINKS_CONFIG_EDIT}
        options={{
          title: 'Editar Configuración',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={['bizlinks.config.update']}
          >
            <BizlinksConfigEditScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BIZLINKS_DOCUMENTS}
        options={{
          title: 'Documentos Electrónicos',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={['bizlinks.documents.view']}
          >
            <BizlinksDocumentsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BIZLINKS_DOCUMENT_DETAIL}
        options={{
          title: 'Detalle de Documento',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={['bizlinks.documents.view']}
          >
            <BizlinksDocumentDetailScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BIZLINKS_EMITIR_FACTURA}
        options={{
          title: 'Emitir Factura',
        }}
      >
        {(props) => (
          <ProtectedRoute
            requiredPermissions={['bizlinks.documents.emit']}
          >
            <BizlinksEmitirFacturaScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>

      <MainStackNavigator.Screen
        name={AUTH_ROUTES.SITE_SELECTION}
        component={SiteSelectionScreen}
        options={{
          title: 'Seleccionar Sede',
        }}
      />
    </MainStackNavigator.Navigator>
  );
});

const NAVIGATION_PERSISTENCE_KEY = 'NAVIGATION_STATE_V1';

export const Navigation = () => {
  const { isAuthenticated, currentCompany, currentSite } = useAuthStore();
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [initialState, setInitialState] = useState();
  const navigationRef = useRef<any>(null);

  // Validate that site has valid data (not just an empty object)
  const hasValidSite = !!(currentSite && currentSite.id && currentSite.name);
  const hasValidCompany = !!(currentCompany && currentCompany.id && currentCompany.name);

  // Determine which stack to show based on authentication and selection state
  const showMainStack = !!(isAuthenticated && hasValidCompany && hasValidSite);

  console.log('🔄 Navigation render:', {
    isAuthenticated,
    hasCompany: !!currentCompany,
    hasValidCompany,
    hasSite: !!currentSite,
    hasValidSite,
    showMainStack,
    companyData: currentCompany,
    siteData: currentSite,
  });

  // Load persisted navigation state
  useEffect(() => {
    const restoreState = async () => {
      try {
        const savedStateString = await AsyncStorage.getItem(NAVIGATION_PERSISTENCE_KEY);
        const state = savedStateString ? JSON.parse(savedStateString) : undefined;

        if (state !== undefined) {
          setInitialState(state);
        }
      } catch (e) {
        console.warn('Failed to restore navigation state:', e);
      } finally {
        setIsReady(true);
      }
    };

    if (!isReady) {
      restoreState();
    }
  }, [isReady]);

  // Handle navigation based on auth state changes
  useEffect(() => {
    if (!isReady || !navigationRef.current) {
      return;
    }

    // Si está autenticado pero no tiene empresa válida, navegar a CompanySelection
    if (isAuthenticated && !hasValidCompany && !showMainStack) {
      console.log('🔄 Auto-navegando a CompanySelection (desde Navigation useEffect)');
      navigationRef.current?.reset({
        index: 0,
        routes: [{ name: AUTH_ROUTES.COMPANY_SELECTION }],
      });
    }
    // Si está autenticado, tiene empresa pero no sede válida, navegar a SiteSelection
    else if (isAuthenticated && hasValidCompany && !hasValidSite && !showMainStack) {
      console.log('🔄 Auto-navegando a SiteSelection (desde Navigation useEffect)');
      navigationRef.current?.reset({
        index: 0,
        routes: [{ name: AUTH_ROUTES.SITE_SELECTION }],
      });
    }
  }, [isAuthenticated, hasValidCompany, hasValidSite, showMainStack, isReady]);

  // Don't render until we've restored state
  if (!isReady) {
    return null;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      initialState={initialState}
      onStateChange={(state) => {
        // Save navigation state whenever it changes
        AsyncStorage.setItem(NAVIGATION_PERSISTENCE_KEY, JSON.stringify(state));
      }}
    >
      <View style={{ flex: 1 }}>
        {showMainStack ? <MainStack /> : <AuthStack />}
        {showMainStack && (
          <>
            <FloatingActionButton onPress={() => setIsDrawerVisible(true)} />
            <DrawerMenu visible={isDrawerVisible} onClose={() => setIsDrawerVisible(false)} />
          </>
        )}
      </View>
    </NavigationContainer>
  );
};

export default Navigation;
