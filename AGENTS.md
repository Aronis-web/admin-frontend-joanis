# ERP-aio · admin-frontend-joanis

Panel ERP cross-platform: Expo + React Native + RN Web. Mismo código corre como APK Android, `.exe` Windows (Electron) y web.

Stack corto: Expo 54, RN 0.81, React 19, TS estricto (alias `@/*` → `src/*`), React Query v5, Zustand, Axios vía `apiClient`, `@react-navigation`, design system propio en `src/design-system/`.

## Dónde vive cada cosa

- Reglas base (git, scripts npm, estilo): `.firebender/rules/sweep.mdc`
- Mapa del codebase (índices, constants críticos): `.firebender/rules/codebase-map.mdc`
- Archivos gigantes / prohibidos: `.firebender/rules/heavy-files.mdc`
- Convenciones por área (services/hooks/screens/components/navigation): `.firebender/rules/*.mdc` (activadas por globs)
- Reglas por módulo (campaigns, inventory, repartos): `.firebender/rules/*.mdc`
- Subagentes (`planner`, `api-integrator`, `screen-builder`, `refactor-large-file`, `code-reviewer`, `verifier`): `.firebender/agents/`
- Slash commands: `.firebender/commands/`
- Hooks (format, guard-heavy, auto-typecheck, guard-destructive): `.firebender/hooks/`
