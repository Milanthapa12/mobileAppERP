import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import AppHeader from '@/components/AppHeader';
import ScreenWrapper from '@/components/ScreenWrapper';
import StatusBadge from '@/components/StatusBadge';
import { Colors, Radius, Shadow } from '@/constants/theme';

export default function ApprovalsScreen() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');

  const [approvalItems, setApprovalItems] = useState([
    {
      id: 1,
      name: user?.name || 'Milan Thapa',
      type: 'Annual Leave',
      date: 'Feb 2, 2026',
      duration: '3 Days (Feb 12 - Feb 14)',
      status: 'Pending',
    },
    {
      id: 2,
      name: 'Dion Haryadi',
      type: 'Annual Leave',
      date: 'Feb 1, 2026',
      duration: '2 Days (Feb 10 - Feb 11)',
      status: 'Pending',
    },
    {
      id: 3,
      name: 'Rina Rahmadi',
      type: 'Marriage Leave',
      date: 'Jan 28, 2026',
      duration: '5 Days (Feb 20 - Feb 25)',
      status: 'Pending',
    },
    {
      id: 4,
      name: 'Budi Santoso',
      type: 'Overtime Claim',
      date: 'Jan 25, 2026',
      duration: '4.0 Hours ($60.00)',
      status: 'Approved',
    },
    {
      id: 5,
      name: 'Siti Aminah',
      type: 'Sick Leave',
      date: 'Jan 22, 2026',
      duration: '1 Day (Jan 22)',
      status: 'Approved',
    },
  ]);

  const handleAction = (id: number, newStatus: 'Approved' | 'Rejected') => {
    setApprovalItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
    );
    const msg = `Request has been ${newStatus.toLowerCase()} successfully!`;
    if (Platform.OS === 'web') alert(msg);
    else Alert.alert('Updated', msg);
  };

  const filteredItems = approvalItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'All' || item.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const pendingCount = approvalItems.filter((i) => i.status === 'Pending').length;

  return (
    <ScreenWrapper>
      <AppHeader
        title="Approvals"
        subtitle={`${pendingCount} pending request${pendingCount !== 1 ? 's' : ''}`}
      />

      {/* Search + Filter Bar */}
      <View style={styles.searchBar}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search-outline" size={18} color={Colors.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employee or request..."
            placeholderTextColor={Colors.textPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textPlaceholder} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterTabsRow}>
          {(['All', 'Pending', 'Approved', 'Rejected'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.filterTabBtn, activeTab === tab && styles.filterTabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.filterTabText, activeTab === tab && styles.filterTabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.cardList}>
          {filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={Colors.textPlaceholder} />
              <Text style={styles.emptyText}>No requests found matching your filters</Text>
            </View>
          ) : (
            filteredItems.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.cardType}>{item.type}</Text>
                  </View>
                  <StatusBadge status={item.status} />
                </View>

                <Text style={styles.cardSub}>Requested on {item.date} • {item.duration}</Text>

                {item.status === 'Pending' ? (
                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={[styles.btn, styles.rejectBtn]}
                      onPress={() => handleAction(item.id, 'Rejected')}
                    >
                      <Text style={styles.rejectText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, styles.approveBtn]}
                      onPress={() => handleAction(item.id, 'Approved')}
                    >
                      <Text style={styles.approveText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    backgroundColor: Colors.card,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text },
  filterTabsRow: { flexDirection: 'row', gap: 8 },
  filterTabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.borderLight,
  },
  filterTabBtnActive: { backgroundColor: Colors.primary },
  filterTabText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  filterTabTextActive: { color: Colors.card },
  content: { padding: 18, paddingBottom: 40 },
  cardList: { gap: 12 },
  card: { backgroundColor: Colors.card, padding: 16, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { fontSize: 15, fontWeight: '800', color: Colors.text },
  cardType: { fontSize: 13, fontWeight: '600', color: Colors.primary, marginTop: 1 },
  cardSub: { fontSize: 12, color: Colors.textMuted },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { flex: 1, height: 40, borderRadius: Radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { backgroundColor: Colors.dangerLight },
  rejectText: { color: Colors.danger, fontWeight: '700', fontSize: 13 },
  approveBtn: { backgroundColor: Colors.primary },
  approveText: { color: Colors.card, fontWeight: '700', fontSize: 13 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { color: Colors.textPlaceholder, fontSize: 14, fontWeight: '600' },
});
