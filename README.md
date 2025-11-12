# Joanis Mobile App

Una aplicación móvil completa de e-commerce construida con React Native y TypeScript, con autenticación, carrito de compras, productos y perfil de usuario.

## 📋 Requisitos

- **Node.js** LTS (v18 o superior)
- **npm** o **yarn**
- **React Native CLI** o **Expo CLI**
- **iOS Simulator** (solo macOS) o **Android Emulator**
- **TypeScript** conocimientos básicos

## 🚀 Inicio Rápido

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
REACT_APP_API_URL=https://api.joanis.com
```

### 3. Iniciar Servidor de Desarrollo

```bash
npm start
```

### 4. Ejecutar en Plataforma Específica

#### iOS (solo macOS)
```bash
npm run ios
```

#### Android
```bash
npm run android
```

#### Web (si está soportado)
```bash
npm run web
```

## 📱 Flujo de la Aplicación

1. **Login/Registro** - El usuario ingresa email y contraseña o se registra
2. **Autenticación** - Token JWT almacenado de forma segura con AsyncStorage
3. **Pantalla Principal** - Muestra productos destacados con imágenes
4. **Detalle de Producto** - Ver información completa y agregar al carrito
5. **Carrito** - Revisar items, ajustar cantidades y proceder al pago
6. **Perfil** - Perfil de usuario, configuración y cierre de sesión

## ✨ Características Implementadas

- ✅ **Autenticación completa** (Login/Registro/Logout)
- ✅ **Gestión de estado global** con Zustand
- ✅ **Carrito de compras** persistente
- ✅ **Navegación** entre pantallas con React Navigation
- ✅ **Catálogo de productos** con búsqueda y filtros
- ✅ **Perfil de usuario** con información personal
- ✅ **Tema personalizable** con colores y espaciado
- ✅ **Componentes reutilizables** (Button, Header, Loader)
- ✅ **Validación de formularios**
- ✅ **Manejo de errores**
- ✅ **API client** con Axios y interceptores
- ✅ **TypeScript** para type safety
- ✅ **Servicio IAP** (In-App Purchases) preparado

## 🏗️ Arquitectura

### Gestión de Estado

- **Zustand** - State management global reactivo
  - `useAuthStore` - Autenticación y usuario
  - `useCartStore` - Carrito de compras
- **AsyncStorage** - Almacenamiento persistente local
- **React Hooks** - Estado local de componentes

### Navegación

- **React Navigation** v6 con Native Stack y Bottom Tabs
- **AuthStack** - Login, Register (no autenticado)
- **MainStack** - Home, ProductDetail (autenticado)
- **MainTabs** - Home, Cart, Profile (pestañas principales)

### Capa de API

Todas las llamadas a la API están centralizadas en `src/services/api/`:
- `client.ts` - Instancia de Axios con interceptores
- `auth.ts` - Endpoints de autenticación
- `files.ts` - Subida de archivos y URLs firmadas
- `products.ts` - Endpoints de productos

### Custom Hooks

- `useAuth()` - Hook para autenticación (login, register, logout, etc.)
- `useSignedUrl()` - Hook para obtener URLs firmadas de archivos privados

### Archivos Privados

Para archivos que requieren autenticación, usa URLs firmadas:
```typescript
import { useSignedUrl } from '@/hooks/useSignedUrl';

const { url, isLoading, error } = useSignedUrl(filePath);
```

El backend debe implementar el endpoint `/files/signed-url` que retorna:
```json
{
  "url": "https://api.joanis.com/private/file.pdf?token=xxx",
  "expiresAt": "2024-01-01T00:00:00Z"
}
```

## 🛠️ Available Scripts

- `npm start` - Start Expo development server
- `npm run ios` - Run on iOS simulator
- `npm run android` - Run on Android emulator
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## 📁 Estructura del Proyecto

```
frontend-app-joanis/
├── src/
│   ├── app/
│   │   └── index.tsx              # Punto de entrada de la app
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── Header.tsx         # Componente de encabezado
│   │   │   └── Loader.tsx         # Componente de carga
│   │   └── ui/
│   │       └── Button.tsx         # Componente de botón reutilizable
│   │
│   ├── hooks/
│   │   ├── useAuth.ts             # Hook de autenticación
│   │   └── useSignedUrl.ts        # Hook para URLs firmadas
│   │
│   ├── navigation/
│   │   └── index.tsx              # Configuración de navegación
│   │
│   ├── screens/
│   │   ├── Auth/
│   │   │   ├── LoginScreen.tsx    # Pantalla de login
│   │   │   └── RegisterScreen.tsx # Pantalla de registro
│   │   ├── Cart/
│   │   │   └── CartScreen.tsx     # Pantalla del carrito
│   │   ├── Home/
│   │   │   └── HomeScreen.tsx     # Pantalla principal
│   │   ├── Products/
│   │   │   └── ProductDetailScreen.tsx # Detalle de producto
│   │   └── Profile/
│   │       └── ProfileScreen.tsx  # Pantalla de perfil
│   │
│   ├── services/
│   │   ├── api/
│   │   │   ├── client.ts          # Cliente HTTP (Axios)
│   │   │   ├── auth.ts            # API de autenticación
│   │   │   ├── products.ts        # API de productos
│   │   │   ├── files.ts           # API de archivos
│   │   │   └── index.ts           # Exportaciones
│   │   └── iap/
│   │       └── index.ts           # Servicio de compras in-app
│   │
│   ├── store/
│   │   ├── auth.ts                # Store de autenticación
│   │   ├── cart.ts                # Store del carrito
│   │   └── index.ts               # Exportaciones
│   │
│   ├── theme/
│   │   ├── colors.ts              # Paleta de colores
│   │   ├── spacing.ts             # Espaciado y tipografía
│   │   └── index.ts               # Tema completo
│   │
│   └── utils/
│       ├── config.ts              # Configuración de la app
│       └── validators.ts          # Validadores de formularios
│
├── package.json
├── tsconfig.json
└── README.md
```

## 🔐 Autenticación

La app usa autenticación basada en JWT tokens:

1. Usuario ingresa email/password en `LoginScreen`
2. Backend retorna `{ token, user }`
3. Token se guarda en AsyncStorage (persistente)
4. Token se agrega automáticamente a todas las peticiones via interceptor de Axios
5. En respuesta 401, el usuario es deslogueado automáticamente

### Endpoints Requeridos en Backend

```typescript
POST /auth/login
{
  "email": "usuario@example.com",
  "password": "password123"
}
// Retorna: { token: string, user: User }

