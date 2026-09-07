import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { smartPurchaseApi } from '@/services/api';
import { saveAndShareExcel, saveAndSharePdf } from '@/utils/fileDownload';
import type {
  AddSuppliersDto,
  BlockFamilyDto,
  CreateGroupDto,
  GenerateOrdersDto,
  GetSupplierAnalysisParams,
  MoveMemberDto,
  OrderExportFormat,
  ProductFamilyWithMembers,
  QueryFamiliesDto,
  QueryOrdersDto,
  RunAnalysisResponse,
  SmartPurchaseGroupWithSuppliers,
  SmartPurchaseOrderItem,
  SmartPurchaseOrderWithItems,
  SupplierAnalysisDetail,
  UpdateFamilyDto,
  UpdateGroupDto,
  UpdateOrderItemDto,
} from '@/types/smartPurchase';

// ============================================
// Query Keys Factory
// ============================================
export const smartPurchaseKeys = {
  all: ['smart-purchase'] as const,

  // Analysis
  analysis: () => [...smartPurchaseKeys.all, 'analysis'] as const,
  analysisList: (params?: GetSupplierAnalysisParams) =>
    [...smartPurchaseKeys.analysis(), 'list', params] as const,
  analysisDetail: (supplierId: string) =>
    [...smartPurchaseKeys.analysis(), 'detail', supplierId] as const,

  // Groups
  groups: () => [...smartPurchaseKeys.all, 'groups'] as const,
  groupList: () => [...smartPurchaseKeys.groups(), 'list'] as const,
  groupDetail: (id: string) => [...smartPurchaseKeys.groups(), 'detail', id] as const,

  // Families
  families: () => [...smartPurchaseKeys.all, 'families'] as const,
  familyList: (groupId: string, query?: QueryFamiliesDto) =>
    [...smartPurchaseKeys.families(), 'list', groupId, query] as const,
  familyDetail: (id: string) => [...smartPurchaseKeys.families(), 'detail', id] as const,
  productStatus: (productIds: string[]) =>
    [...smartPurchaseKeys.families(), 'product-status', productIds.slice().sort()] as const,

  // Orders
  orders: () => [...smartPurchaseKeys.all, 'orders'] as const,
  orderList: (query?: QueryOrdersDto) => [...smartPurchaseKeys.orders(), 'list', query] as const,
  orderDetail: (id: string) => [...smartPurchaseKeys.orders(), 'detail', id] as const,
};

const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 min
const SHORT_STALE_TIME = 60 * 1000;

// ============================================
// Análisis · Queries
// ============================================

export const useSupplierAnalysis = (
  params?: GetSupplierAnalysisParams,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: smartPurchaseKeys.analysisList(params),
    queryFn: () => smartPurchaseApi.getSupplierAnalysis(params),
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
};

export const useSupplierAnalysisDetail = (supplierId: string | undefined) => {
  return useQuery<SupplierAnalysisDetail>({
    queryKey: smartPurchaseKeys.analysisDetail(supplierId ?? ''),
    queryFn: () => smartPurchaseApi.getSupplierAnalysisDetail(supplierId as string),
    enabled: !!supplierId,
    staleTime: SHORT_STALE_TIME,
  });
};

// ============================================
// Análisis · Mutations
// ============================================

export const useRunAnalysis = () => {
  const queryClient = useQueryClient();
  return useMutation<RunAnalysisResponse, Error, { supplierId?: string } | void>({
    mutationFn: () => smartPurchaseApi.runAnalysis(),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.analysis() });
      if (vars && 'supplierId' in vars && vars.supplierId) {
        queryClient.invalidateQueries({
          queryKey: smartPurchaseKeys.analysisDetail(vars.supplierId),
        });
      }
    },
  });
};

// ============================================
// Grupos · Queries
// ============================================

export const useSmartPurchaseGroups = () => {
  return useQuery({
    queryKey: smartPurchaseKeys.groupList(),
    queryFn: () => smartPurchaseApi.listGroups(),
    staleTime: DEFAULT_STALE_TIME,
    refetchOnWindowFocus: false,
  });
};

export const useSmartPurchaseGroup = (id: string | undefined) => {
  return useQuery<SmartPurchaseGroupWithSuppliers>({
    queryKey: smartPurchaseKeys.groupDetail(id ?? ''),
    queryFn: () => smartPurchaseApi.getGroup(id as string),
    enabled: !!id,
    staleTime: DEFAULT_STALE_TIME,
  });
};

