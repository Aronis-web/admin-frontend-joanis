# 🔧 Fix - Mejor Manejo de Errores para Categorías y Sedes

**Fecha:** 2025-02-27
**Problema:** Las categorías y sedes no se cargan en el formulario de gastos
**Solución:** Mejorado el manejo de errores para identificar qué está fallando

---

## ❌ Problema

Al abrir el formulario de crear/editar gastos, las categorías y sedes no se cargan en los selectores.

**Síntomas:**
- Selector de "Categoría" vacío o no aparece
- Selector de "Sede" vacío o no aparece
- Posible error en consola al cargar datos

---

## ✅ Solución Aplicada

### Cambio en `src/screens/Expenses/CreateExpenseScreen.tsx`

**Antes:**
```typescript
const loadData = async () => {
  try {
    const [categoriesRes, templatesRes, sitesRes] = await Promise.all([
      expensesService.getCategories(),
      expensesService.getTemplates(),
      sitesService.getSites({ page: 1, limit: 100 }),
    ]);

    setCategories(categoriesRes.data || []);
    setTemplates(Array.isArray(templatesRes) ? templatesRes : []);
    setSites(sitesRes.data || []);
  } catch (error: any) {
    console.error('❌ Error loading data:', error);
    Alert.alert('Error', 'No se pudieron cargar los datos necesarios');
  }
};
```

**Problema con el código anterior:**
- Si **cualquiera** de las 3 llamadas falla, **todas** fallan
- No se puede identificar cuál está fallando
- El usuario no ve ningún dato, ni siquiera los que sí funcionan

**Después:**
```typescript
const loadData = async () => {
  try {
    console.log('📦 Loading data for expense creation...');
    const { sitesService } = await import('@/services/api');

    // Load data one by one to identify which one fails
    let categoriesData = [];
    let templatesData = [];
    let sitesData = [];

    // Load categories
    try {
      console.log('📦 Loading categories...');
      const categoriesRes = await expensesService.getCategories();
      console.log('✅ Categories loaded:', categoriesRes);
      categoriesData = categoriesRes.data || [];
      console.log('📦 Categories count:', categoriesData.length);
    } catch (catError: any) {
      console.error('❌ Error loading categories:', catError);
      console.error('❌ Categories error details:', {
        message: catError.message,
        status: catError.response?.status,
        data: catError.response?.data,
      });
      // Continue without categories
    }

    // Load templates
    try {
      console.log('📦 Loading templates...');
      const templatesRes = await expensesService.getTemplates();
      console.log('✅ Templates loaded:', templatesRes);
      templatesData = Array.isArray(templatesRes) ? templatesRes : [];
      console.log('📦 Templates count:', templatesData.length);
    } catch (tmpError: any) {
      console.error('❌ Error loading templates:', tmpError);
      console.error('❌ Templates error details:', {
        message: tmpError.message,
        status: tmpError.response?.status,
        data: tmpError.response?.data,
      });
      // Continue without templates
    }

    // Load sites
    try {
      console.log('📦 Loading sites...');
      const sitesRes = await sitesService.getSites({ page: 1, limit: 100 });
      console.log('✅ Sites loaded:', sitesRes);
      sitesData = sitesRes.data || [];
      console.log('📦 Sites count:', sitesData.length);
    } catch (siteError: any) {
      console.error('❌ Error loading sites:', siteError);
      console.error('❌ Sites error details:', {
        message: siteError.message,
        status: siteError.response?.status,
        data: siteError.response?.data,
      });
      // Continue without sites
    }

    setCategories(categoriesData);
    setTemplates(templatesData);
    setSites(sitesData);

    console.log('✅ Data loading completed');
  } catch (error: any) {
    console.error('❌ Error loading data:', error);

    if (handlePermissionError(error)) {
      showPermissionAlert(error);
      return;
    }

    Alert.alert('Error', 'No se pudieron cargar los datos necesarios');
  }
};
```

**Beneficios del nuevo código:**
- ✅ Carga cada recurso independientemente
- ✅ Si uno falla, los otros siguen cargando
- ✅ Logs detallados para identificar el problema
- ✅ Muestra información de error específica (status, mensaje, data)
- ✅ El usuario puede usar el formulario aunque algún recurso falle

