# 📄 Módulo Bizlinks - Facturación Electrónica

Sistema de integración con el Componente Local Bizlinks para emisión de comprobantes electrónicos según normativa SUNAT (Perú).

## 🎯 Características

✅ Integración completa con Componente Local Bizlinks (WEB SERVICE REST)
✅ Emisión de documentos tributarios electrónicos
✅ Gestión de series y correlativos (integrado con módulo Billing)
✅ Consulta de estados SUNAT en tiempo real
✅ Descarga automática de PDF, XML firmado y CDR
✅ Logs completos de comunicación
✅ Validaciones según catálogos SUNAT
✅ Soporte para contingencia
✅ Multi-empresa y multi-sede

## 📋 Tipos de Documentos Soportados

| Código | Tipo de Documento | Estado |
|--------|-------------------|--------|
| 01 | Factura Electrónica | ✅ Implementado |
| 03 | Boleta de Venta Electrónica | 🚧 Pendiente |
| 07 | Nota de Crédito Electrónica | 🚧 Pendiente |
| 08 | Nota de Débito Electrónica | 🚧 Pendiente |
| 09 | Guía de Remisión Remitente | 🚧 Pendiente |
| 31 | Guía de Remisión Transportista | 🚧 Pendiente |
| 20 | Retención | 🚧 Pendiente |
| 40 | Percepción | 🚧 Pendiente |
| RC | Resumen de Comprobantes | 🚧 Pendiente |
| RA | Resumen de Anulación (Bajas) | 🚧 Pendiente |
| RR | Resumen de Reversión | 🚧 Pendiente |

## 🗂️ Estructura del Módulo

```
src/
├── types/
│   └── bizlinks.ts                    # Tipos, interfaces y enums
├── services/api/
│   └── bizlinks.ts                    # API client
├── hooks/
│   └── useBizlinks.ts                 # Custom hooks
├── utils/
│   └── bizlinksHelpers.ts             # Helpers y utilidades
├── components/Bizlinks/
│   ├── BizlinksConfigForm.tsx         # Formulario de configuración
│   ├── BizlinksDocumentCard.tsx       # Card de documento
│   ├── EmitirFacturaForm.tsx          # Formulario de emisión
│   └── index.ts
└── screens/Bizlinks/
    ├── BizlinksMenuScreen.tsx         # Menú principal
    ├── BizlinksConfigScreen.tsx       # Lista de configuraciones
    ├── BizlinksDocumentsScreen.tsx    # Lista de documentos
    └── index.ts
```

## 🔗 Integración con Módulo Billing

El módulo Bizlinks está integrado con el módulo Billing para gestión de correlativos:

```typescript
// 1. Generar correlativo (Billing)
const correlative = await billingService.generateCorrelative(userId, {
  seriesId: 'uuid-serie-F001',
  referenceId: 'uuid-venta',
  referenceType: 'SALE'
});
// Resultado: F001-00000001

// 2. Emitir factura (Bizlinks)
const bizlinksDoc = await bizlinksService.emitirFactura({
  correlativeId: correlative.id,  // Vinculación
  serieNumero: correlative.documentNumber,
  // ... resto de datos
}, userId, companyId, siteId);

// 3. El correlativo queda vinculado al documento Bizlinks
correlative.bizlinksDocumentId = bizlinksDoc.id;
```

## 🚀 Endpoints API

### Documentos
- `POST /bizlinks/documents/factura` - Emitir factura
- `GET /bizlinks/documents` - Listar documentos
- `GET /bizlinks/documents/:id` - Obtener documento
- `POST /bizlinks/documents/:id/refresh` - Actualizar estado
- `POST /bizlinks/documents/:id/download-artifacts` - Descargar PDF/XML

### Configuración
- `GET /bizlinks/config` - Obtener configuración
- `GET /bizlinks/config/company/:companyId` - Configs de empresa
- `POST /bizlinks/config` - Crear configuración
- `PUT /bizlinks/config/:id` - Actualizar configuración
- `DELETE /bizlinks/config/:id` - Eliminar configuración
- `GET /bizlinks/config/:id/test` - Probar conexión

## 📝 Ejemplo de Uso

### 1. Configurar Bizlinks

```typescript
import { bizlinksApi } from './services/api';

const config = await bizlinksApi.createConfig({
  companyId: "uuid-empresa",
  siteId: null,  // null = config global
  baseUrl: "http://localhost:8080",
  contextPath: "/einvoice/rest",
  ruc: "20478005017",
  razonSocial: "MI EMPRESA SAC",
  domicilioFiscal: "Av. Principal 123",
  ubigeo: "150101",
  departamento: "LIMA",
  provincia: "LIMA",
  distrito: "LIMA",
  email: "facturacion@miempresa.com",
  autoSend: true,
  autoDownloadPdf: true,
  autoDownloadXml: true,
  isActive: true,
  isProduction: false
});
```

### 2. Emitir Factura

