export { useAuthStore } from './auth';
export type { User } from '@/types/auth';

export { useTenantStore } from './tenant';
export type { Warehouse, Site, Company } from './tenant';

export { useUIStore } from './ui';
export type { RegisteredFabAction } from './ui';

export { useOcrScannerStore } from './ocrScanner';
export type {
  OcrScannedProduct,
  OcrScannedFile,
  OcrScanResponse,
  ScanJob,
  ScanJobStatus,
  OcrProvider,
} from './ocrScanner';
