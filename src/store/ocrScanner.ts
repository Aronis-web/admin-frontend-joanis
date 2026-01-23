import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OcrScannedFile {
  uri: string;
  name: string;
  mimeType: string;
}

export interface OcrScannedProduct {
  id: string;
  sku: string;
  nombre: string;
  cajas: number;
  unidades_por_caja: number;
  cantidad_total: number;
  precio_unitario: number;
  subtotal_fila: number;
  purchaseId?: string; // Para asociar con una compra específica
  scannedAt: number; // Timestamp de cuando se escaneó
}

export interface OcrScanResponse {
  items: any[];
  incluye_igv_en_precios: boolean;
  subtotal_documento_impreso: number | null;
  igv_impreso: number | null;
  total_documento_impreso: number | null;
  subtotal_documento_calculado: number;
  diferencia_subtotal: number | null;
  archivos_procesados?: number;
  total_estimado?: number;
  observaciones?: string;
}

interface OcrScannerState {
  // Estado del escaneo
  isScanning: boolean;
  scanningProgress: { current: number; total: number; filename: string } | null;

  // Archivos seleccionados (temporal, se limpia al confirmar)
  scannedFiles: OcrScannedFile[];
  observaciones: string;

  // Productos escaneados (persistente)
  scannedProducts: OcrScannedProduct[];
  lastScanResponse: OcrScanResponse | null;

  // ID del producto en edición
  editingProductId: string | null;

  // Actions
  setScanning: (isScanning: boolean) => void;
  setScanningProgress: (progress: { current: number; total: number; filename: string } | null) => void;

  // Manejo de archivos
  addScannedFiles: (files: OcrScannedFile[]) => void;
  removeScannedFile: (index: number) => void;
  clearScannedFiles: () => void;
  setObservaciones: (observaciones: string) => void;

  // Manejo de productos escaneados
  addScannedProducts: (products: OcrScannedProduct[], purchaseId?: string) => void;
  updateScannedProduct: (productId: string, updates: Partial<OcrScannedProduct>) => void;
  removeScannedProduct: (productId: string) => void;
  clearScannedProducts: () => void;
  clearScannedProductsByPurchase: (purchaseId: string) => void;
  getScannedProductsByPurchase: (purchaseId: string) => OcrScannedProduct[];

  // Manejo de respuesta del escaneo
  setLastScanResponse: (response: OcrScanResponse | null) => void;

  // Edición
  setEditingProductId: (productId: string | null) => void;

  // Reset completo
  resetScannerState: () => void;
}

export const useOcrScannerStore = create<OcrScannerState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      isScanning: false,
      scanningProgress: null,
      scannedFiles: [],
      observaciones: '',
      scannedProducts: [],
      lastScanResponse: null,
      editingProductId: null,

      // Actions
      setScanning: (isScanning) => set({ isScanning }),

      setScanningProgress: (progress) => set({ scanningProgress: progress }),

      // Archivos
      addScannedFiles: (files) =>
        set((state) => ({
          scannedFiles: [...state.scannedFiles, ...files].slice(0, 10),
        })),

      removeScannedFile: (index) =>
        set((state) => ({
          scannedFiles: state.scannedFiles.filter((_, i) => i !== index),
        })),

      clearScannedFiles: () => set({ scannedFiles: [] }),

      setObservaciones: (observaciones) => set({ observaciones }),

      // Productos escaneados
      addScannedProducts: (products, purchaseId) =>
        set((state) => {
          const productsWithMetadata = products.map(p => ({
            ...p,
            purchaseId,
            scannedAt: Date.now(),
          }));
          return {
            scannedProducts: [...state.scannedProducts, ...productsWithMetadata],
          };
        }),

      updateScannedProduct: (productId, updates) =>
        set((state) => ({
          scannedProducts: state.scannedProducts.map((p) =>
            p.id === productId ? { ...p, ...updates } : p
          ),
        })),

      removeScannedProduct: (productId) =>
        set((state) => ({
          scannedProducts: state.scannedProducts.filter((p) => p.id !== productId),
        })),

      clearScannedProducts: () => set({ scannedProducts: [], lastScanResponse: null }),

      clearScannedProductsByPurchase: (purchaseId) =>
        set((state) => ({
          scannedProducts: state.scannedProducts.filter(
            (p) => p.purchaseId !== purchaseId
          ),
        })),

      getScannedProductsByPurchase: (purchaseId) => {
        return get().scannedProducts.filter((p) => p.purchaseId === purchaseId);
      },

      // Respuesta del escaneo
      setLastScanResponse: (response) => set({ lastScanResponse: response }),

      // Edición
      setEditingProductId: (productId) => set({ editingProductId: productId }),

      // Reset
      resetScannerState: () =>
        set({
          isScanning: false,
          scanningProgress: null,
          scannedFiles: [],
          observaciones: '',
          editingProductId: null,
          // NO limpiamos scannedProducts ni lastScanResponse - son persistentes
        }),
    }),
    {
      name: 'ocr-scanner-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo persistir los productos escaneados y la última respuesta
      partialize: (state) => ({
        scannedProducts: state.scannedProducts,
        lastScanResponse: state.lastScanResponse,
      }),
    }
  )
);
