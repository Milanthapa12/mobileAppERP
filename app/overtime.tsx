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
  OvertimeDocumentFile,
  OvertimePayload,
  OvertimeRequestRecord,
  overtimeService,
} from '@/services/api/overtimeService';
import DateTimePickerField from '@/components/DateTimePickerField';

const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const niceDate = (iso?: string | null): string => {
  if (!iso) return 'N/A';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${m[3]} ${months[Number(m[2]) - 1]}, ${m[1]}`;
};

const STATUS_META: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#B45309' },
  in_review: { bg: '#DBEAFE', text: '#1D4ED8' },
  approved: { bg: '#DCFCE7', text: '#15803D' },
  rejected: { bg: '#FEE2E2', text: '#B91C1C' },
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

const computeHours = (from: string, to: string): string => {
  if (!from || !to) return '';
  const f = from.match(/^(\d{1,2}):(\d{2})$/);
  const t = to.match(/^(\d{1,2}):(\d{2})$/);
  if (!f || !t) return '';
  let minutes = Number(t[1]) * 60 + Number(t[2]) - (Number(f[1]) * 60 + Number(f[2]));
  if (minutes < 0) minutes += 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

const fmtHours = (h?: string | null): string => {
  if (!h) return 'N/A';
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

const canModify = (r: OvertimeRequestRecord): boolean =>
  Boolean(r.allow_edit) && String(r.status ?? '').toLowerCase() === 'pending';

function DetailModal({
  record,
  loading,
  visible,
  onClose,
  onDelete,
  deleting,
}: {
  record: OvertimeRequestRecord | null;
  loading: boolean;
  visible: boolean;
  onClose: () => void;
  onDelete: (record: OvertimeRequestRecord) => void;
  deleting: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Overtime Request</Text>
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
                </View>

                <View style={styles.empGrid}>
                  {[
                    ['Code', record.code],
                    ['Date', niceDate(record.overtime_date)],
                    ['From Time', record.from_time ?? 'N/A'],
                    ['To Time', record.to_time ?? 'N/A'],
                    ['Hours', fmtHours(record.number_of_hours)],
                    ['Employee', record.employee?.name ?? 'N/A'],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.empGridItem}>
                      <Text style={styles.empGridLabel}>{label}:</Text>
                      <Text style={styles.empGridValue} numberOfLines={1}>
                        {value}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>REASON</Text>
                  <Text style={styles.reasonText}>{record.reason || 'N/A'}</Text>
                </View>

                {(record.attachments ?? []).length > 0 && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>ATTACHMENTS</Text>
                    {(record.attachments ?? []).map((a) => (
                      <Text key={a.id} style={styles.attachmentText} numberOfLines={1}>
                        {a.file_name}
                      </Text>
                    ))}
                  </View>
                )}
              </ScrollView>

              <View style={styles.detailActions}>
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

export default function OvertimeScreen() {
  const router = useRouter();

  const [requests, setRequests] = useState<OvertimeRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<OvertimeRequestRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formMode, setFormMode] = useState(false);
  const [code, setCode] = useState('');
  const [otDate, setOtDate] = useState(toDateStr(new Date()));
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');
  const [reason, setReason] = useState('');
  const [document, setDocument] = useState<OvertimeDocumentFile | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const autoHours = computeHours(fromTime, toTime);

  const loadList = useCallback(async () => {
    try {
      const res = await overtimeService.list();
      setRequests(res?.data ?? []);
      setListError(null);
    } catch (e: any) {
      setListError(e?.message || 'Failed to load overtime requests.');
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
      const generated = await overtimeService.generateCode();
      if (generated) setCode(generated);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to generate code.');
    } finally {
      setGenerating(false);
    }
  }, []);

  const openCreate = () => {
    setFormMode(true);
    setCode('');
    setOtDate(toDateStr(new Date()));
    setFromTime('');
    setToTime('');
    setReason('');
    setDocument(null);
    generateNewCode();
  };

  const closeForm = () => setFormMode(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadList();
    setRefreshing(false);
  };

  const handleView = async (record: OvertimeRequestRecord) => {
    setShowDetail(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await overtimeService.show(record.id);
      setDetail(res?.data ?? record);
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to load request details.');
      setShowDetail(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (record: OvertimeRequestRecord) => {
    const doDelete = async () => {
      setDeleting(true);
      try {
        const res = await overtimeService.destroy(record.id);
        alertMessage('Deleted', res?.message || 'Overtime request deleted.');
        setShowDetail(false);
        await loadList();
      } catch (e: any) {
        alertMessage('Error', e?.message || 'Delete failed.');
      } finally {
        setDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this overtime request?')) doDelete();
    } else {
      Alert.alert('Delete Request', 'Delete this overtime request?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const validateForm = (): string | null => {
    if (!code.trim()) return 'Request code is missing. Tap the refresh icon to generate one.';
    if (!otDate) return 'Select the overtime date.';
    if (!fromTime) return 'Select the from time.';
    if (!toTime) return 'Select the to time.';
    if (!reason.trim()) return 'Reason is required.';
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      alertMessage('Missing information', error);
      return;
    }

    const payload: OvertimePayload = {
      code: code.trim(),
      overtime_date: otDate,
      from_time: fromTime,
      to_time: toTime,
      number_of_hours: autoHours || null,
      reason: reason.trim(),
    };

    setSaving(true);
    try {
      const res = await overtimeService.store(payload, document);
      alertMessage('Success', res?.message || 'Overtime request submitted.');
      setFormMode(false);
      await loadList();
    } catch (e: any) {
      alertMessage('Error', e?.message || 'Failed to submit overtime request.');
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
          <Ionicons name="timer-outline" size={40} color="#CBD5E1" />
          <Text style={styles.centerStateText}>No overtime requests yet.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={openCreate} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Request Overtime</Text>
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
        <Text style={styles.sectionLabel}>MY OVERTIME REQUESTS</Text>
        {requests.map((record) => {
          const meta = statusMeta(record.status);
          return (
            <TouchableOpacity
              key={record.id}
              style={styles.requestCard}
              activeOpacity={0.85}
              onPress={() => handleView(record)}
            >
              <View style={styles.requestTopRow}>
                <Text style={styles.requestCode}>{record.code}</Text>
                <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.statusPillText, { color: meta.text }]}>{statusLabel(record.status)}</Text>
                </View>
              </View>

              <View style={styles.requestMetaRow}>
                <Ionicons name="calendar-outline" size={13} color="#0041E8" />
                <Text style={styles.requestDatesText}>{niceDate(record.overtime_date)}</Text>
                <Ionicons name="time-outline" size={13} color="#64748B" />
                <Text style={styles.requestMetaText}>
                  {record.from_time ?? 'N/A'} - {record.to_time ?? 'N/A'}
                </Text>
              </View>

              <View style={styles.requestMetaRow}>
                <View style={styles.hoursBadge}>
                  <Text style={styles.hoursBadgeText}>{fmtHours(record.number_of_hours)}</Text>
                </View>
                <Text style={styles.requestReason} numberOfLines={1}>
                  {record.reason}
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
      <ScrollView
        contentContainerStyle={styles.formContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionLabel}>OVERTIME DETAILS</Text>

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
              placeholder="OT-..."
              placeholderTextColor="#CBD5E1"
            />
            <TouchableOpacity style={styles.codeRefreshBtn} onPress={generateNewCode} disabled={generating}>
              <Ionicons name={generating ? 'sync-outline' : 'refresh-outline'} size={18} color="#0041E8" />
            </TouchableOpacity>
          </View>
          <Text style={styles.fieldHint}>Tap the refresh icon to generate a new code.</Text>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            Overtime Date <Text style={styles.requiredStar}>*</Text>
          </Text>
          <DateTimePickerField mode="date" value={otDate} onChange={setOtDate} placeholder="Select date" />
        </View>

        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>
              From Time <Text style={styles.requiredStar}>*</Text>
            </Text>
            <DateTimePickerField
              mode="time"
              value={fromTime}
              onChange={(t) => {
                setFromTime(t);
                if (t && toTime && computeHours(t, toTime) === '00:00') setToTime('');
              }}
              placeholder="Set time"
            />
          </View>
          <View style={styles.dateField}>
            <Text style={styles.fieldLabel}>
              To Time <Text style={styles.requiredStar}>*</Text>
            </Text>
            <DateTimePickerField mode="time" value={toTime} onChange={setToTime} placeholder="Set time" />
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Number of Hours</Text>
          <View style={[styles.input, styles.hoursBox]}>
            <Text style={styles.hoursBoxText}>{autoHours || 'N/A'}</Text>
            <Ionicons name="time-outline" size={16} color="#0041E8" />
          </View>
          {fromTime && toTime && <Text style={styles.fieldHint}>Total overtime: {fmtHours(autoHours)}</Text>}
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            Reason <Text style={styles.requiredStar}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.reasonInput]}
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder="Enter reason for overtime..."
            placeholderTextColor="#CBD5E1"
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Attachment (optional)</Text>
          {document ? (
            <View style={styles.docSelectedRow}>
              <Ionicons name="document-attach-outline" size={18} color="#0041E8" />
              <Text style={styles.docName} numberOfLines={1}>
                {document.name}
              </Text>
              <TouchableOpacity onPress={() => setDocument(null)} hitSlop={8} style={styles.docRemoveBtn}>
                <Ionicons name="close" size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.docPickBtn} activeOpacity={0.85} onPress={pickDocument}>
              <Ionicons name="cloud-upload-outline" size={18} color="#0041E8" />
              <Text style={styles.docPickBtnText}>Upload document</Text>
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
            <Text style={styles.submitBtnText}>SUBMIT REQUEST</Text>
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
        <Text style={styles.headerTitle}>{formMode ? 'Request Overtime' : 'Overtime'}</Text>
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
              <Text style={styles.primaryActionButtonText}>REQUEST OVERTIME</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <DetailModal
        record={detail}
        loading={detailLoading}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
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
  requestMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  requestMetaText: { fontSize: 12, color: '#64748B' },
  requestDatesText: { fontSize: 12, color: '#0041E8', fontWeight: '600' },
  hoursBadge: { backgroundColor: '#EEF2FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  hoursBadgeText: { fontSize: 11, fontWeight: '700', color: '#0041E8' },
  requestReason: { flex: 1, fontSize: 12, color: '#64748B' },

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
  modalCloseBtn: { padding: 4 },
  detailLoading: { alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 },
  detailLoadingText: { fontSize: 14, color: '#64748B' },
  modalContent: { padding: 20, paddingBottom: 28 },
  detailTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  empGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 18 },
  empGridItem: { width: '45%' },
  empGridLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5 },
  empGridValue: { fontSize: 14, fontWeight: '600', color: '#0F172A', marginTop: 2 },
  reasonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  reasonLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 6 },
  reasonText: { fontSize: 14, color: '#334155', lineHeight: 20 },
  attachmentText: { fontSize: 13, color: '#0041E8', marginBottom: 4 },
  detailActions: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 4,
    gap: 10,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  deleteBtnText: { color: '#DC2626', fontSize: 14, fontWeight: '700' },

  formContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  formContent: { padding: 16, paddingBottom: 48 },
  fieldBlock: { marginBottom: 18 },
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
    borderWidth: 1,
    borderColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  dateRow: { flexDirection: 'row', gap: 12 },
  dateField: { flex: 1 },
  hoursBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hoursBoxText: { fontSize: 15, fontWeight: '700', color: '#0041E8' },
  reasonInput: { minHeight: 96, textAlignVertical: 'top' },
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
  docPickBtnText: { fontSize: 14, fontWeight: '600', color: '#0041E8' },
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
});