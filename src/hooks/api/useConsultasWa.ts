import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { consultasWaApi } from '@/services/api';
import type {
  ConsultaWaContact,
  ConsultaWaOptions,
  ConsultaWaQrResponse,
  ConsultaWaQuery,
  ConsultaWaSessionStatus,
  CreateConsultaWaContactDto,
  UpdateConsultaWaContactDto,
} from '@/types/consultas-wa';

// ============================================
// Query Keys Factory
// ============================================
export const consultasWaKeys = {
  all: ['consultas-wa'] as const,
  status: () => [...consultasWaKeys.all, 'status'] as const,
  qr: () => [...consultasWaKeys.all, 'qr'] as const,
  options: () => [...consultasWaKeys.all, 'options'] as const,
  contacts: () => [...consultasWaKeys.all, 'contacts'] as const,
  queries: (limit: number) => [...consultasWaKeys.all, 'queries', limit] as const,
};

// ============================================
// Sesión
// ============================================

/**
 * Estado de la sesión del número de consultas. Hace polling cada 5s mientras
 * está en `QR` o `CONNECTING`.
 */
export const useConsultasWaStatus = (options?: { enabled?: boolean }) => {
  return useQuery<ConsultaWaSessionStatus>({
    queryKey: consultasWaKeys.status(),
    queryFn: () => consultasWaApi.getStatus(),
    refetchInterval: (query) => {
      const data = query.state.data as ConsultaWaSessionStatus | undefined;
      return data?.status === 'QR' || data?.status === 'CONNECTING' ? 5000 : false;
    },
    refetchOnWindowFocus: false,
    staleTime: 0,
    enabled: options?.enabled ?? true,
  });
};

/** QR de vinculación. Sólo habilitar cuando `status === 'QR'`. */
export const useConsultasWaQr = (options?: { enabled?: boolean }) => {
  return useQuery<ConsultaWaQrResponse>({
    queryKey: consultasWaKeys.qr(),
    queryFn: () => consultasWaApi.getQr(),
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
    staleTime: 0,
    enabled: options?.enabled ?? true,
  });
};

export const useStartConsultasWaSession = () => {
  const queryClient = useQueryClient();
  return useMutation<ConsultaWaSessionStatus, Error, void>({
    mutationFn: () => consultasWaApi.start(),
    onSuccess: (data) => {
      queryClient.setQueryData(consultasWaKeys.status(), data);
      queryClient.invalidateQueries({ queryKey: consultasWaKeys.status() });
      queryClient.invalidateQueries({ queryKey: consultasWaKeys.qr() });
    },
  });
};

export const useLogoutConsultasWaSession = () => {
  const queryClient = useQueryClient();
  return useMutation<ConsultaWaSessionStatus, Error, void>({
    mutationFn: () => consultasWaApi.logout(),
    onSuccess: (data) => {
      queryClient.setQueryData(consultasWaKeys.status(), data);
      queryClient.invalidateQueries({ queryKey: consultasWaKeys.status() });
      queryClient.invalidateQueries({ queryKey: consultasWaKeys.qr() });
    },
  });
};

// ============================================
// Números autorizados
// ============================================

export const useConsultasWaOptions = (options?: { enabled?: boolean }) => {
  return useQuery<ConsultaWaOptions>({
    queryKey: consultasWaKeys.options(),
    queryFn: () => consultasWaApi.getOptions(),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
};

export const useConsultasWaContacts = (options?: { enabled?: boolean }) => {
  return useQuery<ConsultaWaContact[]>({
    queryKey: consultasWaKeys.contacts(),
    queryFn: () => consultasWaApi.getContacts(),
    staleTime: 15 * 1000,
    enabled: options?.enabled ?? true,
  });
};

export const useConsultasWaQueries = (limit = 30, options?: { enabled?: boolean }) => {
  return useQuery<ConsultaWaQuery[]>({
    queryKey: consultasWaKeys.queries(limit),
    queryFn: () => consultasWaApi.getQueries(limit),
    staleTime: 15 * 1000,
    enabled: options?.enabled ?? true,
  });
};

const useInvalidateContacts = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: consultasWaKeys.contacts() });
};

export const useCreateConsultaWaContact = () => {
  const invalidate = useInvalidateContacts();
  return useMutation<ConsultaWaContact, Error, CreateConsultaWaContactDto>({
    mutationFn: (dto) => consultasWaApi.createContact(dto),
    onSuccess: () => invalidate(),
  });
};

export const useResendConsultaWaCode = () => {
  const invalidate = useInvalidateContacts();
  return useMutation<ConsultaWaContact, Error, string>({
    mutationFn: (id) => consultasWaApi.resendCode(id),
    onSuccess: () => invalidate(),
  });
};

export const useUpdateConsultaWaContact = () => {
  const invalidate = useInvalidateContacts();
  return useMutation<ConsultaWaContact, Error, { id: string; dto: UpdateConsultaWaContactDto }>({
    mutationFn: ({ id, dto }) => consultasWaApi.updateContact(id, dto),
    onSuccess: () => invalidate(),
  });
};

export const useDisableConsultaWaContact = () => {
  const invalidate = useInvalidateContacts();
  return useMutation<ConsultaWaContact, Error, string>({
    mutationFn: (id) => consultasWaApi.disableContact(id),
    onSuccess: () => invalidate(),
  });
};

export const useEnableConsultaWaContact = () => {
  const invalidate = useInvalidateContacts();
  return useMutation<ConsultaWaContact, Error, string>({
    mutationFn: (id) => consultasWaApi.enableContact(id),
    onSuccess: () => invalidate(),
  });
};
