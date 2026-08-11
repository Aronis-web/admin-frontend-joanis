/**
 * Limpia el título de un producto antes de renderizarlo en la etiqueta.
 *
 * En el catálogo es común encontrar nombres largos con sufijos de pack/SKU
 * tipo "GASEOSA INCA KOLA 1.5L X36" o "ARROZ COSTEÑO 5KG x24 PACK".
 * Esos sufijos no aportan al cliente que ve la etiqueta en el anaquel y
 * desperdician el espacio limitado de la pantalla (1.54").
 */

const PACK_SUFFIX = /\s*[xX*×]\s*\d{1,3}\s*(pack|paquete|paq|caja|cj|bolsa)?\s*$/i;
const TRAILING_NUMERIC_CODE = /\s*[-_/]?\s*\d{5,}\s*$/; // SKUs largos al final
const PARENTHETICAL_TAIL = /\s*\([^)]*\)\s*$/; // "...(SKU 12345)"

/**
 * Recorta sufijos ruidosos del título del producto.
 * Aplica hasta 3 pasadas porque a veces vienen combinados ("PROD x36 (SKU)").
 */
/** Remueve marcas diacríticas (tildes, diéresis, etc) de forma segura. */
function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function cleanProductTitle(raw: string | undefined | null): string {
  if (!raw) return '';
  let title = String(raw).trim();
  for (let i = 0; i < 3; i++) {
    const before = title;
    title = title.replace(PARENTHETICAL_TAIL, '');
    title = title.replace(PACK_SUFFIX, '');
    title = title.replace(TRAILING_NUMERIC_CODE, '');
    title = title.trim();
    if (title === before) break;
  }
  // Siempre en mayúsculas y sin tildes para legibilidad en el e-paper.
  return stripDiacritics(title).toUpperCase();
}
