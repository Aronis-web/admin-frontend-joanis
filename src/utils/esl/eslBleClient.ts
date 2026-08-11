/**
 * Cliente BLE Leeka usando Web Bluetooth API.
 *
 * Funciona en:
 *  - Electron (Chromium, requiere handler `select-bluetooth-device` en main.js).
 *  - Navegadores Chromium (Chrome/Edge/Brave) bajo HTTPS o localhost.
 *
 * Para Android nativo (React Native) se debe portear con `react-native-ble-plx`
 * usando exactamente la misma máquina de estados de `sendBitmap`.
 */

import {
  DEFAULT_LEEKA_MODEL,
  DiscoveredTag,
  EslSendProgress,
  LEEKA_BLE,
  LEEKA_DEVICE_TYPE,
} from '@/types/esl';
import { logger } from '@/utils/logger';

type BluetoothNS = {
  requestDevice: (options: any) => Promise<any>;
};

function getBluetooth(): BluetoothNS {
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
  if (!nav || !nav.bluetooth) {
    throw new Error(
      'Web Bluetooth no está disponible en este entorno. Usa Electron o un navegador Chromium.'
    );
  }
  return nav.bluetooth as BluetoothNS;
}

/**
 * Solicita al usuario seleccionar una etiqueta Leeka (advertising name "ESL"
 * o que empiece con "LK"). Devuelve metadatos del dispositivo seleccionado.
 */
export async function requestLeekaTag(
  expectedTagCode?: string
): Promise<{ device: any; tag: DiscoveredTag }> {
  const bt = getBluetooth();
  // Si nos dan el código, filtramos al nombre exacto `LK<code>` para que el
  // picker muestre solo esa etiqueta y el flujo sea de 1 click.
  const filters: any[] = expectedTagCode
    ? [{ name: `LK${expectedTagCode}` }]
    : [{ namePrefix: 'LK' }, { name: 'ESL' }];
  const device = await bt.requestDevice({
    filters,
    optionalServices: [LEEKA_BLE.serviceUuid],
  });
  const name: string = device.name ?? '';
  const deviceCode = name.startsWith('LK') ? name.slice(2) : name;
  return {
    device,
    tag: { name, deviceCode, id: device.id },
  };
}

/** Espera `ms` milisegundos. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Envía un bitmap de 10_000 bytes a una etiqueta Leeka 1.54_BWRY.
 *
 * Flujo del protocolo (verificado contra hardware):
 *   1) sleep 2s tras GATT connect
 *   2) write [0x00, 0x00]                          BEGIN
 *   3) write [0x02, len_BE_u32]                    DECLARE LENGTH
 *   4) write [0x03, seq_BE_u16, ...100B...] × N    DATA CHUNK
 *   5) sleep 1s
 *   6) write [0x01, deviceTypeNum]                 COMMIT / REFRESH
 *
 * Cada write espera ACK por notify en la misma característica.
 */
export async function sendBitmap(
  device: any,
  bitmap: Uint8Array,
  opts: {
    model?: string;
    onProgress?: (p: EslSendProgress) => void;
    /** Si true, no desconecta al final (útil para enviar varias en serie). */
    keepConnected?: boolean;
  } = {}
): Promise<void> {
  const model = opts.model ?? DEFAULT_LEEKA_MODEL;
  const deviceTypeNum = LEEKA_DEVICE_TYPE[model];
  if (deviceTypeNum == null) {
    throw new Error(`Modelo Leeka desconocido: ${model}`);
  }
  const onProgress = opts.onProgress ?? (() => {});

  onProgress({ stage: 'connecting', message: 'Conectando GATT…' });
  if (!device.gatt) throw new Error('Dispositivo sin GATT (¿no es BLE?)');

  // Las Leeka caen rápido si no se les habla → retry de connect+getService.
  let characteristic: any;
  let service: any;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (!device.gatt.connected) {
        await device.gatt.connect();
      }
      service = await device.gatt.getPrimaryService(LEEKA_BLE.serviceUuid);
      characteristic = await service.getCharacteristic(LEEKA_BLE.charUuid);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      try {
        device.gatt.disconnect?.();
      } catch {
        /* ignore */
      }
      await delay(500 + attempt * 300);
    }
  }
  if (lastErr) throw lastErr;

  try {
    // ACK queue: cada notify se resuelve a la siguiente promesa pendiente.
    const ackQueue: Array<(value: Uint8Array) => void> = [];
    const ackBuffer: Uint8Array[] = [];
    const onNotify = (event: any) => {
      const dv: DataView = event.target.value;
      const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      const copy = new Uint8Array(bytes);
      const resolver = ackQueue.shift();
      if (resolver) resolver(copy);
      else ackBuffer.push(copy);
    };
    characteristic.addEventListener('characteristicvaluechanged', onNotify);
    await characteristic.startNotifications();

    const waitAck = (timeoutMs = 4000): Promise<Uint8Array> => {
      if (ackBuffer.length > 0) return Promise.resolve(ackBuffer.shift()!);
      return new Promise<Uint8Array>((resolve, reject) => {
        ackQueue.push(resolve);
        setTimeout(() => reject(new Error('Timeout esperando ACK')), timeoutMs);
      });
    };

    const writeAndWait = async (data: Uint8Array): Promise<Uint8Array> => {
      await characteristic.writeValueWithResponse(data);
      return waitAck();
    };

    // (1) sleep tras conectar para que el firmware esté listo.
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
    await writeAndWait(new Uint8Array([0x01, deviceTypeNum]));

    onProgress({
      stage: 'waiting-refresh',
      message: 'Pantalla refrescando (15–30 s)…',
    });
  } catch (err) {
    const e = err as { name?: string; message?: string };
    logger.error('ESL sendBitmap error', {
      name: e?.name,
      message: e?.message,
      raw: String(err),
    });
    onProgress({ stage: 'error', message: e?.message || String(err) });
    throw err;
  } finally {
    if (!opts.keepConnected) {
      try {
        await characteristic?.stopNotifications();
      } catch {
        /* ignore */
      }
      try {
        device.gatt?.disconnect();
      } catch {
        /* ignore */
      }
    }
  }
  onProgress({ stage: 'done', message: 'Enviado correctamente.' });
}

/** Desconecta el device BLE (Web Bluetooth). */
export async function disconnectTag(device: any | null | undefined): Promise<void> {
  if (!device) return;
  try {
    device.gatt?.disconnect?.();
  } catch {
    /* ignore */
  }
}
