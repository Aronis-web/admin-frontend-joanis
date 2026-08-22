import { useMutation } from '@tanstack/react-query';

import {
  reportsApi,
  SendKardexSalidasPayload,
  SendPleReportResponse,
  SendRegistroVentasPayload,
} from '@/services/api/reports';
import { logger } from '@/utils/logger';

/**
 * POST /admin/reports/registro-ventas/export
 * Encola generación async del Registro de Ventas SUNAT 14.1 y lo envía por WhatsApp.
 */
export const useSendRegistroVentas = () => {
  return useMutation<SendPleReportResponse, unknown, SendRegistroVentasPayload>({
    mutationFn: (payload) => reportsApi.sendRegistroVentas(payload),
    onError: (error) => {
      logger.error('Error enviando Registro de Ventas por WhatsApp', error);
    },
  });
};

/**
 * POST /admin/reports/kardex/salidas/export
 * Encola generación async del Kardex SUNAT 12.1 (Salidas) y lo envía por WhatsApp.
 */
export const useSendKardexSalidas = () => {
  return useMutation<SendPleReportResponse, unknown, SendKardexSalidasPayload>({
    mutationFn: (payload) => reportsApi.sendKardexSalidas(payload),
    onError: (error) => {
      logger.error('Error enviando Kardex 12.1 Salidas por WhatsApp', error);
    },
  });
};

/**
 * POST /admin/reports/kardex/salidas/export-detallado
 * Encola generación async del Movimiento de almacén detallado (egresos) y lo envía por WhatsApp.
 */
export const useSendKardexSalidasDetalle = () => {
  return useMutation<SendPleReportResponse, unknown, SendKardexSalidasPayload>({
    mutationFn: (payload) => reportsApi.sendKardexSalidasDetalle(payload),
    onError: (error) => {
      logger.error('Error enviando Kardex 12.1 Detallado por WhatsApp', error);
    },
  });
};
