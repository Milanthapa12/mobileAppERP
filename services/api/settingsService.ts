import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

export interface ModuleAccess {
  is_logistic?: string | number;
  is_inventory?: string | number;
  is_account?: string | number;
  is_contract?: string | number;
  is_hr?: string | number;
  is_payroll?: string | number;
  is_administration?: string | number;
  is_crm?: string | number;
  is_procurement?: string | number;
  is_engineering?: string | number;
  is_setting?: string | number;
}

export interface MobileSettings {
  setting?: {
    hrSettings?: Record<string, string> | null;
    organization?: { contactEmail?: string } | null;
    email?: { mail_from_address?: string } | null;
  };
  featureSetting?: {
    moduleaccess?: ModuleAccess | null;
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