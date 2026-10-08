/**
 * Vista previa del PDF en web/Electron: iframe con la pagina de pdf.js.
 * `onReady` entrega una funcion para imprimir lo que se ve.
 */
import React, { useEffect, useRef } from 'react';
import { pdfPreviewPage } from './pdfPreviewPage';

export const PdfPreviewFrame: React.FC<{
  base64: string;
  onPrintReady?: (print: () => void) => void;
}> = ({ base64, onPrintReady }) => {
  const ref = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    onPrintReady?.(() => ref.current?.contentWindow?.print());
  }, [onPrintReady]);
  return React.createElement('iframe', {
    ref,
    title: 'Vista previa',
    srcDoc: pdfPreviewPage(base64),
    style: { border: 0, width: '100%', height: '100%', flex: 1, background: '#525659' },
  });
};
