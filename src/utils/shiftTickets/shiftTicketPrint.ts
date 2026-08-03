/**
 * Impresión de tickets de turno en impresora térmica de 80mm.
 *
 * Cada ticket lleva, de arriba a abajo:
 *   - Marca "Joanis"
 *   - Título "Ticket de Turno" y el número de turno (grande)
 *   - Fecha/hora de emisión
 *   - Al final: un código único por turno en formato de código de barras
 *     (Code128) junto a su texto.
 *
 * Reutiliza el pipeline de impresión de 80mm (`printHtml`) y el generador de
 * Code128 ya existentes.
 */

import { code128Svg } from '@/utils/priceLabel/code128Svg';
import { printHtml } from '@/utils/priceLabel/priceLabelPrint';
import type { ShiftTicketRecord } from './shiftTicketStore';

const BRAND = 'Joanis';

const escapeHtml = (value: string): string =>
  (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDateTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Convierte una fecha `YYYY-MM-DD` a `DD/MM/YYYY` para mostrar. */
const formatDateOnly = (date: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  return `${match[3]}/${match[2]}/${match[1]}`;
};

/** Construye el bloque HTML de un único ticket de turno. */
const buildTicketBlock = (record: ShiftTicketRecord): string => {
  const svg = code128Svg(record.code, { height: 60 });
  // Solo el código de barras, sin el texto del código debajo.
  const barcodeHtml = svg ? `<div class="barcode">${svg}</div>` : '';

  return `
    <div class="ticket">
      <div class="brand">${escapeHtml(BRAND)}</div>
      <div class="title">Ticket de Turno</div>
      <div class="shift">Turno ${escapeHtml(String(record.shift))}</div>
      <div class="date">${escapeHtml(formatDateOnly(record.date))}</div>
      <div class="datetime">${escapeHtml(formatDateTime(record.createdAt))}</div>
      <div class="divider"></div>
      ${barcodeHtml}
    </div>`;
};

/** Construye el documento HTML completo con un ticket por turno. */
const buildTicketsHtml = (records: ShiftTicketRecord[]): string => {
  const blocks = records.map(buildTicketBlock).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Tickets de turno</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; color: #000; }
  .ticket {
    width: 80mm;
    padding: 3mm 4mm 5mm;
    text-align: center;
    page-break-after: always;
    break-after: page;
  }
  .ticket:last-child { page-break-after: auto; break-after: auto; }
  .brand {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 2px;
    line-height: 1;
    margin-bottom: 1mm;
  }
  .title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 0.5mm;
  }
  .shift {
    font-size: 34px;
    font-weight: 800;
    line-height: 1.1;
    margin: 0.5mm 0;
  }
  .date {
    font-size: 14px;
    font-weight: 700;
    color: #000;
    margin-top: 0.5mm;
  }
  .datetime {
    font-size: 10px;
    color: #222;
    margin-bottom: 1.5mm;
  }
  .divider {
    border-top: 1px dashed #000;
    margin: 1.5mm 0 2mm;
  }
  .barcode {
    display: block;
    width: 70mm;
    height: 16mm;
    margin: 0 auto;
  }
  .barcode svg { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>${blocks}</body>
</html>`;
};

/**
 * Imprime uno o varios tickets de turno (uno por registro) en impresora térmica
 * de 80mm. `deviceName` (Electron) imprime silenciosamente en esa impresora.
 */
export const printShiftTickets = async (
  records: ShiftTicketRecord[],
  deviceName?: string
): Promise<void> => {
  if (records.length === 0) return;
  const html = buildTicketsHtml(records);
  await printHtml(html, deviceName);
};
