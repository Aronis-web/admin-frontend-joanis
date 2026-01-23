import React, { useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/auth';

// Type Definitions
import { AuthStackParamList, MainStackParamList } from '@/types/navigation';
import { AUTH_ROUTES, MAIN_ROUTES } from '@/constants/routes';

// Auth Screens
import LoginScreen from '@/screens/Auth/LoginScreen';
import RegisterScreen from '@/screens/Auth/RegisterScreen';

// Selection Screens
import { CompanySelectionScreen } from '@/screens/Selection/CompanySelectionScreen';
import { SiteSelectionScreen } from '@/screens/Selection/SiteSelectionScreen';

// Main Screens
import HomeScreen from '@/screens/Home/HomeScreen';
import { CompaniesScreen } from '@/screens/Companies/CompaniesScreen';
import { CompanyDetailScreen } from '@/screens/Companies/CompanyDetailScreen';
import { RolesPermissionsScreen } from '@/screens/Roles/RolesPermissionsScreen';
import { UsersScreen } from '@/screens/Users/UsersScreen';
import { AppsScreen } from '@/screens/Apps/AppsScreen';
import { SitesScreen } from '@/screens/Sites/SitesScreen';
import { WarehousesScreen, WarehouseAreasScreen } from '@/screens/Warehouses';
import { PermissionsDebugScreen } from '@/screens/Debug/PermissionsDebugScreen';
import { ProductsScreen } from '@/screens/Inventory/ProductsScreen';
import { StockScreen } from '@/screens/Inventory/StockScreen';
import { PriceProfilesScreen } from '@/screens/PriceProfiles/PriceProfilesScreen';
import { PresentationsScreen } from '@/screens/Presentations/PresentationsScreen';

// Transfers Screens
import InternalTransfersScreen from '@/screens/Transfers/InternalTransfersScreen';
import ExternalTransfersScreen from '@/screens/Transfers/ExternalTransfersScreen';
import ReceptionsScreen from '@/screens/Transfers/ReceptionsScreen';
import TransferDetailScreen from '@/screens/Transfers/TransferDetailScreen';

// Suppliers Screens
import { SuppliersScreen } from '@/screens/Suppliers/SuppliersScreen';
import { SupplierDetailScreen } from '@/screens/Suppliers/SupplierDetailScreen';

// Purchases Screens
import { PurchasesScreen } from '@/screens/Purchases/PurchasesScreen';
import { CreatePurchaseScreen } from '@/screens/Purchases/CreatePurchaseScreen';
import { PurchaseDetailScreen } from '@/screens/Purchases/PurchaseDetailScreen';
import { AddPurchaseProductScreen } from '@/screens/Purchases/AddPurchaseProductScreen';
import { EditPurchaseProductScreen } from '@/screens/Purchases/EditPurchaseProductScreen';
import { ValidatePurchaseProductScreen } from '@/screens/Purchases/ValidatePurchaseProductScreen';
import { AssignDebtScreen } from '@/screens/Purchases/AssignDebtScreen';

// Expenses Screens
import { ExpensesScreen } from '@/screens/Expenses/ExpensesScreen';
import { CreateExpenseScreen } from '@/screens/Expenses/CreateExpenseScreen';
import { ExpenseDetailScreen } from '@/screens/Expenses/ExpenseDetailScreen';
import { CreateExpensePaymentScreen } from '@/screens/Expenses/CreateExpensePaymentScreen';
// import { ExpensePaymentsScreen } from '@/screens/Expenses/ExpensePaymentsScreen'; // Removed - payments are now managed within each expense
import { ExpenseProjectsScreen } from '@/screens/Expenses/ExpenseProjectsScreen';
import { CreateExpenseProjectScreen } from '@/screens/Expenses/CreateExpenseProjectScreen';
import { ExpenseProjectDetailScreen } from '@/screens/Expenses/ExpenseProjectDetailScreen';
import { ExpenseCategoriesScreen } from '@/screens/Expenses/ExpenseCategoriesScreen';
import { ExpenseCategoryDetailScreen } from '@/screens/Expenses/ExpenseCategoryDetailScreen';
import { ExpenseReportsScreen } from '@/screens/Expenses/ExpenseReportsScreen';
import { ExpenseTemplatesScreen } from '@/screens/Expenses/ExpenseTemplatesScreen';
import { CreateExpenseTemplateScreen } from '@/screens/Expenses/CreateExpenseTemplateScreen';
import { TemplateExpensesScreen } from '@/screens/Expenses/TemplateExpensesScreen';

// Campaigns Screens
import {
  CampaignsScreen,
  CreateCampaignScreen,
  CampaignDetailScreen,
  AddParticipantScreen,
  AddProductScreen,
  CampaignProductDetailScreen,
} from '@/screens/Campaigns';

// Repartos Screens
import {
  RepartosScreen,
  RepartoDetailScreen,
  RepartoCampaignDetailScreen,
  RepartoParticipantDetailScreen,
} from '@/screens/Repartos';

// Balances Screens
import { BalancesScreen, CreateBalanceScreen, BalanceDetailScreen, BalanceOperationsScreen, AllBalanceOperationsScreen } from '@/screens/Balances';

// Transmisiones Screens
import {
  TransmisionesScreen,
  CreateTransmisionScreen,
  TransmisionDetailScreen,
} from '@/screens/Transmisiones';

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
      <AuthStackNavigator.Screen
        name={AUTH_ROUTES.LOGIN}
        component={LoginScreen}
      />
      <AuthStackNavigator.Screen
        name={AUTH_ROUTES.REGISTER}
        component={RegisterScreen}
      />
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
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.HOME}
        component={HomeScreen}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.COMPANIES}
        component={CompaniesScreen}
        options={{
          title: 'Gestión de Empresas'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.COMPANY_DETAIL}
        component={CompanyDetailScreen}
        options={{
          title: 'Detalle de Empresa'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.SITES}
        component={SitesScreen}
        options={{
          title: 'Gestión de Sedes'
        }}
      />
      <MainStackNavigator.Screen
        name="Warehouses"
        component={WarehousesScreen}
        options={{
          title: 'Gestión de Almacenes'
        }}
      />
      <MainStackNavigator.Screen
        name="WarehouseAreas"
        component={WarehouseAreasScreen}
        options={{
          title: 'Gestión de Áreas'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.USERS}
        options={{
          title: 'Gestión de Usuarios'
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['users.read', 'users.manage', 'users.create']}>
            <UsersScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.ROLES_PERMISSIONS}
        options={{
          title: 'Roles y Permisos'
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['roles.manage']}>
            <RolesPermissionsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.APPS}
        options={{
          title: 'Gestión de Apps'
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
          title: 'Debug de Permisos'
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
          title: 'Gestión de Productos'
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['products.read', 'products.create', 'products.update']}>
            <ProductsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.STOCK}
        options={{
          title: 'Gestión de Inventario'
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['stock.read', 'stock.write', 'inventory.read']}>
            <StockScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.PRICE_PROFILES}
        component={PriceProfilesScreen}
        options={{
          title: 'Perfiles de Precio'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.PRESENTATIONS}
        component={PresentationsScreen}
        options={{
          title: 'Presentaciones'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.INTERNAL_TRANSFERS}
        options={{
          title: 'Traslados Internos'
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['transfers.view.all', 'transfers.read', 'transfers.create.internal']}>
            <InternalTransfersScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXTERNAL_TRANSFERS}
        options={{
          title: 'Traslados Externos'
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['transfers.view.all', 'transfers.read', 'transfers.create.external']}>
            <ExternalTransfersScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.RECEPTIONS}
        options={{
          title: 'Recepciones'
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['receptions.validate', 'receptions.complete', 'transfers.view.all']}>
            <ReceptionsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.TRANSFER_DETAIL}
        component={TransferDetailScreen}
        options={{
          title: 'Detalle de Traslado'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.SUPPLIERS}
        options={{
          title: 'Proveedores'
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['suppliers.read', 'suppliers.create', 'suppliers.update', 'providers.read']}>
            <SuppliersScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.SUPPLIER_DETAIL}
        component={SupplierDetailScreen}
        options={{
          title: 'Detalle de Proveedor'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.PURCHASES}
        options={{
          title: 'Compras'
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['purchases.read', 'purchases.create', 'purchases.update']}>
            <PurchasesScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.CREATE_PURCHASE}
        options={{
          title: 'Nueva Compra'
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
          title: 'Detalle de Compra'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.ADD_PURCHASE_PRODUCT}
        component={AddPurchaseProductScreen}
        options={{
          title: 'Agregar Producto'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EDIT_PURCHASE_PRODUCT}
        component={EditPurchaseProductScreen}
        options={{
          title: 'Editar Producto'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.VALIDATE_PURCHASE_PRODUCT}
        component={ValidatePurchaseProductScreen}
        options={{
          title: 'Validar Producto'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.ASSIGN_DEBT}
        component={AssignDebtScreen}
        options={{
          title: 'Asignar Deudas'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXPENSES}
        options={{
          title: 'Gastos'
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
          title: 'Crear Gasto'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXPENSE_DETAIL}
        component={ExpenseDetailScreen}
        options={{
          title: 'Detalle de Gasto'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.CREATE_EXPENSE_PAYMENT}
        component={CreateExpensePaymentScreen}
        options={{
          title: 'Registrar Pago'
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
          title: 'Proyectos de Gastos'
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
          title: 'Nuevo Proyecto'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXPENSE_PROJECT_DETAIL}
        component={ExpenseProjectDetailScreen}
        options={{
          title: 'Detalle del Proyecto'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXPENSES_CATEGORIES}
        options={{
          title: 'Categorías de Gastos'
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
          title: 'Detalle de Categoría'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EXPENSES_REPORTS}
        options={{
          title: 'Reportes de Gastos'
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
          title: 'Gastos Recurrentes'
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
          title: 'Crear Plantilla'
        }}
      >
        {(props) => (
          <CreateExpenseTemplateScreen {...props} />
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.EDIT_EXPENSE_TEMPLATE}
        options={{
          title: 'Editar Plantilla'
        }}
      >
        {(props) => (
          <CreateExpenseTemplateScreen {...props} />
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.TEMPLATE_EXPENSES}
        options={{
          title: 'Gastos Generados'
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
          title: 'Campañas'
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
          title: 'Nueva Campaña'
        }}
      />
      <MainStackNavigator.Screen
        name="CampaignDetail"
        component={CampaignDetailScreen}
        options={{
          title: 'Detalle de Campaña'
        }}
      />
      <MainStackNavigator.Screen
        name="AddCampaignParticipant"
        component={AddParticipantScreen}
        options={{
          title: 'Agregar Participante'
        }}
      />
      <MainStackNavigator.Screen
        name="AddCampaignProduct"
        component={AddProductScreen}
        options={{
          title: 'Agregar Producto'
        }}
      />
      <MainStackNavigator.Screen
        name="CampaignProductDetail"
        component={CampaignProductDetailScreen}
        options={{
          title: 'Detalle de Producto'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.REPARTOS}
        options={{
          title: 'Repartos'
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
          title: 'Participantes de Campaña'
        }}
      />
      <MainStackNavigator.Screen
        name="RepartoParticipantDetail"
        component={RepartoParticipantDetailScreen}
        options={{
          title: 'Productos de Reparto'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.REPARTO_DETAIL}
        component={RepartoDetailScreen}
        options={{
          title: 'Detalle de Reparto'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BALANCES}
        options={{
          title: 'Balances'
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['balances.read', 'balances.create', 'balances.update']}>
            <BalancesScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.CREATE_BALANCE}
        component={CreateBalanceScreen}
        options={{
          title: 'Nuevo Balance'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BALANCE_DETAIL}
        component={BalanceDetailScreen}
        options={{
          title: 'Detalle de Balance'
        }}
      />
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.BALANCE_OPERATIONS}
        options={{
          title: 'Operaciones de Balance'
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['balances.operations.read', 'balances.operations.create', 'balances.operations.update']}>
            <BalanceOperationsScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.ALL_BALANCE_OPERATIONS}
        options={{
          title: 'Todas las Operaciones'
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
          title: 'Transmisiones'
        }}
      >
        {(props) => (
          <ProtectedRoute requiredPermissions={['transmisiones.read', 'transmisiones.create', 'transmisiones.update']}>
            <TransmisionesScreen {...props} />
          </ProtectedRoute>
        )}
      </MainStackNavigator.Screen>
      <MainStackNavigator.Screen
        name={MAIN_ROUTES.CREATE_TRANSMISION}
        options={{
          title: 'Nueva Transmisión'
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
          title: 'Detalle de Transmisión'
        }}
      />
      <MainStackNavigator.Screen
        name={AUTH_ROUTES.SITE_SELECTION}
        component={SiteSelectionScreen}
        options={{
          title: 'Seleccionar Sede'
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

  // Don't render until we've restored state
  if (!isReady) {
    return null;
  }

  return (
    <NavigationContainer
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
            <DrawerMenu
              visible={isDrawerVisible}
              onClose={() => setIsDrawerVisible(false)}
            />
          </>
        )}
      </View>
    </NavigationContainer>
  );
};

export default Navigation;
