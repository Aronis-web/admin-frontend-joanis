import { apiClient } from './client';
import {
  OrganizationPosition,
  PositionTreeNode,
  PositionAssignment,
  PositionBudget,
  PositionAssignmentSalary,
  PositionSiteScope,
  CreatePositionRequest,
  UpdatePositionRequest,
  CreateAssignmentRequest,
  UpdateAssignmentRequest,
  CreateBudgetRequest,
  CreateSalaryRequest,
} from '@/types/organization';

/**
 * Organization API Service
 * Handles all organization-related API calls
 */
export const organizationApi = {
  // ========== POSITIONS - Company Level ==========

  /**
   * Create a company-level position
   * POST /api/organization/companies/:companyId/positions
   */
  createCompanyPosition(companyId: string, data: CreatePositionRequest) {
    return apiClient.post<OrganizationPosition>(
      `/organization/companies/${companyId}/positions`,
      data
    );
  },

  /**
   * List all company positions
   * GET /api/organization/companies/:companyId/positions
   */
  getCompanyPositions(companyId: string) {
    return apiClient.get<OrganizationPosition[]>(
      `/organization/companies/${companyId}/positions`
    );
  },

  /**
   * Get company organization tree
   * GET /api/organization/companies/:companyId/positions/tree
   */
  getCompanyPositionsTree(companyId: string) {
    return apiClient.get<PositionTreeNode[]>(
      `/organization/companies/${companyId}/positions/tree`
    );
  },

  // ========== POSITIONS - Site Level ==========

  /**
   * Create a site-level position
   * POST /api/organization/sites/:siteId/positions
   */
  createSitePosition(siteId: string, data: CreatePositionRequest) {
    return apiClient.post<OrganizationPosition>(`/organization/sites/${siteId}/positions`, data);
  },

  /**
   * List all site positions
   * GET /api/organization/sites/:siteId/positions
   */
  getSitePositions(siteId: string) {
    return apiClient.get<OrganizationPosition[]>(`/organization/sites/${siteId}/positions`);
  },

  /**
   * Get site organization tree
   * GET /api/organization/sites/:siteId/positions/tree
   */
  getSitePositionsTree(siteId: string) {
    return apiClient.get<PositionTreeNode[]>(`/organization/sites/${siteId}/positions/tree`);
  },

  // ========== POSITIONS - CRUD ==========

  /**
   * Get position by ID
   * GET /api/organization/positions/:id
   */
  getPosition(id: string) {
    return apiClient.get<OrganizationPosition>(`/organization/positions/${id}`);
  },

  /**
   * Update position
   * PUT /api/organization/positions/:id
   */
  updatePosition(id: string, data: UpdatePositionRequest) {
    return apiClient.put<OrganizationPosition>(`/organization/positions/${id}`, data);
  },

  /**
   * Delete position
   * DELETE /api/organization/positions/:id
   */
  deletePosition(id: string) {
    return apiClient.delete<{ message: string }>(`/organization/positions/${id}`);
  },

  // ========== SITE SCOPE ==========

  /**
   * Get site scope for a position
   * GET /api/organization/positions/:id/site-scope
   */
  getPositionSiteScope(id: string) {
    return apiClient.get<PositionSiteScope>(`/organization/positions/${id}/site-scope`);
  },

  /**
   * Update site scope for a position
   * PUT /api/organization/positions/:id/site-scope
   */
  updatePositionSiteScope(id: string, siteIds: string[]) {
    return apiClient.put<{ message: string }>(`/organization/positions/${id}/site-scope`, {
      siteIds,
    });
  },

  // ========== ASSIGNMENTS ==========

  /**
   * Assign user to position
   * POST /api/organization/positions/:positionId/assignments
   */
  createAssignment(positionId: string, data: CreateAssignmentRequest) {
    return apiClient.post<PositionAssignment>(
      `/organization/positions/${positionId}/assignments`,
      data
    );
  },

  /**
   * List assignments for a position
   * GET /api/organization/positions/:positionId/assignments
   */
  getPositionAssignments(positionId: string, activeOnly?: boolean) {
    const params = activeOnly ? { activeOnly: true } : {};
    return apiClient.get<PositionAssignment[]>(
      `/organization/positions/${positionId}/assignments`,
      { params }
    );
  },

  /**
   * List positions for a user
   * GET /api/organization/users/:userId/positions
   */
  getUserPositions(userId: string, activeOnly?: boolean) {
    const params = activeOnly ? { activeOnly: true } : {};
    return apiClient.get<PositionAssignment[]>(`/organization/users/${userId}/positions`, {
      params,
    });
  },

  /**
   * Get primary position for a user
   * GET /api/organization/users/:userId/positions/primary
   */
  getUserPrimaryPosition(userId: string) {
    return apiClient.get<PositionAssignment>(`/organization/users/${userId}/positions/primary`);
  },

  /**
   * Update assignment
   * PUT /api/organization/assignments/:id
   */
  updateAssignment(id: string, data: UpdateAssignmentRequest) {
    return apiClient.put<PositionAssignment>(`/organization/assignments/${id}`, data);
  },

  /**
   * End assignment
   * PATCH /api/organization/assignments/:id/end
   */
  endAssignment(id: string, endDate: string) {
    return apiClient.patch<PositionAssignment>(`/organization/assignments/${id}/end`, {
      endDate,
    });
  },

  /**
   * Delete assignment
   * DELETE /api/organization/assignments/:id
   */
  deleteAssignment(id: string) {
    return apiClient.delete<{ message: string }>(`/organization/assignments/${id}`);
  },

  // ========== BUDGET ==========

  /**
   * Create budget for a position
   * POST /api/organization/positions/:positionId/budget
   */
  createBudget(positionId: string, data: CreateBudgetRequest) {
    return apiClient.post<PositionBudget>(`/organization/positions/${positionId}/budget`, data);
  },

  /**
   * List budgets for a position
   * GET /api/organization/positions/:positionId/budget
   */
  getPositionBudgets(positionId: string) {
    return apiClient.get<PositionBudget[]>(`/organization/positions/${positionId}/budget`);
  },

  /**
   * Get current budget for a position
   * GET /api/organization/positions/:positionId/budget/current
   */
  getCurrentBudget(positionId: string) {
    return apiClient.get<PositionBudget>(`/organization/positions/${positionId}/budget/current`);
  },

  /**
   * Update budget
   * PUT /api/organization/budget/:id
   */
  updateBudget(id: string, data: Partial<CreateBudgetRequest>) {
    return apiClient.put<PositionBudget>(`/organization/budget/${id}`, data);
  },

  /**
   * Approve budget
   * PATCH /api/organization/budget/:id/approve
   */
  approveBudget(id: string) {
    return apiClient.patch<PositionBudget>(`/organization/budget/${id}/approve`, {});
  },

  /**
   * Delete budget
   * DELETE /api/organization/budget/:id
   */
  deleteBudget(id: string) {
    return apiClient.delete<{ message: string }>(`/organization/budget/${id}`);
  },

  // ========== SALARY ==========

  /**
   * Create salary for an assignment
   * POST /api/organization/assignments/:assignmentId/salary
   */
  createSalary(assignmentId: string, data: CreateSalaryRequest) {
    return apiClient.post<PositionAssignmentSalary>(
      `/organization/assignments/${assignmentId}/salary`,
      data
    );
  },

  /**
   * Get salary history for an assignment
   * GET /api/organization/assignments/:assignmentId/salary
   */
  getAssignmentSalaries(assignmentId: string) {
    return apiClient.get<PositionAssignmentSalary[]>(
      `/organization/assignments/${assignmentId}/salary`
    );
  },

  /**
   * Get current salary for an assignment
   * GET /api/organization/assignments/:assignmentId/salary/current
   */
  getCurrentSalary(assignmentId: string) {
    return apiClient.get<PositionAssignmentSalary>(
      `/organization/assignments/${assignmentId}/salary/current`
    );
  },

  /**
   * Update salary
   * PUT /api/organization/salary/:id
   */
  updateSalary(id: string, data: Partial<CreateSalaryRequest>) {
    return apiClient.put<PositionAssignmentSalary>(`/organization/salary/${id}`, data);
  },

  /**
   * Delete salary
   * DELETE /api/organization/salary/:id
   */
  deleteSalary(id: string) {
    return apiClient.delete<{ message: string }>(`/organization/salary/${id}`);
  },
};

export default organizationApi;
