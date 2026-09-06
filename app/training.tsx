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
  DurationUnit,
  OptionItem,
  ProviderType,
  TrainingDocumentFile,
  TrainingMode,
  TrainingPayload,
  TrainingRequestRecord,
  TrainingRequestType,
  trainingService,
} from '@/services/api/trainingService';
import DateTimePickerField from '@/components/DateTimePickerField';

// ─── Helpers ────────────────────────────────────────────────────────────────

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

const alertMessage = (title: string, msg: string) => {
  if (Platform.OS === 'web') alert(msg);
  else Alert.alert(title, msg);
};

const canModify = (r: TrainingRequestRecord): boolean =>
  Boolean(r.allow_edit) && String(r.status ?? '').toLowerCase() === 'pending';

// ─── Static option sets ─────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = { participate: 'Participate', need: 'Need Training' };
const TYPE_META: Record<string, { bg: string; text: string }> = {
  participate: { bg: '#DBEAFE', text: '#1D4ED8' },
  need:        { bg: '#F3E8FF', text: '#9333EA' },
};

const MODE_OPTIONS: { value: TrainingMode; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'hybrid', label: 'Hybrid' },
];

const PROVIDER_LABELS: Record<string, string> = {
  internal: 'Person in the organization',
  external: 'Person outside the organization',
};

const modeLabel = (m?: string | null): string =>
  MODE_OPTIONS.find((o) => o.value === (m as TrainingMode))?.label ??
  (m ? m.charAt(0).toUpperCase() + m.slice(1) : '—');

