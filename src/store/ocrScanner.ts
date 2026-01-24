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

// Estado de un trabajo de escaneo
export type ScanJobStatus = 'pending' | 'scanning' | 'completed' | 'failed';

export interface ScanJob {
  id: string; // Unique job ID
  purchaseId: string;
  files: OcrScannedFile[];
  observaciones?: string;
  status: ScanJobStatus;
  progress: { current: number; total: number; filename: string } | null;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: OcrScanResponse;
}

// Archivos seleccionados por compra
interface PurchaseFiles {
  [purchaseId: string]: {
    files: OcrScannedFile[];
    observaciones: string;
  };
}

interface OcrScannerState {
  // Cola de trabajos de escaneo (persistente)
  scanJobs: ScanJob[];

  // Archivos seleccionados por compra (temporal)
  purchaseFiles: PurchaseFiles;

  // Productos escaneados (persistente)
  scannedProducts: OcrScannedProduct[];

  // ID del producto en edición por compra
  editingProductIds: { [purchaseId: string]: string | null };

  // Actions - Manejo de trabajos
  addScanJob: (job: ScanJob) => void;
  updateScanJob: (jobId: string, updates: Partial<ScanJob>) => void;
  removeScanJob: (jobId: string) => void;
  getScanJobsByPurchase: (purchaseId: string) => ScanJob[];
  getActiveScanJobs: () => ScanJob[];
  clearCompletedJobs: () => void;

  // Actions - Manejo de archivos por compra
  addScannedFiles: (purchaseId: string, files: OcrScannedFile[]) => void;
  removeScannedFile: (purchaseId: string, index: number) => void;
  clearScannedFiles: (purchaseId: string) => void;
  setObservaciones: (purchaseId: string, observaciones: string) => void;
  getScannedFiles: (purchaseId: string) => OcrScannedFile[];
  getObservaciones: (purchaseId: string) => string;

  // Actions - Manejo de productos escaneados
  addScannedProducts: (products: OcrScannedProduct[], purchaseId?: string) => void;
  updateScannedProduct: (productId: string, updates: Partial<OcrScannedProduct>) => void;
  removeScannedProduct: (productId: string) => void;
  clearScannedProducts: () => void;
  clearScannedProductsByPurchase: (purchaseId: string) => void;
  getScannedProductsByPurchase: (purchaseId: string) => OcrScannedProduct[];

  // Actions - Edición
  setEditingProductId: (purchaseId: string, productId: string | null) => void;
  getEditingProductId: (purchaseId: string) => string | null;

  // Reset completo
  resetScannerState: () => void;
}

export const useOcrScannerStore = create<OcrScannerState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      scanJobs: [],
      purchaseFiles: {},
      scannedProducts: [],
      editingProductIds: {},

      // Actions - Manejo de trabajos
      addScanJob: (job) =>
        set((state) => ({
          scanJobs: [...state.scanJobs, job],
        })),

      updateScanJob: (jobId, updates) =>
        set((state) => ({
          scanJobs: state.scanJobs.map((job) => (job.id === jobId ? { ...job, ...updates } : job)),
        })),

      removeScanJob: (jobId) =>
        set((state) => ({
          scanJobs: state.scanJobs.filter((job) => job.id !== jobId),
        })),

      getScanJobsByPurchase: (purchaseId) => {
        return get().scanJobs.filter((job) => job.purchaseId === purchaseId);
      },

      getActiveScanJobs: () => {
        return get().scanJobs.filter(
          (job) => job.status === 'pending' || job.status === 'scanning'
        );
      },

      clearCompletedJobs: () =>
        set((state) => ({
          scanJobs: state.scanJobs.filter(
            (job) => job.status !== 'completed' && job.status !== 'failed'
          ),
        })),

      // Actions - Manejo de archivos por compra
      addScannedFiles: (purchaseId, files) =>
        set((state) => {
          const currentFiles = state.purchaseFiles[purchaseId]?.files || [];
          const currentObs = state.purchaseFiles[purchaseId]?.observaciones || '';
          return {
            purchaseFiles: {
              ...state.purchaseFiles,
              [purchaseId]: {
                files: [...currentFiles, ...files].slice(0, 10),
                observaciones: currentObs,
              },
            },
          };
        }),

      removeScannedFile: (purchaseId, index) =>
        set((state) => {
          const currentFiles = state.purchaseFiles[purchaseId]?.files || [];
          const currentObs = state.purchaseFiles[purchaseId]?.observaciones || '';
          return {
            purchaseFiles: {
              ...state.purchaseFiles,
              [purchaseId]: {
                files: currentFiles.filter((_, i) => i !== index),
                observaciones: currentObs,
              },
            },
          };
        }),

      clearScannedFiles: (purchaseId) =>
        set((state) => {
          const currentObs = state.purchaseFiles[purchaseId]?.observaciones || '';
          return {
            purchaseFiles: {
              ...state.purchaseFiles,
              [purchaseId]: {
                files: [],
                observaciones: currentObs,
              },
            },
          };
        }),

      setObservaciones: (purchaseId, observaciones) =>
        set((state) => {
          const currentFiles = state.purchaseFiles[purchaseId]?.files || [];
          return {
            purchaseFiles: {
              ...state.purchaseFiles,
              [purchaseId]: {
                files: currentFiles,
                observaciones,
              },
            },
          };
        }),

      getScannedFiles: (purchaseId) => {
        return get().purchaseFiles[purchaseId]?.files || [];
      },

      getObservaciones: (purchaseId) => {
        return get().purchaseFiles[purchaseId]?.observaciones || '';
      },

      // Actions - Productos escaneados
      addScannedProducts: (products, purchaseId) =>
        set((state) => {
          // Evitar duplicados: verificar si ya existen productos con los mismos IDs
          const existingIds = new Set(state.scannedProducts.map((p) => p.id));
          const newProducts = products.filter((p) => !existingIds.has(p.id));

          const productsWithMetadata = newProducts.map((p) => ({
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

      clearScannedProducts: () => set({ scannedProducts: [] }),

      clearScannedProductsByPurchase: (purchaseId) =>
        set((state) => ({
          scannedProducts: state.scannedProducts.filter((p) => p.purchaseId !== purchaseId),
        })),

      getScannedProductsByPurchase: (purchaseId) => {
        return get().scannedProducts.filter((p) => p.purchaseId === purchaseId);
      },

      // Actions - Edición
      setEditingProductId: (purchaseId, productId) =>
        set((state) => ({
          editingProductIds: {
            ...state.editingProductIds,
            [purchaseId]: productId,
          },
        })),

      getEditingProductId: (purchaseId) => {
        return get().editingProductIds[purchaseId] || null;
      },

      // Reset
      resetScannerState: () =>
        set({
          purchaseFiles: {},
          editingProductIds: {},
          // NO limpiamos scanJobs ni scannedProducts - son persistentes
        }),
    }),
    {
      name: 'ocr-scanner-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Persistir trabajos, productos escaneados y archivos seleccionados
      partialize: (state) => ({
        scanJobs: state.scanJobs,
        scannedProducts: state.scannedProducts,
        purchaseFiles: state.purchaseFiles,
        editingProductIds: state.editingProductIds,
      }),
    }
  )
);
