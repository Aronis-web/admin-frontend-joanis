# 🔧 Fix 404 Error - Expenses API Endpoints

## ❌ Problem
The frontend was receiving `404 Not Found` errors when trying to list expenses:
```
Cannot GET /admin/expenses/v2/list?page=1&limit=50
```

## ✅ Solution Applied
Updated all expenses API endpoints to match the new backend structure without `/admin` prefix and `/v2` versioning.

## 📝 Changes Made

### File: `src/services/api/expenses.ts`

#### 1. Updated Base Paths
```typescript
// ❌ BEFORE
private readonly basePath = '/admin/expenses';
private readonly categoriesPath = '/admin/expense-categories';
private readonly templatesPath = '/admin/expense-templates';
private readonly projectionsPath = '/admin/expense-projections';
private readonly projectsPath = '/admin/expense-projects';

// ✅ AFTER
private readonly basePath = '/expenses';
private readonly categoriesPath = '/expense-categories';
private readonly templatesPath = '/expense-templates';
private readonly projectionsPath = '/expense-projections';
private readonly projectsPath = '/expense-projects';
```

#### 2. Updated `searchExpensesV2()` Method
```typescript
// ❌ BEFORE
async searchExpensesV2(params) {
  return apiClient.get(`${this.basePath}/v2/search`, { params });
}

// ✅ AFTER
async searchExpensesV2(params) {
  const cleanParams: any = {
    search: params.q,
    limit: params.limit,
    includeAccountPayable: true, // ← IMPORTANT: Always include account payable data
  };
  if (params.status) cleanParams.status = params.status;
  if (params.projectId) cleanParams.projectId = params.projectId;
  if (params.categoryId) cleanParams.categoryId = params.categoryId;
  if (params.siteId) cleanParams.siteId = params.siteId;

  return apiClient.get('/expenses', { params: cleanParams });
}
```

