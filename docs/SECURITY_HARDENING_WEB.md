# Hardening de seguridad · Web (Cloudflare)

Este documento resume los cambios de seguridad aplicados al frontend web
(desplegado como Cloudflare Workers Static Assets en `https://app.gritlabs.app`)
y lista lo que queda pendiente en el backend y en operaciones para completar el
endurecimiento.

> Aclaracion: la web NO se sirve con `cloudflared` (tunnel), sino con
> Cloudflare Workers Static Assets (`wrangler.toml`). El hardening aplica igual.

## 1. Cambios en el frontend

Cinco commits en `master`, en orden cronologico:

| Commit | Fase | Resumen |
| --- | --- | --- |
| `dd5b9f6` | 1 · Secretos | Sacar `.env` del index, quitar `EXPO_PUBLIC_GITHUB_TOKEN` del cliente, quitar `APP_ID` hardcodeado. |
| `2d62437` | 2 · Edge/CSP | Nuevos headers en `public/_headers` + externalizacion de scripts inline. |
| `b29e95f` | 3 · XSS Webmail | Sanitizacion con DOMPurify del HTML de correos. |
| `f410f58` | 4 · Cookies HttpOnly | Soporte opt-in de cookies + CSRF en `apiClient` (solo web). |
| `bf27909` | 5 · Login | Validacion de credenciales con `yup`, limpieza de `console.log`. |

### 1.1 Fuga de secretos (`.env`)

- `.env` estaba trackeado pese al `.gitignore`. Se removio del index con
  `git rm --cached .env` (queda en disco local del desarrollador).
- Se elimino el uso de `EXPO_PUBLIC_GITHUB_TOKEN` en
  `src/components/Navigation/SettingsModal.tsx`. Cualquier variable prefijada
  `EXPO_PUBLIC_*` viaja al bundle web y es publica: un PAT NUNCA debe estar
  ahi. Para releases privados, la verificacion de version debe proxyarse por
  backend (ver seccion 2).
- Se elimino el fallback de UUID hardcodeado de `APP_ID` en
  `src/utils/config.ts` para evitar operar contra un tenant por defecto.
- Se creo `.env.example` documentando cada variable.

### 1.2 Headers y CSP en Cloudflare

Archivo: `public/_headers` (aplicado por Cloudflare al servir la SPA).

Nuevos headers aplicados a `/*`:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy` estricta con `script-src 'self'` (sin
  `unsafe-inline` ni `unsafe-eval`).
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `X-Frame-Options: DENY` + `frame-ancestors 'none'` (el ERP no debe embeberse)
- `Permissions-Policy` endurecida (bloquea `camera`, `microphone`, `payment`,
  `usb`, `interest-cohort`; `geolocation=(self)` solo se mantiene si se usa).
- `X-Permitted-Cross-Domain-Policies: none`

CSP relevante:

```
default-src 'self';
script-src 'self'; script-src-elem 'self';
style-src 'self' 'unsafe-inline'; style-src-elem 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' https: wss:;
media-src 'self' blob:;
worker-src 'self' blob:;
manifest-src 'self';
frame-src 'self';
frame-ancestors 'none';
form-action 'self';
base-uri 'self';
object-src 'none';
upgrade-insecure-requests
```

`style-src` mantiene `'unsafe-inline'` porque React Native Web inyecta estilos
en runtime. El vector critico de XSS es `script-src`, que queda estricto.

### 1.3 Extraccion de scripts inline

Para poder aplicar `script-src 'self'` sin `'unsafe-inline'`, los dos scripts
que antes se inyectaban inline en `index.html` (polyfills de Metro y registro
de Service Worker) se externalizaron a archivos servidos con la SPA:

- `public/metro-polyfill.js`
- `public/sw-register.js`

`scripts/copy-cloudflare-assets.js` los copia a `web-build/` durante el build.

### 1.4 XSS en Webmail

`src/screens/Webmail/WebmailMessageScreen.tsx` renderizaba HTML de correos
con `dangerouslySetInnerHTML` sin sanitizar. Ahora todo HTML pasa por
DOMPurify antes de inyectarse:

- Bloqueados: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`,
  `<base>`, `<meta>`, `<link>`, todos los event handlers `on*=`, esquemas
  `javascript:`.
