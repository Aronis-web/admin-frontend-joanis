# 🔄 Implementación de Reversión de Retenciones - Frontend

## 📋 Resumen

Se ha implementado la funcionalidad completa para **anular (revertir) retenciones electrónicas** en el frontend de la aplicación. Esta funcionalidad permite a los usuarios anular retenciones que han sido aceptadas por SUNAT, generando automáticamente un documento de reversión.

## ✅ Archivos Modificados

### 1. **Tipos y DTOs** (`src/types/bizlinks.ts`)

#### Campos agregados a la interfaz `Retencion`:
```typescript
// Campos de reversión
isReversed?: boolean;
reversedByDocumentId?: string;
reversedBySerieNumero?: string;
reversedAt?: string;
reversedByUserId?: string;
reversalReason?: string;
```

#### Nuevo DTO creado:
```typescript
export interface RevertirRetencionDto {
  motivoReversion: string;
  serieReversion?: string;
}
```

### 2. **API Service** (`src/services/api/bizlinks.ts`)

#### Nuevo método agregado:
```typescript
// Revertir (anular) retención - PATCH /bizlinks/retenciones/:id/revertir
revertirRetencion: async (id: string, data: RevertirRetencionDto): Promise<Retencion> => {
  return apiClient.patch<Retencion>(`/bizlinks/retenciones/${id}/revertir`, data, {
    timeout: 60000, // 60 segundos para reversión
  });
}
```

### 3. **Pantalla de Detalle** (`src/screens/Retenciones/RetencionDetailScreen.tsx`)

#### Funcionalidades agregadas:

**a) Función de anulación:**
- Validación de estado (solo ACCEPTED)
- Validación de reversión previa
- Solicitud de motivo mediante Alert.prompt
- Llamada al API
- Recarga automática de datos

**b) UI actualizada:**
- Badge de estado muestra "ANULADA" en rojo si `isReversed = true`
- Banner de alerta con información de reversión:
  - Documento de reversión
  - Motivo
  - Fecha de anulación
- Botón "Anular Retención":
  - Solo visible para retenciones ACCEPTED no revertidas
  - Estilo rojo con icono de prohibición
  - Advertencia sobre irreversibilidad

**c) Estilos agregados:**
```typescript
reversedAlert: { /* Banner de alerta */ }
reversedAlertContent: { /* Contenido del banner */ }
reversedAlertTitle: { /* Título del banner */ }
reversedAlertText: { /* Texto del banner */ }
anularButton: { /* Botón de anular */ }
anularButtonText: { /* Texto del botón */ }
anularWarning: { /* Advertencia */ }
```

### 4. **Pantalla de Lista** (`src/screens/Retenciones/RetencionesScreen.tsx`)

#### Funcionalidades agregadas:

**a) Badge de estado actualizado:**
- Muestra "ANULADA" en rojo si `isReversed = true`
- Color de fondo cambia a #EF4444

**b) Banner informativo:**
- Se muestra debajo del header de cada tarjeta
- Incluye icono de advertencia
- Muestra el motivo de anulación

**c) Estilos agregados:**
```typescript
reversedBanner: { /* Banner en tarjeta */ }
reversedBannerText: { /* Texto del banner */ }
```

## 🎨 Flujo de Usuario

### 1. Ver Retenciones
```
Lista de Retenciones
├─ Retenciones normales: Badge verde "ACEPTADA"
└─ Retenciones anuladas: Badge rojo "ANULADA" + Banner con motivo
```

### 2. Anular una Retención
```
Detalle de Retención (ACCEPTED)
├─ Usuario presiona "Anular Retención"
├─ Sistema muestra diálogo de confirmación
├─ Usuario ingresa motivo (mínimo 5 caracteres)
├─ Sistema valida y envía solicitud al backend
├─ Backend genera documento de reversión
├─ Sistema actualiza la retención original
└─ Usuario ve la retención marcada como ANULADA
```

### 3. Ver Retención Anulada
```
Detalle de Retención (ANULADA)
├─ Badge rojo "ANULADA"
├─ Banner de alerta con:
│  ├─ Documento de reversión: RR01-00000001
│  ├─ Motivo: Error en el cálculo
│  └─ Fecha: 2024-01-25 10:30
└─ Botón "Anular" no visible
```

## 🔐 Validaciones Implementadas

### Frontend
1. ✅ Solo retenciones con estado ACCEPTED pueden anularse
2. ✅ No se pueden anular retenciones ya revertidas
3. ✅ Motivo obligatorio con mínimo 5 caracteres
4. ✅ Confirmación antes de proceder
5. ✅ Advertencia sobre irreversibilidad

### Backend (Requerido)
1. ⚠️ Validar estado de la retención
2. ⚠️ Validar que no esté revertida
3. ⚠️ Validar motivo
4. ⚠️ Generar documento de reversión (RC)
5. ⚠️ Actualizar retención original
6. ⚠️ Registrar auditoría

## 📡 Integración con Backend

### Endpoint Requerido
```
PATCH /bizlinks/retenciones/:id/revertir
```

### Request Body
```json
{
  "motivoReversion": "Error en el cálculo de la retención",
  "serieReversion": "RR01" // Opcional
}
```

