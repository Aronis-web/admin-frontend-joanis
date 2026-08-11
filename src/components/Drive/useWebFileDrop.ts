/**
 * useWebFileDrop
 *
 * Hook para habilitar drag & drop de archivos y paste (Ctrl+V) en un contenedor
 * en web/Electron. En nativo no hace nada.
 *
 * - Registra listeners globales `dragover`, `drop`, `paste` mientras el hook
 *   esté activo.
 * - Reporta el estado `isDragging` para pintar un overlay visual.
 * - Llama a `onFiles(files)` cuando el usuario suelta o pega archivos.
 */

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

interface Options {
  enabled?: boolean;
  onFiles: (files: File[]) => void;
}

export const useWebFileDrop = ({ enabled = true, onFiles }: Options): { isDragging: boolean } => {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let counter = 0;

    const handleDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      // Solo mostramos overlay si vienen archivos (no texto/HTML)
      if (Array.from(e.dataTransfer.types).includes('Files')) {
        counter += 1;
        setIsDragging(true);
      }
    };

    const handleDragLeave = () => {
      counter = Math.max(0, counter - 1);
      if (counter === 0) setIsDragging(false);
    };

    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      if (Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        // Cursor de "copiar"
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length > 0) {
        e.preventDefault();
        counter = 0;
        setIsDragging(false);
        onFiles(files);
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Evitamos capturar paste dentro de <input>/<textarea>/contentEditable
      if (target) {
        const tag = target.tagName?.toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i];
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        onFiles(files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('paste', handlePaste);
    };
  }, [enabled, onFiles]);

  return { isDragging };
};

export default useWebFileDrop;
