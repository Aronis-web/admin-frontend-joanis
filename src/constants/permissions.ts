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
    READ: 'bizlinks.read',
    ADMIN: 'bizlinks.admin',

    CONFIG: {
      VIEW: 'bizlinks.config.view',
      CREATE: 'bizlinks.config.create',
      UPDATE: 'bizlinks.config.update',
      DELETE: 'bizlinks.config.delete',
      TEST: 'bizlinks.config.test',
    },

    DOCUMENTS: {
      VIEW: 'bizlinks.documents.view',
      EMIT: 'bizlinks.documents.emit',
      SEND: 'bizlinks.documents.send',
      QUERY: 'bizlinks.documents.query',
      DOWNLOAD: 'bizlinks.documents.download',
      RESEND: 'bizlinks.documents.resend',
      VOID: 'bizlinks.documents.void',
    },

    LOGS: {
      VIEW: 'bizlinks.logs.view',
    },
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
