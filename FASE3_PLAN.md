# 🎯 FASE 3: MEDIO (1-2 meses)

## 📋 Resumen Ejecutivo

**Objetivo:** Mejorar la calidad del código, testing, y observabilidad de la aplicación.

**Duración Estimada:** 1-2 meses

**Prioridad:** MEDIO

---

## 🧪 1. Implementar Suite de Testing

### 1.1 Testing Unitario (Jest)

**Objetivo:** Cubrir lógica de negocio y utilidades con tests unitarios.

#### Archivos a Testear (Prioridad Alta)

**Hooks de React Query:**
- [ ] `src/hooks/api/useProducts.ts` - 9 hooks
- [ ] `src/hooks/api/useCampaigns.ts` - 15 hooks
- [ ] `src/hooks/api/useStock.ts` - 11 hooks
- [ ] `src/hooks/api/usePurchases.ts` - 20 hooks
- [ ] `src/hooks/api/useExpenses.ts` - 40+ hooks
- [ ] `src/hooks/api/useRepartos.ts` - 13 hooks

**Utilidades:**
- [ ] `src/utils/logger.ts` - Logging y Sentry integration
- [ ] `src/utils/config.ts` - Configuration management
- [ ] `src/utils/validation.ts` - Validaciones de formularios
- [ ] `src/utils/formatters.ts` - Formateo de datos

**Stores (Zustand):**
- [ ] `src/store/auth.ts` - Authentication state
- [ ] `src/store/cart.ts` - Shopping cart logic
- [ ] `src/store/ui.ts` - UI state management

**Servicios API:**
- [ ] `src/services/api/products.ts`
- [ ] `src/services/api/campaigns.ts`
- [ ] `src/services/api/expenses.ts`
- [ ] `src/services/api/auth.ts`

#### Setup Necesario

```bash
# Instalar dependencias de testing
npm install --save-dev @testing-library/react-native @testing-library/jest-native jest-expo
npm install --save-dev @testing-library/react-hooks
npm install --save-dev @types/jest

# Configurar Jest
# Crear jest.config.js
# Crear setupTests.ts
```

#### Estructura de Tests

```
tests/
├── unit/
│   ├── hooks/
│   │   ├── useProducts.test.ts
│   │   ├── useCampaigns.test.ts
│   │   └── ...
│   ├── utils/
│   │   ├── logger.test.ts
│   │   ├── formatters.test.ts
│   │   └── ...
│   ├── stores/
│   │   ├── auth.test.ts
│   │   └── cart.test.ts
│   └── services/
│       ├── products.test.ts
│       └── ...
├── integration/
│   ├── auth-flow.test.ts
│   ├── cart-flow.test.ts
│   └── ...
└── e2e/
    ├── login.test.ts
    ├── products.test.ts
    └── ...
```

#### Métricas de Éxito

- [ ] **70%+ code coverage** en utilidades
- [ ] **60%+ code coverage** en hooks
- [ ] **50%+ code coverage** en servicios
- [ ] **Todos los tests pasan** en CI/CD

---

### 1.2 Testing de Componentes (React Native Testing Library)

**Objetivo:** Testear componentes UI y su comportamiento.

#### Componentes a Testear (Prioridad Alta)

**Componentes Comunes:**
- [ ] `src/components/common/Button.tsx`
- [ ] `src/components/common/Input.tsx`
- [ ] `src/components/common/Card.tsx`
- [ ] `src/components/common/Modal.tsx`
- [ ] `src/components/common/LazyLoadFallback.tsx`

**Componentes de Productos:**
- [ ] `src/components/products/ProductCard.tsx`
- [ ] `src/components/products/ProductList.tsx`
- [ ] `src/components/products/ProductFilter.tsx`

**Componentes de Campañas:**
- [ ] `src/components/campaigns/CampaignCard.tsx`
- [ ] `src/components/campaigns/CampaignList.tsx`

#### Ejemplo de Test

```typescript
// src/components/common/__tests__/Button.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button Component', () => {
  it('renders correctly', () => {
    const { getByText } = render(<Button title="Click me" />);
    expect(getByText('Click me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button title="Click me" onPress={onPress} />
    );

    fireEvent.press(getByText('Click me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    const { getByText } = render(
      <Button title="Click me" loading={true} />
    );

    const button = getByText('Click me');
    expect(button).toBeDisabled();
  });
});
```

---

### 1.3 Testing E2E (Detox o Maestro)

**Objetivo:** Testear flujos completos de usuario.

#### Flujos Críticos a Testear

