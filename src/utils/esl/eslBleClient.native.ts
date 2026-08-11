/**
 * Cliente BLE Leeka para React Native (Android / iOS).
 *
 * Usa `react-native-ble-plx`. Mantiene la misma API que la versión Web:
 *   - requestLeekaTag(code?)  → escanea hasta encontrar la etiqueta y la devuelve.
 *   - sendBitmap(device, buf) → ejecuta el flujo descifrado del protocolo Leeka.
 *
 * Protocolo (idéntico al de la versión Web, verificado contra hardware):
 *   1) sleep 2s tras connect.
 *   2) write [0x00, 0x00]                          BEGIN
 *   3) write [0x02, len_BE_u32]                    DECLARE LENGTH
 *   4) write [0x03, seq_BE_u16, ...100B...] × N    DATA CHUNK
 *   5) sleep 1s
 *   6) write [0x01, deviceTypeNum]                 COMMIT / REFRESH
 *
 * En Android 12+ se necesitan los permisos BLUETOOTH_SCAN y BLUETOOTH_CONNECT.
 * Llamar `ensureBlePermissions()` antes de usar.
 */

import { PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleManager, Characteristic, Device, Subscription } from 'react-native-ble-plx';

import {
  DEFAULT_LEEKA_MODEL,
  DiscoveredTag,
  EslSendProgress,
  LEEKA_BLE,
  LEEKA_DEVICE_TYPE,
} from '@/types/esl';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Singleton del manager (ble-plx es caro de instanciar).
// ---------------------------------------------------------------------------
let _manager: BleManager | null = null;
function getManager(): BleManager {
  if (!_manager) {
    try {
      _manager = new BleManager();
    } catch (err) {
      logger.error('BleManager init falló', err);
      throw new Error(
        'Bluetooth no disponible en este build. Necesitas un APK nativo ' +
          '(no Expo Go) compilado tras instalar react-native-ble-plx. ' +
          'Ejecuta `npx expo prebuild --clean && npx expo run:android`.'
      );
    }
  }
  return _manager;
}

