/**
 * Impresora de Post venta (solo Electron), compartida por todas las pantallas
 * y por stickers y hoja de armado.
 *
 * Reglas:
 *  - Si existe una impresora con "Godex" en el nombre, los stickers van directo
 *    a ella (en silencio), salvo que el usuario haya elegido otra con "Cambiar"
 *    (esa elección se guarda en el equipo, clave `postsale.stickerPrinter`).
 *  - Si no hay Godex: la elegida por el usuario o la predeterminada del sistema.
 *  - Antes de enviar se comprueba la disponibilidad; si no está lista se avisa
 *    en pantalla y no se envía.
 *
 * Disponibilidad (best effort, depende del SO): falta en la lista → no
 * disponible; Windows `status` (máscara PRINTER_STATUS_*: 0 = lista);
 * CUPS `printer-state` 5 = detenida y `printer-is-accepting-jobs` = false.
 */
import { create } from 'zustand';
import {
  isElectronPrinting,
  listPrinters,
  type PrinterInfo,
} from '@/utils/priceLabel/priceLabelPrint';

const PRINTER_STORAGE_KEY = 'postsale.stickerPrinter';

const readStoredPrinter = (): string | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(PRINTER_STORAGE_KEY) : null;
  } catch {
    return null;
  }
};

const writeStoredPrinter = (name: string | null) => {
  try {
    if (typeof localStorage === 'undefined') return;
    if (name) localStorage.setItem(PRINTER_STORAGE_KEY, name);
    else localStorage.removeItem(PRINTER_STORAGE_KEY);
  } catch {
    /* noop */
  }
};

export const isGodex = (p: PrinterInfo) => /godex/i.test(p.name) || /godex/i.test(p.displayName);

/** Bits de Windows PRINTER_STATUS_* que impiden imprimir, con su motivo. */
const WIN_STATUS_BLOCKING: Array<[number, string]> = [
  [0x00000080, 'sin conexión'],
  [0x00000001, 'en pausa'],
  [0x00000002, 'con error'],
  [0x00000008, 'papel atascado'],
  [0x00000010, 'sin etiquetas'],
  [0x00000040, 'problema de papel'],
  [0x00001000, 'no disponible'],
  [0x00100000, 'requiere atención'],
  [0x00400000, 'tapa abierta'],
  [0x00000004, 'eliminándose'],
];

export interface PrinterAvailability {
  ok: boolean;
  /** Motivo legible cuando no está disponible. */
  reason: string;
}

/** Disponibilidad de una impresora a partir de lo que devuelve Electron. */
export const printerAvailability = (p: PrinterInfo | undefined): PrinterAvailability => {
  if (!p) return { ok: false, reason: 'no conectada' };
  const opts = p.options ?? {};
  if (opts['printer-state'] === '5') return { ok: false, reason: 'detenida' };
  if (opts['printer-is-accepting-jobs'] === 'false') {
    return { ok: false, reason: 'no acepta trabajos' };
  }
  const status = Number(p.status) || 0;
  for (const [bit, reason] of WIN_STATUS_BLOCKING) {
    // eslint-disable-next-line no-bitwise -- máscara PRINTER_STATUS_* de Windows
    if (status & bit) return { ok: false, reason };
  }
  return { ok: true, reason: '' };
};

/** Dónde se muestra el selector: la pantalla o la hoja de detalle abierta encima. */
export type PickerHost = 'screen' | 'sheet';

interface PrinterState {
  supported: boolean;
  printers: PrinterInfo[];
  /** Impresora que se usará para los stickers. */
  printer: string | null;
  /** true si no la eligió el usuario (Godex / predeterminada automática). */
  auto: boolean;
  /** Nombre de la Godex detectada (si hay). */
  godex: string | null;
  loading: boolean;
  loaded: boolean;
  pickerOpen: boolean;
  pickerHost: PickerHost;
  /** Lista impresoras (estado incluido) y recalcula la impresora en uso. */
  load: () => Promise<string | null>;
  /** Elección explícita del usuario ("Cambiar"); se recuerda en el equipo. */
  select: (name: string) => void;
  /** Quita la elección manual: vuelve a la Godex / predeterminada automática. */
  clearOverride: () => void;
  openPicker: () => void;
  closePicker: () => void;
  setPickerHost: (host: PickerHost) => void;
}

const choosePrinter = (
  list: PrinterInfo[]
): { printer: string | null; auto: boolean; godex: string | null } => {
  const godex = list.find(isGodex)?.name ?? null;
  const stored = readStoredPrinter();
  if (stored && list.some((p) => p.name === stored)) {
    return { printer: stored, auto: false, godex };
  }
  const fallback = godex ?? (list.find((p) => p.isDefault) || list[0])?.name ?? null;
  return { printer: fallback, auto: true, godex };
};

let inflight: Promise<string | null> | null = null;

export const usePostsalePrinterStore = create<PrinterState>((set, get) => ({
  supported: isElectronPrinting(),
  printers: [],
  printer: readStoredPrinter(),
  auto: !readStoredPrinter(),
  godex: null,
  loading: false,
  loaded: false,
  pickerOpen: false,
  pickerHost: 'screen',

  load: async () => {
    if (!get().supported) return null;
    if (inflight) return inflight;
    inflight = (async () => {
      set({ loading: true });
      try {
        const list = await listPrinters();
        const chosen = choosePrinter(list);
        set({ printers: list, ...chosen, loaded: true });
        return chosen.printer;
      } finally {
        set({ loading: false });
        inflight = null;
      }
    })();
    return inflight;
  },

  select: (name) => {
    writeStoredPrinter(name);
    set({ printer: name, auto: false, pickerOpen: false });
  },

  clearOverride: () => {
    writeStoredPrinter(null);
    set({ ...choosePrinter(get().printers), pickerOpen: false });
  },

  openPicker: () => {
    set({ pickerOpen: true });
    get().load();
  },

  closePicker: () => set({ pickerOpen: false }),

  setPickerHost: (pickerHost) => set({ pickerHost }),
}));

export const printerDisplayName = (printers: PrinterInfo[], name: string | null): string =>
  printers.find((p) => p.name === name)?.displayName || name || '';

/**
 * Impresora para imprimir stickers AHORA: vuelve a listar (estado fresco) y
 * comprueba que esté disponible.
 */
export const resolveStickerPrinter = async (): Promise<
  | { kind: 'unsupported' }
  | { kind: 'none' }
  | { kind: 'unavailable'; name: string; reason: string }
  | { kind: 'ready'; name: string }
> => {
  const store = usePostsalePrinterStore.getState();
  if (!store.supported) return { kind: 'unsupported' };
  const name = await store.load();
  if (!name) return { kind: 'none' };
  const { printers } = usePostsalePrinterStore.getState();
  const info = printers.find((p) => p.name === name);
  const availability = printerAvailability(info);
  if (!availability.ok) {
    return {
      kind: 'unavailable',
      name: printerDisplayName(printers, name),
      reason: availability.reason,
    };
  }
  return { kind: 'ready', name };
};
