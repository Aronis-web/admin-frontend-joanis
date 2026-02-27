# 🐛 Debug - Categorías y Sedes No Cargan

**Fecha:** 2025-02-27
**Problema:** Las categorías y sedes no se cargan en el formulario de gastos

---

## 🔍 Análisis

### Código Actual

**Archivo:** `src/screens/Expenses/CreateExpenseScreen.tsx`

**Función `loadData()` (líneas 225-260):**
```typescript
const loadData = async () => {
  try {
    console.log('📦 Loading data for expense creation...');

    // Import sitesService
    const { sitesService } = await import('@/services/api');

    const [categoriesRes, templatesRes, sitesRes] = await Promise.all([
      expensesService.getCategories(),      // ← Línea 233
      expensesService.getTemplates(),       // ← Línea 234
      sitesService.getSites({ page: 1, limit: 100 }), // ← Línea 235
    ]);

    console.log('📦 Categories:', categoriesRes);
    console.log('📦 Templates:', templatesRes);
    console.log('📦 Sites:', sitesRes);

    setCategories(categoriesRes.data || []);
    setTemplates(Array.isArray(templatesRes) ? templatesRes : []);
    setSites(sitesRes.data || []);
  } catch (error: any) {
    console.error('❌ Error loading data:', error);
    Alert.alert('Error', 'No se pudieron cargar los datos necesarios');
  }
};
```

### Endpoints Actuales

**Categorías:**
```typescript
// src/services/api/expenses.ts (línea 149-154)
async getCategories(): Promise<ExpenseCategoriesResponse> {
  const categories = await apiClient.get<ExpenseCategory[]>(this.categoriesPath);
  return {
    data: categories,
  };
}

// this.categoriesPath = '/expense-categories' (línea 6)
```

**Sedes:**
```typescript
// src/services/api/sites.ts (línea 67)
const url = `/sites${queryString ? `?${queryString}` : ''}`;
return apiClient.get<SitesResponse>(url);
```

---

## 🎯 Posibles Causas

### 1. Error en el Backend
- El backend podría estar devolviendo un error 500 o 404
- Similar al problema que tuvimos con `/expenses`

### 2. Problema de Permisos
- El usuario podría no tener permisos para ver categorías o sedes
- El código tiene manejo de errores de permisos (línea 253-256)

### 3. Estructura de Respuesta Incorrecta
- El backend podría estar devolviendo una estructura diferente
- Por ejemplo: `{ categories: [...] }` en lugar de `[...]`

### 4. Headers Faltantes
- Podría faltar `X-Company-Id` o `X-Site-Id`
- Aunque el apiClient debería agregarlos automáticamente

---

## 🔧 Pasos para Debuggear

### 1. Verificar los Logs
Buscar en los logs de la aplicación:
```
📦 Loading data for expense creation...
📦 Categories: ...
📦 Sites: ...
❌ Error loading data: ...
```

### 2. Verificar Requests en Network
Buscar en los logs:
```
API Request: { "url": "/expense-categories", ... }
API Request: { "url": "/sites", ... }
```

### 3. Verificar Responses
Buscar:
```
API Response: { "data": ..., "url": "/expense-categories" }
API Response: { "data": ..., "url": "/sites" }
```

O errores:
```
API Error: { "status": 404, "url": "/expense-categories" }
API Error: { "status": 500, "url": "/expense-categories" }
```

---

## 💡 Soluciones Posibles

### Solución 1: Verificar Endpoint del Backend

**Para Categorías:**
```bash
# Probar directamente
curl http://localhost:3000/expense-categories \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Company-Id: COMPANY_ID"
```

**Para Sedes:**
```bash
# Probar directamente
curl http://localhost:3000/sites?page=1&limit=100 \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Company-Id: COMPANY_ID"
```

### Solución 2: Agregar Logs Detallados

Modificar `loadData()` para ver exactamente qué está fallando:

```typescript
const loadData = async () => {
  try {
    console.log('📦 Loading data for expense creation...');
    const { sitesService } = await import('@/services/api');

    // Cargar uno por uno para ver cuál falla
    console.log('📦 Loading categories...');
    const categoriesRes = await expensesService.getCategories();
    console.log('✅ Categories loaded:', categoriesRes);

    console.log('📦 Loading templates...');
    const templatesRes = await expensesService.getTemplates();
    console.log('✅ Templates loaded:', templatesRes);

    console.log('📦 Loading sites...');
    const sitesRes = await sitesService.getSites({ page: 1, limit: 100 });
    console.log('✅ Sites loaded:', sitesRes);

    setCategories(categoriesRes.data || []);
    setTemplates(Array.isArray(templatesRes) ? templatesRes : []);
    setSites(sitesRes.data || []);
  } catch (error: any) {
    console.error('❌ Error loading data:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    Alert.alert('Error', 'No se pudieron cargar los datos necesarios');
  }
};
```

### Solución 3: Verificar Estructura de Respuesta

Si el backend devuelve una estructura diferente, ajustar:

```typescript
// Si el backend devuelve { categories: [...] }
setCategories(categoriesRes.categories || categoriesRes.data || []);

// Si el backend devuelve { sites: [...] }
setSites(sitesRes.sites || sitesRes.data || []);
```

### Solución 4: Manejar Errores Específicos

```typescript
const loadData = async () => {
  try {
    const { sitesService } = await import('@/services/api');

    // Intentar cargar categorías
    let categoriesData = [];
    try {
      const categoriesRes = await expensesService.getCategories();
      categoriesData = categoriesRes.data || [];
    } catch (catError) {
      console.error('❌ Error loading categories:', catError);
      // Continuar sin categorías
    }

    // Intentar cargar sedes
    let sitesData = [];
    try {
      const sitesRes = await sitesService.getSites({ page: 1, limit: 100 });
      sitesData = sitesRes.data || [];
    } catch (siteError) {
      console.error('❌ Error loading sites:', siteError);
      // Continuar sin sedes
    }

    setCategories(categoriesData);
    setSites(sitesData);
  } catch (error: any) {
    console.error('❌ Error loading data:', error);
  }
};
```

---

## 📋 Checklist de Verificación

- [ ] Revisar logs de la aplicación
- [ ] Buscar errores de API en los logs
- [ ] Verificar que el backend esté corriendo
- [ ] Probar endpoints directamente con curl/Postman
- [ ] Verificar estructura de respuesta del backend
- [ ] Verificar permisos del usuario
- [ ] Verificar headers de la request

---

## 🎯 Próximos Pasos

1. **Revisar los logs** de la aplicación cuando se abre el formulario
2. **Identificar** cuál de los tres servicios está fallando (categorías, templates, o sedes)
3. **Probar** el endpoint que falla directamente con curl
4. **Aplicar** la solución correspondiente

---

**Última Actualización:** 2025-02-27
**Estado:** Pendiente de debugging
