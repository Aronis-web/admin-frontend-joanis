# ERP-aio · admin-frontend-joanis

Panel ERP cross-platform construido con Expo + React Native + React Native Web. Mismo código corre como APK Android, .exe Windows (Electron) y web.

## Stack

- Expo `~54`, React Native `0.81`, React `19`, React Native Web `0.21`
- TypeScript `~5.9` estricto, alias `@/*` → `src/*`
- `@tanstack/react-query` v5, `zustand` v4
- HTTP: `axios` vía `apiClient` (`src/services/api/client.ts`)
- Validación: `yup`
- Navegación: `@react-navigation` (`native-stack` + `bottom-tabs`)
- UI: design system propio (`src/design-system/`)
- Desktop: Electron 40 + electron-builder + electron-updater

## Estructura clave

- `src/app/` entry, `src/navigation/` stacks y `routes.ts`
- `src/screens/<Modulo>/` pantallas (39 módulos de negocio)
- `src/components/<Modulo>/` + `common/`, `ui/`, `Layout/`
- `src/design-system/` tokens y componentes base
- `src/services/api/<modulo>.ts` servicios HTTP (registro en `index.ts`)
- `src/hooks/api/use<Modulo>.ts` hooks React Query
- `src/types/<modulo>.ts` tipos compartidos
- `src/store/` Zustand, `src/providers/` (QueryClient, Auth)
- `src/constants/permissions.ts` (703 líneas), `src/constants/routes.ts` (425)
- `src/utils/logger.ts` para logs

## Convenciones esenciales

- TypeScript estricto, evitar `any`. Imports con alias `@/...`.
- Sin `console.log` en producción → usar `logger.*`.
- Servicios: exportar `xxxApi` con métodos async tipados, usar `apiClient`.
- Hooks: definir `xxxKeys`, `staleTime` razonable (3–10 min), `refetchOnWindowFocus: false` en listas, invalidar listas y `setQueryData` detalle en mutations.
- Pantallas: usar design-system, sin estilos hardcodeados, cross-platform (web + nativo).
- Permisos: consultar `src/constants/permissions.ts`.
- Cross-platform: `Platform.OS` o `.web.tsx` / `.native.tsx`.

## Operativa

- Git: tras cada cambio funcional, commit + push (rama de feature, nunca push directo a `master` en cambios grandes).
- No crear archivos `*.md` salvo solicitud explícita.
- Archivos gigantes y artefactos: ver regla `heavy-files`.

## Slash commands

- `/validate` — typecheck + lint
- `/build-apk` — APK Android local
- `/build-electron` — .exe Windows
- `/commit-push` — commit + push
- `/new-api-module` — scaffolding service+hook+types
- `/review-diff` — code review del diff staged
- `/explain-screen` — resumen de pantalla compleja
- `/clean-logs` — quita `console.log`
- `/find-usages` — usos de un símbolo
- `/split-large-file` — divide archivo >1500 líneas
- `/run-screen` — corre Electron en dev
- `/bump-version` — sube patch en `app.json` y `package.json`

## Subagentes

- `planner` — descompone tareas grandes
- `api-integrator` — service + hook + types
- `screen-builder` — pantallas con design-system
- `refactor-large-file` — split de archivos >1500 líneas
- `code-reviewer` — revisión del último diff
- `verifier` — typecheck + lint, reporta sin tocar código

## Hooks activos

- `afterFileEdit` → formatea con Prettier el archivo editado
- `beforeReadFile` → bloquea `ubigeo.ts` y carpetas de build
- `stop` → corre `typecheck` automático tras edits TS/TSX
- `beforeShellExecution` → pide confirmación para comandos destructivos
