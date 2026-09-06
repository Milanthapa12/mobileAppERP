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
import * as DocumentPicker from 'expo-document-picker';
import {
  DayInfo,
  DayType,
  InLieuDocumentFile,
  InLieuDuration,
  InLieuPayload,
  InLieuRequestRecord,
  LeaveCategoryOption,
  inLieuService,
} from '@/services/api/inLieuService';
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

const DURATION_OPTIONS: { value: InLieuDuration; label: string }[] = [
  { value: 'full_day', label: 'Full Day' },
  { value: 'first_half', label: 'First Half' },
  { value: 'second_half', label: 'Second Half' },
];

const DURATION_LABELS: Record<string, string> = {
  full_day: 'Full Day',
  first_half: 'First Half',
  second_half: 'Second Half',
};

const durationToDays = (d: string): number => (d === 'full_day' ? 1 : 0.5);

const computeWorkedHours = (from: string, to: string): string => {
  if (!from || !to) return '';
  const f = from.match(/^(\d{1,2}):(\d{2})$/);
  const t = to.match(/^(\d{1,2}):(\d{2})$/);
  if (!f || !t) return '';
  let minutes = Number(t[1]) * 60 + Number(t[2]) - (Number(f[1]) * 60 + Number(f[2]));
  if (minutes < 0) minutes += 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

const fmtHours = (h?: string | null): string => {
  if (!h) return '—';
  const m = h.match(/^(\d{2}):(\d{2})$/);
  if (m) {
    const total = Number(m[2]) === 0 ? Number(m[1]) : Number(m[1]) + Number(m[2]) / 60;
    return Number.isInteger(total) ? `${total} hrs` : `${total.toFixed(1)} hrs`;
  }
  return `${h} hrs`;
};

const alertMessage = (title: string, msg: string) => {
  if (Platform.OS === 'web') alert(msg);
  else Alert.alert(title, msg);
};

const canModify = (r: InLieuRequestRecord): boolean =>
  Boolean(r.allow_edit) && String(r.status ?? '').toLowerCase() === 'pending';

// ─── Day type badge ─────────────────────────────────────────────────────────

const DAY_TYPE_CONFIG: Record<
  DayType,
  { label: string; bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  working:    { label: 'Working Day',     bg: '#EFF6FF',   text: '#2563EB', icon: 'briefcase-outline'    },
  off:        { label: 'Non-Working Day', bg: '#F8FAFC',   text: '#64748B', icon: 'calendar-clear-outline' },
  holiday:    { label: 'Public Holiday',  bg: '#ECFDF5',   text: '#059669', icon: 'star-outline'        },
  unassigned: { label: 'No Roster Data',  bg: '#FFF7ED',   text: '#EA580C', icon: 'alert-circle-outline' },
};

function DayTypeBadge({ dayInfo, loading }: { dayInfo: DayInfo | null; loading: boolean }) {
  if (loading) {
    return (
      <View style={styles.dayBadge}>
        <ActivityIndicator size="small" color="#0041E8" />
        <Text style={styles.dayBadgeText}>Checking day type...</Text>
      </View>
    );
  }
  if (!dayInfo?.day_type) return null;
  const cfg = DAY_TYPE_CONFIG[dayInfo.day_type];
  return (
    <View style={[styles.dayBadge, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon} size={14} color={cfg.text} />
      <Text style={[styles.dayBadgeText, { color: cfg.text, fontWeight: '700' }]}>
        {cfg.label}
        {dayInfo.holiday_name ? ` - ${dayInfo.holiday_name}` : ''}
      </Text>
      {dayInfo.shift_code ? (
        <Text style={[styles.shiftChip, { backgroundColor: dayInfo.shift_color ?? '#6366F1' }]}>
          {dayInfo.shift_code}
        </Text>
      ) : null}
      {dayInfo.expected_in || dayInfo.expected_out ? (
        <Text style={styles.dayBadgeSub}> {dayInfo.expected_in} – {dayInfo.expected_out}</Text>
      ) : null}
    </View>
  );
}

// ─── Single select dropdown modal ───────────────────────────────────────────

function OptionPickerModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { value: number | string; label: string }[];
  selectedValue?: number | string | null;
  onSelect: (value: number | string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.pickerSheet} activeOpacity={1} onPress={() => {}}>
          <Text style={styles.pickerTitle}>{title}</Text>
          {options.length === 0 ? (
            <Text style={styles.pickerEmpty}>No options available.</Text>
          ) : (
            options.map((opt) => {
              const selected = selectedValue === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.pickerItem, selected && styles.pickerItemActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelect(opt.value);
                    onClose();
                  }}
                >
                  <Text style={[styles.pickerItemText, selected && styles.pickerItemTextActive]}>{opt.label}</Text>
                  {selected && <Ionicons name="checkmark" size={18} color="#0041E8" />}
                </TouchableOpacity>
              );
            })
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

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
  record: InLieuRequestRecord | null;
  loading: boolean;
  visible: boolean;
  onClose: () => void;
  onEdit: (record: InLieuRequestRecord) => void;
  onDelete: (record: InLieuRequestRecord) => void;
  deleting: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>In-Lieu Request</Text>
              <Text style={styles.modalSubtitle}>{record?.code ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {loading || !record ? (
            <View style={styles.detailLoading}>
              <ActivityIndicator size="large" color="#0041E8" />
              <Text style={styles.detailLoadingText}>Loading request...</Text>
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
                  <Text style={styles.detailDates}>{record.created_at ? niceDate(record.created_at) : ''}</Text>
                </View>

                <View style={styles.empGrid}>
                  {[
                    ['Code', record.code],
                    ['Employee', record.employee?.name ?? '—'],
                    ['Leave Category', record.leave_category?.name ?? '—'],
                    ['Worked Date', niceDate(record.worked_date)],
                    ['Worked From', record.worked_from ?? '—'],
                    ['Worked To', record.worked_to ?? '—'],
                    ['Worked Hours', record.worked_hours ?? '—'],
                    ['Submitted On', record.created_at ?? '—'],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.empGridItem}>
                      <Text style={styles.empGridLabel}>{label}:</Text>
                      <Text style={styles.empGridValue} numberOfLines={1}>{value}</Text>
                    </View>
                  ))}
                  <View style={styles.empGridItem}>
                    <Text style={styles.empGridLabel}>Duration:</Text>
                    <Text style={styles.empGridValue} numberOfLines={1}>
                      {DURATION_LABELS[record.duration ?? ''] ?? record.duration ?? '—'}
                    </Text>
                  </View>
                  <View style={styles.empGridItem}>
                    <Text style={styles.empGridLabel}>Days:</Text>
                    <Text style={styles.empGridValue} numberOfLines={1}>{record.days ?? '—'}</Text>
                  </View>
                </View>

                {record.description ? (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>DESCRIPTION</Text>
                    <Text style={styles.reasonText}>{record.description}</Text>
                  </View>
                ) : null}

                {(record.attachments ?? []).length > 0 && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>SUPPORTING DOCUMENT</Text>
                    {(record.attachments ?? []).map((a) => (
                      <Text key={a.id} style={styles.attachmentText} numberOfLines={1}>
                        • {a.file_name}
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
                    <Text style={styles.deleteBtnText}>{deleting ? 'Deleting...' : 'Delete'}</Text>
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

export default function InLieuScreen() {
  const router = useRouter();

  // List state
  const [requests, setRequests] = useState<InLieuRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Detail state
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<InLieuRequestRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formMode, setFormMode] = useState(false);
  const [editing, setEditing] = useState<InLieuRequestRecord | null>(null);
  const [code, setCode] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<LeaveCategoryOption[]>([]);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [leaveCatId, setLeaveCatId] = useState<number | null>(null);
  const [workedDate, setWorkedDate] = useState(toDateStr(new Date()));
  const [workedFrom, setWorkedFrom] = useState('');
  const [workedTo, setWorkedTo] = useState('');
  const [duration, setDuration] = useState<InLieuDuration>('full_day');
  const [description, setDescription] = useState('');
  const [document, setDocument] = useState<InLieuDocumentFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Day info (live classify)
  const [dayInfo, setDayInfo] = useState<DayInfo | null>(null);
  const [dayChecking, setDayChecking] = useState(false);

  const autoHours = computeWorkedHours(workedFrom, workedTo);
  const autoDays = durationToDays(duration);

  const loadList = useCallback(async () => {
    try {
      const res = await inLieuService.list();
      setRequests(res?.data ?? []);
      setListError(null);
    } catch (e: any) {
      setListError(e?.message || 'Failed to load in-lieu requests.');
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
      const generated = await inLieuService.generateCode();
      if (generated) setCode(generated);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to generate code.');
    } finally {
      setGenerating(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const res = await inLieuService.leaveCategories();
      setCategoryOptions(res?.data ?? []);
    } catch {
      // Options are optional; submission time validates anyway.
    }
  }, []);

  // Live day-type classification whenever the date changes
  useEffect(() => {
    if (!workedDate) {
      setDayInfo(null);
      return;
    }
    let cancelled = false;
    setDayChecking(true);
    inLieuService
      .classifyDate(workedDate)
      .then((info) => {
        if (!cancelled) setDayInfo(info);
      })
      .catch(() => {
        if (!cancelled) setDayInfo(null);
      })
      .finally(() => {
        if (!cancelled) setDayChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workedDate]);

  const initializeForm = useCallback(
    (record: InLieuRequestRecord | null) => {
      setDocument(null);
      setDayInfo(null);
      if (record) {
        setCode(record.code);
        setLeaveCatId(record.leave_cat_id ?? null);
        setWorkedDate(record.worked_date);
        setWorkedFrom(record.worked_from ?? '');
        setWorkedTo(record.worked_to ?? '');
        setDuration((record.duration as InLieuDuration) ?? 'full_day');
        setDescription(record.description ?? '');
      } else {
        setCode('');
        setLeaveCatId(null);
        setWorkedDate(toDateStr(new Date()));
        setWorkedFrom('');
        setWorkedTo('');
        setDuration('full_day');
        setDescription('');
        generateNewCode();
      }
    },
    [generateNewCode]
  );

  const openCreate = () => {
    setEditing(null);
    setFormMode(true);
    loadCategories();
    initializeForm(null);
  };

  const openEdit = (record: InLieuRequestRecord) => {
    setShowDetail(false);
    setEditing(record);
    setFormMode(true);
    loadCategories();
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

  const handleView = async (record: InLieuRequestRecord) => {
    setShowDetail(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await inLieuService.show(record.id);
      setDetail(res?.data ?? record);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to load request details.');
      setShowDetail(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (record: InLieuRequestRecord) => {
    const doDelete = async () => {
      setDeleting(true);
      try {
        const res = await inLieuService.destroy(record.id);
        alertMessage('Deleted', res?.message || 'In-lieu request deleted.');
        setShowDetail(false);
        await loadList();
      } catch (e: any) {
        alertMessage('Error', e?.message || 'Delete failed.');
      } finally {
        setDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this in-lieu request?')) doDelete();
    } else {
      Alert.alert('Delete Request', 'Delete this in-lieu request?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const selectedCategoryLabel =
    categoryOptions.find((o) => o.value === leaveCatId)?.label ?? '';

  const validateForm = (): string | null => {
    if (!code.trim()) return 'Request code is missing. Tap the refresh icon to generate one.';
    if (!leaveCatId) return 'Select the leave category.';
    if (!workedDate) return 'Select the worked date.';
    if (!workedFrom) return 'Select the worked from time.';
    if (!workedTo) return 'Select the worked to time.';
    if (dayInfo?.day_type === 'working') return "In-lieu isn't available for working days.";
    if (!description.trim()) return 'Description is required.';
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      alertMessage('Missing information', error);
      return;
    }

    const payload: InLieuPayload = {
      code: code.trim(),
      leave_cat_id: leaveCatId as number,
      worked_date: workedDate,
      worked_from: workedFrom,
      worked_to: workedTo,
      worked_hours: autoHours || null,
      duration,
      days: autoDays,
      check_in_time: null,
      check_out_time: null,
      description: description.trim(),
    };

    setSaving(true);
    try {
      const res = editing
        ? await inLieuService.update(editing.id, payload, document)
        : await inLieuService.store(payload, document);
      alertMessage('Success', res?.message || 'In-lieu request submitted.');
      setFormMode(false);
      setEditing(null);
      await loadList();
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to submit in-lieu request.');
    } finally {
      setSaving(false);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      const webFile = Platform.OS === 'web' && 'output' in result ? (result as any).output?.[0] ?? null : null;
      setDocument({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? null,
        webFile,
      });
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to pick a document.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const renderList = () => {
    if (loading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0041E8" />
          <Text style={styles.centerStateText}>Loading requests...</Text>
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
          <Ionicons name="swap-horizontal-outline" size={40} color="#CBD5E1" />
          <Text style={styles.centerStateText}>No in-lieu requests yet.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={openCreate} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Request In-Lieu</Text>
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
        <Text style={styles.sectionLabel}>MY IN-LIEU REQUESTS</Text>
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
                <Ionicons name="calendar-outline" size={13} color="#0041E8" />
                <Text style={styles.requestDatesText}>{niceDate(record.worked_date)}</Text>
                <Text style={styles.requestMetaText}>· {record.leave_category?.name ?? '—'}</Text>
              </View>

              <View style={styles.requestMetaRow}>
                <View style={styles.hoursBadge}>
                  <Text style={styles.hoursBadgeText}>
                    {DURATION_LABELS[record.duration ?? ''] ?? record.duration ?? '—'}
                  </Text>
                </View>
                {record.worked_from && record.worked_to ? (
                  <Text style={styles.requestMetaText}>
                    {record.worked_from} - {record.worked_to}
                    {record.worked_hours ? ` (${fmtHours(record.worked_hours)})` : ''}
                  </Text>
                ) : null}
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
        <Text style={styles.sectionLabel}>IN-LIEU DETAILS</Text>

        {/* Code */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            Code <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={styles.codeRow}>
            <TextInput
              style={[styles.input, styles.codeInput, styles.codeInputReadOnly]}
              value={code}
              editable={false}
              selectTextOnFocus={false}
              autoCapitalize="characters"
              placeholder="INLIEU-…"
              placeholderTextColor="#CBD5E1"
            />
            {!editing && (
              <TouchableOpacity style={styles.codeRefreshBtn} onPress={generateNewCode} disabled={generating}>
                <Ionicons name={generating ? 'sync-outline' : 'refresh-outline'} size={18} color="#0041E8" />
              </TouchableOpacity>
            )}
          </View>
          {!editing && <Text style={styles.fieldHint}>Tap the refresh icon to generate a new code.</Text>}
        </View>

        {/* Leave Category */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            Leave Category <Text style={styles.requiredStar}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.selectField}
            activeOpacity={0.8}
            onPress={() => categoryOptions.length > 0 && setCategoryPickerOpen(true)}
          >
            <Text style={selectedCategoryLabel ? styles.selectFieldValue : styles.selectFieldPlaceholder} numberOfLines={1}>
              {selectedCategoryLabel || (categoryOptions.length === 0 ? 'Loading options...' : 'Select category')}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Worked Date */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            Worked Date <Text style={styles.requiredStar}>*</Text>
          </Text>
          <DateTimePickerField mode="date" value={workedDate} onChange={setWorkedDate} placeholder="Select date" />
          <DayTypeBadge dayInfo={dayInfo} loading={dayChecking} />
        </View>

        {/* Duration */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            Duration <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={styles.segmentRow}>
            {DURATION_OPTIONS.map((opt) => {
              const selected = duration === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.segmentBtn, selected && styles.segmentBtnActive]}
                  activeOpacity={0.8}
                  onPress={() => setDuration(opt.value)}
                >
                  <Text style={[styles.segmentBtnText, selected && styles.segmentBtnTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.fieldHint}>{autoDays} day{autoDays === 1 ? '' : 's'} will be recorded.</Text>
        </View>

        {/* Worked From / To */}
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>
              Worked From <Text style={styles.requiredStar}>*</Text>
            </Text>
            <DateTimePickerField
              mode="time"
              value={workedFrom}
              onChange={(t) => {
                setWorkedFrom(t);
                if (t && workedTo && computeWorkedHours(t, workedTo) === '00:00') setWorkedTo('');
              }}
              placeholder="Set time"
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>
              Worked To <Text style={styles.requiredStar}>*</Text>
            </Text>
            <DateTimePickerField mode="time" value={workedTo} onChange={setWorkedTo} placeholder="Set time" />
          </View>
        </View>

        {/* Requested Time Summary */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>In</Text>
            <Text style={styles.summaryValue}>{workedFrom || '—'}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Out</Text>
            <Text style={styles.summaryValue}>{workedTo || '—'}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Worked</Text>
            <Text style={styles.summaryValue}>{autoHours || '—'}</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            Description <Text style={styles.requiredStar}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Enter description..."
            placeholderTextColor="#CBD5E1"
          />
        </View>

        {/* Attachment */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Attachment (optional)</Text>
          {document ? (
            <View style={styles.docSelectedRow}>
              <Ionicons name="document-attach-outline" size={18} color="#0041E8" />
              <Text style={styles.docName} numberOfLines={1}>{document.name}</Text>
              <TouchableOpacity onPress={() => setDocument(null)} hitSlop={8} style={styles.docRemoveBtn}>
                <Ionicons name="close" size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.docPickBtn} activeOpacity={0.85} onPress={pickDocument}>
              <Ionicons name="cloud-upload-outline" size={18} color="#0041E8" />
              <Text style={styles.docPickBtnText}>
                {editing ? 'Replace document (optional)' : 'Upload document'}
              </Text>
            </TouchableOpacity>
          )}
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
        <Text style={styles.headerTitle}>{formMode ? (editing ? 'Edit In-Lieu Request' : 'Request In-Lieu') : 'In Lieu'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {formMode ? (
        renderForm()
      ) : (
        <>
          {renderList()}
          <View style={styles.bottomBarFixed}>
            <TouchableOpacity style={styles.primaryActionButton} activeOpacity={0.88} onPress={openCreate}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.primaryActionButtonText}>REQUEST IN-LIEU</Text>
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

      <OptionPickerModal
        visible={categoryPickerOpen}
        title="Select Leave Category"
        options={categoryOptions}
        selectedValue={leaveCatId}
        onSelect={(v) => setLeaveCatId(Number(v))}
        onClose={() => setCategoryPickerOpen(false)}
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
    marginTop: 4,
  },
  listContent: { padding: 16, paddingBottom: 100 },

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
  requestTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  requestCode: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  requestMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' },
  requestMetaText: { fontSize: 12, color: '#64748B', flex: 1 },
  requestDatesText: { fontSize: 12, color: '#0041E8', fontWeight: '600' },
  hoursBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  hoursBadgeText: { fontSize: 11, fontWeight: '700', color: '#0041E8' },

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
  detailLoading: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  detailLoadingText: { fontSize: 13, color: '#64748B' },
  modalContent: { padding: 20, paddingBottom: 32 },
  detailTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  detailDates: { fontSize: 12, color: '#64748B', marginLeft: 8 },
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

  /* Day type badge */
  dayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  dayBadgeText: { fontSize: 12, color: '#475569' },
  dayBadgeSub: { fontSize: 10, color: '#64748B' },
  shiftChip: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    overflow: 'hidden',
  },

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
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectFieldValue: { fontSize: 13, color: '#0F172A', flex: 1, marginRight: 8 },
  selectFieldPlaceholder: { fontSize: 13, color: '#94A3B8', flex: 1, marginRight: 8 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: '#EEF2FF', borderColor: '#BFDBFE' },
  segmentBtnText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  segmentBtnTextActive: { color: '#0041E8', fontWeight: '700' },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  dateField: { flex: 1 },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: '#2563EB', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 14, fontWeight: '700', color: '#1E3A8A', marginTop: 4 },
  summaryDivider: { width: 1, backgroundColor: '#BFDBFE' },
  reasonInput: { minHeight: 80, textAlignVertical: 'top' },
  docPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#BFDBFE',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingVertical: 14,
  },
  docPickBtnText: { fontSize: 13, fontWeight: '600', color: '#0041E8' },
  docSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  docName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#166534' },
  docRemoveBtn: { padding: 2 },
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

  /* Picker */
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', padding: 24 },
  pickerSheet: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 8, maxHeight: '70%' },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', padding: 12, paddingBottom: 8 },
  pickerEmpty: { fontSize: 13, color: '#94A3B8', padding: 14, textAlign: 'center' },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  pickerItemActive: { backgroundColor: '#EEF2FF' },
  pickerItemText: { fontSize: 14, color: '#334155' },
  pickerItemTextActive: { color: '#0041E8', fontWeight: '700' },
});