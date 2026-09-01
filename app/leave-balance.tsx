import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function LeaveBalanceScreen() {
  const router = useRouter();
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedType, setSelectedType] = useState('Annual Leave');
  const [startDate, setStartDate] = useState('2026-03-01');
  const [endDate, setEndDate] = useState('2026-03-03');
  const [reason, setReason] = useState('');

  const [leaveRequests, setLeaveRequests] = useState([
    {
      id: 1,
      type: 'Annual Leave (3 Days)',
      dates: 'Feb 12, 2026 - Feb 14, 2026',
      reason: 'Reason: Family vacation trip',
      status: 'Approved',
      statusColor: '#16A34A',
      bgColor: '#DCFCE7',
    },
    {
      id: 2,
      type: 'Sick Leave (1 Day)',
      dates: 'Jan 20, 2026',
      reason: 'Reason: High fever & doctor consultation',
      status: 'Approved',
      statusColor: '#16A34A',
      bgColor: '#DCFCE7',
    },
    {
      id: 3,
      type: 'Casual Leave (1 Day)',
      dates: 'Feb 28, 2026',
      reason: 'Reason: Personal urgent work',
      status: 'Pending',
      statusColor: '#D97706',
      bgColor: '#FEF3C7',
    },
  ]);

  const handleSubmitLeave = () => {
    if (!reason.trim()) {
      const errorMsg = 'Please enter a reason for your leave request.';
      if (Platform.OS === 'web') alert(errorMsg);
      else Alert.alert('Required', errorMsg);
      return;
    }

    const newReq = {
      id: Date.now(),
      type: `${selectedType} (1 Day)`,
      dates: `${startDate} - ${endDate}`,
      reason: `Reason: ${reason}`,
      status: 'Pending',
      statusColor: '#D97706',
      bgColor: '#FEF3C7',
    };

    setLeaveRequests([newReq, ...leaveRequests]);
    setShowApplyModal(false);
    setReason('');

    const successMsg = 'Your leave request has been submitted to HR successfully!';
    if (Platform.OS === 'web') alert(successMsg);
    else Alert.alert('Success', successMsg);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0041E8" />
      {/* Header */}
      <View style={styles.blueHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leave Balance & Requests</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Total Summary Banner */}
        <View style={styles.summaryBanner}>
          <View>
            <Text style={styles.summaryTitle}>Total Remaining</Text>
            <Text style={styles.summaryDays}>20 Days</Text>
          </View>
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeText}>Year 2026</Text>
          </View>
        </View>

        {/* Leave Category Breakdown Cards */}
        <Text style={styles.sectionTitle}>Leave Balance Breakdown</Text>
        <View style={styles.cardsRow}>
          {/* Annual Leave */}
          <View style={styles.breakdownCard}>
            <View style={[styles.cardIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="calendar" size={22} color="#0041E8" />
            </View>
            <Text style={styles.cardTypeTitle}>Annual Leave</Text>
            <Text style={styles.cardRemaining}>14 Days</Text>
            <Text style={styles.cardTotal}>out of 18 days</Text>
          </View>

          {/* Sick Leave */}
          <View style={styles.breakdownCard}>
            <View style={[styles.cardIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="medkit" size={22} color="#DC2626" />
            </View>
            <Text style={styles.cardTypeTitle}>Sick Leave</Text>
            <Text style={styles.cardRemaining}>4 Days</Text>
            <Text style={styles.cardTotal}>out of 6 days</Text>
          </View>

          {/* Casual Leave */}
          <View style={styles.breakdownCard}>
            <View style={[styles.cardIconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="sparkles" size={22} color="#D97706" />
            </View>
            <Text style={styles.cardTypeTitle}>Casual Leave</Text>
            <Text style={styles.cardRemaining}>2 Days</Text>
            <Text style={styles.cardTotal}>out of 4 days</Text>
          </View>
        </View>

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
        <Text style={styles.sectionTitle}>Recent Leave Requests</Text>
        <View style={styles.requestList}>
          {leaveRequests.map((req) => (
            <View key={req.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <Text style={styles.requestType}>{req.type}</Text>
                <View style={[styles.statusTag, { backgroundColor: req.bgColor }]}>
                  <Text style={[styles.statusTagText, { color: req.statusColor }]}>{req.status}</Text>
                </View>
              </View>
              <Text style={styles.requestDates}>{req.dates}</Text>
              <Text style={styles.requestReason}>{req.reason}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Apply Leave Modal */}
      <Modal
        visible={showApplyModal}
        animationType="slide"
        transparent={true}
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
              {/* Type Selection */}
              <Text style={styles.inputLabel}>Leave Type</Text>
              <View style={styles.typeSelectorRow}>
                {['Annual Leave', 'Sick Leave', 'Casual Leave'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, selectedType === t && styles.typeChipActive]}
                    onPress={() => setSelectedType(t)}
                  >
                    <Text style={[styles.typeChipText, selectedType === t && styles.typeChipTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Start Date & End Date */}
              <View style={styles.dateInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Date</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>End Date</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>

              {/* Reason */}
              <Text style={styles.inputLabel}>Reason for Leave</Text>
              <TextInput
                style={[styles.modalInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                value={reason}
                onChangeText={setReason}
                placeholder="Describe your reason for taking leave..."
                multiline={true}
              />

              <TouchableOpacity
                style={styles.submitModalBtn}
                activeOpacity={0.88}
                onPress={handleSubmitLeave}
              >
                <Text style={styles.submitModalBtnText}>SUBMIT REQUEST</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
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
  scrollContent: { padding: 18, paddingBottom: 40 },
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
  summaryBadge: { backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  summaryBadgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 14 },
  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  breakdownCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'flex-start',
  },
  cardIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  cardTypeTitle: { fontSize: 12, fontWeight: '700', color: '#334155' },
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
  requestList: { gap: 12 },
  requestCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestType: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusTagText: { fontSize: 11, fontWeight: '700' },
  requestDates: { fontSize: 13, color: '#0041E8', fontWeight: '600' },
  requestReason: { fontSize: 12, color: '#64748B' },
  /* Modal Styles */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  typeSelectorRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center' },
  typeChipActive: { backgroundColor: '#0041E8', borderColor: '#0041E8' },
  typeChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  typeChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  dateInputsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  modalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 14, color: '#0F172A', marginBottom: 16 },
  submitModalBtn: { backgroundColor: '#0041E8', height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 16 },
  submitModalBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