const fmtCost = (cost?: number | null, symbol?: string): string => {
  if (cost == null) return '—';
  const n = Number(cost);
  return `${symbol ?? ''} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
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
  record: TrainingRequestRecord | null;
  loading: boolean;
  visible: boolean;
  onClose: () => void;
  onEdit: (record: TrainingRequestRecord) => void;
  onDelete: (record: TrainingRequestRecord) => void;
  deleting: boolean;
}) {
  const r = record;
  const isParticipate = r?.request_type === 'participate';
  const typeMeta = TYPE_META[r?.request_type ?? 'need'];

  const detailRows: [string, string][] = r
    ? [
        ['Code', r.code],
        ['Employee', r.employee?.name ?? '—'],
        ['Training name', r.training_name],
        ['Category', r.training_type?.name ?? '—'],
        ['Mode', modeLabel(r.mode)],
      ]
    : [];

  if (isParticipate) {
    detailRows.push(
      ['Organized by', r!.organized_by ?? '—'],
      ['Country', r!.country?.name ?? '—'],
      ['Place', r!.place ?? '—'],
      ['Period', `${niceDate(r!.period_from)} → ${niceDate(r!.period_to)}`],
      ['Participation cost', fmtCost(r!.participation_cost ?? null, r!.currency?.symbol)]
    );
  } else if (r) {
    detailRows.push(
      ['Duration', r.duration_value != null ? `${r.duration_value} ${r.duration_unit ?? ''}` : '—'],
      ['Provider', r.provider_type ? PROVIDER_LABELS[r.provider_type] as string : '—']
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Training Request</Text>
              <Text style={styles.modalSubtitle}>{r?.code ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {loading || !r ? (
            <View style={styles.detailLoading}>
              <ActivityIndicator size="large" color="#0041E8" />
              <Text style={styles.detailLoadingText}>Loading request…</Text>
            </View>
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
                <View style={styles.detailTopRow}>
                  <View style={[styles.typePill, { backgroundColor: typeMeta.bg }]}>
                    <Text style={[styles.typePillText, { color: typeMeta.text }]}>{TYPE_LABELS[r.request_type] ?? r.request_type}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: statusMeta(r.status).bg }]}>
                    <Text style={[styles.statusPillText, { color: statusMeta(r.status).text }]}>{statusLabel(r.status)}</Text>
                  </View>
                </View>

                <View style={styles.empGrid}>
                  {detailRows.map(([label, value]) => (
                    <View key={label} style={styles.empGridItem}>
                      <Text style={styles.empGridLabel}>{label}:</Text>
                      <Text style={styles.empGridValue} numberOfLines={1}>{value}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>SHORT DESCRIPTION</Text>
                  <Text style={styles.reasonText}>{r.short_description || '—'}</Text>
                </View>

                {!isParticipate && r.provider_details && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>PROVIDER DETAILS</Text>
                    <Text style={styles.reasonText}>{r.provider_details}</Text>
                  </View>
                )}

                {(r.attachments ?? []).length > 0 && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>ATTACHMENTS</Text>
                    {(r.attachments ?? []).map((a) => (
                      <Text key={a.id} style={styles.attachmentText} numberOfLines={1}>
                        • {a.file_name}
                      </Text>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View style={styles.detailActions}>
                {canModify(r) && (
                  <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(r)} activeOpacity={0.88}>
                    <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                )}
                {canModify(r) && (
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => onDelete(r)}
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

// ─── Option picker modal ────────────────────────────────────────────────────

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

// ─── Main screen ────────────────────────────────────────────────────────────

export default function TrainingScreen() {
  const router = useRouter();

  // List state
  const [requests, setRequests] = useState<TrainingRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Detail state
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<TrainingRequestRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formMode, setFormMode] = useState(false);
  const [editing, setEditing] = useState<TrainingRequestRecord | null>(null);
  const [requestType, setRequestType] = useState<TrainingRequestType>('participate');
  const [code, setCode] = useState('');
  const [trainingName, setTrainingName] = useState('');
  const [trainingTypeId, setTrainingTypeId] = useState<number | null>(null);
  const [mode, setMode] = useState<TrainingMode | ''>('');
  const [shortDescription, setShortDescription] = useState('');
  // participate
  const [organizedBy, setOrganizedBy] = useState('');
  const [countryId, setCountryId] = useState<number | null>(null);
  const [place, setPlace] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [currencyId, setCurrencyId] = useState<number | null>(null);
  const [participationCost, setParticipationCost] = useState('');
  // need
  const [durationValue, setDurationValue] = useState('');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('days');
  const [providerType, setProviderType] = useState<ProviderType>('internal');
  const [providerDetails, setProviderDetails] = useState('');
  // misc
  const [document, setDocument] = useState<TrainingDocumentFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Option lookups
  const [types, setTypes] = useState<OptionItem[]>([]);
  const [countries, setCountries] = useState<OptionItem[]>([]);
  const [currencies, setCurrencies] = useState<OptionItem[]>([]);
  const [picker, setPicker] = useState<'type' | 'mode' | 'country' | 'currency' | null>(null);

  const loadList = useCallback(async () => {
    try {
      const res = await trainingService.list();
      setRequests(res?.data ?? []);
      setListError(null);
    } catch (e: any) {
      setListError(e?.message || 'Failed to load training requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadOptions = useCallback(async () => {
    try {
      const [t, c, cu] = await Promise.all([
        trainingService.types(),
        trainingService.countries(),
        trainingService.currencies(),
      ]);
      setTypes(t?.data ?? []);
      setCountries(c?.data ?? []);
      setCurrencies(cu?.data ?? []);
    } catch {
      // Options are optional; submission time validates anyway.
    }
  }, []);

  const generateNewCode = useCallback(async () => {
    setGenerating(true);
    try {
      const generated = await trainingService.generateCode();
      if (generated) setCode(generated);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to generate code.');
    } finally {
      setGenerating(false);
    }
  }, []);

  const initializeForm = useCallback(
    (record: TrainingRequestRecord | null) => {
      setRequestType(record?.request_type ?? 'participate');
      setTrainingName(record?.training_name ?? '');
      setTrainingTypeId(record?.training_type_id ?? null);
      setMode((record?.mode ?? '') as TrainingMode | '');
      setShortDescription(record?.short_description ?? '');
      setOrganizedBy(record?.organized_by ?? '');
      setCountryId(record?.country_id ?? null);
      setPlace(record?.place ?? '');
      setPeriodFrom(record?.period_from ?? '');
      setPeriodTo(record?.period_to ?? '');
      setCurrencyId(record?.currency_id ?? null);
      setParticipationCost(record?.participation_cost != null ? String(record.participation_cost) : '');
      setDurationValue(record?.duration_value != null ? String(record.duration_value) : '');
      setDurationUnit(record?.duration_unit ?? 'days');
      setProviderType(record?.provider_type ?? 'internal');
      setProviderDetails(record?.provider_details ?? '');
      setDocument(null);
      if (record) {
        setCode(record.code);
      } else {
        setCode('');
        generateNewCode();
      }
    },
    [generateNewCode]
  );

  const openCreate = () => {
    setEditing(null);
    setFormMode(true);
    loadOptions();
    initializeForm(null);
  };

  const openEdit = (record: TrainingRequestRecord) => {
    setShowDetail(false);
    setEditing(record);
    setFormMode(true);
    loadOptions();
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

  const handleView = async (record: TrainingRequestRecord) => {
    setShowDetail(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await trainingService.show(record.id);
      setDetail(res?.data ?? record);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to load request details.');
      setShowDetail(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (record: TrainingRequestRecord) => {
    const doDelete = async () => {
      setDeleting(true);
      try {
        const res = await trainingService.destroy(record.id);
        alertMessage('Deleted', res?.message || 'Training request deleted.');
        setShowDetail(false);
        await loadList();
      } catch (e: any) {
        alertMessage('Error', e?.message || 'Delete failed.');
      } finally {
        setDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this training request?')) doDelete();
    } else {
      Alert.alert('Delete Request', 'Delete this training request?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
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

  const validateForm = (): string | null => {
    if (!code.trim()) return 'Request code is missing. Tap the refresh icon to generate one.';
    if (!trainingName.trim()) return 'Training name is required.';
    if (!trainingTypeId) return 'Select a training category.';
    if (!mode) return 'Select the training mode.';
    if (!shortDescription.trim()) return 'Short description is required.';
    if (requestType === 'participate') {
      if (!organizedBy.trim()) return 'Organized by is required.';
      if (!countryId) return 'Select a country.';
      if (!place.trim()) return 'Place is required.';
      if (!periodFrom || !periodTo) return 'Select the training period.';
      if (periodTo < periodFrom) return 'Period to must be on or after period from.';
      if (!currencyId) return 'Select a currency.';
      if (participationCost === '' || Number.isNaN(Number(participationCost))) {
        return 'Enter the participation cost.';
      }
      if (Number(participationCost) < 0) return 'Participation cost cannot be negative.';
    } else {
      if (durationValue === '' || Number.isNaN(Number(durationValue))) return 'Enter the training duration.';
      if (Number(durationValue) < 0) return 'Duration cannot be negative.';
      if (!providerDetails.trim()) return 'Provider details are required.';
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      alertMessage('Missing information', error);
      return;
    }

    const payload: TrainingPayload = {
      code: code.trim(),
      request_type: requestType,
      training_name: trainingName.trim(),
      training_type_id: trainingTypeId!,
      mode: mode as TrainingMode,
      short_description: shortDescription.trim(),
      // participate
      organized_by: requestType === 'participate' ? organizedBy.trim() : null,
      country_id: requestType === 'participate' ? countryId : null,
      place: requestType === 'participate' ? place.trim() : null,
      period_from: requestType === 'participate' ? periodFrom : null,
      period_to: requestType === 'participate' ? periodTo : null,
      currency_id: requestType === 'participate' ? currencyId : null,
      participation_cost: requestType === 'participate' ? Number(participationCost) : null,
      // need
      duration_value: requestType === 'need' ? Number(durationValue) : null,
      duration_unit: requestType === 'need' ? durationUnit : null,
      provider_type: requestType === 'need' ? providerType : null,
      provider_details: requestType === 'need' ? providerDetails.trim() : null,
    };

    setSaving(true);
    try {
      const res = editing
        ? await trainingService.update(editing.id, payload, document)
        : await trainingService.store(payload, document);
      alertMessage('Success', res?.message || 'Training request submitted.');
      setFormMode(false);
      setEditing(null);
      await loadList();
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to submit training request.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

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
          <Ionicons name="school-outline" size={40} color="#CBD5E1" />
          <Text style={styles.centerStateText}>No training requests yet.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={openCreate} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Request Training</Text>
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
        <Text style={styles.sectionLabel}>MY TRAINING REQUESTS</Text>
        {requests.map((record) => {
          const meta = statusMeta(record.status);
          const typeMeta = TYPE_META[record.request_type] ?? TYPE_META.need;
          const isParticipate = record.request_type === 'participate';
          return (
            <TouchableOpacity key={record.id} style={styles.requestCard} activeOpacity={0.85} onPress={() => handleView(record)}>
              <View style={styles.requestTopRow}>
                <View style={[styles.typePill, { backgroundColor: typeMeta.bg }]}>
                  <Text style={[styles.typePillText, { color: typeMeta.text }]}>
                    {TYPE_LABELS[record.request_type] ?? record.request_type}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.statusPillText, { color: meta.text }]}>{statusLabel(record.status)}</Text>
                </View>
              </View>

              <Text style={styles.requestTitle}>{record.training_name}</Text>
              <Text style={styles.requestCode}>{record.code}</Text>

              <View style={styles.requestMetaRow}>
                <Ionicons name="layers-outline" size={13} color="#64748B" />
                <Text style={styles.requestMetaText}>{record.training_type?.name ?? 'Uncategorized'}</Text>
                <Ionicons name="videocam-outline" size={13} color="#64748B" />
                <Text style={styles.requestMetaText}>{modeLabel(record.mode)}</Text>
              </View>

              <View style={styles.requestMetaRow}>
                <Ionicons name="calendar-outline" size={13} color="#0041E8" />
                {isParticipate ? (
                  <Text style={styles.requestDatesText}>
                    {niceDate(record.period_from)} → {niceDate(record.period_to)}
                  </Text>
                ) : (
                  <Text style={styles.requestDatesText}>
                    {record.duration_value != null ? `${record.duration_value} ${record.duration_unit ?? ''}` : '—'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderForm = () => {
    const isParticipate = requestType === 'participate';

    return (
      <KeyboardAvoidingView style={styles.formContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Type switcher (matches web portal) */}
          <View style={styles.typeSwitch}>
            <TouchableOpacity
              style={[styles.typeSwitchBtn, isParticipate && styles.typeSwitchBtnActive]}
              activeOpacity={0.85}
              onPress={() => setRequestType('participate')}
            >
              <Text style={[styles.typeSwitchText, isParticipate && styles.typeSwitchTextActive]}>I want to Participate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeSwitchBtn, !isParticipate && styles.typeSwitchBtnActive]}
              activeOpacity={0.85}
              onPress={() => setRequestType('need')}
            >
              <Text style={[styles.typeSwitchText, !isParticipate && styles.typeSwitchTextActive]}>I need a Training</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>TRAINING DETAILS</Text>

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
                placeholder="TRAREQ-…"
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

          {/* Training name */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>
              Training name <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={trainingName}
              onChangeText={setTrainingName}
              placeholder="Enter training name"
              placeholderTextColor="#CBD5E1"
            />
          </View>

          {/* Training category */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>
              Training category <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TouchableOpacity style={styles.selectField} activeOpacity={0.8} onPress={() => setPicker('type')}>
              {trainingTypeId ? (
                <Text style={styles.selectFieldValue} numberOfLines={1}>
                  {types.find((t) => t.value === trainingTypeId)?.label ?? 'Loading…'}
                </Text>
              ) : (
                <Text style={styles.selectFieldPlaceholder}>Choose category…</Text>
              )}
              <Ionicons name="chevron-down" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Mode (shared) */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>
              Mode <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TouchableOpacity style={styles.selectField} activeOpacity={0.8} onPress={() => setPicker('mode')}>
              {mode ? (
                <Text style={styles.selectFieldValue}>{modeLabel(mode)}</Text>
              ) : (
                <Text style={styles.selectFieldPlaceholder}>Choose mode…</Text>
              )}
              <Ionicons name="chevron-down" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* ── Participate-only ── */}
          {isParticipate && (
            <>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>
                  Organized by <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={organizedBy}
                  onChangeText={setOrganizedBy}
                  placeholder="Enter organizer name"
                  placeholderTextColor="#CBD5E1"
                />
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>
                  Country <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TouchableOpacity style={styles.selectField} activeOpacity={0.8} onPress={() => setPicker('country')}>
                  {countryId ? (
                    <Text style={styles.selectFieldValue} numberOfLines={1}>
                      {countries.find((c) => c.value === countryId)?.label ?? 'Loading…'}
                    </Text>
                  ) : (
                    <Text style={styles.selectFieldPlaceholder}>Choose country…</Text>
                  )}
                  <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>
                  Place <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={place}
                  onChangeText={setPlace}
                  placeholder="Enter place / venue"
                  placeholderTextColor="#CBD5E1"
                />
              </View>

              {/* Training period */}
              <Text style={styles.fieldLabel}>
                Training period <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.dateRow}>
                <View style={styles.dateField}>
                  <DateTimePickerField
                    mode="date"
                    value={periodFrom}
                    onChange={(t) => {
                      setPeriodFrom(t);
                      if (periodTo && t > periodTo) setPeriodTo(t);
                    }}
                    placeholder="From"
                  />
                </View>
                <View style={styles.dateField}>
                  <DateTimePickerField mode="date" value={periodTo} onChange={setPeriodTo} placeholder="To" />
                </View>
              </View>

              {/* Participation cost */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>
                  Participation cost <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.costRow}>
                  <TouchableOpacity style={styles.costCurrencyBtn} activeOpacity={0.8} onPress={() => setPicker('currency')}>
                    {currencyId ? (
                      <Text style={styles.costCurrencyText} numberOfLines={1}>
                        {currencies.find((cu) => cu.value === currencyId)?.label ?? 'Loading…'}
                      </Text>
                    ) : (
                      <Text style={styles.costCurrencyPlaceholder}>Currency</Text>
                    )}
                    <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.input, styles.costAmountInput]}
                    value={participationCost}
                    onChangeText={setParticipationCost}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#CBD5E1"
                  />
                </View>
              </View>
            </>
          )}

          {/* Short description (shared) */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>
              Short description <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.reasonInput]}
              value={shortDescription}
              onChangeText={setShortDescription}
              multiline
              placeholder="Enter short description…"
              placeholderTextColor="#CBD5E1"
            />
          </View>

          {/* ── Need-only fields ── */}
          {!isParticipate && (
            <>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>
                  Duration <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.durationRow}>
                  <TextInput
                    style={[styles.input, styles.durationValueInput]}
                    value={durationValue}
                    onChangeText={setDurationValue}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor="#CBD5E1"
                  />
                  <View style={styles.durationChips}>
                    {(['days', 'hours'] as const).map((unit) => {
                      const selected = durationUnit === unit;
                      return (
                        <TouchableOpacity
                          key={unit}
                          style={[styles.durationChip, selected && styles.durationChipActive]}
                          activeOpacity={0.8}
                          onPress={() => setDurationUnit(unit)}
                        >
                          <Text style={[styles.durationChipText, selected && styles.durationChipTextActive]}>{unit}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>
                  Training to be provided by <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.providerRow}>
                  <TouchableOpacity
                    style={[styles.providerChip, providerType === 'internal' && styles.providerChipActive]}
                    activeOpacity={0.8}
                    onPress={() => setProviderType('internal')}
                  >
                    <Text style={[styles.providerChipText, providerType === 'internal' && styles.providerChipTextActive]}>
                      Person in the organization
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.providerChip, providerType === 'external' && styles.providerChipActive]}
                    activeOpacity={0.8}
                    onPress={() => setProviderType('external')}
                  >
                    <Text style={[styles.providerChipText, providerType === 'external' && styles.providerChipTextActive]}>
                      Person outside the organization
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>
                  Name of the person who can provide this training (name, phone, department) <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, styles.reasonInput]}
                  value={providerDetails}
                  onChangeText={setProviderDetails}
                  multiline
                  placeholder="Enter provider details…"
                  placeholderTextColor="#CBD5E1"
                />
              </View>
            </>
          )}

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
                  {editing ? 'Replace document (optional)' : 'Upload pdf or image (max 2 MB)'}
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
              <Text style={styles.submitBtnText}>{editing ? 'UPDATE REQUEST' : 'SEND REQUEST'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0041E8" />
      <View style={styles.blueHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (formMode ? closeForm() : router.back())}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{formMode ? (editing ? 'Edit Training Request' : 'Request Training') : 'Training Requests'}</Text>
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
              <Text style={styles.primaryActionButtonText}>REQUEST TRAINING</Text>
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

      {picker === 'type' && (
        <OptionPickerModal
          visible
          title="Select Training Category"
          options={types}
          selectedValue={trainingTypeId}
          onSelect={(v) => setTrainingTypeId(Number(v))}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'mode' && (
        <OptionPickerModal
          visible
          title="Select Mode"
          options={MODE_OPTIONS}
          selectedValue={mode || null}
          onSelect={(v) => setMode(v as TrainingMode)}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'country' && (
        <OptionPickerModal
          visible
          title="Select Country"
          options={countries}
          selectedValue={countryId}
          onSelect={(v) => setCountryId(Number(v))}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'currency' && (
        <OptionPickerModal
          visible
          title="Select Currency"
          options={currencies}
          selectedValue={currencyId}
          onSelect={(v) => setCurrencyId(Number(v))}
          onClose={() => setPicker(null)}
        />
      )}
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
  retryBtn: { marginTop: 4, backgroundColor: '#0041E8', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
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
  requestTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  requestTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  requestCode: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 8 },
  typePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  typePillText: { fontSize: 11, fontWeight: '800' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  requestMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  requestMetaText: { fontSize: 12, color: '#64748B' },
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
  modalSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  modalCloseBtn: { padding: 6 },
  modalContent: { padding: 20, paddingBottom: 32 },
  detailLoading: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 10 },
  detailLoadingText: { fontSize: 13, color: '#64748B' },
  detailTopRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 14 },
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

  /* Form */
  formContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  formContent: { padding: 16, paddingBottom: 48 },
  typeSwitch: { flexDirection: 'row', backgroundColor: '#EEF2FF', borderRadius: 12, padding: 4, marginBottom: 8 },
  typeSwitchBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  typeSwitchBtnActive: { backgroundColor: '#FFFFFF', elevation: 2 },
  typeSwitchText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  typeSwitchTextActive: { color: '#0041E8' },
  fieldBlock: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 8 },
  requiredStar: { color: '#DC2626' },
  fieldHint: { fontSize: 11, color: '#94A3B8', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  codeInput: { flex: 1 },
  codeInputReadOnly: { backgroundColor: '#F1F5F9', color: '#64748B' },
  codeRefreshBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  selectFieldValue: { fontSize: 15, color: '#0F172A', flex: 1, marginRight: 8 },
  selectFieldPlaceholder: { fontSize: 15, color: '#94A3B8', flex: 1, marginRight: 8 },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1 },
  costRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  costCurrencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
    minWidth: 120,
  },
  costCurrencyText: { fontSize: 14, color: '#0F172A', flex: 1, fontWeight: '600' },
  costCurrencyPlaceholder: { fontSize: 14, color: '#94A3B8', flex: 1 },
  costAmountInput: { flex: 1 },
  reasonInput: { minHeight: 96, textAlignVertical: 'top' },
  durationRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  durationValueInput: { width: 110 },
  durationChips: { flexDirection: 'row', gap: 8, flex: 1 },
  durationChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  durationChipActive: { backgroundColor: '#EEF2FF', borderColor: '#BFDBFE' },
  durationChipText: { fontSize: 13, fontWeight: '600', color: '#475569', textTransform: 'capitalize' },
  durationChipTextActive: { color: '#0041E8', fontWeight: '700' },
  providerRow: { gap: 10 },
  providerChip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  providerChipActive: { backgroundColor: '#EEF2FF', borderColor: '#BFDBFE' },
  providerChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  providerChipTextActive: { color: '#0041E8', fontWeight: '700' },
  docPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
  },
  docPickBtnText: { fontSize: 13, fontWeight: '600', color: '#0041E8' },
  docSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  docName: { flex: 1, fontSize: 13, color: '#0F172A' },
  docRemoveBtn: { padding: 4 },
  submitBtn: {
    backgroundColor: '#0041E8',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
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
  pickerEmpty: { fontSize: 13, color: '#94A3B8', padding: 16 },
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