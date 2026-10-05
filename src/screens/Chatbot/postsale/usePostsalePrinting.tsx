/**
 * Impresión de stickers (Godex 104 × 75 mm) y hojas de armado (A4) de Post venta.
 *
 * La impresora (solo Electron) vive en `usePostsalePrinterStore`, compartida por
 * todas las pantallas: la fila "🖨️ Impresora · Cambiar" de `PostsaleShell` la
 * muestra y permite cambiarla. Si al imprimir no hay ninguna elegida, se abre
 * el selector en vez de fallar.
 *
 * Las acciones devuelven `{ ok, message }` para que quien llama muestre el
 * resultado donde el usuario lo vea (p. ej. dentro de la hoja de detalle).
 * Con `notify` (por defecto) también se muestra un Alert.
 */
import { useCallback, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { chatbotPostsaleKeys, usePrintPostsale } from '@/hooks/api/useChatbotPostsale';
import { chatbotPostsaleApi, postsaleErrorMessage } from '@/services/api/chatbot-postsale';
import { printOrderStickers } from '@/utils/priceLabel/orderStickerPrint';
import { printPickingSheets } from '@/utils/priceLabel/orderPickingSheet';
import Alert from '@/utils/alert';
import { logger } from '@/utils/logger';
import { printerDisplayName, usePostsalePrinterStore } from './printerStore';

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
}

const NEED_PRINTER =
  'Elige la impresora de stickers en el selector que se abrió y vuelve a intentarlo.';

export const usePostsalePrinting = (): PostsalePrinting => {
  const [printingPicking, setPrintingPicking] = useState(false);
  const printMutation = usePrintPostsale();
  const queryClient = useQueryClient();

  const printStickers = useCallback(
    async (orderIds: string[], options: PrintOptions = {}): Promise<PrintResult> => {
      const notify = options.notify ?? true;
      const fail = (title: string, message: string): PrintResult => {
        if (notify) Alert.alert(title, message);
        return { ok: false, message };
      };
      if (!orderIds.length) return { ok: false, message: 'No hay pedidos seleccionados.' };

      const store = usePostsalePrinterStore.getState();
      const device = await store.resolve();
      if (store.supported && !device) {
        // Sin impresora: se abre el selector en lugar de fallar.
        usePostsalePrinterStore.getState().openPicker();
        return { ok: false, message: NEED_PRINTER };
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
      const printers = usePostsalePrinterStore.getState().printers;
      const message = device
        ? `${what} a ${printerDisplayName(printers, device)}.`
        : `${what} a impresión.`;
      if (notify) Alert.alert('Impresión', message);
      return { ok: true, message };
    },
    [printMutation]
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
          // En Electron el diálogo abre con la impresora elegida preseleccionada.
          const device = usePostsalePrinterStore.getState().printer ?? undefined;
          await printPickingSheets(sheets, device);
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

  return {
    printStickers,
    printingStickers: printMutation.isPending,
    printPicking,
    printingPicking,
  };
};
