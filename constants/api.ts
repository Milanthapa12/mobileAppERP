/**
 * API Configuration Constants
 * Centralized API endpoints and timeout settings for Logistics & ERP backend.
 */

export const DEFAULT_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.80:8000/api/v2025.1';

let activeBaseUrl = DEFAULT_BASE_URL;

export const API_CONFIG = {
  get BASE_URL() {
    return activeBaseUrl;
  },
  set BASE_URL(url: string) {
    activeBaseUrl = url;
  },
  TIMEOUT: 15000, // 15 seconds
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Host': 'logistics.test',
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
  LEAVE: {
    CATEGORIES: '/auth/device/leave-categories',
    BALANCE: (leaveId: number | string) => `/auth/device/leave-balance/${leaveId}`,
    INDEX: '/auth/device/leave-application',
    SHOW: (id: number | string) => `/auth/device/leave-application/${id}`,
    STORE: '/auth/device/leave-application',
    UPDATE: (id: number | string) => `/auth/device/leave-application/${id}`,
    DESTROY: (id: number | string) => `/auth/device/leave-application/${id}`,
  },
  ATTENDANCE_REQUEST: {
    MY_SHIFT: '/auth/device/attendance-requests/my-shift',
    INDEX: '/auth/device/attendance-requests',
    SHOW: (id: number | string) => `/auth/device/attendance-requests/${id}`,
    STORE: '/auth/device/attendance-requests',
    DESTROY: (id: number | string) => `/auth/device/attendance-requests/${id}`,
  },
};
