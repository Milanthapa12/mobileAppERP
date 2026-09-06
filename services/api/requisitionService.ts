import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

export interface RequisitionItem {
  id: number;
  product_id: number;
  product_name: string;
  unit_id: number | null;
  unit_symbol: string | null;
  quantity: number;
  description: string;
}

export interface RequisitionRecord {
  id: number;
  req_number: string;
  contact_name?: string | null;
  date?: string | null;
  creator_name?: string | null;
  updater_name?: string | null;
  requested_to_name?: string | null;
  status?: string | null;
  allow_edit: boolean;
  allow_delete: boolean;
}

export interface RequisitionProductPayload {
  id?: number;
  product_id: number;
  quantity: number;
  unit_id: number | null;
  description?: string;
}

export interface RequisitionPayload {
  req_number: string;
  requested_to: number;
  date?: string | null;
  notes?: string | null;
  special_instruction?: string | null;
  products: RequisitionProductPayload[];
}

export interface OptionItem {
  value: number;
  label: string;
}

export interface RequisitionListResponse {
  data?: RequisitionRecord[];
}

export interface RequisitionShowResponse {
  status: string;
  data?: RequisitionRecord;
  approvalRequest?: any;
}

export interface RequisitionItemsResponse {
  status?: string;
  data?: RequisitionItem[];
}

export interface MessageResponse {
  status: string;
  message?: string;
}

export const requisitionService = {
  async list(): Promise<RequisitionListResponse> {
    return apiClient.get<RequisitionListResponse>(API_ENDPOINTS.REQUISITIONS);
  },

  async show(id: number): Promise<RequisitionShowResponse> {
    return apiClient.get<RequisitionShowResponse>(`${API_ENDPOINTS.REQUISITIONS}/${id}`);
  },

  async items(id: number): Promise<RequisitionItemsResponse> {
    return apiClient.get<RequisitionItemsResponse>(`${API_ENDPOINTS.REQUISITIONS}/${id}/items`);
  },

  async store(payload: RequisitionPayload): Promise<MessageResponse> {
    return apiClient.post<MessageResponse>(API_ENDPOINTS.REQUISITIONS, payload);
  },

  async update(id: number, payload: RequisitionPayload): Promise<MessageResponse> {
    return apiClient.patch<MessageResponse>(`${API_ENDPOINTS.REQUISITIONS}/${id}`, payload);
  },

  async destroy(id: number): Promise<MessageResponse> {
    return apiClient.delete<MessageResponse>(`${API_ENDPOINTS.REQUISITIONS}/${id}`);
  },

  async generateCode(): Promise<string> {
    const res = await apiClient.get<{ data?: string }>(
      `${API_ENDPOINTS.CODE_GENERATOR}?params[model]=${encodeURIComponent('requisition')}`
    );
    return res?.data ?? '';
  },

  async userOptions(): Promise<OptionItem[]> {
    const res = await apiClient.get<{ data?: OptionItem[] }>(API_ENDPOINTS.REQUISITION_USER_OPTIONS);
    return res?.data ?? [];
  },

  async productOptions(): Promise<OptionItem[]> {
    const res = await apiClient.get<{ data?: OptionItem[] }>(API_ENDPOINTS.REQUISITION_PRODUCT_OPTIONS);
    return res?.data ?? [];
  },

  async unitOptions(): Promise<OptionItem[]> {
    const res = await apiClient.get<{ data?: OptionItem[] }>(API_ENDPOINTS.REQUISITION_UNIT_OPTIONS);
    return res?.data ?? [];
  },
};