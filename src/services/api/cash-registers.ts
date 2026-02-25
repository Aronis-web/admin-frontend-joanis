import { apiClient } from './client';

// ============================================
// CASH REGISTERS (Cajas Registradoras)
// ============================================

export type CashRegisterStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

export interface CashRegister {
  id: string;
  companyId: string;
  siteId: string;
  code: string;
  name: string;
  emissionPointId?: string;
  status: CashRegisterStatus;
  isOpen: boolean;
  allowNegativeBalance: boolean;
  requiresManagerApproval: boolean;
  maxCashAmountCents?: number;
  metadata?: {
    location?: string;
    ipAddress?: string;
    deviceId?: string;
    printerConfig?: Record<string, any>;
    [key: string]: any;
  };
  currentSessionId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateCashRegisterDto {
  companyId: string;
  siteId: string;
  code: string;
  name: string;
  emissionPointId?: string;
  allowNegativeBalance?: boolean;
  requiresManagerApproval?: boolean;
  maxCashAmountCents?: number;
  metadata?: Record<string, any>;
}

export interface UpdateCashRegisterDto {
  companyId?: string;
  siteId?: string;
  code?: string;
  name?: string;
  emissionPointId?: string;
  status?: CashRegisterStatus;
  allowNegativeBalance?: boolean;
  requiresManagerApproval?: boolean;
  maxCashAmountCents?: number;
  metadata?: Record<string, any>;
}

export interface GetCashRegistersParams {
  companyId?: string;
  siteId?: string;
  status?: CashRegisterStatus;
  isOpen?: boolean;
}

export interface CashRegisterStats {
  cashRegisterId: string;
  totalSessions: number;
  openSessions: number;
  closedSessions: number;
  totalSalesAmount: number;
  totalCashIn: number;
  totalCashOut: number;
  averageSessionDuration: string;
  lastSessionDate?: string;
  currentMonthSales: number;
  currentMonthSessions: number;
}

// ============================================
// SESSIONS (Sesiones de Caja)
// ============================================

export type SessionStatus = 'OPEN' | 'CLOSED' | 'SUSPENDED';

export interface Session {
  id: string;
  cashRegisterId: string;
  userId: string;
  userName: string;
  status: SessionStatus;
  openingCashCents: number;
  closingCashCents?: number;
  expectedCashCents: number;
  actualCashCents: number;
  differenceCents?: number;
  openedAt: string;
  closedAt?: string;
  openingNotes?: string;
  closingNotes?: string;
  totalSales?: number;
  totalCashIn?: number;
  totalCashOut?: number;
  transactionCount?: number;
}

export interface OpenSessionDto {
  openingCashCents: number;
  openingNotes?: string;
}

export interface CloseSessionDto {
  closingCashCents: number;
  closingNotes?: string;
}

export interface GetSessionsParams {
  cashRegisterId?: string;
  companyId?: string;
  siteId?: string;
  userId?: string;
  status?: SessionStatus;
}

export interface SessionReport {
  session: {
    id: string;
    cashRegisterId: string;
    cashRegisterName: string;
    userName: string;
    status: SessionStatus;
    openedAt: string;
    closedAt?: string;
    duration: string;
  };
  summary: {
    openingCashCents: number;
    closingCashCents?: number;
    expectedCashCents: number;
    differenceCents?: number;
    totalSales: number;
    totalCashIn: number;
    totalCashOut: number;
    totalTransactions: number;
    salesCount: number;
    cashInCount: number;
    cashOutCount: number;
  };
  transactions: Transaction[];
  sales: any[];
  paymentMethodBreakdown: {
    CASH?: number;
    CARD?: number;
    TRANSFER?: number;
    [key: string]: number | undefined;
  };
}

// ============================================
// TRANSACTIONS (Transacciones de Caja)
// ============================================

export type TransactionType = 'CASH_IN' | 'CASH_OUT' | 'SALE';

export interface Transaction {
  id: string;
  sessionId: string;
  type: TransactionType;
  amountCents: number;
  description: string;
  referenceNumber?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  session?: {
    id: string;
    cashRegisterId: string;
    status: SessionStatus;
  };
}

export interface CreateTransactionDto {
  amountCents: number;
  description: string;
  referenceNumber?: string;
}

// ============================================
// API METHODS
// ============================================

export const cashRegistersApi = {
  // ============================================
  // CASH REGISTERS
  // ============================================

  // Get all cash registers - GET /pos/cash-registers
  getCashRegisters: async (params?: GetCashRegistersParams): Promise<CashRegister[]> => {
    return apiClient.get<CashRegister[]>('/pos/cash-registers', { params });
  },

  // Get cash registers by site - GET /pos/cash-registers/site/:siteId
  getCashRegistersBySite: async (siteId: string, params?: Omit<GetCashRegistersParams, 'siteId'>): Promise<CashRegister[]> => {
    return apiClient.get<CashRegister[]>(`/pos/cash-registers/site/${siteId}`, { params });
  },

  // Get cash register by ID - GET /pos/cash-registers/:id
  getCashRegisterById: async (id: string): Promise<CashRegister> => {
    return apiClient.get<CashRegister>(`/pos/cash-registers/${id}`);
  },

  // Get cash register stats - GET /pos/cash-registers/:id/stats
  getCashRegisterStats: async (id: string): Promise<CashRegisterStats> => {
    return apiClient.get<CashRegisterStats>(`/pos/cash-registers/${id}/stats`);
  },

  // Create cash register - POST /pos/cash-registers
  createCashRegister: async (data: CreateCashRegisterDto): Promise<CashRegister> => {
    return apiClient.post<CashRegister>('/pos/cash-registers', data);
  },

  // Update cash register - PATCH /pos/cash-registers/:id
  updateCashRegister: async (id: string, data: UpdateCashRegisterDto): Promise<CashRegister> => {
    return apiClient.patch<CashRegister>(`/pos/cash-registers/${id}`, data);
  },

  // Delete cash register - DELETE /pos/cash-registers/:id
  deleteCashRegister: async (id: string): Promise<{ message: string; id: string; deletedAt: string }> => {
    return apiClient.delete(`/pos/cash-registers/${id}`);
  },

  // ============================================
  // SESSIONS
  // ============================================

  // Open session - POST /pos/sessions/open/:cashRegisterId
  openSession: async (cashRegisterId: string, data: OpenSessionDto): Promise<Session> => {
    return apiClient.post<Session>(`/pos/sessions/open/${cashRegisterId}`, data);
  },

  // Close session - POST /pos/sessions/close/:sessionId
  closeSession: async (sessionId: string, data: CloseSessionDto): Promise<Session> => {
    return apiClient.post<Session>(`/pos/sessions/close/${sessionId}`, data);
  },

  // Get current session - GET /pos/sessions/current/:cashRegisterId
  getCurrentSession: async (cashRegisterId: string): Promise<Session> => {
    return apiClient.get<Session>(`/pos/sessions/current/${cashRegisterId}`);
  },

  // Get all sessions - GET /pos/sessions
  getSessions: async (params?: GetSessionsParams): Promise<Session[]> => {
    return apiClient.get<Session[]>('/pos/sessions', { params });
  },

  // Get session by ID - GET /pos/sessions/:id
  getSessionById: async (id: string): Promise<Session> => {
    return apiClient.get<Session>(`/pos/sessions/${id}`);
  },

  // Get session report - GET /pos/sessions/:id/report
  getSessionReport: async (id: string): Promise<SessionReport> => {
    return apiClient.get<SessionReport>(`/pos/sessions/${id}/report`);
  },

  // ============================================
  // TRANSACTIONS
  // ============================================

  // Register cash in - POST /pos/transactions/cash-in/:sessionId
  registerCashIn: async (sessionId: string, data: CreateTransactionDto): Promise<Transaction> => {
    return apiClient.post<Transaction>(`/pos/transactions/cash-in/${sessionId}`, data);
  },

  // Register cash out - POST /pos/transactions/cash-out/:sessionId
  registerCashOut: async (sessionId: string, data: CreateTransactionDto): Promise<Transaction> => {
    return apiClient.post<Transaction>(`/pos/transactions/cash-out/${sessionId}`, data);
  },

  // Get session transactions - GET /pos/transactions/session/:sessionId
  getSessionTransactions: async (sessionId: string): Promise<Transaction[]> => {
    return apiClient.get<Transaction[]>(`/pos/transactions/session/${sessionId}`);
  },

  // Get transaction by ID - GET /pos/transactions/:id
  getTransactionById: async (id: string): Promise<Transaction> => {
    return apiClient.get<Transaction>(`/pos/transactions/${id}`);
  },
};
