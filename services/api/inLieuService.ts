import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

export type InLieuDuration = 'full_day' | 'first_half' | 'second_half';

export type DayType = 'working' | 'off' | 'holiday' | 'unassigned';

export interface InLieuAttachment {
  id: number;
  file_name: string;
  url: string;
}

export interface InLieuRequestRecord {
  id: number;
  code: string;
  emp_id: number;
  leave_cat_id: number;
  worked_date: string;
  worked_from?: string | null;
  worked_to?: string | null;
  worked_hours?: string | null;
  duration?: string | null;
  days?: number | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  description: string;
  status: string;
  allow_edit: boolean;
  allow_delete: boolean;
  employee?: { id: number; name: string } | null;
  leave_category?: { id: number; name: string } | null;
  attachments?: InLieuAttachment[] | null;
  created_at?: string | null;
}

export interface InLieuPayload {
  code: string;
  leave_cat_id: number;
  worked_date: string;
  worked_from: string;
  worked_to: string;
  worked_hours?: string | null;
  duration: InLieuDuration;
  days?: number | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  description: string;
}

export interface InLieuListResponse {
  data?: InLieuRequestRecord[];
}

export interface InLieuShowResponse {
  status: string;
  data?: InLieuRequestRecord;
  approvalRequest?: any;
}

export interface MessageResponse {
  status: string;
  message?: string;
}

export interface InLieuDocumentFile {
  uri: string;
  name: string;
  type?: string | null;
  webFile?: File | null;
}

export interface LeaveCategoryOption {
  value: number;
  label: string;
}

export interface DayInfo {
  date?: string;
  employee_id?: number;
  day_type?: DayType;
  holiday_name?: string | null;
  shift_name?: string | null;
  shift_code?: string | null;
  shift_color?: string | null;
  expected_in?: string | null;
  expected_out?: string | null;
}

function buildInLieuFormData(payload: InLieuPayload, document?: InLieuDocumentFile | null): FormData {
  const fd = new FormData();
  fd.append('code', payload.code);
  fd.append('leave_cat_id', String(payload.leave_cat_id));
  fd.append('worked_date', payload.worked_date);
  fd.append('worked_from', payload.worked_from);
  fd.append('worked_to', payload.worked_to);
  fd.append('worked_hours', payload.worked_hours ?? '');
  fd.append('duration', payload.duration);
  fd.append('days', String(payload.days ?? 1));
  fd.append('check_in_time', payload.check_in_time ?? '');
  fd.append('check_out_time', payload.check_out_time ?? '');
  fd.append('description', payload.description);
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

export const inLieuService = {
  async list(): Promise<InLieuListResponse> {
    return apiClient.get<InLieuListResponse>(API_ENDPOINTS.IN_LIEU_REQUESTS);
  },

  async show(id: number): Promise<InLieuShowResponse> {
    return apiClient.get<InLieuShowResponse>(`${API_ENDPOINTS.IN_LIEU_REQUESTS}/${id}`);
  },

  async store(payload: InLieuPayload, document?: InLieuDocumentFile | null): Promise<MessageResponse> {
    const fd = buildInLieuFormData(payload, document);
    return apiClient.request<MessageResponse>(API_ENDPOINTS.IN_LIEU_REQUESTS, {
      method: 'POST',
      body: fd,
    });
  },

  async update(
    id: number,
    payload: InLieuPayload,
    document?: InLieuDocumentFile | null
  ): Promise<MessageResponse> {
    const fd = buildInLieuFormData(payload, document);
    fd.append('id', String(id));
    return apiClient.request<MessageResponse>(`${API_ENDPOINTS.IN_LIEU_REQUESTS}/${id}`, {
      method: 'PATCH',
      body: fd,
    });
  },

  async destroy(id: number): Promise<MessageResponse> {
    return apiClient.delete<MessageResponse>(`${API_ENDPOINTS.IN_LIEU_REQUESTS}/${id}`);
  },

  async leaveCategories(): Promise<{ data?: LeaveCategoryOption[] }> {
    return apiClient.get<{ data?: LeaveCategoryOption[] }>(API_ENDPOINTS.LEAVE_CATEGORIES);
  },

  async classifyDate(date: string): Promise<DayInfo> {
    const res = await apiClient.get<DayInfo>(
      `${API_ENDPOINTS.IN_LIEU_CLASSIFY_DATE}?date=${encodeURIComponent(date)}`
    );
    return res;
  },

  async generateCode(): Promise<string> {
    const res = await apiClient.get<{ data?: string }>(
      `${API_ENDPOINTS.CODE_GENERATOR}?params[model]=${encodeURIComponent('in_lieu_request')}`
    );
    return res?.data ?? '';
  },
};