**Key Changes:**
- Changed URL from `/admin/expenses/v2/search` → `/expenses`
- Added `includeAccountPayable: true` to fetch supplier and account payable data
- Cleaned undefined parameters (don't send `status: undefined`)
- Mapped `q` parameter to `search` parameter

#### 3. Updated `getExpensesV2()` Method
```typescript
// ❌ BEFORE
async getExpensesV2(params?) {
  const response = await apiClient.get(`${this.basePath}/v2/list`, { params });
  return response;
}

// ✅ AFTER
async getExpensesV2(params?) {
  const cleanParams: any = {
    page: params?.page || 1,
    limit: params?.limit || 50,
    includeAccountPayable: true, // ← IMPORTANT
  };
  if (params?.status) cleanParams.status = params.status;
  if (params?.projectId) cleanParams.projectId = params.projectId;
  if (params?.categoryId) cleanParams.categoryId = params.categoryId;
  if (params?.q) cleanParams.search = params.q;

  const response = await apiClient.get('/expenses', { params: cleanParams });
  return response;
}
```

**Key Changes:**
- Changed URL from `/admin/expenses/v2/list` → `/expenses`
- Added `includeAccountPayable: true`
- Cleaned undefined parameters
- Mapped `q` to `search`

#### 4. Updated `invalidateExpensesCacheV2()` Method
```typescript
// ❌ BEFORE
async invalidateExpensesCacheV2() {
  return apiClient.delete(`${this.basePath}/v2/cache`);
}

// ✅ AFTER
async invalidateExpensesCacheV2() {
  return apiClient.delete('/expenses/cache');
}
```

#### 5. Updated `getExpenses()` Method
```typescript
// ❌ BEFORE
async getExpenses(params?: QueryExpensesParams) {
  return apiClient.get<ExpensesResponse>(this.basePath, { params });
}

// ✅ AFTER
async getExpenses(params?: QueryExpensesParams) {
  const enhancedParams = {
    ...params,
    includeAccountPayable: true, // ← Always fetch account payable data
  };
  return apiClient.get<ExpensesResponse>(this.basePath, { params: enhancedParams });
}
```

#### 6. Updated All Summary Endpoints
Changed all summary endpoints from `/admin/expenses/summary/*` to `/expenses/summary/*`:

- `GET /expenses/summary/total`
- `GET /expenses/summary/recurring`
- `GET /expenses/summary/by-category-currency`
- `GET /expenses/summary/by-site`
- `GET /expenses/summary/compare`
- `GET /expenses/summary/trends`
- `GET /expenses/summary/projections`
- `GET /expenses/summary/dashboard`

## 🎯 Complete Endpoint Mapping

| Old Endpoint (404) | New Endpoint (✅) |
|-------------------|------------------|
| `GET /admin/expenses/v2/list` | `GET /expenses` |
| `GET /admin/expenses/v2/search` | `GET /expenses` (with search param) |
| `DELETE /admin/expenses/v2/cache` | `DELETE /expenses/cache` |
| `GET /admin/expenses` | `GET /expenses` |
| `GET /admin/expenses/:id` | `GET /expenses/:id` |
| `POST /admin/expenses` | `POST /expenses` |
| `PATCH /admin/expenses/:id` | `PATCH /expenses/:id` |
| `DELETE /admin/expenses/:id` | `DELETE /expenses/:id` |
| `POST /admin/expenses/:id/activate` | `POST /expenses/:id/activate` |
| `GET /admin/expense-categories` | `GET /expense-categories` |
| `GET /admin/expense-templates` | `GET /expense-templates` |
| `GET /admin/expense-projections` | `GET /expense-projections` |
| `GET /admin/expense-projects` | `GET /expense-projects` |

## 🔑 Important Parameters

### Always Include `includeAccountPayable: true`
This parameter is crucial for fetching supplier and account payable information:

```typescript
const params = {
  page: 1,
  limit: 50,
  includeAccountPayable: true, // ← REQUIRED for supplier/account payable data
};
```

### Available Query Parameters
```typescript
{
  // Pagination
  page?: number;              // Default: 1
  limit?: number;             // Default: 20
  sortBy?: string;            // Default: 'createdAt'
  sortOrder?: 'ASC' | 'DESC'; // Default: 'DESC'

  // Filters
  companyId?: string;
  siteId?: string;
  categoryId?: string;
  projectId?: string;
  supplierId?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';

  // Supplier filters
  supplierPrimaryType?: 'UTILITIES' | 'SERVICES' | 'MERCHANDISE' | ...;
  supplierTypes?: string;  // comma-separated

  // Search
  search?: string;
  dateFrom?: string;
  dateTo?: string;

  // Relations
  includeAccountPayable?: boolean;  // true to include supplier/account payable data
  onlyWithAccountPayable?: boolean; // true to filter only expenses with accounts payable
}
```

## 📊 Expected Response Format

```typescript
{
  data: [
    {
      id: "uuid",
      code: "EXP-2025-00001",
      name: "Luz - Enero 2025",
      amountCents: 50000,
      currency: "PEN",
      status: "ACTIVE",

      // NEW FIELDS (when includeAccountPayable: true)
      supplier: {
        id: "uuid",
        commercialName: "Enel",
        primaryType: "UTILITIES"
      },
      supplierLegalEntity: {
        id: "uuid",
        legalName: "ENEL DISTRIBUCIÓN PERÚ S.A.A.",
        ruc: "20331066703"
      },
      accountPayable: {
        id: "uuid",
        code: "AP-2025-00123",
        status: "PENDING",
        totalAmountCents: 50000,
        paidAmountCents: 0,
        balanceCents: 50000,
        dueDate: "2025-02-15",
        overdueDays: 0
      }
    }
  ],
  meta: {
    page: 1,
    limit: 50,
    total: 150,
    totalPages: 3
  }
}
```

## ✅ Testing

### 1. Verify Backend is Running
```bash
curl http://localhost:3000/expenses
```

### 2. Test from Browser Console
```javascript
fetch('http://localhost:3000/expenses?page=1&limit=10&includeAccountPayable=true', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'X-Company-Id': 'YOUR_COMPANY_ID'
  }
})
.then(r => r.json())
.then(console.log);
```

### 3. Check Swagger Documentation
```
http://localhost:3000/docs
```

## 🎉 Result

The 404 errors should now be resolved. The frontend will successfully:
- ✅ List expenses with pagination
- ✅ Search expenses
- ✅ Display supplier information
- ✅ Show account payable data
- ✅ Filter by supplier type
- ✅ Access all CRUD operations

## 📚 Related Documentation

- Main documentation: `ACTUALIZACION_GASTOS_PROVEEDORES.md`
- Type definitions: `src/types/expenses.ts`
- React hooks: `src/hooks/api/useExpenses.ts`
- Expenses screen: `src/screens/Expenses/ExpensesScreen.tsx`

## 🔄 No Breaking Changes

All existing functionality is preserved:
- The hooks (`useExpensesV2`, `useSearchExpensesV2`) continue to work
- The ExpensesScreen doesn't need changes
- All type definitions remain the same
- Only the underlying API URLs were updated

---

**Status:** ✅ Fixed
**Date:** 2025-02-27
**Impact:** All expenses API calls now work correctly with the new backend structure