- Todos los `<a>` post-sanitize se fuerzan a
  `target="_blank" rel="noopener noreferrer nofollow"`.
- Dependencia agregada: `dompurify` + `@types/dompurify`.

### 1.5 Cookies HttpOnly + CSRF (opt-in)

Nuevo flag en `src/utils/config.ts`:

```ts
USE_COOKIE_AUTH_WEB: process.env.EXPO_PUBLIC_USE_COOKIE_AUTH_WEB === 'true'
```

Comportamiento cuando `USE_COOKIE_AUTH_WEB=true` y `Platform.OS === 'web'`:

- `axios`, `fetch` (FormData) y `XMLHttpRequest` (uploads) usan
  `withCredentials: true` / `credentials: 'include'`.
- Se DEJA de adjuntar `Authorization: Bearer` (la sesion viaja en cookie
  HttpOnly manejada por backend).
- En `POST/PUT/PATCH/DELETE` se lee la cookie no-HttpOnly `csrf_token` con
  JS y se envia como header `X-CSRF-Token` (patron double-submit).

El flag esta en `false` por defecto: el flujo actual (Bearer + SecureStore
en nativo, Bearer + localStorage en web) sigue intacto hasta que el backend
soporte cookies + CSRF. Nativo (Android/iOS/Electron) NUNCA usa cookies:
mantiene Bearer + SecureStore por diseno.

Archivos tocados: `src/services/api/client.ts`, `src/utils/config.ts`.

### 1.6 Validacion de login

`src/screens/Auth/LoginScreen.tsx` validaba solo campos vacios. Ahora usa un
esquema `yup`:

- Email: obligatorio, formato valido, max 254 chars, trim + lowercase.
- Password: obligatorio, min 6, max 200.

Ademas se reemplazaron los `console.log` por `logger.*` segun convencion del
repo. El backend sigue siendo la fuente de verdad de autenticacion; esto solo
mejora UX y reduce ruido.

---

## 2. Cambios requeridos en el backend

Todo lo siguiente vive en el repo del backend. El frontend ya esta preparado
pero apagado (flag off) hasta que el backend implemente lo listado.

### 2.1 Cookies HttpOnly para sesion (obligatorio para 4.1)

Los endpoints `/auth/login` y `/auth/refresh` deben emitir dos cookies:

**Access token (HttpOnly):**

```
Set-Cookie: access_token=<JWT>;
  HttpOnly;
  Secure;
  SameSite=Strict;
  Path=/;
  Max-Age=<segundos hasta expirar>;
  Domain=app.gritlabs.app          # o el dominio raiz si se necesita subdomains
```

**Refresh token (HttpOnly, path restringido):**

```
Set-Cookie: refresh_token=<JWT>;
  HttpOnly;
  Secure;
  SameSite=Strict;
  Path=/auth;                       # solo se envia al endpoint de refresh
  Max-Age=<30 dias o segun rememberMe>;
```

**CSRF token (NO HttpOnly, legible por JS):**

```
Set-Cookie: csrf_token=<random 32+ bytes base64>;
  Secure;
  SameSite=Strict;
  Path=/;
  Max-Age=<mismo que access_token>;
```

- El `csrf_token` debe estar ligado a la sesion (guardado server-side o
  firmado con el JWT) para que el server pueda validar el header
  `X-CSRF-Token` en cada request mutante.
- El frontend leera esta cookie con `document.cookie` (por eso NO es
  HttpOnly) y la reenviara como header.

### 2.2 Endpoints de auth

- `POST /auth/login`: valida credenciales, setea las 3 cookies, responde
  `{ user, permissions, roles }` (sin tokens en el body, para no exponerlos
  en logs/history).
