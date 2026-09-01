import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '@/constants/api';
import { DeviceLoginPayload, AuthApiResponse, User, Branch } from '@/types/auth';
import { Platform } from 'react-native';

export const authService = {
  /**
   * Device Login Endpoint: http://logistics.test/api/v2025.1/auth/device/login
   */
  async deviceLogin(payload: DeviceLoginPayload): Promise<AuthApiResponse> {
    const formattedPayload: DeviceLoginPayload = {
      email: payload.email.trim(),
      password: payload.password,
      device_name: payload.device_name || `Vritico ERP ${Platform.OS.toUpperCase()} App`,
      device_id: payload.device_id,
      ...(payload.branch_id ? { branch_id: payload.branch_id } : {}),
    };

    return await apiClient.post<AuthApiResponse>(
      API_ENDPOINTS.AUTH.DEVICE_LOGIN,
      formattedPayload,
      { skipAuth: true }
    );
  },

  /**
   * Device Logout Endpoint
   */
  async logout(): Promise<{ status: boolean; message?: string }> {
    try {
      return await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      console.warn('[authService] Logout API request soft fail:', error);
      return { status: true, message: 'Logged out locally' };
    }
  },

  /**
   * Fetch authenticated user details from /auth/device/me
   */
  async fetchMe(): Promise<any> {
    return await apiClient.get(API_ENDPOINTS.AUTH.ME);
  },

  /**
   * Switch Branch Context Endpoint
   */
  async switchBranch(branchId: number | string): Promise<any> {
    return await apiClient.post(API_ENDPOINTS.AUTH.SWITCH_BRANCH, { tenant_id: branchId });
  },
};
