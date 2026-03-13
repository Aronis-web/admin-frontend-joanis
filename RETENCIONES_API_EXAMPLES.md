# 📡 Ejemplos de API - Retenciones Electrónicas

Este documento contiene ejemplos prácticos de cómo usar la API de retenciones electrónicas.

---

## 📋 Tabla de Contenidos

1. [Configuración Inicial](#configuración-inicial)
2. [Crear Tipo de Documento](#crear-tipo-de-documento)
3. [Crear Serie](#crear-serie)
4. [Emitir Retención](#emitir-retención)
5. [Consultar Retenciones](#consultar-retenciones)
6. [Descargar Archivos](#descargar-archivos)

---

## Configuración Inicial

### Obtener Token de Autenticación

```http
POST /auth/login
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "password": "tu-password"
}
```

**Respuesta:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "email": "usuario@empresa.com",
    "name": "Usuario"
  }
}
```

Usar el token en todas las peticiones:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Crear Tipo de Documento

### 1. Verificar si existe el tipo "Retención"

```http
GET /billing/document-types?code=20
Authorization: Bearer {token}
```

**Respuesta si existe:**
```json
[
  {
    "id": "doc-type-uuid",
    "code": "20",
    "name": "Retención",
    "description": "Comprobante de Retención Electrónica",
    "requiresRuc": true,
    "allowsDeduction": false,
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
]
```

### 2. Crear tipo de documento (si no existe)

```http
POST /billing/document-types
Content-Type: application/json
Authorization: Bearer {token}

{
  "code": "20",
  "name": "Retención",
  "description": "Comprobante de Retención Electrónica",
  "requiresRuc": true,
  "allowsDeduction": false,
  "isActive": true
}
```

**Respuesta:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "code": "20",
  "name": "Retención",
  "description": "Comprobante de Retención Electrónica",
  "requiresRuc": true,
  "allowsDeduction": false,
  "isActive": true,
  "createdAt": "2024-01-20T10:30:00Z",
  "updatedAt": "2024-01-20T10:30:00Z"
}
```

---

## Crear Serie

### 1. Obtener IDs necesarios

Necesitas:
- `companyId`: ID de tu empresa
- `siteId`: ID de la sede
- `documentTypeId`: ID del tipo de documento "Retención" (del paso anterior)
- `emissionPointId`: ID del punto de emisión

```http
GET /companies/current
Authorization: Bearer {token}
```

```http
GET /sites?companyId={companyId}
Authorization: Bearer {token}
```

```http
GET /emission-points?siteId={siteId}
Authorization: Bearer {token}
```

### 2. Crear la serie

```http
POST /billing/series
Content-Type: application/json
Authorization: Bearer {token}

{
  "companyId": "company-uuid",
  "siteId": "site-uuid",
  "documentTypeId": "550e8400-e29b-41d4-a716-446655440000",
  "emissionPointId": "emission-point-uuid",
  "series": "R001",
  "description": "Serie para Retenciones Electrónicas",
  "startNumber": 1,
  "maxNumber": 99999999,
  "isDefault": true,
  "isActive": true
}
```

**Respuesta:**
```json
{
  "id": "series-uuid",
  "siteId": "site-uuid",
  "documentTypeId": "550e8400-e29b-41d4-a716-446655440000",
  "series": "R001",
  "description": "Serie para Retenciones Electrónicas",
  "currentNumber": 0,
  "startNumber": 1,
  "maxNumber": 99999999,
  "isActive": true,
  "isDefault": true,
  "createdAt": "2024-01-20T11:00:00Z",
  "updatedAt": "2024-01-20T11:00:00Z",
  "documentType": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "20",
    "name": "Retención"
  }
}
```

---

## Emitir Retención

### Ejemplo Completo

```http
POST /bizlinks/retenciones
Content-Type: application/json
Authorization: Bearer {token}

{
  "serieNumero": "R001-00000001",
  "fechaEmision": "2024-01-20",
  "rucEmisor": "20478005017",
  "razonSocialEmisor": "MI EMPRESA SAC",
  "nombreComercialEmisor": "MI EMPRESA",
  "ubigeoEmisor": "150101",
  "direccionEmisor": "AV. PRINCIPAL 123",
  "provinciaEmisor": "LIMA",
  "departamentoEmisor": "LIMA",
  "distritoEmisor": "LIMA",
  "codigoPaisEmisor": "PE",
  "correoEmisor": "facturacion@miempresa.com",
  "correoAdquiriente": "proveedor@email.com",
  "proveedor": {
    "tipoDocumentoProveedor": "6",
    "numeroDocumentoProveedor": "20100359707",
    "razonSocialProveedor": "PROVEEDOR SAC",
    "nombreComercialProveedor": "PROVEEDOR",
    "ubigeoProveedor": "150122",
    "direccionProveedor": "CALLE LOS OLIVOS 456",
    "provinciaProveedor": "LIMA",
    "departamentoProveedor": "LIMA",
    "distritoProveedor": "MIRAFLORES",
    "codigoPaisProveedor": "PE"
  },
  "regimenRetencion": "01",
  "tasaRetencion": 3.00,
  "observaciones": "Retención del mes de enero 2024",
  "importeTotalRetenido": 35.40,
  "tipoMonedaTotalRetenido": "PEN",
  "importeTotalPagado": 1180.00,
  "tipoMonedaTotalPagado": "PEN",
  "items": [
    {
      "numeroOrdenItem": 1,
      "tipoDocumentoRelacionado": "01",
      "numeroDocumentoRelacionado": "F001-00000050",
      "fechaEmisionDocumentoRelacionado": "2024-01-15",
      "importeTotalDocumentoRelacionado": 1180.00,
      "tipoMonedaDocumentoRelacionado": "PEN",
      "fechaPago": "2024-01-20",
      "numeroPago": 1,
      "importePagoSinRetencion": 1180.00,
      "monedaPago": "PEN",
      "importeRetenido": 35.40,
      "monedaImporteRetenido": "PEN",
      "fechaRetencion": "2024-01-20",
      "importeTotalPagarNeto": 1144.60,
      "monedaMontoNetoPagado": "PEN"
    }
  ]
}
```

**Respuesta Exitosa:**
```json
{
  "id": "retencion-uuid",
  "companyId": "company-uuid",
  "siteId": "site-uuid",
  "rucEmisor": "20478005017",
  "documentType": "20",
  "serie": "R001",
  "numero": "00000001",
  "serieNumero": "R001-00000001",
  "status": "SENT",
  "statusWs": "SIGNED",
  "statusSunat": "AC_03",
  "messageSunat": {
    "codigo": "AC_03",
    "mensaje": "Aceptado por SUNAT"
  },
  "hashCode": "abc123def456...",
  "pdfUrl": "https://storage.bizlinks.pe/retenciones/R001-00000001.pdf",
  "xmlSignUrl": "https://storage.bizlinks.pe/retenciones/R001-00000001.xml",
  "xmlSunatUrl": "https://storage.bizlinks.pe/retenciones/R001-00000001-sunat.xml",
  "cdrUrl": "https://storage.bizlinks.pe/retenciones/R001-00000001-cdr.xml",
  "createdAt": "2024-01-20T12:00:00Z",
  "updatedAt": "2024-01-20T12:00:30Z"
}
```

### Ejemplo con Múltiples Documentos

```json
{
  "serieNumero": "R001-00000002",
  "fechaEmision": "2024-01-20",
  "rucEmisor": "20478005017",
  "razonSocialEmisor": "MI EMPRESA SAC",
  "nombreComercialEmisor": "MI EMPRESA",
  "ubigeoEmisor": "150101",
  "direccionEmisor": "AV. PRINCIPAL 123",
  "provinciaEmisor": "LIMA",
  "departamentoEmisor": "LIMA",
  "distritoEmisor": "LIMA",
  "codigoPaisEmisor": "PE",
  "correoEmisor": "facturacion@miempresa.com",
  "proveedor": {
    "tipoDocumentoProveedor": "6",
    "numeroDocumentoProveedor": "20100359707",
    "razonSocialProveedor": "PROVEEDOR SAC",
    "direccionProveedor": "CALLE LOS OLIVOS 456",
    "ubigeoProveedor": "150122",
    "provinciaProveedor": "LIMA",
    "departamentoProveedor": "LIMA",
    "distritoProveedor": "MIRAFLORES",
    "codigoPaisProveedor": "PE"
  },
  "regimenRetencion": "01",
  "tasaRetencion": 3.00,
  "observaciones": "Retención múltiple - Enero 2024",
  "importeTotalRetenido": 94.20,
  "tipoMonedaTotalRetenido": "PEN",
  "importeTotalPagado": 3140.00,
  "tipoMonedaTotalPagado": "PEN",
  "items": [
    {
      "numeroOrdenItem": 1,
      "tipoDocumentoRelacionado": "01",
      "numeroDocumentoRelacionado": "F001-00000050",
      "fechaEmisionDocumentoRelacionado": "2024-01-15",
      "importeTotalDocumentoRelacionado": 1180.00,
      "tipoMonedaDocumentoRelacionado": "PEN",
      "fechaPago": "2024-01-20",
      "numeroPago": 1,
      "importePagoSinRetencion": 1180.00,
      "monedaPago": "PEN",
      "importeRetenido": 35.40,
      "monedaImporteRetenido": "PEN",
      "fechaRetencion": "2024-01-20",
      "importeTotalPagarNeto": 1144.60,
      "monedaMontoNetoPagado": "PEN"
    },
    {
      "numeroOrdenItem": 2,
      "tipoDocumentoRelacionado": "01",
      "numeroDocumentoRelacionado": "F001-00000051",
      "fechaEmisionDocumentoRelacionado": "2024-01-16",
      "importeTotalDocumentoRelacionado": 1960.00,
      "tipoMonedaDocumentoRelacionado": "PEN",
      "fechaPago": "2024-01-20",
      "numeroPago": 1,
      "importePagoSinRetencion": 1960.00,
      "monedaPago": "PEN",
      "importeRetenido": 58.80,
      "monedaImporteRetenido": "PEN",
      "fechaRetencion": "2024-01-20",
      "importeTotalPagarNeto": 1901.20,
      "monedaMontoNetoPagado": "PEN"
    }
  ]
}
```

---

## Consultar Retenciones

### Listar todas las retenciones

```http
GET /bizlinks/retenciones
Authorization: Bearer {token}
```

### Filtrar por estado

```http
GET /bizlinks/retenciones?status=SENT
Authorization: Bearer {token}
```

### Filtrar por serie

```http
GET /bizlinks/retenciones?serie=R001
Authorization: Bearer {token}
```

### Filtrar por rango de fechas

```http
GET /bizlinks/retenciones?fechaDesde=2024-01-01&fechaHasta=2024-01-31
Authorization: Bearer {token}
```

### Filtrar por proveedor (RUC)

```http
GET /bizlinks/retenciones?rucProveedor=20100359707
Authorization: Bearer {token}
```

### Combinación de filtros

```http
GET /bizlinks/retenciones?status=SENT&serie=R001&fechaDesde=2024-01-01&fechaHasta=2024-01-31&page=1&limit=20
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "data": [
    {
      "id": "retencion-uuid",
      "serieNumero": "R001-00000001",
      "fechaEmision": "2024-01-20",
      "rucEmisor": "20478005017",
      "razonSocialEmisor": "MI EMPRESA SAC",
      "proveedor": {
        "numeroDocumentoProveedor": "20100359707",
        "razonSocialProveedor": "PROVEEDOR SAC"
      },
      "importeTotalRetenido": 35.40,
      "importeTotalPagado": 1180.00,
      "tipoMoneda": "PEN",
      "status": "SENT",
      "statusSunat": "AC_03",
      "createdAt": "2024-01-20T12:00:00Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

### Obtener retención por ID

```http
GET /bizlinks/retenciones/{retencionId}
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "id": "retencion-uuid",
  "companyId": "company-uuid",
  "siteId": "site-uuid",
  "serieNumero": "R001-00000001",
  "fechaEmision": "2024-01-20",
  "rucEmisor": "20478005017",
  "razonSocialEmisor": "MI EMPRESA SAC",
  "nombreComercialEmisor": "MI EMPRESA",
  "direccionEmisor": "AV. PRINCIPAL 123",
  "proveedor": {
    "tipoDocumentoProveedor": "6",
    "numeroDocumentoProveedor": "20100359707",
    "razonSocialProveedor": "PROVEEDOR SAC",
    "direccionProveedor": "CALLE LOS OLIVOS 456"
  },
  "regimenRetencion": "01",
  "tasaRetencion": 3.00,
  "importeTotalRetenido": 35.40,
  "importeTotalPagado": 1180.00,
  "tipoMoneda": "PEN",
  "items": [
    {
      "numeroOrdenItem": 1,
      "tipoDocumentoRelacionado": "01",
      "numeroDocumentoRelacionado": "F001-00000050",
      "fechaEmisionDocumentoRelacionado": "2024-01-15",
      "importeTotalDocumentoRelacionado": 1180.00,
      "importePagoSinRetencion": 1180.00,
      "importeRetenido": 35.40,
      "importeTotalPagarNeto": 1144.60
    }
  ],
  "status": "SENT",
  "statusWs": "SIGNED",
  "statusSunat": "AC_03",
  "messageSunat": {
    "codigo": "AC_03",
    "mensaje": "Aceptado por SUNAT"
  },
  "pdfUrl": "https://storage.bizlinks.pe/retenciones/R001-00000001.pdf",
  "xmlSignUrl": "https://storage.bizlinks.pe/retenciones/R001-00000001.xml",
  "cdrUrl": "https://storage.bizlinks.pe/retenciones/R001-00000001-cdr.xml",
  "createdAt": "2024-01-20T12:00:00Z",
  "updatedAt": "2024-01-20T12:00:30Z"
}
```

---

## Descargar Archivos

### Descargar PDF

```http
GET /bizlinks/retenciones/{retencionId}/pdf
Authorization: Bearer {token}
```

Retorna el archivo PDF directamente.

### Descargar XML

```http
GET /bizlinks/retenciones/{retencionId}/xml
Authorization: Bearer {token}
```

Retorna el archivo XML firmado.

### Descargar CDR (Constancia de Recepción)

```http
GET /bizlinks/retenciones/{retencionId}/cdr
Authorization: Bearer {token}
```

Retorna el archivo CDR de SUNAT.

---

## Actualizar Estado SUNAT

```http
POST /bizlinks/retenciones/{retencionId}/refresh-status
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "id": "retencion-uuid",
  "serieNumero": "R001-00000001",
  "status": "SENT",
  "statusWs": "SIGNED",
  "statusSunat": "AC_03",
  "messageSunat": {
    "codigo": "AC_03",
    "mensaje": "Aceptado por SUNAT"
  },
  "updatedAt": "2024-01-20T12:05:00Z"
}
```

---

## Códigos de Estado SUNAT

| Código | Descripción |
|--------|-------------|
| AC_03  | Aceptado por SUNAT |
| RC_05  | Rechazado por SUNAT |
| PE_02  | Pendiente de envío |
| PE_09  | Pendiente de respuesta |
| ED_06  | Error en el documento |

---

## Regímenes de Retención (Catálogo 23)

| Código | Descripción | Tasa |
|--------|-------------|------|
| 01     | Tasa 3%     | 3.00 |
| 02     | Tasa 6%     | 6.00 |
| 03     | Otros       | Variable |

---

## Tipos de Documento Relacionado (Catálogo 01)

| Código | Descripción |
|--------|-------------|
| 01     | Factura |
| 03     | Boleta de Venta |
| 07     | Nota de Crédito |
| 08     | Nota de Débito |

---

## Errores Comunes

### Error: Serie no encontrada

```json
{
  "statusCode": 404,
  "message": "Serie R001 no encontrada para el tipo de documento 20",
  "error": "Not Found"
}
```

**Solución**: Crear la serie usando el endpoint `POST /billing/series`

### Error: Tipo de documento no existe

```json
{
  "statusCode": 404,
  "message": "Tipo de documento con código 20 no encontrado",
  "error": "Not Found"
}
```

**Solución**: Crear el tipo de documento usando `POST /billing/document-types`

### Error: Totales no coinciden

```json
{
  "statusCode": 400,
  "message": "El total retenido no coincide con la suma de items",
  "error": "Bad Request"
}
```

**Solución**: Verificar que `importeTotalRetenido` sea igual a la suma de `importeRetenido` de todos los items.

### Error: RUC inválido

```json
{
  "statusCode": 400,
  "message": "RUC del proveedor inválido",
  "error": "Bad Request"
}
```

**Solución**: Verificar que el RUC tenga 11 dígitos y sea válido.

---

## Notas Importantes

1. **Cálculo de Retención**:
   - Retención = Importe Pago × (Tasa / 100)
   - Neto = Importe Pago - Retención

2. **Formato de Fechas**:
   - Usar formato ISO 8601: `YYYY-MM-DD`

3. **Monedas Soportadas**:
   - PEN (Soles)
   - USD (Dólares)

4. **Límites**:
   - Máximo 500 items por retención
   - Serie máxima: 10 caracteres
   - Número máximo: 99999999

5. **Timeout**:
   - El proceso de emisión puede tomar hasta 30 segundos
   - Implementar retry logic si es necesario

---

**Última actualización**: 2024-01-20
**Versión API**: 1.0.0
