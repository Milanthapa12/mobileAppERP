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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  LeaveApplicationRecord,
  LeaveBalanceItem,
  LeaveCategoryBalance,
  LeaveCategoryOption,
  LeaveDuration,
  LeavePayload,
  leaveService,
} from '@/services/api/leaveService';
import DateTimePickerField from '@/components/DateTimePickerField';

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

const getDaysBetween = (from: string, to: string): string[] => {
  if (!from || !to) return [];
  const dates: string[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(toDateStr(d));
  }
  return dates;
};

const STATUS_META: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#FEF3C7', text: '#B45309' },
  in_review: { bg: '#DBEAFE', text: '#1D4ED8' },
  approved:  { bg: '#DCFCE7', text: '#15803D' },
  rejected:  { bg: '#FEE2E2', text: '#B91C1C' },
};

const statusMeta = (status: string) =>
  STATUS_META[String(status ?? '').toLowerCase()] ?? { bg: '#DBEAFE', text: '#1D4ED8' };

const statusLabel = (status: string) => {
  const s = String(status ?? '').toLowerCase();
  if (s === 'pending' || s === 'approved' || s === 'rejected' || s === 'in_review') {
    return s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return status || 'Pending';
};

const alertMessage = (title: string, msg: string) => {
  if (Platform.OS === 'web') alert(msg);
  else Alert.alert(title, msg);
};

// ─── Leave duration options ─────────────────────────────────────────────────

const DURATION_OPTIONS: { value: LeaveDuration; label: string; days: number }[] = [
  { value: 'full_day', label: 'Full Day', days: 1 },
  { value: 'first_half', label: '1st Half', days: 0.5 },
  { value: 'second_half', label: '2nd Half', days: 0.5 },
];

const durationLabel = (d?: LeaveDuration): string =>
  DURATION_OPTIONS.find((o) => o.value === d)?.label ?? '—';

const fmtDays = (n: number): string =>
  Number.isInteger(n) ? String(n) : n.toFixed(1);

const canModify = (r: LeaveApplicationRecord): boolean =>
  r.allow_edit && String(r.status ?? '').toLowerCase() === 'pending';

// ─── Draft types ────────────────────────────────────────────────────────────

type LeaveRowDraft = {
  date: string;
  duration: LeaveDuration;
  days: number;
};

const newRow = (date: string): LeaveRowDraft => ({ date, duration: 'full_day', days: 1 });

const rowsFromRecord = (record?: LeaveApplicationRecord | null): LeaveRowDraft[] => {
  if (!record || !record.lines || record.lines.length === 0) {
    return [newRow(toDateStr(new Date()))];
  }
  return record.lines.map((l) => ({
    date: l.date,
    duration: l.duration,
    days: Number(l.days),
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
  record: LeaveApplicationRecord | null;
  loading: boolean;
  visible: boolean;
  onClose: () => void;
  onEdit: (record: LeaveApplicationRecord) => void;
  onDelete: (record: LeaveApplicationRecord) => void;
  deleting: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Leave Application</Text>
              <Text style={styles.modalSubtitle}>{record?.code ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {loading || !record ? (
            <View style={styles.detailLoading}>
              <ActivityIndicator size="large" color="#0041E8" />
              <Text style={styles.detailLoadingText}>Loading application…</Text>
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
                    ['Leave Type', record.leave_category?.name ?? '—'],
                    ['From', niceDate(record.effective_from)],
                    ['To', niceDate(record.effective_to)],
                    ['Total Days', `${fmtDays(Number(record.total_days ?? 0))} day${Number(record.total_days) !== 1 ? 's' : ''}`],
                    ['Employee', record.employee?.name ?? '—'],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.empGridItem}>
                      <Text style={styles.empGridLabel}>{label}:</Text>
                      <Text style={styles.empGridValue} numberOfLines={1}>{value}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>REASON</Text>
                  <Text style={styles.reasonText}>{record.reason || '—'}</Text>
                </View>

                {(record.lines ?? []).length > 0 && (
                  <Text style={styles.sectionLabel}>LEAVE BREAKDOWN</Text>
                )}
                {(record.lines ?? []).map((line, li) => (
                  <View key={li} style={styles.detailDayCard}>
                    <View style={styles.detailLineRow}>
                      <View style={styles.detailLineCol}>
                        <Text style={styles.detailLineLabel}>Date</Text>
                        <Text style={styles.detailLineValue}>{niceDate(line.date)}</Text>
                      </View>
                      <View style={styles.detailLineCol}>
                        <Text style={styles.detailLineLabel}>Duration</Text>
                        <Text style={styles.detailLineValue}>{durationLabel(line.duration)}</Text>
                      </View>
                      <View style={[styles.detailLineCol, styles.detailLineDays]}>
                        <Text style={styles.detailLineLabel}>Days</Text>
                        <View style={styles.daysChip}>
                          <Text style={styles.daysChipText}>{fmtDays(Number(line.days))}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}

                {(record.attachments ?? []).length > 0 && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>ATTACHMENTS</Text>
                    {record.attachments!.map((a) => (
                      <Text key={a.id} style={styles.attachmentText} numberOfLines={1}>
                        • {a.file_name ?? a.url}
                      </Text>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View style={styles.detailActions}>
                {canModify(record) && (
                  <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(record)} activeOpacity={0.88}>
                    <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                )}
                {canModify(record) && (
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

export default function LeaveScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'balance' | 'requests'>('balance');

  // Balance state
  const [balances, setBalances] = useState<LeaveBalanceItem[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [balancesError, setBalancesError] = useState<string | null>(null);

  // List state
  const [requests, setRequests] = useState<LeaveApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Detail state
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<LeaveApplicationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formMode, setFormMode] = useState(false);
  const [editing, setEditing] = useState<LeaveApplicationRecord | null>(null);
  const [code, setCode] = useState('');
  const [categories, setCategories] = useState<LeaveCategoryOption[]>([]);
  const [leaveCatId, setLeaveCatId] = useState<number | null>(null);
  const [categoryBalance, setCategoryBalance] = useState<LeaveCategoryBalance | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(toDateStr(new Date()));
  const [effectiveTo, setEffectiveTo] = useState(toDateStr(new Date()));
  const [draftRows, setDraftRows] = useState<LeaveRowDraft[]>([newRow(toDateStr(new Date()))]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadBalances = useCallback(async () => {
    setBalancesLoading(true);
    try {
      const res = await leaveService.balances();
      setBalances(res?.data ?? []);
      setBalancesError(null);
    } catch (e: any) {
      setBalancesError(e?.message || 'Failed to load leave balance.');
    } finally {
      setBalancesLoading(false);
    }
  }, []);

  const loadList = useCallback(async () => {
    try {
      const res = await leaveService.list();
      setRequests(res?.data ?? []);
      setListError(null);
    } catch (e: any) {
      setListError(e?.message || 'Failed to load leave applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBalances();
    loadList();
  }, [loadBalances, loadList]);

  const generateNewCode = useCallback(async () => {
    setGenerating(true);
    try {
      const generated = await leaveService.generateCode();
      if (generated) setCode(generated);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to generate code.');
    } finally {
      setGenerating(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await leaveService.categories();
      setCategories(res?.data ?? []);
    } catch {
      // Options are optional; submission time validates anyway.
    }
  }, []);

  const rebuildRows = useCallback((from: string, to: string) => {
    const dates = getDaysBetween(from, to);
    if (dates.length === 0) return;
    setDraftRows((rows) =>
      dates.map((date) => {
        const prev = rows.find((r) => r.date === date);
        return prev ?? newRow(date);
      })
    );
  }, []);

  const initializeForm = useCallback(
    async (record: LeaveApplicationRecord | null) => {
      setCategoryBalance(null);
      setLeaveCatId(record?.leave_cat_id ?? null);
      setReason(record?.reason ?? '');

      if (record) {
        setCode(record.code);
        setEffectiveFrom(record.effective_from);
        setEffectiveTo(record.effective_to);
        setDraftRows(rowsFromRecord(record));
      } else {
        setCode('');
        const today = toDateStr(new Date());
        setEffectiveFrom(today);
        setEffectiveTo(today);
        setDraftRows([newRow(today)]);
        generateNewCode();
      }
    },
    [generateNewCode]
  );

  const selectCategory = useCallback(
    async (value: number) => {
      setLeaveCatId(value);
      try {
        const res = await leaveService.balanceForCategory(value);
        setCategoryBalance(res?.data ?? null);
      } catch {
        setCategoryBalance(null);
      }
    },
    []
  );

  const openCreate = () => {
    setEditing(null);
    setFormMode(true);
    loadCategories();
    initializeForm(null);
  };

  const openEdit = (record: LeaveApplicationRecord) => {
    setShowDetail(false);
    setEditing(record);
    setFormMode(true);
    loadCategories();
    initializeForm(record);
    if (record.leave_cat_id) selectCategory(record.leave_cat_id);
  };

  const closeForm = () => {
    setFormMode(false);
    setEditing(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadList(), loadBalances()]);
    setRefreshing(false);
  };

  const handleView = async (record: LeaveApplicationRecord) => {
    setShowDetail(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await leaveService.show(record.id);
      setDetail(res?.data ?? record);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to load application details.');
      setShowDetail(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (record: LeaveApplicationRecord) => {
    const doDelete = async () => {
      setDeleting(true);
      try {
        const res = await leaveService.destroy(record.id);
        alertMessage('Deleted', res?.message || 'Leave application deleted.');
        setShowDetail(false);
        await loadList();
      } catch (e: any) {
        alertMessage('Error', e?.message || 'Delete failed.');
      } finally {
        setDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this leave application?')) doDelete();
    } else {
      Alert.alert('Delete Application', 'Delete this leave application?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ── Row helpers ─────────────────────────────────────────────
  const changeDuration = (di: number, duration: LeaveDuration) => {
    const days = DURATION_OPTIONS.find((o) => o.value === duration)?.days ?? 1;
    setDraftRows((rs) => rs.map((r, i) => (i === di ? { ...r, duration, days } : r)));
  };

  const totalDays = draftRows.reduce((sum, r) => sum + r.days, 0);

  const validateForm = (): string | null => {
    if (!code.trim()) return 'Request code is missing. Tap the refresh icon to generate one.';
    if (!leaveCatId) return 'Select a leave type.';
    if (!effectiveFrom || !effectiveTo) return 'Select the from and to dates.';
    if (effectiveTo < effectiveFrom) return 'To date must be on or after the from date.';
    if (!reason.trim()) return 'Reason is required.';
    if (draftRows.length === 0) return 'At least one leave day is required.';

    const hasHalf = draftRows.some((r) => r.days === 0.5);
    const hasFull = draftRows.some((r) => r.days === 1);

    if (categoryBalance && categoryBalance.consecutive_day && totalDays > categoryBalance.consecutive_day) {
      return `You can only apply for up to ${categoryBalance.consecutive_day} consecutive leave days. Please adjust your request.`;
    }
    if (categoryBalance && categoryBalance.allow_half_day === false && hasHalf) {
      return 'Half day leave days are not allowed. Please adjust your request.';
    }
    if (categoryBalance && categoryBalance.allow_full_day === false && hasFull) {
      return 'Full day leave days are not allowed. Please adjust your request.';
    }
    if (categoryBalance && categoryBalance.allow_negative === false && totalDays > categoryBalance.remaining_days) {
      const message =
        categoryBalance.remaining_days < 1
          ? 'You have no leave days remaining. Please adjust your request.'
          : `You only have ${categoryBalance.remaining_days} leave day(s) remaining. Please adjust your leave request.`;
      return message;
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      alertMessage('Missing information', error);
      return;
    }

    if (!leaveCatId) return;

    const payload: LeavePayload = {
      code: code.trim(),
      leave_cat_id: leaveCatId,
      effective_from: effectiveFrom,
      effective_to: effectiveTo,
      total_days: totalDays,
      reason: reason.trim(),
      leave_rows: draftRows.map((r) => ({ date: r.date, duration: r.duration, days: r.days })),
    };

    setSaving(true);
    try {
      const res = editing
        ? await leaveService.update(editing.id, payload)
        : await leaveService.store(payload);
      alertMessage('Success', res?.message || 'Leave application submitted.');
      setFormMode(false);
      setEditing(null);
      await Promise.all([loadList(), loadBalances()]);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to submit leave application.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const renderBalances = () => {
    if (balancesLoading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0041E8" />
          <Text style={styles.centerStateText}>Loading leave balance…</Text>
        </View>
      );
    }

    if (balancesError) {
      return (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
          <Text style={[styles.centerStateText, { color: '#DC2626' }]}>{balancesError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadBalances} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (balances.length === 0) {
      return (
        <View style={styles.centerState}>
          <Ionicons name="umbrella-outline" size={40} color="#CBD5E1" />
          <Text style={styles.centerStateText}>No leave balance available for this year.</Text>
        </View>
      );
    }

    const totalRemaining = balances.reduce((s, b) => s + Number(b.remaining_days || 0), 0);

    return (
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0041E8']} tintColor="#0041E8" />
        }
      >
        <View style={styles.summaryBanner}>
          <View>
            <Text style={styles.summaryTitle}>Total Remaining</Text>
            <Text style={styles.summaryDays}>{fmtDays(totalRemaining)} Days</Text>
          </View>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeText}>Leave Balance</Text>
          </View>
        </View>

        {balances.map((b) => {
          const total = Number(b.total_days ?? 0);
          const used = Number(b.used_days ?? 0);
          const remaining = Number(b.remaining_days ?? 0);
          const pct = total > 0 ? Math.min((remaining / total) * 100, 100) : 0;
          return (
            <View key={b.id} style={styles.balanceCard}>
              <View style={styles.balanceHead}>
                <Text style={styles.balanceName}>{b.name}</Text>
                <Text style={styles.balanceRemaining}>{fmtDays(remaining)}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
              <View style={styles.balanceFoot}>
                <Text style={styles.balanceFootText}>{fmtDays(used)} used</Text>
                <Text style={styles.balanceFootText}>of {fmtDays(total)} days</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderList = () => {
    if (loading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0041E8" />
          <Text style={styles.centerStateText}>Loading applications…</Text>
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
          <Ionicons name="document-text-outline" size={40} color="#CBD5E1" />
          <Text style={styles.centerStateText}>No leave applications yet.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={openCreate} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Apply for Leave</Text>
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
        <Text style={styles.sectionLabel}>MY LEAVE APPLICATIONS</Text>
        {requests.map((record) => {
          const meta = statusMeta(record.status);
          return (
            <TouchableOpacity key={record.id} style={styles.requestCard} activeOpacity={0.85} onPress={() => handleView(record)}>
              <View style={styles.requestTopRow}>
                <Text style={styles.requestCode}>{record.code}</Text>
                <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.statusPillText, { color: meta.text }]}>{statusLabel(record.status)}</Text>
                </View>
              </View>

              <View style={styles.requestMetaRow}>
                <Ionicons name="umbrella-outline" size={13} color="#64748B" />
                <Text style={styles.requestMetaText}>{record.leave_category?.name ?? 'Leave'}</Text>
                <Ionicons name="time-outline" size={13} color="#64748B" />
                <Text style={styles.requestMetaText}>{fmtDays(Number(record.total_days ?? 0))} day{Number(record.total_days) !== 1 ? 's' : ''}</Text>
              </View>

              <View style={styles.requestDatesRow}>
                <Ionicons name="calendar-outline" size={13} color="#0041E8" />
                <Text style={styles.requestDatesText}>
                  {niceDate(record.effective_from)} → {niceDate(record.effective_to)}
                </Text>
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
        <Text style={styles.sectionLabel}>LEAVE DETAILS</Text>

        {/* Code */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Code</Text>
          <View style={styles.codeRow}>
            <TextInput
              style={[styles.input, styles.codeInput, styles.codeInputReadOnly]}
              value={code}
              editable={false}
              selectTextOnFocus={false}
              autoCapitalize="characters"
              placeholder="LEVAPP-…"
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

        {/* Leave Category */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            Leave Type <Text style={styles.requiredStar}>*</Text>
          </Text>
          {categories.length === 0 ? (
            <ActivityIndicator size="small" color="#0041E8" />
          ) : (
            <View style={styles.chipWrap}>
              {categories.map((cat) => {
                const selected = leaveCatId === cat.value;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.chip, selected && styles.chipActive]}
                    activeOpacity={0.8}
                    onPress={() => selectCategory(cat.value)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {categoryBalance && categoryBalance.name && (
            <View style={styles.balanceInfoBox}>
              <Ionicons name="wallet-outline" size={14} color="#0041E8" />
              <Text style={styles.balanceInfoText}>
                {categoryBalance.name}: {fmtDays(Number(categoryBalance.remaining_days))} day(s) remaining
                {typeof categoryBalance.consecutive_day === 'number' && ` · max ${categoryBalance.consecutive_day} consecutive`}
              </Text>
            </View>
          )}
        </View>

        {/* From / To */}
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>From Date</Text>
            <DateTimePickerField
              mode="date"
              value={effectiveFrom}
              onChange={(t) => {
                setEffectiveFrom(t);
                rebuildRows(t, effectiveTo);
              }}
              placeholder="From date"
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>To Date</Text>
            <DateTimePickerField
              mode="date"
              value={effectiveTo}
              onChange={(t) => {
                setEffectiveTo(t);
                rebuildRows(effectiveFrom, t);
              }}
              placeholder="To date"
            />
          </View>
        </View>

        {/* Rows */}
        <Text style={styles.sectionLabel}>LEAVE DAYS ({fmtDays(totalDays)} day{totalDays !== 1 ? 's' : ''})</Text>
        {draftRows.map((row, di) => (
          <View key={row.date} style={styles.dayCard}>
            <View style={styles.dayCardHead}>
              <Ionicons name="calendar-outline" size={15} color="#0041E8" />
              <Text style={styles.dayDate}>{niceDate(row.date)}</Text>
              <View style={styles.daysPill}>
                <Text style={styles.daysPillText}>{fmtDays(row.days)} day{row.days !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map((opt) => {
                const selected = row.duration === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.durationChip, selected && styles.durationChipActive]}
                    activeOpacity={0.8}
                    onPress={() => changeDuration(di, opt.value)}
                  >
                    <Text style={[styles.durationChipText, selected && styles.durationChipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

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
            placeholder="Enter reason for leave..."
            placeholderTextColor="#CBD5E1"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={saving}
          activeOpacity={0.88}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>{editing ? 'UPDATE APPLICATION' : 'SUBMIT APPLICATION'}</Text>
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
          {formMode ? (editing ? 'Edit Leave Application' : 'Apply for Leave') : 'Leave'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {formMode ? (
        renderForm()
      ) : (
        <>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'balance' && styles.tabBtnActive]}
              activeOpacity={0.8}
              onPress={() => setActiveTab('balance')}
            >
              <Ionicons name="wallet-outline" size={15} color={activeTab === 'balance' ? '#0041E8' : '#64748B'} />
              <Text style={[styles.tabBtnText, activeTab === 'balance' && styles.tabBtnTextActive]}>Leave Balance</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'requests' && styles.tabBtnActive]}
              activeOpacity={0.8}
              onPress={() => setActiveTab('requests')}
            >
              <Ionicons name="document-text-outline" size={15} color={activeTab === 'requests' ? '#0041E8' : '#64748B'} />
              <Text style={[styles.tabBtnText, activeTab === 'requests' && styles.tabBtnTextActive]}>Leave Requests</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'balance' ? renderBalances() : renderList()}

          <View style={styles.bottomBarFixed}>
            <TouchableOpacity style={styles.primaryActionButton} activeOpacity={0.88} onPress={openCreate}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.primaryActionButtonText}>APPLY FOR LEAVE</Text>
            </TouchableOpacity>
          </View>
        </>
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
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
  },
  tabBtnActive: { backgroundColor: '#EEF2FF', borderColor: '#BFDBFE' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabBtnTextActive: { color: '#0041E8', fontWeight: '700' },
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
    marginTop: 4,
  },
  listContent: { padding: 16, paddingBottom: 100 },

  /* Balance tab */
  summaryBanner: {
    backgroundColor: '#0041E8',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#0041E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryTitle: { color: '#DBEAFE', fontSize: 13, fontWeight: '600' },
  summaryDays: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 4 },
  summaryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  summaryBadgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 12,
  },
  balanceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  balanceName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  balanceRemaining: { fontSize: 18, fontWeight: '800', color: '#0041E8' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#EEF2FF', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#0041E8' },
  balanceFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  balanceFootText: { fontSize: 11, color: '#94A3B8' },

  /* Requests list */
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
  requestMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8, flexWrap: 'wrap' },
  requestMetaText: { fontSize: 12, color: '#64748B' },
  requestDatesRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  requestDatesText: { fontSize: 12, color: '#0041E8', fontWeight: '600' },

  /* Bottom bar */
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

  /* Detail modal */
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
  reasonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  reasonLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, color: '#64748B', marginBottom: 4 },
  reasonText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  attachmentText: { fontSize: 12, color: '#334155', marginTop: 2 },
  detailDayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  detailLineRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailLineCol: { flex: 1 },
  detailLineDays: { flex: 0, alignItems: 'flex-end' },
  detailLineLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: '#94A3B8' },
  detailLineValue: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginTop: 2 },
  daysChip: { backgroundColor: '#EEF2FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 3 },
  daysChipText: { fontSize: 11, fontWeight: '700', color: '#0041E8' },
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
  codeInputReadOnly: { backgroundColor: '#F1F5F9' },
  codeRefreshBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldHint: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: '#0041E8', borderColor: '#0041E8' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  balanceInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  balanceInfoText: { fontSize: 12, color: '#1D4ED8', fontWeight: '600', flex: 1 },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  dateField: { flex: 1 },
  dayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
  },
  dayCardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  dayDate: { fontSize: 13, fontWeight: '700', color: '#0F172A', flex: 1 },
  daysPill: { backgroundColor: '#EEF2FF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  daysPillText: { fontSize: 10, fontWeight: '700', color: '#0041E8' },
  durationRow: { flexDirection: 'row', gap: 8 },
  durationChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  durationChipActive: { backgroundColor: '#EEF2FF', borderColor: '#BFDBFE' },
  durationChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  durationChipTextActive: { color: '#0041E8', fontWeight: '700' },
  reasonInput: { minHeight: 80, textAlignVertical: 'top' },
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