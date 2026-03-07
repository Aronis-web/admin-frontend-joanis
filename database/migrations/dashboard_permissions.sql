-- =====================================================
-- PERMISOS DEL MÓDULO DASHBOARD
-- =====================================================
-- Este archivo contiene los permisos necesarios para el módulo de Dashboard
-- Ejecutar en la base de datos del backend

-- Permiso principal para ver el dashboard
INSERT INTO permissions (key, description, module) VALUES
('dashboard.read', 'Ver dashboard', 'dashboard')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  module = EXCLUDED.module;

-- Permiso para ver el dashboard de compras
INSERT INTO permissions (key, description, module) VALUES
('dashboard.purchases', 'Ver dashboard de compras', 'dashboard')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  module = EXCLUDED.module;

-- =====================================================
-- NOTAS DE IMPLEMENTACIÓN
-- =====================================================
--
-- 1. El permiso 'dashboard.read' permite acceder al módulo de dashboard
--    Si un usuario tiene este permiso, la pantalla inicial será el Dashboard
--    en lugar de la pantalla de Inicio tradicional.
--
-- 2. El permiso 'dashboard.purchases' permite ver el resumen de compras
--    dentro del dashboard, incluyendo:
--    - Total validado en el período seleccionado
--    - Número total de compras
--    - Número total de productos
--    - Top 5 proveedores con mayor volumen de compras
--
-- 3. Endpoint requerido en el backend:
--    GET /admin/purchases/summary/by-date
--    Query Parameters:
--      - startDate (opcional): Fecha de inicio (formato: YYYY-MM-DD)
--      - endDate (opcional): Fecha de fin (formato: YYYY-MM-DD)
--
-- 4. Respuesta esperada del endpoint:
--    {
--      "startDate": "2024-01-01",
--      "endDate": "2024-12-31",
--      "totalValidatedCents": 1500000,
--      "totalValidated": 15000.00,
--      "totalPurchases": 45,
--      "totalProducts": 320,
--      "topSuppliers": [
--        {
--          "supplierId": "uuid-1",
--          "supplierName": "Distribuidora ABC",
--          "totalValidatedCents": 500000,
--          "totalValidated": 5000.00,
--          "purchaseCount": 15,
--          "percentage": 33.33
--        }
--      ]
--    }
--
-- =====================================================