// ---------------------------------------------------------------------------
// Permisos Android
// ---------------------------------------------------------------------------
export async function ensureBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const api = Platform.Version as number;
  try {
    if (api >= 31) {
      const res = await PermissionsAndroid.requestMultiple([
        'android.permission.BLUETOOTH_SCAN' as any,
        'android.permission.BLUETOOTH_CONNECT' as any,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      logger.info('ESL permissions API31+', res);
      const granted = PermissionsAndroid.RESULTS.GRANTED;
      // SCAN + CONNECT obligatorios; LOCATION soft-fail (algunos OEM lo piden).
      return (
        res['android.permission.BLUETOOTH_SCAN'] === granted &&
        res['android.permission.BLUETOOTH_CONNECT'] === granted
      );
    }
    // API <31 requiere LOCATION para escanear.
    const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return g === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    logger.warn('ensureBlePermissions error', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Base64 helpers (ble-plx usa base64 para los buffers binarios).
// ---------------------------------------------------------------------------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

function bytesToBase64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const b0 = b[i];
    const b1 = b[i + 1] ?? 0;
    const b2 = b[i + 2] ?? 0;
    const t = (b0 << 16) | (b1 << 8) | b2;
    out += B64[(t >> 18) & 63];
    out += B64[(t >> 12) & 63];
    out += i + 1 < b.length ? B64[(t >> 6) & 63] : '=';
    out += i + 2 < b.length ? B64[t & 63] : '=';
  }
  return out;
}

function base64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let oi = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e0 = B64_LOOKUP[clean.charCodeAt(i)];
    const e1 = B64_LOOKUP[clean.charCodeAt(i + 1)] ?? 0;
    const e2 = B64_LOOKUP[clean.charCodeAt(i + 2)] ?? 0;
    const e3 = B64_LOOKUP[clean.charCodeAt(i + 3)] ?? 0;
    out[oi++] = (e0 << 2) | (e1 >> 4);
    if (i + 2 < clean.length) out[oi++] = ((e1 & 15) << 4) | (e2 >> 2);
    if (i + 3 < clean.length) out[oi++] = ((e2 & 3) << 6) | e3;
  }
  return out;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Estado del BT del adaptador. Espera a 'PoweredOn' antes de escanear.
// ---------------------------------------------------------------------------
async function waitForPoweredOn(timeoutMs = 5000): Promise<void> {
  const m = getManager();
  const state = await m.state();
  if (state === 'PoweredOn') return;
  return new Promise<void>((resolve, reject) => {
    let sub: Subscription | null = null;
    const to = setTimeout(() => {
      sub?.remove();
      reject(new Error(`Bluetooth no disponible (estado ${state})`));
    }, timeoutMs);
    sub = m.onStateChange((s) => {
      if (s === 'PoweredOn') {
        clearTimeout(to);
        sub?.remove();
        resolve();
      }
    }, true);
  });
}

// ---------------------------------------------------------------------------
// Scan: busca etiqueta por nombre `LK<code>`. Si no se pasa code, devuelve
// la primera que matchee el prefijo "LK" o el name "ESL".
// ---------------------------------------------------------------------------
export async function requestLeekaTag(
  expectedTagCode?: string
): Promise<{ device: Device; tag: DiscoveredTag }> {
  const okPerm = await ensureBlePermissions();
  if (!okPerm) {
    throw new Error('Permisos de Bluetooth denegados.');
  }
  await waitForPoweredOn();
  const m = getManager();
  const wanted = expectedTagCode ? `LK${expectedTagCode}` : null;

  return new Promise<{ device: Device; tag: DiscoveredTag }>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        m.stopDeviceScan();
      } catch {
        /* ignore */
      }
      const err: any = new Error(
        wanted ? `No se encontró ${wanted} (timeout)` : 'No se encontró etiqueta (timeout)'
      );
      err.name = 'NotFoundError';
      reject(err);
    }, 15000);

    let seen = 0;
    m.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (settled) return;
      if (error) {
        settled = true;
        clearTimeout(timeout);
        logger.error('ESL scan error', {
          message: (error as any)?.message,
          reason: (error as any)?.reason,
          errorCode: (error as any)?.errorCode,
        });
        reject(error);
        return;
      }
      if (!device) return;
      seen += 1;
      // `name` viene del GATT cache (a veces null al primer hit). `localName`
      // viene del advertising packet — preferirlo para matches rápidos.
      const name = device.localName || device.name || '';
      if (seen < 30 && (name.startsWith('LK') || name === 'ESL' || !name)) {
        logger.info('ESL scan hit', { name, id: device.id, rssi: device.rssi });
      }
      if (!name) return;
      const matches = wanted ? name === wanted : name.startsWith('LK') || name === 'ESL';
      if (!matches) return;
      settled = true;
      clearTimeout(timeout);
      try {
        m.stopDeviceScan();
      } catch {
        /* ignore */
      }
      const deviceCode = name.startsWith('LK') ? name.slice(2) : name;
      resolve({ device, tag: { name, deviceCode, id: device.id } });
    });
  });
}

