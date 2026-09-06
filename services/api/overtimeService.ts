import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

export interface OvertimeAttachment {
  id: number;
  file_name: string;
  url: string;
}

export interface OvertimeRequestRecord {
  id: number;
  code: string;
  emp_id: number;
  overtime_date: string;
  from_time?: string | null;
  to_time?: string | null;
  number_of_hours?: string | null;
  reason: string;
  status: string;
  allow_edit: boolean;
  allow_delete: boolean;
  employee?: { id: number; name: string } | null;
  attachments?: OvertimeAttachment[] | null;
}

export interface OvertimePayload {
  code: string;
  overtime_date: string;
  from_time: string;
  to_time: string;
  number_of_hours?: string | null;
  reason: string;
}

export interface OvertimeListResponse {
  data?: OvertimeRequestRecord[];
}

export interface OvertimeShowResponse {
  status: string;
  data?: OvertimeRequestRecord;
  approvalRequest?: any;
}

export interface MessageResponse {
  status: string;
  message?: string;
}

export interface OvertimeDocumentFile {
  uri: string;
  name: string;
  type?: string | null;
  webFile?: File | null;
}

function buildOvertimeFormData(payload: OvertimePayload, document?: OvertimeDocumentFile | null): FormData {
  const fd = new FormData();
  fd.append('code', payload.code);
  fd.append('overtime_date', payload.overtime_date);
  fd.append('from_time', payload.from_time);
  fd.append('to_time', payload.to_time);
  fd.append('number_of_hours', payload.number_of_hours ?? '');
  fd.append('reason', payload.reason);
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

export const overtimeService = {
  async list(): Promise<OvertimeListResponse> {
    return apiClient.get<OvertimeListResponse>(API_ENDPOINTS.OVERTIME_REQUESTS);
  },

  async show(id: number): Promise<OvertimeShowResponse> {
    return apiClient.get<OvertimeShowResponse>(`${API_ENDPOINTS.OVERTIME_REQUESTS}/${id}`);
  },

  async store(payload: OvertimePayload, document?: OvertimeDocumentFile | null): Promise<MessageResponse> {
    const fd = buildOvertimeFormData(payload, document);
    return apiClient.request<MessageResponse>(API_ENDPOINTS.OVERTIME_REQUESTS, {
      method: 'POST',
      body: fd,
    });
  },

  async destroy(id: number): Promise<MessageResponse> {
    return apiClient.delete<MessageResponse>(`${API_ENDPOINTS.OVERTIME_REQUESTS}/${id}`);
  },

  async generateCode(): Promise<string> {
    const res = await apiClient.get<{ data?: string }>(
      `${API_ENDPOINTS.CODE_GENERATOR}?params[model]=${encodeURIComponent('overtime_request')}`
    );
    return res?.data ?? '';
  },
};