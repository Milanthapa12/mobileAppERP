import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaveCategory {
  id: number;
  name: string;
  max_days: number;
  allow_full_day: boolean;
  allow_half_day: boolean;
  negative_balance: boolean;
  max_consecutive_days: number;
}

export interface LeaveCategoryOption {
  value: number;
  label: string;
}

export interface LeaveBalance {
  name: string;
  remaining_days: number;
  total_days: number;
  carry_forwarded_days: number;
  allow_full_day: boolean;
  allow_half_day: boolean;
  allow_negative: boolean;
  consecutive_day: number;
}

export interface LeaveRow {
  date: string;           // YYYY-MM-DD
  duration: 'full_day' | 'first_half' | 'second_half';
  days: number;           // 1 or 0.5
}

export interface LeaveApplication {
  id: number;
  code: string;
  emp_id: number;
  leave_cat_id: number;
  effective_from: string;
  effective_to: string;
  total_days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_review' | 'cancelled';
  leave_category?: { id: number; name: string };
  employee?: { id: number; name: string };
  lines?: LeaveRow[];
  created_at?: string;
  updated_at?: string;
}

export interface LeaveApplicationResponse {
  data: LeaveApplication[];
  meta?: { current_page: number; last_page: number; total: number };
}

export interface LeaveStorePayload {
  code: string;
  leave_cat_id: number;
  effective_from: string;
  effective_to: string;
  total_days: number;
  reason: string;
  leave_rows: LeaveRow[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const leaveService = {
  /**
   * Fetch leave category picker options
   * GET /auth/device/leave-categories
   */
  async getCategories(): Promise<{ data: LeaveCategoryOption[] }> {
    return apiClient.get(API_ENDPOINTS.LEAVE.CATEGORIES);
  },

  /**
   * Get leave balance for a specific leave category
   * GET /auth/device/leave-balance/{leaveId}
   */
  async getBalance(leaveId: number | string): Promise<{ data: LeaveBalance }> {
    return apiClient.get(API_ENDPOINTS.LEAVE.BALANCE(leaveId));
  },

  /**
   * List current employee's leave applications
   * GET /auth/device/leave-application
   */
  async getList(): Promise<LeaveApplicationResponse> {
    return apiClient.get(API_ENDPOINTS.LEAVE.INDEX);
  },

  /**
   * Get a single leave application detail
   * GET /auth/device/leave-application/{id}
   */
  async getOne(id: number | string): Promise<{ data: LeaveApplication; status: string }> {
    return apiClient.get(API_ENDPOINTS.LEAVE.SHOW(id));
  },

  /**
   * Submit a new leave application
   * POST /auth/device/leave-application
   */
  async submit(payload: LeaveStorePayload): Promise<{ message: string; status: string }> {
    return apiClient.post(API_ENDPOINTS.LEAVE.STORE, payload);
  },

  /**
   * Update an existing leave application
   * PATCH /auth/device/leave-application/{id}
   */
  async update(
    id: number | string,
    payload: LeaveStorePayload
  ): Promise<{ message: string; status: string }> {
    return apiClient.request(API_ENDPOINTS.LEAVE.UPDATE(id), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Delete a leave application
   * DELETE /auth/device/leave-application/{id}
   */
  async remove(id: number | string): Promise<{ message: string; status: string }> {
    return apiClient.delete(API_ENDPOINTS.LEAVE.DESTROY(id));
  },
};
