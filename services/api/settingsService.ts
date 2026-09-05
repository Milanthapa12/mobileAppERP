import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

export interface MobileSettings {
  setting?: {
    hrSettings?: Record<string, string> | null;
    organization?: { contactEmail?: string } | null;
    email?: { mail_from_address?: string } | null;
  };
}

export interface MobileSettingsResponse {
  status: string;
  data: MobileSettings;
}

export const settingsService = {
  async getSettings(): Promise<MobileSettingsResponse> {
    return apiClient.get<MobileSettingsResponse>(API_ENDPOINTS.SETTINGS);
  },
};