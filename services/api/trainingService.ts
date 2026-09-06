import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

export type TrainingRequestType = 'participate' | 'need';
export type TrainingMode = 'online' | 'offline' | 'hybrid';
export type DurationUnit = 'days' | 'hours';
export type ProviderType = 'internal' | 'external';

export interface OptionItem {
  value: number;
  label: string;
  is_default?: boolean;
}

export interface TrainingAttachment {
  id: number;
  file_name: string;
  url: string;
}

export interface TrainingRequestRecord {
  id: number;
  emp_id: number;
  code: string;
  request_type: TrainingRequestType;
  training_name: string;
  training_type_id: number;
  mode: string;
  short_description: string;
  // participate
  organized_by?: string | null;
  country_id?: number | null;
  place?: string | null;
  period_from?: string | null;
  period_to?: string | null;
  currency_id?: number | null;
  participation_cost?: number | null;
  // need
  duration_value?: number | null;
  duration_unit?: DurationUnit | null;
  provider_type?: ProviderType | null;
  provider_details?: string | null;
  status: string;
  allow_edit: boolean;
  allow_delete: boolean;
  employee?: { id: number; name: string } | null;
  training_type?: { id: number; name: string } | null;
  country?: { id: number; name: string } | null;
  currency?: { id: number; name: string; symbol: string } | null;
  attachments?: TrainingAttachment[] | null;
  created_at?: string | null;
}

export interface TrainingPayload {
  code: string;
  request_type: TrainingRequestType;
  training_name: string;
  training_type_id: number;
  mode: TrainingMode;
  short_description: string;
  // participate
  organized_by?: string | null;
  country_id?: number | null;
  place?: string | null;
  period_from?: string | null;
  period_to?: string | null;
  currency_id?: number | null;
  participation_cost?: number | null;
  // need
  duration_value?: number | null;
  duration_unit?: DurationUnit | null;
  provider_type?: ProviderType | null;
  provider_details?: string | null;
}

export interface TrainingListResponse {
  data?: TrainingRequestRecord[];
}

export interface TrainingShowResponse {
  status: string;
  data?: TrainingRequestRecord;
  approvalRequest?: any;
}

export interface TrainingOptionsResponse {
  status: string;
  data?: OptionItem[];
}

export interface MessageResponse {
  status: string;
  message?: string;
}

export interface TrainingDocumentFile {
  uri: string;
  name: string;
  type?: string | null;
  webFile?: File | null;
}

const isEmpty = (v: any): boolean => v === undefined || v === null || v === '';

function buildTrainingFormData(
  payload: TrainingPayload,
  document?: TrainingDocumentFile | null,
  id?: number | null
): FormData {
  const fd = new FormData();
  if (id != null) fd.append('id', String(id));
  fd.append('code', payload.code);
  fd.append('request_type', payload.request_type);
  fd.append('training_name', payload.training_name);
  fd.append('training_type_id', String(payload.training_type_id));
  fd.append('mode', payload.mode);
  fd.append('short_description', payload.short_description);
  if (!isEmpty(payload.organized_by)) fd.append('organized_by', String(payload.organized_by));
  if (!isEmpty(payload.country_id)) fd.append('country_id', String(payload.country_id));
  if (!isEmpty(payload.place)) fd.append('place', String(payload.place));
  if (!isEmpty(payload.period_from)) fd.append('period_from', String(payload.period_from));
  if (!isEmpty(payload.period_to)) fd.append('period_to', String(payload.period_to));
  if (!isEmpty(payload.currency_id)) fd.append('currency_id', String(payload.currency_id));
  if (!isEmpty(payload.participation_cost)) fd.append('participation_cost', String(payload.participation_cost));
  if (!isEmpty(payload.duration_value)) fd.append('duration_value', String(payload.duration_value));
  if (!isEmpty(payload.duration_unit)) fd.append('duration_unit', String(payload.duration_unit));
  if (!isEmpty(payload.provider_type)) fd.append('provider_type', String(payload.provider_type));
  if (!isEmpty(payload.provider_details)) fd.append('provider_details', String(payload.provider_details));
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

export const trainingService = {
  async list(): Promise<TrainingListResponse> {
    return apiClient.get<TrainingListResponse>(API_ENDPOINTS.TRAINING_REQUESTS);
  },

  async show(id: number): Promise<TrainingShowResponse> {
    return apiClient.get<TrainingShowResponse>(`${API_ENDPOINTS.TRAINING_REQUESTS}/${id}`);
  },

  async store(payload: TrainingPayload, document?: TrainingDocumentFile | null): Promise<MessageResponse> {
    const fd = buildTrainingFormData(payload, document);
    return apiClient.request<MessageResponse>(API_ENDPOINTS.TRAINING_REQUESTS, {
      method: 'POST',
      body: fd,
    });
  },

  async update(
    id: number,
    payload: TrainingPayload,
    document?: TrainingDocumentFile | null
  ): Promise<MessageResponse> {
    const fd = buildTrainingFormData(payload, document, id);
    return apiClient.request<MessageResponse>(`${API_ENDPOINTS.TRAINING_REQUESTS}/${id}`, {
      method: 'PATCH',
      body: fd,
    });
  },

  async destroy(id: number): Promise<MessageResponse> {
    return apiClient.delete<MessageResponse>(`${API_ENDPOINTS.TRAINING_REQUESTS}/${id}`);
  },

  async types(): Promise<TrainingOptionsResponse> {
    return apiClient.get<TrainingOptionsResponse>(API_ENDPOINTS.TRAINING_TYPES);
  },

  async countries(): Promise<TrainingOptionsResponse> {
    return apiClient.get<TrainingOptionsResponse>(API_ENDPOINTS.TRAINING_COUNTRIES);
  },

  async currencies(): Promise<TrainingOptionsResponse> {
    return apiClient.get<TrainingOptionsResponse>(API_ENDPOINTS.TRAINING_CURRENCIES);
  },

  async generateCode(): Promise<string> {
    const res = await apiClient.get<{ data?: string }>(
      `${API_ENDPOINTS.CODE_GENERATOR}?params[model]=${encodeURIComponent('training_request')}`
    );
    return res?.data ?? '';
  },
};