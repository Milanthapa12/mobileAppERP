import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

export type TravelType = 'domestic' | 'international';

export interface TravelModeOption {
  value: number;
  label: string;
}

export interface TravelModeRef {
  id: number;
  name: string;
}

export interface TravelAttachment {
  id: number;
  file_name: string;
}

export interface TravelRequestRecord {
  id: number;
  code: string;
  emp_id: number;
  travel_name: string;
  travel_type: TravelType;
  departure_from: string;
  destination: string;
  departure_date: string;
  arrival_date: string;
  departure_time?: string | null;
  arrival_time?: string | null;
  advance_amount?: number | null;
  purpose_of_travel?: string | null;
  status: string;
  allow_edit: boolean;
  allow_delete: boolean;
  employee?: { id: number; name: string } | null;
  travel_modes?: TravelModeRef[] | null;
  travel_mode_ids?: number[] | null;
  attachments?: TravelAttachment[] | null;
  created_at?: string | null;
}

export interface TravelPayload {
  code: string;
  travel_name: string;
  travel_type: TravelType;
  departure_from: string;
  destination: string;
  departure_date: string;
  arrival_date: string;
  departure_time?: string | null;
  arrival_time?: string | null;
  advance_amount?: number | null;
  purpose_of_travel?: string | null;
  travel_mode_ids: number[];
}

export interface TravelListResponse {
  data?: TravelRequestRecord[];
}

export interface TravelShowResponse {
  status: string;
  data?: TravelRequestRecord;
  approvalRequest?: any;
}

export interface TravelModesResponse {
  status: string;
  data?: TravelModeOption[];
}

export interface MessageResponse {
  status: string;
  message?: string;
}

export interface TravelDocumentFile {
  uri: string;
  name: string;
  type?: string | null;
  webFile?: File | null;
}

function buildTravelFormData(payload: TravelPayload, document?: TravelDocumentFile | null): FormData {
  const fd = new FormData();
  fd.append('code', payload.code);
  fd.append('travel_name', payload.travel_name);
  fd.append('travel_type', payload.travel_type);
  fd.append('departure_from', payload.departure_from);
  fd.append('destination', payload.destination);
  fd.append('departure_date', payload.departure_date);
  fd.append('arrival_date', payload.arrival_date);
  fd.append('advance_amount', String(payload.advance_amount ?? 0));
  if (payload.departure_time) fd.append('departure_time', payload.departure_time);
  if (payload.arrival_time) fd.append('arrival_time', payload.arrival_time);
  if (payload.purpose_of_travel) fd.append('purpose_of_travel', payload.purpose_of_travel);
  (payload.travel_mode_ids ?? []).forEach((id, i) => {
    fd.append(`travel_mode_ids[${i}]`, String(id));
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

export const travelService = {
  async list(): Promise<TravelListResponse> {
    return apiClient.get<TravelListResponse>(API_ENDPOINTS.TRAVEL_REQUESTS);
  },

  async show(id: number): Promise<TravelShowResponse> {
    return apiClient.get<TravelShowResponse>(`${API_ENDPOINTS.TRAVEL_REQUESTS}/${id}`);
  },

  async store(payload: TravelPayload, document?: TravelDocumentFile | null): Promise<MessageResponse> {
    const fd = buildTravelFormData(payload, document);
    return apiClient.request<MessageResponse>(API_ENDPOINTS.TRAVEL_REQUESTS, {
      method: 'POST',
      body: fd,
    });
  },

  async update(
    id: number,
    payload: TravelPayload,
    document?: TravelDocumentFile | null
  ): Promise<MessageResponse> {
    const fd = buildTravelFormData(payload, document);
    fd.append('id', String(id));
    return apiClient.request<MessageResponse>(`${API_ENDPOINTS.TRAVEL_REQUESTS}/${id}`, {
      method: 'PATCH',
      body: fd,
    });
  },

  async destroy(id: number): Promise<MessageResponse> {
    return apiClient.delete<MessageResponse>(`${API_ENDPOINTS.TRAVEL_REQUESTS}/${id}`);
  },

  async modes(): Promise<TravelModesResponse> {
    return apiClient.get<TravelModesResponse>(API_ENDPOINTS.TRAVEL_MODES);
  },

  async generateCode(): Promise<string> {
    const res = await apiClient.get<{ data?: string }>(
      `${API_ENDPOINTS.CODE_GENERATOR}?params[model]=${encodeURIComponent('travel_request')}`
    );
    return res?.data ?? '';
  },
};