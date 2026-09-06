import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { payService, Payrun, Earning, Retirement, LoanAndAdvance } from '@/services/api/payService';

// ─── Helpers ────────────────────────────────────────────────────────────────

function toArr<T>(val: T[] | Record<string, T> | null | undefined): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.values(val);
}

function toMap(val: Record<number, number> | null | undefined): Record<number, number> {
  if (!val || Array.isArray(val)) return {};
  return val;
}

function fmt(n: number | string | undefined | null): string {
  const num = parseFloat(String(n ?? 0));
  return isNaN(num) ? '0.00' : num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function groupByFiscalYear(
  list: Payrun[]
): [string, { label: string; payruns: Payrun[] }][] {
  const map = new Map<string, { label: string; payruns: Payrun[] }>();
  list.forEach((p) => {
    const key = String(p.fiscal_year_id);
    if (!map.has(key)) map.set(key, { label: `${p.bs_year}/${p.bs_year + 1} B.S.`, payruns: [] });
    map.get(key)!.payruns.push(p);
  });
  return [...map.entries()].reverse();
}

// ─── Payslip Detail Modal ────────────────────────────────────────────────────

function PayslipDetail({ payrun, onClose }: { payrun: Payrun; onClose: () => void }) {
  const emp = payrun.employee;
  const earnings = toArr<Earning>(payrun.earnings);
  const retirements = toArr<Retirement>(payrun.retirements);
  const loans = toArr<LoanAndAdvance>(payrun.loan_and_advances);
  const earningsMap = toMap(emp?.earnings);
  const statutoryMap = toMap(emp?.statutory);
  const loanMap = toMap(emp?.loan_and_advance);

  const renderTable = (
    title: string,
    rows: { name: string; amount: number; strong?: boolean }[]
  ) => (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.table}>
        {rows.map((r, i) => (
          <View
            key={`${title}-${i}`}
            style={[styles.tableRow, r.strong && styles.tableRowStrong, i > 0 && styles.tableRowDivider]}
          >
            <Text style={[styles.tableName, r.strong && styles.tableNameStrong]}>{r.name}</Text>
            <Text style={[styles.tableAmount, r.strong && styles.tableAmountStrong]}>{fmt(r.amount)}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Pay Slip</Text>
              <Text style={styles.modalSubtitle}>
                {payrun.bs_month_name} {payrun.bs_year} · {payrun.from_date_bs} to {payrun.to_date_bs}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
            {/* Employee info grid */}
            <View style={styles.empGrid}>
              {[
                ['Employee', emp?.employee_name ?? '—'],
                ['Code', emp?.employee_code ?? '—'],
                ['Period', `${payrun.from_date_ad} → ${payrun.to_date_ad}`],
                ['Days Worked', String(emp?.days ?? '—')],
              ].map(([label, value]) => (
                <View key={label} style={styles.empGridItem}>
                  <Text style={styles.empGridLabel}>{label}:</Text>
                  <Text style={styles.empGridValue} numberOfLines={1}>{value}</Text>
                </View>
              ))}
            </View>

            {renderTable('Earnings', [
              ...earnings.map((e) => ({ name: e.name, amount: earningsMap[e.id] ?? 0 })),
              { name: 'Gross Salary', amount: emp?.gross_salary ?? 0, strong: true },
            ])}

            {retirements.length > 0 &&
              renderTable(
                'Statutory Deductions',
                retirements.map((r) => ({ name: r.name, amount: statutoryMap[r.id] ?? 0 }))
              )}

            {renderTable('Tax', [
              { name: 'SST Tax', amount: emp?.sst_tax ?? 0 },
              { name: 'Remuneration Tax', amount: emp?.remuneration_tax ?? 0 },
              { name: 'Total Tax', amount: emp?.total_tax ?? 0, strong: true },
            ])}

            {loans.length > 0 &&
              renderTable(
                'Loans & Advances',
                loans.map((l) => ({ name: l.name, amount: loanMap[l.id] ?? 0 }))
              )}

            {/* Net summary */}
            <View style={styles.netCard}>
              <View>
                <Text style={styles.netLabel}>NET PAYABLE</Text>
                <Text style={styles.netValue}>NPR {fmt(emp?.net_monthly_payable)}</Text>
              </View>
              <View style={styles.netSub}>
                <Text style={styles.netSubText}>Gross: {fmt(emp?.gross_salary)}</Text>
                <Text style={styles.netSubText}>Deduction: {fmt(emp?.total_deduction)}</Text>
                <Text style={styles.netSubText}>Tax: {fmt(emp?.total_tax)}</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function MyPaysScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [payruns, setPayruns] = useState<Payrun[]>([]);
  const [selectedFY, setSelectedFY] = useState<string>('');
  const [selectedPayrun, setSelectedPayrun] = useState<Payrun | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payService.getMyPays();
      const data = res.data;
      const list = toArr<Payrun>(data?.payruns);
      setPayruns(list);
      const fiscalYears = groupByFiscalYear(list);
      setSelectedFY((prev) => (prev && fiscalYears.some(([k]) => k === prev) ? prev : (fiscalYears[0]?.[0] ?? '')));
    } catch (e: any) {
      const msg = e?.message || 'Failed to load payslips.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fiscalYears = useMemo(() => groupByFiscalYear(payruns), [payruns]);
  const currentPayruns = useMemo(
    () => fiscalYears.find(([k]) => k === selectedFY)?.[1].payruns ?? [],
    [fiscalYears, selectedFY]
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0041E8" />
      {/* Header */}
      <View style={styles.blueHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Pays</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color="#0041E8" />
          <Text style={styles.centerText}>Loading payslips...</Text>
        </View>
      ) : payruns.length === 0 ? (
        <View style={styles.centerWrap}>
          <Ionicons name="wallet-outline" size={40} color="#94A3B8" />
          <Text style={styles.centerText}>No payslips available yet.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Fiscal year chips */}
          {fiscalYears.length > 1 && (
            <View style={styles.fyRow}>
              {fiscalYears.map(([key, fy]) => {
                const active = key === selectedFY;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setSelectedFY(key)}
                    style={[styles.fyChip, active && styles.fyChipActive]}
                  >
                    <Text style={[styles.fyChipText, active && styles.fyChipTextActive]}>{fy.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={styles.sectionLabel}>SELECT MONTH</Text>
          <View style={styles.monthGrid}>
            {currentPayruns.map((p) => (
              <TouchableOpacity
                key={p.payrun_id}
                onPress={() => setSelectedPayrun(p)}
                style={styles.monthCard}
                activeOpacity={0.85}
              >
                <Text style={styles.monthRunType}>{p.run_type?.replaceAll('_', ' ') || 'Payrun'}</Text>
                <Text style={styles.monthName}>{p.bs_month_name}</Text>
                <Text style={styles.monthYear}>{p.bs_year}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {selectedPayrun && <PayslipDetail payrun={selectedPayrun} onClose={() => setSelectedPayrun(null)} />}
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
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerText: { fontSize: 14, color: '#64748B' },
  scrollContent: { padding: 18, paddingBottom: 40 },
  fyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  fyChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  fyChipActive: { backgroundColor: '#0041E8', borderColor: '#0041E8' },
  fyChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  fyChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#64748B',
    marginBottom: 12,
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  monthCard: {
    width: '30%',
    flexGrow: 1,
    minWidth: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    elevation: 2,
  },
  monthRunType: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  monthName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  monthYear: { fontSize: 12, color: '#64748B', marginTop: 2 },
  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
  },
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
  modalContent: { padding: 20, paddingBottom: 40 },
  empGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  empGridItem: { width: '48%', flexGrow: 1 },
  empGridLabel: { fontSize: 11, color: '#64748B' },
  empGridValue: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginTop: 2 },
  section: { marginBottom: 20 },
  table: { borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tableRowStrong: { backgroundColor: '#F8FAFC', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  tableRowDivider: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  tableName: { fontSize: 13, color: '#334155', flex: 1 },
  tableNameStrong: { fontWeight: '700', color: '#0F172A' },
  tableAmount: { fontSize: 13, color: '#334155', fontWeight: '600' },
  tableAmountStrong: { fontWeight: '800', color: '#0041E8' },
  netCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
  },
  netLabel: { fontSize: 11, letterSpacing: 1.5, fontWeight: '700', color: '#64748B' },
  netValue: { fontSize: 26, fontWeight: '800', color: '#0041E8', marginTop: 4 },
  netSub: { alignItems: 'flex-end', gap: 2 },
  netSubText: { fontSize: 12, color: '#64748B' },
});