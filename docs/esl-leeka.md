# ESL Leeka — Protocolo BLE y formato de bitmap

Documentación del protocolo BLE para las etiquetas electrónicas **Leeka Electronic
Technology (Shenzhen)**, modelo `TAG-154BWRY` (línea LTag-154BWRY, 1.54" e-paper
4 colores BWRY). Reverseado a partir del bundle JS oficial de
`https://leekatagg.com/mqtt/` (módulo `Connect BLE`, que usa Web Bluetooth
client-side) y validado contra hardware real.

## 1. Identificación del dispositivo

| Campo | Valor |
| --- | --- |
| Fabricante | Leeka Electronic Technology (Shenzhen) Co., Ltd. |
| Sitio comercial | `https://www.lleeka.com` |
| Plataforma SaaS | `https://leekatagg.com/mqtt/` (Vue SPA) |
| Modelo | `TAG-154BWRY` (1.54", 200×200 px, 4 colores BWRY) |
| Firma firmware | ASCII `KNLT` en descriptor `0x04` |
| Prefijo nombre BLE | `LK<serial8>` (ej. `LK16637985`) |
| MAC | Aleatoria estática `XX:02:00:00:00:00` |
| Modo radio | BLE 4.x, GATT, MTU típico 250 |

### Modelos soportados (mapa `deviceTypeNum`)

| Modelo | num | Modelo | num |
| --- | --- | --- | --- |
| `1.54_BWR` | 1 | `2.90_BWRY` | 8 |
| `1.54_BWRY` | **2** | `3.50_BWR` | 9 |
| `2.13_BWR` | 3 | `3.50_BWRY` | 10 |
| `2.13_BWRY` | 4 | `4.20_BWR` | 11 |
| `2.66_BWR` | 5 | `5.83_BWR` | 12 |
| `2.66_BWRY` | 6 | `7.50_BWR` | 13 |
| `2.90_BWR` | 7 | `10.20_BWR` | 14 |
| `4.20_BWRY` | 15 | `7.50_BWRY` | 16 |

## 2. Servicio GATT

```
Service UUID:  13187b10-eba9-a3ba-044e-83d3217d9a38   (custom 128-bit)
Char    UUID:  4b646063-6264-f3a7-8941-e65356ea82fe   (write + notify)
```

Hay otros servicios estándar (Device Info, Battery Service, Environmental
Sensing) pero **todo el flujo de pintado de imagen ocurre exclusivamente en
esa única characteristic 128-bit**. Cada `writeValue` debe esperar una
notificación de ACK antes de mandar el siguiente comando (timeout 15s).

### Filtros de descubrimiento BLE

```js
navigator.bluetooth.requestDevice({
  filters: [{ services: [INK_SCREEN_SERVICE] }, { namePrefix: "LK" }],
  optionalServices: [INK_SCREEN_SERVICE],
});
```

## 3. Protocolo de refresh

Todos los frames son **`[op][payload...]`** escritos sobre la characteristic
indicada. ACK llega como notificación de 3 bytes en el formato
`05 00 <param>`, donde `<param>` para `0x03` es el último número de secuencia
aceptado y para los demás opcodes es `0x00`.

```
sleep 2s tras conectar
1) write [0x00, 0x00]                                        BEGIN
2) write [0x02, len>>24, len>>16, len>>8, len]               DECLARE LENGTH (BE u32)
3) for seq in 0..N-1:
     write [0x03, seq>>8, seq, ...100 bytes data...]         DATA CHUNK (seq BE u16)
sleep 1s
4) write [0x01, device_type_num]                             COMMIT / REFRESH
```

- `len` = bytes totales del bitmap (10000 para 1.54_BWRY).
- Cada chunk lleva **100 bytes** de datos útiles + 3 bytes de overhead
  (`opcode + seq16`).
- El refresh físico del e-paper tras `COMMIT` toma 15–30 s; en ese tiempo la
  tag puede desconectarse limpiamente — eso es esperado.
- `device_type_num` se elige según la tabla de modelos (2 para nuestro
  `1.54_BWRY`).

### Códigos vendor adicionales (canal alterno `0x331F` – solo control/diagnóstico)

Detectados durante la reversa, **no necesarios para refrescar imagen** pero
útiles si se quiere status o diagnóstico:

| Opcode | Acción | Respuesta |
| --- | --- | --- |
| `0x04` | Lee descriptor de modelo | 20 bytes con firma `KNLT` + versión + tamaño |
| `0x05` | Lee primer chunk del framebuffer interno | 20 bytes |
| `0x06` | Handshake / nonce de sesión | 3 bytes `07 <nonce16_BE>` |

## 4. Formato del bitmap (1.54_BWRY)

- **Resolución**: 200 × 200 píxeles.
- **Profundidad**: 2 bits por píxel (4 colores).
- **Empaquetado**: 4 píxeles por byte, **MSB-first**
  (`pixel0 = bits[7:6]`, `pixel1 = bits[5:4]`, ...).
- **Orden**: row-major, top-to-bottom.
- **Orientación**: el panel direcciona los bytes en una orientación girada
  90° respecto al render natural; al rasterizar hay que aplicar
  **rotate(-90°)** (CW) sobre la imagen lógica antes de empaquetarla.
- **Tamaño total**: `200 × 200 × 2 / 8 = 10000` bytes.

### Paleta (valor 2bpp → color e-paper)

| Bits | Color |
| --- | --- |
| `00` | Negro (K) |
| `01` | Blanco (W) |
| `10` | Amarillo (Y) |
| `11` | Rojo (R) |

### Pseudocódigo de rasterización

```python
# img: PIL.Image RGB 200x200, ya con la composición visual deseada
img = img.rotate(-90, expand=False)  # mapear a orientación del panel
out = bytearray(10000)
for y in range(200):
    for xb in range(50):  # 200/4 = 50 bytes por fila
        byte = 0
        for k in range(4):
            v = nearest_palette_2bpp(img.getpixel((xb*4 + k, y)))
            byte |= v << ((3 - k) * 2)
        out[y * 50 + xb] = byte
```

## 5. API REST de la plataforma `leekatagg.com`

Si se prefiere usar el backend oficial (requiere cuenta provista por Leeka)
en vez de rasterizar localmente.

| Endpoint | Uso |
| --- | --- |
| `POST /MQTTServiceAPI/notIntercept/login` | Login → token `Authorization` |
| `POST /MQTTServiceAPI/afterLoginNotIntercept/mqttConnect` | Credenciales MQTT |
| `POST /MQTTServiceAPI/device/getBLEDeviceDetail` | Devuelve `hexCode` (bitmap) |
| `POST /MQTTServiceAPI/device/refresh` | Refresh individual via MQTT |
| `POST /MQTTServiceAPI/device/batchRefresh` | Refresh bulk |
| `POST /MQTTServiceAPI/device/flashLight` | Hace parpadear LED |
| `POST /MQTTServiceAPI/device/batchSetSleepModel` | Modo sleep |

El cuerpo del bitmap devuelto en `hexCode` ya viene pre-rasterizado en el
formato descrito en §4.

## 6. Identificación de la tag

- En BLE el nombre advertising es `LK<serial8>` (ej. `LK16637985`).
- El campo `deviceCode` usado por la API es **los últimos 8 caracteres del
  nombre** (`16637985`).
- Este `deviceCode` es lo que se imprime como código de barras en la propia
  etiqueta para poder vincularla con un producto vía escáner.

## 7. Buenas prácticas operativas

- **Una sesión BLE a la vez** por etiqueta. Tras `COMMIT` la tag se desconecta
  sola; respetar 30 s antes de reintentar.
- **Antes de fuzzear o experimentar** mantener spares: si una tag entra en
  estado "LED encendido permanente" → quitar la pila 10 s y reinsertar.
- **Batería**: el servicio estándar `Battery Service` (`0x180F`) expone el
  porcentaje en `0x2A19`. Útil para monitoreo desde el ERP.
- **MTU 250** soportado; cada DATA CHUNK ocupa 103 bytes, dentro del límite.
- **Polling de advertising** para descubrir tags vivas: estas tags hacen
  advertising cada ~4–5 s con un payload `Environmental Sensing` (`0x181A`)
  que incluye telemetría.

## 8. Implementación de referencia

- `scripts/esl/esl_leeka_send.py` — cliente Python con `bleak`. Envía un
  bitmap arbitrario al protocolo correcto.
- `scripts/esl/render_etiqueta.py` — rasterizador del ticket de precio (nombre,
  SKU, precio, oferta, código de barras) → 10000 bytes BWRY.

## 9. Referencias

- Plataforma SaaS Leeka: <https://leekatagg.com/mqtt/>
- Sitio comercial: <https://www.lleeka.com>
- Bundle JS analizado: `https://leekatagg.com/mqtt/static/js/app.<hash>.js`
- Manual oficial WiFi: `Operation Manual-WIFI Version` (descargado del cliente).
