<!--firebender-plan
name: Firebender deep tuning
overview: Mejorar Firebender con cuatro frentes: entorno más liviano (evitar lecturas pesadas), hooks de automatización (formato/validación), nuevos comandos/skills/subagentes para tareas repetitivas, y un subagente dedicado a dividir archivos gigantes (>1500 líneas).
todos:
  - id: lighter-env
    content: "Crear reglas heavy-files.mdc y codebase-map.mdc; optimizar AGENTS.md"
  - id: hooks
    content: "Crear .firebender/hooks.json + 4 scripts PowerShell (format, guard-heavy, auto-typecheck, guard-destructive)"
  - id: commands
    content: "Crear 7 nuevos comandos (/review-diff, /explain-screen, /clean-logs, /find-usages, /split-large-file, /run-screen, /bump-version)"
  - id: skills
    content: "Crear 4 skills (commit-message, permission-checker, design-token-finder, react-query-pattern)"
  - id: subagents
    content: "Crear subagentes planner, refactor-large-file, code-reviewer y mejorar descripciones de los existentes"
  - id: module-rules
    content: "Crear reglas por módulo (campaigns, repartos, inventory, navigation) con globs específicos"
  - id: register-validate
    content: "Actualizar firebender.json y validar parseo de todos los archivos"
-->

## Firebender deep tuning · admin-frontend-joanis

Plan basado en hallazgos del codebase: `src/constants/ubigeo.ts` (8.961 líneas), 4 archivos >2.500 líneas en `src/screens` y `src/components`, `dist/` ≈ 6 GB, sin tests, Sentry deshabilitado, sin MCP.

### 1. Entorno más liviano (menos tokens, respuestas más rápidas)

**Nuevas reglas con globs específicos** que enseñan al agente qué NO leer entero:

- [.firebender/rules/heavy-files.mdc](.firebender/rules/heavy-files.mdc) (`alwaysApply: true`): lista de archivos prohibidos de leer al completo y cómo consultarlos:
  - `src/constants/ubigeo.ts`: 192KB de datos estáticos. Usar `grep` por código de ubigeo, jamás `read_file` sin `offset/limit`.
  - `dist/`, `web-build/`, `android/build/`, `node_modules/`, `vendor/`: artefactos. Nunca explorarlos.
  - `android/*.log`: ya eliminados; si reaparecen, ignorar.
  - Archivos >1500 líneas (`CampaignDetailScreen.tsx`, `RepartoParticipantDetailScreen.tsx`, `DistributionFormModal.tsx`, `PhotoCampaignManagementScreen.tsx`, `CuadreScreen.tsx`, `DashboardScreen.tsx`, `navigation/index.tsx`): listar con líneas exactas, recomendar `read_file` con `offset/limit` o `grep` antes de cargar todo. Sugerir `/split-large-file` cuando sea necesario refactor.
- [.firebender/rules/codebase-map.mdc](.firebender/rules/codebase-map.mdc) (`alwaysApply: true`, conciso): índice rápido de dónde vive cada cosa, así el agente no escanea `src/` ciegamente:
  - 44 servicios en `src/services/api/*.ts` — registro central en `index.ts`.
  - 7 hooks API en `src/hooks/api/use*.ts`.
  - 39 módulos en `src/screens/<Modulo>/`.
  - Permisos en `src/constants/permissions.ts`, rutas en `src/constants/routes.ts`.

**Optimizar [AGENTS.md](AGENTS.md)**:
- Reemplazar la tabla markdown (no se renderiza siempre y suma tokens) por lista compacta.
- Quitar duplicaciones con `sweep.mdc`.

### 2. Hooks de automatización (`.firebender/hooks/`)

Firebender soporta hooks via [.firebender/hooks.json](.firebender/hooks.json). En Windows, los scripts serán `.ps1` invocados via `pwsh -File`.

- **`afterFileEdit`** → [.firebender/hooks/format.ps1](.firebender/hooks/format.ps1):
  - Si el archivo editado es `.ts/.tsx/.js/.jsx/.json` y está dentro de `src/`, corre `npx prettier --write <file>`.
  - Silencioso (exit 0 siempre), no bloquea.
- **`beforeReadFile`** → [.firebender/hooks/guard-heavy.ps1](.firebender/hooks/guard-heavy.ps1):
  - **Deny** lectura completa de `src/constants/ubigeo.ts` con mensaje "usar grep + offset/limit".
  - **Deny** archivos en `dist/`, `web-build/`, `node_modules/`, `android/build/`.
- **`stop`** → [.firebender/hooks/auto-typecheck.ps1](.firebender/hooks/auto-typecheck.ps1):
  - Si `loop_count < 1` y hubo edits TS/TSX en la sesión, corre `npm run typecheck`.
  - Si falla, devuelve `followup_message` con el primer error para que el agente lo arregle.
  - Si pasa o `loop_count >= 1`, no devuelve nada.
