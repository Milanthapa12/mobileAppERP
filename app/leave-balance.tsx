import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  LeaveCategoryOption,
  LeaveApplication,
  LeaveBalance,
  leaveService,
} from '@/services/api/leaveService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case 'approved':  return { bg: '#DCFCE7', text: '#16A34A' };
    case 'rejected':  return { bg: '#FEE2E2', text: '#DC2626' };
    case 'in_review': return { bg: '#EDE9FE', text: '#7C3AED' };
    default:          return { bg: '#FEF3C7', text: '#D97706' }; // pending
  }
}

function buildLeaveRows(from: string, to: string): { date: string; duration: 'full_day'; days: 1 }[] {
  const rows: { date: string; duration: 'full_day'; days: 1 }[] = [];
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    rows.push({ date: d.toISOString().slice(0, 10), duration: 'full_day', days: 1 });
  }
  return rows;
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(Math.floor(ms / 86_400_000) + 1, 0);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeaveBalanceScreen() {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<LeaveCategoryOption[]>([]);
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [balanceMap, setBalanceMap] = useState<Record<number, LeaveBalance>>({});

  // Apply Modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [selectedBalance, setSelectedBalance] = useState<LeaveBalance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // ── Data Fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [catRes, appRes] = await Promise.all([
        leaveService.getCategories(),
        leaveService.getList(),
      ]);

      const cats: LeaveCategoryOption[] = catRes?.data ?? [];
      const apps: LeaveApplication[] = Array.isArray(appRes?.data)
        ? appRes.data
        : [];

      setCategories(cats);
      setApplications(apps);

      // Fetch balances for each category in parallel
      if (cats.length > 0) {
        const balanceResults = await Promise.allSettled(
          cats.map((c) => leaveService.getBalance(c.value))
        );
        const map: Record<number, LeaveBalance> = {};
        balanceResults.forEach((result, i) => {
          if (result.status === 'fulfilled' && result.value?.data) {
            map[cats[i].value] = result.value.data;
          }
        });
        setBalanceMap(map);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load leave data.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ── Category Balance Load ──────────────────────────────────────────────────
  const handleCategorySelect = async (catId: number) => {
    setSelectedCategoryId(catId);
    if (balanceMap[catId]) {
      setSelectedBalance(balanceMap[catId]);
      return;
    }
    setLoadingBalance(true);
    try {
      const res = await leaveService.getBalance(catId);
      setSelectedBalance(res?.data ?? null);
    } catch {
      setSelectedBalance(null);
    } finally {
      setLoadingBalance(false);
    }
  };

  // ── Submit Leave ───────────────────────────────────────────────────────────
  const handleSubmitLeave = async () => {
    if (!selectedCategoryId) {
      const msg = 'Please select a leave type.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Required', msg);
      return;
    }
    if (!startDate || !endDate) {
      const msg = 'Please enter start and end dates (YYYY-MM-DD).';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Required', msg);
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      const msg = 'End date must be on or after start date.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Invalid Date', msg);
      return;
    }
    if (!reason.trim()) {
      const msg = 'Please enter a reason for your leave request.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Required', msg);
      return;
    }

    const totalDays = daysBetween(startDate, endDate);
    const leaveRows = buildLeaveRows(startDate, endDate);

    // Generate a simple code: LA-{timestamp}
    const code = `LA-${Date.now()}`;

    setSubmitting(true);
    try {
      await leaveService.submit({
        code,
        leave_cat_id: selectedCategoryId,
        effective_from: startDate,
        effective_to: endDate,
        total_days: totalDays,
        reason: reason.trim(),
        leave_rows: leaveRows,
      });

      setShowApplyModal(false);
      setReason('');
      setStartDate('');
      setEndDate('');
      setSelectedCategoryId(null);
      setSelectedBalance(null);

      const successMsg = 'Your leave request has been submitted successfully!';
      Platform.OS === 'web' ? alert(successMsg) : Alert.alert('Success', successMsg);

      // Refresh data
      await fetchData();
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to submit leave request.';
      Platform.OS === 'web' ? alert(errMsg) : Alert.alert('Error', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete Leave ───────────────────────────────────────────────────────────
  const handleDelete = (id: number) => {
    const doDelete = async () => {
      try {
        await leaveService.remove(id);
        setApplications((prev) => prev.filter((a) => a.id !== id));
      } catch (err: any) {
        const msg = err?.message || 'Failed to delete leave application.';
        Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this leave application?')) doDelete();
    } else {
      Alert.alert('Delete Leave', 'Are you sure you want to delete this leave application?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // ── Derived Values ─────────────────────────────────────────────────────────
  const totalRemaining = Object.values(balanceMap).reduce(
    (sum, b) => sum + (b.remaining_days ?? 0), 0
  );
  const selectedCategoryLabel = categories.find((c) => c.value === selectedCategoryId)?.label ?? '';

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0041E8" />
        <View style={styles.blueHeader}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leave Balance & Requests</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0041E8" />
          <Text style={styles.loadingText}>Loading leave data…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0041E8" />

      {/* Header */}
      <View style={styles.blueHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leave Balance & Requests</Text>
        <TouchableOpacity style={styles.backBtn} onPress={handleRefresh}>
          <Ionicons name="refresh-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0041E8" />
        }
      >
        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Total Summary Banner */}
        <View style={styles.summaryBanner}>
          <View>
            <Text style={styles.summaryTitle}>Total Remaining</Text>
            <Text style={styles.summaryDays}>{totalRemaining.toFixed(1)} Days</Text>
          </View>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeText}>
              {new Date().getFullYear()}
            </Text>
          </View>
        </View>

        {/* Leave Category Balance Cards */}
        {categories.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Leave Balance Breakdown</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsScroll}>
              <View style={styles.cardsRow}>
                {categories.map((cat) => {
                  const bal = balanceMap[cat.value];
                  return (
                    <View key={cat.value} style={styles.breakdownCard}>
                      <View style={[styles.cardIconBox, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="calendar" size={20} color="#0041E8" />
                      </View>
                      <Text style={styles.cardTypeTitle} numberOfLines={2}>{cat.label}</Text>
                      <Text style={styles.cardRemaining}>
                        {bal ? `${bal.remaining_days} Days` : '—'}
                      </Text>
                      <Text style={styles.cardTotal}>
                        {bal ? `out of ${bal.total_days} days` : 'loading…'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </>
        )}

        {/* Action Button */}
        <TouchableOpacity
          style={styles.applyBtn}
          activeOpacity={0.88}
          onPress={() => setShowApplyModal(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFF" />
          <Text style={styles.applyBtnText}>APPLY FOR LEAVE</Text>
        </TouchableOpacity>

        {/* Recent Leave Requests List */}
        <Text style={styles.sectionTitle}>
          My Leave Requests {applications.length > 0 ? `(${applications.length})` : ''}
        </Text>

        {applications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No leave applications yet.</Text>
            <Text style={styles.emptyStateSubText}>Tap "Apply for Leave" to submit a request.</Text>
          </View>
        ) : (
          <View style={styles.requestList}>
            {applications.map((req) => {
              const sc = statusColor(req.status);
              const catName = req.leave_category?.name ?? 'Leave';
              return (
                <View key={req.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.requestType} numberOfLines={1}>
                      {catName} ({req.total_days} {req.total_days === 1 ? 'Day' : 'Days'})
                    </Text>
                    <View style={[styles.statusTag, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusTagText, { color: sc.text }]}>
                        {req.status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.requestDates}>
                    {formatDate(req.effective_from)} – {formatDate(req.effective_to)}
                  </Text>
                  <Text style={styles.requestReason} numberOfLines={2}>
                    {req.reason}
                  </Text>
                  {req.status === 'pending' && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(req.id)}
                    >
                      <Ionicons name="trash-outline" size={14} color="#DC2626" />
                      <Text style={styles.deleteBtnText}>Withdraw</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Apply Leave Modal */}
      <Modal
        visible={showApplyModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowApplyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply for Leave</Text>
              <TouchableOpacity onPress={() => setShowApplyModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Leave Type */}
              <Text style={styles.inputLabel}>Leave Type *</Text>
              {categories.length === 0 ? (
                <Text style={styles.noCategories}>No leave categories available.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={styles.typeSelectorRow}>
                    {categories.map((cat) => (
                      <TouchableOpacity
                        key={cat.value}
                        style={[
                          styles.typeChip,
                          selectedCategoryId === cat.value && styles.typeChipActive,
                        ]}
                        onPress={() => handleCategorySelect(cat.value)}
                      >
                        <Text
                          style={[
                            styles.typeChipText,
                            selectedCategoryId === cat.value && styles.typeChipTextActive,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}

              {/* Balance Info */}
              {selectedCategoryId && (
                <View style={styles.balanceInfoRow}>
                  {loadingBalance ? (
                    <ActivityIndicator size="small" color="#0041E8" />
                  ) : selectedBalance ? (
                    <>
                      <Ionicons name="information-circle-outline" size={16} color="#0041E8" />
                      <Text style={styles.balanceInfoText}>
                        {selectedCategoryLabel}: {selectedBalance.remaining_days} day(s) remaining
                        {selectedBalance.carry_forwarded_days > 0
                          ? ` (+${selectedBalance.carry_forwarded_days} carried forward)`
                          : ''}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.balanceInfoText}>Balance unavailable</Text>
                  )}
                </View>
              )}

              {/* Date Range */}
              <View style={styles.dateInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Date *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Date *</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              {/* Days preview */}
              {startDate && endDate && new Date(endDate) >= new Date(startDate) && (
                <Text style={styles.daysPreview}>
                  Total: {daysBetween(startDate, endDate)} day(s)
                </Text>
              )}

              {/* Reason */}
              <Text style={styles.inputLabel}>Reason *</Text>
              <TextInput
                style={[styles.modalInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                value={reason}
                onChangeText={setReason}
                placeholder="Describe your reason for taking leave…"
                placeholderTextColor="#94A3B8"
                multiline
              />

              <TouchableOpacity
                style={[styles.submitModalBtn, submitting && styles.submitModalBtnDisabled]}
                activeOpacity={0.88}
                onPress={handleSubmitLeave}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitModalBtnText}>SUBMIT REQUEST</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  scrollContent: { padding: 18, paddingBottom: 48 },

  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 14, fontWeight: '500' },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '500', flex: 1 },

  summaryBanner: {
    backgroundColor: '#0041E8',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#0041E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryTitle: { color: '#DBEAFE', fontSize: 13, fontWeight: '600' },
  summaryDays: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginTop: 4 },
  summaryBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  summaryBadgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 14 },

  cardsScroll: { marginBottom: 8 },
  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  breakdownCard: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'flex-start',
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardTypeTitle: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 4 },
  cardRemaining: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  cardTotal: { fontSize: 10, color: '#94A3B8', marginTop: 2 },

  applyBtn: {
    flexDirection: 'row',
    backgroundColor: '#0041E8',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    shadowColor: '#0041E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  applyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyStateText: { color: '#64748B', fontSize: 15, fontWeight: '600' },
  emptyStateSubText: { color: '#94A3B8', fontSize: 13, textAlign: 'center' },

  requestList: { gap: 12 },
  requestCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestType: { fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1, marginRight: 8 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusTagText: { fontSize: 11, fontWeight: '700' },
  requestDates: { fontSize: 13, color: '#0041E8', fontWeight: '600' },
  requestReason: { fontSize: 12, color: '#64748B' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingVertical: 4,
  },
  deleteBtnText: { color: '#DC2626', fontSize: 12, fontWeight: '600' },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
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
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  noCategories: { color: '#94A3B8', fontSize: 13, marginBottom: 16 },
  typeSelectorRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  typeChipActive: { backgroundColor: '#0041E8', borderColor: '#0041E8' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  typeChipTextActive: { color: '#FFFFFF', fontWeight: '700' },

  balanceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  balanceInfoText: { fontSize: 12, color: '#1D4ED8', fontWeight: '500', flex: 1 },
  daysPreview: {
    fontSize: 12,
    color: '#0041E8',
    fontWeight: '700',
    marginBottom: 12,
    marginTop: -8,
  },

  dateInputsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
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
  submitModalBtn: {
    backgroundColor: '#0041E8',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  submitModalBtnDisabled: { opacity: 0.65 },
  submitModalBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
