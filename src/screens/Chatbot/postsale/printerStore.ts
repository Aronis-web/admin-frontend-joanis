/**
 * Impresora de Post venta (solo Electron), compartida por todas las pantallas
 * y por stickers y hoja de armado. La elección se guarda en el equipo
 * (`postsale.stickerPrinter`). Si no hay una guardada se preselecciona una
 * Godex y, si no, la predeterminada del sistema (`auto = true`).
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

const storePrinter = (name: string) => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(PRINTER_STORAGE_KEY, name);
  } catch {
    /* noop */
  }
};

/** Dónde se muestra el selector: la pantalla o la hoja de detalle abierta encima. */
export type PickerHost = 'screen' | 'sheet';

interface PrinterState {
  supported: boolean;
  printers: PrinterInfo[];
  /** Impresora en uso (guardada o preseleccionada). */
  printer: string | null;
  /** true si no la eligió el usuario (Godex / predeterminada automática). */
  auto: boolean;
  loading: boolean;
  loaded: boolean;
  pickerOpen: boolean;
  pickerHost: PickerHost;
  /** Lista impresoras y valida la elección; devuelve la impresora en uso. */
  load: () => Promise<string | null>;
  select: (name: string) => void;
  openPicker: () => void;
  closePicker: () => void;
  setPickerHost: (host: PickerHost) => void;
  /** Impresora lista para usar (carga la lista si hace falta). */
  resolve: () => Promise<string | null>;
}

let inflight: Promise<string | null> | null = null;

export const usePostsalePrinterStore = create<PrinterState>((set, get) => ({
  supported: isElectronPrinting(),
  printers: [],
  printer: readStoredPrinter(),
  auto: !readStoredPrinter(),
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
        const stored = readStoredPrinter();
        let printer: string | null = null;
        let auto = true;
        if (stored && list.some((p) => p.name === stored)) {
          printer = stored;
          auto = false;
        } else {
          const godex = list.find((p) => /godex/i.test(p.name) || /godex/i.test(p.displayName));
          printer = (godex || list.find((p) => p.isDefault) || list[0])?.name ?? null;
        }
        set({ printers: list, printer, auto, loaded: true });
        return printer;
      } finally {
        set({ loading: false });
        inflight = null;
      }
    })();
    return inflight;
  },

  select: (name) => {
    storePrinter(name);
    set({ printer: name, auto: false, pickerOpen: false });
  },

  openPicker: () => {
    set({ pickerOpen: true });
    get().load();
  },

  closePicker: () => set({ pickerOpen: false }),

  setPickerHost: (pickerHost) => set({ pickerHost }),

  resolve: async () => {
    const s = get();
    if (!s.supported) return null;
    if (inflight) return inflight;
    if (s.loaded && s.printer && s.printers.some((p) => p.name === s.printer)) return s.printer;
    return s.load();
  },
}));

export const printerDisplayName = (printers: PrinterInfo[], name: string | null): string =>
  printers.find((p) => p.name === name)?.displayName || name || '';
