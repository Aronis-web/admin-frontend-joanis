// API Services Index
// Central export point for all API services

export { default as apiClient } from './client';
export { companiesApi } from './companies';
export { inventoryApi } from './inventory';
export { warehousesApi, warehouseAreasApi } from './warehouses';
export { expensesApi } from './expenses';
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
export * from './roles';
export * from './apps';
export * from './scopes';
export * from './price-profiles';
export * from './presentations';
