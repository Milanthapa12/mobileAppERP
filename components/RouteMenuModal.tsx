import React from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Radius, Shadow } from '@/constants/theme';
import { ModuleAccess } from '@/services/api/settingsService';

type ActionItem = {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string;
  iconColor: string;
  route?: string;
  showIf?: (ma: ModuleAccess | null | undefined) => boolean;
};

type Section = {
  title: string;
  items: ActionItem[];
};

type Props = {
  visible: boolean;
  onClose: () => void;
  moduleAccess: ModuleAccess | null | undefined;
};

const isOn = (ma: ModuleAccess | null | undefined, key: keyof ModuleAccess) =>
  ma == null || String(ma[key]) === '1';

const SECTIONS: Section[] = [
  {
    title: 'Navigation',
    items: [{ title: 'Dashboard', icon: 'grid-outline', iconBg: '#EEF2FF', iconColor: '#0041E8', route: '/(tabs)' }],
  },
  {
    title: 'Time & Attendance',
    items: [
      { title: 'Attendance', icon: 'time-outline', iconBg: '#F0FDFA', iconColor: '#0D9488', route: '/(tabs)/attendance' },
      { title: 'Attendance Request', icon: 'calendar-outline', iconBg: '#E0F2FE', iconColor: '#0284C7', route: '/attendance-requests' },
      { title: 'Overtime Requests', icon: 'hourglass-outline', iconBg: '#FEF3C7', iconColor: '#D97706', route: '/overtime' },
    ],
  },
  {
    title: 'Leave & Time Off',
    items: [
      { title: 'Leave Applications', icon: 'document-text-outline', iconBg: '#ECFDF5', iconColor: '#059669', route: '/leave' },
      { title: 'In Lieu', icon: 'swap-horizontal-outline', iconBg: '#F3E8FF', iconColor: '#9333EA' },
    ],
  },
  {
    title: 'Work Request',
    items: [
      { title: 'Travel Requests', icon: 'airplane-outline', iconBg: '#E0F2FE', iconColor: '#0284C7' },
      { title: 'Training Request', icon: 'school-outline', iconBg: '#DCEEFB', iconColor: '#2563EB' },
    ],
  },
  {
    title: 'Personal',
    items: [
      {
        title: 'Requisition',
        icon: 'clipboard-outline',
        iconBg: '#FEE2E2',
        iconColor: '#DC2626',
        showIf: (ma) => isOn(ma, 'is_inventory'),
      },
      {
        title: 'My Pays',
        icon: 'wallet-outline',
        iconBg: '#DCFCE7',
        iconColor: '#16A34A',
        route: '/my-pays',
        showIf: (ma) => isOn(ma, 'is_payroll'),
      },
      { title: 'My Approvals', icon: 'checkmark-circle-outline', iconBg: '#F3E8FF', iconColor: '#9333EA', route: '/(tabs)/approvals' },
      { title: 'My Profile', icon: 'person-outline', iconBg: '#EEF2FF', iconColor: '#0041E8', route: '/(tabs)/profile' },
    ],
  },
];

export default function RouteMenuModal({ visible, onClose, moduleAccess }: Props) {
  const router = useRouter();

  const handlePress = (item: ActionItem) => {
    const route = item.route;
    onClose();
    if (route) {
      router.push(route as any);
      return;
    }
    const msg = `${item.title} is coming soon.`;
    if (Platform.OS === 'web') alert(msg);
    else Alert.alert('Coming Soon', msg);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="menu" size={20} color={Colors.primary} />
              <Text style={styles.headerTitle}>Employee Portal</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {SECTIONS.map((section) => {
              const items = section.items.filter((it) => !it.showIf || it.showIf(moduleAccess));
              if (items.length === 0) return null;
              return (
                <View key={section.title} style={styles.section}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  {items.map((item) => {
                    const hasRoute = Boolean(item.route);
                    return (
                      <TouchableOpacity
                        key={item.title}
                        style={styles.item}
                        activeOpacity={0.7}
                        onPress={() => handlePress(item)}
                      >
                        <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                          <Ionicons name={item.icon} size={18} color={item.iconColor} />
                        </View>
                        <Text style={[styles.itemTitle, !hasRoute && styles.itemTitleSoon]}>{item.title}</Text>
                        {!hasRoute && (
                          <Text style={styles.soonTag}>Soon</Text>
                        )}
                        <Ionicons name="chevron-forward" size={16} color={Colors.textPlaceholder} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Colors.textPlaceholder,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bg,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  itemTitleSoon: {
    color: Colors.textPlaceholder,
  },
  soonTag: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.card,
    backgroundColor: Colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  closeBtn: {
    backgroundColor: Colors.primary,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    ...Shadow.primary,
  },
  closeBtnText: {
    color: Colors.card,
    fontSize: 15,
    fontWeight: '700',
  },
});