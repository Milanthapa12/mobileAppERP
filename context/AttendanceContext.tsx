import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { attendanceService, TodayAttendanceData } from '@/services/api/attendanceService';
import { getPunchLocation } from '@/services/location/geolocation';
import { useAuth } from '@/hooks/useAuth';

export type PunchResult = {
  message: string;
  warning?: string;
};

type AttendanceContextType = {
  isCheckedIn: boolean;
  timeIn: string | null;
  timeOut: string | null;
  totalHours: string;
  isLoading: boolean;
  error: string | null;
  todayData: TodayAttendanceData | null;
  refreshTodayStatus: () => Promise<void>;
  punchClockIn: (reason?: string) => Promise<PunchResult>;
  punchClockOut: (reason?: string) => Promise<PunchResult>;
  punchBreak: (type: 'in' | 'out') => Promise<PunchResult>;
  toggleClockIn: (reason?: string) => Promise<void>;
};

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export const AttendanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [timeIn, setTimeIn] = useState<string | null>(null);
  const [timeOut, setTimeOut] = useState<string | null>(null);
  const [totalHours, setTotalHours] = useState('00 H 00 M');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todayData, setTodayData] = useState<TodayAttendanceData | null>(null);

  const refreshTodayStatus = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await attendanceService.getTodayStatus();
      if (res && res.data) {
        const data = res.data;
        setTodayData(data);
        setIsCheckedIn(data.can_clock_out);
        setTimeIn(data.actual_in || null);
        setTimeOut(data.actual_out || null);
        if (data.worked_formatted) {
          setTotalHours(data.worked_formatted);
        }
      }
    } catch (err: any) {
      console.warn('[AttendanceContext] Today attendance fetch warning:', err?.message);
      setError(err?.message || 'Failed to fetch attendance status');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshTodayStatus();
    } else {
      setIsCheckedIn(false);
      setTimeIn(null);
      setTimeOut(null);
      setTotalHours('00 H 00 M');
      setTodayData(null);
    }
  }, [isAuthenticated, refreshTodayStatus]);

  const performPunch = useCallback(async (
    punchType: 'in' | 'out',
    kind: 'work' | 'break',
    reason?: string
  ): Promise<PunchResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const location = await getPunchLocation();

      const finalReason =
        kind === 'break'
          ? 'break'
          : reason?.trim() ||
            (punchType === 'in'
              ? 'Clocked in via Vritico ERP Mobile'
              : 'Clocked out via Vritico ERP Mobile');

      const res = await attendanceService.punch({
        punch_type: punchType,
        latitude: location.latitude,
        longitude: location.longitude,
        location_name: location.location_name,
        reason: finalReason,
      });

      await refreshTodayStatus();
      return {
        message: res?.message || (kind === 'break' ? 'Break punch saved' : 'Punch saved'),
        warning: res?.data?.warning,
      };
    } catch (err: any) {
      const msg = err?.message || `Failed to punch ${punchType}.`;
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [refreshTodayStatus]);

  const punchClockIn = useCallback(
    async (reason?: string) => performPunch('in', 'work', reason),
    [performPunch]
  );

  const punchClockOut = useCallback(
    async (reason?: string) => performPunch('out', 'work', reason),
    [performPunch]
  );

  const punchBreak = useCallback(
    async (type: 'in' | 'out') => performPunch(type, 'break'),
    [performPunch]
  );

  const toggleClockIn = useCallback(
    async (reason?: string) => {
      await performPunch(isCheckedIn ? 'out' : 'in', 'work', reason);
    },
    [isCheckedIn, performPunch]
  );

  return (
    <AttendanceContext.Provider
      value={{
        isCheckedIn,
        timeIn: timeIn || '--:--',
        timeOut: timeOut || 'not yet',
        totalHours,
        isLoading,
        error,
        todayData,
        refreshTodayStatus,
        punchClockIn,
        punchClockOut,
        punchBreak,
        toggleClockIn,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};

export const useAttendance = () => {
  const context = useContext(AttendanceContext);
  if (!context) {
    throw new Error('useAttendance must be used within an AttendanceProvider');
  }
  return context;
};