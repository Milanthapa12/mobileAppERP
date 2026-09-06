/**
 * API Configuration Constants
 * Centralized API endpoints and timeout settings for Logistics & ERP backend.
 */

export const DEFAULT_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.80:8000/api/v2025.1';

let activeBaseUrl = DEFAULT_BASE_URL;

function getHostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export const API_CONFIG = {
  get BASE_URL() {
    return activeBaseUrl;
  },
  set BASE_URL(url: string) {
    activeBaseUrl = url;
  },
  TIMEOUT: 15000, // 15 seconds
  get HEADERS() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Host': getHostFromUrl(activeBaseUrl),
    };
  },
};

export const API_ENDPOINTS = {
  AUTH: {
    DEVICE_LOGIN: '/auth/device/login',
    LOGOUT: '/auth/device/logout',
    ME: '/auth/device/me',
    SWITCH_BRANCH: '/auth/device/switch-branch',
  },
  ATTENDANCE: {
    TODAY: '/auth/device/attendance/today',
    PUNCH: '/auth/device/attendance/punch',
    HISTORY: '/auth/device/attendanceHistory',
  },
  SETTINGS: '/auth/device/settings',
  PROFILE: '/auth/device/profile',
  MY_PAYS: '/auth/device/my-pays',
  ATTENDANCE_REQUESTS: '/auth/device/attendance-requests',
  CODE_GENERATOR: '/auth/device/code-generator',
  LEAVE_CATEGORIES: '/auth/device/leave-categories',
  LEAVE_BALANCE: '/auth/device/leave-balance',
  LEAVE_BALANCES: '/auth/device/leave-balances',
  LEAVE_APPLICATIONS: '/auth/device/leave-application',
  TRAVEL_REQUESTS: '/auth/device/travel-requests',
  TRAVEL_MODES: '/auth/device/travel-mode-options',
};