- `POST /auth/refresh`: valida `refresh_token` de la cookie, rota cookies
  (mismo esquema), responde `{ user }`. Idempotente y solo lee la cookie del
  path `/auth`.
- `POST /auth/logout`: limpia las 3 cookies con
  `Max-Age=0` (mismos flags para que el navegador las borre).
- `POST /auth/heartbeat`: ya existe; debe seguir funcionando con la cookie
  de sesion.

### 2.3 Validacion de CSRF (obligatorio para 4.1)

Middleware que en TODA request mutante (`POST`, `PUT`, `PATCH`, `DELETE`):

1. Lee la cookie `csrf_token`.
2. Lee el header `X-CSRF-Token`.
3. Rechaza con `403 Forbidden` si faltan o no coinciden.
4. Excluye del check el endpoint de `POST /auth/login` (el usuario aun no
   tiene sesion) y opcionalmente `POST /auth/refresh` (basta con el
   `SameSite=Strict` en su cookie).

### 2.4 CORS (obligatorio para 4.1)

El backend responde desde un dominio distinto (`api.<dominio>`) al frontend
(`app.gritlabs.app`), asi que el navegador considera esto cross-site. Para
que las cookies HttpOnly viajen:

```
Access-Control-Allow-Origin: https://app.gritlabs.app     # NUNCA * con credenciales
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, X-App-Id, X-App-Version,
                              X-User-Id, X-Company-Id, X-Site-Id, X-Warehouse-Id
Access-Control-Max-Age: 600
```

- El origen debe ser el exacto (uno solo, o una lista blanca). `*` es
  incompatible con `Allow-Credentials: true`.
- Recordar responder correctamente al preflight `OPTIONS`.

Ademas: si el backend esta detras de Cloudflare tambien, el dominio del
API debe ser un subdominio del mismo apex (`app.gritlabs.app` /
`api.gritlabs.app`) para poder considerar cookies como "first-party" con
`SameSite=Strict`. Si son dominios totalmente distintos, `SameSite=Strict`
puede impedir que la cookie viaje en navegaciones iniciales; en ese caso
usar `SameSite=Lax` como fallback documentado.

### 2.5 Verificacion de release desde el cliente (obligatorio para 1.1)

Hoy `SettingsModal` chequea GitHub API sin token (funciona con repos
publicos, 60 req/hora por IP). Si el repo `Aronis-web/admin-frontend-joanis`
es privado o se supera el rate limit, se necesita un endpoint proxy:

- `GET /system/latest-release`
- Backend guarda el `GH_TOKEN` como secreto (env var del servidor, nunca en
  cliente) y consulta `api.github.com/repos/Aronis-web/admin-frontend-joanis/releases/latest`.
- Responde `{ tagName, htmlUrl, publishedAt }`.
- Alternativa: publicar un `latest.json` en un bucket o en el propio
  Cloudflare Worker y que el cliente lo lea directamente.

### 2.6 Content-Security-Policy · `connect-src`

Hoy la CSP en `public/_headers` es permisiva con `connect-src 'self' https:
wss:` para no romper el API. Cuando el API_URL sea estable y unico, se
recomienda cerrarla al host exacto. Coordinar con backend para publicar la
lista final de origenes de `connect-src`:

- `https://api.gritlabs.app` (o el subdominio real)
- Sentry ingest: `https://o4510767992012800.ingest.us.sentry.io`
- Google Maps (si se usa): `https://maps.googleapis.com https://maps.gstatic.com`
- WebSocket si aplica: `wss://api.gritlabs.app`

### 2.7 Cache y headers de respuesta

- Todas las respuestas autenticadas deben llevar
  `Cache-Control: no-store` para evitar que caches intermedios o el
  Service Worker las almacenen.
- `Set-Cookie` con `Secure` implica que en dev local via `http://` no
  llegara. Documentar workaround en `.env.dev` o exponer un dominio con
  TLS local.