// ============================================
// Grupos · Mutations
// ============================================

export const useCreateSmartPurchaseGroup = () => {
  const queryClient = useQueryClient();
  return useMutation<SmartPurchaseGroupWithSuppliers, Error, CreateGroupDto>({
    mutationFn: (data) => smartPurchaseApi.createGroup(data),
    onSuccess: (group) => {
      queryClient.setQueryData(smartPurchaseKeys.groupDetail(group.id), group);
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.groups() });
    },
  });
};

export const useUpdateSmartPurchaseGroup = () => {
  const queryClient = useQueryClient();
  return useMutation<SmartPurchaseGroupWithSuppliers, Error, { id: string; data: UpdateGroupDto }>({
    mutationFn: ({ id, data }) => smartPurchaseApi.updateGroup(id, data),
    onSuccess: (group) => {
      queryClient.setQueryData(smartPurchaseKeys.groupDetail(group.id), group);
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.groups() });
    },
  });
};

export const useDeleteSmartPurchaseGroup = () => {
  const queryClient = useQueryClient();
  return useMutation<{ deleted: true }, Error, string>({
    mutationFn: (id) => smartPurchaseApi.deleteGroup(id),
    onSuccess: (_res, id) => {
      queryClient.removeQueries({ queryKey: smartPurchaseKeys.groupDetail(id) });
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.groups() });
    },
  });
};

export const useAddSmartPurchaseSuppliers = () => {
  const queryClient = useQueryClient();
  return useMutation<SmartPurchaseGroupWithSuppliers, Error, { id: string; data: AddSuppliersDto }>(
    {
      mutationFn: ({ id, data }) => smartPurchaseApi.addSuppliers(id, data),
      onSuccess: (group) => {
        queryClient.setQueryData(smartPurchaseKeys.groupDetail(group.id), group);
        queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.groups() });
      },
    }
  );
};

export const useRemoveSmartPurchaseSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation<{ removed: true }, Error, { id: string; supplierId: string }>({
    mutationFn: ({ id, supplierId }) => smartPurchaseApi.removeSupplier(id, supplierId),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.groupDetail(vars.id) });
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.groups() });
    },
  });
};

export const useRebuildFamilies = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => smartPurchaseApi.rebuildFamilies(groupId),
    onSuccess: (_res, groupId) => {
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.families() });
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.groupDetail(groupId) });
    },
  });
};

export const useRescoreFamilies = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => smartPurchaseApi.rescoreFamilies(groupId),
    onSuccess: (_res, groupId) => {
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.families() });
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.groupDetail(groupId) });
    },
  });
};

// ============================================
// Familias · Queries
// ============================================

export const useFamilies = (groupId: string | undefined, query?: QueryFamiliesDto) => {
  return useQuery({
    queryKey: smartPurchaseKeys.familyList(groupId ?? '', query),
    queryFn: () => smartPurchaseApi.listFamilies(groupId as string, query),
    enabled: !!groupId,
    staleTime: SHORT_STALE_TIME,
    refetchOnWindowFocus: false,
  });
};

export const useFamily = (id: string | undefined) => {
  return useQuery<ProductFamilyWithMembers>({
    queryKey: smartPurchaseKeys.familyDetail(id ?? ''),
    queryFn: () => smartPurchaseApi.getFamily(id as string),
    enabled: !!id,
  });
};

export const useProductStatus = (productIds: string[], options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: smartPurchaseKeys.productStatus(productIds),
    queryFn: () => smartPurchaseApi.getProductStatus(productIds),
    enabled: (options?.enabled ?? true) && productIds.length > 0,
    staleTime: SHORT_STALE_TIME,
  });
};

// ============================================
// Familias · Mutations
// ============================================

const invalidateFamily = (
  queryClient: ReturnType<typeof useQueryClient>,
  family: ProductFamilyWithMembers
) => {
  queryClient.setQueryData(smartPurchaseKeys.familyDetail(family.id), family);
  queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.families() });
};

export const useUpdateFamily = () => {
  const queryClient = useQueryClient();
  return useMutation<ProductFamilyWithMembers, Error, { id: string; data: UpdateFamilyDto }>({
    mutationFn: ({ id, data }) => smartPurchaseApi.updateFamily(id, data),
    onSuccess: (family) => invalidateFamily(queryClient, family),
  });
};

