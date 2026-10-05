/**
 * Impresión de stickers (Godex 104 × 75 mm) y hojas de armado (A4) de Post venta.
 * En Electron resuelve la impresora de stickers (la recordada en el equipo, si
 * no una Godex, si no la predeterminada) y espera la lista si aún carga.
 *
 * Las acciones devuelven `{ ok, message }` para que quien llama muestre el
 * resultado donde el usuario lo vea (p. ej. dentro de la hoja de detalle).
 * Con `notify` (por defecto) también se muestra un Alert.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Caption, Card, ChipGroup, useTheme, useThemedStyles } from '@/design-system';
import { useQueryClient } from '@tanstack/react-query';
import { chatbotPostsaleKeys, usePrintPostsale } from '@/hooks/api/useChatbotPostsale';
import { chatbotPostsaleApi, postsaleErrorMessage } from '@/services/api/chatbot-postsale';
import { printOrderStickers } from '@/utils/priceLabel/orderStickerPrint';
import { printPickingSheets } from '@/utils/priceLabel/orderPickingSheet';
import {
  isElectronPrinting,
  listPrinters,
  type PrinterInfo,
} from '@/utils/priceLabel/priceLabelPrint';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import { createPostsaleStyles } from './shared';

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

/** Elige la impresora: la actual si sigue conectada, si no una Godex, si no la predeterminada. */
const pickPrinter = (list: PrinterInfo[], current: string | null): string | null => {
  if (current && list.some((p) => p.name === current)) return current;
  const godex = list.find((p) => /godex/i.test(p.name) || /godex/i.test(p.displayName));
  return (godex || list.find((p) => p.isDefault) || list[0])?.name ?? null;
};

export interface PrintResult {
  ok: boolean;
  message: string;
}

export interface PrintOptions {
  /** Mostrar también un Alert con el resultado (por defecto true). */
  notify?: boolean;
}

export interface PostsalePrinting {
  /** Registra la impresión (PAGADO → EN_ARMADO la primera vez) e imprime los stickers. */
  printStickers: (orderIds: string[], options?: PrintOptions) => Promise<PrintResult>;
  printingStickers: boolean;
  /** Hoja de armado A4 de uno o varios pedidos, en un solo documento. */
  printPicking: (orderIds: string[], options?: PrintOptions) => Promise<PrintResult>;
  printingPicking: boolean;
  /** Selector de impresora de stickers (solo Electron; null en otras plataformas). */
  printerPicker: React.ReactNode;
  /** Electron: hay selección de impresora. */
  supportsPrinterSelection: boolean;
  printers: PrinterInfo[];
  printer: string | null;
  selectPrinter: (name: string) => void;
  loadingPrinters: boolean;
  reloadPrinters: () => Promise<string | null>;
}

const printerLabel = (list: PrinterInfo[], name: string | null) =>
  list.find((p) => p.name === name)?.displayName || name || '';