---

## 3. Acciones manuales pendientes (operaciones)

Ninguna de estas se puede hacer desde codigo; requieren interaccion humana.

1. **Rotar credenciales filtradas** que estaban en `.env` commiteado:
   - GitHub PAT `ghp_...` (revocar en GitHub Settings -> Developer Settings
     -> Personal Access Tokens).
   - Google Maps API key: rotar y RESTRINGIR por HTTP referrer a
     `https://app.gritlabs.app/*` desde Google Cloud Console.
   - Sentry DSN: si se sospecha exposicion, regenerar proyecto (o al menos
     limitar rate y ambitos).
2. **Purgar `.env` del historial de git** con `git filter-repo` o BFG
   Repo-Cleaner, coordinado con todo el equipo (todos deben re-clonar).
   Sin esto, los secretos siguen accesibles en la historia publica.
3. **Cloudflare Dashboard**:
   - `SSL/TLS`: modo Full (strict), TLS minimo 1.2 (idealmente 1.3),
     activar "Always Use HTTPS".
   - `Security -> WAF`: activar Managed Rules y OWASP Core Ruleset.
   - `Security -> Bots`: activar Bot Fight Mode.
   - `Security -> Rate Limiting`: regla para `/auth/*` (ej. 10 req/min por
     IP) y otra para el resto (ej. 300 req/min por IP).
   - Evaluar `Zero Trust -> Access` para poner el panel admin detras de una
     capa de autenticacion en el edge (SSO corporativo, IPs permitidas,
     etc.). Es la mejora individual de mayor impacto en un panel admin.
4. **Preload de HSTS**: cuando confirmes que TODOS los subdominios de
   `gritlabs.app` sirven HTTPS y no habra rollback, subir HSTS a
   `max-age=63072000; includeSubDomains; preload` y enviar a
   `hstspreload.org`. Revertir esto es lento.
5. **Escaneo post-deploy**: correr `securityheaders.com` y Mozilla
   Observatory contra `https://app.gritlabs.app` para verificar la
   configuracion final.

---

## 4. Activacion de cookies HttpOnly (checklist)

Cuando el backend implemente 2.1 a 2.4:

1. En Cloudflare Workers, agregar la variable de build
   `EXPO_PUBLIC_USE_COOKIE_AUTH_WEB=true`.
2. Redeploy: `npm run deploy:cloudflare`.
3. Verificar en el navegador (DevTools):
   - Login: aparecen 3 cookies (`access_token`, `refresh_token`,
     `csrf_token`) marcadas HttpOnly (excepto `csrf_token`).
   - Requests: llevan `Cookie:` header, NO llevan `Authorization: Bearer`.
   - Mutaciones: llevan `X-CSRF-Token`.
   - Logout: las 3 cookies desaparecen.
4. Probar refresh reactivo forzando un `401` (borrar `access_token` con
   DevTools y hacer una request) y confirmar que se rota via
   `POST /auth/refresh`.
5. En este punto se puede DEJAR de escribir tokens en `localStorage` en
   web (limpiar `src/utils/secureStorage.ts` para no persistir nada
   sensible en el fallback web). Se documentara en un commit siguiente
   una vez validado el flujo end-to-end.

---

## 5. Referencias rapidas

- `public/_headers` – headers en el edge.
- `scripts/copy-cloudflare-assets.js` – copia headers, extrae scripts inline.
- `public/metro-polyfill.js`, `public/sw-register.js` – scripts externalizados.
- `src/services/api/client.ts` – interceptores + soporte cookie/CSRF.
- `src/utils/config.ts` – flag `USE_COOKIE_AUTH_WEB`.
- `src/screens/Webmail/WebmailMessageScreen.tsx` – sanitizacion con DOMPurify.
- `src/screens/Auth/LoginScreen.tsx` – validacion `yup`.
- `.env.example` – documentacion de variables.