```typescript
import { bizlinksApi } from './services/api';
import { BizlinksCurrency, BizlinksUnitMeasure, BizlinksTaxType } from './types/bizlinks';

const factura = await bizlinksApi.emitirFactura({
  correlativeId: "uuid-correlativo",
  serieNumero: "F001-00000001",
  fechaEmision: "2024-01-15",
  horaEmision: "10:30:00",

  emisor: {
    rucEmisor: "20478005017",
    razonSocialEmisor: "MI EMPRESA SAC",
    ubigeoEmisor: "150101",
    direccionEmisor: "Av. Principal 123",
    provinciaEmisor: "LIMA",
    departamentoEmisor: "LIMA",
    distritoEmisor: "LIMA",
    codigoPaisEmisor: "PE",
    correoEmisor: "facturacion@miempresa.com"
  },

  adquiriente: {
    tipoDocumentoAdquiriente: "6",
    numeroDocumentoAdquiriente: "20123456789",
    razonSocialAdquiriente: "CLIENTE SAC",
    correoAdquiriente: "cliente@email.com"
  },

  items: [
    {
      numeroOrdenItem: 1,
      cantidad: 10,
      unidadMedida: BizlinksUnitMeasure.NIU,
      descripcion: "Producto A",
      valorUnitario: 100.00,
      precioVentaUnitario: 118.00,
      codigoAfectacionIgv: BizlinksTaxType.IGV,
      porcentajeIgv: 18,
      montoIgvItem: 180.00,
      valorVentaItem: 1000.00
    }
  ],

  totales: {
    totalValorVenta: 1000.00,
    totalPrecioVenta: 1180.00,
    totalIgv: 180.00,
    totalVenta: 1180.00,
    tipoMoneda: BizlinksCurrency.PEN,
    totalOperacionesGravadas: 1000.00
  }
});
```

### 3. Consultar Estado

```typescript
const updated = await bizlinksApi.refreshDocumentStatus(factura.id);

console.log(updated.statusSunat); // "ACEPTADO"
console.log(updated.messageSunat);
// { codigo: "0", mensaje: "La Factura numero F001-00000001, ha sido aceptada" }
```

## 📊 Estados de Documentos

### Estados del WS (statusWs)
- `NULL` - Error en el registro
- `SIGNED` - Firmado (estado inicial)
- `SIGNED/PE_02` - Firmado, emitido y aceptado
- `SIGNED/PE_09` - Firmado y pendiente de envío (Boletas)
- `SIGNED/ED_06` - Firmado y enviado a declarar (Resúmenes)
- `SIGNED/AC_03` - Firmado, emitido y aceptado por SUNAT
- `SIGNED/RC_05` - Firmado, emitido y rechazado por SUNAT

### Estados SUNAT (statusSunat)
- `PENDIENTE_ENVIO` - Esperando declaración
- `PENDIENTE_RESPUESTA` - Esperando respuesta SUNAT
- `ACEPTADO` - Aceptado por SUNAT
- `RECHAZADO` - Rechazado por SUNAT
- `ANULADO` - Anulado

## 🔧 Configuración del Componente Local

El Componente Local Bizlinks debe estar instalado y corriendo:

```bash
# Ejemplo de URL del componente local
http://localhost:8080/einvoice/rest

# Verificar que esté corriendo
curl http://localhost:8080/einvoice/rest
```

## 🎨 Componentes UI

### BizlinksConfigForm
Formulario para crear/editar configuraciones de Bizlinks.

```tsx
import { BizlinksConfigForm } from './components/Bizlinks';

<BizlinksConfigForm
  companyId={companyId}
  siteId={siteId}
  onSuccess={(config) => console.log('Config creada:', config)}
  onCancel={() => navigation.goBack()}
/>
```

### BizlinksDocumentCard
Card para mostrar documentos electrónicos.

```tsx
import { BizlinksDocumentCard } from './components/Bizlinks';

<BizlinksDocumentCard
  document={document}
  onPress={(doc) => navigation.navigate('Detail', { id: doc.id })}
  onRefresh={(doc) => handleRefresh(doc)}
  onDownload={(doc) => handleDownload(doc)}
/>
```

### EmitirFacturaForm
Formulario completo para emitir facturas.

```tsx
import { EmitirFacturaForm } from './components/Bizlinks';

<EmitirFacturaForm
  companyId={companyId}
  siteId={siteId}
  onSuccess={(documentId) => navigation.navigate('Detail', { documentId })}
  onCancel={() => navigation.goBack()}
/>
```

## 🔐 Permisos

```typescript
PERMISSIONS.BIZLINKS = {
  READ: 'bizlinks.read',
  ADMIN: 'bizlinks.admin',

  CONFIG: {
    READ: 'bizlinks.config.read',
    CREATE: 'bizlinks.config.create',
    UPDATE: 'bizlinks.config.update',
    DELETE: 'bizlinks.config.delete',
    TEST: 'bizlinks.config.test',
  },

  DOCUMENTS: {
    READ: 'bizlinks.documents.read',
    EMIT: 'bizlinks.documents.emit',
    REFRESH: 'bizlinks.documents.refresh',
    DOWNLOAD: 'bizlinks.documents.download',
    SEND: 'bizlinks.documents.send',
    VOID: 'bizlinks.documents.void',
  },

  LOGS: {
    READ: 'bizlinks.logs.read',
  },
};
```

## 📋 Próximos Pasos

- ✅ Implementar emisión de Facturas
- 🚧 Implementar emisión de Boletas
- 🚧 Implementar Notas de Crédito/Débito
- 🚧 Implementar Guías de Remisión
- 🚧 Implementar Retenciones/Percepciones
- 🚧 Implementar Resúmenes
- 🚧 Builder completo de XML según anexos
- 🚧 Validaciones completas de reglas de negocio
- 🚧 Sistema de reintentos automáticos
- 🚧 Dashboard de estadísticas

## 📚 Documentación de Referencia

- Documento de Integración Técnico Funcional - WEB SERVICE REST (Bizlinks)
- Anexos de estructura XML por tipo de documento
- Catálogos SUNAT

---

**Versión:** 1.0
**Última actualización:** Enero 2024
