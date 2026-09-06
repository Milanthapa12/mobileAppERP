import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  attendanceRequestService,
  AttendanceRequestRecord,
} from '@/services/api/attendanceRequestService';
import { getPunchLocation, PunchLocation } from '@/services/location/geolocation';

// ─── Helpers ────────────────────────────────────────────────────────────────

const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const niceDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${m[3]} ${months[Number(m[2]) - 1]}, ${m[1]}`;
};

const normalizeTime = (t: string): string | null => {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
};

const STATUS_META: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#FEF3C7', text: '#B45309' },
  in_review: { bg: '#DBEAFE', text: '#1D4ED8' },
  approved:  { bg: '#DCFCE7', text: '#15803D' },
  rejected:  { bg: '#FEE2E2', text: '#B91C1C' },
};

const statusMeta = (status: string) =>
  STATUS_META[status.toLowerCase()] ?? { bg: '#DBEAFE', text: '#1D4ED8' };

const statusLabel = (status: string) => {
  const s = status.toLowerCase();
  if (s === 'pending' || s === 'approved' || s === 'rejected' || s === 'in_review') {
    return s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return status || 'Approved';
};

const alertMessage = (title: string, msg: string) => {
  if (Platform.OS === 'web') alert(msg);
  else Alert.alert(title, msg);
};

// ─── Draft types ────────────────────────────────────────────────────────────

type PunchDraft = {
  check_in: string;
  check_out: string;
  check_in_note: string;
  check_out_note: string;
  is_break: boolean;
};

type DayDraft = { date: string; punches: PunchDraft[] };

const newPunch = (): PunchDraft => ({
  check_in: '',
  check_out: '',
  check_in_note: '',
  check_out_note: '',
  is_break: false,
});

const newDay = (): DayDraft => ({ date: toDateStr(new Date()), punches: [newPunch()] });

const daysFromRecord = (record?: AttendanceRequestRecord | null): DayDraft[] => {
  if (!record || !record.days || record.days.length === 0) return [newDay()];
  return record.days.map((d) => ({
    date: d.date || toDateStr(new Date()),
    punches: d.punches.map((p) => ({
      check_in: p.check_in ?? '',
      check_out: p.check_out ?? '',
      check_in_note: p.check_in_note ?? '',
      check_out_note: p.check_out_note ?? '',
      is_break: !!p.is_break,
    })),
  }));
};

// ─── Detail modal ────────────────────────────────────────────────────────────

function DetailModal({
  record,
  loading,
  visible,
  onClose,
  onEdit,
  onDelete,
  deleting,
}: {
  record: AttendanceRequestRecord | null;
  loading: boolean;
  visible: boolean;
  onClose: () => void;
  onEdit: (record: AttendanceRequestRecord) => void;
  onDelete: (record: AttendanceRequestRecord) => void;
  deleting: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Attendance Request</Text>
              <Text style={styles.modalSubtitle}>{record?.code ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {loading || !record ? (
            <View style={styles.detailLoading}>
              <ActivityIndicator size="large" color="#0041E8" />
              <Text style={styles.detailLoadingText}>Loading request…</Text>
            </View>
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
                <View style={styles.detailTopRow}>
                  <View style={[styles.statusPill, { backgroundColor: statusMeta(record.status).bg }]}>
                    <Text style={[styles.statusPillText, { color: statusMeta(record.status).text }]}>
                      {statusLabel(record.status)}
                    </Text>
                  </View>
                  <Text style={styles.detailDates}>{niceDate(record.created_at)}</Text>
                </View>

                <View style={styles.empGrid}>
                  {[
                    ['Code', record.code],
                    ['Employee', record.employee?.name ?? '—'],
                    ['Shift', record.shift?.name ?? '—'],
                    ['Total Days', `${record.days?.length ?? 0} day${(record.days?.length ?? 0) !== 1 ? 's' : ''}`],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.empGridItem}>
                      <Text style={styles.empGridLabel}>{label}:</Text>
                      <Text style={styles.empGridValue} numberOfLines={1}>{value}</Text>
                    </View>
                  ))}
                </View>
                {!!record.location_name && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>LOCATION</Text>
                    <Text style={styles.reasonText}>{record.location_name}</Text>
                  </View>
                )}
                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>REASON</Text>
                  <Text style={styles.reasonText}>{record.reason || '—'}</Text>
                </View>

                {(record.days ?? []).length > 0 && (
                  <Text style={styles.sectionLabel}>ATTENDANCE BREAKDOWN</Text>
                )}
                {(record.days ?? []).map((day, di) => (
                  <View key={di} style={styles.detailDayCard}>
                    <View style={styles.detailDayHead}>
                      <Text style={styles.detailDayTitle}>Day {di + 1}</Text>
                      <Text style={styles.detailDayDate}>{niceDate(day.date)}</Text>
                      <View style={styles.punchCountPill}>
                        <Text style={styles.punchCountText}>
                          {day.punches?.length ?? 0} {(day.punches?.length ?? 0) === 1 ? 'punch' : 'punches'}
                        </Text>
                      </View>
                    </View>
                    {(day.punches ?? []).map((punch, pi) => (
                      <View key={pi} style={styles.detailPunchRow}>
                        <View style={styles.detailPunchCol}>
                          <View style={styles.detailPunchTitleRow}>
                            <Ionicons name="log-in-outline" size={13} color="#16A34A" />
                            <Text style={[styles.detailPunchTitle, { color: '#16A34A' }]}>
                              Check-in{pi > 0 ? ` #${pi + 1}` : ''}
                            </Text>
                            {punch.is_break && (
                              <View style={styles.breakChip}>
                                <Text style={styles.breakChipText}>Break</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.detailPunchTime}>{punch.check_in ?? '—'}</Text>
                          {!!punch.check_in_note && <Text style={styles.detailPunchNote}>{punch.check_in_note}</Text>}
                        </View>
                        <View style={styles.detailPunchCol}>
                          <View style={styles.detailPunchTitleRow}>
                            <Ionicons name="log-out-outline" size={13} color="#DC2626" />
                            <Text style={[styles.detailPunchTitle, { color: '#DC2626' }]}>Check-out</Text>
                          </View>
                          <Text style={styles.detailPunchTime}>{punch.check_out ?? '—'}</Text>
                          {!!punch.check_out_note && <Text style={styles.detailPunchNote}>{punch.check_out_note}</Text>}
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </ScrollView>

              <View style={styles.detailActions}>
                {record.allow_edit && (
                  <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(record)} activeOpacity={0.88}>
                    <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                )}
                {record.allow_delete && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => onDelete(record)}
                    disabled={deleting}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    <Text style={styles.deleteBtnText}>{deleting ? 'Deleting…' : 'Delete'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────

export default function AttendanceRequestsScreen() {
  const router = useRouter();

  // List state
  const [requests, setRequests] = useState<AttendanceRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Detail state
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<AttendanceRequestRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formMode, setFormMode] = useState(false);
  const [editing, setEditing] = useState<AttendanceRequestRecord | null>(null);
  const [draftDays, setDraftDays] = useState<DayDraft[]>([newDay()]);
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');
  const [shiftLabel, setShiftLabel] = useState<string>('');
  const [shiftId, setShiftId] = useState<number | null>(null);
  const [location, setLocation] = useState<PunchLocation>({});
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const res = await attendanceRequestService.list();
      setRequests(res?.data ?? []);
      setListError(null);
    } catch (e: any) {
      setListError(e?.message || 'Failed to load attendance requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const generateNewCode = useCallback(async () => {
    setGenerating(true);
    try {
      const generated = await attendanceRequestService.generateCode('attendance_request');
      if (generated) setCode(generated);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to generate code.');
    } finally {
      setGenerating(false);
    }
  }, []);

  const initializeForm = useCallback(
    async (record: AttendanceRequestRecord | null) => {
      setDraftDays(daysFromRecord(record));
      setReason(record?.reason ?? '');
      setShiftId(record?.shift_id ?? null);
      setShiftLabel(record?.shift?.name ?? '');

      if (record) {
        setCode(record.code);
      } else {
        setCode('');
        generateNewCode();
        try {
          const shiftRes = await attendanceRequestService.myShift();
          const shift = shiftRes?.data;
          if (shift) {
            setShiftId(shift.value ?? null);
            setShiftLabel(shift.label ?? '');
          }
        } catch {
          // Shift pre-fill is optional.
        }
      }

      const coords = await getPunchLocation();
      setLocation(coords);
    },
    [generateNewCode]
  );

  const openCreate = () => {
    setEditing(null);
    setFormMode(true);
    initializeForm(null);
  };

  const openEdit = (record: AttendanceRequestRecord) => {
    setShowDetail(false);
    setEditing(record);
    setFormMode(true);
    initializeForm(record);
  };

  const closeForm = () => {
    setFormMode(false);
    setEditing(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadList();
    setRefreshing(false);
  };

  const handleView = async (record: AttendanceRequestRecord) => {
    setShowDetail(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await attendanceRequestService.show(record.id);
      setDetail(res?.data ?? record);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to load request details.');
      setShowDetail(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (record: AttendanceRequestRecord) => {
    const doDelete = async () => {
      setDeleting(true);
      try {
        const res = await attendanceRequestService.destroy(record.id);
        alertMessage('Deleted', res?.message || 'Attendance request deleted.');
        setShowDetail(false);
        await loadList();
      } catch (e: any) {
        alertMessage('Error', e?.message || 'Delete failed.');
      } finally {
        setDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this attendance request?')) doDelete();
    } else {
      Alert.alert('Delete Request', 'Delete this attendance request?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ── Day / punch draft helpers ─────────────────────────────
  const setDayDate = (di: number, date: string) =>
    setDraftDays((ds) => ds.map((d, i) => (i === di ? { ...d, date } : d)));

  const updatePunch = (di: number, pi: number, patch: Partial<PunchDraft>) =>
    setDraftDays((ds) =>
      ds.map((d, i) =>
        i === di
          ? { ...d, punches: d.punches.map((p, j) => (j === pi ? { ...p, ...patch } : p)) }
          : d
      )
    );

  const addDay = () => setDraftDays((ds) => [...ds, newDay()]);
  const removeDay = (di: number) => setDraftDays((ds) => (ds.length > 1 ? ds.filter((_, i) => i !== di) : ds));
  const addPunch = (di: number) =>
    setDraftDays((ds) => ds.map((d, i) => (i === di ? { ...d, punches: [...d.punches, newPunch()] } : d)));
  const removePunch = (di: number, pi: number) =>
    setDraftDays((ds) =>
      ds.map((d, i) =>
        i === di && d.punches.length > 1 ? { ...d, punches: d.punches.filter((_, j) => j !== pi) } : d
      )
    );

  const validateForm = (): string | null => {
    if (!code.trim()) return 'Request code is missing. Tap the refresh icon to generate one.';
    if (!reason.trim()) return 'Reason is required.';
    if (draftDays.length === 0) return 'At least one attendance day is required.';

    for (let i = 0; i < draftDays.length; i++) {
      const day = draftDays[i];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
        return `Day ${i + 1}: date must be in YYYY-MM-DD format.`;
      }
      if (day.punches.length === 0) {
        return `Day ${i + 1}: at least one punch is required.`;
      }
      for (let j = 0; j < day.punches.length; j++) {
        const p = day.punches[j];
        const hasIn = !!p.check_in.trim();
        const hasOut = !!p.check_out.trim();
        if (!hasIn && !hasOut) {
          return `Day ${i + 1}, Punch ${j + 1}: enter a check-in or check-out time.`;
        }
        if (hasIn && !normalizeTime(p.check_in)) {
          return `Day ${i + 1}, Punch ${j + 1}: check-in time must be HH:MM.`;
        }
        if (hasOut && !normalizeTime(p.check_out)) {
          return `Day ${i + 1}, Punch ${j + 1}: check-out time must be HH:MM.`;
        }
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      alertMessage('Missing information', error);
      return;
    }

    const payload = {
      code: code.trim(),
      shift_id: shiftId,
      reason: reason.trim(),
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
      days: draftDays.map((d) => ({
        date: d.date,
        punches: d.punches.map((p) => ({
          check_in: p.check_in.trim() ? normalizeTime(p.check_in) : null,
          check_out: p.check_out.trim() ? normalizeTime(p.check_out) : null,
          check_in_note: p.check_in_note.trim() || null,
          check_out_note: p.check_out_note.trim() || null,
          is_break: p.is_break,
        })),
      })),
    };

    setSaving(true);
    try {
      const res = editing
        ? await attendanceRequestService.update(editing.id, payload)
        : await attendanceRequestService.store(payload);
      alertMessage('Success', res?.message || 'Attendance request submitted.');
      setFormMode(false);
      setEditing(null);
      await loadList();
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to submit attendance request.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────

  const renderList = () => {
    if (loading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0041E8" />
          <Text style={styles.centerStateText}>Loading requests…</Text>
        </View>
      );
    }

    if (listError) {
      return (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
          <Text style={[styles.centerStateText, { color: '#DC2626' }]}>{listError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadList} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (requests.length === 0) {
      return (
        <View style={styles.centerState}>
          <Ionicons name="calendar-outline" size={40} color="#CBD5E1" />
          <Text style={styles.centerStateText}>No attendance requests yet.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={openCreate} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>New Request</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0041E8']} tintColor="#0041E8" />
        }
      >
        <Text style={styles.sectionLabel}>MY ATTENDANCE REQUESTS</Text>
        {requests.map((record) => {
          const meta = statusMeta(record.status);
          const dates = record.days ?? [];
          return (
            <TouchableOpacity key={record.id} style={styles.requestCard} activeOpacity={0.85} onPress={() => handleView(record)}>
              <View style={styles.requestTopRow}>
                <Text style={styles.requestCode}>{record.code}</Text>
                <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.statusPillText, { color: meta.text }]}>{statusLabel(record.status)}</Text>
                </View>
              </View>

              <View style={styles.requestMetaRow}>
                <Ionicons name="time-outline" size={13} color="#64748B" />
                <Text style={styles.requestMetaText}>{record.shift?.name ?? 'No shift'} · {niceDate(record.created_at)}</Text>
              </View>

              <View style={styles.requestDatesRow}>
                {dates.slice(0, 2).map((d) => (
                  <View key={`${record.id}-${d.date}`} style={styles.dateChip}>
                    <Text style={styles.dateChipText}>{d.date}</Text>
                  </View>
                ))}
                {dates.length > 2 && (
                  <Text style={styles.moreDatesText}>+{dates.length - 2} more</Text>
                )}
                <View style={styles.punchCountPill}>
                  <Text style={styles.punchCountText}>
                    {dates.reduce((sum, d) => sum + (d.punches?.length ?? 0), 0)}{' '}
                    {dates.reduce((sum, d) => sum + (d.punches?.length ?? 0), 0) === 1 ? 'punch' : 'punches'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderForm = () => (
    <KeyboardAvoidingView style={styles.formContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>REQUEST DETAILS</Text>

        {/* Code */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Code</Text>
          <View style={styles.codeRow}>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              placeholder="ATTREQ-…"
              placeholderTextColor="#CBD5E1"
            />
            {!editing && (
              <TouchableOpacity style={styles.codeRefreshBtn} onPress={generateNewCode} disabled={generating}>
                <Ionicons name={generating ? 'sync-outline' : 'refresh-outline'} size={18} color="#0041E8" />
              </TouchableOpacity>
            )}
          </View>
          {!editing && (
            <Text style={styles.fieldHint}>Tap the refresh icon to generate a new code.</Text>
          )}
        </View>

        {/* Shift */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Shift</Text>
          <View style={styles.shiftBox}>
            <Ionicons name="time-outline" size={15} color="#0041E8" />
            <Text style={styles.shiftText}>{shiftLabel || 'No shift assigned'}</Text>
          </View>
        </View>

        {/* Reason */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            Reason <Text style={styles.requiredStar}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder="Enter reason for attendance correction..."
            placeholderTextColor="#CBD5E1"
          />
        </View>

        {/* GPS */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Location</Text>
          <View style={styles.locationBox}>
            <Ionicons
              name={location.latitude != null ? 'location' : 'location-outline'}
              size={15}
              color={location.latitude != null ? '#16A34A' : '#94A3B8'}
            />
            <Text style={[styles.locationText, location.latitude != null && styles.locationTextActive]}>
              {location.latitude != null ? 'GPS location will be attached' : 'Location unavailable (request still works)'}
            </Text>
          </View>
        </View>

        {/* Days */}
        <Text style={styles.sectionLabel}>ATTENDANCE DAYS</Text>
        {draftDays.map((day, di) => (
          <View key={di} style={styles.dayCard}>
            <View style={styles.dayCardHead}>
              <View style={styles.dayNumberCircle}>
                <Text style={styles.dayNumberText}>{di + 1}</Text>
              </View>
              <View style={styles.dayDateField}>
                <Text style={styles.fieldLabel}>Date</Text>
                <TextInput
                  style={[styles.input, styles.dateInput]}
                  value={day.date}
                  onChangeText={(t) => setDayDate(di, t)}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#CBD5E1"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.punchCountPill}>
                <Text style={styles.punchCountText}>
                  {day.punches.length} {day.punches.length === 1 ? 'punch' : 'punches'}
                </Text>
              </View>
              {draftDays.length > 1 && (
                <TouchableOpacity onPress={() => removeDay(di)} style={styles.dayRemoveBtn}>
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                </TouchableOpacity>
              )}
            </View>

            {day.punches.map((punch, pi) => (
              <View key={pi} style={styles.punchSection}>
                <View style={styles.punchHeaderRow}>
                  <Text style={styles.punchLabel}>PUNCH {pi + 1}</Text>
                  <View style={styles.breakToggleRow}>
                    <Text style={styles.breakToggleLabel}>Mark as break</Text>
                    <Switch
                      value={punch.is_break}
                      onValueChange={(v) => updatePunch(di, pi, { is_break: v })}
                      trackColor={{ true: '#F59E0B', false: '#E2E8F0' }}
                      thumbColor="#FFFFFF"
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                  </View>
                  {day.punches.length > 1 && (
                    <TouchableOpacity onPress={() => removePunch(di, pi)} style={styles.punchRemoveBtn}>
                      <Ionicons name="close-circle" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.punchGrid}>
                  {/* Check-in */}
                  <View style={[styles.punchBox, styles.checkInBox]}>
                    <View style={styles.punchBoxTitleRow}>
                      <Ionicons name="log-in-outline" size={13} color="#16A34A" />
                      <Text style={[styles.punchBoxTitle, { color: '#16A34A' }]}>CHECK-IN</Text>
                    </View>
                    <TextInput
                      style={[styles.input, styles.timeInput]}
                      value={punch.check_in}
                      onChangeText={(t) => updatePunch(di, pi, { check_in: t })}
                      placeholder="HH:MM"
                      placeholderTextColor="#CBD5E1"
                      keyboardType="numbers-and-punctuation"
                    />
                    <TextInput
                      style={[styles.input, styles.noteInput]}
                      value={punch.check_in_note}
                      onChangeText={(t) => updatePunch(di, pi, { check_in_note: t })}
                      placeholder="Reason for check-in..."
                      placeholderTextColor="#CBD5E1"
                    />
                  </View>
                  {/* Check-out */}
                  <View style={[styles.punchBox, styles.checkOutBox]}>
                    <View style={styles.punchBoxTitleRow}>
                      <Ionicons name="log-out-outline" size={13} color="#DC2626" />
                      <Text style={[styles.punchBoxTitle, { color: '#DC2626' }]}>CHECK-OUT</Text>
                    </View>
                    <TextInput
                      style={[styles.input, styles.timeInput]}
                      value={punch.check_out}
                      onChangeText={(t) => updatePunch(di, pi, { check_out: t })}
                      placeholder="HH:MM"
                      placeholderTextColor="#CBD5E1"
                      keyboardType="numbers-and-punctuation"
                    />
                    <TextInput
                      style={[styles.input, styles.noteInput]}
                      value={punch.check_out_note}
                      onChangeText={(t) => updatePunch(di, pi, { check_out_note: t })}
                      placeholder="Reason for check-out..."
                      placeholderTextColor="#CBD5E1"
                    />
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addPunchBtn} onPress={() => addPunch(di)} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={16} color="#0041E8" />
              <Text style={styles.addPunchBtnText}>Add punch</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addDayBtn} onPress={addDay} activeOpacity={0.8}>
          <Ionicons name="add" size={16} color="#0041E8" />
          <Text style={styles.addDayBtnText}>Next day</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={saving}
          activeOpacity={0.88}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>{editing ? 'UPDATE REQUEST' : 'SUBMIT REQUEST'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0041E8" />
      <View style={styles.blueHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (formMode ? closeForm() : router.back())}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {formMode ? (editing ? 'Edit Request' : 'New Request') : 'Attendance Request'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {formMode ? renderForm() : renderList()}

      {!formMode && requests.length > 0 && (
        <View style={styles.bottomBarFixed}>
          <TouchableOpacity style={styles.primaryActionButton} activeOpacity={0.88} onPress={openCreate}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.primaryActionButtonText}>NEW REQUEST</Text>
          </TouchableOpacity>
        </View>
      )}

      <DetailModal
        record={detail}
        loading={detailLoading}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        onEdit={openEdit}
        onDelete={handleDelete}
        deleting={deleting}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  blueHeader: {
    backgroundColor: '#0041E8',
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centerStateText: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  retryBtn: {
    marginTop: 4,
    backgroundColor: '#0041E8',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#64748B',
    marginBottom: 12,
  },
  listContent: { padding: 16, paddingBottom: 100 },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  requestTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  requestCode: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  requestMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  requestMetaText: { fontSize: 12, color: '#64748B' },
  requestDatesRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  dateChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dateChipText: { fontSize: 11, color: '#334155', fontWeight: '600' },
  moreDatesText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  punchCountPill: {
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 'auto',
  },
  punchCountText: { fontSize: 10, fontWeight: '700', color: '#0041E8' },
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
    flexDirection: 'row',
    gap: 6,
    shadowColor: '#0041E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  modalSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  modalCloseBtn: { padding: 6 },
  modalContent: { padding: 20, paddingBottom: 32 },
  detailLoading: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  detailLoadingText: { fontSize: 13, color: '#64748B' },
  detailTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  detailDates: { fontSize: 12, color: '#64748B' },
  empGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  empGridItem: { width: '48%', flexGrow: 1 },
  empGridLabel: { fontSize: 11, color: '#64748B' },
  empGridValue: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginTop: 2 },
  reasonBox: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginBottom: 12 },
  reasonLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: '#64748B', marginBottom: 4 },
  reasonText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  detailDayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  detailDayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  detailDayTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: '#64748B' },
  detailDayDate: { fontSize: 12, color: '#334155', fontWeight: '600' },
  detailPunchRow: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 },
  detailPunchCol: { flex: 1 },
  detailPunchTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  detailPunchTitle: { fontSize: 11, fontWeight: '700' },
  detailPunchTime: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  detailPunchNote: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  breakChip: { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  breakChipText: { fontSize: 9, fontWeight: '700', color: '#B45309' },
  detailActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  editBtn: {
    flex: 1,
    backgroundColor: '#0041E8',
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteBtnText: { color: '#DC2626', fontSize: 14, fontWeight: '700' },

  /* Form */
  formContainer: { flex: 1 },
  formContent: { padding: 16, paddingBottom: 40 },
  fieldBlock: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 6 },
  requiredStar: { color: '#DC2626' },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeInput: { flex: 1 },
  codeRefreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldHint: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  shiftBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  shiftText: { fontSize: 13, fontWeight: '600', color: '#1D4ED8' },
  reasonInput: { minHeight: 80, textAlignVertical: 'top' },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  locationText: { fontSize: 12, color: '#94A3B8' },
  locationTextActive: { color: '#15803D', fontWeight: '600' },
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  dayCardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dayNumberCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  dayNumberText: { fontSize: 11, fontWeight: '800', color: '#0041E8' },
  dayDateField: { flex: 1 },
  dateInput: { paddingVertical: 8, fontSize: 13 },
  dayRemoveBtn: { padding: 4, marginTop: 4 },
  punchSection: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10, marginTop: 10 },
  punchHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  punchLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: '#94A3B8' },
  breakToggleRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 2 },
  breakToggleLabel: { fontSize: 11, color: '#B45309', fontWeight: '600' },
  punchRemoveBtn: { paddingLeft: 4 },
  punchGrid: { flexDirection: 'row', gap: 10 },
  punchBox: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 10 },
  checkInBox: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  checkOutBox: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  punchBoxTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  punchBoxTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  timeInput: { paddingVertical: 8, fontSize: 13, fontVariant: ['tabular-nums'] },
  noteInput: { paddingVertical: 8, fontSize: 12, marginTop: 8 },
  addPunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    marginTop: 8,
  },
  addPunchBtnText: { fontSize: 12, fontWeight: '700', color: '#0041E8' },
  addDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  addDayBtnText: { fontSize: 13, fontWeight: '700', color: '#0041E8' },
  submitBtn: {
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
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
});