// Declaración de tipos para el componente platform-specific.
// Existen implementaciones `.native.tsx` y `.web.tsx`; Metro/Webpack resuelven
// la variante correcta en runtime, pero TypeScript necesita este `.d.ts`
// para tipar el import `./IzipayCaptureWebView`.
import * as React from 'react';

export const PANEL_URL: string;

export interface IzipayCaptureWebViewProps {
  onToken: (token: string) => void;
  height?: number | string;
  onHookReady?: (ready: boolean) => void;
}

export const IzipayCaptureWebView: React.FC<IzipayCaptureWebViewProps>;

export default IzipayCaptureWebView;
