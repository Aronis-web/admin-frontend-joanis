/**
 * Tipos mínimos de `qrcode` (dependencia transitiva de react-native-qrcode-styled,
 * sin @types instalado). Solo cubre lo que usa la app.
 */
declare module 'qrcode' {
  export interface QRCodeToStringOptions {
    type?: 'svg' | 'utf8' | 'terminal';
    margin?: number;
    width?: number;
    scale?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' | 'low' | 'medium' | 'quartile' | 'high';
    color?: { dark?: string; light?: string };
  }

  export function toString(text: string, options?: QRCodeToStringOptions): Promise<string>;

  const QRCode: {
    toString: typeof toString;
  };
  export default QRCode;
}
