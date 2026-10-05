/**
 * Impresión de stickers (Godex 104 × 100 mm) y hojas de armado (A4) de Post venta.
 * En Electron incluye el selector de impresora de stickers (se recuerda por equipo).
 */
import React, { useCallback, useEffect, useState } from 'react';
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

export interface PostsalePrinting {
  /** Registra la impresión (PAGADO → EN_ARMADO la primera vez) e imprime los stickers. */
  printStickers: (orderIds: string[]) => Promise<boolean>;
  printingStickers: boolean;
  /** Hoja de armado A4 de uno o varios pedidos, en un solo documento. */
  printPicking: (orderIds: string[]) => Promise<void>;
  printingPicking: boolean;
  /** Selector de impresora de stickers (solo Electron; null en otras plataformas). */
  printerPicker: React.ReactNode;
}

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

  const loadPrinters = useCallback(async () => {
    if (!supportsPrinterSelection) return;
    setLoadingPrinters(true);
    try {
      const list = await listPrinters();
      setPrinters(list);
      setPrinter((prev) => {
        if (prev && list.some((p) => p.name === prev)) return prev;
        const godex = list.find((p) => /godex/i.test(p.name) || /godex/i.test(p.displayName));
        return (godex || list.find((p) => p.isDefault) || list[0])?.name ?? null;
      });
    } finally {
      setLoadingPrinters(false);
    }
  }, [supportsPrinterSelection]);

  useEffect(() => {
    loadPrinters();
  }, [loadPrinters]);

  const printStickers = useCallback(
    async (orderIds: string[]): Promise<boolean> => {
      if (!orderIds.length) return false;
      if (supportsPrinterSelection && !printer) {
        Alert.alert(
          'Sin impresora',
          'No se detecta ninguna impresora. Enciende la Godex y pulsa Actualizar.'
        );
        return false;
      }
      let stickers;
      try {
        stickers = await printMutation.mutateAsync(orderIds);
      } catch (err) {
        Alert.alert('Error', postsaleErrorMessage(err, 'No se pudo generar los stickers'));
        return false;
      }
      try {
        await printOrderStickers(stickers, { deviceName: printer ?? undefined });
        return true;
      } catch (err) {
        logger.error('Error imprimiendo stickers de pedido', err);
        Alert.alert(
          'No se pudo imprimir',
          `${postsaleErrorMessage(err, 'Error de impresora')}\n\nLos pedidos quedaron registrados; búscalos en "Reimprimir".`
        );
        return false;
      }
    },
    [printMutation, printer, supportsPrinterSelection]
  );

  const printPicking = useCallback(
    async (orderIds: string[]) => {
      if (!orderIds.length) return;
      setPrintingPicking(true);
      try {
        let sheets;
        try {
          sheets = await Promise.all(orderIds.map((id) => chatbotPostsaleApi.picking(id)));
        } catch (err) {
          Alert.alert('Error', postsaleErrorMessage(err, 'No se pudo cargar la hoja de armado'));
          return;
        }
        // Cada descarga registra una impresión (HOJA_ARMADO): refresca contadores e historial.
        queryClient.invalidateQueries({ queryKey: chatbotPostsaleKeys.all });
        try {
          await printPickingSheets(sheets);
        } catch (err) {
          logger.error('Error generando hoja de armado', err);
          Alert.alert('Error', postsaleErrorMessage(err, 'No se pudo generar la hoja de armado'));
        }
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
          <Caption color={theme.color.text.muted}>Impresora de stickers (104 × 100 mm)</Caption>
          <Pressable onPress={() => loadPrinters()} disabled={loadingPrinters} hitSlop={8}>
            <Caption color={theme.color.text.link}>
              {loadingPrinters ? 'Buscando…' : 'Actualizar'}
            </Caption>
          </Pressable>
        </View>
        {printers.length === 0 ? (
          <Caption color={theme.color.state.warning.text}>
            No se detecta ninguna impresora. Enciende y conecta la Godex, luego pulsa Actualizar.
          </Caption>
        ) : (
          <ChipGroup
            options={printers.map((p) => ({ label: p.displayName || p.name, value: p.name }))}
            selected={printer ? [printer] : []}
            onChange={(sel) => {
              const name = sel[0];
              if (name) {
                setPrinter(name);
                storePrinter(name);
              }
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
  };
};
