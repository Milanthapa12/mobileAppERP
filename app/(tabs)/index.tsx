import AppHeader from '@/components/AppHeader';
import NotificationsModal, { DEFAULT_NOTIFICATIONS } from '@/components/NotificationsModal';
import ScreenWrapper from '@/components/ScreenWrapper';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { useAttendance } from '@/context/AttendanceContext';
import { useAuth } from '@/hooks/useAuth';
import { useLiveClock } from '@/hooks/useLiveClock';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Quick Action Grid Data ────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'Leave', icon: 'calendar-outline', bg: Colors.primaryLight, color: Colors.primary, route: '/leave-balance' },
  // { label: 'Exceptional\nAttendance', icon: 'checkbox-outline', bg: Colors.tealLight, color: Colors.teal, route: '/(tabs)/attendance' },
  // { label: 'Overtime', icon: 'hourglass-outline', bg: Colors.warningLight, color: Colors.warning, route: '/overtime' },
  // { label: 'Claim', icon: 'wallet-outline', bg: Colors.dangerLight, color: Colors.danger, route: '/claim', badge: 3 },
  // { label: 'Outside\nVisit', icon: 'location-outline', bg: Colors.purpleLight, color: Colors.purple, route: '/(tabs)/attendance' },
  // { label: 'Work Shift', icon: 'partly-sunny-outline', bg: Colors.skyLight, color: Colors.sky, route: '/(tabs)/attendance' },
  // { label: 'Documents', icon: 'folder-open-outline', bg: Colors.emeraldLight, color: Colors.emerald, route: '/(tabs)/documents' },
  { label: 'Attendance\nRequest', icon: 'time-outline', bg: Colors.orangeLight, color: Colors.orange, route: '/(tabs)/attendance' },
] as const;

