import { API_ENDPOINTS } from '@/constants/api';
import { apiClient } from './apiClient';

export interface PunchPayload {
  punch_type: 'in' | 'out';
  latitude?: number;
  longitude?: number;
  location_name?: string;
  reason?: string;
}

export interface AttendanceSegment {
  id?: number;
  segment_number?: number;
  type?: 'work' | 'break';
  is_break?: boolean;
  is_open?: boolean;
  segment_in?: string | null;
  segment_out?: string | null;
  duration_formatted?: string | null;
  in_reason?: string | null;
  out_reason?: string | null;
}

export type OffDayPunchFlag = boolean | number | string;

export interface TodayAttendanceData {
  log_date: string;
  actual_in: string | null;
  actual_out: string | null;
  worked_formatted?: string;
  late_formatted?: string;
  ot_formatted?: string;
  status: string;
  day_type?: string;
  is_off_day_punch?: OffDayPunchFlag;
  holiday_name?: string | null;
  can_clock_in: boolean;
  can_clock_out: boolean;
  can_start_break?: boolean;
  can_end_break?: boolean;
  is_on_break?: boolean;
  is_flagged?: boolean;
  flag_reason?: string | null;
  shift_name?: string;
  shift_start_time?: string;
  end_start_time?: string;
  segments?: AttendanceSegment[];
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

export interface AttendanceHistoryItem {
  id: number | null;
  employee_id: number;
  employee_name: string | null;
  log_date: string;        // 'YYYY-MM-DD'
  day_name: string;        // 'Monday', 'Tuesday', …
  shift_name: string | null;
  shift_working_hours: string | null;
  actual_in: string | null;   // 'HH:mm'
  actual_out: string | null;  // 'HH:mm'
  worked_formatted: string;
  late_formatted: string;
  ot_formatted: string;
  late_seconds: number;
  overtime_seconds: number;
  worked_seconds: number;
  status: string;           // 'present'|'late'|'absent'|'off'|'holiday'|'on_leave'|…
  day_type: string;         // 'working'|'off'|'holiday'
  holiday_name: string | null;
  event: string | null;     // 'Leave'|'Travel'|'Training'|null
  is_flagged: boolean;
  is_off_day_punch: boolean;
}

export interface AttendanceHistoryResponse {
  status: string;
  data: {
    data: AttendanceHistoryItem[];
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
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

  /**
   * Fetch paginated attendance history for the logged-in employee
   * @param year  4-digit year  (default: current year)
   * @param month 2-digit month (default: current month)
   * @param page  page number   (default: 1)
   */
  async getHistory(year?: number, month?: number, page = 1): Promise<AttendanceHistoryResponse> {
    const now = new Date();
    const y = year  ?? now.getFullYear();
    const m = month ?? (now.getMonth() + 1);
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to   = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const qs = `?from=${from}&to=${to}&page=${page}&per_page=50`;
    return apiClient.get<AttendanceHistoryResponse>(`${API_ENDPOINTS.ATTENDANCE.HISTORY}${qs}`);
  },
};