POST /auth/register
{
  "name": "Juan Pérez",
  "email": "usuario@example.com",
  "password": "password123",
  "phone": "+1234567890"  // opcional
}
// Retorna: { token: string, user: User }

POST /auth/logout
// Headers: { Authorization: "Bearer <token>" }
// Retorna: 204 No Content

GET /auth/me
// Headers: { Authorization: "Bearer <token>" }
// Retorna: User

PUT /auth/profile
// Headers: { Authorization: "Bearer <token>" }
// Body: Partial<User>
// Retorna: User
```

## 🎨 Personalización del Tema

Puedes personalizar los colores y estilos de la app editando:

```typescript
// src/theme/colors.ts
export const colors = {
  primary: '#6200EE',      // Color principal
  secondary: '#03DAC6',    // Color secundario
  // ... más colores
};

// src/theme/spacing.ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  // ... más espaciado
};
```

## 🧪 Conexión con el Backend

Para conectar con tu backend real:

1. Actualiza `REACT_APP_API_URL` en el archivo `.env`
2. Asegúrate de que los endpoints del backend coincidan con el formato esperado
3. Los endpoints deben retornar las interfaces definidas en `src/services/api/`

## 📦 Dependencias Principales

### Core
- **react** / **react-native** - Framework UI
- **typescript** - Type safety
- **@react-navigation/native** - Navegación
- **@react-navigation/native-stack** - Stack navigator
- **@react-navigation/bottom-tabs** - Tab navigator
- **axios** - Cliente HTTP
- **zustand** - Gestión de estado

### React Native
- **@react-native-async-storage/async-storage** - Almacenamiento local
- **react-native-safe-area-context** - Safe areas
- **react-native-screens** - Pantallas nativas optimizadas

### Opcional (según necesidad)
- **react-native-iap** - Compras in-app
- **expo-image-picker** - Selección de imágenes
- **expo-file-system** - Operaciones con archivos

## 🚧 Próximas Mejoras

### Alta Prioridad
- [ ] Implementar refresh token automático
- [ ] Agregar Error Boundary
- [ ] Agregar soporte offline (offline-first)
- [ ] Agregar estados de carga con skeletons
- [ ] Implementar búsqueda de productos
- [ ] Agregar filtros y categorías
- [ ] Tests unitarios e integración

### Características
- [ ] Completar flujo de checkout y pago
- [ ] Integrar pasarela de pagos (Stripe, PayPal, etc.)
- [ ] Push notifications
- [ ] Cache de imágenes optimizado
- [ ] Autenticación biométrica (Face ID / Touch ID)
- [ ] Historial de pedidos
- [ ] Wishlist / Lista de deseos
- [ ] Reseñas y calificaciones de productos
- [ ] Compartir productos en redes sociales

### Experiencia del Desarrollador
- [ ] Configuración de Prettier
- [ ] Pre-commit hooks (husky + lint-staged)
- [ ] Pipeline CI/CD
- [ ] Sentry para tracking de errores
- [ ] Analytics (Firebase, Mixpanel, etc.)
- [ ] Documentación de componentes con Storybook

## 📝 Uso de Componentes

### Botón
```typescript
import { Button } from '@/components/ui/Button';

<Button
  title="Presióname"
  onPress={() => console.log('Presionado')}
  variant="primary"  // primary | secondary | outline | text
  size="medium"      // small | medium | large
  loading={false}
  disabled={false}
  fullWidth={false}
/>
```

### Header
```typescript
import { Header } from '@/components/common/Header';

<Header
  title="Mi Pantalla"
  leftIcon={<Text>←</Text>}
  onLeftPress={() => navigation.goBack()}
  rightIcon={<Text>⚙️</Text>}
  onRightPress={() => navigation.navigate('Settings')}
/>
```

### Hook de Autenticación
```typescript
import { useAuth } from '@/hooks/useAuth';

const { user, isAuthenticated, login, logout, register } = useAuth();

// Login
await login({ email, password });

// Register
await register({ name, email, password, phone });

// Logout
await logout();
```

## 📄 Licencia

Proyecto privado - Todos los derechos reservados

## 🤝 Contribuir

Este es un proyecto privado. Para preguntas o problemas, contacta al equipo de desarrollo.

---

**Construido con ❤️ usando React Native y TypeScript**
