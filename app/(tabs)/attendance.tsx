import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAttendance } from '@/context/AttendanceContext';
import AppHeader from '@/components/AppHeader';
import ScreenWrapper from '@/components/ScreenWrapper';
import AttendancePanel from '@/components/AttendancePanel';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { attendanceService, AttendanceHistoryItem } from '@/services/api/attendanceService';
import { getStatusMeta } from '@/services/attendanceStatus';

const { width } = Dimensions.get('window');

interface MonthlyStat {
  month: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  offHoliday: number;
  worked: number;
  onTimePct: number;
  latePct: number;
  otDays: number;
  otSeconds: number;
}

export default function AttendanceScreen() {
  const {
    isLoading: todayLoading,
    refreshTodayStatus,
  } = useAttendance();
  const [activeSegment, setActiveSegment] = useState<'history' | 'map' | 'statistic'>('history');

  // ── History state ──────────────────────────────────────────
  const now = new Date();
  const [historyMonth, setHistoryMonth] = useState(now.getMonth() + 1); // 1-12
  const [historyYear,  setHistoryYear]  = useState(now.getFullYear());
  const [historyData,  setHistoryData]  = useState<AttendanceHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError,   setHistoryError]   = useState<string | null>(null);
  const [expandedRows,   setExpandedRows]   = useState<Set<string>>(new Set());

  const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  const fetchHistory = useCallback(async (year: number, month: number) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await attendanceService.getHistory(year, month);
      if (res?.data?.data) {
        setHistoryData(res.data.data);
      } else {
        setHistoryData([]);
      }
    } catch (err: any) {
      setHistoryError(err?.message || 'Failed to load attendance history.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSegment === 'history') {
      fetchHistory(historyYear, historyMonth);
    }
  }, [activeSegment, historyYear, historyMonth, fetchHistory]);

  const shiftMonth = (delta: number) => {
    let m = historyMonth + delta;
    let y = historyYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setHistoryMonth(m);
    setHistoryYear(y);
  };

  const toggleExpand = (date: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  // ── Statistic state & helpers ──────────────────────────────
  const [statsYear, setStatsYear] = useState(now.getFullYear());
  const [statsMonth, setStatsMonth] = useState(now.getMonth() + 1);
  const [yearStats, setYearStats] = useState<MonthlyStat[]>([]);
  const [statsLoadedFor, setStatsLoadedFor] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const computeMonthStat = (items: AttendanceHistoryItem[], month: number): MonthlyStat => {
    let present = 0, late = 0, absent = 0, leave = 0, offHoliday = 0, otDays = 0, otSeconds = 0;
    items.forEach((it) => {
      switch (it.status) {
        case 'present':
        case 'half_day':
        case 'punched':
          present++;
          break;
        case 'late':
          late++;
          break;
        case 'absent':
          absent++;
          break;
        case 'on_leave':
        case 'half_day_leave':
          leave++;
          break;
        case 'off':
        case 'holiday':
          offHoliday++;
          break;
        default:
          break;
      }
      if (it.overtime_seconds > 0) {
        otDays++;
        otSeconds += it.overtime_seconds;
      }
    });
    const worked = present + late;
    return {
      month,
      present,
      late,
      absent,
      leave,
      offHoliday,
      worked,
      onTimePct: worked > 0 ? Math.round((present / worked) * 100) : 0,
      latePct: worked > 0 ? Math.round((late / worked) * 100) : 0,
      otDays,
      otSeconds,
    };
  };

  const fetchYearStats = useCallback(async (year: number) => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const results: MonthlyStat[] = [];
      for (let m = 1; m <= 12; m++) {
        const res = await attendanceService.getHistory(year, m);
        results.push(computeMonthStat(res?.data?.data ?? [], m));
      }
      setYearStats(results);
      setStatsLoadedFor(year);
    } catch (err: any) {
      setStatsError(err?.message || 'Failed to load statistics.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const shiftStatsMonth = (delta: number) => {
    let m = statsMonth + delta;
    let y = statsYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setStatsMonth(m);
    if (y !== statsYear) setStatsYear(y);
  };

  // ── Status helpers ─────────────────────────────────────────
  const getStatusPillStyle = (status: string) => {
    const meta = getStatusMeta(status);
    return { bg: meta.bg, text: meta.text };
  };

  const getStatusLabel = (item: AttendanceHistoryItem): string => {
    if (item.event) return item.event.toUpperCase();
    switch (item.status) {
      case 'present':   return item.overtime_seconds > 0 ? `OVERTIME | ${item.ot_formatted}` : `${item.worked_formatted} worked`;
      case 'late':      return `LATE ${item.late_formatted} | ${item.worked_formatted} worked`;
      case 'absent':    return 'ABSENT';
      case 'holiday':   return item.holiday_name ? item.holiday_name.toUpperCase() : 'HOLIDAY';
      case 'off':       return 'OFF DAY';
      case 'on_leave':  return 'ON LEAVE';
      case 'half_day':  return `HALF DAY | ${item.worked_formatted} worked`;
      case 'half_day_leave': return 'HALF DAY LEAVE';
      case 'travel':    return 'TRAVEL';
      case 'training':  return 'TRAINING';
      case 'in_lieu':   return 'IN LIEU';
      case 'punched':   return 'MISSING CHECKOUT';
      default:          return item.status.replace('_', ' ').toUpperCase();
    }
  };

  useEffect(() => {
    if (activeSegment === 'statistic' && statsLoadedFor !== statsYear) {
      fetchYearStats(statsYear);
    }
  }, [activeSegment, statsYear, statsLoadedFor, fetchYearStats]);

  const handleSendReport = () => {
    const msg = 'Monthly attendance report sent to HR successfully!';
    if (Platform.OS === 'web') alert(msg);
    else Alert.alert('Report Sent', msg);
  };

  // ── Statistic derived values ───────────────────────────────
  const focusStat = yearStats.find((s) => s.month === statsMonth) ?? null;
  const prevStat = statsMonth > 1 ? yearStats.find((s) => s.month === statsMonth - 1) ?? null : null;
  const totalDays = focusStat
    ? focusStat.worked + focusStat.absent + focusStat.leave + focusStat.offHoliday
    : 0;
  const attendancePct =
    focusStat && totalDays > 0 ? Math.round((focusStat.worked / totalDays) * 100) : 0;
  const leaveOffPct =
    focusStat && totalDays > 0
      ? Math.round(((focusStat.leave + focusStat.offHoliday) / totalDays) * 100)
      : 0;
  const punctualityDiff =
    focusStat && prevStat && prevStat.worked > 0 ? focusStat.onTimePct - prevStat.onTimePct : null;

  const bars = yearStats.map((s) => ({
    m: monthNames[s.month - 1],
    h1: Math.round(s.onTimePct * 0.95),
    h2: Math.round(s.latePct * 0.95),
  }));

  const highlightPct =
    punctualityDiff !== null ? `${Math.abs(punctualityDiff)}%` : focusStat ? `${focusStat.onTimePct}%` : null;
  const bannerLead = !focusStat
    ? ''
    : punctualityDiff === null
    ? 'Your on-time rate is '
    : punctualityDiff >= 0
    ? 'Great! Your punctuality increased '
    : 'Heads up — your punctuality dropped ';
  const bannerTail = !focusStat
    ? 'Choose a month to see your punctuality.'
    : punctualityDiff === null
    ? '. Keep it up!'
    : ' from last month. Keep it up!';

  const otHoursText =
    focusStat && focusStat.otSeconds > 0
      ? focusStat.otSeconds / 3600 >= 1
        ? `${(focusStat.otSeconds / 3600).toFixed(1)} hrs`
        : `${Math.max(1, Math.round((focusStat.otSeconds / 3600) * 60))} min`
      : null;

  return (
    <ScreenWrapper>
      <AppHeader
        title={
          activeSegment === 'history'
            ? 'Attendance History'
            : activeSegment === 'map'
            ? 'Clock In / Location'
            : 'Attendance Statistic'
        }
      />

      {/* Segmented Sub-tabs */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === 'history' && styles.segmentBtnActive]}
          onPress={() => setActiveSegment('history')}
        >
          <Text style={[styles.segmentText, activeSegment === 'history' && styles.segmentTextActive]}>HISTORY</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === 'map' && styles.segmentBtnActive]}
          onPress={() => setActiveSegment('map')}
        >
          <Text style={[styles.segmentText, activeSegment === 'map' && styles.segmentTextActive]}>CLOCK IN</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === 'statistic' && styles.segmentBtnActive]}
          onPress={() => setActiveSegment('statistic')}
        >
          <Text style={[styles.segmentText, activeSegment === 'statistic' && styles.segmentTextActive]}>STATISTIC</Text>
        </TouchableOpacity>
      </View>

      {/* SEGMENT 1: HISTORY VIEW */}
      {activeSegment === 'history' && (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={historyLoading}
                onRefresh={() => fetchHistory(historyYear, historyMonth)}
                colors={['#0041E8']}
                tintColor="#0041E8"
              />
            }
          >

            {/* Month Navigator */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.monthNavBtn}>
                <Ionicons name="chevron-back" size={18} color="#0041E8" />
              </TouchableOpacity>
              <Text style={styles.filterDropdownText}>
                {monthNames[historyMonth - 1]}, {historyYear}
              </Text>
              <TouchableOpacity
                onPress={() => shiftMonth(1)}
                style={styles.monthNavBtn}
                disabled={historyYear === now.getFullYear() && historyMonth === now.getMonth() + 1}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={historyYear === now.getFullYear() && historyMonth === now.getMonth() + 1 ? '#CBD5E1' : '#0041E8'}
                />
              </TouchableOpacity>
            </View>

            {/* Loading */}
            {historyLoading && (
              <View style={styles.centerState}>
                <ActivityIndicator size="large" color="#0041E8" />
                <Text style={styles.centerStateText}>Loading history…</Text>
              </View>
            )}

            {/* Error */}
            {!historyLoading && historyError && (
              <View style={styles.centerState}>
                <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
                <Text style={[styles.centerStateText, { color: '#DC2626' }]}>{historyError}</Text>
                <TouchableOpacity
                  style={[styles.primaryActionButton, { marginTop: 12, paddingHorizontal: 24, height: 40 }]}
                  onPress={() => fetchHistory(historyYear, historyMonth)}
                >
                  <Text style={styles.primaryActionButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Empty state */}
            {!historyLoading && !historyError && historyData.length === 0 && (
              <View style={styles.centerState}>
                <Ionicons name="calendar-outline" size={40} color="#CBD5E1" />
                <Text style={styles.centerStateText}>No records for this month.</Text>
              </View>
            )}

            {/* History cards */}
            {!historyLoading && !historyError && historyData.map((item, idx) => {
              const isOffOrHoliday = ['off', 'holiday'].includes(item.status);
              const isAbsent = item.status === 'absent';
              const pill = getStatusPillStyle(item.status);
              const dayAbbr = item.day_name.slice(0, 3).toUpperCase();
              const isExpanded = expandedRows.has(item.log_date);
              // Format date nicely: '02 Sep, 2026'
              const dateObj = new Date(item.log_date + 'T00:00:00');
              const dateFormatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
              const segments = item.segments ?? [];

              const extraStats = !isOffOrHoliday && !isAbsent
                ? [
                    { label: 'Late In',   value: item.late_seconds > 0 ? item.late_formatted : '—',   color: '#D97706' },
                    { label: 'Early In',  value: (item.early_in_seconds ?? 0) > 0 ? item.early_in_formatted ?? '—' : '—', color: '#0284C7' },
                    { label: 'Late Out',  value: (item.late_out_seconds ?? 0) > 0 ? item.late_out_formatted ?? '—' : '—', color: '#DC2626' },
                    { label: 'Early Out', value: (item.early_exit_seconds ?? 0) > 0 ? item.early_formatted ?? '—' : '—', color: '#EA580C' },
                    { label: 'OT',        value: item.overtime_seconds > 0 ? item.ot_formatted : '—', color: '#2563EB' },
                  ]
                : [];

              return (
                <TouchableOpacity
                  key={item.log_date}
                  style={[styles.historyCard, isExpanded && styles.historyCardExpanded]}
                  activeOpacity={0.8}
                  onPress={() => toggleExpand(item.log_date)}
                >
                  <View style={styles.historyTopRow}>
                    <View style={styles.dayCol}>
                    <Text style={[
                      styles.dayName,
                      (isOffOrHoliday || isAbsent) && { color: '#94A3B8' },
                    ]}>{dayAbbr}</Text>
                    <Text style={styles.dayDate}>{dateFormatted}</Text>
                    {item.shift_name && (
                      <Text style={styles.shiftLabel}>{item.shift_name}</Text>
                    )}
                    {(item.segment_count ?? segments.length) > 1 && (
                      <View style={styles.segCountPill}>
                        <Text style={styles.segCountText}>{item.segment_count ?? segments.length}×</Text>
                      </View>
                    )}
                    <View style={styles.expandChevron}>
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
                    </View>
                  </View>

                  <View style={styles.detailsCol}>
                    {isOffOrHoliday ? (
                      <View style={styles.offDayBanner}>
                        <Text style={styles.offDayText}>
                          {item.status === 'holiday' && item.holiday_name ? item.holiday_name : (item.status === 'holiday' ? 'Holiday' : 'Off Day')}
                        </Text>
                      </View>
                    ) : isAbsent ? (
                      <View style={[styles.offDayBanner, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={[styles.offDayText, { color: '#DC2626' }]}>Absent</Text>
                      </View>
                    ) : (
                      <>
                        {/* Clock In row */}
                        <View style={styles.timeRow}>
                          <View style={[styles.timeDot, { backgroundColor: '#16A34A' }]}>
                            <Ionicons name="arrow-forward" size={10} color="#FFF" />
                          </View>
                          <View>
                            <Text style={styles.timeValue}>{item.actual_in ?? '—'}</Text>
                            <Text style={styles.locText}>{item.shift_working_hours ?? 'Mobile punch'}</Text>
                          </View>
                        </View>

                        {/* Clock Out row */}
                        <View style={styles.timeRow}>
                          <View style={[styles.timeDot, { backgroundColor: item.actual_out ? '#DC2626' : '#CBD5E1' }]}>
                            <Ionicons name="arrow-back" size={10} color="#FFF" />
                          </View>
                          <View>
                            <Text style={[styles.timeValue, !item.actual_out && { color: '#94A3B8' }]}>
                              {item.actual_out ?? 'not yet'}
                            </Text>
                            <Text style={styles.locText}>{item.shift_working_hours ?? 'Mobile punch'}</Text>
                          </View>
                        </View>

                        {/* Status pill */}
                        <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                          <Text style={[styles.statusPillText, { color: pill.text }]}>
                            {getStatusLabel(item)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                  </View>

                  {/* ── Expanded details ─────────────────────────── */}
                  {isExpanded && (
                    <View style={styles.expandedWrap}>
                      {item.is_flagged && (
                        <View style={styles.flagWarning}>
                          <Ionicons name="alert-circle" size={15} color="#DC2626" />
                          <Text style={styles.flagWarningText}>{item.flag_reason ?? 'Attendance flagged'}</Text>
                        </View>
                      )}

                      {/* Late / Early / OT statistics grid */}
                      {extraStats.length > 0 && (
                        <View style={styles.statGrid}>
                          {extraStats.map((s) => (
                            <View key={s.label} style={styles.statCell}>
                              <Text style={styles.statCellLabel}>{s.label}</Text>
                              <Text style={[styles.statCellValue, s.value === '—' ? { color: '#CBD5E1' } : { color: s.color }]}>
                                {s.value}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Punch segments */}
                      {segments.length > 0 && (
                        <View style={styles.segDetailCard}>
                          <View style={styles.segDetailHeader}>
                            <Text style={styles.segDetailTitle}>PUNCH DETAILS</Text>
                            <View style={styles.segDetailCount}>
                              <Text style={styles.segDetailCountText}>{segments.length}</Text>
                            </View>
                          </View>
                          {segments.map((s, i) => {
                            const isBreak = s.is_break || s.type === 'break';
                            return (
                              <View key={`${item.log_date}-seg-${i}`} style={styles.segRow}>
                                <View style={[styles.segRowDot, isBreak && styles.segRowDotBreak]}>
                                  <Ionicons name={isBreak ? 'cafe' : 'time'} size={12} color="#FFF" />
                                </View>
                                <View style={styles.segRowBody}>
                                  <View style={styles.segRowTop}>
                                    <Text style={[styles.segRowType, isBreak && styles.segRowTypeBreak]}>
                                      {isBreak ? 'Break' : `Punch ${i + 1}`}
                                    </Text>
                                    <Text style={styles.segRowTimes}>
                                      {s.segment_in ?? '—'} {'→'} {s.is_open ? <Text style={styles.segmentOngoing}>ongoing</Text> : (s.segment_out ?? '—')}
                                    </Text>
                                  </View>
                                  <View style={styles.segRowBottom}>
                                    <Text style={styles.segRowDuration}>{s.is_open ? 'In progress' : (s.duration_formatted ?? '—')}</Text>
                                    {(s.in_reason || s.out_reason) && (
                                      <Text style={styles.segRowReasons} numberOfLines={2}>
                                        {s.in_reason ? `In: ${s.in_reason}` : ''}
                                        {s.in_reason && s.out_reason ? ' · ' : ''}
                                        {s.out_reason ? `Out: ${s.out_reason}` : ''}
                                      </Text>
                                    )}
                                  </View>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Send Monthly Report Fixed Button */}
          <View style={styles.bottomBarFixed}>
            <TouchableOpacity
              style={styles.primaryActionButton}
              activeOpacity={0.88}
              onPress={handleSendReport}
            >
              <Text style={styles.primaryActionButtonText}>SEND MONTHLY REPORT</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SEGMENT 2: CLOCK-IN VIEW */}
      {activeSegment === 'map' && (
        <ScrollView
          contentContainerStyle={styles.clockScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={todayLoading}
              onRefresh={refreshTodayStatus}
              colors={['#0041E8']}
              tintColor="#0041E8"
            />
          }
        >
          <AttendancePanel />
        </ScrollView>
      )}

      {/* SEGMENT 3: STATISTIC VIEW */}
      {activeSegment === 'statistic' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Month / Year Navigator */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => shiftStatsMonth(-1)} style={styles.monthNavBtn}>
              <Ionicons name="chevron-back" size={18} color="#0041E8" />
            </TouchableOpacity>
            <Text style={styles.filterDropdownText}>
              {monthNames[statsMonth - 1]} {statsYear}
            </Text>
            <TouchableOpacity
              onPress={() => shiftStatsMonth(1)}
              style={styles.monthNavBtn}
              disabled={statsYear === now.getFullYear() && statsMonth === now.getMonth() + 1}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={
                  statsYear === now.getFullYear() && statsMonth === now.getMonth() + 1
                    ? '#CBD5E1'
                    : '#0041E8'
                }
              />
            </TouchableOpacity>
          </View>

          {/* Loading */}
          {statsLoading && (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color="#0041E8" />
              <Text style={styles.centerStateText}>Loading statistics…</Text>
            </View>
          )}

          {/* Error */}
          {!statsLoading && statsError && (
            <View style={styles.centerState}>
              <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
              <Text style={[styles.centerStateText, { color: '#DC2626' }]}>{statsError}</Text>
              <TouchableOpacity
                style={[styles.primaryActionButton, { marginTop: 12, paddingHorizontal: 24, height: 40 }]}
                onPress={() => fetchYearStats(statsYear)}
              >
                <Text style={styles.primaryActionButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {!statsLoading && !statsError && (
            <>
              {/* Punctuality Banner */}
              <View style={styles.punctualityBanner}>
                <View style={styles.bannerIconCircle}>
                  <Ionicons
                    name={punctualityDiff === null || punctualityDiff >= 0 ? 'trending-up' : 'trending-down'}
                    size={24}
                    color="#FFF"
                  />
                </View>
                <Text style={styles.bannerText}>
                  {bannerLead}
                  {highlightPct && <Text style={styles.bannerHighlight}>{highlightPct}</Text>}
                  {bannerTail}
                </Text>
              </View>

              {/* Monthly Bar Chart (real per-month data) */}
              <View style={styles.chartCard}>
                <Text style={styles.cardTitle}>Monthly Punctuality Overview ({statsYear})</Text>
                <View style={styles.barChartRow}>
                  {bars.map((item, idx) => (
                    <View key={idx} style={styles.barCol}>
                      <View style={styles.barTrack}>
                        <View style={[styles.barStackRed, { height: item.h2 }]} />
                        <View style={[styles.barStackBlue, { height: item.h1 }]} />
                      </View>
                      <Text
                        style={[
                          styles.barLabel,
                          item.m === monthNames[statsMonth - 1] && { color: '#0041E8', fontWeight: '800' },
                        ]}
                      >
                        {item.m}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Legend */}
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#0041E8' }]} />
                    <Text style={styles.legendText}>On Time</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
                    <Text style={styles.legendText}>Late</Text>
                  </View>
                </View>
              </View>

              {/* Attendance Statistic (real data) */}
              <View style={styles.statsCard}>
                <Text style={styles.cardTitle}>
                  Attendance Statistic — {monthNames[statsMonth - 1]} {statsYear}
                </Text>
                <View style={styles.ringsRow}>
                  {/* Attendance Ring */}
                  <View style={styles.ringCard}>
                    <View style={[styles.ringCircle, { borderColor: '#F43F5E' }]}>
                      <Text style={[styles.ringPercentText, { color: '#F43F5E' }]}>{attendancePct}%</Text>
                    </View>
                    <Text style={styles.ringTitle}>Attendance</Text>
                    <Text style={styles.ringSubApproved}>{focusStat?.worked ?? 0} Present</Text>
                    <Text style={styles.ringSubRejected}>{focusStat?.absent ?? 0} Absent</Text>
                  </View>

                  {/* Punctuality Ring */}
                  <View style={styles.ringCard}>
                    <View style={[styles.ringCircle, { borderColor: '#10B981' }]}>
                      <Text style={[styles.ringPercentText, { color: '#10B981' }]}>
                        {focusStat?.onTimePct ?? 0}%
                      </Text>
                    </View>
                    <Text style={styles.ringTitle}>Punctuality</Text>
                    <Text style={styles.ringSubApproved}>{focusStat?.present ?? 0} On time</Text>
                    <Text style={styles.ringSubRejected}>{focusStat?.late ?? 0} Late</Text>
                  </View>

                  {/* Leave & Off Ring */}
                  <View style={styles.ringCard}>
                    <View style={[styles.ringCircle, { borderColor: '#EAB308' }]}>
                      <Text style={[styles.ringPercentText, { color: '#EAB308' }]}>{leaveOffPct}%</Text>
                    </View>
                    <Text style={styles.ringTitle}>Leave & Off</Text>
                    <Text style={styles.ringSubApproved}>{focusStat?.leave ?? 0} Leave</Text>
                    <Text style={styles.ringSubRejected}>{focusStat?.offHoliday ?? 0} Off</Text>
                  </View>
                </View>

                {otHoursText && focusStat && (
                  <Text style={styles.otSummary}>
                    + {otHoursText} overtime across {focusStat.otDays} day
                    {focusStat.otDays === 1 ? '' : 's'}
                  </Text>
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    padding: 10,
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg,
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  segmentTextActive: {
    color: Colors.card,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90,
  },
  filterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterDropdownText: {
    color: '#0041E8',
    fontSize: 13,
    fontWeight: '700',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthNavBtn: {
    padding: 4,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 10,
  },
  centerStateText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
  },
  shiftLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 3,
    fontWeight: '500',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  historyTopRow: {
    flexDirection: 'row',
  },
  dayCol: {
    width: 85,
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    paddingRight: 10,
    justifyContent: 'center',
  },
  dayName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0041E8',
  },
  dayDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  detailsCol: {
    flex: 1,
    paddingLeft: 14,
    gap: 10,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  timeDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  locText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  statusPill: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0041E8',
  },
  offDayBanner: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  offDayText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  bottomBarFixed: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  primaryActionButton: {
    backgroundColor: '#0041E8',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0041E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  /* Clock-In View Styling */
  clockScrollContent: {
    paddingBottom: 24,
  },
  /* Map View Styling */
  mapContainer: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  mapGridBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E5E7EB',
  },
  mapRoad1: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-15deg' }],
  },
  mapRoad2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 28,
    backgroundColor: '#FFFFFF',
  },
  mapLandmark1: {
    position: 'absolute',
    top: '25%',
    right: '15%',
    backgroundColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mapLandmark2: {
    position: 'absolute',
    top: '12%',
    left: '20%',
    backgroundColor: '#CBD5E1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  landmarkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  timeBadgeFloating: {
    alignSelf: 'center',
    backgroundColor: '#0041E8',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  timeBadgeDate: {
    color: '#DBEAFE',
    fontSize: 11,
    fontWeight: '500',
  },
  timeBadgeClock: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  pinWrapper: {
    position: 'absolute',
    top: '42%',
    left: width / 2 - 40,
    alignItems: 'center',
  },
  pinRadarPulse: {
    position: 'absolute',
    top: -10,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 65, 232, 0.2)',
  },
  pinBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  pinLabel: {
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 6,
    elevation: 3,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  sheetTimeRow: {
    gap: 12,
  },
  sheetTimeBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  lateTag: {
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  /* Statistic View Styling */
  punctualityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0041E8',
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 16,
  },
  bannerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  bannerHighlight: {
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  barChartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingBottom: 8,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
  },
  barTrack: {
    width: 10,
    height: 95,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barStackBlue: {
    backgroundColor: '#0041E8',
    width: '100%',
  },
  barStackRed: {
    backgroundColor: '#DC2626',
    width: '100%',
  },
  barLabel: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 6,
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    elevation: 2,
  },
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  ringCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 14,
    marginHorizontal: 4,
    borderRadius: 14,
  },
  ringCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ringPercentText: {
    fontSize: 13,
    fontWeight: '800',
  },
  ringTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  ringSubApproved: {
    fontSize: 10,
    color: '#16A34A',
    fontWeight: '600',
  },
  ringSubRejected: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '600',
    marginTop: 2,
  },
  otSummary: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },

  /* Expandable history card detail styles */
  historyCardExpanded: {
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  segCountPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  segCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  expandChevron: {
    marginTop: 6,
  },
  expandedWrap: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  flagWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: Radius.md,
    padding: 10,
    marginBottom: 12,
  },
  flagWarningText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  statCell: {
    width: '46%',
    flexGrow: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  statCellLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  statCellValue: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  segDetailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    paddingTop: 10,
  },
  segDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  segDetailTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#64748B',
  },
  segDetailCount: {
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  segDetailCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  segRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  segRowDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  segRowDotBreak: {
    backgroundColor: '#F59E0B',
  },
  segRowBody: {
    flex: 1,
  },
  segRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  segRowType: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  segRowTypeBreak: {
    color: '#B45309',
  },
  segRowTimes: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  segRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 3,
  },
  segRowDuration: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  segmentOngoing: {
    color: '#B45309',
    fontWeight: '700',
  },
  segRowReasons: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 14,
    textAlign: 'right',
  },
});
