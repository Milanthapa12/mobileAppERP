import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

export interface PunchPayload {
  punch_type: 'in' | 'out';
  latitude?: number;
  longitude?: number;
  location_name?: string;
  reason?: string;
}

export interface TodayAttendanceData {
  log_date: string;
  actual_in: string | null;
  actual_out: string | null;
  worked_formatted?: string;
  late_formatted?: string;
  ot_formatted?: string;
  status: string;
  day_type?: string;
  is_off_day_punch?: boolean;
  holiday_name?: string | null;
  can_clock_in: boolean;
  can_clock_out: boolean;
  can_start_break?: boolean;
  can_end_break?: boolean;
  is_on_break?: boolean;
  shift_name?: string;
  shift_start_time?: string;
  end_start_time?: string;
  segments?: any[];
}

export interface TodayAttendanceResponse {
  status: string;
  data: TodayAttendanceData;
}

export interface PunchResponse {
  status: string;
  message: string;
  data: any;
}

export const attendanceService = {
  /**
   * Fetch today's attendance status and shift information
   */
  async getTodayStatus(): Promise<TodayAttendanceResponse> {
    return apiClient.get<TodayAttendanceResponse>(API_ENDPOINTS.ATTENDANCE.TODAY);
  },

  /**
   * Submit punch in / punch out request
   */
  async punch(payload: PunchPayload): Promise<PunchResponse> {
    return apiClient.post<PunchResponse>(API_ENDPOINTS.ATTENDANCE.PUNCH, payload);
  },
};