- [ ] **Login Flow** - Usuario se autentica correctamente
- [ ] **Product Search** - Buscar y filtrar productos
- [ ] **Add to Cart** - Agregar productos al carrito
- [ ] **Create Campaign** - Crear una campaña completa
- [ ] **Stock Management** - Actualizar stock de productos
- [ ] **Expense Creation** - Crear y aprobar gastos
- [ ] **Logout Flow** - Cerrar sesión correctamente

#### Setup E2E (Opción: Maestro)

```bash
# Instalar Maestro (más simple que Detox)
curl -Ls "https://get.maestro.mobile.dev" | bash

# Crear flujos de test
mkdir -p .maestro
```

#### Ejemplo de Flujo E2E

```yaml
# .maestro/login-flow.yaml
appId: com.joanis.admin
---
- launchApp
- tapOn: "Email"
- inputText: "admin@joanis.com"
- tapOn: "Password"
- inputText: "password123"
- tapOn: "Login"
- assertVisible: "Dashboard"
```

---

## 🎨 2. Refactorizar Componentes Grandes

### 2.1 Análisis de Componentes

**Objetivo:** Identificar componentes grandes y dividirlos en componentes más pequeños y reutilizables.

#### Componentes a Refactorizar (Prioridad)

**Pantallas Grandes (>500 líneas):**
- [ ] `src/screens/Campaigns/CampaignDetailScreen.tsx` (~800 líneas)
- [ ] `src/screens/Campaigns/CampaignProductDetailScreen.tsx` (~700 líneas)
- [ ] `src/screens/Expenses/ExpensesScreen.tsx` (~600 líneas)
- [ ] `src/screens/Purchases/PurchasesScreen.tsx` (~550 líneas)

#### Estrategia de Refactorización

**Para CampaignDetailScreen:**

```
CampaignDetailScreen.tsx (800 líneas)
↓
Dividir en:
├── CampaignDetailScreen.tsx (200 líneas) - Container
├── components/
│   ├── CampaignHeader.tsx (100 líneas)
│   ├── CampaignTabs.tsx (80 líneas)
│   ├── CampaignProductsTab.tsx (150 líneas)
│   ├── CampaignDistributionTab.tsx (150 líneas)
│   ├── CampaignStatsTab.tsx (120 líneas)
│   └── CampaignActions.tsx (100 líneas)
```

**Beneficios:**
- ✅ Componentes más pequeños y manejables
- ✅ Mejor reutilización de código
- ✅ Más fácil de testear
- ✅ Mejor performance (memoización más efectiva)

---

### 2.2 Extraer Lógica Compleja a Custom Hooks

**Objetivo:** Separar lógica de negocio de la UI.

#### Hooks a Crear

**Para CampaignDetailScreen:**
- [ ] `useCampaignTabs.ts` - Manejo de tabs
- [ ] `useCampaignActions.ts` - Acciones de campaña
- [ ] `useCampaignStats.ts` - Cálculos de estadísticas

**Para ExpensesScreen:**
- [ ] `useExpenseFilters.ts` - Filtros de gastos
- [ ] `useExpenseActions.ts` - Acciones de gastos
- [ ] `useExpenseStats.ts` - Estadísticas de gastos

**Ejemplo:**

```typescript
// src/hooks/useCampaignTabs.ts
export const useCampaignTabs = (campaignId: string) => {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = useMemo(() => [
    { key: 'products', title: 'Productos' },
    { key: 'distribution', title: 'Distribución' },
    { key: 'stats', title: 'Estadísticas' },
  ], []);

  const handleTabChange = useCallback((index: number) => {
    setActiveTab(index);
  }, []);

  return { activeTab, tabs, handleTabChange };
};
```

---

## 🎨 3. Eliminar Código Duplicado

### 3.1 Identificar Duplicación

**Objetivo:** Encontrar y eliminar código duplicado en la aplicación.

#### Áreas con Duplicación Conocida

**Filtros de Estado:**
- [ ] `ExpensesScreen.tsx` - renderStatusFilter
- [ ] `PurchasesScreen.tsx` - renderStatusFilter
- [ ] `RepartosScreen.tsx` - renderStatusFilter

**Solución:** Crear componente reutilizable `StatusFilter.tsx`

**Paginación:**
- [ ] Múltiples pantallas tienen lógica de paginación similar

**Solución:** Crear hook `usePagination.ts`

**Formularios:**
- [ ] Validación de formularios repetida
- [ ] Manejo de errores similar

**Solución:** Crear hooks `useForm.ts` y `useFormValidation.ts`

---

### 3.2 Crear Componentes Reutilizables

#### Componentes a Crear

