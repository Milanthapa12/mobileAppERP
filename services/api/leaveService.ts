import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

export type LeaveDuration = 'full_day' | 'first_half' | 'second_half';

export interface LeaveLine {
  id?: number;
  date: string;
  duration: LeaveDuration;
  days: number;
}

export interface LeaveBalanceItem {
  id: number;
  name: string;
  total_days: number;
  used_days: number;
  remaining_days: number;
}

export interface LeaveCategoryBalance {
  name: string;
  remaining_days: number;
  allow_full_day: boolean;
  allow_half_day: boolean;
  allow_negative: boolean;
  consecutive_day: number | null;
  total_days?: number;
  carry_forwarded_days?: number;
}

export interface LeaveCategoryOption {
  value: number;
  label: string;
}

export interface LeaveApplicationRecord {
  id: number;
  code: string;
  emp_id: number;
  leave_cat_id: number;
  effective_from: string;
  effective_to: string;
  total_days: number;
  reason: string;
  employee: { id: number; name: string } | null;
  leave_category: { id: number; name: string } | null;
  lines: LeaveLine[];
  attachments: { id: number; file_name: string; url: string }[] | null;
  created_at: string | null;
  status: string;
  allow_edit: boolean;
  allow_delete: boolean;
}

export interface LeaveRowPayload {
  date: string;
  duration: string;
  days: number;
}

export interface LeavePayload {
  code: string;
  leave_cat_id: number;
  effective_from: string;
  effective_to: string;
  total_days: number;
  reason: string;
  leave_rows: LeaveRowPayload[];
}

export interface LeaveListResponse {
  data?: LeaveApplicationRecord[];
}

export interface LeaveShowResponse {
  status: string;
  data?: LeaveApplicationRecord;
  approvalRequest?: any;
}

export interface LeaveBalanceListResponse {
  data?: LeaveBalanceItem[];
}

export interface LeaveCategoryBalanceResponse {
  status: string;
  data?: LeaveCategoryBalance;
}

export interface LeaveCategoriesResponse {
  status: string;
  data?: LeaveCategoryOption[];
}

export interface MessageResponse {
  status: string;
  message?: string;
}

export interface LeaveDocumentFile {
  uri: string;
  name: string;
  type?: string | null;
  webFile?: File | null;
}

function buildLeaveFormData(payload: LeavePayload, document?: LeaveDocumentFile | null): FormData {
  const fd = new FormData();
  fd.append('code', payload.code);
  fd.append('leave_cat_id', String(payload.leave_cat_id));
  fd.append('effective_from', payload.effective_from);
  fd.append('effective_to', payload.effective_to);
  fd.append('total_days', String(payload.total_days));
  fd.append('reason', payload.reason);
  payload.leave_rows.forEach((row, i) => {
    fd.append(`leave_rows[${i}][date]`, row.date);
    fd.append(`leave_rows[${i}][duration]`, row.duration);
    fd.append(`leave_rows[${i}][days]`, String(row.days));
  });
  if (document) {
    if (document.webFile) {
      fd.append('document', document.webFile, document.name);
    } else {
      fd.append('document', {
        uri: document.uri,
        name: document.name,
        type: document.type ?? 'application/octet-stream',
      } as any);
    }
  }
  return fd;
}

export const leaveService = {
  async list(): Promise<LeaveListResponse> {
    return apiClient.get<LeaveListResponse>(API_ENDPOINTS.LEAVE_APPLICATIONS);
  },

  async show(id: number): Promise<LeaveShowResponse> {
    return apiClient.get<LeaveShowResponse>(`${API_ENDPOINTS.LEAVE_APPLICATIONS}/${id}`);
  },

  async store(payload: LeavePayload, document?: LeaveDocumentFile | null): Promise<MessageResponse> {
    const fd = buildLeaveFormData(payload, document);
    return apiClient.request<MessageResponse>(API_ENDPOINTS.LEAVE_APPLICATIONS, {
      method: 'POST',
      body: fd,
    });
  },

  async update(
    id: number,
    payload: LeavePayload,
    document?: LeaveDocumentFile | null
  ): Promise<MessageResponse> {
    const fd = buildLeaveFormData(payload, document);
    fd.append('id', String(id));
    return apiClient.request<MessageResponse>(`${API_ENDPOINTS.LEAVE_APPLICATIONS}/${id}`, {
      method: 'PATCH',
      body: fd,
    });
  },

  async destroy(id: number): Promise<MessageResponse> {
    return apiClient.delete<MessageResponse>(`${API_ENDPOINTS.LEAVE_APPLICATIONS}/${id}`);
  },

  async categories(): Promise<LeaveCategoriesResponse> {
    return apiClient.get<LeaveCategoriesResponse>(API_ENDPOINTS.LEAVE_CATEGORIES);
  },

  async balanceForCategory(leaveId: number): Promise<LeaveCategoryBalanceResponse> {
    return apiClient.get<LeaveCategoryBalanceResponse>(`${API_ENDPOINTS.LEAVE_BALANCE}/${leaveId}`);
  },

  async balances(): Promise<LeaveBalanceListResponse> {
    return apiClient.get<LeaveBalanceListResponse>(API_ENDPOINTS.LEAVE_BALANCES);
  },

  async generateCode(): Promise<string> {
    const res = await apiClient.get<{ data?: string }>(
      `${API_ENDPOINTS.CODE_GENERATOR}?params[model]=${encodeURIComponent('leave_application')}`
    );
    return res?.data ?? '';
  },
};