export const useBlockFamily = () => {
  const queryClient = useQueryClient();
  return useMutation<ProductFamilyWithMembers, Error, { id: string; data: BlockFamilyDto }>({
    mutationFn: ({ id, data }) => smartPurchaseApi.blockFamily(id, data),
    onSuccess: (family) => invalidateFamily(queryClient, family),
  });
};

export const useUnblockFamily = () => {
  const queryClient = useQueryClient();
  return useMutation<ProductFamilyWithMembers, Error, string>({
    mutationFn: (id) => smartPurchaseApi.unblockFamily(id),
    onSuccess: (family) => invalidateFamily(queryClient, family),
  });
};

export const useAddFamilyMember = () => {
  const queryClient = useQueryClient();
  return useMutation<ProductFamilyWithMembers, Error, { id: string; data: MoveMemberDto }>({
    mutationFn: ({ id, data }) => smartPurchaseApi.addFamilyMember(id, data),
    onSuccess: (family) => invalidateFamily(queryClient, family),
  });
};

export const useRemoveFamilyMember = () => {
  const queryClient = useQueryClient();
  return useMutation<{ removed: true }, Error, { id: string; productId: string }>({
    mutationFn: ({ id, productId }) => smartPurchaseApi.removeFamilyMember(id, productId),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.familyDetail(vars.id) });
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.families() });
    },
  });
};

// ============================================
// Órdenes · Queries
// ============================================

export const useSmartPurchaseOrders = (query?: QueryOrdersDto) => {
  return useQuery({
    queryKey: smartPurchaseKeys.orderList(query),
    queryFn: () => smartPurchaseApi.listOrders(query),
    staleTime: SHORT_STALE_TIME,
    refetchOnWindowFocus: false,
  });
};

export const useSmartPurchaseOrder = (id: string | undefined) => {
  return useQuery<SmartPurchaseOrderWithItems>({
    queryKey: smartPurchaseKeys.orderDetail(id ?? ''),
    queryFn: () => smartPurchaseApi.getOrder(id as string),
    enabled: !!id,
  });
};

// ============================================
// Órdenes · Mutations
// ============================================

export const useGenerateOrders = () => {
  const queryClient = useQueryClient();
  return useMutation<SmartPurchaseOrderWithItems[], Error, GenerateOrdersDto>({
    mutationFn: (data) => smartPurchaseApi.generateOrders(data),
    onSuccess: (orders) => {
      orders.forEach((order) => {
        queryClient.setQueryData(smartPurchaseKeys.orderDetail(order.id), order);
      });
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.orders() });
    },
  });
};

export const useUpdateOrderItem = () => {
  const queryClient = useQueryClient();
  return useMutation<
    SmartPurchaseOrderItem,
    Error,
    { orderId: string; itemId: string; data: UpdateOrderItemDto }
  >({
    mutationFn: ({ orderId, itemId, data }) =>
      smartPurchaseApi.updateOrderItem(orderId, itemId, data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.orderDetail(vars.orderId) });
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.orders() });
    },
  });
};

export const useApproveOrder = () => {
  const queryClient = useQueryClient();
  return useMutation<SmartPurchaseOrderWithItems, Error, string>({
    mutationFn: (id) => smartPurchaseApi.approveOrder(id),
    onSuccess: (order) => {
      queryClient.setQueryData(smartPurchaseKeys.orderDetail(order.id), order);
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.orders() });
    },
  });
};

export const useCancelOrder = () => {
  const queryClient = useQueryClient();
  return useMutation<SmartPurchaseOrderWithItems, Error, string>({
    mutationFn: (id) => smartPurchaseApi.cancelOrder(id),
    onSuccess: (order) => {
      queryClient.setQueryData(smartPurchaseKeys.orderDetail(order.id), order);
      queryClient.invalidateQueries({ queryKey: smartPurchaseKeys.orders() });
    },
  });
};

// ============================================
// Export helper (Excel / PDF)
// ============================================

export const downloadSmartPurchaseOrder = async (
  orderId: string,
  code: string,
  format: OrderExportFormat = 'xlsx'
): Promise<void> => {
  const blob = await smartPurchaseApi.exportOrder(orderId, format);
  const fileName = `${code || `orden-${orderId}`}.${format}`;
  if (format === 'pdf') {
    await saveAndSharePdf(blob, fileName, 'Compra Inteligente');
  } else {
    await saveAndShareExcel(blob, fileName, 'Compra Inteligente');
  }
};