---

## 🔍 Cómo Debuggear Ahora

### 1. Abrir el Formulario de Gastos
Navegar a "Crear Gasto" o "Editar Gasto"

### 2. Revisar los Logs
Buscar en la consola:

**Si todo funciona:**
```
📦 Loading data for expense creation...
📦 Loading categories...
✅ Categories loaded: { data: [...] }
📦 Categories count: 5
📦 Loading templates...
✅ Templates loaded: [...]
📦 Templates count: 3
📦 Loading sites...
✅ Sites loaded: { data: [...] }
📦 Sites count: 2
✅ Data loading completed
```

**Si algo falla:**
```
📦 Loading data for expense creation...
📦 Loading categories...
❌ Error loading categories: [Error object]
❌ Categories error details: {
  message: "Cannot read properties of undefined (reading 'databaseName')",
  status: 500,
  data: { ... }
}
📦 Loading templates...
✅ Templates loaded: [...]
📦 Templates count: 3
📦 Loading sites...
✅ Sites loaded: { data: [...] }
📦 Sites count: 2
✅ Data loading completed
```

### 3. Identificar el Problema

**Si categorías falla:**
- Revisar endpoint `/expense-categories`
- Verificar que el backend esté funcionando
- Verificar permisos del usuario

**Si sedes falla:**
- Revisar endpoint `/sites`
- Verificar que el backend esté funcionando
- Verificar permisos del usuario

**Si templates falla:**
- Revisar endpoint `/expense-templates`
- Verificar que el backend esté funcionando

---

## 📊 Endpoints Utilizados

| Recurso | Endpoint | Método |
|---------|----------|--------|
| Categorías | `/expense-categories` | GET |
| Templates | `/expense-templates` | GET |
| Sedes | `/sites?page=1&limit=100` | GET |

---

## 🎯 Próximos Pasos

### 1. Probar el Formulario
- Abrir el formulario de crear gasto
- Revisar los logs en la consola
- Identificar qué recurso está fallando (si alguno)

### 2. Si Categorías Falla
```bash
# Probar el endpoint directamente
curl http://localhost:3000/expense-categories \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Company-Id: COMPANY_ID"
```

### 3. Si Sedes Falla
```bash
# Probar el endpoint directamente
curl http://localhost:3000/sites?page=1&limit=100 \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Company-Id: COMPANY_ID"
```

### 4. Si Templates Falla
```bash
# Probar el endpoint directamente
curl http://localhost:3000/expense-templates \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Company-Id: COMPANY_ID"
```

---

## 💡 Posibles Problemas y Soluciones

### Problema 1: Error 500 en Categorías
**Causa:** Similar al error de gastos, el backend podría tener un bug
**Solución:** Revisar el backend y corregir el error

### Problema 2: Error 404 en Categorías
**Causa:** El endpoint podría ser diferente
**Solución:** Verificar la ruta correcta en el backend

### Problema 3: Permisos Insuficientes
**Causa:** El usuario no tiene permisos para ver categorías/sedes
**Solución:** Asignar los permisos necesarios al usuario

### Problema 4: Sin Datos
**Causa:** No hay categorías/sedes creadas en el sistema
**Solución:** Crear al menos una categoría y una sede

---

## ✅ Verificación

- [x] Código actualizado con mejor manejo de errores
- [x] Logs detallados agregados
- [x] Carga independiente de cada recurso
- [x] Sin errores de TypeScript (solo falsos positivos)
- [ ] Testing en desarrollo (pendiente)
- [ ] Identificar qué recurso está fallando (pendiente)
- [ ] Corregir el problema identificado (pendiente)

---

## 📚 Archivos Modificados

1. `src/screens/Expenses/CreateExpenseScreen.tsx` - Función `loadData()` mejorada

---

## 🎉 Resultado Esperado

Después de este cambio:
- ✅ Podrás ver en los logs exactamente qué está fallando
- ✅ Si solo categorías falla, aún podrás seleccionar sedes
- ✅ Si solo sedes falla, aún podrás seleccionar categorías
- ✅ Mejor experiencia de usuario
- ✅ Más fácil de debuggear

---

**Última Actualización:** 2025-02-27
**Estado:** ✅ Implementado - Pendiente de testing
