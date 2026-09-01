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

export default function ClaimScreen() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [claimTitle, setClaimTitle] = useState('');
  const [category, setCategory] = useState('Transportation');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const [claimsList, setClaimsList] = useState([
    {
      id: 1,
      title: 'Client Lunch Meeting',
      amount: '$65.00',
      sub: 'Feb 10, 2026 • Meals & Entertainment',
      status: 'Pending',
      statusColor: '#D97706',
      bgColor: '#FEF3C7',
    },
    {
      id: 2,
      title: 'Taxi & Travel Expense',
      amount: '$40.00',
      sub: 'Feb 05, 2026 • Transportation',
      status: 'Pending',
      statusColor: '#D97706',
      bgColor: '#FEF3C7',
    },
    {
      id: 3,
      title: 'Office Stationery & Printing',
      amount: '$40.00',
      sub: 'Jan 28, 2026 • Supplies',
      status: 'Approved',
      statusColor: '#16A34A',
      bgColor: '#DCFCE7',
    },
  ]);

  const handleSubmitClaim = () => {
    if (!claimTitle.trim() || !amount.trim()) {
      const errorMsg = 'Please enter both claim title and amount.';
      if (Platform.OS === 'web') alert(errorMsg);
      else Alert.alert('Required', errorMsg);
      return;
    }

    const newClaim = {
      id: Date.now(),
      title: claimTitle,
      amount: `$${parseFloat(amount).toFixed(2)}`,
      sub: `Today • ${category}`,
      status: 'Pending',
      statusColor: '#D97706',
      bgColor: '#FEF3C7',
    };

    setClaimsList([newClaim, ...claimsList]);
    setShowModal(false);
    setClaimTitle('');
    setAmount('');
    setNotes('');

    const successMsg = 'Reimbursement claim submitted successfully!';
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
        <Text style={styles.headerTitle}>Reimbursement Claims</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Claim Summary */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Pending Claims</Text>
            <Text style={[styles.statValue, { color: '#D97706' }]}>$145.00</Text>
            <Text style={styles.statSub}>{claimsList.filter((c) => c.status === 'Pending').length} Claims</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Approved Total</Text>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>$850.00</Text>
            <Text style={styles.statSub}>12 Claims</Text>
          </View>
        </View>

        {/* Claim Action Button */}
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.88}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="wallet-outline" size={20} color="#FFF" />
          <Text style={styles.actionBtnText}>NEW CLAIM REQUEST</Text>
        </TouchableOpacity>

        {/* History List */}
        <Text style={styles.sectionTitle}>Recent Claim Requests</Text>
        <View style={styles.listContainer}>
          {claimsList.map((item) => (
            <View key={item.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <Text style={styles.logDate}>{item.title}</Text>
                <Text style={styles.claimAmount}>{item.amount}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.logSub}>{item.sub}</Text>
                <View style={[styles.badge, { backgroundColor: item.bgColor }]}>
                  <Text style={[styles.badgeText, { color: item.statusColor }]}>{item.status}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Claim Submission Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Claim Request</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Claim Title</Text>
              <TextInput
                style={styles.modalInput}
                value={claimTitle}
                onChangeText={setClaimTitle}
                placeholder="e.g. Travel Taxi / Team Lunch"
              />

              <View style={styles.dateInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Category</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={category}
                    onChangeText={setCategory}
                    placeholder="Transportation / Meals"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Amount ($)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                    placeholder="0.00"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Notes / Expense Details</Text>
              <TextInput
                style={[styles.modalInput, { height: 70, textAlignVertical: 'top', paddingTop: 10 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add optional notes..."
                multiline={true}
              />

              <TouchableOpacity
                style={styles.submitModalBtn}
                activeOpacity={0.88}
                onPress={handleSubmitClaim}
              >
                <Text style={styles.submitModalBtnText}>SUBMIT CLAIM</Text>
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
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
  },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  statValue: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  statSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  statDivider: { width: 1, height: 44, backgroundColor: '#E2E8F0' },
  actionBtn: {
    flexDirection: 'row',
    backgroundColor: '#0041E8',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    elevation: 4,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 14 },
  listContainer: { gap: 12 },
  logCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logDate: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  claimAmount: { fontSize: 16, fontWeight: '800', color: '#0041E8' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  logSub: { fontSize: 12, color: '#64748B' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  /* Modal Styles */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  dateInputsRow: { flexDirection: 'row', gap: 12 },
  modalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 14, color: '#0F172A', marginBottom: 16 },
  submitModalBtn: { backgroundColor: '#0041E8', height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 16 },
  submitModalBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