**StatusFilter Component:**
```typescript
// src/components/common/StatusFilter.tsx
interface StatusFilterProps {
  statuses: Array<{ value: string; label: string; color: string }>;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
}

export const StatusFilter: React.FC<StatusFilterProps> = ({
  statuses,
  selectedStatus,
  onStatusChange,
}) => {
  // Implementación reutilizable
};
```

**DataTable Component:**
```typescript
// src/components/common/DataTable.tsx
interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowPress?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: string;
}

export const DataTable = <T,>({
  data,
  columns,
  onRowPress,
  loading,
  emptyMessage,
}: DataTableProps<T>) => {
  // Implementación reutilizable
};
```

**SearchBar Component:**
```typescript
// src/components/common/SearchBar.tsx
interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder,
  onClear,
}) => {
  // Implementación reutilizable
};
```

---

### 3.3 Crear Hooks Reutilizables

#### Hooks a Crear

**usePagination:**
```typescript
// src/hooks/usePagination.ts
export const usePagination = (totalItems: number, pageSize: number = 20) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(totalItems / pageSize);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  return {
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
};
```

**useDebounce:**
```typescript
// src/hooks/useDebounce.ts
export const useDebounce = <T>(value: T, delay: number = 500): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};
```

**useForm:**
```typescript
// src/hooks/useForm.ts
export const useForm = <T extends Record<string, any>>(
  initialValues: T,
  validationSchema?: any
) => {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const handleChange = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleBlur = useCallback((field: keyof T) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const validate = useCallback(() => {
    if (!validationSchema) return true;
    // Implementar validación
    return true;
  }, [validationSchema, values]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validate,
    reset,
  };
};
```

---

## 📊 4. Implementar Analytics y Monitoring

### 4.1 Analytics de Usuario (Firebase Analytics o Mixpanel)

**Objetivo:** Entender cómo los usuarios usan la aplicación.

#### Eventos a Trackear

**Autenticación:**
- [ ] `user_login` - Usuario inicia sesión
- [ ] `user_logout` - Usuario cierra sesión
- [ ] `login_failed` - Fallo en login

**Productos:**
- [ ] `product_viewed` - Usuario ve detalle de producto
- [ ] `product_searched` - Usuario busca productos
- [ ] `product_filtered` - Usuario filtra productos
- [ ] `product_created` - Nuevo producto creado
- [ ] `product_updated` - Producto actualizado

**Campañas:**
- [ ] `campaign_created` - Nueva campaña creada
- [ ] `campaign_viewed` - Usuario ve detalle de campaña
- [ ] `campaign_published` - Campaña publicada
- [ ] `campaign_closed` - Campaña cerrada

**Carrito:**
- [ ] `product_added_to_cart` - Producto agregado al carrito
- [ ] `product_removed_from_cart` - Producto removido
- [ ] `cart_cleared` - Carrito vaciado
- [ ] `order_created` - Orden creada desde carrito

**Gastos:**
- [ ] `expense_created` - Nuevo gasto creado
- [ ] `expense_approved` - Gasto aprobado
- [ ] `expense_rejected` - Gasto rechazado

#### Setup Firebase Analytics

```bash
# Instalar Firebase
npx expo install @react-native-firebase/app @react-native-firebase/analytics

# Configurar en app.json
```

#### Ejemplo de Uso

```typescript
// src/utils/analytics.ts
import analytics from '@react-native-firebase/analytics';

export const trackEvent = async (
  eventName: string,
  params?: Record<string, any>
) => {
  try {
    await analytics().logEvent(eventName, params);
  } catch (error) {
    logger.error('Analytics error', error);
  }
};

export const trackScreen = async (screenName: string) => {
  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  } catch (error) {
    logger.error('Analytics error', error);
  }
};

// Uso en componentes
trackEvent('product_viewed', {
  product_id: product.id,
  product_name: product.name,
  category: product.category,
});
```

---

### 4.2 Performance Monitoring (Ya implementado con Sentry)

**Objetivo:** Monitorear performance de la app en producción.

#### Métricas a Monitorear

- [ ] **App Startup Time** - Tiempo de inicio
- [ ] **Screen Load Time** - Tiempo de carga de pantallas
- [ ] **API Response Time** - Tiempo de respuesta de APIs
- [ ] **Memory Usage** - Uso de memoria
- [ ] **Crash Rate** - Tasa de crashes
- [ ] **ANR Rate** - App Not Responding rate

#### Transacciones Personalizadas

