/**
 * 📋 Constantes de Permisos del Sistema
 *
 * Este archivo centraliza todos los permisos disponibles en el backend.
 * Basado en la documentación de permisos del backend (~150 permisos).
 *
 * Uso:
 * ```tsx
 * import { PERMISSIONS } from '@/constants/permissions';
 *
 * <ProtectedButton
 *   requiredPermissions={[PERMISSIONS.PRODUCTS.CREATE]}
 *   onPress={handleCreate}
 * />
 * ```
 */

export const PERMISSIONS = {
  // ========== DASHBOARD ==========
  DASHBOARD: {
    READ: 'dashboard.read',
    PURCHASES: 'dashboard.purchases',
  },

  // ========== USUARIOS ==========
  USERS: {
    CREATE: 'users.create',
    READ: 'users.read',
    UPDATE: 'users.update',
    DELETE: 'users.delete',
  },

  // ========== PRODUCTOS ==========
  PRODUCTS: {
    CREATE: 'products.create',
    READ: 'products.read',
    UPDATE: 'products.update',
    DELETE: 'products.delete',
    PRICES_DOWNLOAD: 'products.prices.download',
    PRICES_UPDATE: 'products.prices.update',
  },

  // ========== CATEGORÍAS ==========
  CATEGORIES: {
    CREATE: 'categories.create',
    READ: 'categories.read',
    UPDATE: 'categories.update',
    DELETE: 'categories.delete',
  },

  // ========== PRESENTACIONES ==========
  PRESENTATIONS: {
    CREATE: 'presentations.create',
    READ: 'presentations.read',
    UPDATE: 'presentations.update',
    DELETE: 'presentations.delete',
  },

  // ========== PERFILES DE PRECIO ==========
  PRICE_PROFILES: {
    CREATE: 'price_profiles.create',
    READ: 'price_profiles.read',
    UPDATE: 'price_profiles.update',
    DELETE: 'price_profiles.delete',
  },

  // ========== COMPRAS ==========
  PURCHASES: {
    CREATE: 'purchases.create',
    READ: 'purchases.read',
    UPDATE: 'purchases.update',
    DELETE: 'purchases.delete',
    CLOSE: 'purchases.close',
    VALIDATE: 'purchases.validate',
    VALIDATE_CLOSE: 'purchases.validate.close',
    PRODUCTS_ADD: 'purchases.products.add',
    PRODUCTS_EDIT: 'purchases.products.edit',
    PRODUCTS_DELETE: 'purchases.products.delete',
    DEBT_ASSIGN: 'purchases.debt.assign',
    OCR_SCAN: 'purchases.ocr.scan',
  },

  // ========== PROVEEDORES ==========
  SUPPLIERS: {
    CREATE: 'suppliers.create',
    READ: 'suppliers.read',
    UPDATE: 'suppliers.update',
    DELETE: 'suppliers.delete',

    DEBTS: {
      CREATE: 'suppliers.debts.create',
      READ: 'suppliers.debts.read',
      ASSIGN: 'suppliers.debts.assign',
    },

    PAYMENTS: {
      CREATE: 'suppliers.payments.create',
      READ: 'suppliers.payments.read',
      ASSIGN: 'suppliers.payments.assign',
      APPROVE: 'suppliers.payments.approve',
      CANCEL: 'suppliers.payments.cancel',
    },
  },

  // ========== MÉTODOS DE PAGO ==========
  PAYMENT_METHODS: {
    CREATE: 'payment_methods.create',
    READ: 'payment_methods.read',
    UPDATE: 'payment_methods.update',
    DELETE: 'payment_methods.delete',
  },

  // ========== GASTOS ==========
  EXPENSES: {
    CREATE: 'expenses.create',
    READ: 'expenses.read',
    UPDATE: 'expenses.update',
    DELETE: 'expenses.delete',
    ADMIN: 'expenses.admin',

    PAYMENTS: {
      CREATE: 'expenses.payments.create',
      READ: 'expenses.payments.read',
      UPDATE: 'expenses.payments.update',
      DELETE: 'expenses.payments.delete',
      APPROVE: 'expenses.payments.approve',
    },

    CATEGORIES: {
      CREATE: 'expenses.categories.create',
      READ: 'expenses.categories.read',
      UPDATE: 'expenses.categories.update',
      DELETE: 'expenses.categories.delete',
    },

    PROJECTS: {
      CREATE: 'expenses.projects.create',
      READ: 'expenses.projects.read',
      UPDATE: 'expenses.projects.update',
      DELETE: 'expenses.projects.delete',
      CLOSE: 'expenses.projects.close',
    },

    TEMPLATES: {
      CREATE: 'expenses.templates.create',
      READ: 'expenses.templates.read',
      UPDATE: 'expenses.templates.update',
      DELETE: 'expenses.templates.delete',
      GENERATE: 'expenses.templates.generate',
      ADMIN: 'expenses.templates.admin',
    },

    ALERTS: {
      CREATE: 'expenses.alerts.create',
      READ: 'expenses.alerts.read',
      UPDATE: 'expenses.alerts.update',
      DELETE: 'expenses.alerts.delete',
    },

    PROJECTIONS: {
      CREATE: 'expenses.projections.create',
      READ: 'expenses.projections.read',
      UPDATE: 'expenses.projections.update',
      DELETE: 'expenses.projections.delete',
      GENERATE: 'expenses.projections.generate',
    },

    REPORTS: {
      VIEW: 'expenses.reports.view',
    },
  },

  // ========== CAMPAÑAS ==========
  CAMPAIGNS: {
    CREATE: 'campaigns.create',
    READ: 'campaigns.read',
    UPDATE: 'campaigns.update',
    DELETE: 'campaigns.delete',
    ACTIVATE: 'campaigns.activate',
    CLOSE: 'campaigns.close',
    CANCEL: 'campaigns.cancel',
  },

  // ========== REPARTOS ==========
  REPARTOS: {
    CREATE: 'repartos.create',
    READ: 'repartos.read',
    UPDATE: 'repartos.update',
    DELETE: 'repartos.delete',
    CANCEL: 'repartos.cancel',
    VALIDATE: 'repartos.validate',
    EXPORT: 'repartos.export',
    REPORTS: 'repartos.reports',
    GENERATE_TRANSFER: 'repartos.generate_transfer',
  },

  // ========== BALANCES ==========
  BALANCES: {
    CREATE: 'balances.create',
    READ: 'balances.read',
    UPDATE: 'balances.update',
    DELETE: 'balances.delete',
    ACTIVATE: 'balances.activate',
    DEACTIVATE: 'balances.deactivate',
    CLOSE: 'balances.close',

    FILES: {
      UPLOAD: 'balances.files.upload',
      READ: 'balances.files.read',
      DELETE: 'balances.files.delete',
    },

    OPERATIONS: {
      CREATE: 'balances.operations.create',
      READ: 'balances.operations.read',
      UPDATE: 'balances.operations.update',
      DELETE: 'balances.operations.delete',
    },

    REPORTS: {
      READ: 'balances.reports.read',
    },
  },

  // ========== TRASLADOS ==========
  TRANSFERS: {
    CREATE: 'transfers.create',
    READ: 'transfers.read',
    EXECUTE: 'transfers.execute',
    APPROVE: 'transfers.approve',
    SHIP: 'transfers.ship',
    RECEIVE: 'transfers.receive',
    VALIDATE: 'transfers.validate',
    COMPLETE: 'transfers.complete',
    CANCEL: 'transfers.cancel',
  },

  // ========== ROLES Y PERMISOS ==========
  ROLES: {
    CREATE: 'roles.create',
    READ: 'roles.read',
    UPDATE: 'roles.update',
    DELETE: 'roles.delete',
    ASSIGN: 'roles.assign',
  },

  PERMISSIONS_MODULE: {
    READ: 'permissions.read',
  },

  IAM: {
    ASSIGN_USER_ROLES: 'iam.assign_user_roles',
    ASSIGN_USER_PERMS: 'iam.assign_user_perms',
  },

  // ========== CONTROL DE ACCESO ==========
  ACCESS: {
    READ: 'access.read',
  },

  // ========== SCOPES ==========
  SCOPES: {
    CREATE: 'scopes.create',
    READ: 'scopes.read',
    ASSIGN: 'scopes.assign',
    UPDATE: 'scopes.update',
    DELETE: 'scopes.delete',
    REVOKE: 'scopes.revoke',
    ADMIN: 'scopes.admin',
  },

  // ========== APPS ==========
  APPS: {
    CREATE: 'apps.create',
    READ: 'apps.read',
    UPDATE: 'apps.update',
    DELETE: 'apps.delete',
    MANAGE: 'apps.manage',

    SCOPES: {
      CREATE: 'apps.scopes.create',
      READ: 'apps.scopes.read',
      DELETE: 'apps.scopes.delete',
    },

    USERS: {
      ASSIGN: 'apps.users.assign',
      READ: 'apps.users.read',
      REMOVE: 'apps.users.remove',
    },

    PERMISSIONS: {
      ASSIGN: 'apps.permissions.assign',
      READ: 'apps.permissions.read',
    },
  },

  // ========== ARCHIVOS ==========
  FILES: {
    UPLOAD: 'files.upload',
    READ: 'files.read',
    DELETE: 'files.delete',
    ADMIN: 'files.admin',
  },

  // ========== SEDES ==========
  SITES: {
    CREATE: 'sites.create',
    READ: 'sites.read',
    UPDATE: 'sites.update',
    DELETE: 'sites.delete',
    ADMINS_ASSIGN: 'sites.admins.assign',
    ADMINS_REMOVE: 'sites.admins.remove',
  },

  // ========== TRANSMISIONES ==========
  TRANSMISIONES: {
    CREATE: 'transmisiones.create',
    READ: 'transmisiones.read',
    UPDATE: 'transmisiones.update',
    DELETE: 'transmisiones.delete',
  },

  // ========== INVENTARIO (Scopes-based) ==========
  INVENTORY: {
    READ: 'inventory.read',
    UPDATE: 'inventory.update',
    ADJUST: 'stock.adjust',
    TRANSFER: 'stock.transfer',
  },

  // ========== ALMACENES ==========
  WAREHOUSES: {
    CREATE: 'warehouses.create',
    READ: 'warehouses.read',
    UPDATE: 'warehouses.update',
    DELETE: 'warehouses.delete',
  },

  // ========== ÁREAS ==========
  AREAS: {
    CREATE: 'areas.create',
    READ: 'areas.read',
    UPDATE: 'areas.update',
    DELETE: 'areas.delete',
  },

  // ========== ADMINISTRATIVOS ==========
  ADMIN: {
    TEST: 'admin.test',
    SEED: 'admin.seed',
  },

  // ========== FACTURACIÓN / BILLING ==========
  BILLING: {
    READ: 'billing.read',
    ADMIN: 'billing.admin',

    DOCUMENT_TYPES: {
      READ: 'billing.document-types.read',
      MANAGE: 'billing.document-types.manage',
    },

    SERIES: {
      READ: 'billing.series.read',
      CREATE: 'billing.series.create',
      UPDATE: 'billing.series.update',
      DELETE: 'billing.series.delete',
      STATS: 'billing.series.stats',
    },

    CORRELATIVES: {
      READ: 'billing.correlatives.read',
      GENERATE: 'billing.correlatives.generate',
      VOID: 'billing.correlatives.void',
    },
  },

  // ========== BIZLINKS - FACTURACIÓN ELECTRÓNICA ==========
  BIZLINKS: {
    CONFIG: {
      VIEW: 'bizlinks.config.view',
    },

    DOCUMENTS: {
      VIEW: 'bizlinks.documents.view',
      SEND: 'bizlinks.documents.send',
      QUERY: 'bizlinks.documents.query',
      DOWNLOAD: 'bizlinks.documents.download',
      RESEND: 'bizlinks.documents.resend',
    },
  },

  // ========== CUENTAS POR PAGAR ==========
  ACCOUNTS_PAYABLE: {
    // Lectura
    READ: 'accounts-payable.read',
    READ_ALL: 'accounts-payable.read-all',
    READ_OWN_COMPANY: 'accounts-payable.read-own-company',
    READ_DETAILS: 'accounts-payable.read-details',

    // Escritura
    CREATE: 'accounts-payable.create',
    UPDATE: 'accounts-payable.update',
    DELETE: 'accounts-payable.delete',

    // Búsqueda
    SEARCH: 'accounts-payable.search',
    SEARCH_INTELLIGENT: 'accounts-payable.search-intelligent',
    SEARCH_ALL_COMPANIES: 'accounts-payable.search-all-companies',

    // Estado
    CHANGE_STATUS: 'accounts-payable.change-status',
    APPROVE: 'accounts-payable.approve',
    REJECT: 'accounts-payable.reject',
    CANCEL: 'accounts-payable.cancel',
    DISPUTE: 'accounts-payable.dispute',

    // Pagos
    PAYMENTS: {
      READ: 'accounts-payable.payments.read',
      CREATE: 'accounts-payable.payments.create',
      UPDATE: 'accounts-payable.payments.update',
      DELETE: 'accounts-payable.payments.delete',
      APPROVE: 'accounts-payable.payments.approve',
    },

    // Reportes
    REPORTS: {
      SUMMARY: 'accounts-payable.reports.summary',
      BY_SUPPLIER: 'accounts-payable.reports.by-supplier',
      BY_STATUS: 'accounts-payable.reports.by-status',
      AGING: 'accounts-payable.reports.aging',
      OVERDUE: 'accounts-payable.reports.overdue',
      EXPORT: 'accounts-payable.reports.export',
      DOWNLOAD_EXCEL: 'accounts-payable.reports.download-excel',
      DOWNLOAD_PDF: 'accounts-payable.reports.download-pdf',
    },

    // Cronograma
    SCHEDULE: {
      READ: 'accounts-payable.schedule.read',
      CREATE: 'accounts-payable.schedule.create',
      UPDATE: 'accounts-payable.schedule.update',
      DELETE: 'accounts-payable.schedule.delete',
    },

    // Historial
    HISTORY: {
      READ: 'accounts-payable.history.read',
      EXPORT: 'accounts-payable.history.export',
    },

    // Documentos
    DOCUMENTS: {
      READ: 'accounts-payable.documents.read',
      UPLOAD: 'accounts-payable.documents.upload',
      DOWNLOAD: 'accounts-payable.documents.download',
      DELETE: 'accounts-payable.documents.delete',
    },

    // Administración
    ADMIN: {
      UPDATE_OVERDUE: 'accounts-payable.admin.update-overdue',
      BULK_UPDATE: 'accounts-payable.admin.bulk-update',
      BULK_DELETE: 'accounts-payable.admin.bulk-delete',
      RESTORE: 'accounts-payable.admin.restore',
      VIEW_DELETED: 'accounts-payable.admin.view-deleted',
      PERMANENT_DELETE: 'accounts-payable.admin.permanent-delete',
    },

    // Configuración
    CONFIG: {
      READ: 'accounts-payable.config.read',
      UPDATE: 'accounts-payable.config.update',
    },

    // Notificaciones
    NOTIFICATIONS: {
      READ: 'accounts-payable.notifications.read',
      CREATE: 'accounts-payable.notifications.create',
      UPDATE: 'accounts-payable.notifications.update',
      DELETE: 'accounts-payable.notifications.delete',
    },

    // Integración
    INTEGRATION: {
      SYNC: 'accounts-payable.integration.sync',
      IMPORT: 'accounts-payable.integration.import',
      EXPORT: 'accounts-payable.integration.export',
    },

    // Permisos Combinados
    READ_FULL: 'accounts-payable.read-full',
    WRITE_FULL: 'accounts-payable.write-full',
    REPORTS_FULL: 'accounts-payable.reports-full',
    ADMIN_FULL: 'accounts-payable.admin-full',
    FULL_ACCESS: 'accounts-payable.full-access',
  },

  // ========== CUENTAS POR COBRAR ==========
  ACCOUNTS_RECEIVABLE: {
    // Lectura
    READ: 'accounts-receivable.read',
    READ_ALL: 'accounts-receivable.read-all',
    READ_OWN_COMPANY: 'accounts-receivable.read-own-company',
    READ_DETAILS: 'accounts-receivable.read-details',

    // Escritura
    CREATE: 'accounts-receivable.create',
    UPDATE: 'accounts-receivable.update',
    DELETE: 'accounts-receivable.delete',

    // Búsqueda
    SEARCH: 'accounts-receivable.search',
    SEARCH_INTELLIGENT: 'accounts-receivable.search-intelligent',
    SEARCH_ALL_COMPANIES: 'accounts-receivable.search-all-companies',

    // Estado
    CHANGE_STATUS: 'accounts-receivable.change-status',
    APPROVE: 'accounts-receivable.approve',
    CANCEL: 'accounts-receivable.cancel',
    DISPUTE: 'accounts-receivable.dispute',
    WRITE_OFF: 'accounts-receivable.write-off',

    // Cobros
    COLLECTIONS: {
      READ: 'accounts-receivable.collections.read',
      CREATE: 'accounts-receivable.collections.create',
      UPDATE: 'accounts-receivable.collections.update',
      DELETE: 'accounts-receivable.collections.delete',
      APPROVE: 'accounts-receivable.collections.approve',
    },

    // Reportes
    REPORTS: {
      SUMMARY: 'accounts-receivable.reports.summary',
      BY_DEBTOR: 'accounts-receivable.reports.by-debtor',
      BY_STATUS: 'accounts-receivable.reports.by-status',
      AGING: 'accounts-receivable.reports.aging',
      OVERDUE: 'accounts-receivable.reports.overdue',
      CASH_FLOW: 'accounts-receivable.reports.cash-flow',
      EXPORT: 'accounts-receivable.reports.export',
      DOWNLOAD_EXCEL: 'accounts-receivable.reports.download-excel',
      DOWNLOAD_PDF: 'accounts-receivable.reports.download-pdf',
    },

    // Cronograma
    SCHEDULE: {
      READ: 'accounts-receivable.schedule.read',
      CREATE: 'accounts-receivable.schedule.create',
      UPDATE: 'accounts-receivable.schedule.update',
      DELETE: 'accounts-receivable.schedule.delete',
    },

    // Historial
    HISTORY: {
      READ: 'accounts-receivable.history.read',
      EXPORT: 'accounts-receivable.history.export',
    },

    // Documentos
    DOCUMENTS: {
      READ: 'accounts-receivable.documents.read',
      UPLOAD: 'accounts-receivable.documents.upload',
      DOWNLOAD: 'accounts-receivable.documents.download',
      DELETE: 'accounts-receivable.documents.delete',
    },

    // Administración
    ADMIN: {
      UPDATE_OVERDUE: 'accounts-receivable.admin.update-overdue',
      BULK_UPDATE: 'accounts-receivable.admin.bulk-update',
      BULK_DELETE: 'accounts-receivable.admin.bulk-delete',
      RESTORE: 'accounts-receivable.admin.restore',
      VIEW_DELETED: 'accounts-receivable.admin.view-deleted',
      PERMANENT_DELETE: 'accounts-receivable.admin.permanent-delete',
    },

    // Configuración
    CONFIG: {
      READ: 'accounts-receivable.config.read',
      UPDATE: 'accounts-receivable.config.update',
    },

    // Notificaciones
    NOTIFICATIONS: {
      READ: 'accounts-receivable.notifications.read',
      CREATE: 'accounts-receivable.notifications.create',
      UPDATE: 'accounts-receivable.notifications.update',
      DELETE: 'accounts-receivable.notifications.delete',
    },

    // Integración
    INTEGRATION: {
      SYNC: 'accounts-receivable.integration.sync',
      IMPORT: 'accounts-receivable.integration.import',
      EXPORT: 'accounts-receivable.integration.export',
    },

    // Permisos Combinados
    READ_FULL: 'accounts-receivable.read-full',
    WRITE_FULL: 'accounts-receivable.write-full',
    REPORTS_FULL: 'accounts-receivable.reports-full',
    ADMIN_FULL: 'accounts-receivable.admin-full',
    FULL_ACCESS: 'accounts-receivable.full-access',
  },
} as const;

