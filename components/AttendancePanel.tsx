import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAttendance } from '@/context/AttendanceContext';
import { Colors, Radius } from '@/constants/theme';
import { useLiveClock } from '@/hooks/useLiveClock';
import { TodayAttendanceData } from '@/services/api/attendanceService';
import { getStatusMeta } from '@/services/attendanceStatus';

function getTodayStatusPill(data: TodayAttendanceData | null) {
  if (!data?.status) return getStatusMeta('present');
  const meta = getStatusMeta(data.status);
  let label = meta.label;
  if ((data.status === 'holiday' || data.status === 'off') && data.is_off_day_punch !== undefined) {
    label =
      data.is_off_day_punch === true ||
      data.is_off_day_punch === 1 ||
      data.is_off_day_punch === 'Non Working Day'
        ? 'Off Day'
        : 'Half Day';
  }
  return { label, bg: meta.bg, text: meta.text };
}

export default function AttendancePanel() {
  const {
    todayData,
    isLoading: todayLoading,
    error: todayError,
    punchClockIn,
    punchClockOut,
    punchBreak,
  } = useAttendance();
  const { timeStr, dateStr } = useLiveClock('24h');

  const [punching, setPunching] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState('');
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  const canClockIn = todayData?.can_clock_in;
  const canClockOut = todayData?.can_clock_out;
  const punchType: 'in' | 'out' = canClockOut ? 'out' : 'in';

  const todaySegments = todayData?.segments ?? [];
  const lastSeg = todaySegments[todaySegments.length - 1];
  const isOnBreak = lastSeg?.type === 'break' && !!lastSeg?.is_open;

  const isReasonRequired = (() => {
    if (isOnBreak) return false;
    if (!todayData?.shift_start_time && !todayData?.end_start_time) return false;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    if (punchType === 'in' && todayData?.shift_start_time) {
      const [sh, sm] = todayData.shift_start_time.split(':').map(Number);
      return nowMins > sh * 60 + sm;
    }
    if (punchType === 'out' && todayData?.end_start_time) {
      const [eh, em] = todayData.end_start_time.split(':').map(Number);
      return nowMins < eh * 60 + em;
    }
    return false;
  })();

  useEffect(() => {
    if (isReasonRequired) setShowReasonInput(true);
  }, [isReasonRequired]);

  const showMessage = (title: string, msg: string) => {
    if (Platform.OS === 'web') alert(msg);
    else Alert.alert(title, msg);
  };

  const handlePunch = async () => {
    if (punching || breaking) return;
    setPunching(true);
    setWarningMsg(null);
    try {
      const res = punchType === 'in' ? await punchClockIn(reason) : await punchClockOut(reason);
      showMessage('Success', res.message || `Clocked ${punchType === 'in' ? 'in' : 'out'}!`);
      if (res.warning) {
        setWarningMsg(res.warning);
      }
      setReason('');
      setShowReasonInput(false);
    } catch (err: any) {
      showMessage('Punch Error', err?.message || `Failed to clock ${punchType === 'in' ? 'in' : 'out'}.`);
    } finally {
      setPunching(false);
    }
  };

  const handleBreakPunch = async () => {
    if (punching || breaking) return;
    setBreaking(true);
    setWarningMsg(null);
    try {
      const res = await punchBreak(isOnBreak ? 'in' : 'out');
      showMessage('Success', res.message || (isOnBreak ? 'Break ended!' : 'Break started!'));
      if (res.warning) {
        setWarningMsg(res.warning);
      }
    } catch (err: any) {
      showMessage('Break Error', err?.message || 'Failed to punch break.');
    } finally {
      setBreaking(false);
    }
  };

  const isPunchDisabled =
    punching || todayLoading || (!canClockIn && !canClockOut) || (isReasonRequired && !reason.trim());

  const statusPill = getTodayStatusPill(todayData);

  return (
    <View style={styles.container}>
      {/* Live clock card */}
      <View style={styles.liveClockCard}>
        <Text style={styles.liveClockLabel}>LIVE CLOCK</Text>
        <Text style={styles.liveClockTime}>{timeStr}</Text>
        <Text style={styles.liveClockDate}>{dateStr}</Text>
        {todayData?.shift_name && (
          <View style={styles.shiftPill}>
            <Ionicons name="timer-outline" size={13} color={Colors.card} />
            <Text style={styles.shiftPillText}>
              {todayData.shift_name} ({todayData.shift_start_time?.slice(0, 5)} — {todayData.end_start_time?.slice(0, 5)})
            </Text>
          </View>
        )}
      </View>

      {/* Holiday / Off / Late banners */}
      {todayData?.day_type === 'holiday' && (
        <View style={[styles.banner, styles.bannerHoliday]}>
          <Text style={styles.bannerTextOrange}>
            🎉 Today is your Holiday{todayData.holiday_name ? ` (${todayData.holiday_name})` : ''}
          </Text>
        </View>
      )}
      {todayData?.day_type === 'off' && (
        <View style={[styles.banner, styles.bannerOff]}>
          <Text style={styles.bannerTextMuted}>☕ Today is your Day Off</Text>
        </View>
      )}
      {todayData?.late_formatted && (
        <View style={[styles.banner, styles.bannerLate]}>
          <Ionicons name="warning-outline" size={16} color={Colors.warning} />
          <Text style={styles.bannerTextWarning}>
            You are <Text style={{ fontWeight: '800' }}>{todayData.late_formatted}</Text> late
          </Text>
        </View>
      )}

      {/* Stat pills */}
      {todayLoading && !todayData ? (
        <View style={styles.statRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.statCard}>
              <ActivityIndicator size="small" color="#CBD5E1" />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.statRow}>
          {[
            { label: 'Clock In', value: todayData?.actual_in ?? '—', color: Colors.success },
            { label: 'Clock Out', value: todayData?.actual_out ?? '—', color: Colors.orange },
            { label: 'Worked', value: todayData?.worked_formatted ?? '—', color: Colors.sky },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statLabel, { color: s.color }]}>{s.label}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Flag warning */}
      {todayData?.is_flagged && (
        <View style={styles.flagWarning}>
          <Ionicons name="alert-circle" size={18} color={Colors.danger} />
          <Text style={styles.flagWarningText}>{todayData.flag_reason ?? 'Attendance flagged'}</Text>
        </View>
      )}

      {/* Punch warning / network error */}
      {(warningMsg || todayError) && (
        <View style={[styles.flagWarning, styles.warningInverse]}>
          <Ionicons name="information-circle" size={18} color={Colors.warning} />
          <Text style={[styles.flagWarningText, { color: Colors.warning }]}>{warningMsg ?? todayError}</Text>
        </View>
      )}

      {!isOnBreak && (
        <>
          {/* Reason input */}
          {showReasonInput || isReasonRequired ? (
            <View style={styles.reasonBox}>
              <View style={styles.reasonHeader}>
                <Text style={styles.reasonLabel}>
                  Reason{isReasonRequired ? <Text style={{ color: Colors.danger }}> *</Text> : null}
                </Text>
                {isReasonRequired && (
                  <View style={styles.reasonRequiredTag}>
                    <Text style={styles.reasonRequiredTagText}>
                      {punchType === 'in' ? 'Late clock-in' : 'Early clock-out'}
                    </Text>
                  </View>
                )}
              </View>
              <TextInput
                style={styles.reasonInput}
                value={reason}
                onChangeText={setReason}
                placeholder={
                  isReasonRequired
                    ? punchType === 'in'
                      ? 'Why are you clocking in late?'
                      : 'Why are you clocking out early?'
                    : 'e.g. Client site visit, forgot badge...'
                }
                placeholderTextColor={Colors.textPlaceholder}
                maxLength={255}
                multiline
              />
              {showReasonInput && !isReasonRequired && (
                <TouchableOpacity style={styles.reasonRemoveBtn} onPress={() => { setShowReasonInput(false); setReason(''); }}>
                  <Text style={styles.reasonRemoveText}>Remove reason</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <TouchableOpacity style={styles.addReasonBtn} onPress={() => setShowReasonInput(true)}>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.addReasonText}>Add a reason (optional)</Text>
            </TouchableOpacity>
          )}

          {/* Punch button */}
          <TouchableOpacity
            style={[
              styles.punchButton,
              punchType === 'out' && { backgroundColor: Colors.orange },
              isPunchDisabled && { opacity: 0.5 },
            ]}
            activeOpacity={0.88}
            disabled={isPunchDisabled}
            onPress={handlePunch}
          >
            {punching ? (
              <ActivityIndicator color="#FFF" />
            ) : todayLoading ? (
              <Text style={styles.punchButtonText}>LOADING…</Text>
            ) : (
              <>
                <Ionicons
                  name={punchType === 'out' ? 'log-out' : 'log-in'}
                  size={18}
                  color="#FFF"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.punchButtonText}>
                  {punchType === 'out' ? 'CLOCK OUT' : 'CLOCK IN'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {isReasonRequired && !reason.trim() && (
            <Text style={styles.reasonHint}>Enter a reason above to continue</Text>
          )}
        </>
      )}

      {/* Break button — only when clocked in or on break */}
      {(canClockOut || isOnBreak) && (
        <TouchableOpacity
          style={[styles.breakButton, isOnBreak && styles.breakButtonActive]}
          activeOpacity={0.9}
          disabled={breaking}
          onPress={handleBreakPunch}
        >
          {breaking ? (
            <ActivityIndicator size="small" color={isOnBreak ? Colors.warning : Colors.textSecondary} />
          ) : (
            <>
              <Ionicons
                name={isOnBreak ? 'timer' : 'timer-outline'}
                size={17}
                color={isOnBreak ? Colors.warning : Colors.textSecondary}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.breakButtonText, isOnBreak && styles.breakButtonTextActive]}>
                {isOnBreak ? 'END BREAK' : 'START BREAK'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* On break indicator */}
      {isOnBreak && (
        <View style={styles.onBreakBadge}>
          <View style={styles.onBreakDot} />
          <Text style={styles.onBreakText}>On Break</Text>
        </View>
      )}

      {/* Today's segments */}
      {todaySegments.length > 0 && (
        <View style={styles.segmentsCard}>
          <Text style={styles.segmentsTitle}>{"TODAY'S PUNCHES"}</Text>
          {todaySegments.map((seg, i) => (
            <View key={`${seg.segment_number ?? i}-${i}`} style={styles.segmentRow}>
              <View
                style={[
                  styles.segmentDot,
                  seg.type === 'break' && { backgroundColor: Colors.warning, borderColor: Colors.warning },
                ]}
              >
                <Ionicons name={seg.type === 'break' ? 'cafe' : 'time'} size={11} color="#FFF" />
              </View>
              <Text style={styles.segmentInfo}>
                {seg.segment_in} {'→'} {seg.is_open ? <Text style={styles.segmentOngoing}>ongoing</Text> : seg.segment_out}
              </Text>
              <Text style={styles.segmentDuration}>{seg.is_open ? '—' : seg.duration_formatted}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Status badge */}
      {todayData?.status && (
        <View style={[styles.statusPill, { backgroundColor: statusPill.bg, marginTop: isOnBreak ? 4 : 12 }]}>
          <Text style={[styles.statusPillText, { color: statusPill.text }]}>
            {statusPill.label.toUpperCase()}
            {todayData.status === 'holiday' && todayData.holiday_name ? ` · ${todayData.holiday_name}` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  liveClockCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  liveClockLabel: {
    color: '#DBEAFE',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  liveClockTime: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '800',
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  liveClockDate: {
    color: '#DBEAFE',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  shiftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 14,
  },
  shiftPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 12,
  },
  bannerHoliday: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  bannerOff: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bannerLate: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bannerTextOrange: {
    color: Colors.orange,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  bannerTextMuted: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  bannerTextWarning: {
    color: Colors.warning,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    minHeight: 58,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 4,
  },
  flagWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 12,
  },
  warningInverse: {
    backgroundColor: Colors.warningLight,
    borderColor: '#FDE68A',
  },
  flagWarningText: {
    color: Colors.danger,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  addReasonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  addReasonText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  reasonBox: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 12,
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reasonLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  reasonRequiredTag: {
    backgroundColor: Colors.warningLight,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reasonRequiredTagText: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: '700',
  },
  reasonInput: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.text,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  reasonRemoveBtn: {
    alignSelf: 'flex-end',
    paddingTop: 8,
  },
  reasonRemoveText: {
    fontSize: 11,
    color: Colors.danger,
    fontWeight: '600',
  },
  reasonHint: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.warning,
    marginTop: 8,
    fontWeight: '600',
  },
  punchButton: {
    backgroundColor: Colors.success,
    height: 54,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  punchButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  breakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    marginTop: 12,
  },
  breakButtonActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  breakButtonText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  breakButtonTextActive: {
    color: Colors.warning,
  },
  onBreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    alignSelf: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  onBreakDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warning,
  },
  onBreakText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentsCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 12,
    marginTop: 12,
  },
  segmentsTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  segmentDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentInfo: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  segmentOngoing: {
    color: Colors.warning,
    fontWeight: '700',
  },
  segmentDuration: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
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
    color: Colors.primary,
  },
});