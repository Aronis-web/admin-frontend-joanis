/**
 * Vista previa del PDF en Android/iOS: WebView con la pagina de pdf.js (el
 * WebView de Android no abre PDF por si solo). Imprimir usa el dialogo del
 * sistema (PdfPreviewModal), no el WebView.
 */
import React from 'react';
import { WebView } from 'react-native-webview';
import { pdfPreviewPage } from './pdfPreviewPage';

export const PdfPreviewFrame: React.FC<{
  base64: string;
  onPrintReady?: (print: () => void) => void;
}> = ({ base64 }) => (
  <WebView
    originWhitelist={['*']}
    source={{ html: pdfPreviewPage(base64), baseUrl: 'https://cdnjs.cloudflare.com' }}
    javaScriptEnabled
    style={{ flex: 1, backgroundColor: '#525659' }}
  />
);