// ─── Static Pending Approvals ─────────────────────────────────────────────
const PENDING_APPROVALS = [
  { name: 'Milan Thapa', type: 'Annual Leave' },
  { name: 'Dion Haryadi Ku...', type: 'Annual Leave' },
  { name: 'Rina Rahmadi', type: 'Marriage Leave' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const { isCheckedIn, timeIn, timeOut, totalHours, toggleClockIn } = useAttendance();
  const { user, activeBranch } = useAuth();
  const { timeStr, dateStr } = useLiveClock('12h');
  const [showNotifications, setShowNotifications] = useState(false);

  const displayName = user?.name || 'Milan Thapa';
  const branchName = activeBranch?.name || 'Dhaka, Bangladesh';

  const handlePunch = async () => {
    try {
      await toggleClockIn();
      const msg = isCheckedIn ? 'Checked Out successfully!' : 'Checked In successfully!';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Success', msg);
    } catch (err: any) {
      const msg = err?.message || 'Failed to punch.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  return (
    <ScreenWrapper>
      <AppHeader
        title={branchName}
        userName={displayName}
        notificationCount={3}
        onNotificationPress={() => setShowNotifications(true)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Clock & Date ─────────────────────────────────────── */}
        <View style={styles.clockSection}>
          <Text style={styles.clockText}>{timeStr}</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>

        {/* ── Circular Punch Button ────────────────────────────── */}
        <View style={styles.punchArea}>
          <View style={[styles.dashedRing, isCheckedIn && styles.dashedRingOut]}>
            <TouchableOpacity
              style={[styles.punchButton, isCheckedIn ? styles.punchButtonOut : styles.punchButtonIn]}
              activeOpacity={0.85}
              onPress={handlePunch}
            >
              <Ionicons name="hand-left-outline" size={40} color={Colors.card} />
              <Text style={styles.punchLabel}>{isCheckedIn ? 'Day Out' : 'Day In'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Location ─────────────────────────────────────────── */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.locationText}>{branchName}</Text>
        </View>

        {/* ── Day In / Day Out Cards ───────────────────────────── */}
        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Ionicons name="log-in-outline" size={16} color={Colors.success} />
              <Text style={styles.infoCardTitle}>Day In</Text>
            </View>
            <Text style={[styles.infoCardValue, { color: Colors.success }]}>
              {timeIn && timeIn !== '--:--' ? timeIn : '--:--'}
            </Text>
          </View>
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Ionicons name="log-out-outline" size={16} color={Colors.danger} />
              <Text style={styles.infoCardTitle}>Day Out</Text>
            </View>
            <Text style={[styles.infoCardValue, { color: Colors.danger }]}>
              {timeOut && timeOut !== 'not yet' ? timeOut : '--:--'}
            </Text>
          </View>
        </View>

        {/* ── Total Hours ──────────────────────────────────────── */}
        <View style={styles.totalHoursRow}>
          <Ionicons name="time-outline" size={14} color={Colors.primary} />
          <Text style={styles.totalHoursText}>Total Hours Today: </Text>
          <Text style={styles.totalHoursValue}>{totalHours}</Text>
        </View>

        {/* ── Quick Actions ────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.gridContainer}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.gridCard}
              activeOpacity={0.8}
              onPress={() => router.push(action.route as any)}
            >
              <View style={styles.badgeWrapper}>
                <View style={[styles.cardIconBox, { backgroundColor: action.bg }]}>
                  <Ionicons name={action.icon as any} size={24} color={action.color} />
                </View>
                {'badge' in action && action.badge > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{action.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.gridCardLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Pending Approvals ────────────────────────────────── */}
        {/* <View style={styles.approvalCard}>
          <View style={styles.approvalHeader}>
            <View style={styles.approvalTitleRow}>
              <View style={styles.approvalBadge}>
                <Text style={styles.approvalBadgeText}>{PENDING_APPROVALS.length}</Text>
              </View>
              <Text style={styles.approvalTitle}>Need your approval</Text>
            </View>
            <Text style={styles.approvalDateText}>Pending Requests</Text>
          </View>

          <View style={styles.approvalList}>
            {PENDING_APPROVALS.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.approvalItem}
                activeOpacity={0.7}
                onPress={() => router.push('/(tabs)/approvals')}
              >
                <Text style={styles.approvalItemText} numberOfLines={1}>
                  <Text style={styles.approvalItemName}>{item.name}</Text> – {item.type}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.textPlaceholder} />
              </TouchableOpacity>
            ))}
          </View>
        </View> */}

      </ScrollView>

      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        items={DEFAULT_NOTIFICATIONS}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },

  clockSection: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 8,
    backgroundColor: Colors.card,
  },
  clockText: {
    fontSize: 44,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 1,
  },
  dateText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500',
    marginTop: 4,
  },

  punchArea: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: Colors.card,
  },
  dashedRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedRingOut: { borderColor: '#FCA5A5' },
  punchButton: {
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  punchButtonIn: { backgroundColor: Colors.success },
  punchButtonOut: { backgroundColor: Colors.danger },
  punchLabel: {
    color: Colors.card,
    fontSize: 15,
    fontWeight: '700',
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: 20,
    backgroundColor: Colors.card,
  },
  locationText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },

  infoRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 14,
    ...Shadow.sm,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  infoCardTitle: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  infoCardValue: {
    fontSize: 18,
    fontWeight: '800',
  },

  totalHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 14,
    marginBottom: 4,
  },
  totalHoursText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  totalHoursValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },

  sectionHeaderRow: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },

  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  gridCard: {
    width: '22%',
    minWidth: 72,
    flexGrow: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  badgeWrapper: { position: 'relative' },
  cardIconBox: {
    width: 46,
    height: 46,
    borderRadius: Radius.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.danger,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.card,
  },
  notifBadgeText: {
    color: Colors.card,
    fontSize: 10,
    fontWeight: '800',
  },
  gridCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
  },

  approvalCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: 18,
    ...Shadow.md,
  },
  approvalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  approvalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  approvalBadge: {
    backgroundColor: Colors.danger,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approvalBadgeText: {
    color: Colors.card,
    fontSize: 11,
    fontWeight: '800',
  },
  approvalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  approvalDateText: {
    fontSize: 12,
    color: Colors.textPlaceholder,
    fontWeight: '500',
  },
  approvalList: { gap: 12 },
  approvalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  approvalItemText: {
    fontSize: 13,
    color: Colors.textMuted,
    flex: 1,
    marginRight: 8,
  },
  approvalItemName: {
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});
