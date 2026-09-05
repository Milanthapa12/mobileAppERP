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

type Props = {
  locationName?: string;
};

export default function AttendancePanel({ locationName = 'Mobile punch' }: Props) {
  const {
    todayData,
    isLoading: todayLoading,
    error: todayError,
    punchClockIn,
    punchClockOut,
    punchBreak,
  } = useAttendance();
  const { timeStr, dateStr } = useLiveClock('12h');

  const [punching, setPunching] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState('');
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  const canClockIn = todayData?.can_clock_in;
  const canClockOut = todayData?.can_clock_out;
  const punchType: 'in' | 'out' = canClockOut ? 'out' : 'in';
  const isCheckedIn = !!canClockOut;

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
      {/* ── Clock & Date ─────────────────────────────────────── */}
      <View style={styles.clockSection}>
        <Text style={styles.clockText}>{timeStr}</Text>
        <Text style={styles.dateText}>{dateStr}</Text>
      </View>

      {/* Holiday / Off / Late banners */}
      {todayData?.day_type === 'holiday' && (
        <View style={[styles.banner, styles.bannerHoliday]}>
          <Text style={[styles.bannerText, styles.bannerTextOrange]}>
            🎉 Today is your Holiday{todayData.holiday_name ? ` (${todayData.holiday_name})` : ''}
          </Text>
        </View>
      )}
      {todayData?.day_type === 'off' && (
        <View style={[styles.banner, styles.bannerOff]}>
          <Text style={[styles.bannerText, styles.bannerTextMuted]}>☕ Today is your Day Off</Text>
        </View>
      )}
      {todayData?.late_formatted && (
        <View style={[styles.banner, styles.bannerLate]}>
          <Ionicons name="warning-outline" size={16} color={Colors.warning} />
          <Text style={[styles.bannerText, styles.bannerTextWarning]}>
            You are <Text style={{ fontWeight: '800' }}>{todayData.late_formatted}</Text> late
          </Text>
        </View>
      )}

      {/* Flag warning */}
      {todayData?.is_flagged && (
        <View style={[styles.warningBox, styles.warningDanger]}>
          <Ionicons name="alert-circle" size={17} color={Colors.danger} />
          <Text style={[styles.warningText, { color: Colors.danger }]}>
            {todayData.flag_reason ?? 'Attendance flagged'}
          </Text>
        </View>
      )}

      {/* Punch warning / network error */}
      {(warningMsg || todayError) && (
        <View style={[styles.warningBox, styles.warningGeneral]}>
          <Ionicons name="information-circle" size={17} color={Colors.warning} />
          <Text style={[styles.warningText, { color: Colors.warning }]}>{warningMsg ?? todayError}</Text>
        </View>
      )}

      {/* ── Punch Section ────────────────────────────────────── */}
      <View style={styles.punchSection}>
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

            {isReasonRequired && !reason.trim() && (
              <Text style={styles.reasonHint}>Enter a reason above to continue</Text>
            )}
          </>
        )}

        {/* Circular punch button */}
        <View style={styles.punchArea}>
          <View style={[styles.dashedRing, isCheckedIn && styles.dashedRingOut]}>
            <TouchableOpacity
              style={[
                styles.punchButton,
                isCheckedIn ? styles.punchButtonOut : styles.punchButtonIn,
                isPunchDisabled && styles.punchDisabled,
              ]}
              activeOpacity={0.85}
              disabled={isPunchDisabled}
              onPress={handlePunch}
            >
              {punching || (todayLoading && !todayData) ? (
                <ActivityIndicator color={Colors.card} size="large" />
              ) : (
                <>
                  <Ionicons name="hand-left-outline" size={40} color={Colors.card} />
                  <Text style={styles.punchLabel}>
                    {todayLoading ? 'Loading' : isCheckedIn ? 'Day Out' : 'Day In'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

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

        {/* ── Location ─────────────────────────────────────────── */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.locationText}>{locationName}</Text>
        </View>
      </View>

      {/* ── Day In / Day Out Cards ───────────────────────────── */}
      <View style={styles.infoRow}>
        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <Ionicons name="log-in-outline" size={16} color={Colors.success} />
            <Text style={styles.infoCardTitle}>Day In</Text>
          </View>
          <Text style={[styles.infoCardValue, { color: Colors.success }]}>
            {todayLoading ? '—' : (todayData?.actual_in ?? '--:--')}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <Ionicons name="log-out-outline" size={16} color={Colors.danger} />
            <Text style={styles.infoCardTitle}>Day Out</Text>
          </View>
          <Text style={[styles.infoCardValue, { color: Colors.danger }]}>
            {todayLoading ? '—' : (todayData?.actual_out ?? '--:--')}
          </Text>
        </View>
      </View>

      {/* ── Total Hours ──────────────────────────────────────── */}
      <View style={styles.totalHoursRow}>
        <Ionicons name="time-outline" size={14} color={Colors.primary} />
        <Text style={styles.totalHoursText}>Total Hours Today: </Text>
        <Text style={styles.totalHoursValue}>
          {todayLoading ? '—' : (todayData?.worked_formatted ?? '00h 00m')}
        </Text>
      </View>

      {/* ── Today's segments ─────────────────────────────────── */}
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

      {/* ── Status badge ─────────────────────────────────────── */}
      {todayData?.status && (
        <View style={[styles.statusPill, { backgroundColor: statusPill.bg }]}>
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

  clockSection: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  clockText: {
    fontSize: 44,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  dateText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
    marginTop: 4,
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: 10,
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
  bannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  bannerTextOrange: {
    color: Colors.orange,
  },
  bannerTextMuted: {
    color: Colors.textMuted,
  },
  bannerTextWarning: {
    color: Colors.warning,
  },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: 12,
    marginTop: 10,
  },
  warningDanger: {
    backgroundColor: Colors.dangerLight,
    borderColor: '#FECACA',
  },
  warningGeneral: {
    backgroundColor: Colors.warningLight,
    borderColor: '#FDE68A',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },

  punchSection: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    marginTop: 14,
    paddingTop: 2,
    ...{
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
  },

  addReasonBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  addReasonText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  reasonBox: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
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
    backgroundColor: Colors.card,
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
    paddingHorizontal: 16,
  },

  punchArea: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  dashedRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedRingOut: { borderColor: '#FCA5A5' },
  punchButton: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  punchButtonIn:  { backgroundColor: Colors.success },
  punchButtonOut: { backgroundColor: Colors.danger  },
  punchDisabled:  { opacity: 0.5 },
  punchLabel: {
    color: Colors.card,
    fontSize: 15,
    fontWeight: '700',
  },

  breakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    minWidth: 180,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
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
    marginTop: 10,
    alignSelf: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 5,
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

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 12,
    paddingBottom: 18,
  },
  locationText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  infoCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 14,
    ...{
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    },
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  infoCardTitle: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  infoCardValue: {
    fontSize: 18,
    fontWeight: '800',
  },

  totalHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 14,
    marginBottom: 4,
  },
  totalHoursText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  totalHoursValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },

  segmentsCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 12,
    marginTop: 14,
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
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});