// ---------------------------------------------------------------------------
// sendBitmap — flujo de transferencia descifrado del protocolo Leeka.
// ---------------------------------------------------------------------------
export async function sendBitmap(
  device: Device,
  bitmap: Uint8Array,
  opts: {
    model?: string;
    onProgress?: (p: EslSendProgress) => void;
    keepConnected?: boolean;
  } = {}
): Promise<void> {
  const model = opts.model ?? DEFAULT_LEEKA_MODEL;
  const typeNum = LEEKA_DEVICE_TYPE[model];
  if (typeNum == null) throw new Error(`Modelo Leeka desconocido: ${model}`);
  const onProgress = opts.onProgress ?? (() => {});

  onProgress({ stage: 'connecting', message: 'Conectando GATT…' });

  // Connect con reintentos (las Leeka caen rápido si no se les habla pronto).
  let connected: Device | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const isConn = await device.isConnected();
      connected = isConn ? device : await device.connect({ requestMTU: 247 });
      await connected.discoverAllServicesAndCharacteristics();
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      try {
        await device.cancelConnection();
      } catch {
        /* ignore */
      }
      await delay(500 + attempt * 300);
    }
  }
  if (lastErr || !connected) {
    throw lastErr ?? new Error('Conexión BLE falló');
  }

  // ACK queue alimentada por la subscripción a notify.
  const ackQueue: Array<(v: Uint8Array) => void> = [];
  const ackBuffer: Uint8Array[] = [];

  let notifySub: Subscription | null = null;
  try {
    notifySub = connected.monitorCharacteristicForService(
      LEEKA_BLE.serviceUuid,
      LEEKA_BLE.charUuid,
      (err: BleError | null, c: Characteristic | null) => {
        if (err || !c?.value) return;
        const bytes = base64ToBytes(c.value);
        const resolver = ackQueue.shift();
        if (resolver) resolver(bytes);
        else ackBuffer.push(bytes);
      }
    );

    const waitAck = (timeoutMs = 4000): Promise<Uint8Array> => {
      if (ackBuffer.length > 0) return Promise.resolve(ackBuffer.shift()!);
      return new Promise<Uint8Array>((resolve, reject) => {
        ackQueue.push(resolve);
        setTimeout(() => reject(new Error('Timeout esperando ACK')), timeoutMs);
      });
    };

    const writeAndWait = async (data: Uint8Array): Promise<Uint8Array> => {
      await connected!.writeCharacteristicWithResponseForService(
        LEEKA_BLE.serviceUuid,
        LEEKA_BLE.charUuid,
        bytesToBase64(data)
      );
      return waitAck();
    };

    // (1) breve sleep tras conectar (firmware requiere settle time).
    await delay(2000);

    // (2) BEGIN
    onProgress({ stage: 'begin', message: 'Iniciando transferencia…' });
    await writeAndWait(new Uint8Array([0x00, 0x00]));

    // (3) DECLARE LENGTH
    onProgress({ stage: 'length', message: `Declarando ${bitmap.length} bytes…` });
    const lenBuf = new Uint8Array(5);
    lenBuf[0] = 0x02;
    lenBuf[1] = (bitmap.length >>> 24) & 0xff;
    lenBuf[2] = (bitmap.length >>> 16) & 0xff;
    lenBuf[3] = (bitmap.length >>> 8) & 0xff;
    lenBuf[4] = bitmap.length & 0xff;
    await writeAndWait(lenBuf);

    // (4) DATA CHUNKS
    const chunkSize = LEEKA_BLE.chunkBytes;
    const totalChunks = Math.ceil(bitmap.length / chunkSize);
    onProgress({ stage: 'sending-chunks', chunkIndex: 0, totalChunks });
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, bitmap.length);
      const chunk = bitmap.subarray(start, end);
      const frame = new Uint8Array(3 + chunk.length);
      frame[0] = 0x03;
      frame[1] = (i >>> 8) & 0xff;
      frame[2] = i & 0xff;
      frame.set(chunk, 3);
      await writeAndWait(frame);
      if (i % 10 === 0 || i === totalChunks - 1) {
        onProgress({ stage: 'sending-chunks', chunkIndex: i + 1, totalChunks });
      }
    }

    // (5) sleep + (6) COMMIT
    await delay(1000);
    onProgress({ stage: 'commit', message: 'Solicitando refresh…' });
    await writeAndWait(new Uint8Array([0x01, typeNum]));

    onProgress({
      stage: 'waiting-refresh',
      message: 'Pantalla refrescando (15–30 s)…',
    });
  } catch (err) {
    const e = err as { name?: string; message?: string };
    logger.error('ESL sendBitmap error (native)', {
      name: e?.name,
      message: e?.message,
      raw: String(err),
    });
    onProgress({ stage: 'error', message: e?.message || String(err) });
    throw err;
  } finally {
    try {
      notifySub?.remove();
    } catch {
      /* ignore */
    }
    if (!opts.keepConnected) {
      try {
        await connected.cancelConnection();
      } catch {
        /* ignore */
      }
    }
  }
  onProgress({ stage: 'done', message: 'Enviado correctamente.' });
}

/** Desconecta cualquier conexión activa con la etiqueta. */
export async function disconnectTag(device: Device | null | undefined): Promise<void> {
  if (!device) return;
  try {
    const isConn = await device.isConnected();
    if (isConn) await device.cancelConnection();
  } catch {
    /* ignore */
  }
}