### Response
```json
{
  "id": "uuid-retencion",
  "serieNumero": "R001-00000001",
  "status": "ACCEPTED",
  "isReversed": true,
  "reversedByDocumentId": "uuid-documento-reversion",
  "reversedBySerieNumero": "RR01-00000001",
  "reversedAt": "2024-01-25T10:30:00Z",
  "reversedByUserId": "uuid-usuario",
  "reversalReason": "Error en el cálculo de la retención",
  ...
}
```

## 🗄️ Campos de Base de Datos Requeridos

El backend debe tener estos campos en la tabla `bizlinks_documents`:

```sql
-- Campos de reversión
is_reversed BOOLEAN DEFAULT FALSE,
reversed_by_document_id UUID,
reversed_by_serie_numero VARCHAR(20),
reversed_at TIMESTAMPTZ,
reversed_by_user_id UUID,
reversal_reason TEXT,

-- Índices
CREATE INDEX idx_bizlinks_documents_is_reversed ON bizlinks_documents(is_reversed);
CREATE INDEX idx_bizlinks_documents_reversed_by_document_id ON bizlinks_documents(reversed_by_document_id);
```

## 🎯 Casos de Uso

### ✅ Casos Válidos
- Retención con estado ACCEPTED
- Retención no revertida previamente
- Usuario con permisos adecuados
- Motivo válido proporcionado

### ❌ Casos Inválidos
- Retención con estado diferente a ACCEPTED
- Retención ya revertida
- Motivo vacío o muy corto (< 5 caracteres)
- Usuario sin permisos

## 📝 Notas Importantes

### Configuración Previa Requerida

1. **Tipo de Documento RC**: Debe existir en el catálogo de tipos de documento del backend
   - **Código**: `RC`
   - **Nombre**: `Reversión de Retención`
   - **Descripción**: Documento de reversión de retenciones
   - **requires_ruc**: false
   - **allows_deduction**: false
   - **is_active**: true

   **SQL de ejemplo**:
   ```sql
   INSERT INTO document_types (code, name, description, requires_ruc, allows_deduction, is_active)
   VALUES ('RC', 'Reversión de Retención', 'Documento de reversión de retenciones', false, false, true);
   ```

2. **Serie RR01**: Se crea automáticamente desde la interfaz de usuario
   - **Ruta**: Configuración > Puntos de Emisión > [Punto] > Series > Nueva Serie
   - **Cómo funciona**:
     - La pantalla de creación de series carga automáticamente todos los tipos de documento activos del backend
     - Una vez que el backend tenga el tipo RC, aparecerá en la lista de opciones
     - El usuario solo debe seleccionarlo y crear la serie RR01

   - **Pasos para el usuario**:
     1. Ir a Puntos de Emisión
     2. Seleccionar el punto de emisión deseado
     3. Ir a "Series"
     4. Presionar "Nueva Serie"
     5. Seleccionar tipo de documento: **"Reversión de Retención (RC)"**
        - ⚠️ Si no aparece, el backend no ha creado el tipo de documento
     6. Ingresar serie: `RR01`
     7. Descripción: "Serie para Reversiones de Retenciones"
     8. Número inicial: 1
     9. Número máximo: 99999999
     10. Marcar como "Serie activa"
     11. Guardar

3. **Migración SQL**: Debe ejecutarse en el backend antes de usar esta funcionalidad
   - Agregar campos de reversión a la tabla `bizlinks_documents`
   - Ver documentación del backend para detalles

### Comportamiento

- **Irreversible**: Una vez anulada, no se puede deshacer
- **Una sola vez**: Cada retención solo puede anularse una vez
- **Documento nuevo**: Se genera un documento de reversión independiente
- **Trazabilidad**: Se mantiene registro completo de la operación

## 🧪 Testing

### Casos de Prueba Sugeridos

1. **Anular retención válida**
   - Estado: ACCEPTED
   - Resultado esperado: Retención marcada como anulada

2. **Intentar anular retención rechazada**
   - Estado: REJECTED
   - Resultado esperado: Error "Solo se pueden anular retenciones aceptadas"

3. **Intentar anular retención ya anulada**
   - Estado: ACCEPTED, isReversed: true
   - Resultado esperado: Error "Retención ya anulada"

4. **Motivo muy corto**
   - Motivo: "abc"
   - Resultado esperado: Error "El motivo debe tener al menos 5 caracteres"

5. **Cancelar anulación**
   - Usuario presiona "Cancelar" en el diálogo
   - Resultado esperado: No se realiza ninguna acción

## 📚 Documentación Relacionada

- `CHANGELOG_RETENCIONES.md` - Registro de cambios
- Guías visuales adjuntas (archivos .txt)
- Documentación del backend (cuando esté disponible)

## ✨ Próximos Pasos

1. ✅ **Frontend implementado** (COMPLETADO)
2. ⏳ **Backend**: Implementar endpoint de reversión
3. ⏳ **Backend**: Ejecutar migración SQL
4. ⏳ **Configuración**: Crear serie RR01
5. ⏳ **Testing**: Pruebas end-to-end
6. ⏳ **Despliegue**: A producción
7. ⏳ **Capacitación**: Usuarios finales

## 🎉 Estado Actual

**Frontend: ✅ COMPLETADO**
- Tipos actualizados
- API service implementado
- UI de detalle actualizada
- UI de lista actualizada
- Validaciones implementadas
- Sin errores de linter

**Pendiente:**
- Implementación del backend
- Configuración de series
- Testing integrado
- Despliegue

---

**Fecha de implementación**: 2024-01-XX
**Versión**: 1.1.0
**Desarrollador**: AI Assistant
