# 🚀 Guía Rápida - Reversión de Retenciones

## ✅ ¿Qué se implementó?

Se agregó la funcionalidad para **anular retenciones electrónicas** que han sido aceptadas por SUNAT.

## 📱 ¿Cómo se usa?

### 1️⃣ Ver Retenciones Anuladas
- Las retenciones anuladas se muestran con un **badge rojo "ANULADA"**
- Aparece un banner con el motivo de anulación

### 2️⃣ Anular una Retención
1. Abrir el detalle de una retención **ACEPTADA**
2. Presionar el botón **"Anular Retención"** (rojo, al final)
3. Confirmar la acción
4. Ingresar el **motivo** (mínimo 5 caracteres)
5. Confirmar nuevamente
6. ✅ La retención queda anulada

### 3️⃣ Ver Información de Anulación
En el detalle de una retención anulada verás:
- 🔴 Badge "ANULADA"
- 📄 Documento de reversión que la anuló
- 📝 Motivo de la anulación
- 📅 Fecha de anulación

## ⚙️ Configuración Inicial (Una sola vez)

### Paso 1: Backend debe crear tipo de documento RC
**⚠️ IMPORTANTE**: El administrador del backend debe crear el tipo de documento primero.

El backend debe ejecutar:
```sql
-- Crear tipo de documento RC en la tabla document_types
INSERT INTO document_types (code, name, description, requires_ruc, allows_deduction, is_active)
VALUES ('RC', 'Reversión de Retención', 'Documento de reversión de retenciones', false, false, true);
```

### Paso 2: Crear Serie RR01 desde la App
Una vez que el backend tenga el tipo de documento RC creado:

1. Ir a **Configuración** → **Puntos de Emisión**
2. Seleccionar un punto de emisión
3. Ir a **"Series"**
4. Presionar **"+ Nueva Serie"**
5. Llenar el formulario:
   - **Tipo de Documento**: Seleccionar **"Reversión de Retención (RC)"**
     - ⚠️ Si no aparece esta opción, el backend aún no ha creado el tipo de documento
   - **Serie**: `RR01`
   - **Descripción**: Serie para Reversiones de Retenciones
   - **Número Inicial**: 1
   - **Número Máximo**: 99999999
   - ✅ **Serie activa**: Activado
   - ⚠️ **Serie por defecto**: NO activar (opcional)
6. Presionar **"Crear Serie"**

### ✅ Verificación
Para verificar que todo está configurado:
1. Ir a la lista de series del punto de emisión
2. Debe aparecer la serie **RR01** con tipo **"Reversión de Retención"**
3. El estado debe ser **"Activa"**

## ⚠️ Restricciones

### ✅ Se puede anular:
- Retenciones con estado **ACCEPTED**
- Retenciones que **NO** han sido anuladas previamente

### ❌ NO se puede anular:
- Retenciones con estado REJECTED, ERROR, QUEUED, etc.
- Retenciones ya anuladas
- Sin proporcionar un motivo válido

## 🔐 Validaciones

- ✅ Solo retenciones aceptadas por SUNAT
- ✅ Motivo obligatorio (mínimo 5 caracteres)
- ✅ Confirmación del usuario
- ✅ Una sola anulación por retención
- ✅ Proceso irreversible

## 📊 Casos de Uso

### Cuándo anular una retención:
- ❌ Error en el cálculo
- ❌ Datos incorrectos del proveedor
- ❌ Documentos relacionados incorrectos
- ❌ Retención duplicada
- ❌ Cualquier error que requiera anular

## 🎯 Flujo Visual

```
┌─────────────────────────────────────┐
│  Retención R001-00000001            │
│  Estado: ACEPTADA ✅                │
│  [Anular Retención] 🔴              │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  ¿Anular retención?                 │
│  Ingrese motivo:                    │
│  [Error en el cálculo...]           │
│  [Cancelar] [Anular]                │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  ✅ Retención Anulada                │
│  Documento: RR01-00000001           │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Retención R001-00000001            │
│  Estado: ANULADA 🔴                 │
│  ⚠️ RETENCIÓN ANULADA               │
│  Revertida por: RR01-00000001       │
│  Motivo: Error en el cálculo        │
│  Fecha: 2024-01-25 10:30            │
└─────────────────────────────────────┘
```

## 📚 Documentación Completa

Para más detalles, consultar:
- `IMPLEMENTACION_REVERSION_RETENCIONES.md` - Documentación técnica
- `CHANGELOG_RETENCIONES.md` - Registro de cambios
- `RESUMEN_IMPLEMENTACION_REVERSION.md` - Resumen ejecutivo

## 🆘 Solución de Problemas

### "No se puede anular"
**Causa**: La retención no está aceptada por SUNAT
**Solución**: Solo se pueden anular retenciones con estado ACCEPTED

### "Retención ya anulada"
**Causa**: La retención ya fue anulada previamente
**Solución**: Cada retención solo puede anularse una vez

### "El motivo debe tener al menos 5 caracteres"
**Causa**: El motivo es muy corto
**Solución**: Ingresar un motivo descriptivo de al menos 5 caracteres

### "No hay series configuradas"
**Causa**: No existe la serie RR01
**Solución**: Crear la serie RR01 siguiendo los pasos de configuración

## 📞 Soporte

Si tienes problemas:
1. Verificar que la serie RR01 esté creada
2. Verificar que el backend tenga el endpoint implementado
3. Revisar los logs del backend
4. Contactar al administrador del sistema

---

**Versión**: 1.1.0
**Fecha**: 2024-01-XX
**Estado**: ✅ Listo para usar (requiere configuración inicial)
