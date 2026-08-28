/**
 * Normaliza texto para búsquedas tolerantes a símbolos y acentos.
 *
 * - Pasa a minúsculas.
 * - Elimina acentos/diacríticos (á → a, ñ → n, etc.).
 * - Elimina cualquier símbolo no alfanumérico (guiones, puntos, comas,
 *   espacios, etc.), dejando solo letras y números.
 *
 * Ejemplos:
 *   normalizeSearchText('AB-12.3, 45')  → 'ab12345'
 *   normalizeSearchText('  Ñoño / Caña ') → 'nonocana'
 */
export function normalizeSearchText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return (
    String(value)
      .toLowerCase()
      .normalize('NFD')
      // Elimina diacríticos (marcas de acento)
      .replace(/[\u0300-\u036f]/g, '')
      // Deja solo letras y números (quita -, ., ,, espacios, etc.)
      .replace(/[^a-z0-9]/g, '')
  );
}
