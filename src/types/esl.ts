/**
 * ESL (Electronic Shelf Label) types - Leeka BLE protocol.
 *
 * Protocolo descifrado y documentado en `docs/esl-leeka.md`.
 */

/** Modelo de la etiqueta Leeka (sufijo) -> deviceTypeNum del firmware. */
export const LEEKA_DEVICE_TYPE: Record<string, number> = {
  '1.54_BWR': 1,
  '1.54_BWRY': 2,
  '2.13_BWR': 3,
  '2.13_BWRY': 4,
  '2.66_BWR': 5,
  '2.66_BWRY': 6,
  '2.90_BWR': 7,
  '2.90_BWRY': 8,
  '3.50_BWR': 9,
  '3.50_BWRY': 10,
  '4.20_BWR': 11,
  '4.20_BWRY': 15,
  '7.50_BWR': 13,
  '7.50_BWRY': 16,
};

/** Modelo soportado por defecto en la flota actual. */
export const DEFAULT_LEEKA_MODEL = '1.54_BWRY' as const;

/** Resolución del panel 1.54_BWRY. */
export const LEEKA_154_WIDTH = 200;
export const LEEKA_154_HEIGHT = 200;
/** 200x200 / 4 px por byte = 10_000 bytes. */
export const LEEKA_154_FRAME_BYTES = 10_000;

/** UUIDs del servicio BLE de imagen. */
export const LEEKA_BLE = {
  serviceUuid: '13187b10-eba9-a3ba-044e-83d3217d9a38',
  charUuid: '4b646063-6264-f3a7-8941-e65356ea82fe',
  /** Tamaño de chunk de datos (sin contar [op][seq_hi][seq_lo]). */
  chunkBytes: 100,
} as const;

/** Etapas del envío usadas para mostrar progreso al usuario. */
export type EslSendStage =
  | 'idle'
  | 'connecting'
  | 'begin'
  | 'length'
  | 'sending-chunks'
  | 'commit'
  | 'waiting-refresh'
  | 'done'
  | 'error';

export interface EslSendProgress {
  stage: EslSendStage;
  /** Chunk actual (0..total-1). Solo válido en 'sending-chunks'. */
  chunkIndex?: number;
  totalChunks?: number;
  message?: string;
}

/** Datos del producto requeridos para renderizar el ticket. */
export interface EslTicketData {
  /** Nombre del producto (puede traer ruido tipo "x36"; se limpia al renderizar). */
  title: string;
  sku?: string;
  /** Precio de venta actual en S/. */
  price: number;
  /**
   * Precio "original" mostrado tachado.
   * Si es undefined, se calcula con una variación aleatoria (+18..+36%).
   */
  originalPrice?: number;
  /** Código de barras a imprimir. Debe ser el código de la etiqueta física. */
  tagCode: string;
  /** Texto opcional para el banner superior. */
  bannerText?: string;
}

/** Etiqueta descubierta por BLE. */
export interface DiscoveredTag {
  /** "LK16637999" -> el deviceCode es "16637999". */
  name: string;
  deviceCode: string;
  /** En web no hay MAC accesible; usamos el id del BluetoothDevice. */
  id: string;
}