/**
 * Helper para obtener todos los permisos de un módulo
 */
export const getModulePermissions = (module: keyof typeof PERMISSIONS): string[] => {
  const modulePerms = PERMISSIONS[module];
  const perms: string[] = [];

  const extractPerms = (obj: any) => {
    Object.values(obj).forEach((value) => {
      if (typeof value === 'string') {
        perms.push(value);
      } else if (typeof value === 'object') {
        extractPerms(value);
      }
    });
  };

  extractPerms(modulePerms);
  return perms;
};

/**
 * Helper para verificar si un permiso existe en las constantes
 */
export const isValidPermission = (permission: string): boolean => {
  const allPermissions = Object.values(PERMISSIONS).flatMap((module) => {
    const perms: string[] = [];
    const extractPerms = (obj: any) => {
      Object.values(obj).forEach((value) => {
        if (typeof value === 'string') {
          perms.push(value);
        } else if (typeof value === 'object') {
          extractPerms(value);
        }
      });
    };
    extractPerms(module);
    return perms;
  });

  return allPermissions.includes(permission);
};

/**
 * Mapeo de acciones CRUD a permisos
 */
export const ACTION_TO_PERMISSION: Record<string, string> = {
  create: 'create',
  read: 'read',
  update: 'update',
  delete: 'delete',
  view: 'read',
  edit: 'update',
  remove: 'delete',
  add: 'create',
} as const;

/**
 * Helper para construir un permiso desde módulo y acción
 */
export const buildPermission = (module: string, action: string): string => {
  const permissionAction = ACTION_TO_PERMISSION[action.toLowerCase()] || action;
  return `${module}.${permissionAction}`;
};
