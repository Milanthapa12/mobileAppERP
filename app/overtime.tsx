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

export default function OvertimeScreen() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [otDate, setOtDate] = useState('2026-02-15');
  const [otHours, setOtHours] = useState('3.5');
  const [otTask, setOtTask] = useState('');

  const [overtimeLogs, setOvertimeLogs] = useState([
    {
      id: 1,
      date: 'Sat, Feb 8, 2026',
      hours: '13:02 - 17:00 (4.0 Hours)',
      task: 'Task: Project Deployment & Server Patching',
      status: 'Pending',
      statusColor: '#D97706',
      bgColor: '#FEF3C7',
    },
    {
      id: 2,
      date: 'Fri, Jan 30, 2026',
      hours: '18:00 - 21:00 (3.0 Hours)',
      task: 'Task: Client Release Support',
      status: 'Approved',
      statusColor: '#16A34A',
      bgColor: '#DCFCE7',
    },
    {
      id: 3,
      date: 'Wed, Jan 21, 2026',
      hours: '18:00 - 20:30 (2.5 Hours)',
      task: 'Task: Database Schema Migration',
      status: 'Approved',
      statusColor: '#16A34A',
      bgColor: '#DCFCE7',
    },
  ]);

  const handleSubmitClaim = () => {
    if (!otTask.trim()) {
      const errorMsg = 'Please enter a task description for overtime.';
      if (Platform.OS === 'web') alert(errorMsg);
      else Alert.alert('Required', errorMsg);
      return;
    }

    const newLog = {
      id: Date.now(),
      date: otDate,
      hours: `18:00 - 21:30 (${otHours} Hours)`,
      task: `Task: ${otTask}`,
      status: 'Pending',
      statusColor: '#D97706',
      bgColor: '#FEF3C7',
    };

    setOvertimeLogs([newLog, ...overtimeLogs]);
    setShowModal(false);
    setOtTask('');

    const successMsg = 'Overtime claim submitted successfully for manager approval!';
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
        <Text style={styles.headerTitle}>Overtime Management</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Overtime Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Overtime (Feb)</Text>
            <Text style={styles.statValue}>18.5 Hrs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Claimable Value</Text>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>$280.00</Text>
          </View>
        </View>

        {/* Claim Action Button */}
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.88}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="time-outline" size={20} color="#FFF" />
          <Text style={styles.actionBtnText}>SUBMIT OVERTIME CLAIM</Text>
        </TouchableOpacity>

        {/* History List */}
        <Text style={styles.sectionTitle}>Overtime Log History</Text>
        <View style={styles.listContainer}>
          {overtimeLogs.map((log) => (
            <View key={log.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <Text style={styles.logDate}>{log.date}</Text>
                <View style={[styles.badge, { backgroundColor: log.bgColor }]}>
                  <Text style={[styles.badgeText, { color: log.statusColor }]}>{log.status}</Text>
                </View>
              </View>
              <Text style={styles.logHours}>{log.hours}</Text>
              <Text style={styles.logTask}>{log.task}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Overtime Submission Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Overtime Claim</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.dateInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Date</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={otDate}
                    onChangeText={setOtDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Hours Worked</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={otHours}
                    onChangeText={setOtHours}
                    keyboardType="numeric"
                    placeholder="e.g. 3.5"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Task / Work Performed</Text>
              <TextInput
                style={[styles.modalInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                value={otTask}
                onChangeText={setOtTask}
                placeholder="Describe overtime task..."
                multiline={true}
              />

              <TouchableOpacity
                style={styles.submitModalBtn}
                activeOpacity={0.88}
                onPress={handleSubmitClaim}
              >
                <Text style={styles.submitModalBtnText}>SUBMIT OVERTIME CLAIM</Text>
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
  statValue: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: '#E2E8F0' },
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
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  logHours: { fontSize: 13, color: '#0041E8', fontWeight: '600' },
  logTask: { fontSize: 12, color: '#64748B' },
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
