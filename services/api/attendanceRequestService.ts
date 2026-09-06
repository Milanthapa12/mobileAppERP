import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

export interface AttendanceRequestPunch {
  id?: number;
  check_in: string | null;
  check_out: string | null;
  check_in_note: string | null;
  check_out_note: string | null;
  is_break: boolean;
}

export interface AttendanceRequestDay {
  id?: number;
  date: string;
  punches: AttendanceRequestPunch[];
}

export interface AttendanceRequestRecord {
  id: number;
  emp_id: number;
  code: string;
  shift_id: number | null;
  reason: string;
  latitude: number | null;
  longitude: number | null;
  location_name?: string | null;
  status: string;
  allow_edit: boolean;
  allow_delete: boolean;
  employee: { id: number; name: string } | null;
  shift: { id: number; name: string } | null;
  days: AttendanceRequestDay[];
  created_at: string | null;
}

export interface AttendanceRequestPunchPayload {
  check_in?: string | null;
  check_out?: string | null;
  check_in_note?: string | null;
  check_out_note?: string | null;
  is_break?: boolean;
}

export interface AttendanceRequestDayPayload {
  date: string;
  punches: AttendanceRequestPunchPayload[];
}

export interface AttendanceRequestPayload {
  code: string;
  shift_id?: number | null;
  reason: string;
  latitude?: number | null;
  longitude?: number | null;
  days: AttendanceRequestDayPayload[];
}

export interface AttendanceRequestListResponse {
  data?: AttendanceRequestRecord[];
}

export interface AttendanceRequestShowResponse {
  status: string;
  data?: AttendanceRequestRecord;
  approvalRequest?: any;
}

export interface MyShiftResponse {
  data?: { value?: number; label?: string } | null;
}

export interface MessageResponse {
  status: string;
  message?: string;
}

export const attendanceRequestService = {
  async list(): Promise<AttendanceRequestListResponse> {
    return apiClient.get<AttendanceRequestListResponse>(API_ENDPOINTS.ATTENDANCE_REQUESTS);
  },

  async show(id: number): Promise<AttendanceRequestShowResponse> {
    return apiClient.get<AttendanceRequestShowResponse>(`${API_ENDPOINTS.ATTENDANCE_REQUESTS}/${id}`);
  },

  async store(payload: AttendanceRequestPayload): Promise<MessageResponse> {
    return apiClient.post<MessageResponse>(API_ENDPOINTS.ATTENDANCE_REQUESTS, payload);
  },

  async update(id: number, payload: AttendanceRequestPayload): Promise<MessageResponse> {
    return apiClient.patch<MessageResponse>(`${API_ENDPOINTS.ATTENDANCE_REQUESTS}/${id}`, payload);
  },

  async destroy(id: number): Promise<MessageResponse> {
    return apiClient.delete<MessageResponse>(`${API_ENDPOINTS.ATTENDANCE_REQUESTS}/${id}`);
  },

  async myShift(): Promise<MyShiftResponse> {
    return apiClient.get<MyShiftResponse>(`${API_ENDPOINTS.ATTENDANCE_REQUESTS}/my-shift`);
  },

  async generateCode(model: string): Promise<string> {
    const res = await apiClient.get<{ data?: string }>(`${API_ENDPOINTS.CODE_GENERATOR}?params[model]=${encodeURIComponent(model)}`);
    return res?.data ?? '';
  },
};