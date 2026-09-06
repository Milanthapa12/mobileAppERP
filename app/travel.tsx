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
  TravelDocumentFile,
  TravelModeOption,
  TravelPayload,
  TravelRequestRecord,
  TravelType,
  travelService,
} from '@/services/api/travelService';
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

const fmtAmount = (n?: number | null): string => {
  if (n == null || isNaN(Number(n))) return '—';
  const num = Number(n);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const alertMessage = (title: string, msg: string) => {
  if (Platform.OS === 'web') alert(msg);
  else Alert.alert(title, msg);
};

const TRAVEL_TYPE_OPTIONS: { value: TravelType; label: string }[] = [
  { value: 'domestic', label: 'Domestic' },
  { value: 'international', label: 'International' },
];

const travelTypeLabel = (t?: TravelType): string =>
  TRAVEL_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? '—';

const canModify = (r: TravelRequestRecord): boolean =>
  r.allow_edit && String(r.status ?? '').toLowerCase() === 'pending';

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
  record: TravelRequestRecord | null;
  loading: boolean;
  visible: boolean;
  onClose: () => void;
  onEdit: (record: TravelRequestRecord) => void;
  onDelete: (record: TravelRequestRecord) => void;
  deleting: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Travel Request</Text>
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
                  <Text style={styles.detailDates}>{record.created_at ? niceDate(record.created_at) : ''}</Text>
                </View>

                <View style={styles.empGrid}>
                  {[
                    ['Code', record.code],
                    ['Travel Name', record.travel_name],
                    ['Travel Type', travelTypeLabel(record.travel_type)],
                    ['From', record.departure_from],
                    ['Destination', record.destination],
                    ['Advance Amount', fmtAmount(record.advance_amount)],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.empGridItem}>
                      <Text style={styles.empGridLabel}>{label}:</Text>
                      <Text style={styles.empGridValue} numberOfLines={1}>{value}</Text>
                    </View>
                  ))}
                  <View style={styles.empGridItem}>
                    <Text style={styles.empGridLabel}>Departure:</Text>
                    <Text style={styles.empGridValue} numberOfLines={1}>
                      {niceDate(record.departure_date)}
                      {record.departure_time ? ` · ${record.departure_time}` : ''}
                    </Text>
                  </View>
                  <View style={styles.empGridItem}>
                    <Text style={styles.empGridLabel}>Arrival:</Text>
                    <Text style={styles.empGridValue} numberOfLines={1}>
                      {niceDate(record.arrival_date)}
                      {record.arrival_time ? ` · ${record.arrival_time}` : ''}
                    </Text>
                  </View>
                </View>

                {(record.travel_modes ?? []).length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>MODE OF TRANSPORT</Text>
                    <View style={styles.modeChipsRow}>
                      {(record.travel_modes ?? []).map((m) => (
                        <View key={m.id} style={styles.modeChip}>
                          <Ionicons name="bus-outline" size={12} color="#0041E8" />
                          <Text style={styles.modeChipText}>{m.name}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {record.purpose_of_travel ? (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>PURPOSE OF TRAVEL</Text>
                    <Text style={styles.reasonText}>{record.purpose_of_travel}</Text>
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

export default function TravelScreen() {
  const router = useRouter();

  // List state
  const [requests, setRequests] = useState<TravelRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Detail state
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<TravelRequestRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formMode, setFormMode] = useState(false);
  const [editing, setEditing] = useState<TravelRequestRecord | null>(null);
  const [code, setCode] = useState('');
  const [travelName, setTravelName] = useState('');
  const [travelType, setTravelType] = useState<TravelType>('domestic');
  const [departureFrom, setDepartureFrom] = useState('');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState(toDateStr(new Date()));
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalDate, setArrivalDate] = useState(toDateStr(new Date()));
  const [arrivalTime, setArrivalTime] = useState('');
  const [advanceText, setAdvanceText] = useState('');
  const [purpose, setPurpose] = useState('');
  const [travelModeOptions, setTravelModeOptions] = useState<TravelModeOption[]>([]);
  const [selectedModes, setSelectedModes] = useState<number[]>([]);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [document, setDocument] = useState<TravelDocumentFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const res = await travelService.list();
      setRequests(res?.data ?? []);
      setListError(null);
    } catch (e: any) {
      setListError(e?.message || 'Failed to load travel requests.');
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
      const generated = await travelService.generateCode();
      if (generated) setCode(generated);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to generate code.');
    } finally {
      setGenerating(false);
    }
  }, []);

  const loadModes = useCallback(async () => {
    try {
      const res = await travelService.modes();
      setTravelModeOptions(res?.data ?? []);
    } catch {
      // Options are optional; submission time validates anyway.
    }
  }, []);

  const initializeForm = useCallback(
    (record: TravelRequestRecord | null) => {
      setDocument(null);
      if (record) {
        setCode(record.code);
        setTravelName(record.travel_name);
        setTravelType(record.travel_type ?? 'domestic');
        setDepartureFrom(record.departure_from);
        setDestination(record.destination);
        setDepartureDate(record.departure_date);
        setDepartureTime(record.departure_time ?? '');
        setArrivalDate(record.arrival_date);
        setArrivalTime(record.arrival_time ?? '');
        setAdvanceText(record.advance_amount != null ? String(record.advance_amount) : '');
        setPurpose(record.purpose_of_travel ?? '');
        setSelectedModes((record.travel_mode_ids ?? []).slice());
      } else {
        setCode('');
        setTravelName('');
        setTravelType('domestic');
        setDepartureFrom('');
        setDestination('');
        const today = toDateStr(new Date());
        setDepartureDate(today);
        setDepartureTime('');
        setArrivalDate(today);
        setArrivalTime('');
        setAdvanceText('');
        setPurpose('');
        setSelectedModes([]);
        generateNewCode();
      }
    },
    [generateNewCode]
  );

  const openCreate = () => {
    setEditing(null);
    setFormMode(true);
    loadModes();
    initializeForm(null);
  };

  const openEdit = (record: TravelRequestRecord) => {
    setShowDetail(false);
    setEditing(record);
    setFormMode(true);
    loadModes();
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

  const handleView = async (record: TravelRequestRecord) => {
    setShowDetail(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await travelService.show(record.id);
      setDetail(res?.data ?? record);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to load request details.');
      setShowDetail(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (record: TravelRequestRecord) => {
    const doDelete = async () => {
      setDeleting(true);
      try {
        const res = await travelService.destroy(record.id);
        alertMessage('Deleted', res?.message || 'Travel request deleted.');
        setShowDetail(false);
        await loadList();
      } catch (e: any) {
        alertMessage('Error', e?.message || 'Delete failed.');
      } finally {
        setDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this travel request?')) doDelete();
    } else {
      Alert.alert('Delete Request', 'Delete this travel request?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const toggleMode = (id: number) => {
    setSelectedModes((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const validateForm = (): string | null => {
    if (!code.trim()) return 'Request code is missing. Tap the refresh icon to generate one.';
    if (!travelName.trim()) return 'Travel name is required.';
    if (!departureFrom.trim()) return 'Departure from is required.';
    if (!destination.trim()) return 'Destination is required.';
    if (!departureDate) return 'Select the departure date.';
    if (!arrivalDate) return 'Select the arrival date.';
    if (arrivalDate < departureDate) return 'Arrival date must be on or after the departure date.';
    if (advanceText.trim()) {
      const amt = Number(advanceText);
      if (isNaN(amt) || amt < 0) return 'Advance amount must be zero or a positive number.';
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      alertMessage('Missing information', error);
      return;
    }

    const payload: TravelPayload = {
      code: code.trim(),
      travel_name: travelName.trim(),
      travel_type: travelType,
      departure_from: departureFrom.trim(),
      destination: destination.trim(),
      departure_date: departureDate,
      arrival_date: arrivalDate,
      departure_time: departureTime || null,
      arrival_time: arrivalTime || null,
      advance_amount: advanceText.trim() ? Number(advanceText) : null,
      purpose_of_travel: purpose.trim() || null,
      travel_mode_ids: selectedModes,
    };

    setSaving(true);
    try {
      const res = editing
        ? await travelService.update(editing.id, payload, document)
        : await travelService.store(payload, document);
      alertMessage('Success', res?.message || 'Travel request submitted.');
      setFormMode(false);
      setEditing(null);
      await loadList();
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to submit travel request.');
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
          <Ionicons name="airplane-outline" size={40} color="#CBD5E1" />
          <Text style={styles.centerStateText}>No travel requests yet.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={openCreate} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Request Travel</Text>
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
        <Text style={styles.sectionLabel}>MY TRAVEL REQUESTS</Text>
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

              <Text style={styles.requestName} numberOfLines={1}>{record.travel_name}</Text>

              <View style={styles.requestMetaRow}>
                <Ionicons name="navigate-outline" size={13} color="#64748B" />
                <Text style={styles.requestMetaText} numberOfLines={1}>
                  {record.departure_from} → {record.destination}
                </Text>
              </View>

              <View style={styles.requestMetaRow}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{travelTypeLabel(record.travel_type)}</Text>
                </View>
                <Ionicons name="calendar-outline" size={13} color="#0041E8" />
                <Text style={styles.requestDatesText}>
                  {niceDate(record.departure_date)}
                  {record.departure_time ? ` ${record.departure_time}` : ''} → {niceDate(record.arrival_date)}
                  {record.arrival_time ? ` ${record.arrival_time}` : ''}
                </Text>
              </View>

              {record.advance_amount != null && Number(record.advance_amount) > 0 && (
                <View style={styles.requestMetaRow}>
                  <Ionicons name="cash-outline" size={13} color="#64748B" />
                  <Text style={styles.requestMetaText}>Advance: {fmtAmount(record.advance_amount)}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const selectedModeNames = selectedModes
    .map((id) => travelModeOptions.find((o) => o.value === id)?.label)
    .filter(Boolean)
    .join(', ');

  const renderForm = () => (
    <KeyboardAvoidingView style={styles.formContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>TRAVEL DETAILS</Text>

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
              placeholder="TRA-…"
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

        {/* Travel Name */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            Travel Name <Text style={styles.requiredStar}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={travelName}
            onChangeText={setTravelName}
            placeholder="Enter travel name"
            placeholderTextColor="#CBD5E1"
          />
        </View>

        {/* Travel Type */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            Travel Type <Text style={styles.requiredStar}>*</Text>
          </Text>
          <View style={styles.segmentRow}>
            {TRAVEL_TYPE_OPTIONS.map((opt) => {
              const selected = travelType === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.segmentBtn, selected && styles.segmentBtnActive]}
                  activeOpacity={0.8}
                  onPress={() => setTravelType(opt.value)}
                >
                  <Text style={[styles.segmentBtnText, selected && styles.segmentBtnTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Departure / Destination */}
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>
              Departure From <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={departureFrom}
              onChangeText={setDepartureFrom}
              placeholder="e.g. Kathmandu"
              placeholderTextColor="#CBD5E1"
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>
              Destination <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={destination}
              onChangeText={setDestination}
              placeholder="e.g. Dhaka"
              placeholderTextColor="#CBD5E1"
            />
          </View>
        </View>

        {/* Departure date + time */}
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>
              Departure Date <Text style={styles.requiredStar}>*</Text>
            </Text>
            <DateTimePickerField mode="date" value={departureDate} onChange={setDepartureDate} placeholder="Date" />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>Departure Time</Text>
            <DateTimePickerField
              mode="time"
              value={departureTime}
              onChange={(t) => {
                setDepartureTime(t);
                if (t && arrivalDate === departureDate && !arrivalTime) setArrivalTime(t);
              }}
              placeholder="Set time"
            />
          </View>
        </View>

        {/* Arrival date + time */}
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>
              Arrival Date <Text style={styles.requiredStar}>*</Text>
            </Text>
            <DateTimePickerField
              mode="date"
              value={arrivalDate}
              onChange={(t) => {
                setArrivalDate(t);
                if (t < departureDate) setArrivalDate(departureDate);
              }}
              placeholder="Date"
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>Arrival Time</Text>
            <DateTimePickerField mode="time" value={arrivalTime} onChange={setArrivalTime} placeholder="Set time" />
          </View>
        </View>

        {/* Advance amount + travel modes */}
        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>Advance Amount</Text>
            <TextInput
              style={styles.input}
              value={advanceText}
              onChangeText={(t) => setAdvanceText(t.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              placeholder="e.g. 5000"
              placeholderTextColor="#CBD5E1"
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>Mode of Transport</Text>
            <TouchableOpacity
              style={styles.selectField}
              activeOpacity={0.8}
              onPress={() => travelModeOptions.length > 0 && setModePickerOpen(true)}
            >
              <Text style={selectedModes.length > 0 ? styles.selectFieldValue : styles.selectFieldPlaceholder} numberOfLines={1}>
                {selectedModeNames || 'Select modes'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Purpose */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Purpose of Travel</Text>
          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={purpose}
            onChangeText={setPurpose}
            multiline
            placeholder="Enter purpose of travel..."
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
        <Text style={styles.headerTitle}>{formMode ? (editing ? 'Edit Travel Request' : 'Request Travel') : 'Travel'}</Text>
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
              <Text style={styles.primaryActionButtonText}>REQUEST TRAVEL</Text>
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

      <Modal visible={modePickerOpen} transparent animationType="fade" onRequestClose={() => setModePickerOpen(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setModePickerOpen(false)}>
          <TouchableOpacity style={styles.pickerSheet} activeOpacity={1} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Mode of Transport</Text>
            {travelModeOptions.map((opt) => {
              const selected = selectedModes.includes(opt.value);
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.pickerItem, selected && styles.pickerItemActive]}
                  activeOpacity={0.7}
                  onPress={() => toggleMode(opt.value)}
                >
                  <Text style={[styles.pickerItemText, selected && styles.pickerItemTextActive]}>{opt.label}</Text>
                  <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={selected ? '#0041E8' : '#CBD5E1'} />
                </TouchableOpacity>
              );
            })}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  requestName: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  requestMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' },
  requestMetaText: { fontSize: 12, color: '#64748B', flex: 1 },
  requestDatesText: { fontSize: 12, color: '#0041E8', fontWeight: '600' },
  typeBadge: {
    backgroundColor: '#6366F1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF', textTransform: 'capitalize' },

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
  modeChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EEF2FF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modeChipText: { fontSize: 12, fontWeight: '600', color: '#0041E8' },
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
  segmentBtnText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  segmentBtnTextActive: { color: '#0041E8', fontWeight: '700' },
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
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', padding: 24 },
  pickerSheet: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 8, maxHeight: '70%' },
  pickerTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', padding: 12, paddingBottom: 8 },
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
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  dateField: { flex: 1 },
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
});