```typescript
// src/utils/performance.ts
import * as Sentry from '@sentry/react-native';

export const measurePerformance = async <T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> => {
  const transaction = Sentry.startTransaction({
    name: operationName,
    op: 'custom',
  });

  try {
    const result = await operation();
    transaction.setStatus('ok');
    return result;
  } catch (error) {
    transaction.setStatus('error');
    throw error;
  } finally {
    transaction.finish();
  }
};

// Uso
const products = await measurePerformance(
  'fetch-products',
  () => fetchProducts({ page: 1, limit: 20 })
);
```

---

### 4.3 User Behavior Tracking

**Objetivo:** Entender patrones de uso y mejorar UX.

#### Métricas de Comportamiento

- [ ] **Session Duration** - Duración de sesiones
- [ ] **Screen Time** - Tiempo en cada pantalla
- [ ] **Feature Usage** - Qué features se usan más
- [ ] **User Flow** - Flujos de navegación comunes
- [ ] **Drop-off Points** - Dónde abandonan los usuarios

#### Implementación

```typescript
// src/hooks/useScreenTracking.ts
export const useScreenTracking = (screenName: string) => {
  const startTime = useRef(Date.now());

  useEffect(() => {
    // Track screen view
    trackScreen(screenName);

    return () => {
      // Track time spent on screen
      const timeSpent = Date.now() - startTime.current;
      trackEvent('screen_time', {
        screen: screenName,
        duration: timeSpent,
      });
    };
  }, [screenName]);
};

// Uso en pantallas
const ProductsScreen = () => {
  useScreenTracking('ProductsScreen');
  // ...
};
```

---

## 📋 Plan de Implementación

### Semana 1-2: Testing Setup
- [ ] Configurar Jest y React Native Testing Library
- [ ] Crear estructura de carpetas de tests
- [ ] Escribir primeros tests unitarios (utils)
- [ ] Configurar CI/CD para ejecutar tests

### Semana 3-4: Testing de Hooks y Servicios
- [ ] Tests para hooks de React Query
- [ ] Tests para servicios API
- [ ] Tests para stores de Zustand
- [ ] Alcanzar 50%+ coverage

### Semana 5-6: Testing de Componentes
- [ ] Tests para componentes comunes
- [ ] Tests para componentes de productos
- [ ] Tests para componentes de campañas
- [ ] Alcanzar 60%+ coverage

### Semana 7-8: Refactorización
- [ ] Refactorizar CampaignDetailScreen
- [ ] Refactorizar CampaignProductDetailScreen
- [ ] Refactorizar ExpensesScreen
- [ ] Crear componentes reutilizables

### Semana 9-10: Eliminar Duplicación
- [ ] Crear StatusFilter component
- [ ] Crear DataTable component
- [ ] Crear hooks reutilizables (usePagination, useDebounce, useForm)
- [ ] Refactorizar pantallas para usar nuevos componentes

### Semana 11-12: Analytics y Monitoring
- [ ] Configurar Firebase Analytics
- [ ] Implementar tracking de eventos
- [ ] Configurar dashboards en Sentry
- [ ] Implementar performance monitoring personalizado

---

## 📊 Métricas de Éxito

### Testing
- [ ] **70%+ code coverage** en total
- [ ] **100% tests passing** en CI/CD
- [ ] **0 critical bugs** en producción

### Refactorización
- [ ] **Reducir 40%** líneas de código en componentes grandes
- [ ] **Crear 10+** componentes reutilizables
- [ ] **Crear 5+** hooks reutilizables

### Código Duplicado
- [ ] **Reducir 30%** código duplicado
- [ ] **Aumentar 50%** reutilización de componentes

### Analytics
- [ ] **Trackear 20+** eventos críticos
- [ ] **100%** pantallas con tracking
- [ ] **Dashboards** configurados y funcionando

---

## 🎯 Entregables

1. **Suite de Testing Completa**
   - Tests unitarios, de integración y E2E
   - Coverage reports
   - CI/CD pipeline configurado

2. **Componentes Refactorizados**
   - Componentes más pequeños y manejables
   - Mejor separación de responsabilidades
   - Documentación de componentes

3. **Biblioteca de Componentes Reutilizables**
   - 10+ componentes comunes
   - 5+ hooks personalizados
   - Storybook (opcional)

4. **Sistema de Analytics**
   - Firebase Analytics configurado
   - 20+ eventos trackeados
   - Dashboards de métricas

5. **Documentación**
   - Guía de testing
   - Guía de componentes
   - Guía de analytics

---

**Estado:** 📋 PLANIFICADO
**Duración:** 1-2 meses
**Prioridad:** MEDIO
**Dependencias:** Fase 2 completada ✅
