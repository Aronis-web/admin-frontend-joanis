---
name: permission-checker
description: Encuentra y usa correctamente los permisos del ERP. Úsalo cuando el usuario hable de permisos, roles, autorizaciones, "puede ver", "puede editar", o esté implementando control de acceso en pantallas/componentes.
version: 1.0.0
---

# Permission checker

El proyecto centraliza todos los permisos en `src/constants/permissions.ts` (703 líneas).

## Cómo encontrar el permiso correcto

1. **No leas el archivo entero**. Usa `grep` con la palabra clave del módulo:
   ```
   grep -n "SALES\|sales" src/constants/permissions.ts
   grep -n "INVENTORY" src/constants/permissions.ts
   ```
2. Las claves suelen ser `MODULE_ACTION` (ej. `SALES_CREATE`, `INVENTORY_VIEW`, `CAMPAIGNS_EDIT`).
3. Si no existe el permiso necesario, **no lo inventes**. Pregunta al usuario si debe crearse uno nuevo.

## Cómo usar un permiso en código

Patrón estándar en pantallas y componentes:

```ts
import { PERMISSIONS } from '@/constants/permissions';
import { useAuth } from '@/providers/AuthProvider'; // o el provider correspondiente

const { hasPermission } = useAuth();
if (!hasPermission(PERMISSIONS.SALES_CREATE)) {
  return <NoAccess />;
}
```

(Verificar el helper exacto del proyecto con `find_usages` sobre `hasPermission` antes de copiar.)

## Reglas

- Nunca hardcodear strings de permisos: importar desde `@/constants/permissions`.
- Los permisos deben verificarse antes de mostrar acciones destructivas (delete, cancel, etc.).
- Si una pantalla completa requiere permiso, verificar al inicio del componente y renderizar fallback.
