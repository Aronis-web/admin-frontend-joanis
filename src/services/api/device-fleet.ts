import { apiClient } from './client';

// ============================================
// VERSIONES DE CAJAS (CajaGrit escritorio)
// Cada caja reporta su version con su device token; desde aqui se ordena
// o fuerza la actualizacion.
// ============================================

export type DeviceUpdateState =
  | 'received'
  | 'downloading'
  | 'downloaded'
  | 'waiting'
  | 'installing'
  | 'up-to-date'
  | 'error';

export interface DeviceReport {
  appVersion: string;
  platform: string | null;
  latestAvailableVersion: string | null;
  pendingSales: number | null;
  rejectedSales: number | null;
  lastSeenAt: string;
  ip: string | null;
}

export interface DeviceUpdateCommand {
  id: string;
  force: boolean;
  minVersion: string | null;
  requestedBy: string;
  requestedAt: string;
  state?: DeviceUpdateState | null;
  stateAt?: string | null;
  error?: string | null;
}

export interface DeviceFleetRow {
  cashRegisterId: string;
  cashRegisterCode: string;
  cashRegisterName: string | null;
  status: string;
  siteId: string | null;
  siteName: string | null;
  hasDeviceToken: boolean;
  device: DeviceReport | null;
  updateCommand: DeviceUpdateCommand | null;
  accessRequest: {
    requestId: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELIVERED';
    deviceLabel: string | null;
    requestedAt: string;
    requestedByName: string | null;
  } | null;
  online: boolean;
  outdated: boolean;
}

export type DeviceFilter =
  | 'all'
  | 'requests'
  | 'outdated'
  | 'no_access'
  | 'online'
  | 'offline'
  | 'pending_sales';

export interface DeviceFleetQuery {
  page?: number;
  limit?: number;
  siteId?: string;
  search?: string;
  filter?: DeviceFilter;
}

export interface DeviceFleetPage {
  items: DeviceFleetRow[];
  total: number;
  page: number;
  limit: number;
  latestVersion: string | null;
  sites: { id: string; name: string }[];
  counts: Record<DeviceFilter, number>;
}

/** App y plataforma con las que se publica CajaGrit escritorio en Versiones de App. */
export const CAJAGRIT_APP_ID = 'pos';
export const CAJAGRIT_PLATFORM = 'windows';

export const deviceFleetApi = {
  list: async (query: DeviceFleetQuery = {}): Promise<DeviceFleetPage> => {
    const params = Object.fromEntries(
      Object.entries(query).filter(([, value]) => value !== undefined && value !== '')
    );
    return apiClient.get<DeviceFleetPage>('/pos/devices', { params });
  },

  update: async (
    cashRegisterIds: string[],
    force: boolean,
    minVersion?: string
  ): Promise<{ queued: string[]; skipped: string[] }> => {
    return apiClient.post('/pos/devices/update-commands', { cashRegisterIds, force, minVersion });
  },

  cancel: async (cashRegisterId: string): Promise<{ cancelled: boolean }> => {
    return apiClient.delete(`/pos/devices/${cashRegisterId}/update-command`);
  },
};

/** Compara versiones X.Y.Z. */
export const compareVersions = (a?: string | null, b?: string | null): number => {
  const parse = (value?: string | null) =>
    (String(value ?? '').match(/^v?(\d+)\.(\d+)\.(\d+)/) ?? []).slice(1, 4).map(Number);
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i++) {
    const l = left[i] ?? -1;
    const r = right[i] ?? -1;
    if (l !== r) return l > r ? 1 : -1;
  }
  return 0;
};
