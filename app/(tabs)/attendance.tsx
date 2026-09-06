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
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAttendance } from '@/context/AttendanceContext';
import AppHeader from '@/components/AppHeader';
import ScreenWrapper from '@/components/ScreenWrapper';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useLiveClock } from '@/hooks/useLiveClock';
import { attendanceService, AttendanceHistoryItem } from '@/services/api/attendanceService';
import {
  attendanceRequestService,
  AttendanceRequest,
  ShiftOption,
} from '@/services/api/attendanceRequestService';

const { width } = Dimensions.get('window');

export default function AttendanceScreen() {
  const { isCheckedIn, timeIn, timeOut, totalHours, toggleClockIn } = useAttendance();
  const [activeSegment, setActiveSegment] = useState<'history' | 'map' | 'statistic' | 'requests'>('history');

  // ── History state ──────────────────────────────────────────
  const now = new Date();
  const [historyMonth, setHistoryMonth] = useState(now.getMonth() + 1); // 1-12
  const [historyYear,  setHistoryYear]  = useState(now.getFullYear());
  const [historyData,  setHistoryData]  = useState<AttendanceHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError,   setHistoryError]   = useState<string | null>(null);

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

  // ── Attendance Requests state ──────────────────────────────────────────────
  const [requestsData, setRequestsData] = useState<AttendanceRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [myShift, setMyShift] = useState<ShiftOption | null>(null);

  // Submit modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqDate, setReqDate] = useState('');
  const [reqCheckIn, setReqCheckIn] = useState('');
  const [reqCheckOut, setReqCheckOut] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    setRequestsError(null);
    try {
      const [listRes, shiftRes] = await Promise.all([
        attendanceRequestService.getList(),
        attendanceRequestService.getMyShift(),
      ]);
      setRequestsData(Array.isArray(listRes?.data) ? listRes.data : []);
      setMyShift(shiftRes?.data ?? null);
    } catch (err: any) {
      setRequestsError(err?.message || 'Failed to load attendance requests.');
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSegment === 'requests') fetchRequests();
  }, [activeSegment, fetchRequests]);

  const handleSubmitRequest = async () => {
    if (!reqDate) {
      const m = 'Please enter the date (YYYY-MM-DD).';
      Platform.OS === 'web' ? alert(m) : Alert.alert('Required', m);
      return;
    }
    if (!reqReason.trim()) {
      const m = 'Please enter a reason.';
      Platform.OS === 'web' ? alert(m) : Alert.alert('Required', m);
      return;
    }
    setReqSubmitting(true);
    try {
      await attendanceRequestService.submit({
        code: `AR-${Date.now()}`,
        shift_id: myShift?.value ?? null,
        reason: reqReason.trim(),
        days: [{
          date: reqDate,
          punches: [{
            check_in: reqCheckIn || null,
            check_out: reqCheckOut || null,
          }],
        }],
      });
      setShowRequestModal(false);
      setReqDate(''); setReqCheckIn(''); setReqCheckOut(''); setReqReason('');
      const ok = 'Attendance request submitted successfully!';
      Platform.OS === 'web' ? alert(ok) : Alert.alert('Success', ok);
      await fetchRequests();
    } catch (err: any) {
      const m = err?.message || 'Failed to submit request.';
      Platform.OS === 'web' ? alert(m) : Alert.alert('Error', m);
    } finally {
      setReqSubmitting(false);
    }
  };

  const handleDeleteRequest = (id: number) => {
    const doDelete = async () => {
      try {
        await attendanceRequestService.remove(id);
        setRequestsData(prev => prev.filter(r => r.id !== id));
      } catch (err: any) {
        const m = err?.message || 'Failed to withdraw request.';
        Platform.OS === 'web' ? alert(m) : Alert.alert('Error', m);
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Withdraw this attendance request?')) doDelete();
    } else {
      Alert.alert('Withdraw', 'Remove this attendance request?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Withdraw', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  function reqStatusStyle(status: string) {
    switch (status) {
      case 'approved':  return { bg: '#DCFCE7', text: '#16A34A' };
      case 'rejected':  return { bg: '#FEE2E2', text: '#DC2626' };
      case 'in_review': return { bg: '#EDE9FE', text: '#7C3AED' };
      default:          return { bg: '#FEF3C7', text: '#D97706' };
    }
  }

  const shiftMonth = (delta: number) => {
    let m = historyMonth + delta;
    let y = historyYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setHistoryMonth(m);
    setHistoryYear(y);
  };

  // ── Status helpers ─────────────────────────────────────────
  const getStatusPillStyle = (status: string) => {
    switch (status) {
      case 'late':          return { bg: '#FEE2E2', text: '#DC2626' };
      case 'absent':        return { bg: '#FEE2E2', text: '#DC2626' };
      case 'holiday':       return { bg: '#ECFDF5', text: '#059669' };
      case 'off':           return { bg: '#F1F5F9', text: '#64748B' };
      case 'on_leave':      return { bg: '#EFF6FF', text: '#2563EB' };
      case 'half_day_leave':return { bg: '#FFF7ED', text: '#EA580C' };
      case 'travel':        return { bg: '#EFF6FF', text: '#0284C7' };
      case 'training':      return { bg: '#F5F3FF', text: '#7C3AED' };
      default:              return { bg: '#F0FDF4', text: '#16A34A' }; // present
    }
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

  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());

  const { timeStr, dateStr } = useLiveClock('24h');

  const handleRecordClockIn = async () => {
    const actionType = isCheckedIn ? 'out' : 'in';
    try {
      await toggleClockIn();
      const msg = actionType === 'in'
        ? `Clocked in successfully!`
        : `Clocked out successfully!`;
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err?.message || `Failed to punch ${actionType}.`;
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Punch Error', msg);
    }
  };

  const handleSendReport = () => {
    const msg = 'Monthly attendance report sent to HR successfully!';
    if (Platform.OS === 'web') alert(msg);
    else Alert.alert('Report Sent', msg);
  };

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
          style={[styles.segmentBtn, activeSegment === 'requests' && styles.segmentBtnActive]}
          onPress={() => setActiveSegment('requests')}
        >
          <Text style={[styles.segmentText, activeSegment === 'requests' && styles.segmentTextActive]}>REQUESTS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === 'statistic' && styles.segmentBtnActive]}
          onPress={() => setActiveSegment('statistic')}
        >
          <Text style={[styles.segmentText, activeSegment === 'statistic' && styles.segmentTextActive]}>STATS</Text>
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
              // Format date nicely: '02 Sep, 2026'
              const dateObj = new Date(item.log_date + 'T00:00:00');
              const dateFormatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

              return (
                <View key={item.log_date} style={styles.historyCard}>
                  <View style={styles.dayCol}>
                    <Text style={[
                      styles.dayName,
                      (isOffOrHoliday || isAbsent) && { color: '#94A3B8' },
                    ]}>{dayAbbr}</Text>
                    <Text style={styles.dayDate}>{dateFormatted}</Text>
                    {item.shift_name && (
                      <Text style={styles.shiftLabel}>{item.shift_name}</Text>
                    )}
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

      {/* SEGMENT 2: MAP CLOCK-IN VIEW */}
      {activeSegment === 'map' && (
        <View style={{ flex: 1 }}>
          {/* Simulated Map Workspace */}
          <View style={styles.mapContainer}>
            <View style={styles.mapGridBackground}>
              {/* Map Road Graphics */}
              <View style={styles.mapRoad1} />
              <View style={styles.mapRoad2} />
              <View style={styles.mapLandmark1}>
                <Text style={styles.landmarkText}>Jakarta Pusat</Text>
              </View>
              <View style={styles.mapLandmark2}>
                <Text style={styles.landmarkText}>Monumen Nasional</Text>
              </View>
            </View>

            {/* Top Floating Time Pin */}
            <View style={styles.timeBadgeFloating}>
              <Text style={styles.timeBadgeDate}>{dateStr}</Text>
              <Text style={styles.timeBadgeClock}>{timeStr}</Text>
            </View>

            {/* Central Radar Location Pin */}
            <View style={styles.pinWrapper}>
              <View style={styles.pinRadarPulse} />
              <View style={styles.pinBubble}>
                <Ionicons name="location" size={24} color="#FFF" />
              </View>
              <Text style={styles.pinLabel}>Theresa Jakarta (HQ)</Text>
            </View>
          </View>

          {/* Bottom Attendance Card Sheet */}
          <View style={styles.bottomSheet}>
            <View style={styles.sheetTimeRow}>
              <View style={styles.sheetTimeBlock}>
                <View style={[styles.timeDot, { backgroundColor: '#16A34A' }]}>
                  <Ionicons name="arrow-forward" size={10} color="#FFF" />
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.timeValue}>{timeIn}</Text>
                    {isCheckedIn && <Text style={styles.lateTag}>Checked In</Text>}
                  </View>
                  <Text style={styles.locText}>Thamrin City Lantai 7 Unit OS 01 A-B, Kebon Kacang...</Text>
                </View>
              </View>

              <View style={styles.sheetTimeBlock}>
                <View style={[styles.timeDot, { backgroundColor: timeOut !== 'not yet' ? '#DC2626' : '#CBD5E1' }]}>
                  <Ionicons name="ellipse-outline" size={10} color="#FFF" />
                </View>
                <View>
                  <Text style={[styles.timeValue, { color: timeOut !== 'not yet' ? '#DC2626' : '#94A3B8' }]}>
                    {timeOut}
                  </Text>
                  <Text style={styles.locText}>Thamrin City Lantai 7 Unit OS 01 A-B, Kebon Kacang...</Text>
                </View>
              </View>

              <View style={[styles.statusPill, { backgroundColor: '#E0F2FE', marginTop: 4 }]}>
                <Text style={[styles.statusPillText, { color: '#0284C7' }]}>{totalHours}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryActionButton,
                  isCheckedIn && { backgroundColor: '#DC2626' },
                ]}
                activeOpacity={0.88}
                onPress={handleRecordClockIn}
              >
                <Text style={styles.primaryActionButtonText}>
                  {!isCheckedIn ? 'RECORD / CLOCK IN' : 'CLOCK OUT'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* SEGMENT 3: STATISTIC VIEW */}
      {activeSegment === 'statistic' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Year Filter */}
          <TouchableOpacity style={styles.filterDropdown} activeOpacity={0.8}>
            <Ionicons name="calendar-outline" size={18} color="#0041E8" />
            <Text style={styles.filterDropdownText}>{selectedYear}</Text>
            <Ionicons name="chevron-down" size={16} color="#0041E8" />
          </TouchableOpacity>

          {/* Inspirational Punctuality Banner */}
          <View style={styles.punctualityBanner}>
            <View style={styles.bannerIconCircle}>
              <Ionicons name="trending-up" size={24} color="#FFF" />
            </View>
            <Text style={styles.bannerText}>
              It is great! Your punctuality increased <Text style={styles.bannerHighlight}>10%</Text> from last
              month. Keep it up!
            </Text>
          </View>

          {/* Monthly Bar Chart */}
          <View style={styles.chartCard}>
            <Text style={styles.cardTitle}>Monthly Punctuality Overview</Text>
            <View style={styles.barChartRow}>
              {[
                { m: 'Jan', h1: 65, h2: 30 },
                { m: 'Feb', h1: 85, h2: 15 },
                { m: 'Mar', h1: 50, h2: 20 },
                { m: 'Apr', h1: 70, h2: 10 },
                { m: 'May', h1: 40, h2: 25 },
                { m: 'Jun', h1: 60, h2: 15 },
                { m: 'Jul', h1: 75, h2: 20 },
                { m: 'Aug', h1: 80, h2: 10 },
                { m: 'Sep', h1: 65, h2: 15 },
                { m: 'Oct', h1: 70, h2: 10 },
                { m: 'Nov', h1: 60, h2: 20 },
                { m: 'Dec', h1: 90, h2: 10 },
              ].map((item, idx) => (
                <View key={idx} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View style={[styles.barStackRed, { height: item.h2 }]} />
                    <View style={[styles.barStackBlue, { height: item.h1 }]} />
                  </View>
                  <Text style={styles.barLabel}>{item.m}</Text>
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
                <Text style={styles.legendText}>Late / Overtime</Text>
              </View>
            </View>
          </View>

          {/* Approved Request Statistic Section */}
          <View style={styles.statsCard}>
            <Text style={styles.cardTitle}>Approved Request Statistic</Text>
            <View style={styles.ringsRow}>
              {/* Leave Ring */}
              <View style={styles.ringCard}>
                <View style={[styles.ringCircle, { borderColor: '#F43F5E' }]}>
                  <Text style={[styles.ringPercentText, { color: '#F43F5E' }]}>70%</Text>
                </View>
                <Text style={styles.ringTitle}>Leave</Text>
                <Text style={styles.ringSubApproved}>20 Approved</Text>
                <Text style={styles.ringSubRejected}>8 Rejected</Text>
              </View>

              {/* Overtime Ring */}
              <View style={styles.ringCard}>
                <View style={[styles.ringCircle, { borderColor: '#10B981' }]}>
                  <Text style={[styles.ringPercentText, { color: '#10B981' }]}>70%</Text>
                </View>
                <Text style={styles.ringTitle}>Overtime</Text>
                <Text style={styles.ringSubApproved}>12 Approved</Text>
                <Text style={styles.ringSubRejected}>4 Rejected</Text>
              </View>

              {/* Claim Ring */}
              <View style={styles.ringCard}>
                <View style={[styles.ringCircle, { borderColor: '#EAB308' }]}>
                  <Text style={[styles.ringPercentText, { color: '#EAB308' }]}>100%</Text>
                </View>
                <Text style={styles.ringTitle}>Claim</Text>
                <Text style={styles.ringSubApproved}>12 Approved</Text>
                <Text style={styles.ringSubRejected}>0 Rejected</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
      {/* SEGMENT 4: ATTENDANCE REQUESTS */}
      {activeSegment === 'requests' && (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={requestsLoading} onRefresh={fetchRequests} tintColor="#0041E8" />
            }
          >
            {/* Error */}
            {requestsError && (
              <View style={[styles.centerState, { paddingVertical: 24 }]}>
                <Ionicons name="alert-circle-outline" size={36} color="#DC2626" />
                <Text style={[styles.centerStateText, { color: '#DC2626' }]}>{requestsError}</Text>
              </View>
            )}

            {/* Shift info */}
            {myShift && (
              <View style={styles.shiftInfoBanner}>
                <Ionicons name="time-outline" size={16} color="#0041E8" />
                <Text style={styles.shiftInfoText}>Your Shift: {myShift.label}</Text>
              </View>
            )}

            {/* Submit button */}
            <TouchableOpacity
              style={styles.primaryActionButton}
              activeOpacity={0.88}
              onPress={() => setShowRequestModal(true)}
            >
              <Text style={styles.primaryActionButtonText}>+ NEW ATTENDANCE REQUEST</Text>
            </TouchableOpacity>

            {/* Request list */}
            {!requestsLoading && !requestsError && requestsData.length === 0 && (
              <View style={styles.centerState}>
                <Ionicons name="document-text-outline" size={40} color="#CBD5E1" />
                <Text style={styles.centerStateText}>No attendance requests yet.</Text>
              </View>
            )}

            {!requestsLoading && !requestsError && requestsData.map((req) => {
              const sc = reqStatusStyle(req.status);
              return (
                <View key={req.id} style={[styles.historyCard, { marginBottom: 12 }]}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', flex: 1, marginRight: 8 }} numberOfLines={1}>
                        {req.code}
                      </Text>
                      <View style={[styles.statusPill, { backgroundColor: sc.bg, marginTop: 0, paddingVertical: 4, paddingHorizontal: 10 }]}>
                        <Text style={[styles.statusPillText, { color: sc.text, fontSize: 11 }]}>
                          {req.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                      </View>
                    </View>
                    {req.days && req.days.length > 0 && (
                      <Text style={{ fontSize: 12, color: '#0041E8', fontWeight: '600' }}>
                        {req.days.map(d => d.date).join(', ')}
                      </Text>
                    )}
                    <Text style={{ fontSize: 12, color: '#64748B' }} numberOfLines={2}>{req.reason}</Text>
                    {req.status === 'pending' && (
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 }}
                        onPress={() => handleDeleteRequest(req.id)}
                      >
                        <Ionicons name="trash-outline" size={14} color="#DC2626" />
                        <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '600' }}>Withdraw</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Attendance Request Modal */}
      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attendance Request</Text>
              <TouchableOpacity onPress={() => setShowRequestModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Date *</Text>
              <TextInput
                style={styles.modalInput}
                value={reqDate}
                onChangeText={setReqDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                keyboardType="numbers-and-punctuation"
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Check In</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={reqCheckIn}
                    onChangeText={setReqCheckIn}
                    placeholder="HH:MM"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Check Out</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={reqCheckOut}
                    onChangeText={setReqCheckOut}
                    placeholder="HH:MM"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              {myShift && (
                <View style={[styles.shiftInfoBanner, { marginBottom: 16 }]}>
                  <Ionicons name="time-outline" size={14} color="#0041E8" />
                  <Text style={styles.shiftInfoText}>Shift: {myShift.label}</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>Reason *</Text>
              <TextInput
                style={[styles.modalInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                value={reqReason}
                onChangeText={setReqReason}
                placeholder="Explain the attendance discrepancy…"
                placeholderTextColor="#94A3B8"
                multiline
              />

              <TouchableOpacity
                style={[styles.primaryActionButton, reqSubmitting && { opacity: 0.65 }]}
                activeOpacity={0.88}
                onPress={handleSubmitRequest}
                disabled={reqSubmitting}
              >
                {reqSubmitting
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={styles.primaryActionButtonText}>SUBMIT REQUEST</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    flexDirection: 'row',
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
  /* Shift info banner */
  shiftInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  shiftInfoText: {
    fontSize: 13,
    color: '#1D4ED8',
    fontWeight: '600',
    flex: 1,
  },
  /* Request / Leave modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 16,
  },
});