export const usePostsalePrinting = (withPrinterPicker = true): PostsalePrinting => {
  const theme = useTheme();
  const styles = useThemedStyles(createPostsaleStyles);
  const supportsPrinterSelection = isElectronPrinting();
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [printer, setPrinter] = useState<string | null>(() => readStoredPrinter());
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [printingPicking, setPrintingPicking] = useState(false);
  const printMutation = usePrintPostsale();
  const queryClient = useQueryClient();
  // Refs para leer el valor actual dentro de callbacks asíncronos.
  const printerRef = useRef(printer);
  const printersRef = useRef(printers);
  const loadingRef = useRef<Promise<string | null> | null>(null);
  printerRef.current = printer;
  printersRef.current = printers;

  /** Lista las impresoras y devuelve la elegida (comparte la carga en curso). */
  const reloadPrinters = useCallback(async (): Promise<string | null> => {
    if (!supportsPrinterSelection) return null;
    if (loadingRef.current) return loadingRef.current;
    const run = (async () => {
      setLoadingPrinters(true);
      try {
        const list = await listPrinters();
        setPrinters(list);
        printersRef.current = list;
        const chosen = pickPrinter(list, printerRef.current);
        setPrinter(chosen);
        printerRef.current = chosen;
        return chosen;
      } finally {
        setLoadingPrinters(false);
        loadingRef.current = null;
      }
    })();
    loadingRef.current = run;
    return run;
  }, [supportsPrinterSelection]);

  useEffect(() => {
    reloadPrinters();
  }, [reloadPrinters]);

  const selectPrinter = useCallback((name: string) => {
    setPrinter(name);
    printerRef.current = name;
    storePrinter(name);
  }, []);

  /** Impresora lista para usar: espera la lista si aún carga o no está validada. */
  const resolvePrinter = useCallback(async (): Promise<string | null> => {
    if (!supportsPrinterSelection) return null;
    if (loadingRef.current) return loadingRef.current;
    const current = printerRef.current;
    if (current && printersRef.current.some((p) => p.name === current)) return current;
    return reloadPrinters();
  }, [supportsPrinterSelection, reloadPrinters]);

  const printStickers = useCallback(
    async (orderIds: string[], options: PrintOptions = {}): Promise<PrintResult> => {
      const notify = options.notify ?? true;
      const fail = (title: string, message: string): PrintResult => {
        if (notify) Alert.alert(title, message);
        return { ok: false, message };
      };
      if (!orderIds.length) return { ok: false, message: 'No hay pedidos seleccionados.' };

      const device = await resolvePrinter();
      if (supportsPrinterSelection && !device) {
        return fail(
          'Sin impresora',
          'No se detecta ninguna impresora. Enciende la Godex y pulsa Actualizar.'
        );
      }

      let stickers;
      try {
        logger.info('[postsale] POST /print', { orderIds, device });
        stickers = await printMutation.mutateAsync(orderIds);
      } catch (err) {
        logger.error('[postsale] Error registrando la impresión de stickers', err);
        return fail('Error', postsaleErrorMessage(err, 'No se pudo generar los stickers'));
      }
      try {
        await printOrderStickers(stickers, { deviceName: device ?? undefined });
      } catch (err) {
        logger.error('[postsale] Error imprimiendo stickers de pedido', err);
        return fail(
          'No se pudo imprimir',
          `${postsaleErrorMessage(err, 'Error de impresora')}. La impresión quedó registrada; puedes reimprimir.`
        );
      }
      const n = stickers.length;
      const what = n === 1 ? 'Sticker enviado' : `${n} stickers enviados`;
      const message = device
        ? `${what} a ${printerLabel(printersRef.current, device)}.`
        : `${what} a impresión.`;
      if (notify) Alert.alert('Impresión', message);
      return { ok: true, message };
    },
    [printMutation, resolvePrinter, supportsPrinterSelection]
  );

  const printPicking = useCallback(
    async (orderIds: string[], options: PrintOptions = {}): Promise<PrintResult> => {
      const notify = options.notify ?? true;
      const fail = (message: string): PrintResult => {
        if (notify) Alert.alert('Error', message);
        return { ok: false, message };
      };
      if (!orderIds.length) return { ok: false, message: 'No hay pedidos seleccionados.' };
      setPrintingPicking(true);
      try {
        let sheets;
        try {
          sheets = await Promise.all(orderIds.map((id) => chatbotPostsaleApi.picking(id)));
        } catch (err) {
          logger.error('[postsale] Error cargando hoja de armado', err);
          return fail(postsaleErrorMessage(err, 'No se pudo cargar la hoja de armado'));
        } finally {
          // Cada descarga registra una impresión (HOJA_ARMADO): refresca contadores e historial.
          queryClient.invalidateQueries({ queryKey: chatbotPostsaleKeys.all });
        }
        try {
          await printPickingSheets(sheets);
        } catch (err) {
          logger.error('[postsale] Error generando hoja de armado', err);
          return fail(postsaleErrorMessage(err, 'No se pudo generar la hoja de armado'));
        }
        return {
          ok: true,
          message:
            sheets.length === 1
              ? 'Hoja de armado generada.'
              : `${sheets.length} hojas de armado generadas.`,
        };
      } finally {
        setPrintingPicking(false);
      }
    },
    [queryClient]
  );

  const printerPicker =
    withPrinterPicker && supportsPrinterSelection ? (
      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Caption color={theme.color.text.muted}>Impresora de stickers (104 × 75 mm)</Caption>
          <Pressable onPress={() => reloadPrinters()} disabled={loadingPrinters} hitSlop={8}>
            <Caption color={theme.color.text.link}>
              {loadingPrinters ? 'Buscando…' : 'Actualizar'}
            </Caption>
          </Pressable>
        </View>
        {printers.length === 0 ? (
          <Caption color={theme.color.state.warning.text}>
            {loadingPrinters
              ? 'Buscando impresoras…'
              : 'No se detecta ninguna impresora. Enciende y conecta la Godex, luego pulsa Actualizar.'}
          </Caption>
        ) : (
          <ChipGroup
            options={printers.map((p) => ({ label: p.displayName || p.name, value: p.name }))}
            selected={printer ? [printer] : []}
            onChange={(sel) => {
              if (sel[0]) selectPrinter(sel[0]);
            }}
            size="small"
          />
        )}
      </Card>
    ) : null;

  return {
    printStickers,
    printingStickers: printMutation.isPending,
    printPicking,
    printingPicking,
    printerPicker,
    supportsPrinterSelection,
    printers,
    printer,
    selectPrinter,
    loadingPrinters,
    reloadPrinters,
  };
};
