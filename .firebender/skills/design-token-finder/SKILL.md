---
name: design-token-finder
description: Encuentra el token correcto (color, spacing, typography) del design system antes de hardcodear. Úsalo cuando el usuario pida estilar un componente, agregar color/padding/margin, o cuando veas valores hex/numéricos hardcodeados en código nuevo.
version: 1.0.0
---

# Design token finder

El proyecto tiene un design-system propio en `src/design-system/`. **Nunca hardcodear** colores hex, spacing en pixeles sueltos, ni font sizes.

## Estructura

- `src/design-system/tokens/` — tokens (colores, spacing, typography, radius, shadow).
- `src/design-system/components/` — componentes base.
- `src/design-system/index.ts` — re-exports.

## Cómo encontrar el token correcto

1. **Imports primero**: revisa qué exporta el barrel:
   ```
   grep -n "^export" src/design-system/index.ts
   ```
2. **Por categoría**:
   - Colores: `ls src/design-system/tokens/` → busca `colors*`.
   - Spacing: `spacing*`.
   - Typography: `typography*` o `fonts*`.
3. **Antes de inventar un token nuevo**, busca uno similar con `grep`. Si no existe y el usuario insiste, propón añadirlo al token correspondiente y reutilizarlo.

## Patrón en componentes

```tsx
import { colors, spacing, typography } from '@/design-system';

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  title: {
    ...typography.headingSm,
    color: colors.textPrimary,
  },
});
```

## Anti-patrones

- ❌ `backgroundColor: '#FF5733'`
- ❌ `padding: 13`
- ❌ `fontSize: 17, fontWeight: '600'`
- ✅ `backgroundColor: colors.danger`
- ✅ `padding: spacing.md`
- ✅ `...typography.body`
