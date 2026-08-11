/**
 * Versión nativa de `eslRender`. Delega la rasterización a un `EslRenderHost`
 * (WebView oculto) que la pantalla `EtiquetasScreen` monta y registra via
 * `attachEslRenderHost(...)`.
 */

import type { EslRenderHostHandle } from '@/components/esl/EslRenderHost';
import { EslTicketData } from '@/types/esl';

let host: EslRenderHostHandle | null = null;

export function attachEslRenderHost(h: EslRenderHostHandle | null): void {
  host = h;
}

export async function renderTicketBitmap(data: EslTicketData): Promise<Uint8Array> {
  if (!host) {
    throw new Error('Renderer ESL no inicializado. Reabre la pantalla.');
  }
  const start = Date.now();
  while (!host.isReady() && Date.now() - start < 5000) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!host.isReady()) {
    throw new Error('Renderer ESL no llegó a estado ready.');
  }
  return host.render(data);
}

// Stubs para mantener la firma compatible con la versión Web; lanzan si se
// usan en native (la pantalla solo debe llamar a `renderTicketBitmap`).
export function drawTicket(): never {
  throw new Error('drawTicket no disponible en native: usa renderTicketBitmap');
}
export function canvasToLeekaBitmap(): never {
  throw new Error('canvasToLeekaBitmap no disponible en native: usa renderTicketBitmap');
}
export function randomOriginalPrice(price: number): number {
  // Mantenido por compat: precio "original" aleatorio razonable.
  const factor = 1.18 + Math.random() * 0.18;
  const raw = price * factor;
  const floored = Math.floor(raw);
  const choice = Math.random() < 0.6 ? 0.9 : 0.5;
  return floored + choice;
}
