import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AttendancePunch {
  check_in: string | null;   // 'HH:mm'
  check_out: string | null;  // 'HH:mm'
  check_in_note?: string;
  check_out_note?: string;
  is_break?: boolean;
}

export interface AttendanceRequestDay {
  date: string;              // 'YYYY-MM-DD'
  punches: AttendancePunch[];
}

export interface AttendanceRequest {
  id: number;
  code: string;
  emp_id: number;
  shift_id: number | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_review';
  days?: AttendanceRequestDay[];
  employee?: { id: number; name: string };
  shift?: { id: number; name: string } | null;
  created_at?: string;
}

export interface AttendanceRequestListResponse {
  data: AttendanceRequest[];
  meta?: { current_page: number; last_page: number; total: number };
}

export interface ShiftOption {
  value: number;
  label: string;
}

export interface AttendanceRequestStorePayload {
  code: string;
  shift_id?: number | null;
  reason: string;
  latitude?: number;
  longitude?: number;
  days: AttendanceRequestDay[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const attendanceRequestService = {
  /**
   * Get the logged-in employee's assigned shift (pre-populate the form)
   * GET /auth/device/attendance-requests/my-shift
   */
  async getMyShift(): Promise<{ data: ShiftOption | null }> {
    return apiClient.get(API_ENDPOINTS.ATTENDANCE_REQUEST.MY_SHIFT);
  },

  /**
   * List current employee's attendance requests
   * GET /auth/device/attendance-requests
   */
  async getList(): Promise<AttendanceRequestListResponse> {
    return apiClient.get(API_ENDPOINTS.ATTENDANCE_REQUEST.INDEX);
  },

  /**
   * Get a single attendance request detail
   * GET /auth/device/attendance-requests/{id}
   */
  async getOne(id: number | string): Promise<{ data: AttendanceRequest; status: string }> {
    return apiClient.get(API_ENDPOINTS.ATTENDANCE_REQUEST.SHOW(id));
  },

  /**
   * Submit a new attendance request
   * POST /auth/device/attendance-requests
   */
  async submit(payload: AttendanceRequestStorePayload): Promise<{ message: string; status: string }> {
    return apiClient.post(API_ENDPOINTS.ATTENDANCE_REQUEST.STORE, payload);
  },

  /**
   * Delete a pending attendance request
   * DELETE /auth/device/attendance-requests/{id}
   */
  async remove(id: number | string): Promise<{ message: string; status: string }> {
    return apiClient.delete(API_ENDPOINTS.ATTENDANCE_REQUEST.DESTROY(id));
  },
};
