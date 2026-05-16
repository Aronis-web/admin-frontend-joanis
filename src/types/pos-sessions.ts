export type PosSessionStatus = 'OPEN' | 'CLOSED' | 'SUSPENDED';

export interface PosSessionsManagementFilters {
  cashRegisterId?: string;
  companyId?: string;
  siteId?: string;
  userId?: string;
  status?: PosSessionStatus;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PosSessionCashRegisterInfo {
  id: string;
  code: string;
  name: string;
}

export interface PosSessionTotals {
  salesCount: number;
  salesCents: number;
  paymentsCents: number;
  refundsCents: number;
  openingCashCents: number;
  currentCashCents: number;
  expectedCashCents: number;
  closingCashCents: number;
  differenceCents: number;
}

export interface PosSessionClosure {
  closureReasonStatus: string;
  closureDifferenceReason: string | null;
  finalCollectionRequestId?: string | null;
  finalCollectionId?: string | null;
  finalCollectionExpectedCents: number;
  finalCollectionActualCents: number;
  finalCollectionDifferenceCents: number;
  finalCollectionDifferenceType: string;
}

export interface PosSessionManagementItem {
  id: string;
  status: PosSessionStatus;
  openedAt: string;
  closedAt?: string;
  userId: string;
  userName: string;
  cashRegister: PosSessionCashRegisterInfo;
  totals: PosSessionTotals;
  closure: PosSessionClosure;
}

export interface PosSessionsManagementResponse {
  data: PosSessionManagementItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PosSessionPaymentMethodBreakdown {
  paymentMethodId: string;
  paymentMethodCode: string;
  paymentMethodName: string;
  count: number;
  totalCents: number;
  totalAmount: number;
}

export interface PosSessionSalePayment {
  id: string;
  paymentMethodId: string;
  paymentMethodCode: string;
  paymentMethodName: string;
  amountCents: number;
  amount: number;
  referenceNumber: string | null;
  status: string;
  paymentDate: string;
}

export interface PosSessionSaleDetail {
  id: string;
  code: string;
  saleDate: string;
  status: string;
  documentType: string;
  totalCents: number;
  totalAmount: number;
  customerSnapshot?: Record<string, any>;
  companySnapshot?: Record<string, any>;
  payments: PosSessionSalePayment[];
}

export interface PosSessionCollectionDetail {
  id: string;
  collectionNumber: string;
  collectionType: string;
  amountCents: number;
  amount: number;
  expectedAmountCents: number;
  differenceCents: number;
  differenceType: string;
  cashierId: string;
  cashierName: string;
  supervisorId: string;
  supervisorName: string;
  completedAt: string;
}

export interface PosSessionRequestDetail {
  id: string;
  token: string;
  reason: string;
  status: string;
  cashierId: string;
  cashierName: string;
  processedBy?: string;
  processedByName?: string;
  processedAt?: string;
  currentCashCents: number;
  maxCollectionCents: number;
  expiresAt: string;
  createdAt: string;
}

export interface PosSessionManagementDetailResponse {
  session: {
    id: string;
    status: PosSessionStatus;
    openedAt?: string;
    closedAt?: string;
    userId?: string;
    userName: string;
    companyId?: string;
    siteId?: string;
    cashRegister: PosSessionCashRegisterInfo;
    closure?: PosSessionClosure;
  };
  summary: {
    totals: {
      salesCount: number;
      salesCents: number;
      salesAmount: number;
      paymentsCents?: number;
      paymentsAmount?: number;
      refundsCents?: number;
      refundsAmount?: number;
      openingCashCents?: number;
      openingCashAmount?: number;
      currentCashCents?: number;
      currentCashAmount?: number;
      expectedCashCents?: number;
      expectedCashAmount?: number;
      closingCashCents?: number;
      closingCashAmount?: number;
      differenceCents: number;
      differenceAmount: number;
    };
    paymentMethodBreakdown: PosSessionPaymentMethodBreakdown[];
  };
  sales: PosSessionSaleDetail[];
  collections: PosSessionCollectionDetail[];
  requests: PosSessionRequestDetail[];
}
