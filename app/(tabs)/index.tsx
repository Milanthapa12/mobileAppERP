import { useAuth } from '@/hooks/useAuth';
import { Colors, Radius, Shadow } from '@/constants/theme';
import AppHeader from '@/components/AppHeader';
import ScreenWrapper from '@/components/ScreenWrapper';
import AttendancePanel from '@/components/AttendancePanel';
import NotificationsModal, { DEFAULT_NOTIFICATIONS } from '@/components/NotificationsModal';
import RouteMenuModal from '@/components/RouteMenuModal';
import { settingsService, ModuleAccess } from '@/services/api/settingsService';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Quick Action Grid Data (mirrors web dashboard QUICK_ACTIONS) ──────────
type QuickAction = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  bg: string;
  color: string;
  route?: string;
  gate?: (ma: ModuleAccess | null | undefined) => boolean;
};

const isOn = (ma: ModuleAccess | null | undefined, key: keyof ModuleAccess) =>
  ma == null || String(ma[key]) === '1';

// ─── Static Pending Approvals ─────────────────────────────────────────────
const PENDING_APPROVALS = [
  { name: 'Milan Thapa',        type: 'Annual Leave'   },
  { name: 'Dion Haryadi Ku...', type: 'Annual Leave'   },
  { name: 'Rina Rahmadi',       type: 'Marriage Leave' },
];

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Apply Leave',            icon: 'umbrella-outline',        bg: Colors.primaryLight, color: Colors.primary,  route: '/leave'                    },
  { label: 'Training Request',       icon: 'school-outline',         bg: Colors.purpleLight,  color: Colors.purple,                                    },
  { label: 'Travel Request',         icon: 'airplane-outline',       bg: Colors.skyLight,     color: Colors.sky,                                        },
  { label: 'Attendance Request',     icon: 'calendar-outline',      bg: Colors.tealLight,    color: Colors.teal,     route: '/attendance-requests' },
  { label: 'Overtime',               icon: 'timer-outline',          bg: Colors.warningLight, color: Colors.warning,  route: '/overtime'                },
  { label: 'In Lieu',                icon: 'swap-horizontal-outline',bg: Colors.emeraldLight, color: Colors.emerald,                                     },
  { label: 'Requisition',            icon: 'clipboard-outline',      bg: Colors.dangerLight,  color: Colors.danger,
    gate: (ma) => isOn(ma, 'is_inventory')                                                                                                             },
  { label: 'My Payslips',            icon: 'wallet-outline',         bg: Colors.successLight, color: Colors.success,  route: '/my-pays',
    gate: (ma) => isOn(ma, 'is_payroll')                                                                                                              },
];

export default function DashboardScreen() {
  const router = useRouter();
  const { user, activeBranch } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccess | null | undefined>(null);

  const loadFeatureSettings = useCallback(async () => {
    try {
      const res = await settingsService.getSettings();
      setModuleAccess(res.data?.featureSetting?.moduleaccess);
    } catch {
      // Fall back to "everything visible" (moduleAccess stays null)
    }
  }, []);

  useEffect(() => {
    loadFeatureSettings();
  }, [loadFeatureSettings]);

  const handleQuickAction = (action: QuickAction) => {
    if (action.route) {
      router.push(action.route as any);
      return;
    }
    const msg = `${action.label} is coming soon.`;
    if (Platform.OS === 'web') alert(msg);
    else Alert.alert('Coming Soon', msg);
  };

  const visibleActions = QUICK_ACTIONS.filter((a) => !a.gate || a.gate(moduleAccess));

  const displayName = user?.name || 'Milan Thapa';
  const branchName  = activeBranch?.name || 'Dhaka, Bangladesh';

  return (
    <ScreenWrapper>
      <AppHeader
        title={branchName}
        userName={displayName}
        notificationCount={3}
        onMenuPress={() => setShowMenu(true)}
        onNotificationPress={() => setShowNotifications(true)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Attendance Panel (previous design + full web parity) ── */}
        <AttendancePanel locationName={branchName} />

        {/* ── Quick Actions ────────────────────────────────────── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.gridContainer}>
          {visibleActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.gridCard}
              activeOpacity={0.8}
              onPress={() => handleQuickAction(action)}
            >
              <View style={styles.badgeWrapper}>
                <View style={[styles.cardIconBox, { backgroundColor: action.bg }]}>
                  <Ionicons name={action.icon} size={24} color={action.color} />
                </View>
                {!action.route && (
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonBadgeText}>Soon</Text>
                  </View>
                )}
              </View>
              <Text style={styles.gridCardLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Pending Approvals ────────────────────────────────── */}
        <View style={styles.approvalCard}>
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
        </View>

      </ScrollView>

      <NotificationsModal
        visible={showNotifications}
        onClose={() => setShowNotifications(false)}
        items={DEFAULT_NOTIFICATIONS}
      />

      <RouteMenuModal
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        moduleAccess={moduleAccess}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },

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
  soonBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.warning,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: Colors.card,
  },
  soonBadgeText: {
    color: Colors.card,
    fontSize: 8,
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