- **`beforeShellExecution`** → [.firebender/hooks/guard-destructive.ps1](.firebender/hooks/guard-destructive.ps1):
  - Pide confirmación para `git push --force`, `Remove-Item -Recurse -Force C:\`, `rm -rf /`.

### 3. Nuevos comandos slash (.firebender/commands/)

- **`/review-diff`** ([review-diff.mdc](.firebender/commands/review-diff.mdc)) · `mode: read`, `model: default`: revisa `git diff` staged buscando bugs, problemas de tipado, hooks olvidados (invalidación, staleTime), uso de `axios` directo, console.log.
- **`/explain-screen`** ([explain-screen.mdc](.firebender/commands/explain-screen.mdc)) · `mode: read`, `model: quick`: resume una pantalla compleja (props, datos, navegación, permisos) sin leer toda la pantalla.
- **`/clean-logs`** ([clean-logs.mdc](.firebender/commands/clean-logs.mdc)) · `mode: write`: corre `npm run check-logs`, quita `console.log` y deja `logger.*` cuando sea necesario.
- **`/find-usages`** ([find-usages.mdc](.firebender/commands/find-usages.mdc)) · `mode: read`: pide símbolo o ruta y usa `find_usages` LSP, no grep, para mostrar dónde se usa antes de un refactor.
- **`/split-large-file`** ([split-large-file.mdc](.firebender/commands/split-large-file.mdc)) · `mode: write`: delega al subagente `refactor-large-file` con el archivo seleccionado.
- **`/run-screen`** ([run-screen.mdc](.firebender/commands/run-screen.mdc)) · `mode: write`: corre `npm run electron:run` (terminal 1) y luego abre Electron en terminal 2 — automatiza el flujo de dos terminales documentado.
- **`/bump-version`** ([bump-version.mdc](.firebender/commands/bump-version.mdc)) · `mode: write`: incrementa patch en `app.json` y `package.json`, hace commit y push.

### 4. Skills (`.firebender/skills/<skill>/SKILL.md`)

- **`commit-message`** — formato de commits en español (imperativo, sin tipo Conventional Commits), longitud ≤72 chars, ejemplos.
- **`permission-checker`** — sabe leer `src/constants/permissions.ts`, encontrar el permiso correcto por módulo y mostrar el patrón de uso.
- **`design-token-finder`** — consulta `src/design-system/tokens/*` para colores/spacing/typography antes de hardcodear.
- **`react-query-pattern`** — cookbook de queryKeys, staleTime e invalidaciones del proyecto, con snippets reales de `useProducts.ts`.

### 5. Subagentes y reglas finas

**Nuevos subagentes** en [.firebender/agents/](.firebender/agents/):

- **`planner`** — `model: large`, descompone tareas grandes en pasos, marca dependencias y delega a otros subagentes. Útil cuando el usuario pide "implementa X feature completa".
- **`refactor-large-file`** — `model: large`, especializado en partir archivos >1500 líneas: extrae sub-componentes a `components/<Modulo>/`, hooks a `hooks/`, mantiene la lógica de negocio intacta, valida con `npm run typecheck`.
- **`code-reviewer`** — `model: small`, hace pasada de revisión sobre el último diff (lo que ya hace `/review-diff` pero como subagente invocable por el padre tras escribir código).
- **Mejorar `api-integrator`** — añadir keywords en `description` ("añade endpoint", "nuevo módulo backend", "service + hook") para autoinvocación mejor.
- **Mejorar `screen-builder`** — keywords ("nueva pantalla", "lista de", "detalle de", "formulario de").

**Reglas con globs por módulo de negocio** (`alwaysApply: false`, solo cuando se toquen):

- [.firebender/rules/campaigns.mdc](.firebender/rules/campaigns.mdc) — `globs: "src/screens/Campaigns/**, src/components/Campaigns/**"`: anti-patterns vistos en `CampaignDetailScreen.tsx`, recordatorio de usar hooks `useCampaigns`, advertencia sobre tamaño y sugerencia de `/split-large-file`.
- [.firebender/rules/repartos.mdc](.firebender/rules/repartos.mdc) — `globs: "src/screens/Repartos/**, src/components/Repartos/**"`: convenciones específicas, links a `repartos.ts`/`useRepartos.ts`.
- [.firebender/rules/inventory.mdc](.firebender/rules/inventory.mdc) — `globs: "src/screens/Inventory/**, src/components/Inventory/**"`: integración con `useStock`, `inventory.ts`, modales de detalle.
- [.firebender/rules/navigation.mdc](.firebender/rules/navigation.mdc) — `globs: "src/navigation/**, src/constants/routes.ts"`: cómo agregar nueva ruta sin romper el stack de 1871 líneas.

### 6. Registro de subagentes y validación

- Actualizar [firebender.json](firebender.json) con los nuevos agentes (`planner`, `refactor-large-file`, `code-reviewer`).
- Verificar al final que todos los `.mdc` y `.md` parsean correctamente y que `firebender.json` apunta a archivos existentes.

### Resultado esperado

- Tokens base por turno: de ~50 líneas (estado actual) a un núcleo aún más pequeño, con reglas que se cargan dinámicamente por glob.
- Reducción de "viajes ciegos" al leer archivos gigantes (hook bloquea `ubigeo.ts`).
- Auto-format y typecheck automático tras edits → menos iteraciones manuales del usuario.
- Comandos slash cubren los 6–8 flujos repetitivos del día a día.
- Subagentes con autoinvoke afinada → el agente principal delega en vez de saturar contexto.
- Plan separado y herramienta dedicada para los 6 archivos >2.500 líneas.

### Notas de plataforma

- Hooks escritos en PowerShell (`.ps1`) por ser entorno Windows; usarán `pwsh -NoProfile -File` para arranque rápido.
- `npm run typecheck` tarda ~10–20s en este proyecto; el hook `stop` lo corre máximo una vez por turno (gracias a `loop_count`).
- No se introducen dependencias nuevas en `package.json`.
